import { useState, useEffect, useRef } from "react";
import { Send, Trash2, MessageSquare } from "lucide-react";
import { useTaskComments, useCreateTaskComment, useDeleteTaskComment, TaskComment } from "@/hooks/useTaskComments";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { formatDistanceToNow } from "date-fns";
import { ru } from "date-fns/locale";
import { toast } from "sonner";

interface TaskCommentsProps {
  taskId: string;
}

export function TaskComments({ taskId }: TaskCommentsProps) {
  const [newComment, setNewComment] = useState("");
  const [currentProfileId, setCurrentProfileId] = useState<string | null>(null);
  const commentsEndRef = useRef<HTMLDivElement>(null);
  
  const { data: comments = [], isLoading } = useTaskComments(taskId);
  const createComment = useCreateTaskComment();
  const deleteComment = useDeleteTaskComment();

  // Get current user's profile id
  useEffect(() => {
    const fetchProfileId = async () => {
      const { data } = await supabase.rpc("get_user_profile_id");
      setCurrentProfileId(data);
    };
    fetchProfileId();
  }, []);

  // Auto-scroll to bottom when new comments arrive
  useEffect(() => {
    commentsEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [comments.length]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim()) return;

    createComment.mutate(
      { taskId, content: newComment },
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
            const isOwn = comment.author_id === currentProfileId;
            
            return (
              <div
                key={comment.id}
                className={`flex gap-3 ${isOwn ? "flex-row-reverse" : ""}`}
              >
                {/* Avatar */}
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                  <span className="text-xs font-medium text-primary">
                    {getAuthorInitials(comment)}
                  </span>
                </div>

                {/* Comment bubble */}
                <div
                  className={`flex-1 max-w-[80%] ${
                    isOwn ? "bg-primary/10" : "bg-muted"
                  } rounded-lg p-3`}
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
                      {isOwn && (
                        <button
                          onClick={() => handleDelete(comment.id)}
                          className="p-1 hover:bg-destructive/10 rounded transition-colors"
                          title="Удалить комментарий"
                        >
                          <Trash2 className="w-3 h-3 text-destructive" />
                        </button>
                      )}
                    </div>
                  </div>
                  <p className="text-sm text-foreground whitespace-pre-wrap break-words">
                    {comment.content}
                  </p>
                </div>
              </div>
            );
          })
        )}
        <div ref={commentsEndRef} />
      </div>

      {/* New comment form */}
      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          type="text"
          value={newComment}
          onChange={(e) => setNewComment(e.target.value)}
          placeholder="Написать комментарий..."
          className="input-base flex-1 text-sm"
          disabled={createComment.isPending}
        />
        <button
          type="submit"
          disabled={!newComment.trim() || createComment.isPending}
          className="btn-primary h-10 px-3 disabled:opacity-50"
        >
          <Send className="w-4 h-4" />
        </button>
      </form>
    </div>
  );
}
