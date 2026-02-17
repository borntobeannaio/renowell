import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { proxySelect, proxyInsert, proxyUpdate, proxyDelete } from "@/lib/dbProxy";
import { useCurrentProfile } from "@/hooks/useCurrentProfile";

export interface TaskComment {
  id: string;
  task_id: string;
  author_id: string;
  content: string;
  created_at: string;
  updated_at: string;
  author?: {
    id: string;
    first_name: string | null;
    last_name: string | null;
    avatar_url: string | null;
  };
}

export function useTaskComments(taskId: string | null) {
  return useQuery({
    queryKey: ["task-comments", taskId],
    queryFn: async () => {
      if (!taskId) return [];
      
      const { data, error } = await proxySelect<TaskComment>("task_comments", {
        select: "*, author:profiles!task_comments_author_id_fkey(id, first_name, last_name, avatar_url)",
        filters: [{ column: "task_id", operator: "eq", value: taskId }],
        order: [{ column: "created_at", ascending: true }],
      });

      if (error) throw new Error(error.message);
      return (data as TaskComment[]) || [];
    },
    enabled: !!taskId,
  });
}

export function useCreateTaskComment() {
  const queryClient = useQueryClient();
  const { data: profile } = useCurrentProfile();

  return useMutation({
    mutationFn: async ({ 
      taskId, 
      content,
      mentionedProfileIds = [],
      taskTitle = "Задача",
      authorName = "Пользователь"
    }: { 
      taskId: string; 
      content: string;
      mentionedProfileIds?: string[];
      taskTitle?: string;
      authorName?: string;
    }) => {
      if (!profile?.id) throw new Error("Профиль пользователя не найден");

      // Создание комментария
      const { data, error } = await proxyInsert<TaskComment>(
        "task_comments",
        {
          task_id: taskId,
          author_id: profile.id,
          content: content.trim(),
        },
        "*, author:profiles!task_comments_author_id_fkey(id, first_name, last_name, avatar_url)"
      );

      if (error) throw new Error(error.message);
      
      const comment = data?.[0];
      
      // Создание записей об упоминаниях и уведомлений
      if (mentionedProfileIds.length > 0 && comment) {
        // Вставляем записи об упоминаниях
        await proxyInsert("comment_mentions", 
          mentionedProfileIds.map(userId => ({
            comment_id: comment.id,
            mentioned_user_id: userId,
          }))
        );

        // Создаём уведомления для упомянутых пользователей напрямую через proxyInsert
        const commentPreview = content.trim().length > 150 
          ? content.trim().substring(0, 150) + '...' 
          : content.trim();
        
        const notificationsToCreate = mentionedProfileIds
          .filter(mentionedId => mentionedId !== profile.id) // Не уведомляем самого себя
          .map(mentionedId => ({
            recipient_id: mentionedId,
            type: "mention" as const,
            title: `Вас упомянули в задаче "${taskTitle}"`,
            body: commentPreview,
            link: `/tasks?task=${taskId}`,
            related_task_id: taskId,
          }));

        if (notificationsToCreate.length > 0) {
          const { error: notifError } = await proxyInsert("notifications", notificationsToCreate);
          if (notifError) {
            console.error("Failed to create mention notifications:", notifError);
          }
        }
      }

      return comment;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["task-comments", variables.taskId] });
    },
  });
}

export function useUpdateTaskComment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ 
      commentId, 
      taskId, 
      content 
    }: { 
      commentId: string; 
      taskId: string; 
      content: string;
    }) => {
      const { data, error } = await proxyUpdate<TaskComment>(
        "task_comments",
        { content },
        [{ column: "id", operator: "eq", value: commentId }],
        "*, author:profiles!task_comments_author_id_fkey(id, first_name, last_name, avatar_url)"
      );

      if (error) throw new Error(error.message);
      return { comment: data?.[0], taskId };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["task-comments", data.taskId] });
    },
  });
}

export function useDeleteTaskComment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ commentId, taskId }: { commentId: string; taskId: string }) => {
      const { error } = await proxyDelete("task_comments", [
        { column: "id", operator: "eq", value: commentId },
      ]);

      if (error) throw new Error(error.message);
      return { taskId };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["task-comments", data.taskId] });
    },
  });
}
