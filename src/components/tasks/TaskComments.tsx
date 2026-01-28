import { useState, useEffect, useRef } from "react";
import { Send, Trash2, MessageSquare, Pencil, Check, X, Loader2 } from "lucide-react";
import { useTaskComments, useCreateTaskComment, useDeleteTaskComment, useUpdateTaskComment, TaskComment } from "@/hooks/useTaskComments";
import { useCurrentProfile } from "@/hooks/useCurrentProfile";
import { useEmployees } from "@/hooks/useEmployees";
import { formatDistanceToNow } from "date-fns";
import { ru } from "date-fns/locale";
import { toast } from "sonner";
import { MentionInput, extractMentions } from "./MentionInput";
import { cn } from "@/lib/utils";

interface TaskCommentsProps {
  taskId: string;
  taskTitle?: string;
}

export function TaskComments({ taskId, taskTitle }: TaskCommentsProps) {
  const [newComment, setNewComment] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState("");
  const commentsEndRef = useRef<HTMLDivElement>(null);
  
  const { data: profile } = useCurrentProfile();
  const { data: employees = [] } = useEmployees();
  const { data: comments = [], isLoading } = useTaskComments(taskId);
  const createComment = useCreateTaskComment();
  const deleteComment = useDeleteTaskComment();
  const updateComment = useUpdateTaskComment();

  // Auto-scroll to bottom when new comments arrive
  useEffect(() => {
    commentsEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [comments.length]);

  const handleSubmit = () => {
    if (!newComment.trim()) return;

    // Извлечь упоминания для создания уведомлений
    const mentionedNames = extractMentions(newComment);
    const mentionedProfileIds = mentionedNames
      .map((name) => employees.find((e) => e.full_name === name)?.profile_id)
      .filter(Boolean) as string[];

    createComment.mutate(
      { 
        taskId, 
        content: newComment,
        mentionedProfileIds,
        taskTitle: taskTitle || "Задача",
        authorName: profile ? `${profile.first_name || ""} ${profile.last_name || ""}`.trim() : "Пользователь"
      },
      {
        onSuccess: () => {
          setNewComment("");
        },
        onError: (error) => {
          toast.error("Не удалось добавить комментарий");
          console.error(error);
        },
      }
    );
  };

  const handleDelete = (commentId: string) => {
    deleteComment.mutate(
      { commentId, taskId },
      {
        onError: () => {
          toast.error("Не удалось удалить комментарий");
        },
      }
    );
  };

  const handleStartEdit = (commentId: string, content: string) => {
    setEditingId(commentId);
    setEditContent(content);
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditContent("");
  };

  const handleSaveEdit = () => {
    if (!editingId || !editContent.trim()) return;

    updateComment.mutate(
      { commentId: editingId, taskId, content: editContent.trim() },
      {
        onSuccess: () => {
          setEditingId(null);
          setEditContent("");
        },
        onError: () => {
          toast.error("Не удалось обновить комментарий");
        },
      }
    );
  };

  const getAuthorName = (comment: TaskComment) => {
    if (!comment.author) return "Неизвестный";
    const { first_name, last_name } = comment.author;
    return [first_name, last_name].filter(Boolean).join(" ") || "Неизвестный";
  };

  const getAuthorInitials = (comment: TaskComment) => {
    if (!comment.author) return "?";
    const { first_name, last_name } = comment.author;
    return `${(first_name || "")[0] || ""}${(last_name || "")[0] || ""}`.toUpperCase() || "?";
  };

  // Подсветка упоминаний в тексте
  const renderContentWithMentions = (content: string) => {
    const MENTION_REGEX = /@([А-Яа-яЁёA-Za-z]+\s[А-Яа-яЁёA-Za-z]+)/g;
    const parts = content.split(MENTION_REGEX);
    
    return parts.map((part, index) => {
      // Нечётные индексы — это захваченные имена
      if (index % 2 === 1) {
        return (
          <span key={index} className="text-primary font-medium">
            @{part}
          </span>
        );
      }
      return part;
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-sm font-medium text-foreground">
        <MessageSquare className="w-4 h-4" />
        <span>Комментарии ({comments.length})</span>
      </div>

      {/* Comments list */}
      <div className="max-h-60 overflow-y-auto space-y-3 pr-1">
        {isLoading ? (
          <p className="text-sm text-muted-foreground text-center py-4">Загрузка...</p>
        ) : comments.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            Нет комментариев
          </p>
        ) : (
          comments.map((comment) => {
            const isOwn = comment.author_id === profile?.id;
            const isEditing = editingId === comment.id;
            
            return (
              <div
                key={comment.id}
                className={`flex gap-3 ${isOwn ? "flex-row-reverse" : ""} group`}
              >
                {/* Avatar */}
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                  <span className="text-xs font-medium text-primary">
                    {getAuthorInitials(comment)}
                  </span>
                </div>

                {/* Comment bubble */}
                <div
                  className={cn(
                    "flex-1 max-w-[80%] rounded-lg p-3",
                    isOwn ? "bg-primary/10" : "bg-muted"
                  )}
                >
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <span className="text-xs font-medium text-foreground">
                      {getAuthorName(comment)}
                    </span>
                    <div className="flex items-center gap-1">
                      <span className="text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(comment.created_at), {
                          addSuffix: true,
                          locale: ru,
                        })}
                      </span>
                      {isOwn && !isEditing && (
                        <>
                          <button
                            onClick={() => handleStartEdit(comment.id, comment.content)}
                            className="p-1 hover:bg-muted rounded transition-colors opacity-0 group-hover:opacity-100"
                            title="Редактировать комментарий"
                          >
                            <Pencil className="w-3 h-3 text-muted-foreground" />
                          </button>
                          <button
                            onClick={() => handleDelete(comment.id)}
                            className="p-1 hover:bg-destructive/10 rounded transition-colors opacity-0 group-hover:opacity-100"
                            title="Удалить комментарий"
                          >
                            <Trash2 className="w-3 h-3 text-destructive" />
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                  {isEditing ? (
                    <div className="flex gap-2 items-end mt-1">
                      <div className="flex-1">
                        <MentionInput
                          value={editContent}
                          onChange={setEditContent}
                          onSubmit={handleSaveEdit}
                          placeholder="Редактировать комментарий..."
                          disabled={updateComment.isPending}
                          className="min-h-[36px] text-sm"
                        />
                      </div>
                      <button
                        onClick={handleSaveEdit}
                        disabled={!editContent.trim() || updateComment.isPending}
                        className="p-1.5 hover:bg-muted rounded transition-colors disabled:opacity-50"
                        title="Сохранить"
                      >
                        {updateComment.isPending ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Check className="w-4 h-4 text-green-600" />
                        )}
                      </button>
                      <button
                        onClick={handleCancelEdit}
                        className="p-1.5 hover:bg-muted rounded transition-colors"
                        title="Отмена"
                      >
                        <X className="w-4 h-4 text-muted-foreground" />
                      </button>
                    </div>
                  ) : (
                    <p className="text-sm text-foreground whitespace-pre-wrap break-words">
                      {renderContentWithMentions(comment.content)}
                    </p>
                  )}
                </div>
              </div>
            );
          })
        )}
        <div ref={commentsEndRef} />
      </div>

      {/* New comment form with mentions */}
      <div className="flex gap-2 items-end">
        <div className="flex-1">
          <MentionInput
            value={newComment}
            onChange={setNewComment}
            onSubmit={handleSubmit}
            placeholder="Написать комментарий... (@ для упоминания)"
            disabled={createComment.isPending}
            className="min-h-[40px] text-sm"
          />
        </div>
        <button
          type="button"
          onClick={handleSubmit}
          disabled={!newComment.trim() || createComment.isPending}
          className="btn-primary h-10 px-3 disabled:opacity-50 flex-shrink-0"
        >
          <Send className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
