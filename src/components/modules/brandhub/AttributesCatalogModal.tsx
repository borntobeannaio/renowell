import { Package, Wrench, Star, Plus } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { brandData } from "./BrandHubData";

interface AttributesCatalogModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AttributesCatalogModal({ open, onOpenChange }: AttributesCatalogModalProps) {
  const categories = [
    { id: "product", label: "Продуктовые", icon: Package, data: brandData.attributes.product },
    { id: "service", label: "Сервисные", icon: Wrench, data: brandData.attributes.service },
    { id: "reputation", label: "Репутационные", icon: Star, data: brandData.attributes.reputation },
    { id: "additional", label: "Дополнительные", icon: Plus, data: brandData.attributes.additional }
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Каталог атрибутов бренда</DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="product" className="flex-1 overflow-hidden flex flex-col">
          <TabsList className="grid grid-cols-4 mb-4">
            {categories.map(({ id, label, icon: Icon }) => (
              <TabsTrigger key={id} value={id} className="gap-1 text-xs sm:text-sm">
                <Icon className="w-4 h-4" />
                <span className="hidden sm:inline">{label}</span>
              </TabsTrigger>
            ))}
          </TabsList>

          {categories.map(({ id, label, data }) => (
            <TabsContent key={id} value={id} className="flex-1 overflow-y-auto">
              <div className="space-y-4">
                <h3 className="font-semibold text-lg">{label} атрибуты</h3>
                <div className="grid gap-3">
                  {data.map((attr, i) => (
                    <div
                      key={i}
                      className="p-4 rounded-lg bg-secondary/50 hover:bg-secondary transition-colors"
                    >
                      <div className="flex items-start gap-3">
                        <span className="w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold shrink-0">
                          {i + 1}
                        </span>
                        <p className="text-foreground">{attr}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </TabsContent>
          ))}
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
