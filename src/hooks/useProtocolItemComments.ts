import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { proxySelect, proxyInsert, proxyUpdate, proxyDelete } from "@/lib/dbProxy";

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

  return useMutation({
    mutationFn: async (comment: {
      item_id: string;
      author_id: string;
      content: string;
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
      return data?.[0] as DbProtocolItemComment;
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
