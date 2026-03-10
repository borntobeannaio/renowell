import { Trash2, CheckCircle2, Link2, Unlink, Archive, CheckSquare, Square, MessageCircle } from "lucide-react";
import { EmployeeMultiSelect } from "@/components/ui/EmployeeMultiSelect";
import { ProtocolItemComments } from "./ProtocolItemComments";
import { DbEmployee, getEmployeeDisplayName } from "@/hooks/useEmployees";

export interface ProtocolItemData {
  id: string;
  project_id: string | null;
  item_text: string;
  responsible: string | null;
  due_date: string | null;
  task_id?: string | null;
  archived?: boolean;
  completed?: boolean;
  completed_at?: string | null;
}

interface ProtocolItemEditorProps {
  item: ProtocolItemData;
  employees: DbEmployee[];
  projectDefaultResponsible: string | null;
  onUpdate: (updates: Partial<ProtocolItemData>) => void;
  onRemove: () => void;
  onArchive?: () => void;
  onPersistTempItem?: () => Promise<string | null>;
  showDragHandle?: boolean;
  disabled?: boolean;
  itemNumber?: string;
  profiles?: { id: string; first_name: string | null; last_name: string | null; avatar_url: string | null }[];
  protocolTitle?: string;
}

export function ProtocolItemEditor({
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
}: ProtocolItemEditorProps) {
  // Check if item is inheriting from project
  const isInheritingResponsible = item.responsible === null && projectDefaultResponsible !== null;
  
  // Get effective responsible (inherited or own)
  const effectiveResponsible = item.responsible ?? projectDefaultResponsible;
  
  // Convert responsible string to employee IDs
  const getEmployeeIdsFromResponsible = (responsible: string | null): string[] => {
    if (!responsible) return [];
    const names = responsible.split(", ").map(n => n.trim());
    return names
      .map(name => employees.find(e => getEmployeeDisplayName(e) === name)?.id)
      .filter(Boolean) as string[];
  };

  const handleResponsibleChange = (ids: string[]) => {
    const responsibleNames = ids
      .map(id => { const e = employees.find(e => e.id === id); return e ? getEmployeeDisplayName(e) : null; })
      .filter(Boolean)
      .join(", ");
    // Setting value explicitly breaks inheritance
    onUpdate({ responsible: responsibleNames || null });
  };

  const handleResetToProjectDefault = () => {
    // Setting responsible to null will make it inherit from project
    onUpdate({ responsible: null });
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
    <div className={`p-3 rounded-lg space-y-3 border ${
      isArchived 
        ? 'bg-muted/30 border-dashed opacity-60' 
        : isCompleted 
          ? 'bg-green-500/5 border-green-500/30' 
          : isInheritingResponsible 
            ? 'bg-primary/5 border-primary/20' 
            : 'bg-secondary/50 border-border/50'
    }`}>
      {/* Item text row */}
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
          <span className="hidden sm:inline">{isCompleted ? "Готово" : "Сделано"}</span>
        </button>

        {/* Item number */}
        {itemNumber && (
          <span className="text-xs font-mono text-muted-foreground shrink-0 mt-2 min-w-[2.5rem]">
            {itemNumber}
          </span>
        )}

        <input
          type="text"
          value={item.item_text}
          onChange={(e) => onUpdate({ item_text: e.target.value })}
          className={`input-base flex-1 ${isCompleted ? 'line-through text-muted-foreground' : ''}`}
          placeholder="Текст пункта"
          disabled={disabled}
        />
        
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
          title="Удалить пункт"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>

      {/* Controls row */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="text-xs text-muted-foreground flex items-center gap-1">
              Ответственные
              {isInheritingResponsible && (
                <span className="inline-flex items-center gap-0.5 text-primary">
                  <Link2 className="w-3 h-3" />
                  <span className="text-[10px]">от проекта</span>
                </span>
              )}
            </label>
            {item.responsible !== null && projectDefaultResponsible !== null && (
              <button
                type="button"
                onClick={handleResetToProjectDefault}
                className="text-[10px] text-primary hover:underline flex items-center gap-0.5"
                title="Использовать ответственных от проекта"
              >
                <Unlink className="w-3 h-3" />
                Сбросить
              </button>
            )}
          </div>
          <EmployeeMultiSelect
            employees={employees}
            selectedIds={getEmployeeIdsFromResponsible(effectiveResponsible)}
            onChange={handleResponsibleChange}
            placeholder={isInheritingResponsible ? "Наследует от проекта" : "Выберите ответственных"}
            usePortal={true}
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

      {/* Task link indicator and comments */}
      <div className="space-y-2">
        {item.task_id && (
          <div className="flex items-center gap-2">
            <span className="chip-success shrink-0 flex items-center gap-1 text-xs">
              <CheckCircle2 className="w-3 h-3" />
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
    </div>
  );
}
