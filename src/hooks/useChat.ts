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

export interface ChatAttachmentData {
  url: string;
  fileName: string;
  contentType: string;
  size: number;
}

export interface ChatMessage {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string;
  attachments?: ChatAttachmentData[] | null;
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

      // 1. Get current user's profile ID
      const { data: profiles } = await proxySelect<{ id: string }>('profiles', {
        select: 'id',
        filters: [{ column: 'user_id', operator: 'eq', value: user.id }],
        limit: 1,
      });
      const profileId = profiles?.[0]?.id;
      if (!profileId) return [];

      // 2. Get conversation IDs where user is a participant
      const { data: participations } = await proxySelect<{ conversation_id: string }>('chat_participants', {
        select: 'conversation_id',
        filters: [{ column: 'user_id', operator: 'eq', value: profileId }],
      });
      if (!participations?.length) return [];

      const convIds = participations.map(p => p.conversation_id);

      // 3. Fetch only those conversations
      const { data, error } = await proxySelect<ChatConversation>('chat_conversations', {
        filters: [{ column: 'id', operator: 'in', value: convIds }],
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

// Hook for finding existing direct conversation between two users
export function useFindDirectConversation() {
  return async (profileId: string, otherProfileId: string): Promise<string | null> => {
    console.log('[findDirectConversation] Searching for existing chat between', profileId, 'and', otherProfileId);
    
    try {
      // Step 1: Get all conversations where current user is a participant
      const { data: myConversations, error: myError } = await proxySelect<{ conversation_id: string }>('chat_participants', {
        select: 'conversation_id',
        filters: [{ column: 'user_id', operator: 'eq', value: profileId }],
        limit: 1000,
      });

      if (myError) {
        console.error('[findDirectConversation] Error fetching my conversations:', myError);
        return null;
      }
      
      if (!myConversations?.length) {
        console.log('[findDirectConversation] User has no conversations');
        return null;
      }

      const conversationIds = myConversations.map(c => c.conversation_id);
      console.log('[findDirectConversation] Found', conversationIds.length, 'conversations for current user');

      // Step 2: Filter only direct conversations
      const { data: directConversations, error: convError } = await proxySelect<{ id: string }>('chat_conversations', {
        select: 'id',
        filters: [
          { column: 'id', operator: 'in', value: conversationIds },
          { column: 'type', operator: 'eq', value: 'direct' },
        ],
        limit: 1000,
      });

      if (convError) {
        console.error('[findDirectConversation] Error fetching direct conversations:', convError);
        return null;
      }
      
      if (!directConversations?.length) {
        console.log('[findDirectConversation] No direct conversations found');
        return null;
      }

      const directConvIds = directConversations.map(c => c.id);
      console.log('[findDirectConversation] Found', directConvIds.length, 'direct conversations');

      // Step 3: Check if the other user is also a participant
      const { data: otherParticipations, error: otherError } = await proxySelect<{ conversation_id: string }>('chat_participants', {
        select: 'conversation_id',
        filters: [
          { column: 'user_id', operator: 'eq', value: otherProfileId },
          { column: 'conversation_id', operator: 'in', value: directConvIds },
        ],
        limit: 1000,
      });

      if (otherError) {
        console.error('[findDirectConversation] Error checking other user participation:', otherError);
        return null;
      }
      
      if (!otherParticipations?.length) {
        console.log('[findDirectConversation] Other user is not in any direct conversation with current user');
        return null;
      }

      console.log('[findDirectConversation] Found existing conversation:', otherParticipations[0].conversation_id);
      return otherParticipations[0].conversation_id;
    } catch (error) {
      console.error('[findDirectConversation] Unexpected error:', error);
      return null;
    }
  };
}

// Hook for creating a conversation
export function useCreateConversation() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const findDirectConversation = useFindDirectConversation();

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

      // For direct chats, check if conversation already exists
      if (type === "direct" && participantIds.length === 1) {
        const otherProfileId = participantIds[0];
        
        // First attempt - use the findDirectConversation function
        let existingConvId = await findDirectConversation(profile.id, otherProfileId);
        
        // If not found, do a direct database check as backup
        if (!existingConvId) {
          console.log('[createConversation] First search found nothing, doing backup check...');
          
          // Direct query: find conversation where both users are participants
          const { data: myParticipations } = await proxySelect<{ conversation_id: string }>('chat_participants', {
            select: 'conversation_id',
            filters: [{ column: 'user_id', operator: 'eq', value: profile.id }],
            limit: 1000,
          });
          
          if (myParticipations?.length) {
            const myConvIds = myParticipations.map(p => p.conversation_id);
            
            const { data: sharedParticipations } = await proxySelect<{ conversation_id: string }>('chat_participants', {
              select: 'conversation_id',
              filters: [
                { column: 'user_id', operator: 'eq', value: otherProfileId },
                { column: 'conversation_id', operator: 'in', value: myConvIds },
              ],
              limit: 1000,
            });
            
            if (sharedParticipations?.length) {
              // Check if any of these are direct chats
              const { data: directChats } = await proxySelect<{ id: string }>('chat_conversations', {
                select: 'id',
                filters: [
                  { column: 'id', operator: 'in', value: sharedParticipations.map(p => p.conversation_id) },
                  { column: 'type', operator: 'eq', value: 'direct' },
                ],
                limit: 1,
              });
              
              if (directChats?.[0]) {
                existingConvId = directChats[0].id;
                console.log('[createConversation] Backup check found existing conversation:', existingConvId);
              }
            }
          }
        }
        
        if (existingConvId) {
          // Return existing conversation info
          const { data: existingConv } = await proxySelect<ChatConversation>('chat_conversations', {
            filters: [{ column: 'id', operator: 'eq', value: existingConvId }],
            limit: 1,
          });
          if (existingConv?.[0]) {
            console.log('[createConversation] Returning existing conversation:', existingConv[0].id);
            return existingConv[0];
          }
        }
        
        console.log('[createConversation] No existing conversation found, will create new one');
      }

      // Create new conversation
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

      // Отправить уведомления участникам о добавлении в чат (кроме создателя)
      if (participantIds.length > 0) {
        const chatNotifications = participantIds.map(participantId => ({
          recipient_id: participantId,
          type: 'chat_created',
          title: 'Вас добавили в чат',
          body: title,
          link: `#chat:${conversation.id}`,
        }));
        
        await proxyInsert('notifications', chatNotifications);
      }

      return conversation;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["conversations"] });
    },
  });
}

