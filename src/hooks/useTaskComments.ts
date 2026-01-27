import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { proxySelect, proxyInsert, proxyDelete } from "@/lib/dbProxy";
import { useCurrentProfile } from "@/hooks/useCurrentProfile";
import { useCreateNotification } from "@/hooks/useNotifications";

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
  const createNotification = useCreateNotification();

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
      
      // Создание записей об упоминаниях
      if (mentionedProfileIds.length > 0 && comment) {
        // Вставляем записи об упоминаниях
        await proxyInsert("comment_mentions", 
          mentionedProfileIds.map(userId => ({
            comment_id: comment.id,
            mentioned_user_id: userId,
          }))
        );

        // Создаём уведомления для упомянутых пользователей
        for (const mentionedId of mentionedProfileIds) {
          // Не уведомляем самого себя
          if (mentionedId !== profile.id) {
            await createNotification.mutateAsync({
              recipient_id: mentionedId,
              type: "mention",
              title: "Вас упомянули в комментарии",
              body: `${authorName} в задаче "${taskTitle}"`,
              related_task_id: taskId,
            });
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
