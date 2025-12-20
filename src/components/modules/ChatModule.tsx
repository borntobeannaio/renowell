import { useState, useRef, useEffect, KeyboardEvent } from "react";
import { useApp } from "@/context/AppContext";
import { Modal } from "@/components/ui/Modal";
import { Plus, Send, Users, User, MessageCircle } from "lucide-react";
import { ChatThread, ChatMessage } from "@/types";

export function ChatModule() {
  const { chats, employees, addChat, addMessage, getEmployeeById } = useApp();
  const [selectedChat, setSelectedChat] = useState<ChatThread | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newChatType, setNewChatType] = useState<"direct" | "group">("direct");
  const [selectedParticipants, setSelectedParticipants] = useState<string[]>([]);
  const [groupTitle, setGroupTitle] = useState("");
  const [message, setMessage] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Find selected chat in state (to get updated messages)
  const currentChat = selectedChat
    ? chats.find((c) => c.id === selectedChat.id)
    : null;

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [currentChat?.messages]);

  const handleSendMessage = () => {
    if (!message.trim() || !currentChat) return;

    addMessage(currentChat.id, {
      author: "e1", // Current user (mock)
      text: message.trim(),
      ts: Date.now(),
    });

    setMessage("");
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleCreateChat = () => {
    if (selectedParticipants.length === 0) return;

    const title =
      newChatType === "group"
        ? groupTitle || "Групповой чат"
        : getEmployeeById(selectedParticipants[0])?.name || "Чат";

    addChat({
      title,
      type: newChatType,
      participants: ["e1", ...selectedParticipants],
    });

    setIsModalOpen(false);
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

  const formatTime = (ts: number) => {
    const date = new Date(ts);
    return date.toLocaleTimeString("ru-RU", {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div className="flex gap-4 h-[calc(100vh-12rem)] md:h-[calc(100vh-10rem)]">
      {/* Threads list */}
      <div
        className={`${
          currentChat ? "hidden md:flex" : "flex"
        } flex-col w-full md:w-80 shrink-0`}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-foreground">Чаты</h3>
          <button
            onClick={() => setIsModalOpen(true)}
            className="p-2 rounded-lg bg-primary text-primary-foreground hover:opacity-90 transition-opacity"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto space-y-2 scrollbar-thin">
          {chats.map((chat) => (
            <button
              key={chat.id}
              onClick={() => setSelectedChat(chat)}
              className={`w-full p-3 rounded-lg text-left transition-colors ${
                currentChat?.id === chat.id
                  ? "bg-primary/10 border border-primary/30"
                  : "bg-card border border-border hover:border-primary/30"
              }`}
            >
              <div className="flex items-center gap-3">
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center ${
                    chat.type === "group"
                      ? "bg-primary/10 text-primary"
                      : "bg-secondary text-secondary-foreground"
                  }`}
                >
                  {chat.type === "group" ? (
                    <Users className="w-5 h-5" />
                  ) : (
                    <User className="w-5 h-5" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-foreground truncate">
                    {chat.title}
                  </p>
                  {chat.messages.length > 0 && (
                    <p className="text-sm text-muted-foreground truncate">
                      {chat.messages[chat.messages.length - 1].text}
                    </p>
                  )}
                </div>
              </div>
            </button>
          ))}

          {chats.length === 0 && (
            <div className="text-center py-12 text-muted-foreground">
              Нет чатов
            </div>
          )}
        </div>
      </div>

      {/* Messages pane */}
      {currentChat ? (
        <div className="flex-1 flex flex-col card-base overflow-hidden">
          <div className="p-4 border-b border-border flex items-center gap-3">
            <button
              onClick={() => setSelectedChat(null)}
              className="md:hidden p-2 -ml-2 hover:bg-secondary rounded-lg transition-colors"
            >
              ←
            </button>
            <div
              className={`w-10 h-10 rounded-full flex items-center justify-center ${
                currentChat.type === "group"
                  ? "bg-primary/10 text-primary"
                  : "bg-secondary text-secondary-foreground"
              }`}
            >
              {currentChat.type === "group" ? (
                <Users className="w-5 h-5" />
              ) : (
                <User className="w-5 h-5" />
              )}
            </div>
            <div>
              <h3 className="font-semibold text-foreground">
                {currentChat.title}
              </h3>
              <p className="text-sm text-muted-foreground">
                {currentChat.participants.length} участников
              </p>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-thin">
            {currentChat.messages.map((msg) => {
              const isSystem = msg.author === "system";
              const isOwn = msg.author === "e1";
              const author = getEmployeeById(msg.author);

              if (isSystem) {
                return (
                  <div key={msg.id} className="text-center">
                    <span className="text-sm text-muted-foreground bg-secondary px-3 py-1 rounded-full">
                      {msg.text}
                    </span>
                  </div>
                );
              }

              return (
                <div
                  key={msg.id}
                  className={`flex ${isOwn ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[80%] ${
                      isOwn
                        ? "bg-primary text-primary-foreground"
                        : "bg-secondary text-secondary-foreground"
                    } rounded-2xl px-4 py-2`}
                  >
                    {!isOwn && (
                      <p className="text-xs font-medium mb-1 opacity-70">
                        {author?.name || "Пользователь"}
                      </p>
                    )}
                    <p className="whitespace-pre-wrap break-words">{msg.text}</p>
                    <p
                      className={`text-xs mt-1 ${
                        isOwn ? "text-primary-foreground/70" : "text-muted-foreground"
                      }`}
                    >
                      {formatTime(msg.ts)}
                    </p>
                  </div>
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </div>

          <div className="p-4 border-t border-border">
            <div className="flex gap-2">
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Введите сообщение... (Enter — отправить, Shift+Enter — новая строка)"
                className="input-base flex-1 min-h-[40px] max-h-32 resize-none"
                rows={1}
              />
              <button
                onClick={handleSendMessage}
                disabled={!message.trim()}
                className="btn-primary px-4 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="hidden md:flex flex-1 items-center justify-center card-base">
          <div className="text-center text-muted-foreground">
            <MessageCircle className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>Выберите чат или создайте новый</p>
          </div>
        </div>
      )}

      {/* Create chat modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
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
              {employees
                .filter((e) => e.id !== "e1")
                .map((emp) => (
                  <label
                    key={emp.id}
                    className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-colors ${
                      selectedParticipants.includes(emp.id)
                        ? "bg-primary/10 border border-primary/30"
                        : "bg-secondary hover:bg-secondary/80"
                    }`}
                  >
                    <input
                      type={newChatType === "direct" ? "radio" : "checkbox"}
                      checked={selectedParticipants.includes(emp.id)}
                      onChange={() => toggleParticipant(emp.id)}
                      className="w-4 h-4 text-primary"
                    />
                    <img
                      src={emp.avatar}
                      alt={emp.name}
                      className="w-8 h-8 rounded-full"
                    />
                    <div className="flex-1">
                      <p className="font-medium text-foreground">{emp.name}</p>
                      <p className="text-sm text-muted-foreground">{emp.role}</p>
                    </div>
                  </label>
                ))}
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <button
              onClick={() => setIsModalOpen(false)}
              className="btn-secondary"
            >
              Отмена
            </button>
            <button
              onClick={handleCreateChat}
              disabled={selectedParticipants.length === 0}
              className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Создать
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
