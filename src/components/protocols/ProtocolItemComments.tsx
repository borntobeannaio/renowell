import { useState } from "react";
import { MessageCircle, Send, Trash2, Loader2 } from "lucide-react";
import { useProtocolItemComments, useCreateProtocolItemComment, useDeleteProtocolItemComment } from "@/hooks/useProtocolItemComments";
import { useCurrentProfile } from "@/hooks/useCurrentProfile";
import { formatDistanceToNow } from "date-fns";
import { ru } from "date-fns/locale";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";

interface ProtocolItemCommentsProps {
  itemId: string;
  profiles: { id: string; first_name: string | null; last_name: string | null; avatar_url: string | null }[];
}

export function ProtocolItemComments({ itemId, profiles }: ProtocolItemCommentsProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [newComment, setNewComment] = useState("");
  
  const { data: profile } = useCurrentProfile();
  const { data: comments = [], isLoading } = useProtocolItemComments(itemId);
  const createComment = useCreateProtocolItemComment();
  const deleteComment = useDeleteProtocolItemComment();

  const getAuthorInfo = (authorId: string) => {
    const author = profiles.find(p => p.id === authorId);
    if (author) {
      const name = [author.first_name, author.last_name].filter(Boolean).join(" ") || "Пользователь";
      const initials = [author.first_name?.[0], author.last_name?.[0]].filter(Boolean).join("").toUpperCase() || "?";
      return { name, initials, avatar: author.avatar_url };
    }
    return { name: "Пользователь", initials: "?", avatar: null };
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim() || !profile?.id) return;

    try {
      await createComment.mutateAsync({
        item_id: itemId,
        author_id: profile.id,
        content: newComment.trim(),
      });
      setNewComment("");
    } catch (error) {
      console.error("Failed to create comment:", error);
    }
  };

  const handleDelete = async (commentId: string) => {
    try {
      await deleteComment.mutateAsync({ id: commentId, item_id: itemId });
    } catch (error) {
      console.error("Failed to delete comment:", error);
    }
  };

  // Don't show for temp items
  if (itemId.startsWith("temp-")) {
    return (
      <div className="text-xs text-muted-foreground italic">
        Комментарии будут доступны после сохранения пункта
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
      >
        <MessageCircle className="w-3.5 h-3.5" />
        <span>
          {comments.length > 0 
            ? `Комментарии (${comments.length})`
            : "Добавить комментарий"
          }
        </span>
      </button>

      {isExpanded && (
        <div className="pl-4 border-l-2 border-border space-y-3">
          {isLoading ? (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="w-3 h-3 animate-spin" />
              Загрузка...
            </div>
          ) : (
            <>
              {comments.map((comment) => {
                const author = getAuthorInfo(comment.author_id);
                const isOwn = profile?.id === comment.author_id;

                return (
                  <div key={comment.id} className="flex gap-2 group">
                    <Avatar className="w-6 h-6 shrink-0">
                      <AvatarImage src={author.avatar || undefined} />
                      <AvatarFallback className="text-[10px]">{author.initials}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-medium text-foreground">{author.name}</span>
                        <span className="text-[10px] text-muted-foreground">
                          {formatDistanceToNow(new Date(comment.created_at), { addSuffix: true, locale: ru })}
                        </span>
                        {isOwn && (
                          <button
                            type="button"
                            onClick={() => handleDelete(comment.id)}
                            className="opacity-0 group-hover:opacity-100 p-0.5 text-destructive/60 hover:text-destructive transition-all"
                            title="Удалить"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                      <p className="text-xs text-foreground/90 whitespace-pre-wrap break-words">
                        {comment.content}
                      </p>
                    </div>
                  </div>
                );
              })}

              {profile && (
                <form onSubmit={handleSubmit} className="flex gap-2">
                  <input
                    type="text"
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                    placeholder="Написать комментарий..."
                    className="flex-1 text-xs px-2 py-1.5 rounded border border-input bg-background focus:outline-none focus:ring-1 focus:ring-ring"
                  />
                  <Button
                    type="submit"
                    size="sm"
                    variant="ghost"
                    disabled={!newComment.trim() || createComment.isPending}
                    className="h-7 px-2"
                  >
                    {createComment.isPending ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Send className="w-3.5 h-3.5" />
                    )}
                  </Button>
                </form>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
