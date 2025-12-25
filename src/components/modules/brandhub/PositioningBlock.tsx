import { Target, Eye, Rocket } from "lucide-react";
import { BrandCard } from "./BrandCard";
import { brandData } from "./BrandHubData";

export function PositioningBlock() {
  const items = [
    { data: brandData.positioning, icon: <Target className="w-5 h-5 text-primary" /> },
    { data: brandData.vision, icon: <Eye className="w-5 h-5 text-primary" /> },
    { data: brandData.mission, icon: <Rocket className="w-5 h-5 text-primary" /> }
  ];

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold">Позиционирование / Видение / Миссия</h2>
      <div className="grid md:grid-cols-3 gap-4">
        {items.map(({ data, icon }) => (
          <BrandCard
            key={data.title}
            title={data.title}
            icon={icon}
            copyText={data.text}
            className="h-full"
          >
            <p className="text-muted-foreground leading-relaxed">{data.text}</p>
          </BrandCard>
        ))}
      </div>
    </div>
  );
}
