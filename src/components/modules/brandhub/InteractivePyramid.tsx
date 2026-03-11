import { useState, useEffect } from "react";
import { ChevronRight, Sparkles } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import { brandData } from "./BrandHubData";

interface InteractivePyramidProps {
  onLayerSelect: (level: number) => void;
  selectedLevel: number | null;
}

export function InteractivePyramid({ onLayerSelect, selectedLevel }: InteractivePyramidProps) {
  const [mounted, setMounted] = useState(false);
  const [hoveredLayer, setHoveredLayer] = useState<number | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Gradients using brand complementary colors: 
  // Primary #052A6E (deep blue) → complement: warm gold/amber tones
  // Accent #F1502C (orange) → complement: teal/cyan tones  
  // Brown #341715 → complement: sage/olive tones
  const layers = [
    { 
      level: 1, 
      title: "Суть бренда", 
      subtitle: "Золотое правило",
      gradient: "from-primary via-primary/90 to-primary/70",
      glowColor: "shadow-primary/40",
      width: "w-[40%]",
      icon: "✦"
    },
    { 
      level: 2, 
      title: "Позиционирование", 
      subtitle: "Кто мы и для кого",
      gradient: "from-accent via-accent/90 to-amber-500",
      glowColor: "shadow-accent/40",
      width: "w-[52%]",
      icon: "◆"
    },
    { 
      level: 3, 
      title: "Характер и Тональность", 
      subtitle: "Как мы себя ведём",
      gradient: "from-teal-600 via-cyan-600 to-sky-600",
      glowColor: "shadow-teal-500/40",
      width: "w-[64%]",
      icon: "●"
    },
    { 
      level: 4, 
      title: "Ценности", 
      subtitle: "Во что мы верим",
      gradient: "from-amber-600 via-orange-500 to-accent/80",
      glowColor: "shadow-amber-500/40",
      width: "w-[76%]",
      icon: "◈"
    },
    { 
      level: 5, 
      title: "Польза", 
      subtitle: "Что получает клиент",
      gradient: "from-primary/80 via-blue-600 to-cyan-600",
      glowColor: "shadow-blue-500/40",
      width: "w-[88%]",
      icon: "▲"
    },
    { 
      level: 6, 
      title: "Атрибуты", 
      subtitle: "Конкретные доказательства",
      gradient: "from-stone-600 via-stone-500 to-amber-700/60",
      glowColor: "shadow-stone-500/30",
      width: "w-full",
      icon: "■"
    },
  ];

  return (
    <div className="space-y-8">
      {/* Golden Rule - Premium Card */}
      <div 
        className={`
          relative overflow-hidden rounded-2xl
          bg-gradient-to-br from-primary via-primary/95 to-blue-800 
          p-6 md:p-8 text-primary-foreground
          transition-all duration-700 ease-out
          ${mounted ? "opacity-100 translate-y-0 scale-100" : "opacity-0 -translate-y-8 scale-95"}
          hover:shadow-2xl hover:shadow-primary/30
          group cursor-default
        `}
      >
        {/* Animated background pattern */}
        <div className="absolute inset-0 opacity-20">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.2),transparent_50%)]" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_80%,rgba(255,255,255,0.15),transparent_50%)]" />
          <div className="absolute top-0 left-0 w-full h-full bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmZmZmYiIGZpbGwtb3BhY2l0eT0iMC4wNSI+PHBhdGggZD0iTTM2IDM0djZoNnYtNmgtNnptMCAwdi02aC02djZoNnptLTYgNnY2aDZ2LTZoLTZ6bTYgMGg2djZoLTZ2LTZ6Ii8+PC9nPjwvZz48L3N2Zz4=')] animate-[pulse_4s_ease-in-out_infinite]" />
        </div>
        
        {/* Floating sparkles */}
        <Sparkles className="absolute top-4 right-4 w-5 h-5 text-white/30 animate-pulse" />
        <Sparkles className="absolute bottom-6 left-6 w-4 h-4 text-white/20 animate-pulse delay-500" />
        
        <div className="relative">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-2xl">✦</span>
            <p className="text-sm uppercase tracking-[0.2em] font-medium text-white/80">
              Золотое правило Renowell
            </p>
          </div>
          <p className="text-lg md:text-xl font-medium leading-relaxed tracking-wide group-hover:tracking-wider transition-all duration-500">
            {brandData.goldenRule.text}
          </p>
          <p className="mt-4 text-sm text-white/60 italic">
            {brandData.goldenRule.subtext}
          </p>
        </div>
        
        {/* Bottom gradient line */}
        <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-white/30 to-transparent" />
      </div>

      {/* Pyramid */}
      <div className="flex flex-col items-center gap-2 py-6 perspective-1000">
        {layers.map((layer, index) => {
          const isSelected = selectedLevel === layer.level;
          const isHovered = hoveredLayer === layer.level;
          const delay = index * 100;
          
          return (
            <button
              key={layer.level}
              onClick={() => onLayerSelect(layer.level)}
              onMouseEnter={() => setHoveredLayer(layer.level)}
              onMouseLeave={() => setHoveredLayer(null)}
              style={{ 
                animationDelay: `${delay}ms`
              }}
              className={`
                ${layer.width} py-4 md:py-5 px-5 md:px-8
                rounded-xl md:rounded-2xl
                bg-gradient-to-r ${layer.gradient}
                text-white font-medium
                transition-all duration-500 ease-out
                transform-gpu
                ${mounted 
                  ? "opacity-100 translate-y-0" 
                  : "opacity-0 translate-y-8"
                }
                ${isSelected 
                  ? `scale-[1.05] shadow-2xl ${layer.glowColor} z-20 ring-2 ring-white/50 ring-offset-2 ring-offset-background` 
                  : isHovered
                    ? `scale-[1.03] shadow-xl ${layer.glowColor} z-10`
                    : "hover:scale-[1.02] shadow-lg hover:shadow-xl"
                }
                group relative overflow-hidden
              `}
            >
              {/* Shine effect */}
              <div className={`
                absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent
                -translate-x-full group-hover:translate-x-full
                transition-transform duration-1000 ease-in-out
              `} />
              
              {/* Glow overlay */}
              <div className={`
                absolute inset-0 bg-gradient-to-t from-black/20 to-white/10
                opacity-0 group-hover:opacity-100 transition-opacity duration-300
              `} />
              
              <div className="relative flex items-center justify-between">
                <div className="text-left flex items-center gap-3">
                  <span className={`
                    text-lg opacity-60 group-hover:opacity-100 
                    transition-all duration-300
                    ${isSelected ? "scale-125" : "group-hover:scale-110"}
                  `}>
                    {layer.icon}
                  </span>
                  <div>
                    <p className={`
                      font-bold text-sm md:text-base tracking-wide
                      transition-all duration-300 
                      ${isSelected || isHovered ? "translate-x-1" : ""}
                    `}>
                      {layer.title}
                    </p>
                    <p className={`
                      text-xs text-white/70 
                      transition-all duration-300
                      ${isSelected || isHovered ? "text-white/90" : ""}
                    `}>
                      {layer.subtitle}
                    </p>
                  </div>
                </div>
                <ChevronRight 
                  className={`
                    w-5 h-5
                    transition-all duration-300 
                    ${isSelected 
                      ? "opacity-100 translate-x-1" 
                      : "opacity-50 group-hover:opacity-100 group-hover:translate-x-2"
                    }
                  `} 
                />
              </div>
              
              {/* Selection pulse */}
              {isSelected && (
                <div className="absolute -right-1 top-1/2 -translate-y-1/2 w-1.5 h-10 bg-white rounded-full animate-pulse" />
              )}
            </button>
          );
        })}
      </div>

      <p className={`
        text-center text-sm text-muted-foreground/80
        transition-all duration-700 delay-700
        ${mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"}
      `}>
        Нажмите на слой пирамиды для детальной информации
      </p>
    </div>
  );
}