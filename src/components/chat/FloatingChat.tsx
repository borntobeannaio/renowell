import { useState, useRef, useEffect, KeyboardEvent } from "react";
import { MessageCircle, X, Send, Users, Bot, ChevronLeft, Loader2 } from "lucide-react";
import { useApp } from "@/context/AppContext";
import { supabase } from "@/integrations/supabase/client";

type ChatTab = "general" | "ai";

interface AIMessage {
  role: "user" | "assistant";
  content: string;
}

export function FloatingChat() {
  const { chats, employees, addMessage, getEmployeeById } = useApp();
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<ChatTab>("general");
  const [selectedChatId, setSelectedChatId] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [aiMessages, setAiMessages] = useState<AIMessage[]>([]);
  const [isAiLoading, setIsAiLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Find general chat (group chat or first chat)
  const generalChat = chats.find(c => c.type === "group") || chats[0];
  const selectedChat = selectedChatId ? chats.find(c => c.id === selectedChatId) : null;

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [selectedChat?.messages, aiMessages]);

  const formatTime = (ts: number) => {
    const date = new Date(ts);
    return date.toLocaleTimeString("ru-RU", {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const handleSendMessage = () => {
    if (!message.trim()) return;

    if (activeTab === "ai") {
      handleSendAiMessage();
    } else if (selectedChatId) {
      addMessage(selectedChatId, {
        author: "e1",
        text: message.trim(),
        ts: Date.now(),
      });
      setMessage("");
    }
  };

  const handleSendAiMessage = async () => {
    if (!message.trim() || isAiLoading) return;

    const userMessage: AIMessage = { role: "user", content: message.trim() };
    setAiMessages(prev => [...prev, userMessage]);
    setMessage("");
    setIsAiLoading(true);

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
          body: JSON.stringify({ messages: [...aiMessages, userMessage] }),
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
              setAiMessages(prev => {
                const last = prev[prev.length - 1];
                if (last?.role === "assistant") {
                  return prev.map((m, i) =>
                    i === prev.length - 1 ? { ...m, content: assistantContent } : m
                  );
                }
                return [...prev, { role: "assistant", content: assistantContent }];
              });
            }
          } catch {
            // Partial JSON, continue
          }
        }
      }
    } catch (error) {
      console.error("AI error:", error);
      setAiMessages(prev => [
        ...prev,
        { role: "assistant", content: "Извините, произошла ошибка. Попробуйте позже." },
      ]);
    } finally {
      setIsAiLoading(false);
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const renderChatList = () => (
    <div className="flex-1 overflow-y-auto p-3 space-y-2">
      {chats.map((chat) => (
        <button
          key={chat.id}
          onClick={() => {
            setSelectedChatId(chat.id);
            setActiveTab("general");
          }}
          className="w-full p-2 rounded-lg text-left transition-colors bg-secondary/50 hover:bg-secondary text-sm"
        >
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
              <Users className="w-4 h-4 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-medium text-foreground truncate">{chat.title}</p>
              {chat.messages.length > 0 && (
                <p className="text-xs text-muted-foreground truncate">
                  {chat.messages[chat.messages.length - 1].text}
                </p>
              )}
            </div>
          </div>
        </button>
      ))}
    </div>
  );

  const renderMessages = () => {
    if (activeTab === "ai") {
      return (
        <div className="flex-1 overflow-y-auto p-3 space-y-3">
          {aiMessages.length === 0 && (
            <div className="text-center text-muted-foreground text-sm py-8">
              <Bot className="w-10 h-10 mx-auto mb-2 opacity-50" />
              <p>Привет! Я AI-ассистент.</p>
              <p>Задайте мне любой вопрос.</p>
            </div>
          )}
          {aiMessages.map((msg, idx) => (
            <div
              key={idx}
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
          {isAiLoading && aiMessages[aiMessages.length - 1]?.role !== "assistant" && (
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

    if (!selectedChat) {
      return renderChatList();
    }

    return (
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {selectedChat.messages.map((msg) => {
          const isOwn = msg.author === "e1";
          const author = getEmployeeById(msg.author);

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
                {!isOwn && (
                  <p className="text-xs font-medium mb-1 opacity-70">
                    {author?.name || "Пользователь"}
                  </p>
                )}
                <p className="whitespace-pre-wrap break-words">{msg.text}</p>
                <p className={`text-xs mt-1 ${isOwn ? "text-primary-foreground/70" : "text-muted-foreground"}`}>
                  {formatTime(msg.ts)}
                </p>
              </div>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>
    );
  };

  return (
    <>
      {/* Floating button */}
      <button
        onClick={() => setIsOpen(true)}
        className={`fixed bottom-20 md:bottom-6 right-4 md:right-6 z-50 w-14 h-14 rounded-full bg-primary text-primary-foreground shadow-lg hover:scale-105 transition-transform flex items-center justify-center ${
          isOpen ? "hidden" : ""
        }`}
      >
        <MessageCircle className="w-6 h-6" />
      </button>

      {/* Chat panel */}
      {isOpen && (
        <div className="fixed bottom-20 md:bottom-6 right-4 md:right-6 z-50 w-[340px] h-[480px] bg-card border border-border rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-bottom-4">
          {/* Header with tabs */}
          <div className="bg-card border-b border-border">
            <div className="flex items-center justify-between p-3">
              {selectedChatId && activeTab === "general" ? (
                <button
                  onClick={() => setSelectedChatId(null)}
                  className="flex items-center gap-2 text-sm font-medium text-foreground hover:text-primary transition-colors"
                >
                  <ChevronLeft className="w-4 h-4" />
                  {selectedChat?.title}
                </button>
              ) : (
                <span className="text-sm font-semibold text-foreground">
                  {activeTab === "ai" ? "AI Ассистент" : "Чаты"}
                </span>
              )}
              <button
                onClick={() => setIsOpen(false)}
                className="p-1.5 rounded-lg hover:bg-secondary transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Pinned tabs */}
            <div className="flex gap-1 px-3 pb-2">
              <button
                onClick={() => {
                  setActiveTab("general");
                  setSelectedChatId(null);
                }}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                  activeTab === "general"
                    ? "bg-primary text-primary-foreground"
                    : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
                }`}
              >
                <Users className="w-3 h-3" />
                Общий чат
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
          {(activeTab === "ai" || selectedChatId) && (
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
    </>
  );
}
