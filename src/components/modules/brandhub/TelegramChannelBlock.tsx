import { ExternalLink, MessageCircle, Calendar, RefreshCw, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTelegramChannel, TelegramPost } from "@/hooks/useTelegramChannel";
import { format } from "date-fns";
import { ru } from "date-fns/locale";
import { cn } from "@/lib/utils";

function PostCard({ post, index }: { post: TelegramPost; index: number }) {
  const formattedDate = format(new Date(post.date), "d MMMM yyyy, HH:mm", { locale: ru });

  return (
    <a
      href={post.link}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        "group relative block rounded-2xl overflow-hidden",
        "bg-gradient-to-br from-card/80 to-card/40 backdrop-blur-sm",
        "border border-border/50 hover:border-primary/30",
        "transition-all duration-500 hover:scale-[1.02] hover:shadow-xl hover:shadow-primary/10",
        "animate-in fade-in slide-in-from-bottom-4",
      )}
      style={{ animationDelay: `${index * 100}ms`, animationFillMode: "both" }}
    >
      {/* Image */}
      {post.imageUrl && (
        <div className="relative aspect-video overflow-hidden">
          <img
            src={post.imageUrl}
            alt=""
            className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-background/90 via-background/20 to-transparent" />
        </div>
      )}

      {/* Content */}
      <div className={cn("p-4", post.imageUrl && "absolute bottom-0 left-0 right-0")}>
        {post.text && (
          <p
            className={cn(
              "text-sm leading-relaxed line-clamp-3",
              post.imageUrl ? "text-foreground" : "text-foreground/90"
            )}
          >
            {post.text}
          </p>
        )}

        <div className="flex items-center justify-between mt-3 pt-3 border-t border-border/30">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Calendar className="w-3 h-3" />
            <span>{formattedDate}</span>
          </div>
          <div className="flex items-center gap-1 text-xs text-primary opacity-0 group-hover:opacity-100 transition-opacity">
            <span>Открыть</span>
            <ExternalLink className="w-3 h-3" />
          </div>
        </div>
      </div>

      {/* Hover glow effect */}
      <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-accent/5" />
      </div>
    </a>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <div className="w-16 h-16 rounded-full bg-muted/50 flex items-center justify-center mb-4">
        <MessageCircle className="w-8 h-8 text-muted-foreground" />
      </div>
      <h3 className="text-lg font-medium mb-2">Нет постов</h3>
      <p className="text-sm text-muted-foreground max-w-sm">
        Бот ещё не получил сообщения из канала. Убедитесь, что бот добавлен в канал как администратор.
      </p>
      <Button variant="outline" size="sm" className="mt-4" asChild>
        <a href="https://t.me/oparinandrey_renowell" target="_blank" rel="noopener noreferrer">
          <Send className="w-4 h-4 mr-2" />
          Открыть канал
        </a>
      </Button>
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {[...Array(4)].map((_, i) => (
        <div
          key={i}
          className="rounded-2xl border border-border/50 overflow-hidden animate-pulse"
        >
          <div className="aspect-video bg-muted/50" />
          <div className="p-4 space-y-3">
            <div className="h-4 bg-muted/50 rounded w-3/4" />
            <div className="h-4 bg-muted/50 rounded w-1/2" />
            <div className="h-3 bg-muted/30 rounded w-1/3 mt-4" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function TelegramChannelBlock() {
  const { data: posts, isLoading, error, refetch, isFetching } = useTelegramChannel();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#0088cc] to-[#0077b5] flex items-center justify-center shadow-lg shadow-[#0088cc]/20">
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
            size="sm"
            onClick={() => refetch()}
            disabled={isFetching}
            className="text-muted-foreground hover:text-foreground"
          >
            <RefreshCw className={cn("w-4 h-4", isFetching && "animate-spin")} />
          </Button>
          <Button variant="outline" size="sm" asChild>
            <a href="https://t.me/oparinandrey_renowell" target="_blank" rel="noopener noreferrer">
              <ExternalLink className="w-4 h-4 mr-2" />
              Открыть в Telegram
            </a>
          </Button>
        </div>
      </div>

      {/* Content */}
      {isLoading ? (
        <LoadingSkeleton />
      ) : error ? (
        <div className="text-center py-8">
          <p className="text-sm text-destructive mb-4">Ошибка загрузки канала</p>
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            Попробовать снова
          </Button>
        </div>
      ) : posts && posts.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {posts.map((post, index) => (
            <PostCard key={post.id} post={post} index={index} />
          ))}
        </div>
      ) : (
        <EmptyState />
      )}
    </div>
  );
}
