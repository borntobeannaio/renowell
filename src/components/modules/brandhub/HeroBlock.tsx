import { Sparkles } from "lucide-react";
import { CopyButton } from "./CopyButton";
import { brandData } from "./BrandHubData";

export function HeroBlock() {
  return (
    <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary via-primary/90 to-primary/80 p-6 md:p-10 text-primary-foreground">
      {/* Background decoration */}
      <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmZmZmYiIGZpbGwtb3BhY2l0eT0iMC4wNSI+PHBhdGggZD0iTTM2IDM0djZoNnYtNmgtNnptMCAwdi02aC02djZoNnptLTYgNnY2aDZ2LTZoLTZ6bTYgMGg2djZoLTZ2LTZ6Ii8+PC9nPjwvZz48L3N2Zz4=')] opacity-50" />
      
      <div className="relative z-10">
        <div className="flex items-center gap-2 mb-4">
          <Sparkles className="w-6 h-6" />
          <span className="text-sm font-medium uppercase tracking-wider opacity-80">Суть бренда</span>
        </div>

        <h1 className="text-2xl md:text-4xl font-bold mb-4">
          {brandData.goldenRule.title}
        </h1>

        <div className="flex items-start gap-2 mb-4">
          <p className="text-lg md:text-xl leading-relaxed max-w-3xl">
            {brandData.goldenRule.text}
          </p>
          <CopyButton 
            text={brandData.goldenRule.text} 
            className="text-primary-foreground/70 hover:text-primary-foreground hover:bg-primary-foreground/10" 
          />
        </div>

        <p className="text-sm opacity-70 italic">
          {brandData.goldenRule.subtext}
        </p>
      </div>
    </div>
  );
}
