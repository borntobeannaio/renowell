import { ExternalLink, Send } from "lucide-react";
import { Button } from "@/components/ui/button";

export function TelegramChannelBlock() {
  return (
    <div className="space-y-4">
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

      {/* Telegram Channel Preview via iframe */}
      <div className="rounded-2xl border border-border/50 bg-card/50 backdrop-blur-sm overflow-hidden">
        <iframe
          src="https://t.me/s/oparinandrey_renowell"
          className="w-full border-0"
          style={{ height: "600px" }}
          title="Telegram Channel @oparinandrey_renowell"
        />
      </div>

      {/* Info text */}
      <p className="text-xs text-muted-foreground text-center">
        Нажмите на пост, чтобы открыть его в Telegram
      </p>
    </div>
  );
}