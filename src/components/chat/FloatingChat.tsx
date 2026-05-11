import { useState, useRef, useEffect, KeyboardEvent, ChangeEvent } from "react";
import { MessageCircle, X, Send, Users, Bot, ChevronLeft, Loader2, Maximize2, Minimize2, Plus, Trash2, Phone, Video, Paperclip, Headphones } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useConversations, useConversationMessages, useCreateConversation, useSendMessage, useAIMessages, useSaveAIMessage, useClearAIHistory } from "@/hooks/useChat";
import { useCreateCall } from "@/hooks/useCalls";
import { Modal } from "@/components/ui/Modal";
import { useQuery } from "@tanstack/react-query";
import { proxySelect } from "@/lib/dbProxy";
import { useChatContext } from "@/context/ChatContext";
import { useUnreadCounts, useMarkConversationRead, useChatNotificationSound, useTotalUnreadCount } from "@/hooks/useChatUnread";
import { useChatAttachments, ChatAttachment } from "@/hooks/useChatAttachments";
import { ChatAttachmentPreview, ChatMessageAttachments } from "@/components/chat/ChatAttachmentPreview";
import { useMessageReactions, useToggleReaction, groupReactions } from "@/hooks/useChatReactions";
import { MessageReactions } from "@/components/chat/MessageReactions";
import { ReactionPicker } from "@/components/chat/ReactionPicker";
import { useSupportMessages, useSendSupportMessage } from "@/hooks/useSupportChat";
import { useIsSupportAdmin, useSupportThreads, useSupportUserMessages, useSendSupportReply } from "@/hooks/useSupportAdmin";
type ChatTab = "general" | "ai" | "support";

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
  const [pendingAttachments, setPendingAttachments] = useState<ChatAttachment[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dropZoneRef = useRef<HTMLDivElement>(null);

  // Attachment upload hook
  const { uploadFiles, isUploading, uploadProgress } = useChatAttachments();

  // Database hooks
  const { data: conversations = [] } = useConversations();
  const { data: conversationMessages = [] } = useConversationMessages(selectedConversationId);
  const { data: aiMessages = [] } = useAIMessages();
  const createConversation = useCreateConversation();
  const sendMessage = useSendMessage();
  const saveAIMessage = useSaveAIMessage();

  // Reactions
  const { data: reactions = [] } = useMessageReactions(selectedConversationId);
  const toggleReaction = useToggleReaction(selectedConversationId);
  const clearAIHistory = useClearAIHistory();
  const createCall = useCreateCall();

  // Support chat hooks
  const { data: supportMessages = [] } = useSupportMessages();
  const sendSupportMessage = useSendSupportMessage();
  
  // Support admin hooks
  const isSupportAdmin = useIsSupportAdmin();
  const { data: supportThreads = [] } = useSupportThreads();
  const [selectedSupportUserId, setSelectedSupportUserId] = useState<string | null>(null);
  const { data: adminSupportMessages = [] } = useSupportUserMessages(isSupportAdmin ? selectedSupportUserId : null);
  const sendSupportReply = useSendSupportReply();
  
  // Unread counts per conversation
  const conversationIds = conversations.map(c => c.id);
  const { data: unreadCounts = [] } = useUnreadCounts(conversationIds);
  const totalUnreadCount = useTotalUnreadCount(conversationIds);
  const markRead = useMarkConversationRead();
  
  // Sound notification for new messages
  useChatNotificationSound(selectedConversationId, isOpen);

  // Fetch profiles for participant selection
  const { data: profiles = [] } = useQuery({
    queryKey: ["profiles"],
    queryFn: async () => {
      const { data, error } = await proxySelect<{ id: string; first_name: string | null; last_name: string | null; avatar_url: string | null; user_id: string }>("profiles", {
        select: "id, first_name, last_name, avatar_url, user_id",
      });
      if (error) throw new Error(error.message);
      return data ?? [];
    },
  });

  // Get current user's profile
  const currentProfile = profiles.find(p => p.user_id === user?.id);

  // При открытии с conversationId - переключаемся на вкладку чатов и отмечаем как прочитанное
  useEffect(() => {
    if (isOpen && selectedConversationId) {
      setActiveTab("general");
      // Mark conversation as read when opening it
      markRead.mutate(selectedConversationId);
    }
  }, [isOpen, selectedConversationId]);

  const scrollToBottom = (behavior: ScrollBehavior = "smooth") => {
    requestAnimationFrame(() => {
      messagesEndRef.current?.scrollIntoView({ behavior, block: "end" });
    });
  };

  useEffect(() => {
    scrollToBottom("smooth");
  }, [conversationMessages, aiMessages, streamingMessages, supportMessages, adminSupportMessages]);

  // Keep last messages visible when the on-screen keyboard opens/closes or viewport resizes
  useEffect(() => {
    if (!isOpen) return;

    const handleResize = () => scrollToBottom("auto");
    const handleFocusIn = (e: FocusEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === "TEXTAREA" || target.tagName === "INPUT")) {
        // Delay so the keyboard has time to appear and resize the viewport
        setTimeout(() => scrollToBottom("auto"), 250);
        setTimeout(() => scrollToBottom("auto"), 500);
      }
    };

    window.visualViewport?.addEventListener("resize", handleResize);
    window.addEventListener("resize", handleResize);
    document.addEventListener("focusin", handleFocusIn);

    // Capacitor Keyboard events (native mobile)
    let keyboardShowListener: { remove: () => void } | undefined;
    let keyboardHideListener: { remove: () => void } | undefined;
    import("@capacitor/keyboard")
      .then(({ Keyboard }) => {
        keyboardShowListener = Keyboard.addListener("keyboardDidShow", () => scrollToBottom("auto")) as any;
        keyboardHideListener = Keyboard.addListener("keyboardDidHide", () => scrollToBottom("auto")) as any;
      })
      .catch(() => {});

    return () => {
      window.visualViewport?.removeEventListener("resize", handleResize);
      window.removeEventListener("resize", handleResize);
      document.removeEventListener("focusin", handleFocusIn);
      keyboardShowListener?.remove();
      keyboardHideListener?.remove();
    };
  }, [isOpen]);

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleTimeString("ru-RU", {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const handleSendMessage = () => {
    if (!message.trim() && pendingAttachments.length === 0) return;

    if (activeTab === "ai") {
      handleSendAiMessage();
    } else if (activeTab === "support") {
      if (message.trim()) {
        if (isSupportAdmin && selectedSupportUserId) {
          sendSupportReply.mutate({ userProfileId: selectedSupportUserId, content: message.trim() });
        } else if (!isSupportAdmin) {
          sendSupportMessage.mutate(message.trim());
        }
        setMessage("");
      }
    } else if (selectedConversationId) {
      sendMessage.mutate({
        conversationId: selectedConversationId,
        content: message.trim(),
        attachments: pendingAttachments.length > 0 ? pendingAttachments : undefined,
      });
      setMessage("");
      setPendingAttachments([]);
    }
  };

  const handleFileSelect = async (e: ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const uploaded = await uploadFiles(Array.from(files));
    setPendingAttachments((prev) => [...prev, ...uploaded]);
    
    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleRemoveAttachment = (index: number) => {
    setPendingAttachments((prev) => prev.filter((_, i) => i !== index));
  };

  // Drag and drop handlers
  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    // Only enable drag for general chat with active conversation
    if (activeTab === "general" && selectedConversationId) {
      setIsDragging(true);
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    // Check if we're leaving the drop zone entirely
    if (dropZoneRef.current && !dropZoneRef.current.contains(e.relatedTarget as Node)) {
      setIsDragging(false);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    if (activeTab !== "general" || !selectedConversationId) return;

    const files = Array.from(e.dataTransfer.files);
    if (files.length === 0) return;

    const uploaded = await uploadFiles(files);
    setPendingAttachments((prev) => [...prev, ...uploaded]);
  };

  // Paste handler for clipboard images
  const handlePaste = async (e: React.ClipboardEvent) => {
    // Only handle paste in general chat with active conversation
    if (activeTab !== "general" || !selectedConversationId) return;

    const clipboardItems = e.clipboardData.items;
    const files: File[] = [];

    for (let i = 0; i < clipboardItems.length; i++) {
      const item = clipboardItems[i];
      
      // Check if it's an image
      if (item.type.startsWith("image/")) {
        const file = item.getAsFile();
        if (file) {
          // Create a more meaningful filename for pasted images
          const extension = item.type.split("/")[1] || "png";
          const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
          const renamedFile = new File([file], `pasted-image-${timestamp}.${extension}`, {
            type: file.type,
          });
          files.push(renamedFile);
        }
      }
    }

    if (files.length > 0) {
      e.preventDefault(); // Prevent default paste behavior for images
      const uploaded = await uploadFiles(files);
      setPendingAttachments((prev) => [...prev, ...uploaded]);
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
      const { data, error } = await proxySelect<{ user_id: string }>("chat_participants", {
        select: "user_id",
        filters: [{ column: "conversation_id", operator: "eq", value: selectedConversationId }],
      });
      if (error) throw new Error(error.message);
      return (data ?? []).map(p => p.user_id);
    },
    enabled: !!selectedConversationId,
  });

  // Fetch all participants with profiles for each conversation (for displaying correct title)
  const { data: allConversationParticipants = [] } = useQuery({
    queryKey: ["all-conversation-participants"],
    queryFn: async () => {
      // db-proxy doesn't support joins, so fetch participants and profiles separately
      const { data: participants, error: pErr } = await proxySelect<{ conversation_id: string; user_id: string }>("chat_participants", {
        select: "conversation_id, user_id",
      });
      if (pErr) throw new Error(pErr.message);

      const uniqueUserIds = [...new Set((participants ?? []).map(p => p.user_id))];
      if (uniqueUserIds.length === 0) return [];

      const { data: profilesData, error: prErr } = await proxySelect<{ id: string; first_name: string | null; last_name: string | null }>("profiles", {
        select: "id, first_name, last_name",
        filters: [{ column: "id", operator: "in", value: uniqueUserIds }],
      });
      if (prErr) throw new Error(prErr.message);

      const profileMap = new Map((profilesData ?? []).map(p => [p.id, p]));
      return (participants ?? []).map(p => ({
        conversation_id: p.conversation_id,
        user_id: p.user_id,
        profiles: profileMap.get(p.user_id) || null,
      }));
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

      {conversations.map((conv) => {
        const unreadCount = unreadCounts.find(u => u.conversationId === conv.id)?.count || 0;
        
        return (
          <button
            key={conv.id}
            onClick={() => {
              setSelectedConversation(conv.id);
              setActiveTab("general");
            }}
            className={`w-full p-2 rounded-lg text-left transition-colors text-sm ${
              unreadCount > 0 
                ? "bg-primary/10 hover:bg-primary/15 border border-primary/20" 
                : "bg-secondary/50 hover:bg-secondary"
            }`}
          >
            <div className="flex items-center gap-2">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center relative ${
                unreadCount > 0 ? "bg-primary/20" : "bg-primary/10"
              }`}>
                <Users className="w-4 h-4 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className={`truncate ${unreadCount > 0 ? "font-semibold text-foreground" : "font-medium text-foreground"}`}>
                  {getConversationDisplayTitle(conv)}
                </p>
                <p className="text-xs text-muted-foreground">
                  {formatTime(conv.updated_at)}
                </p>
              </div>
              {unreadCount > 0 && (
                <span className="min-w-5 h-5 px-1.5 rounded-full bg-primary text-primary-foreground text-xs font-bold flex items-center justify-center">
                  {unreadCount > 99 ? "99+" : unreadCount}
                </span>
              )}
            </div>
          </button>
        );
      })}

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

    if (activeTab === "support") {
      // Admin view: show user folders or selected user's chat
      if (isSupportAdmin) {
        if (!selectedSupportUserId) {
          // Show list of support threads
          return (
            <div className="flex-1 overflow-y-auto p-3 space-y-2">
              {supportThreads.length === 0 && (
                <div className="text-center text-muted-foreground text-sm py-8">
                  <Headphones className="w-10 h-10 mx-auto mb-2 opacity-50" />
                  <p>Нет обращений</p>
                </div>
              )}
              {supportThreads.map((thread) => (
                <button
                  key={thread.userProfileId}
                  onClick={() => setSelectedSupportUserId(thread.userProfileId)}
                  className="w-full p-3 rounded-lg text-left transition-colors bg-secondary/50 hover:bg-secondary"
                >
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                      <Headphones className="w-4 h-4 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-foreground text-sm truncate">{thread.userName}</p>
                      <p className="text-xs text-muted-foreground truncate">{thread.lastMessage}</p>
                    </div>
                    <span className="text-xs text-muted-foreground whitespace-nowrap">
                      {formatTime(thread.lastMessageAt)}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          );
        }

        // Show selected user's support chat (admin)
        const currentThread = supportThreads.find(t => t.userProfileId === selectedSupportUserId);
        return (
          <div className="flex-1 overflow-y-auto p-3 space-y-3">
            {adminSupportMessages.map((msg) => (
              <div
                key={msg.id}
                className={`flex ${msg.direction === "incoming" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[85%] rounded-xl px-3 py-2 text-sm ${
                    msg.direction === "incoming"
                      ? "bg-primary text-primary-foreground"
                      : "bg-secondary text-secondary-foreground"
                  }`}
                >
                  {msg.direction === "outgoing" && (
                    <p className="text-xs font-medium mb-1 opacity-70">{currentThread?.userName || "Пользователь"}</p>
                  )}
                  <p className="whitespace-pre-wrap break-words">{msg.content}</p>
                  <p className={`text-xs mt-1 ${msg.direction === "incoming" ? "text-primary-foreground/70" : "text-muted-foreground"}`}>
                    {formatTime(msg.created_at)}
                  </p>
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>
        );
      }

      // Regular user support view
      return (
        <div className="flex-1 overflow-y-auto p-3 space-y-3">
          {supportMessages.length === 0 && (
            <div className="text-center text-muted-foreground text-sm py-8">
              <Headphones className="w-10 h-10 mx-auto mb-2 opacity-50" />
              <p>Техподдержка</p>
              <p>Напишите ваш вопрос — мы ответим.</p>
            </div>
          )}
          {supportMessages.map((msg) => (
            <div
              key={msg.id}
              className={`flex ${msg.direction === "outgoing" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[85%] rounded-xl px-3 py-2 text-sm ${
                  msg.direction === "outgoing"
                    ? "bg-primary text-primary-foreground"
                    : "bg-secondary text-secondary-foreground"
                }`}
              >
                {msg.direction === "incoming" && (
                  <p className="text-xs font-medium mb-1 opacity-70">Поддержка</p>
                )}
                <p className="whitespace-pre-wrap break-words">{msg.content}</p>
                <p className={`text-xs mt-1 ${msg.direction === "outgoing" ? "text-primary-foreground/70" : "text-muted-foreground"}`}>
                  {formatTime(msg.created_at)}
                </p>
              </div>
            </div>
          ))}
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
              className={`flex ${isOwn ? "justify-end" : "justify-start"} group`}
            >
              <div className="flex flex-col max-w-[85%]">
                <div className="flex items-start gap-1">
                  {isOwn && (
                    <div className="md:opacity-0 md:group-hover:opacity-100 transition-opacity self-center">
                      <ReactionPicker onSelect={(emoji) => toggleReaction.mutate({ messageId: msg.id, emoji })} />
                    </div>
                  )}
                  <div
                    className={`rounded-xl px-3 py-2 text-sm ${
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
                    {msg.content && (
                      <p className="whitespace-pre-wrap break-words">{msg.content}</p>
                    )}
                    {msg.attachments && Array.isArray(msg.attachments) && msg.attachments.length > 0 && (
                      <ChatMessageAttachments attachments={msg.attachments as any} />
                    )}
                    <p className={`text-xs mt-1 ${isOwn ? "text-primary-foreground/70" : "text-muted-foreground"}`}>
                      {formatTime(msg.created_at)}
                    </p>
                  </div>
                  {!isOwn && (
                    <div className="md:opacity-0 md:group-hover:opacity-100 transition-opacity self-center">
                      <ReactionPicker onSelect={(emoji) => toggleReaction.mutate({ messageId: msg.id, emoji })} />
                    </div>
                  )}
                </div>
                <MessageReactions
                  reactions={groupReactions(reactions, msg.id, currentProfile?.id)}
                  onToggle={(emoji) => toggleReaction.mutate({ messageId: msg.id, emoji })}
                  isOwn={isOwn}
                />
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
    : "fixed inset-0 z-50 md:inset-auto md:bottom-6 md:right-6 md:w-[340px] md:h-[480px]";

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
        {totalUnreadCount > 0 && (
          <span className="absolute -top-1 -right-1 min-w-5 h-5 px-1 rounded-full bg-destructive text-destructive-foreground text-xs font-bold flex items-center justify-center">
            {totalUnreadCount > 99 ? "99+" : totalUnreadCount}
          </span>
        )}
      </button>

      {/* Chat panel */}
      {isOpen && (
        <div 
          ref={dropZoneRef}
          className={`${panelClasses} bg-card border border-border rounded-none md:rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-bottom-4 ${
            isDragging ? "ring-2 ring-primary ring-offset-2" : ""
          }`}
          onDragEnter={handleDragEnter}
          onDragLeave={handleDragLeave}
          onDragOver={handleDragOver}
          onDrop={handleDrop}
        >
          {/* Drag overlay */}
          {isDragging && (
            <div className="absolute inset-0 z-50 bg-primary/10 backdrop-blur-sm flex items-center justify-center pointer-events-none">
              <div className="bg-card border-2 border-dashed border-primary rounded-xl px-6 py-4 text-center">
                <Paperclip className="w-8 h-8 mx-auto mb-2 text-primary" />
                <p className="text-sm font-medium text-foreground">Перетащите файлы сюда</p>
                <p className="text-xs text-muted-foreground">Изображения, документы, PDF</p>
              </div>
            </div>
          )}
          {/* Header with tabs */}
          <div className="bg-card border-b border-border" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
            <div className="flex items-center justify-between p-3">
              {(selectedConversationId && activeTab === "general") ? (
                <button
                  onClick={() => setSelectedConversation(null)}
                  className="flex items-center gap-2 text-sm font-medium text-foreground hover:text-primary transition-colors"
                >
                  <ChevronLeft className="w-4 h-4" />
                  {selectedConversation ? getConversationDisplayTitle(selectedConversation) : ""}
                </button>
              ) : (isSupportAdmin && activeTab === "support" && selectedSupportUserId) ? (
                <button
                  onClick={() => setSelectedSupportUserId(null)}
                  className="flex items-center gap-2 text-sm font-medium text-foreground hover:text-primary transition-colors"
                >
                  <ChevronLeft className="w-4 h-4" />
                  {supportThreads.find(t => t.userProfileId === selectedSupportUserId)?.userName || "Поддержка"}
                </button>
              ) : (
                <span className="text-sm font-semibold text-foreground">
                  {activeTab === "ai" ? "AI Ассистент" : activeTab === "support" ? "Техподдержка" : "Чаты"}
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
              <button
                onClick={() => setActiveTab("support")}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                  activeTab === "support"
                    ? "bg-primary text-primary-foreground"
                    : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
                }`}
              >
                <Headphones className="w-3 h-3" />
                Поддержка
              </button>
            </div>
          </div>

          {/* Messages */}
          {renderMessages()}

          {/* Input */}
          {(activeTab === "ai" || (activeTab === "support" && (!isSupportAdmin || selectedSupportUserId)) || selectedConversationId) && (
            <div className="p-3 border-t border-border space-y-2 pb-[env(safe-area-inset-bottom)]">
              {/* Pending attachments preview */}
              {pendingAttachments.length > 0 && (
                <ChatAttachmentPreview
                  attachments={pendingAttachments}
                  onRemove={handleRemoveAttachment}
                  isPreview
                />
              )}

              {/* Upload progress */}
              {isUploading && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Loader2 className="w-3 h-3 animate-spin" />
                  <span>Загрузка... {uploadProgress}%</span>
                </div>
              )}

              <div className="flex gap-2">
                {/* Attach button - only for regular chats, not AI */}
                {activeTab === "general" && selectedConversationId && (
                  <>
                    <input
                      ref={fileInputRef}
                      type="file"
                      multiple
                      accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt"
                      onChange={handleFileSelect}
                      className="hidden"
                    />
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      disabled={isUploading}
                      className="px-3 py-2 bg-secondary text-secondary-foreground rounded-xl hover:bg-secondary/80 transition-colors disabled:opacity-50"
                      title="Прикрепить файл"
                    >
                      <Paperclip className="w-4 h-4" />
                    </button>
                  </>
                )}
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  onKeyDown={handleKeyDown}
                  onPaste={handlePaste}
                  placeholder="Напишите сообщение..."
                  className="flex-1 bg-secondary text-foreground rounded-xl px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/50"
                  rows={1}
                  disabled={isAiLoading || isUploading}
                />
                <button
                  onClick={handleSendMessage}
                  disabled={(!message.trim() && pendingAttachments.length === 0) || isAiLoading || isUploading}
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
