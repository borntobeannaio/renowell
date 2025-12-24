import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { proxySelect, proxyInsert, proxyUpdate, proxyDelete } from "@/lib/dbProxy";
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
      const { data, error } = await proxySelect<ChatConversation>('chat_conversations', {
        order: [{ column: 'updated_at', ascending: false }],
      });
      if (error) throw new Error(error.message);
      return data || [];
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
      // For joins we need a different approach - use select with join syntax
      const { data, error } = await proxySelect<ChatMessage>('chat_messages', {
        select: '*, sender:profiles!chat_messages_sender_id_fkey(first_name, last_name)',
        filters: [{ column: 'conversation_id', operator: 'eq', value: conversationId }],
        order: [{ column: 'created_at', ascending: true }],
      });
      if (error) throw new Error(error.message);
      return data || [];
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
      const { data: profiles, error: profileError } = await proxySelect<{ id: string }>('profiles', {
        select: 'id',
        filters: [{ column: 'user_id', operator: 'eq', value: user.id }],
        limit: 1,
      });

      if (profileError) throw new Error(profileError.message);
      const profile = profiles?.[0];
      if (!profile) throw new Error("Profile not found");

      // Create conversation
      const { data: conversations, error: convError } = await proxyInsert<ChatConversation>('chat_conversations', {
        title,
        type,
        created_by: profile.id,
      }, '*');

      if (convError) throw new Error(convError.message);
      const conversation = conversations?.[0];
      if (!conversation) throw new Error("Failed to create conversation");

      // Add creator as participant
      const participants = [profile.id, ...participantIds].map((userId) => ({
        conversation_id: conversation.id,
        user_id: userId,
      }));

      const { error: partError } = await proxyInsert('chat_participants', participants);
      if (partError) throw new Error(partError.message);

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
      const { data: profiles, error: profileError } = await proxySelect<{ id: string }>('profiles', {
        select: 'id',
        filters: [{ column: 'user_id', operator: 'eq', value: user.id }],
        limit: 1,
      });

      if (profileError) throw new Error(profileError.message);
      const profile = profiles?.[0];
      if (!profile) throw new Error("Profile not found");

      const { data, error } = await proxyInsert<ChatMessage>('chat_messages', {
        conversation_id: conversationId,
        sender_id: profile.id,
        content,
      }, '*');

      if (error) throw new Error(error.message);

      // Update conversation's updated_at
      await proxyUpdate('chat_conversations', 
        { updated_at: new Date().toISOString() },
        [{ column: 'id', operator: 'eq', value: conversationId }]
      );

      return data?.[0];
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
      const { data, error } = await proxySelect<AIMessage>('ai_chat_messages', {
        filters: [{ column: 'user_id', operator: 'eq', value: user.id }],
        order: [{ column: 'created_at', ascending: true }],
      });
      if (error) throw new Error(error.message);
      return data || [];
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

      const { data, error } = await proxyInsert<AIMessage>('ai_chat_messages', {
        user_id: user.id,
        role,
        content,
      }, '*');

      if (error) throw new Error(error.message);
      return data?.[0];
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

      const { error } = await proxyDelete('ai_chat_messages', [
        { column: 'user_id', operator: 'eq', value: user.id },
      ]);

      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ai-messages"] });
    },
  });
}
