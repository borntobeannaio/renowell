import { X, Copy, Check, Sparkles } from "lucide-react";
import { useState, useEffect } from "react";
import { brandData } from "./BrandHubData";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";

interface DetailPanelProps {
  level: number;
  isQuickMode: boolean;
  onClose: () => void;
}

// Complementary colors to brand: #052A6E (blue), #F1502C (orange), #341715 (brown)
// Blue → warm amber/gold, Orange → teal/cyan, Brown → sage/olive
const levelThemes: Record<number, { gradient: string; accent: string; icon: string }> = {
  1: { gradient: "from-primary/20 via-primary/10 to-transparent", accent: "text-primary", icon: "✦" },
  2: { gradient: "from-accent/20 via-accent/10 to-transparent", accent: "text-accent", icon: "◆" },
  3: { gradient: "from-teal-500/20 via-cyan-500/10 to-transparent", accent: "text-teal-600", icon: "●" },
  4: { gradient: "from-amber-500/20 via-orange-500/10 to-transparent", accent: "text-amber-600", icon: "◈" },
  5: { gradient: "from-primary/15 via-cyan-500/10 to-transparent", accent: "text-primary", icon: "▲" },
  6: { gradient: "from-stone-500/20 via-amber-500/10 to-transparent", accent: "text-stone-600", icon: "■" },
};

