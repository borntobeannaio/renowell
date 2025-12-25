import { useState } from "react";
import { brandData } from "./BrandHubData";

interface PyramidBlockProps {
  onLayerClick: (level: number) => void;
}

export function PyramidBlock({ onLayerClick }: PyramidBlockProps) {
  const [hoveredLevel, setHoveredLevel] = useState<number | null>(null);

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold">Пирамида бренда</h2>
      <p className="text-sm text-muted-foreground">Кликните на слой, чтобы узнать больше</p>

      <div className="relative max-w-2xl mx-auto py-8">
        {/* Pyramid layers */}
        <div className="flex flex-col items-center gap-1">
          {brandData.pyramid.map((layer, idx) => {
            const widthPercent = 30 + idx * 17.5;
            const isHovered = hoveredLevel === layer.level;
            
            return (
              <div
                key={layer.level}
                className={`
                  relative cursor-pointer transition-all duration-300
                  ${isHovered ? "scale-105 z-10" : ""}
                `}
                style={{ width: `${widthPercent}%` }}
                onMouseEnter={() => setHoveredLevel(layer.level)}
                onMouseLeave={() => setHoveredLevel(null)}
                onClick={() => onLayerClick(layer.level)}
              >
                <div
                  className={`
                    py-3 px-4 text-center rounded-sm
                    transition-all duration-300
                    ${layer.level === 1 
                      ? "bg-primary text-primary-foreground" 
                      : layer.level === 2 
                        ? "bg-accent text-accent-foreground"
                        : layer.level === 3
                          ? "bg-secondary text-secondary-foreground"
                          : "bg-muted text-muted-foreground"
                    }
                    ${isHovered ? "shadow-lg ring-2 ring-primary/30" : ""}
                  `}
                >
                  <p className="font-semibold text-xs md:text-sm">{layer.title}</p>
                  {isHovered && (
                    <p className="text-xs mt-1 opacity-80 animate-in fade-in">
                      {layer.description}
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Legend */}
        <div className="mt-8 grid grid-cols-2 md:grid-cols-5 gap-2 text-xs">
          {brandData.pyramid.map((layer) => (
            <div 
              key={layer.level}
              className="flex items-center gap-2 p-2 rounded bg-secondary/30 cursor-pointer hover:bg-secondary/50 transition-colors"
              onClick={() => onLayerClick(layer.level)}
            >
              <span className="w-3 h-3 rounded-sm bg-primary/20 flex items-center justify-center text-[10px] font-bold">
                {layer.level}
              </span>
              <span className="truncate">{layer.title}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
