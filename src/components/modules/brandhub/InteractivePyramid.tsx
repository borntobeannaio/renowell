import { useState, useEffect } from "react";
import { ChevronRight, Copy, Check } from "lucide-react";
import { brandData } from "./BrandHubData";
import { toast } from "sonner";

interface InteractivePyramidProps {
  onLayerSelect: (level: number) => void;
  selectedLevel: number | null;
}

export function InteractivePyramid({ onLayerSelect, selectedLevel }: InteractivePyramidProps) {
  const [copiedRule, setCopiedRule] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleCopyRule = async () => {
    try {
      await navigator.clipboard.writeText(brandData.goldenRule.text);
      setCopiedRule(true);
      toast.success("Золотое правило скопировано");
      setTimeout(() => setCopiedRule(false), 2000);
    } catch {
      toast.error("Не удалось скопировать");
    }
  };

  const layers = [
    { 
      level: 1, 
      title: "Суть бренда", 
      subtitle: "Золотое правило",
      color: "from-primary to-primary/80",
      textColor: "text-primary-foreground",
      width: "w-[45%]"
    },
    { 
      level: 2, 
      title: "Позиционирование", 
      subtitle: "Кто мы и для кого",
      color: "from-accent to-accent/80",
      textColor: "text-accent-foreground",
      width: "w-[55%]"
    },
    { 
      level: 3, 
      title: "Характер и Тональность", 
      subtitle: "Как мы себя ведём",
      color: "from-secondary to-secondary/80",
      textColor: "text-secondary-foreground",
      width: "w-[65%]"
    },
    { 
      level: 4, 
      title: "Ценности", 
      subtitle: "Во что мы верим",
      color: "from-muted to-muted/80",
      textColor: "text-muted-foreground",
      width: "w-[75%]"
    },
    { 
      level: 5, 
      title: "Польза", 
      subtitle: "Что получает клиент",
      color: "from-card to-card/80 border border-border",
      textColor: "text-foreground",
      width: "w-[85%]"
    },
    { 
      level: 6, 
      title: "Атрибуты", 
      subtitle: "Конкретные доказательства",
      color: "from-background to-background border border-border",
      textColor: "text-foreground",
      width: "w-full"
    },
  ];

  return (
    <div className="space-y-6">
      {/* Golden Rule - Always visible at top */}
      <div 
        className={`
          relative overflow-hidden rounded-xl bg-gradient-to-br from-primary via-primary/95 to-primary/85 
          p-5 md:p-6 text-primary-foreground shadow-xl
          transition-all duration-500 ease-out
          ${mounted ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-4"}
        `}
      >
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmZmZmYiIGZpbGwtb3BhY2l0eT0iMC4wNSI+PHBhdGggZD0iTTM2IDM0djZoNnYtNmgtNnptMCAwdi02aC02djZoNnptLTYgNnY2aDZ2LTZoLTZ6bTYgMGg2djZoLTZ2LTZ6Ii8+PC9nPjwvZz48L3N2Zz4=')] opacity-50" />
        <div className="relative flex items-start justify-between gap-4">
          <div className="flex-1">
            <p className="text-xs uppercase tracking-wider opacity-70 mb-1">Золотое правило Renowell</p>
            <p className="text-base md:text-lg font-medium leading-relaxed">
              {brandData.goldenRule.text}
            </p>
          </div>
          <button
            onClick={handleCopyRule}
            className="shrink-0 p-2 rounded-lg bg-primary-foreground/10 hover:bg-primary-foreground/20 transition-all duration-200 hover:scale-110 active:scale-95"
            title="Скопировать"
          >
            {copiedRule ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Pyramid */}
      <div className="flex flex-col items-center gap-1 py-4">
        {layers.map((layer, index) => {
          const isSelected = selectedLevel === layer.level;
          const delay = index * 80;
          
          return (
            <button
              key={layer.level}
              onClick={() => onLayerSelect(layer.level)}
              style={{ 
                transitionDelay: mounted ? "0ms" : `${delay}ms`,
                animationDelay: `${delay}ms`
              }}
              className={`
                ${layer.width} py-3 md:py-4 px-4 md:px-6 rounded-sm
                bg-gradient-to-r ${layer.color}
                transition-all duration-300 ease-out
                hover:scale-[1.03] hover:shadow-lg hover:z-10
                active:scale-[0.98]
                ${isSelected 
                  ? "ring-2 ring-primary ring-offset-2 ring-offset-background scale-[1.03] shadow-xl z-10" 
                  : "hover:brightness-105"
                }
                ${mounted 
                  ? "opacity-100 translate-y-0" 
                  : "opacity-0 translate-y-4"
                }
                group relative
              `}
            >
              <div className="flex items-center justify-between">
                <div className="text-left">
                  <p className={`font-semibold text-sm md:text-base ${layer.textColor} transition-transform duration-200 group-hover:translate-x-1`}>
                    {layer.title}
                  </p>
                  <p className={`text-xs ${layer.textColor} opacity-70 transition-all duration-200 group-hover:opacity-100`}>
                    {layer.subtitle}
                  </p>
                </div>
                <ChevronRight 
                  className={`
                    w-5 h-5 ${layer.textColor} 
                    transition-all duration-300 
                    ${isSelected ? "opacity-100 translate-x-1" : "opacity-40 group-hover:opacity-100 group-hover:translate-x-1"}
                  `} 
                />
              </div>
              
              {/* Selection indicator */}
              {isSelected && (
                <div className="absolute -right-1 top-1/2 -translate-y-1/2 w-2 h-8 bg-primary rounded-full animate-pulse" />
              )}
            </button>
          );
        })}
      </div>

      <p className={`
        text-center text-sm text-muted-foreground
        transition-all duration-500 delay-500
        ${mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2"}
      `}>
        Нажмите на слой пирамиды, чтобы узнать подробнее
      </p>
    </div>
  );
}
