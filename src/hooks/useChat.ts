import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { supabaseQuery } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";

export interface ChatConversation {
  id: string;
  title: string;
  type: "direct" | "group";
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface ChatMessage {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string;
  created_at: string;
  sender?: {
    first_name: string | null;
    last_name: string | null;
  };
}

export interface AIMessage {
  id: string;
  user_id: string;
  role: "user" | "assistant";
  content: string;
  created_at: string;
}

// Hook for fetching user's conversations
export function useConversations() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["conversations", user?.id],
    queryFn: async () => {
      if (!user) return [];
      return supabaseQuery(
        () => supabase
          .from("chat_conversations")
          .select("*")
          .order("updated_at", { ascending: false }),
        'Загрузка чатов'
      ) as Promise<ChatConversation[]>;
    },
    enabled: !!user,
    retry: 2,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 10000),
  });
}

// Hook for fetching messages in a conversation
export function useConversationMessages(conversationId: string | null) {
  return useQuery({
    queryKey: ["conversation-messages", conversationId],
    queryFn: async () => {
      if (!conversationId) return [];
      return supabaseQuery(
        () => supabase
          .from("chat_messages")
          .select(`
            *,
            sender:profiles!chat_messages_sender_id_fkey(first_name, last_name)
          `)
          .eq("conversation_id", conversationId)
          .order("created_at", { ascending: true }),
        'Загрузка сообщений'
      ) as Promise<ChatMessage[]>;
    },
    enabled: !!conversationId,
    retry: 2,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 10000),
  });
}

// Hook for creating a conversation
export function useCreateConversation() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({
      title,
      type,
      participantIds,
    }: {
      title: string;
      type: "direct" | "group";
      participantIds: string[];
    }) => {
      if (!user) throw new Error("Not authenticated");

      // Get user's profile ID
      const { data: profile } = await supabase
        .from("profiles")
        .select("id")
        .eq("user_id", user.id)
        .single();

      if (!profile) throw new Error("Profile not found");

      // Create conversation
      const { data: conversation, error: convError } = await supabase
        .from("chat_conversations")
        .insert({
          title,
          type,
          created_by: profile.id,
        })
        .select()
        .single();

      if (convError) throw convError;

      // Add creator as participant
      const participants = [profile.id, ...participantIds].map((userId) => ({
        conversation_id: conversation.id,
        user_id: userId,
      }));

      const { error: partError } = await supabase
        .from("chat_participants")
        .insert(participants);

      if (partError) throw partError;

      return conversation;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["conversations"] });
    },
  });
}

// Hook for sending a message
export function useSendMessage() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({
      conversationId,
      content,
    }: {
      conversationId: string;
      content: string;
    }) => {
      if (!user) throw new Error("Not authenticated");

      // Get user's profile ID
      const { data: profile } = await supabase
        .from("profiles")
        .select("id")
        .eq("user_id", user.id)
        .single();

      if (!profile) throw new Error("Profile not found");

      const { data, error } = await supabase
        .from("chat_messages")
        .insert({
          conversation_id: conversationId,
          sender_id: profile.id,
          content,
        })
        .select()
        .single();

      if (error) throw error;

      // Update conversation's updated_at
      await supabase
        .from("chat_conversations")
        .update({ updated_at: new Date().toISOString() })
        .eq("id", conversationId);

      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["conversation-messages", variables.conversationId],
      });
      queryClient.invalidateQueries({ queryKey: ["conversations"] });
    },
  });
}

// Hook for fetching AI messages
export function useAIMessages() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["ai-messages", user?.id],
    queryFn: async () => {
      if (!user) return [];
      return supabaseQuery(
        () => supabase
          .from("ai_chat_messages")
          .select("*")
          .eq("user_id", user.id)
          .order("created_at", { ascending: true }),
        'Загрузка AI-сообщений'
      ) as Promise<AIMessage[]>;
    },
    enabled: !!user,
    retry: 2,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 10000),
  });
}

// Hook for saving AI message
export function useSaveAIMessage() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({
      role,
      content,
    }: {
      role: "user" | "assistant";
      content: string;
    }) => {
      if (!user) throw new Error("Not authenticated");

      const { data, error } = await supabase
        .from("ai_chat_messages")
        .insert({
          user_id: user.id,
          role,
          content,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ai-messages"] });
    },
  });
}

// Hook for clearing AI chat history
export function useClearAIHistory() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Not authenticated");

      const { error } = await supabase
        .from("ai_chat_messages")
        .delete()
        .eq("user_id", user.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ai-messages"] });
    },
  });
}
