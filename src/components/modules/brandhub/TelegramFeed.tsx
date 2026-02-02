import { useState } from "react";
import { Send, ExternalLink, Calendar, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { useTelegramChannel, TelegramPost } from "@/hooks/useTelegramChannel";
import { format } from "date-fns";
import { ru } from "date-fns/locale";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;

// Get proxied image URL using stable file_id for Telegram images
function getMediaUrl(post: TelegramPost): string | null {
  // Priority 1: Use stable file_id with new telegram-image-proxy
  if (post.file_id) {
    return `${SUPABASE_URL}/functions/v1/telegram-image-proxy?file_id=${encodeURIComponent(post.file_id)}`;
  }
  if (post.video_file_id) {
    return `${SUPABASE_URL}/functions/v1/telegram-image-proxy?file_id=${encodeURIComponent(post.video_file_id)}`;
  }
  // Fallback for legacy posts with temporary URLs (may be expired)
  const legacyUrl = post.image_url || post.video_url;
  if (legacyUrl) {
    return `${SUPABASE_URL}/functions/v1/yandex-disk-proxy?url=${encodeURIComponent(legacyUrl)}`;
  }
  return null;
}

function PostCard({ post, onSelect }: { post: TelegramPost; onSelect: (post: TelegramPost) => void }) {
  const mediaUrl = getMediaUrl(post);
  
  return (
    <div 
      onClick={() => onSelect(post)}
      className="block group cursor-pointer"
    >
      <div className="rounded-xl border border-border/50 bg-card/80 backdrop-blur-sm 
                      overflow-hidden hover:shadow-lg hover:border-primary/30 
                      transition-all duration-300">
        {/* Image/Video thumbnail */}
        {mediaUrl && (
          <div className="aspect-video overflow-hidden bg-muted">
            <img 
              src={mediaUrl} 
              alt="" 
              className="w-full h-full object-cover 
                         group-hover:scale-105 transition-transform duration-500"
              loading="lazy"
            />
          </div>
        )}
        
        {/* Content */}
        <div className="p-4 space-y-3">
          {post.text && (
            <p className="text-sm text-foreground/90 line-clamp-4 
                          whitespace-pre-wrap leading-relaxed">
              {post.text}
            </p>
          )}
          
          {/* Meta */}
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <div className="flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5" />
              <span>
                {format(new Date(post.date), "d MMM yyyy, HH:mm", { locale: ru })}
              </span>
            </div>
            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 
                            transition-opacity text-primary">
              <span>Читать</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function PostModal({ post, onClose }: { post: TelegramPost; onClose: () => void }) {
  const mediaUrl = getMediaUrl(post);
  
  return (
    <Dialog open={true} onOpenChange={() => onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto p-0">
        {/* Image/Video */}
        {mediaUrl && (
          <div className="w-full">
            <img 
              src={mediaUrl} 
              alt="" 
              className="w-full h-auto rounded-t-lg"
            />
          </div>
        )}
        
        {/* Content */}
        <div className="p-6 space-y-4">
          {post.text && (
            <p className="text-foreground whitespace-pre-wrap leading-relaxed">
              {post.text}
            </p>
          )}
          
          {/* Footer */}
          <div className="flex items-center justify-between pt-4 border-t border-border">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Calendar className="w-4 h-4" />
              <span>
                {format(new Date(post.date), "d MMMM yyyy, HH:mm", { locale: ru })}
              </span>
            </div>
            <Button variant="outline" size="sm" asChild>
              <a href={post.link} target="_blank" rel="noopener noreferrer">
                <Send className="w-4 h-4 mr-2" />
                Открыть в Telegram
              </a>
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function LoadingSkeleton() {
  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-border/50 overflow-hidden">
        <Skeleton className="aspect-video" />
        <div className="p-4 space-y-3">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-3 w-32" />
        </div>
      </div>
      <div className="rounded-xl border border-border/50 overflow-hidden">
        <div className="p-4 space-y-3">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-5/6" />
          <Skeleton className="h-4 w-2/3" />
          <Skeleton className="h-3 w-32" />
        </div>
      </div>
      <div className="rounded-xl border border-border/50 overflow-hidden">
        <Skeleton className="aspect-video" />
        <div className="p-4 space-y-3">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-3 w-32" />
        </div>
      </div>
    </div>
  );
}

export function TelegramFeed() {
  const { data: posts, isLoading, error, refetch, isFetching } = useTelegramChannel();
  const [selectedPost, setSelectedPost] = useState<TelegramPost | null>(null);

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#0088cc] to-[#0077b5] 
                          flex items-center justify-center shadow-lg shadow-[#0088cc]/20">
            <Send className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="text-lg font-semibold">Бренд-канал</h2>
            <p className="text-sm text-muted-foreground">@oparinandrey_renowell</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button 
            variant="ghost" 
            size="icon"
            onClick={() => refetch()}
            disabled={isFetching}
            className="h-9 w-9"
          >
            <RefreshCw className={`w-4 h-4 ${isFetching ? 'animate-spin' : ''}`} />
          </Button>
          <Button variant="outline" size="sm" asChild>
            <a href="https://t.me/oparinandrey_renowell" target="_blank" rel="noopener noreferrer">
              <ExternalLink className="w-4 h-4 mr-2" />
              Открыть в Telegram
            </a>
          </Button>
        </div>
      </div>

      {/* Posts Feed */}
      <ScrollArea className="flex-1 min-h-0">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pb-4 pr-4">
          {isLoading && <LoadingSkeleton />}
          
          {error && (
            <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-6 text-center">
              <p className="text-sm text-muted-foreground mb-3">
                Не удалось загрузить посты
              </p>
              <Button variant="outline" size="sm" onClick={() => refetch()}>
                <RefreshCw className="w-4 h-4 mr-2" />
                Попробовать снова
              </Button>
            </div>
          )}
          
          {!isLoading && !error && posts?.map((post) => (
            <PostCard key={post.id} post={post} onSelect={setSelectedPost} />
          ))}
          
          {!isLoading && !error && posts?.length === 0 && (
            <div className="rounded-xl border border-border/50 bg-card/50 p-8 text-center">
              <Send className="w-10 h-10 text-muted-foreground/50 mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">
                Постов пока нет
              </p>
            </div>
          )}
        </div>
        </ScrollArea>

      {/* Post Modal */}
      {selectedPost && (
        <PostModal post={selectedPost} onClose={() => setSelectedPost(null)} />
      )}
    </div>
  );
}
