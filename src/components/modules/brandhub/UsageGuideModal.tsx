import { FileQuestion, CheckCircle } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { brandData } from "./BrandHubData";

interface UsageGuideModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function UsageGuideModal({ open, onOpenChange }: UsageGuideModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileQuestion className="w-5 h-5" />
            Руководство по использованию
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          <div className="p-4 rounded-lg bg-primary/10 border border-primary/20">
            <p className="text-foreground font-medium">
              {brandData.usageGuide.purpose}
            </p>
          </div>

          <div>
            <h3 className="font-semibold mb-3">Рекомендации</h3>
            <div className="space-y-3">
              {brandData.usageGuide.recommendations.map((rec, i) => (
                <div
                  key={i}
                  className="flex items-start gap-3 p-3 rounded-lg bg-secondary/50"
                >
                  <CheckCircle className="w-5 h-5 text-green-500 shrink-0 mt-0.5" />
                  <p className="text-muted-foreground">{rec}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="p-4 rounded-lg bg-accent/10 border border-accent/20">
            <p className="text-sm text-muted-foreground">
              <span className="font-medium text-foreground">Контакт: </span>
              {brandData.usageGuide.contact}
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
