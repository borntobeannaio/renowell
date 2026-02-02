import { useState, useRef, useEffect, KeyboardEvent } from "react";
import { MessageCircle, X, Send, Users, Bot, ChevronLeft, Loader2, Maximize2, Minimize2, Plus, Trash2, Phone, Video } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useConversations, useConversationMessages, useCreateConversation, useSendMessage, useAIMessages, useSaveAIMessage, useClearAIHistory } from "@/hooks/useChat";
import { useCreateCall } from "@/hooks/useCalls";
import { Modal } from "@/components/ui/Modal";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { useChatContext } from "@/context/ChatContext";
import { useNotifications } from "@/hooks/useNotifications";

type ChatTab = "general" | "ai";

interface StreamingAIMessage {
  role: "user" | "assistant";
  content: string;
}

export function FloatingChat() {
  const { user } = useAuth();
  const { isOpen, selectedConversationId, openChat, closeChat, setSelectedConversation } = useChatContext();
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [activeTab, setActiveTab] = useState<ChatTab>("general");
  const [message, setMessage] = useState("");
  const [streamingMessages, setStreamingMessages] = useState<StreamingAIMessage[]>([]);
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [isNewChatModalOpen, setIsNewChatModalOpen] = useState(false);
  const [newChatType, setNewChatType] = useState<"direct" | "group">("direct");
  const [selectedParticipants, setSelectedParticipants] = useState<string[]>([]);
  const [groupTitle, setGroupTitle] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Unread chat notifications count
  const notificationsQuery = useNotifications();
  const unreadChatCount = (notificationsQuery.data ?? []).filter(
    n => !n.is_read && (n.type === "chat_message" || n.type === "chat_created")
  ).length;

  // Database hooks
  const { data: conversations = [] } = useConversations();
  const { data: conversationMessages = [] } = useConversationMessages(selectedConversationId);
  const { data: aiMessages = [] } = useAIMessages();
  const createConversation = useCreateConversation();
  const sendMessage = useSendMessage();
  const saveAIMessage = useSaveAIMessage();
  const clearAIHistory = useClearAIHistory();
  const createCall = useCreateCall();

  // Fetch profiles for participant selection
  const { data: profiles = [] } = useQuery({
    queryKey: ["profiles"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, first_name, last_name, avatar_url, user_id");
      if (error) throw error;
      return data;
    },
  });

  // Get current user's profile
  const currentProfile = profiles.find(p => p.user_id === user?.id);

  // При открытии с conversationId - переключаемся на вкладку чатов
  useEffect(() => {
    if (isOpen && selectedConversationId) {
      setActiveTab("general");
    }
  }, [isOpen, selectedConversationId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [conversationMessages, aiMessages, streamingMessages]);

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleTimeString("ru-RU", {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const handleSendMessage = () => {
    if (!message.trim()) return;

    if (activeTab === "ai") {
      handleSendAiMessage();
    } else if (selectedConversationId) {
      sendMessage.mutate({
        conversationId: selectedConversationId,
        content: message.trim(),
      });
      setMessage("");
    }
  };

  const handleSendAiMessage = async () => {
    if (!message.trim() || isAiLoading || !user) return;

    const userContent = message.trim();
    setMessage("");
    setIsAiLoading(true);

    // Save user message to DB
    await saveAIMessage.mutateAsync({ role: "user", content: userContent });

    // Add to streaming messages for immediate UI feedback
    const allMessages = [...aiMessages.map(m => ({ role: m.role, content: m.content })), { role: "user" as const, content: userContent }];
    setStreamingMessages([{ role: "assistant", content: "" }]);

    let assistantContent = "";

    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-chat`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({ messages: allMessages }),
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Ошибка запроса");
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error("No reader");

      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        let newlineIndex: number;
        while ((newlineIndex = buffer.indexOf("\n")) !== -1) {
          let line = buffer.slice(0, newlineIndex);
          buffer = buffer.slice(newlineIndex + 1);

          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (line.startsWith(":") || line.trim() === "") continue;
          if (!line.startsWith("data: ")) continue;

          const jsonStr = line.slice(6).trim();
          if (jsonStr === "[DONE]") break;

          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content;
            if (content) {
              assistantContent += content;
              setStreamingMessages([{ role: "assistant", content: assistantContent }]);
            }
          } catch {
            // Partial JSON, continue
          }
        }
      }

      // Save assistant response to DB
      if (assistantContent) {
        await saveAIMessage.mutateAsync({ role: "assistant", content: assistantContent });
      }
    } catch (error) {
      console.error("AI error:", error);
      const errorContent = "Извините, произошла ошибка. Попробуйте позже.";
      await saveAIMessage.mutateAsync({ role: "assistant", content: errorContent });
    } finally {
      setIsAiLoading(false);
      setStreamingMessages([]);
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleCreateChat = async () => {
    if (selectedParticipants.length === 0) return;

    const selectedProfile = profiles.find(p => p.id === selectedParticipants[0]);
    const title =
      newChatType === "group"
        ? groupTitle || "Групповой чат"
        : `${selectedProfile?.first_name || ""} ${selectedProfile?.last_name || ""}`.trim() || "Чат";

    const conversation = await createConversation.mutateAsync({
      title,
      type: newChatType,
      participantIds: selectedParticipants,
    });

    // Open the created/found conversation immediately
    setSelectedConversation(conversation.id);
    setActiveTab("general");

    setIsNewChatModalOpen(false);
    setSelectedParticipants([]);
    setGroupTitle("");
    setNewChatType("direct");
  };

  const toggleParticipant = (id: string) => {
    if (newChatType === "direct") {
      setSelectedParticipants([id]);
    } else {
      setSelectedParticipants((prev) =>
        prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]
      );
    }
  };

  const selectedConversation = conversations.find(c => c.id === selectedConversationId);

  // Get participants of selected conversation for calling
  const { data: conversationParticipants = [] } = useQuery({
    queryKey: ["conversation-participants", selectedConversationId],
    queryFn: async () => {
      if (!selectedConversationId) return [];
      const { data, error } = await supabase
        .from("chat_participants")
        .select("user_id")
        .eq("conversation_id", selectedConversationId);
      if (error) throw error;
      return data.map(p => p.user_id);
    },
    enabled: !!selectedConversationId,
  });

  // Fetch all participants with profiles for each conversation (for displaying correct title)
  const { data: allConversationParticipants = [] } = useQuery({
    queryKey: ["all-conversation-participants"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("chat_participants")
        .select("conversation_id, user_id, profiles:profiles!chat_participants_user_id_fkey(id, first_name, last_name)");
      if (error) throw error;
      return data;
    },
    enabled: conversations.length > 0,
  });

  // Helper to get the display title for a conversation
  const getConversationDisplayTitle = (conv: typeof conversations[0]) => {
    // For group chats, use the stored title
    if (conv.type === "group") {
      return conv.title;
    }
    
    // For direct chats, find the other participant (not the current user)
    const participants = allConversationParticipants.filter(p => p.conversation_id === conv.id);
    const otherParticipant = participants.find(p => p.user_id !== currentProfile?.id);
    
    if (otherParticipant?.profiles) {
      const profile = otherParticipant.profiles as { first_name: string | null; last_name: string | null };
      const name = `${profile.first_name || ""} ${profile.last_name || ""}`.trim();
      if (name) return name;
    }
    
    // Fallback to stored title
    return conv.title;
  };

  const handleStartCall = async (callType: "video" | "audio") => {
    if (!currentProfile || !selectedConversationId) return;
    
    // Get other participants (not the current user)
    const otherParticipants = conversationParticipants.filter(
      id => id !== currentProfile.id
    );
    
    if (otherParticipants.length === 0) return;

    await createCall.mutateAsync({
      conversationId: selectedConversationId,
      callerId: currentProfile.id,
      participantIds: otherParticipants,
      callType,
    });
  };
  const renderChatList = () => (
    <div className="flex-1 overflow-y-auto p-3 space-y-2">
      {/* New chat button */}
      <button
        onClick={() => setIsNewChatModalOpen(true)}
        className="w-full p-3 rounded-lg text-left transition-colors bg-primary/10 hover:bg-primary/20 border border-dashed border-primary/30 text-sm"
      >
        <div className="flex items-center gap-2 text-primary">
          <Plus className="w-4 h-4" />
          <span className="font-medium">Начать новый чат</span>
        </div>
      </button>

      {conversations.map((conv) => (
        <button
          key={conv.id}
          onClick={() => {
            setSelectedConversation(conv.id);
            setActiveTab("general");
          }}
          className="w-full p-2 rounded-lg text-left transition-colors bg-secondary/50 hover:bg-secondary text-sm"
        >
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
              <Users className="w-4 h-4 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-medium text-foreground truncate">{getConversationDisplayTitle(conv)}</p>
              <p className="text-xs text-muted-foreground">
                {formatTime(conv.updated_at)}
              </p>
            </div>
          </div>
        </button>
      ))}

      {conversations.length === 0 && (
        <div className="text-center py-8 text-muted-foreground text-sm">
          <Users className="w-8 h-8 mx-auto mb-2 opacity-50" />
          <p>Нет чатов</p>
        </div>
      )}
    </div>
  );

  const renderMessages = () => {
    if (activeTab === "ai") {
      const displayMessages = isAiLoading && streamingMessages.length > 0
        ? [...aiMessages.map(m => ({ role: m.role, content: m.content, id: m.id })), ...streamingMessages.map((m, i) => ({ ...m, id: `streaming-${i}` }))]
        : aiMessages;

      return (
        <div className="flex-1 overflow-y-auto p-3 space-y-3">
          {displayMessages.length === 0 && !isAiLoading && (
            <div className="text-center text-muted-foreground text-sm py-8">
              <Bot className="w-10 h-10 mx-auto mb-2 opacity-50" />
              <p>Привет! Я AI-ассистент.</p>
              <p>Задайте мне любой вопрос.</p>
            </div>
          )}
          {displayMessages.map((msg, idx) => (
            <div
              key={msg.id || idx}
              className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[85%] rounded-xl px-3 py-2 text-sm ${
                  msg.role === "user"
                    ? "bg-primary text-primary-foreground"
                    : "bg-secondary text-secondary-foreground"
                }`}
              >
                <p className="whitespace-pre-wrap break-words">{msg.content}</p>
              </div>
            </div>
          ))}
          {isAiLoading && streamingMessages.length === 0 && (
            <div className="flex justify-start">
              <div className="bg-secondary rounded-xl px-3 py-2">
                <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
      );
    }

    if (!selectedConversationId) {
      return renderChatList();
    }

    return (
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {conversationMessages.map((msg) => {
          const isOwn = msg.sender_id === currentProfile?.id;

          return (
            <div
              key={msg.id}
              className={`flex ${isOwn ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[85%] rounded-xl px-3 py-2 text-sm ${
                  isOwn
                    ? "bg-primary text-primary-foreground"
                    : "bg-secondary text-secondary-foreground"
                }`}
              >
                {!isOwn && msg.sender && (
                  <p className="text-xs font-medium mb-1 opacity-70">
                    {msg.sender.first_name} {msg.sender.last_name}
                  </p>
                )}
                <p className="whitespace-pre-wrap break-words">{msg.content}</p>
                <p className={`text-xs mt-1 ${isOwn ? "text-primary-foreground/70" : "text-muted-foreground"}`}>
                  {formatTime(msg.created_at)}
                </p>
              </div>
            </div>
          );
        })}
        {conversationMessages.length === 0 && (
          <div className="text-center py-8 text-muted-foreground text-sm">
            <MessageCircle className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p>Начните диалог</p>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>
    );
  };

  const panelClasses = isFullscreen
    ? "fixed inset-4 md:inset-8 z-50"
    : "fixed bottom-20 md:bottom-6 right-4 md:right-6 z-50 w-[340px] h-[480px]";

  return (
    <>
      {/* Floating button */}
      <button
        onClick={() => openChat()}
        className={`fixed bottom-20 md:bottom-6 right-4 md:right-6 z-50 w-14 h-14 rounded-full bg-primary text-primary-foreground shadow-lg hover:scale-105 transition-transform flex items-center justify-center ${
          isOpen ? "hidden" : ""
        }`}
      >
        <MessageCircle className="w-6 h-6" />
        {unreadChatCount > 0 && (
          <span className="absolute -top-1 -right-1 min-w-5 h-5 px-1 rounded-full bg-destructive text-destructive-foreground text-xs font-bold flex items-center justify-center">
            {unreadChatCount > 99 ? "99+" : unreadChatCount}
          </span>
        )}
      </button>

      {/* Chat panel */}
      {isOpen && (
        <div className={`${panelClasses} bg-card border border-border rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-bottom-4`}>
          {/* Header with tabs */}
          <div className="bg-card border-b border-border">
            <div className="flex items-center justify-between p-3">
              {selectedConversationId && activeTab === "general" ? (
                <button
                  onClick={() => setSelectedConversation(null)}
                  className="flex items-center gap-2 text-sm font-medium text-foreground hover:text-primary transition-colors"
                >
                  <ChevronLeft className="w-4 h-4" />
                  {selectedConversation ? getConversationDisplayTitle(selectedConversation) : ""}
                </button>
              ) : (
                <span className="text-sm font-semibold text-foreground">
                  {activeTab === "ai" ? "AI Ассистент" : "Чаты"}
                </span>
              )}
              <div className="flex items-center gap-1">
                {/* Call buttons - only show when in a conversation */}
                {selectedConversationId && activeTab === "general" && (
                  <>
                    <button
                      onClick={() => handleStartCall("audio")}
                      disabled={createCall.isPending}
                      className="p-1.5 rounded-lg hover:bg-secondary transition-colors text-muted-foreground hover:text-green-500"
                      title="Голосовой звонок"
                    >
                      <Phone className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleStartCall("video")}
                      disabled={createCall.isPending}
                      className="p-1.5 rounded-lg hover:bg-secondary transition-colors text-muted-foreground hover:text-green-500"
                      title="Видеозвонок"
                    >
                      <Video className="w-4 h-4" />
                    </button>
                  </>
                )}
                {activeTab === "ai" && aiMessages.length > 0 && (
                  <button
                    onClick={() => clearAIHistory.mutate()}
                    className="p-1.5 rounded-lg hover:bg-secondary transition-colors text-muted-foreground hover:text-destructive"
                    title="Очистить историю"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
                <button
                  onClick={() => setIsFullscreen(!isFullscreen)}
                  className="p-1.5 rounded-lg hover:bg-secondary transition-colors"
                  title={isFullscreen ? "Свернуть" : "На весь экран"}
                >
                  {isFullscreen ? (
                    <Minimize2 className="w-4 h-4" />
                  ) : (
                    <Maximize2 className="w-4 h-4" />
                  )}
                </button>
                <button
                  onClick={() => {
                    closeChat();
                    setIsFullscreen(false);
                  }}
                  className="p-1.5 rounded-lg hover:bg-secondary transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Pinned tabs */}
            <div className="flex gap-1 px-3 pb-2">
              <button
                onClick={() => {
                  setActiveTab("general");
                  setSelectedConversation(null);
                }}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                  activeTab === "general"
                    ? "bg-primary text-primary-foreground"
                    : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
                }`}
              >
                <Users className="w-3 h-3" />
                Чаты
              </button>
              <button
                onClick={() => setActiveTab("ai")}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                  activeTab === "ai"
                    ? "bg-primary text-primary-foreground"
                    : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
                }`}
              >
                <Bot className="w-3 h-3" />
                AI чат
              </button>
            </div>
          </div>

          {/* Messages */}
          {renderMessages()}

          {/* Input */}
          {(activeTab === "ai" || selectedConversationId) && (
            <div className="p-3 border-t border-border">
              <div className="flex gap-2">
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Напишите сообщение..."
                  className="flex-1 bg-secondary text-foreground rounded-xl px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/50"
                  rows={1}
                  disabled={isAiLoading}
                />
                <button
                  onClick={handleSendMessage}
                  disabled={!message.trim() || isAiLoading}
                  className="px-3 py-2 bg-primary text-primary-foreground rounded-xl hover:opacity-90 transition-opacity disabled:opacity-50"
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* New chat modal */}
      <Modal
        isOpen={isNewChatModalOpen}
        onClose={() => {
          setIsNewChatModalOpen(false);
          setSelectedParticipants([]);
          setGroupTitle("");
        }}
        title="Новый чат"
      >
        <div className="space-y-4">
          <div className="flex gap-2">
            <button
              onClick={() => {
                setNewChatType("direct");
                setSelectedParticipants([]);
              }}
              className={`flex-1 py-2 rounded-lg font-medium transition-colors ${
                newChatType === "direct"
                  ? "bg-primary text-primary-foreground"
                  : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
              }`}
            >
              Личный
            </button>
            <button
              onClick={() => {
                setNewChatType("group");
                setSelectedParticipants([]);
              }}
              className={`flex-1 py-2 rounded-lg font-medium transition-colors ${
                newChatType === "group"
                  ? "bg-primary text-primary-foreground"
                  : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
              }`}
            >
              Групповой
            </button>
          </div>

          {newChatType === "group" && (
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">
                Название группы
              </label>
              <input
                type="text"
                value={groupTitle}
                onChange={(e) => setGroupTitle(e.target.value)}
                className="input-base w-full"
                placeholder="Введите название"
              />
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              {newChatType === "direct"
                ? "Выберите собеседника"
                : "Выберите участников"}
            </label>
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {profiles
                .filter((p) => p.id !== currentProfile?.id)
                .map((profile) => (
                  <label
                    key={profile.id}
                    className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-colors ${
                      selectedParticipants.includes(profile.id)
                        ? "bg-primary/10 border border-primary/30"
                        : "bg-secondary hover:bg-secondary/80"
                    }`}
                  >
                    <input
                      type={newChatType === "direct" ? "radio" : "checkbox"}
                      checked={selectedParticipants.includes(profile.id)}
                      onChange={() => toggleParticipant(profile.id)}
                      className="w-4 h-4 text-primary"
                    />
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary text-sm font-medium">
                      {profile.first_name?.[0] || profile.last_name?.[0] || "?"}
                    </div>
                    <div className="flex-1">
                      <p className="font-medium text-foreground">
                        {profile.first_name} {profile.last_name}
                      </p>
                    </div>
                  </label>
                ))}
              {profiles.filter((p) => p.id !== currentProfile?.id).length === 0 && (
                <p className="text-center text-muted-foreground py-4">
                  Нет доступных пользователей
                </p>
              )}
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <button
              onClick={() => setIsNewChatModalOpen(false)}
              className="btn-secondary"
            >
              Отмена
            </button>
            <button
              onClick={handleCreateChat}
              disabled={selectedParticipants.length === 0 || createConversation.isPending}
              className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {createConversation.isPending ? "Создание..." : "Создать"}
            </button>
          </div>
        </div>
      </Modal>
    </>
  );
}
