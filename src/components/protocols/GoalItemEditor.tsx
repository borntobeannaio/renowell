import { Trash2, GripVertical, Target } from "lucide-react";
import { EmployeeMultiSelect } from "@/components/ui/EmployeeMultiSelect";

export interface GoalItemData {
  id: string;
  section_id: string | null;
  item_text: string;      // Goal/task text
  responsible: string | null;
  due_date: string | null;
  kpi: string | null;
  status: string | null;
  status_date: string | null;
  create_task: boolean;
  task_id?: string | null;
}

interface GoalItemEditorProps {
  item: GoalItemData;
  employees: { id: string; full_name: string; position: string; avatar_url: string | null; phone: string | null; email: string | null; department: string | null; birthday: string | null; profile_id: string | null }[];
  projectDefaultResponsible: string | null;
  onUpdate: (updates: Partial<GoalItemData>) => void;
  onRemove: () => void;
  showDragHandle?: boolean;
  disabled?: boolean;
}

export function GoalItemEditor({
  item,
  employees,
  projectDefaultResponsible,
  onUpdate,
  onRemove,
  showDragHandle = false,
  disabled = false,
}: GoalItemEditorProps) {
  const effectiveResponsible = item.responsible ?? projectDefaultResponsible;

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
    <div className="p-4 rounded-lg bg-gradient-to-r from-amber-500/5 to-orange-500/5 border border-amber-500/20 space-y-4">
      {/* Header row */}
      <div className="flex items-start gap-2">
        {showDragHandle && (
          <button className="p-1 cursor-grab text-muted-foreground hover:text-foreground shrink-0 mt-1.5">
            <GripVertical className="w-4 h-4" />
          </button>
        )}
        <Target className="w-5 h-5 text-amber-600 shrink-0 mt-1.5" />
        <div className="flex-1 space-y-3">
          {/* Goal text */}
          <div>
            <label className="block text-xs text-muted-foreground mb-1">Цель / Задача</label>
            <textarea
              value={item.item_text}
              onChange={(e) => onUpdate({ item_text: e.target.value })}
              className="input-base w-full resize-none"
              placeholder="Описание цели или задачи"
              rows={2}
              disabled={disabled}
            />
          </div>

          {/* Responsible and KPI row */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-muted-foreground mb-1">Ответственные</label>
              <EmployeeMultiSelect
                employees={employees}
                selectedIds={getEmployeeIdsFromResponsible(effectiveResponsible)}
                onChange={handleResponsibleChange}
                placeholder="Выберите ответственных"
                usePortal={true}
              />
            </div>
            <div>
              <label className="block text-xs text-muted-foreground mb-1">KPI</label>
              <input
                type="text"
                value={item.kpi || ""}
                onChange={(e) => onUpdate({ kpi: e.target.value || null })}
                className="input-base w-full"
                placeholder="Ключевой показатель"
                disabled={disabled}
              />
            </div>
          </div>

          {/* Due date and status row */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
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
            <div>
              <label className="block text-xs text-muted-foreground mb-1">Статус</label>
              <input
                type="text"
                value={item.status || ""}
                onChange={(e) => onUpdate({ status: e.target.value || null })}
                className="input-base w-full"
                placeholder="Результат / статус"
                disabled={disabled}
              />
            </div>
            <div>
              <label className="block text-xs text-muted-foreground mb-1">Дата статуса</label>
              <input
                type="date"
                value={item.status_date || ""}
                onChange={(e) => onUpdate({ status_date: e.target.value || null })}
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
                Задача создана
              </span>
            )}
          </div>
        </div>

        <button
          type="button"
          onClick={onRemove}
          className="p-2 text-destructive/60 hover:text-destructive hover:bg-destructive/10 rounded-lg shrink-0 transition-colors"
          disabled={disabled}
          title="Удалить"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
