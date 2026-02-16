import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { proxySelect, proxyInsert } from "@/lib/dbProxy";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentProfile } from "@/hooks/useCurrentProfile";
import { useEffect } from "react";

// Anna's profile ID — the support admin
export const SUPPORT_ADMIN_PROFILE_ID = "a605b92c-b750-4772-84a3-9a45730af9c8";

export interface SupportThread {
  userProfileId: string;
  userName: string;
  lastMessage: string;
  lastMessageAt: string;
  unreadCount: number;
}

interface SupportMessageRow {
  id: string;
  user_profile_id: string;
  direction: string;
  content: string;
  created_at: string;
}

interface ProfileRow {
  id: string;
  first_name: string | null;
  last_name: string | null;
}

export function useIsSupportAdmin() {
  const { data: profile } = useCurrentProfile();
  return profile?.id === SUPPORT_ADMIN_PROFILE_ID;
}

/** Fetch all support threads (grouped by user) — admin only */
export function useSupportThreads() {
  const { data: profile } = useCurrentProfile();
  const isAdmin = profile?.id === SUPPORT_ADMIN_PROFILE_ID;

  return useQuery({
    queryKey: ["support_threads"],
    queryFn: async () => {
      // Fetch ALL support messages via service-role proxy
      const { data: messages, error } = await proxySelect<SupportMessageRow>("support_messages", {
        order: [{ column: "created_at", ascending: true }],
      });
      if (error) throw new Error(error.message);
      if (!messages?.length) return [];

      // Group by user_profile_id
      const byUser = new Map<string, SupportMessageRow[]>();
      for (const msg of messages) {
        const arr = byUser.get(msg.user_profile_id) || [];
        arr.push(msg);
        byUser.set(msg.user_profile_id, arr);
      }

      // Fetch profile names for all users
      const userIds = Array.from(byUser.keys());
      const { data: profiles } = await proxySelect<ProfileRow>("profiles", {
        select: "id, first_name, last_name",
        filters: [{ column: "id", operator: "in", value: userIds }],
      });

      const profileMap = new Map<string, string>();
      for (const p of profiles || []) {
        profileMap.set(p.id, [p.first_name, p.last_name].filter(Boolean).join(" ") || "Пользователь");
      }

      const threads: SupportThread[] = [];
      for (const [userId, msgs] of byUser) {
        const last = msgs[msgs.length - 1];
        threads.push({
          userProfileId: userId,
          userName: profileMap.get(userId) || "Пользователь",
          lastMessage: last.content,
          lastMessageAt: last.created_at,
          unreadCount: 0,
        });
      }

      // Sort by last message time descending
      threads.sort((a, b) => new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime());
      return threads;
    },
    enabled: isAdmin,
  });
}

/** Fetch messages for a specific user's support chat — admin only */
export function useSupportUserMessages(userProfileId: string | null) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["support_messages_admin", userProfileId],
    queryFn: async () => {
      if (!userProfileId) return [];
      const { data, error } = await proxySelect<SupportMessageRow>("support_messages", {
        filters: [{ column: "user_profile_id", operator: "eq", value: userProfileId }],
        order: [{ column: "created_at", ascending: true }],
      });
      if (error) throw new Error(error.message);
      return data || [];
    },
    enabled: !!userProfileId,
  });

  // Realtime for new messages
  useEffect(() => {
    if (!userProfileId) return;
    const channel = supabase
      .channel(`support-admin-${userProfileId}`)
      .on("postgres_changes", {
        event: "INSERT",
        schema: "public",
        table: "support_messages",
        filter: `user_profile_id=eq.${userProfileId}`,
      }, () => {
        queryClient.invalidateQueries({ queryKey: ["support_messages_admin", userProfileId] });
        queryClient.invalidateQueries({ queryKey: ["support_threads"] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [userProfileId, queryClient]);

  return query;
}

/** Send a reply as admin to a user's support chat */
export function useSendSupportReply() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ userProfileId, content }: { userProfileId: string; content: string }) => {
      const { data, error } = await proxyInsert("support_messages", {
        user_profile_id: userProfileId,
        direction: "incoming", // incoming = from support to user
        content,
      }, "*");
      if (error) throw new Error(error.message);
      return data;
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ["support_messages_admin", vars.userProfileId] });
      queryClient.invalidateQueries({ queryKey: ["support_threads"] });
      queryClient.invalidateQueries({ queryKey: ["support_messages"] });
    },
  });
}
