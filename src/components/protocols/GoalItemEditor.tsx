import { Trash2, Target, Archive, CheckSquare, Square } from "lucide-react";
import { EmployeeMultiSelect } from "@/components/ui/EmployeeMultiSelect";
import { ProtocolItemComments } from "./ProtocolItemComments";

export interface GoalItemData {
  id: string;
  section_id: string | null;
  item_text: string;      // Goal/task text
  responsible: string | null;
  due_date: string | null;
  kpi: string | null;
  status: string | null;
  status_date: string | null;
  task_id?: string | null;
  archived?: boolean;
  completed?: boolean;
  completed_at?: string | null;
}

interface GoalItemEditorProps {
  item: GoalItemData;
  employees: { id: string; full_name: string; position: string; avatar_url: string | null; phone: string | null; email: string | null; department: string | null; birthday: string | null; profile_id: string | null }[];
  projectDefaultResponsible: string | null;
  onUpdate: (updates: Partial<GoalItemData>) => void;
  onRemove: () => void;
  onArchive?: () => void;
  onPersistTempItem?: () => Promise<string | null>;
  showDragHandle?: boolean;
  disabled?: boolean;
  itemNumber?: string;
  profiles?: { id: string; first_name: string | null; last_name: string | null; avatar_url: string | null }[];
  protocolTitle?: string;
}

export function GoalItemEditor({
  item,
  employees,
  projectDefaultResponsible,
  onUpdate,
  onRemove,
  onArchive,
  onPersistTempItem,
  showDragHandle = false,
  disabled = false,
  itemNumber,
  profiles = [],
  protocolTitle,
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

  const handleToggleCompleted = () => {
    const newCompleted = !item.completed;
    onUpdate({ 
      completed: newCompleted, 
      completed_at: newCompleted ? new Date().toISOString() : null 
    });
  };

  const isCompleted = item.completed;
  const isArchived = item.archived;

  return (
    <div className={`p-4 rounded-lg border space-y-4 ${
      isArchived 
        ? 'bg-muted/30 border-dashed opacity-60' 
        : isCompleted 
          ? 'bg-green-500/5 border-green-500/30' 
          : 'bg-gradient-to-r from-amber-500/5 to-orange-500/5 border-amber-500/20'
    }`}>
      {/* Header row */}
      <div className="flex items-start gap-2">
        {/* Completion checkbox */}
        <button
          type="button"
          onClick={handleToggleCompleted}
          className={`shrink-0 mt-0.5 flex items-center gap-1.5 px-2 py-1 rounded-md border text-xs font-medium transition-all ${
            isCompleted 
              ? 'bg-green-500/10 border-green-500/30 text-green-600 hover:bg-green-500/20 dark:text-green-400' 
              : 'bg-muted/50 border-border hover:bg-muted hover:border-primary/30 text-muted-foreground hover:text-foreground'
          }`}
          disabled={disabled}
          title={isCompleted ? "Снять отметку выполнено" : "Отметить как выполнено"}
        >
          {isCompleted ? <CheckSquare className="w-4 h-4" /> : <Square className="w-4 h-4" />}
          <span className="hidden sm:inline">{isCompleted ? "Готово" : "Сделать"}</span>
        </button>

        <Target className="w-5 h-5 text-amber-600 shrink-0 mt-1.5" />
        
        {/* Item number */}
        {itemNumber && (
          <span className="text-xs font-mono text-muted-foreground shrink-0 mt-2 min-w-[2.5rem]">
            {itemNumber}
          </span>
        )}

        <div className="flex-1 space-y-3">
          {/* Goal text */}
          <div>
            <label className="block text-xs text-muted-foreground mb-1">Цель / Задача</label>
            <textarea
              value={item.item_text}
              onChange={(e) => onUpdate({ item_text: e.target.value })}
              className={`input-base w-full resize-none ${isCompleted ? 'line-through text-muted-foreground' : ''}`}
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

          {/* Task link indicator */}
          {item.task_id && (
            <div className="flex items-center gap-2">
              <span className="chip-success shrink-0 flex items-center gap-1 text-xs">
                Связанная задача
              </span>
            </div>
          )}

          {/* Comments section */}
          {profiles.length > 0 && (
            <ProtocolItemComments 
              itemId={item.id}
              taskId={item.task_id || null}
              profiles={profiles} 
              protocolTitle={protocolTitle}
              onPersistTempItem={onPersistTempItem}
            />
          )}
        </div>

        <div className="flex flex-col gap-1">
          {onArchive && (
            <button
              type="button"
              onClick={onArchive}
              className="p-2 text-muted-foreground hover:text-amber-600 hover:bg-amber-500/10 rounded-lg shrink-0 transition-colors"
              disabled={disabled}
              title={isArchived ? "Восстановить из архива" : "Архивировать"}
            >
              <Archive className="w-4 h-4" />
            </button>
          )}
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
    </div>
  );
}
