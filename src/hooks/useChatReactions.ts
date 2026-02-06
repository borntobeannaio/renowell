import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { proxySelect, proxyInsert, proxyDelete } from "@/lib/dbProxy";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentProfile } from "@/hooks/useCurrentProfile";

interface Reaction {
  id: string;
  message_id: string;
  user_id: string;
  emoji: string;
  created_at: string;
}

export interface ReactionGroup {
  emoji: string;
  count: number;
  hasOwn: boolean;
}

export function useMessageReactions(conversationId: string | null) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["chat-reactions", conversationId],
    queryFn: async () => {
      if (!conversationId) return [];
      // Get all message ids for this conversation first, then reactions
      const { data: messages } = await proxySelect<{ id: string }>("chat_messages", {
        select: "id",
        filters: [{ column: "conversation_id", operator: "eq", value: conversationId }],
      });
      if (!messages || messages.length === 0) return [];

      const messageIds = messages.map((m) => m.id);
      const { data, error } = await proxySelect<Reaction>("chat_message_reactions", {
        filters: [{ column: "message_id", operator: "in", value: messageIds }],
      });
      if (error) throw new Error(error.message);
      return data || [];
    },
    enabled: !!conversationId,
    staleTime: 30_000,
  });

  // Realtime subscription
  useEffect(() => {
    if (!conversationId) return;

    const channel = supabase
      .channel(`chat-reactions-${conversationId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "chat_message_reactions" },
        () => {
          queryClient.invalidateQueries({ queryKey: ["chat-reactions", conversationId] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [conversationId, queryClient]);

  return query;
}

export function useToggleReaction(conversationId: string | null) {
  const queryClient = useQueryClient();
  const { data: profile } = useCurrentProfile();

  return useMutation({
    mutationFn: async ({ messageId, emoji }: { messageId: string; emoji: string }) => {
      if (!profile?.id) throw new Error("No profile");

      // Check if reaction already exists
      const { data: existing } = await proxySelect<Reaction>("chat_message_reactions", {
        filters: [
          { column: "message_id", operator: "eq", value: messageId },
          { column: "user_id", operator: "eq", value: profile.id },
          { column: "emoji", operator: "eq", value: emoji },
        ],
        limit: 1,
      });

      if (existing && existing.length > 0) {
        // Remove
        await proxyDelete("chat_message_reactions", [
          { column: "message_id", operator: "eq", value: messageId },
          { column: "user_id", operator: "eq", value: profile.id },
          { column: "emoji", operator: "eq", value: emoji },
        ]);
      } else {
        // Add
        await proxyInsert("chat_message_reactions", {
          message_id: messageId,
          user_id: profile.id,
          emoji,
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["chat-reactions", conversationId] });
    },
  });
}

/** Group reactions by emoji for a specific message */
export function groupReactions(
  reactions: { message_id: string; user_id: string; emoji: string }[],
  messageId: string,
  currentUserId: string | undefined
): ReactionGroup[] {
  const messageReactions = reactions.filter((r) => r.message_id === messageId);
  const grouped = new Map<string, { count: number; hasOwn: boolean }>();

  for (const r of messageReactions) {
    const existing = grouped.get(r.emoji) || { count: 0, hasOwn: false };
    existing.count++;
    if (r.user_id === currentUserId) existing.hasOwn = true;
    grouped.set(r.emoji, existing);
  }

  return Array.from(grouped.entries()).map(([emoji, { count, hasOwn }]) => ({
    emoji,
    count,
    hasOwn,
  }));
}
