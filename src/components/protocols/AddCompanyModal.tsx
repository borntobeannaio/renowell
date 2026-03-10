import { useState } from "react";
import { Building, Check, X } from "lucide-react";
import { Modal } from "@/components/ui/Modal";

interface AddCompanyModalProps {
  open: boolean;
  onClose: () => void;
  onAdd: (companyName: string) => void;
}

export function AddCompanyModal({ open, onClose, onAdd }: AddCompanyModalProps) {
  const [name, setName] = useState("");

  const handleSubmit = () => {
    if (name.trim()) {
      onAdd(name.trim());
      setName("");
      onClose();
    }
  };

  return (
    <Modal isOpen={open} onClose={onClose} title="Добавить компанию">
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <Building className="w-5 h-5 text-blue-600 shrink-0" />
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleSubmit();
              if (e.key === "Escape") onClose();
            }}
            className="input-base flex-1"
            placeholder="Название компании"
            autoFocus
          />
        </div>
        <div className="flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-muted-foreground hover:bg-secondary rounded-lg transition-colors flex items-center gap-2"
          >
            <X className="w-4 h-4" />
            Отмена
          </button>
          <button
            onClick={handleSubmit}
            disabled={!name.trim()}
            className="px-4 py-2 text-sm bg-primary text-primary-foreground rounded-lg transition-colors flex items-center gap-2 disabled:opacity-50"
          >
            <Check className="w-4 h-4" />
            Добавить
          </button>
        </div>
      </div>
    </Modal>
  );
}
