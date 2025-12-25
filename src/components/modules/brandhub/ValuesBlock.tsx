import { useState } from "react";
import { Shield, Eye, CheckCircle, Award, Handshake } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { brandData } from "./BrandHubData";

const valueIcons: Record<string, React.ElementType> = {
  safety: Shield,
  openness: Eye,
  responsibility: CheckCircle,
  professionalism: Award,
  collaboration: Handshake
};

export function ValuesBlock() {
  const [expandedValue, setExpandedValue] = useState<string | null>(null);

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold">Ценности</h2>
      
      <div className="flex flex-wrap gap-3">
        {brandData.values.map((value) => {
          const Icon = valueIcons[value.id] || Shield;
          const isExpanded = expandedValue === value.id;

          return (
            <div
              key={value.id}
              className={`
                transition-all duration-300 cursor-pointer
                ${isExpanded ? "w-full md:w-auto" : ""}
              `}
              onClick={() => setExpandedValue(isExpanded ? null : value.id)}
            >
              <Badge
                variant="outline"
                className={`
                  px-4 py-2.5 text-sm font-medium
                  flex items-center gap-2
                  hover:bg-secondary transition-colors
                  ${isExpanded ? "bg-secondary" : ""}
                `}
              >
                <Icon className="w-4 h-4" />
                <span>{value.title}</span>
                <span className="text-xs text-muted-foreground">({value.tag})</span>
              </Badge>
              
              {isExpanded && (
                <div className="mt-2 p-3 bg-secondary/50 rounded-lg text-sm text-muted-foreground animate-in fade-in slide-in-from-top-2">
                  {value.description}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
