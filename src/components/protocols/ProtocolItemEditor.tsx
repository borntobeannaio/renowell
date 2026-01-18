import { useState } from "react";
import { Trash2, CheckCircle2, GripVertical } from "lucide-react";
import { EmployeeMultiSelect } from "@/components/ui/EmployeeMultiSelect";

export interface ProtocolItemData {
  id: string;
  project_id: string | null;
  item_text: string;
  responsible: string | null;
  due_date: string | null;
  create_task: boolean;
  task_id?: string | null;
}

interface ProtocolItemEditorProps {
  item: ProtocolItemData;
  employees: { id: string; full_name: string; position: string; avatar_url: string | null; phone: string | null; email: string | null; department: string | null; birthday: string | null; profile_id: string | null }[];
  onUpdate: (updates: Partial<ProtocolItemData>) => void;
  onRemove: () => void;
  showDragHandle?: boolean;
  disabled?: boolean;
}

export function ProtocolItemEditor({
  item,
  employees,
  onUpdate,
  onRemove,
  showDragHandle = false,
  disabled = false,
}: ProtocolItemEditorProps) {
  // Convert responsible string to employee IDs
  const getEmployeeIdsFromResponsible = (responsible: string | null): string[] => {
    if (!responsible) return [];
    const names = responsible.split(", ").map(n => n.trim());
    return names
      .map(name => employees.find(e => e.full_name === name)?.id)
      .filter(Boolean) as string[];
  };

  const handleResponsibleChange = (ids: string[]) => {
    const responsibleNames = ids
      .map(id => employees.find(e => e.id === id)?.full_name)
      .filter(Boolean)
      .join(", ");
    onUpdate({ responsible: responsibleNames || null });
  };

  return (
    <div className="p-3 bg-secondary/50 rounded-lg space-y-3 border border-border/50">
      {/* Item text row */}
      <div className="flex items-start gap-2">
        {showDragHandle && (
          <button className="p-1 cursor-grab text-muted-foreground hover:text-foreground shrink-0 mt-1.5">
            <GripVertical className="w-4 h-4" />
          </button>
        )}
        <input
          type="text"
          value={item.item_text}
          onChange={(e) => onUpdate({ item_text: e.target.value })}
          className="input-base flex-1"
          placeholder="Текст пункта"
          disabled={disabled}
        />
        <button
          type="button"
          onClick={onRemove}
          className="p-2 text-destructive/60 hover:text-destructive hover:bg-destructive/10 rounded-lg shrink-0 transition-colors"
          disabled={disabled}
          title="Удалить пункт"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>

      {/* Controls row */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs text-muted-foreground mb-1">Ответственные</label>
          <EmployeeMultiSelect
            employees={employees}
            selectedIds={getEmployeeIdsFromResponsible(item.responsible)}
            onChange={handleResponsibleChange}
            placeholder="Выберите ответственных"
          />
        </div>
        <div>
          <label className="block text-xs text-muted-foreground mb-1">Срок</label>
          <input
            type="date"
            value={item.due_date || ""}
            onChange={(e) => onUpdate({ due_date: e.target.value || null })}
            className="input-base w-full"
            disabled={disabled}
          />
        </div>
      </div>

      {/* Task checkbox */}
      <div className="flex items-center justify-between">
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={item.create_task}
            onChange={(e) => onUpdate({ create_task: e.target.checked })}
            className="w-4 h-4 rounded border-input text-primary focus:ring-ring"
            disabled={disabled}
          />
          <span className="text-sm text-muted-foreground">
            Создать задачу на канбан
          </span>
        </label>
        {item.task_id && (
          <span className="chip-success shrink-0 flex items-center gap-1 text-xs">
            <CheckCircle2 className="w-3 h-3" />
            Задача создана
          </span>
        )}
      </div>
    </div>
  );
}
