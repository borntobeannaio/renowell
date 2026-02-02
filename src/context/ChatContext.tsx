import { createContext, useContext, useState, ReactNode, useCallback } from "react";

interface ChatContextType {
  isOpen: boolean;
  selectedConversationId: string | null;
  openChat: (conversationId?: string) => void;
  closeChat: () => void;
  setSelectedConversation: (id: string | null) => void;
}

const ChatContext = createContext<ChatContextType | undefined>(undefined);

export function ChatProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);

  const openChat = useCallback((conversationId?: string) => {
    if (conversationId) {
      setSelectedConversationId(conversationId);
    }
    setIsOpen(true);
  }, []);

  const closeChat = useCallback(() => {
    setIsOpen(false);
  }, []);

  const setSelectedConversation = useCallback((id: string | null) => {
    setSelectedConversationId(id);
  }, []);

  return (
    <ChatContext.Provider
      value={{
        isOpen,
        selectedConversationId,
        openChat,
        closeChat,
        setSelectedConversation,
      }}
    >
      {children}
    </ChatContext.Provider>
  );
}

export function useChatContext() {
  const context = useContext(ChatContext);
  if (!context) {
    throw new Error("useChatContext must be used within ChatProvider");
  }
  return context;
}
