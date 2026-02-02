import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { proxySelect, proxyInsert, proxyUpdate } from "@/lib/dbProxy";
import { useAuth } from "@/hooks/useAuth";

interface ChatReadStatus {
  id: string;
  conversation_id: string;
  user_id: string;
  last_read_at: string;
}

interface UnreadCount {
  conversationId: string;
  count: number;
}

// Sound notification
const NOTIFICATION_SOUND_URL = "https://assets.mixkit.co/active_storage/sfx/2354/2354-preview.mp3";

let notificationAudio: HTMLAudioElement | null = null;

function playNotificationSound() {
  try {
    if (!notificationAudio) {
      notificationAudio = new Audio(NOTIFICATION_SOUND_URL);
      notificationAudio.volume = 0.5;
    }
    notificationAudio.currentTime = 0;
    notificationAudio.play().catch(() => {
      // Autoplay blocked - ignore
    });
  } catch (e) {
    console.warn("Could not play notification sound", e);
  }
}

// Hook to get user's profile ID
function useProfileId() {
  const { user } = useAuth();
  
  return useQuery({
    queryKey: ["profile-id", user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data } = await proxySelect<{ id: string }>("profiles", {
        select: "id",
        filters: [{ column: "user_id", operator: "eq", value: user.id }],
        limit: 1,
      });
      return data?.[0]?.id || null;
    },
    enabled: !!user,
  });
}

// Hook to fetch read status for all conversations
export function useChatReadStatus() {
  const { data: profileId } = useProfileId();

  return useQuery({
    queryKey: ["chat-read-status", profileId],
    queryFn: async () => {
      if (!profileId) return [];
      const { data, error } = await proxySelect<ChatReadStatus>("chat_read_status", {
        filters: [{ column: "user_id", operator: "eq", value: profileId }],
      });
      if (error) throw new Error(error.message);
      return data || [];
    },
    enabled: !!profileId,
  });
}

// Hook to get unread counts per conversation
export function useUnreadCounts(conversationIds: string[]) {
  const { data: profileId } = useProfileId();
  const { data: readStatus = [] } = useChatReadStatus();

  return useQuery({
    queryKey: ["unread-counts", profileId, conversationIds, readStatus],
    queryFn: async (): Promise<UnreadCount[]> => {
      if (!profileId || conversationIds.length === 0) return [];

      const counts: UnreadCount[] = [];

      for (const conversationId of conversationIds) {
        const status = readStatus.find(s => s.conversation_id === conversationId);
        const lastReadAt = status?.last_read_at || "1970-01-01T00:00:00Z";

        // Count messages after last_read_at that are not from current user
        const { data } = await proxySelect<{ id: string }>("chat_messages", {
          select: "id",
          filters: [
            { column: "conversation_id", operator: "eq", value: conversationId },
            { column: "created_at", operator: "gt", value: lastReadAt },
            { column: "sender_id", operator: "neq", value: profileId },
          ],
        });

        counts.push({
          conversationId,
          count: data?.length || 0,
        });
      }

      return counts;
    },
    enabled: !!profileId && conversationIds.length > 0,
    staleTime: 10_000,
  });
}

// Hook to mark conversation as read
export function useMarkConversationRead() {
  const queryClient = useQueryClient();
  const { data: profileId } = useProfileId();

  return useMutation({
    mutationFn: async (conversationId: string) => {
      if (!profileId) throw new Error("No profile");

      // Check if record exists
      const { data: existing } = await proxySelect<ChatReadStatus>("chat_read_status", {
        filters: [
          { column: "conversation_id", operator: "eq", value: conversationId },
          { column: "user_id", operator: "eq", value: profileId },
        ],
        limit: 1,
      });

      if (existing && existing.length > 0) {
        // Update existing record
        await proxyUpdate("chat_read_status", 
          { last_read_at: new Date().toISOString() },
          [
            { column: "conversation_id", operator: "eq", value: conversationId },
            { column: "user_id", operator: "eq", value: profileId },
          ]
        );
      } else {
        // Insert new record
        await proxyInsert("chat_read_status", {
          conversation_id: conversationId,
          user_id: profileId,
          last_read_at: new Date().toISOString(),
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["chat-read-status"] });
      queryClient.invalidateQueries({ queryKey: ["unread-counts"] });
    },
  });
}

// Hook to listen for new messages and play sound
export function useChatNotificationSound(
  currentConversationId: string | null,
  isOpen: boolean
) {
  const { data: profileId } = useProfileId();
  const queryClient = useQueryClient();
  const lastMessageIdRef = useRef<string | null>(null);

  const handleNewMessage = useCallback((payload: {
    new: { id: string; sender_id: string; conversation_id: string };
  }) => {
    const msg = payload.new;
    
    // Don't play sound for own messages
    if (msg.sender_id === profileId) return;
    
    // Don't play if this message was already processed
    if (msg.id === lastMessageIdRef.current) return;
    lastMessageIdRef.current = msg.id;
    
    // Don't play sound if user is viewing this conversation
    if (isOpen && currentConversationId === msg.conversation_id) return;
    
    // Play notification sound
    playNotificationSound();
    
    // Invalidate unread counts
    queryClient.invalidateQueries({ queryKey: ["unread-counts"] });
  }, [profileId, isOpen, currentConversationId, queryClient]);

  useEffect(() => {
    if (!profileId) return;

    const channel = supabase
      .channel("chat-notifications")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "chat_messages",
        },
        handleNewMessage
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [profileId, handleNewMessage]);
}

// Get total unread count across all conversations
export function useTotalUnreadCount(conversationIds: string[]) {
  const { data: unreadCounts = [] } = useUnreadCounts(conversationIds);
  
  return unreadCounts.reduce((total, c) => total + c.count, 0);
}