// Hook for sending a message with notifications
export function useSendMessage() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({
      conversationId,
      content,
      attachments,
    }: {
      conversationId: string;
      content: string;
      attachments?: ChatAttachmentData[];
    }) => {
      if (!user) throw new Error("Not authenticated");

      // Get user's profile ID and name
      const { data: profiles, error: profileError } = await proxySelect<{ id: string; first_name: string | null; last_name: string | null }>('profiles', {
        select: 'id, first_name, last_name',
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
        attachments: attachments && attachments.length > 0 ? attachments : null,
      }, '*');

      if (error) throw new Error(error.message);

      // Update conversation's updated_at
      await proxyUpdate('chat_conversations', 
        { updated_at: new Date().toISOString() },
        [{ column: 'id', operator: 'eq', value: conversationId }]
      );

      // Get all participants except sender
      const { data: participants } = await proxySelect<{ user_id: string }>('chat_participants', {
        select: 'user_id',
        filters: [{ column: 'conversation_id', operator: 'eq', value: conversationId }],
      });

      const senderName = [profile.first_name, profile.last_name].filter(Boolean).join(' ') || 'Пользователь';
      const preview = content.length > 100 ? content.substring(0, 100) + '...' : content;

      // Create notifications for other participants
      if (participants) {
        const otherParticipants = participants.filter(p => p.user_id !== profile.id);
        
        for (const participant of otherParticipants) {
          await proxyInsert('notifications', {
            recipient_id: participant.user_id,
            type: 'chat_message',
            title: `Сообщение от ${senderName}`,
            body: preview,
            link: `#chat:${conversationId}`,
            attachments: attachments && attachments.length > 0 ? attachments : null,
          });
        }
      }

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
