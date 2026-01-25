import { Send, ExternalLink, Calendar, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { useTelegramChannel, TelegramPost } from "@/hooks/useTelegramChannel";
import { format } from "date-fns";
import { ru } from "date-fns/locale";

function PostCard({ post }: { post: TelegramPost }) {
  const mediaUrl = post.image_url || post.video_url;
  
  return (
    <a 
      href={post.link} 
      target="_blank" 
      rel="noopener noreferrer"
      className="block group"
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
              <span>Открыть</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </div>
          </div>
        </div>
      </div>
    </a>
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

  return (
    <div className="h-full flex flex-col">
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
      <ScrollArea className="flex-1 -mr-4 pr-4">
        <div className="space-y-4 pb-4">
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
            <PostCard key={post.id} post={post} />
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
    </div>
  );
}
