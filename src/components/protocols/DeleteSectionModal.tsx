import { useState } from "react";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { SectionType } from "@/hooks/useProtocolSections";

interface SectionOption {
  id: string;
  sectionType: SectionType;
  entityName: string | null;
  displayName: string;
}

interface DeleteSectionModalProps {
  open: boolean;
  onClose: () => void;
  sectionName: string;
  itemsCount: number;
  otherSections: SectionOption[];
  onDeleteWithItems: () => void;
  onMoveItems: (targetSectionId: string) => void;
}

export function DeleteSectionModal({
  open,
  onClose,
  sectionName,
  itemsCount,
  otherSections,
  onDeleteWithItems,
  onMoveItems,
}: DeleteSectionModalProps) {
  const [selectedTargetId, setSelectedTargetId] = useState<string>("");
  const [action, setAction] = useState<"delete" | "move">("move");

  const handleConfirm = () => {
    if (action === "delete") {
      onDeleteWithItems();
    } else if (action === "move" && selectedTargetId) {
      onMoveItems(selectedTargetId);
    }
    onClose();
  };

  const canConfirm = action === "delete" || (action === "move" && selectedTargetId);

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-amber-500" />
            Удаление секции
          </DialogTitle>
          <DialogDescription>
            Секция «{sectionName}» содержит {itemsCount} пункт(ов). Что сделать с ними?
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <label className="flex items-start gap-3 p-3 rounded-lg border border-border hover:bg-muted/50 cursor-pointer transition-colors">
            <input
              type="radio"
              name="action"
              value="move"
              checked={action === "move"}
              onChange={() => setAction("move")}
              className="mt-1"
            />
            <div className="flex-1">
              <div className="font-medium text-sm">Переместить в другую секцию</div>
              <p className="text-xs text-muted-foreground mt-1">
                Пункты будут перемещены в выбранную секцию
              </p>
              {action === "move" && (
                <select
                  value={selectedTargetId}
                  onChange={(e) => setSelectedTargetId(e.target.value)}
                  className="mt-2 input-base w-full text-sm"
                >
                  <option value="">Выберите секцию...</option>
                  {otherSections.map((section) => (
                    <option key={section.id} value={section.id}>
                      {section.displayName}
                    </option>
                  ))}
                </select>
              )}
            </div>
          </label>

          <label className="flex items-start gap-3 p-3 rounded-lg border border-destructive/30 hover:bg-destructive/5 cursor-pointer transition-colors">
            <input
              type="radio"
              name="action"
              value="delete"
              checked={action === "delete"}
              onChange={() => setAction("delete")}
              className="mt-1"
            />
            <div className="flex-1">
              <div className="font-medium text-sm text-destructive">Удалить вместе с пунктами</div>
              <p className="text-xs text-muted-foreground mt-1">
                Секция и все её пункты будут безвозвратно удалены
              </p>
            </div>
          </label>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Отмена
          </Button>
          <Button
            variant={action === "delete" ? "destructive" : "default"}
            onClick={handleConfirm}
            disabled={!canConfirm}
          >
            {action === "delete" ? "Удалить всё" : "Переместить"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
