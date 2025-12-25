import { ExternalLink, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useEffect, useRef } from "react";

export function TelegramChannelBlock() {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Load Telegram Widget script
    const script = document.createElement("script");
    script.src = "https://telegram.org/js/telegram-widget.js?22";
    script.setAttribute("data-telegram-post", "oparinandrey_renowell/1");
    script.setAttribute("data-width", "100%");
    script.setAttribute("data-userpic", "false");
    script.async = true;

    // Clear container and append script
    if (containerRef.current) {
      containerRef.current.innerHTML = "";
      containerRef.current.appendChild(script);
    }

    return () => {
      if (containerRef.current) {
        containerRef.current.innerHTML = "";
      }
    };
  }, []);

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

        <Button variant="outline" size="sm" asChild>
          <a href="https://t.me/oparinandrey_renowell" target="_blank" rel="noopener noreferrer">
            <ExternalLink className="w-4 h-4 mr-2" />
            Открыть в Telegram
          </a>
        </Button>
      </div>

      {/* Telegram Widget Container */}
      <div 
        className="rounded-2xl border border-border/50 bg-card/50 backdrop-blur-sm p-4 overflow-hidden"
      >
        <div 
          ref={containerRef}
          className="telegram-widget-container"
          style={{ minHeight: "400px" }}
        />
      </div>

      {/* Info text */}
      <p className="text-xs text-muted-foreground text-center">
        Виджет отображает последние посты из Telegram-канала. Нажмите на пост, чтобы открыть его в Telegram.
      </p>
    </div>
  );
}