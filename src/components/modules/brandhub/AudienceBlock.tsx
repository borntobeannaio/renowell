import { Users, User } from "lucide-react";
import { BrandCard } from "./BrandCard";
import { brandData } from "./BrandHubData";

export function AudienceBlock() {
  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold">Для кого</h2>
      <div className="grid md:grid-cols-2 gap-4">
        {brandData.audiences.map((audience, idx) => (
          <BrandCard
            key={audience.id}
            title={audience.title}
            icon={idx === 0 ? <User className="w-5 h-5 text-accent" /> : <Users className="w-5 h-5 text-accent" />}
            expandable
            defaultExpanded
          >
            <p className="text-muted-foreground mb-3">{audience.description}</p>
            <div className="space-y-2">
              <p className="text-sm font-medium text-foreground">Что им важно:</p>
              <ul className="space-y-1">
                {audience.needs.map((need, i) => (
                  <li key={i} className="flex items-center gap-2 text-sm text-muted-foreground">
                    <span className="w-1.5 h-1.5 rounded-full bg-accent shrink-0" />
                    {need}
                  </li>
                ))}
              </ul>
            </div>
          </BrandCard>
        ))}
      </div>
    </div>
  );
}
