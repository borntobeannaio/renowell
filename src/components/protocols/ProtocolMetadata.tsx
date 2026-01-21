import { useState } from "react";
import { ChevronDown, ChevronUp, Info } from "lucide-react";
import { EmployeeMultiSelect } from "@/components/ui/EmployeeMultiSelect";

interface ProtocolMetadataProps {
  form: {
    date: string;
    title: string;
    organizer_id: string;
    attendee_ids: string[];
  };
  onChange: (updates: Partial<ProtocolMetadataProps["form"]>) => void;
  employees: { id: string; full_name: string; position: string; avatar_url: string | null; phone: string | null; email: string | null; department: string | null; birthday: string | null; profile_id: string | null }[];
  protocolNumber: number;
  isEditMode?: boolean;
  defaultCollapsed?: boolean;
}

export function ProtocolMetadata({
  form,
  onChange,
  employees,
  protocolNumber,
  isEditMode = false,
  defaultCollapsed = false,
}: ProtocolMetadataProps) {
  const [isCollapsed, setIsCollapsed] = useState(defaultCollapsed);

  return (
    <section className="card-base overflow-hidden">
      {/* Collapsible header */}
      <button
        onClick={() => setIsCollapsed(!isCollapsed)}
        className="w-full flex items-center justify-between p-4 hover:bg-muted/30 transition-colors"
      >
        <div className="flex items-center gap-3">
          <Info className="w-5 h-5 text-primary" />
          <h2 className="text-lg font-medium text-foreground">Информация о совещании</h2>
        </div>
        {isCollapsed ? (
          <ChevronDown className="w-5 h-5 text-muted-foreground" />
        ) : (
          <ChevronUp className="w-5 h-5 text-muted-foreground" />
        )}
      </button>

      {/* Content */}
      {!isCollapsed && (
        <div className="px-4 pb-4 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">Номер</label>
              <input
                type="number"
                value={protocolNumber}
                disabled
                className="input-base w-full bg-muted"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">Дата</label>
              <input
                type="date"
                value={form.date}
                onChange={(e) => onChange({ date: e.target.value })}
                className="input-base w-full"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">Тема совещания</label>
            <input
              type="text"
              value={form.title}
              onChange={(e) => onChange({ title: e.target.value })}
              className="input-base w-full"
              placeholder="Введите тему"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">Организатор</label>
            <EmployeeMultiSelect
              employees={employees}
              selectedIds={form.organizer_id ? [form.organizer_id] : []}
              onChange={(ids) => onChange({ organizer_id: ids[0] || "" })}
              placeholder="Выберите организатора"
              single
              usePortal
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">Участники</label>
            <EmployeeMultiSelect
              employees={employees}
              selectedIds={form.attendee_ids}
              onChange={(ids) => onChange({ attendee_ids: ids })}
              placeholder="Выберите участников"
              usePortal
            />
          </div>
        </div>
      )}
    </section>
  );
}
