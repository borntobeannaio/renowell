import { useState } from "react";
import { MessageCircle, Send, Trash2, Loader2, Pencil, X, Check } from "lucide-react";
import { useProtocolItemComments, useCreateProtocolItemComment, useUpdateProtocolItemComment, useDeleteProtocolItemComment } from "@/hooks/useProtocolItemComments";
import { useCurrentProfile } from "@/hooks/useCurrentProfile";
import { useEmployees } from "@/hooks/useEmployees";
import { formatDistanceToNow } from "date-fns";
import { ru } from "date-fns/locale";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { MentionInput, extractMentions } from "@/components/tasks/MentionInput";

interface ProtocolItemCommentsProps {
  itemId: string;
  profiles: { id: string; first_name: string | null; last_name: string | null; avatar_url: string | null }[];
  protocolTitle?: string;
  onPersistTempItem?: () => Promise<string | null>; // Returns new item ID after persistence
}

export function ProtocolItemComments({ itemId, profiles, protocolTitle, onPersistTempItem }: ProtocolItemCommentsProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [persistedItemId, setPersistedItemId] = useState<string | null>(null);
  const [isPersisting, setIsPersisting] = useState(false);
  const [newComment, setNewComment] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState("");
  
  const { data: profile } = useCurrentProfile();
  const { data: employees = [] } = useEmployees();
  
  // Use persisted ID if available (after auto-save of temp item)
  const effectiveItemId = persistedItemId || itemId;
  const isTempItem = effectiveItemId.startsWith("temp-");
  
  const { data: comments = [], isLoading } = useProtocolItemComments(isTempItem ? null : effectiveItemId);
  const createComment = useCreateProtocolItemComment();
  const updateComment = useUpdateProtocolItemComment();
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

  const handleSubmit = async () => {
    if (!newComment.trim() || !profile?.id) return;

    let targetItemId = effectiveItemId;

    // If it's a temp item, persist it first
    if (isTempItem && onPersistTempItem) {
      setIsPersisting(true);
      try {
        const newId = await onPersistTempItem();
        if (newId) {
          targetItemId = newId;
          setPersistedItemId(newId);
        } else {
          console.error("Failed to persist temp item");
          setIsPersisting(false);
          return;
        }
      } catch (error) {
        console.error("Failed to persist temp item:", error);
        setIsPersisting(false);
        return;
      }
      setIsPersisting(false);
    }

    // Извлечь упоминания для создания уведомлений
    const mentionedNames = extractMentions(newComment);
    const mentionedProfileIds = mentionedNames
      .map((name) => employees.find((e) => e.full_name === name)?.profile_id)
      .filter(Boolean) as string[];

    const authorName = [profile.first_name, profile.last_name].filter(Boolean).join(" ") || "Пользователь";

    try {
      await createComment.mutateAsync({
        item_id: targetItemId,
        author_id: profile.id,
        content: newComment.trim(),
        mentionedProfileIds,
        protocolTitle,
        authorName,
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

  const handleStartEdit = (commentId: string, content: string) => {
    setEditingId(commentId);
    setEditContent(content);
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditContent("");
  };

  const handleSaveEdit = async () => {
    if (!editingId || !editContent.trim()) return;

    try {
      await updateComment.mutateAsync({
        id: editingId,
        item_id: effectiveItemId,
        content: editContent.trim(),
      });
      setEditingId(null);
      setEditContent("");
    } catch (error) {
      console.error("Failed to update comment:", error);
    }
  };

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
                const isEditing = editingId === comment.id;

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
                        {isOwn && !isEditing && (
                          <>
                            <button
                              type="button"
                              onClick={() => handleStartEdit(comment.id, comment.content)}
                              className="opacity-0 group-hover:opacity-100 p-0.5 text-muted-foreground hover:text-foreground transition-all"
                              title="Редактировать"
                            >
                              <Pencil className="w-3 h-3" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDelete(comment.id)}
                              className="opacity-0 group-hover:opacity-100 p-0.5 text-destructive/60 hover:text-destructive transition-all"
                              title="Удалить"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </>
                        )}
                      </div>
                      {isEditing ? (
                        <div className="flex gap-1.5 mt-1 items-end">
                          <div className="flex-1">
                            <MentionInput
                              value={editContent}
                              onChange={setEditContent}
                              onSubmit={handleSaveEdit}
                              placeholder="Редактировать комментарий..."
                              disabled={updateComment.isPending}
                              className="min-h-[32px] text-xs"
                            />
                          </div>
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            onClick={handleSaveEdit}
                            disabled={!editContent.trim() || updateComment.isPending}
                            className="h-7 px-1.5"
                          >
                            {updateComment.isPending ? (
                              <Loader2 className="w-3 h-3 animate-spin" />
                            ) : (
                              <Check className="w-3 h-3 text-green-600" />
                            )}
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            onClick={handleCancelEdit}
                            className="h-7 px-1.5"
                          >
                            <X className="w-3 h-3" />
                          </Button>
                        </div>
                      ) : (
                        <p className="text-xs text-foreground/90 whitespace-pre-wrap break-words">
                          {renderContentWithMentions(comment.content)}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}

              {profile && (
                <div className="flex gap-2 items-end">
                  <div className="flex-1">
                    <MentionInput
                      value={newComment}
                      onChange={setNewComment}
                      onSubmit={handleSubmit}
                      placeholder="Комментарий... (@ для упоминания)"
                      disabled={createComment.isPending}
                      className="min-h-[32px] text-xs"
                    />
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={handleSubmit}
                    disabled={!newComment.trim() || createComment.isPending}
                    className="h-7 px-2"
                  >
                    {createComment.isPending ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Send className="w-3.5 h-3.5" />
                    )}
                  </Button>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
