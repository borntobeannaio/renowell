import { Lightbulb } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { brandData } from "./BrandHubData";

interface PrerequisitesModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function PrerequisitesModal({ open, onOpenChange }: PrerequisitesModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Lightbulb className="w-5 h-5" />
            Предпосылки платформы бренда
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          <p className="text-muted-foreground">
            Контекст и тренды, на которых строится позиционирование Renowell
          </p>

          {brandData.prerequisites.map((item, i) => (
            <div
              key={i}
              className="p-5 rounded-lg bg-gradient-to-br from-secondary/50 to-secondary/30 border border-border/50"
            >
              <h3 className="font-semibold text-lg text-foreground mb-2">{item.title}</h3>
              <p className="text-muted-foreground leading-relaxed">{item.description}</p>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
