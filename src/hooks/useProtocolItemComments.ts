import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { proxySelect, proxyInsert, proxyUpdate, proxyDelete } from "@/lib/dbProxy";
import { useCurrentProfile } from "@/hooks/useCurrentProfile";

export interface DbProtocolItemComment {
  id: string;
  item_id: string;
  author_id: string;
  content: string;
  created_at: string;
}

export function useProtocolItemComments(itemId: string | null) {
  return useQuery({
    queryKey: ["protocol_item_comments", itemId],
    queryFn: async () => {
      if (!itemId) return [];
      const { data, error } = await proxySelect<DbProtocolItemComment>("protocol_item_comments", {
        filters: [{ column: "item_id", operator: "eq", value: itemId }],
        order: [{ column: "created_at", ascending: true }],
      });
      if (error) throw new Error(error.message);
      return data || [];
    },
    enabled: !!itemId && !itemId.startsWith("temp-"),
    retry: 2,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 10000),
  });
}

export function useCreateProtocolItemComment() {
  const queryClient = useQueryClient();
  const { data: profile } = useCurrentProfile();

  return useMutation({
    mutationFn: async (comment: {
      item_id: string;
      author_id: string;
      content: string;
      mentionedProfileIds?: string[];
      protocolTitle?: string;
      authorName?: string;
    }) => {
      const { data, error } = await proxyInsert<DbProtocolItemComment>(
        "protocol_item_comments",
        {
          item_id: comment.item_id,
          author_id: comment.author_id,
          content: comment.content,
        },
        "*"
      );

      if (error) throw new Error(error.message);
      const createdComment = data?.[0] as DbProtocolItemComment;

      // Создание записей об упоминаниях и уведомлений
      const mentionedProfileIds = comment.mentionedProfileIds || [];
      if (mentionedProfileIds.length > 0 && createdComment) {
        // Вставляем записи об упоминаниях
        await proxyInsert("protocol_item_comment_mentions", 
          mentionedProfileIds.map(userId => ({
            comment_id: createdComment.id,
            mentioned_user_id: userId,
          }))
        );

        // Создаём уведомления для упомянутых пользователей
        const notificationsToCreate = mentionedProfileIds
          .filter(mentionedId => mentionedId !== profile?.id) // Не уведомляем самого себя
          .map(mentionedId => ({
            recipient_id: mentionedId,
            type: "mention" as const,
            title: "Вас упомянули в комментарии",
            body: `${comment.authorName || "Пользователь"} в протоколе "${comment.protocolTitle || "Протокол"}"`,
            link: null,
            related_task_id: null,
          }));

        if (notificationsToCreate.length > 0) {
          const { error: notifError } = await proxyInsert("notifications", notificationsToCreate);
          if (notifError) {
            console.error("Failed to create mention notifications:", notifError);
          }
        }
      }

      return createdComment;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["protocol_item_comments", variables.item_id] });
    },
  });
}

export function useUpdateProtocolItemComment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      item_id,
      content,
    }: {
      id: string;
      item_id: string;
      content: string;
    }) => {
      const { data, error } = await proxyUpdate<DbProtocolItemComment>(
        "protocol_item_comments",
        { content },
        [{ column: "id", operator: "eq", value: id }],
        "*"
      );

      if (error) throw new Error(error.message);
      return { ...data?.[0], item_id } as DbProtocolItemComment & { item_id: string };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["protocol_item_comments", data.item_id] });
    },
  });
}

export function useDeleteProtocolItemComment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, item_id }: { id: string; item_id: string }) => {
      const { error } = await proxyDelete("protocol_item_comments", [
        { column: "id", operator: "eq", value: id },
      ]);

      if (error) throw new Error(error.message);
      return { id, item_id };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["protocol_item_comments", data.item_id] });
    },
  });
}