export function DetailPanel({ level, isQuickMode, onClose }: DetailPanelProps) {
  const [copied, setCopied] = useState<string | null>(null);
  const [contentKey, setContentKey] = useState(level);
  const [isAnimating, setIsAnimating] = useState(false);

  const theme = levelThemes[level] || levelThemes[1];

  useEffect(() => {
    if (level !== contentKey) {
      setIsAnimating(true);
      const timer = setTimeout(() => {
        setContentKey(level);
        setIsAnimating(false);
      }, 200);
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
      className="shrink-0 p-2 rounded-lg bg-muted/50 hover:bg-muted transition-all duration-300 
                 hover:scale-110 active:scale-95 group/copy"
      title="Скопировать"
    >
      {copied === id 
        ? <Check className="w-4 h-4 text-emerald-500" /> 
        : <Copy className="w-4 h-4 text-muted-foreground group-hover/copy:text-foreground transition-colors" />
      }
    </button>
  );

  const SectionCard = ({ children, className = "" }: { children: React.ReactNode; className?: string }) => (
    <div className={`
      relative overflow-hidden rounded-xl p-4 
      bg-gradient-to-br from-card via-card to-muted/30
      border border-border/50 hover:border-border
      transition-all duration-300 hover:shadow-lg
      ${className}
    `}>
      {children}
    </div>
  );

  const renderContent = () => {
    switch (level) {
      case 1:
        return (
          <div className="space-y-6">
            <SectionCard className="bg-gradient-to-br from-primary/10 via-primary/5 to-transparent border-primary/20">
              <div className="flex items-center gap-2 mb-3">
                <Sparkles className="w-5 h-5 text-primary" />
                <h3 className="font-bold text-lg text-primary">Золотое правило</h3>
              </div>
              <div className="flex items-start gap-3">
                <p className="text-foreground leading-relaxed flex-1 text-base">{brandData.goldenRule.text}</p>
                <CopyBtn text={brandData.goldenRule.text} id="golden" />
              </div>
              <p className="text-sm text-muted-foreground mt-4 italic border-l-2 border-primary/30 pl-3">
                {brandData.goldenRule.subtext}
              </p>
            </SectionCard>
          </div>
        );

      case 2:
        return (
          <div className="space-y-5">
            {[brandData.positioning, brandData.vision, brandData.mission].map((item, idx) => (
              <SectionCard key={item.title}>
                <div className="flex items-center gap-2 mb-2">
                  <span className={`w-6 h-6 rounded-full bg-gradient-to-br from-accent to-orange-600 
                                   flex items-center justify-center text-white text-xs font-bold`}>
                    {idx + 1}
                  </span>
                  <h3 className="font-bold">{item.title}</h3>
                </div>
                <div className="flex items-start gap-2">
                  <p className="text-sm text-muted-foreground flex-1 leading-relaxed">{item.text}</p>
                  <CopyBtn text={item.text} id={item.title} />
                </div>
              </SectionCard>
            ))}
            
            <div className="mt-6">
              <h3 className="font-bold mb-4 flex items-center gap-2">
                <span className="text-accent">◆</span> Целевая аудитория
              </h3>
              <div className="grid gap-4">
                {brandData.audiences.map((aud) => (
                  <SectionCard key={aud.id} className="hover:scale-[1.01]">
                    <p className="font-semibold text-sm mb-1">{aud.title}</p>
                    <p className="text-xs text-muted-foreground mb-3">{aud.description}</p>
                    <div className="flex flex-wrap gap-2">
                      {aud.needs.map((need, i) => (
                        <Badge key={i} variant="secondary" className="text-xs bg-accent/10 text-accent border-accent/20">
                          {need}
                        </Badge>
                      ))}
                    </div>
                  </SectionCard>
                ))}
              </div>
            </div>
          </div>
        );

      case 3:
        return (
          <div className="space-y-6">
            <div>
              <h3 className="font-bold mb-4 flex items-center gap-2">
                <span className="text-teal-600">●</span> Характер
              </h3>
              <div className="grid gap-3">
                {brandData.character.map((item, idx) => (
                  <SectionCard key={item.id} className="group hover:scale-[1.01]">
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-teal-500 to-cyan-600 
                                      flex items-center justify-center text-white text-sm font-bold shrink-0
                                      group-hover:scale-110 transition-transform">
                        {idx + 1}
                      </div>
                      <div>
                        <p className="font-semibold text-sm">{item.title}</p>
                        <p className="text-xs text-muted-foreground mt-1">{item.description}</p>
                      </div>
                    </div>
                  </SectionCard>
                ))}
              </div>
            </div>

            <div>
              <h3 className="font-bold mb-4 flex items-center gap-2">
                <span className="text-teal-600">●</span> Тональность
              </h3>
              <div className="flex flex-wrap gap-2 mb-4">
                {brandData.tonality.map((item) => (
                  <Badge 
                    key={item.id} 
                    className="px-4 py-2 bg-gradient-to-r from-teal-500/10 to-cyan-500/10 
                               text-teal-600 dark:text-teal-400 border-teal-500/20
                               hover:scale-105 transition-transform cursor-default"
                  >
                    {item.title}
                  </Badge>
                ))}
              </div>
              <div className="space-y-2">
                {brandData.tonality.map((item) => (
                  <div key={item.id} className="flex items-baseline gap-2 text-sm">
                    <span className="font-semibold text-teal-600">{item.title}:</span>
                    <span className="text-muted-foreground">{item.description}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        );

      case 4:
        return (
          <div className="space-y-4">
            <h3 className="font-bold mb-4 flex items-center gap-2">
              <span className="text-amber-600">◈</span> Ценности компании
            </h3>
            <div className="grid gap-3">
              {brandData.values.map((value, idx) => (
                <SectionCard key={value.id} className="group hover:scale-[1.01]">
                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-orange-500 
                                    flex items-center justify-center text-white font-bold shrink-0
                                    group-hover:scale-110 group-hover:rotate-3 transition-all">
                      {idx + 1}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-bold">{value.title}</span>
                        <Badge className="text-xs bg-amber-500/10 text-amber-600 border-amber-500/20">
                          {value.tag}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">{value.description}</p>
                    </div>
                  </div>
                </SectionCard>
              ))}
            </div>
          </div>
        );

      case 5:
        return (
          <div className="space-y-6">
            <div>
              <h3 className="font-bold mb-4 flex items-center gap-2">
                <span className="text-primary">▲</span> Рациональная польза
              </h3>
              <div className="space-y-3">
                {brandData.benefits.rational.map((benefit) => (
                  <SectionCard 
                    key={benefit.id} 
                    className="border-l-4 border-l-primary hover:scale-[1.01]"
                  >
                    <p className="font-semibold text-sm mb-3 text-primary">{benefit.title}</p>
                    <div className="flex flex-wrap gap-2">
                      {benefit.items.map((item, i) => (
                        <Badge 
                          key={i} 
                          variant="secondary" 
                          className="text-xs bg-primary/10 text-primary"
                        >
                          {item}
                        </Badge>
                      ))}
                    </div>
                  </SectionCard>
                ))}
              </div>
            </div>

            <div>
              <h3 className="font-bold mb-4 flex items-center gap-2">
                <span className="text-accent">♥</span> Эмоциональная польза
              </h3>
              <div className="space-y-3">
                {brandData.benefits.emotional.map((benefit) => (
                  <SectionCard 
                    key={benefit.id} 
                    className="border-l-4 border-l-accent hover:scale-[1.01]"
                  >
                    <p className="font-semibold text-sm mb-3 text-accent">{benefit.title}</p>
                    <div className="flex flex-wrap gap-2">
                      {benefit.items.map((item, i) => (
                        <Badge 
                          key={i} 
                          variant="secondary" 
                          className="text-xs bg-accent/10 text-accent"
                        >
                          {item}
                        </Badge>
                      ))}
                    </div>
                  </SectionCard>
                ))}
              </div>
            </div>
          </div>
        );

      case 6:
        const attributeGroups = [
          { key: "product", title: "Продуктовые", data: brandData.attributes.product, color: "from-primary to-primary/70", textColor: "text-primary" },
          { key: "service", title: "Сервисные", data: brandData.attributes.service, color: "from-teal-500 to-cyan-500", textColor: "text-teal-600 dark:text-teal-400" },
          { key: "reputation", title: "Репутационные", data: brandData.attributes.reputation, color: "from-amber-500 to-orange-500", textColor: "text-amber-600 dark:text-amber-400" },
          { key: "additional", title: "Дополнительные", data: brandData.attributes.additional, color: "from-accent to-accent/70", textColor: "text-accent" },
        ];

        return (
          <div className="space-y-5">
            {attributeGroups.map(({ key, title, data, color, textColor }) => (
              <SectionCard key={key} className="hover:scale-[1.01]">
                <div className="flex items-center gap-2 mb-3">
                  <div className={`w-3 h-3 rounded-full bg-gradient-to-r ${color}`} />
                  <h3 className={`font-bold text-sm ${textColor}`}>{title}</h3>
                </div>
                <div className="flex flex-wrap gap-2">
                  {data.map((attr, i) => (
                    <Badge 
                      key={i} 
                      variant="secondary" 
                      className="text-xs hover:scale-105 transition-transform cursor-default"
                    >
                      {attr}
                    </Badge>
                  ))}
                </div>
              </SectionCard>
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
    <div className="h-full flex flex-col bg-card/95 backdrop-blur-xl border-l border-border/50 
                    animate-in slide-in-from-right-8 duration-500 ease-out">
      {/* Header with gradient */}
      <div className={`
        relative overflow-hidden
        flex items-center justify-between p-5 
        border-b border-border/50
        bg-gradient-to-r ${theme.gradient}
      `}>
        {/* Decorative elements */}
        <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-bl from-white/5 to-transparent rounded-bl-full" />
        
        <div className="flex items-center gap-3">
          <span className={`text-2xl ${theme.accent}`}>{theme.icon}</span>
          <h2 
            key={level}
            className="font-bold text-xl animate-in fade-in slide-in-from-left-4 duration-300"
          >
            {titles[level]}
          </h2>
        </div>
        <button
          onClick={onClose}
          className="relative z-10 p-2.5 hover:bg-muted/80 rounded-xl 
                     transition-all duration-300 hover:rotate-90 hover:scale-110
                     active:scale-95"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Content with smooth transitions */}
      <div 
        key={contentKey}
        className={`
          flex-1 overflow-y-auto p-5 scrollbar-thin
          transition-all duration-300 ease-out
          ${isAnimating ? "opacity-0 translate-x-8 scale-95" : "opacity-100 translate-x-0 scale-100"}
        `}
      >
        {renderContent()}
      </div>
    </div>
  );
}