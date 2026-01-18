import { useState } from "react";
import { ChevronDown, ChevronUp, FolderOpen, Plus, Trash2 } from "lucide-react";
import { ProtocolItemEditor, ProtocolItemData } from "./ProtocolItemEditor";

interface ProjectSectionProps {
  projectId: string | null;
  projectName: string;
  items: ProtocolItemData[];
  employees: { id: string; full_name: string; position: string; avatar_url: string | null; phone: string | null; email: string | null; department: string | null; birthday: string | null; profile_id: string | null }[];
  projects: { id: string; name: string }[];
  onUpdateItem: (itemId: string, updates: Partial<ProtocolItemData>) => void;
  onRemoveItem: (itemId: string) => void;
  onAddItem: () => void;
  onChangeProject?: (newProjectId: string | null) => void;
  onRemoveSection?: () => void;
  canChangeProject?: boolean;
  defaultExpanded?: boolean;
}

export function ProjectSection({
  projectId,
  projectName,
  items,
  employees,
  projects,
  onUpdateItem,
  onRemoveItem,
  onAddItem,
  onChangeProject,
  onRemoveSection,
  canChangeProject = true,
  defaultExpanded = true,
}: ProjectSectionProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  const [isEditingProject, setIsEditingProject] = useState(false);

  return (
    <div className="card-base overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 p-4 bg-muted/30">
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="p-1 hover:bg-secondary rounded transition-colors"
        >
          {isExpanded ? (
            <ChevronUp className="w-4 h-4 text-muted-foreground" />
          ) : (
            <ChevronDown className="w-4 h-4 text-muted-foreground" />
          )}
        </button>
        
        <FolderOpen className="w-5 h-5 text-primary shrink-0" />
        
        {canChangeProject && isEditingProject ? (
          <select
            value={projectId || ""}
            onChange={(e) => {
              onChangeProject?.(e.target.value || null);
              setIsEditingProject(false);
            }}
            onBlur={() => setIsEditingProject(false)}
            className="input-base flex-1"
            autoFocus
          >
            <option value="">Без проекта (общие вопросы)</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        ) : (
          <button
            onClick={() => canChangeProject && setIsEditingProject(true)}
            className={`font-medium text-foreground flex-1 text-left ${canChangeProject ? 'hover:text-primary cursor-pointer' : ''}`}
          >
            {projectName}
          </button>
        )}

        <span className="chip text-xs shrink-0">
          {items.length} {items.length === 1 ? 'пункт' : items.length >= 2 && items.length <= 4 ? 'пункта' : 'пунктов'}
        </span>

        {onRemoveSection && items.length === 0 && (
          <button
            onClick={onRemoveSection}
            className="p-2 text-destructive/60 hover:text-destructive hover:bg-destructive/10 rounded-lg transition-colors"
            title="Удалить секцию"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Items */}
      {isExpanded && (
        <div className="p-4 space-y-3">
          {items.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              Нет пунктов. Добавьте первый пункт.
            </p>
          ) : (
            items.map((item) => (
              <ProtocolItemEditor
                key={item.id}
                item={item}
                employees={employees}
                onUpdate={(updates) => onUpdateItem(item.id, updates)}
                onRemove={() => onRemoveItem(item.id)}
              />
            ))
          )}

          <button
            type="button"
            onClick={onAddItem}
            className="w-full py-2.5 border-2 border-dashed border-border hover:border-primary/50 rounded-lg text-sm text-muted-foreground hover:text-primary transition-colors flex items-center justify-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Добавить пункт
          </button>
        </div>
      )}
    </div>
  );
}
