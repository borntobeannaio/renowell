import { useState } from "react";
import { Package, Wrench, Star, Plus, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { brandData } from "./BrandHubData";

type AttributeCategory = "product" | "service" | "reputation" | "additional";

interface AttributesBlockProps {
  onOpenCatalog: () => void;
}

export function AttributesBlock({ onOpenCatalog }: AttributesBlockProps) {
  const [selectedCategory, setSelectedCategory] = useState<AttributeCategory>("product");

  const categories: { id: AttributeCategory; label: string; icon: React.ElementType }[] = [
    { id: "product", label: "Продуктовые", icon: Package },
    { id: "service", label: "Сервисные", icon: Wrench },
    { id: "reputation", label: "Репутационные", icon: Star },
    { id: "additional", label: "Дополнительные", icon: Plus }
  ];

  const currentAttributes = brandData.attributes[selectedCategory];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h2 className="text-xl font-semibold">Атрибуты бренда</h2>
        <Button variant="outline" size="sm" onClick={onOpenCatalog}>
          Открыть каталог
          <ChevronRight className="w-4 h-4 ml-1" />
        </Button>
      </div>

      <div className="flex flex-wrap gap-2">
        {categories.map(({ id, label, icon: Icon }) => (
          <Button
            key={id}
            variant={selectedCategory === id ? "default" : "outline"}
            size="sm"
            onClick={() => setSelectedCategory(id)}
            className="gap-2"
          >
            <Icon className="w-4 h-4" />
            <span className="hidden sm:inline">{label}</span>
          </Button>
        ))}
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">
            {categories.find(c => c.id === selectedCategory)?.label} атрибуты
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {currentAttributes.map((attr, i) => (
              <Badge key={i} variant="secondary" className="px-3 py-1.5">
                {attr}
              </Badge>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
