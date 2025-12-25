import { X, Copy, Check } from "lucide-react";
import { useState, useEffect } from "react";
import { brandData } from "./BrandHubData";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";

interface DetailPanelProps {
  level: number;
  isQuickMode: boolean;
  onClose: () => void;
}

export function DetailPanel({ level, isQuickMode, onClose }: DetailPanelProps) {
  const [copied, setCopied] = useState<string | null>(null);
  const [contentKey, setContentKey] = useState(level);
  const [isAnimating, setIsAnimating] = useState(false);

  // Animate content change
  useEffect(() => {
    if (level !== contentKey) {
      setIsAnimating(true);
      const timer = setTimeout(() => {
        setContentKey(level);
        setIsAnimating(false);
      }, 150);
      return () => clearTimeout(timer);
    }
  }, [level, contentKey]);

  const handleCopy = async (text: string, id: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(id);
      toast.success("Скопировано");
      setTimeout(() => setCopied(null), 2000);
    } catch {
      toast.error("Не удалось скопировать");
    }
  };

  const CopyBtn = ({ text, id }: { text: string; id: string }) => (
    <button
      onClick={() => handleCopy(text, id)}
      className="shrink-0 p-1.5 rounded hover:bg-muted transition-all duration-200 hover:scale-110 active:scale-95"
      title="Скопировать"
    >
      {copied === id ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5 text-muted-foreground" />}
    </button>
  );

  const renderContent = () => {
    switch (level) {
      case 1: // Суть бренда
        return (
          <div className="space-y-4">
            <div>
              <h3 className="font-semibold text-lg mb-2">Золотое правило Renowell</h3>
              <div className="flex items-start gap-2 p-4 bg-primary/10 rounded-lg">
                <p className="text-foreground leading-relaxed flex-1">{brandData.goldenRule.text}</p>
                <CopyBtn text={brandData.goldenRule.text} id="golden" />
              </div>
              {!isQuickMode && (
                <p className="text-sm text-muted-foreground mt-2 italic">{brandData.goldenRule.subtext}</p>
              )}
            </div>
          </div>
        );

      case 2: // Позиционирование
        return (
          <div className="space-y-6">
            {[brandData.positioning, brandData.vision, brandData.mission].map((item) => (
              <div key={item.title}>
                <h3 className="font-semibold mb-2">{item.title}</h3>
                <div className="flex items-start gap-2 p-3 bg-secondary/50 rounded-lg">
                  <p className="text-sm text-foreground flex-1">{item.text}</p>
                  <CopyBtn text={item.text} id={item.title} />
                </div>
              </div>
            ))}
            
            {!isQuickMode && (
              <div>
                <h3 className="font-semibold mb-3">Целевая аудитория</h3>
                <div className="space-y-3">
                  {brandData.audiences.map((aud) => (
                    <div key={aud.id} className="p-3 bg-muted/50 rounded-lg">
                      <p className="font-medium text-sm">{aud.title}</p>
                      <p className="text-xs text-muted-foreground mb-2">{aud.description}</p>
                      <ul className="space-y-1">
                        {aud.needs.map((need, i) => (
                          <li key={i} className="text-xs text-muted-foreground flex items-center gap-2">
                            <span className="w-1 h-1 rounded-full bg-primary" />
                            {need}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        );

      case 3: // Характер и Тональность
        return (
          <div className="space-y-6">
            <div>
              <h3 className="font-semibold mb-3">Характер</h3>
              <div className="space-y-2">
                {brandData.character.map((item) => (
                  <div key={item.id} className="flex items-start gap-3 p-3 bg-secondary/50 rounded-lg">
                    <div className="w-2 h-2 rounded-full bg-primary shrink-0 mt-1.5" />
                    <div>
                      <p className="font-medium text-sm">{item.title}</p>
                      {!isQuickMode && <p className="text-xs text-muted-foreground">{item.description}</p>}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <h3 className="font-semibold mb-3">Тональность</h3>
              <div className="flex flex-wrap gap-2 mb-3">
                {brandData.tonality.map((item) => (
                  <Badge key={item.id} variant="outline" className="px-3 py-1">
                    {item.title}
                  </Badge>
                ))}
              </div>
              {!isQuickMode && (
                <div className="space-y-2">
                  {brandData.tonality.map((item) => (
                    <p key={item.id} className="text-sm">
                      <span className="font-medium">{item.title}:</span>{" "}
                      <span className="text-muted-foreground">{item.description}</span>
                    </p>
                  ))}
                </div>
              )}
            </div>
          </div>
        );

      case 4: // Ценности
        return (
          <div className="space-y-4">
            <h3 className="font-semibold mb-3">Ценности компании</h3>
            <div className="space-y-3">
              {brandData.values.map((value) => (
                <div key={value.id} className="p-4 bg-secondary/50 rounded-lg">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-semibold">{value.title}</span>
                    <Badge variant="secondary" className="text-xs">{value.tag}</Badge>
                  </div>
                  {!isQuickMode && (
                    <p className="text-sm text-muted-foreground">{value.description}</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        );

      case 5: // Польза
        return (
          <div className="space-y-6">
            <div>
              <h3 className="font-semibold mb-3">Рациональная польза</h3>
              <div className="space-y-3">
                {brandData.benefits.rational.map((benefit) => (
                  <div key={benefit.id} className="p-3 bg-primary/5 rounded-lg border-l-2 border-primary">
                    <p className="font-medium text-sm mb-2">{benefit.title}</p>
                    {!isQuickMode && (
                      <ul className="space-y-1">
                        {benefit.items.map((item, i) => (
                          <li key={i} className="text-xs text-muted-foreground flex items-start gap-2">
                            <span className="w-1 h-1 rounded-full bg-primary shrink-0 mt-1.5" />
                            {item}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div>
              <h3 className="font-semibold mb-3">Эмоциональная польза</h3>
              <div className="space-y-3">
                {brandData.benefits.emotional.map((benefit) => (
                  <div key={benefit.id} className="p-3 bg-accent/5 rounded-lg border-l-2 border-accent">
                    <p className="font-medium text-sm mb-2">{benefit.title}</p>
                    {!isQuickMode && (
                      <ul className="space-y-1">
                        {benefit.items.map((item, i) => (
                          <li key={i} className="text-xs text-muted-foreground flex items-start gap-2">
                            <span className="w-1 h-1 rounded-full bg-accent shrink-0 mt-1.5" />
                            {item}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        );

      case 6: // Атрибуты
        return (
          <div className="space-y-6">
            {[
              { key: "product", title: "Продуктовые", data: brandData.attributes.product },
              { key: "service", title: "Сервисные", data: brandData.attributes.service },
              { key: "reputation", title: "Репутационные", data: brandData.attributes.reputation },
              { key: "additional", title: "Дополнительные", data: brandData.attributes.additional },
            ].map(({ key, title, data }) => (
              <div key={key}>
                <h3 className="font-semibold mb-2 text-sm">{title}</h3>
                <div className="flex flex-wrap gap-2">
                  {data.map((attr, i) => (
                    <Badge key={i} variant="secondary" className="text-xs">
                      {attr}
                    </Badge>
                  ))}
                </div>
              </div>
            ))}
          </div>
        );

      default:
        return null;
    }
  };

  const titles: Record<number, string> = {
    1: "Суть бренда",
    2: "Позиционирование",
    3: "Характер и Тональность",
    4: "Ценности",
    5: "Польза для клиента",
    6: "Атрибуты бренда",
  };

  return (
    <div className="h-full flex flex-col bg-card border-l border-border animate-in slide-in-from-right-5 duration-300">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-border">
        <h2 
          key={level}
          className="font-semibold text-lg animate-in fade-in slide-in-from-left-2 duration-200"
        >
          {titles[level]}
        </h2>
        <button
          onClick={onClose}
          className="p-2 hover:bg-muted rounded-lg transition-all duration-200 hover:rotate-90"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Content */}
      <div 
        key={contentKey}
        className={`
          flex-1 overflow-y-auto p-4
          transition-all duration-200
          ${isAnimating ? "opacity-0 translate-x-4" : "opacity-100 translate-x-0"}
        `}
      >
        {renderContent()}
      </div>
    </div>
  );
}
