import { useState } from "react";
import {
  ChevronDown,
  ChevronUp,
  FolderOpen,
  Building,
  Users,
  Briefcase,
  Target,
  Plus,
  Trash2,
  Edit2,
  Check,
  X,
  GripVertical,
} from "lucide-react";
import { ProtocolItemData } from "./ProtocolItemEditor";
import { GoalItemData } from "./GoalItemEditor";
import { DroppableSection } from "./DroppableSection";
import { EmployeeMultiSelect } from "@/components/ui/EmployeeMultiSelect";
import { SectionType } from "@/hooks/useProtocolSections";
import type { SortableHandleProps } from "./SortableProtocolSection";

interface UniversalSectionProps {
  sectionId: string;
  sectionType: SectionType;
  entityId: string | null;
  entityName: string | null;
  items: (ProtocolItemData | GoalItemData)[];
  employees: {
    id: string;
    full_name: string;
    position: string;
    avatar_url: string | null;
    phone: string | null;
    email: string | null;
    department: string | null;
    birthday: string | null;
    profile_id: string | null;
  }[];
  projects: { id: string; name: string }[];
  defaultResponsible: string | null;
  onChangeDefaultResponsible: (responsible: string | null) => void;
  onUpdateItem: (itemId: string, updates: Partial<ProtocolItemData | GoalItemData>) => void;
  onRemoveItem: (itemId: string) => void;
  onAddItem: () => void;
  onChangeEntity?: (entityId: string | null, entityName: string | null) => void;
  onRemoveSection?: () => void;
  canEdit?: boolean;
  defaultExpanded?: boolean;
  dragHandle?: SortableHandleProps;
}

const SECTION_ICONS: Record<SectionType, React.ReactNode> = {
  project: <FolderOpen className="w-5 h-5 text-primary" />,
  tender: <Building className="w-5 h-5 text-blue-600" />,
  hr: <Users className="w-5 h-5 text-green-600" />,
  business: <Briefcase className="w-5 h-5 text-purple-600" />,
  goals: <Target className="w-5 h-5 text-amber-600" />,
};

const SECTION_BG_CLASSES: Record<SectionType, string> = {
  project: "bg-muted/30",
  tender: "bg-blue-500/5",
  hr: "bg-green-500/5",
  business: "bg-purple-500/5",
  goals: "bg-amber-500/5",
};

export function UniversalSection({
  sectionId,
  sectionType,
  entityId,
  entityName,
  items,
  employees,
  projects,
  defaultResponsible,
  onChangeDefaultResponsible,
  onUpdateItem,
  onRemoveItem,
  onAddItem,
  onChangeEntity,
  onRemoveSection,
  canEdit = true,
  defaultExpanded = true,
  dragHandle,
}: UniversalSectionProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState("");

  // Get display name based on section type
  const getDisplayName = () => {
    if (sectionType === "project") {
      if (entityId) {
        const project = projects.find((p) => p.id === entityId);
        return project?.name || "Неизвестный проект";
      }
      return "Без проекта (общие вопросы)";
    }
    return entityName || getSectionTypeLabel(sectionType);
  };

  const getSectionTypeLabel = (type: SectionType) => {
    switch (type) {
      case "project":
        return "Проект";
      case "tender":
        return "Тендер";
      case "hr":
        return "Подбор персонала";
      case "business":
        return "Бизнес задачи";
      case "goals":
        return "Цели компании";
      default:
        return "Секция";
    }
  };

  // Convert responsible string to employee IDs
  const getEmployeeIdsFromResponsible = (responsible: string | null): string[] => {
    if (!responsible) return [];
    const names = responsible.split(", ").map((n) => n.trim());
    return names
      .map((name) => employees.find((e) => e.full_name === name)?.id)
      .filter(Boolean) as string[];
  };

  const handleDefaultResponsibleChange = (ids: string[]) => {
    const responsibleNames = ids
      .map((id) => employees.find((e) => e.id === id)?.full_name)
      .filter(Boolean)
      .join(", ");
    onChangeDefaultResponsible(responsibleNames || null);
  };

  const handleStartEdit = () => {
    if (sectionType === "project") {
      setEditValue(entityId || "");
    } else {
      setEditValue(entityName || "");
    }
    setIsEditing(true);
  };

  const handleConfirmEdit = () => {
    if (sectionType === "project") {
      onChangeEntity?.(editValue || null, null);
    } else {
      onChangeEntity?.(null, editValue.trim() || getSectionTypeLabel(sectionType));
    }
    setIsEditing(false);
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
  };

  const displayName = getDisplayName();

  return (
    <div className="card-base overflow-visible">
      {/* Header */}
      <div className={`flex items-center gap-2 p-4 ${SECTION_BG_CLASSES[sectionType]}`}>
        {dragHandle && (
          <button
            type="button"
            className="p-1 hover:bg-secondary rounded transition-colors cursor-grab active:cursor-grabbing"
            aria-label="Переместить секцию"
            {...dragHandle.attributes}
            {...dragHandle.listeners}
          >
            <GripVertical className="w-4 h-4 text-muted-foreground" />
          </button>
        )}

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

        {SECTION_ICONS[sectionType]}

        {isEditing ? (
          <div className="flex-1 flex items-center gap-2">
            {sectionType === "project" ? (
              <select
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                className="input-base flex-1"
                autoFocus
              >
                <option value="">Без проекта (общие вопросы)</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            ) : (
              <input
                type="text"
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                className="input-base flex-1"
                placeholder={getSectionTypeLabel(sectionType)}
                autoFocus
              />
            )}
            <button
              onClick={handleConfirmEdit}
              className="p-1.5 text-green-600 hover:bg-green-500/10 rounded transition-colors"
            >
              <Check className="w-4 h-4" />
            </button>
            <button
              onClick={handleCancelEdit}
              className="p-1.5 text-muted-foreground hover:bg-secondary rounded transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <>
            <span className="font-medium text-foreground flex-1">{displayName}</span>
            {canEdit && onChangeEntity && (
              <button
                onClick={handleStartEdit}
                className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-secondary rounded transition-colors"
                title="Редактировать"
              >
                <Edit2 className="w-4 h-4" />
              </button>
            )}
          </>
        )}

        <span className="chip text-xs shrink-0">
          {items.length} {items.length === 1 ? "пункт" : items.length >= 2 && items.length <= 4 ? "пункта" : "пунктов"}
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

      {/* Default responsible row - always visible when expanded (except for goals) */}
      {isExpanded && sectionType !== "goals" && (
        <div className="px-4 py-3 bg-muted/10 border-b border-border/50 flex items-center gap-3">
          <Users className="w-4 h-4 text-muted-foreground shrink-0" />
          <span className="text-sm text-muted-foreground shrink-0">Ответственные по умолчанию:</span>
          <div className="flex-1 max-w-xs">
            <EmployeeMultiSelect
              employees={employees}
              selectedIds={getEmployeeIdsFromResponsible(defaultResponsible)}
              onChange={handleDefaultResponsibleChange}
              placeholder="Выберите ответственных"
              usePortal={true}
            />
          </div>
        </div>
      )}

      {/* Items */}
      {isExpanded && (
        <div className="p-4 space-y-3">
          {items.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">Нет пунктов. Добавьте первый пункт.</p>
          ) : (
            <DroppableSection
              sectionId={`section-${sectionId}`}
              items={items}
              employees={employees}
              projectDefaultResponsible={defaultResponsible}
              onUpdateItem={onUpdateItem}
              onRemoveItem={onRemoveItem}
              sectionType={sectionType}
            />
          )}

          <button
            type="button"
            onClick={onAddItem}
            className="w-full py-2.5 border-2 border-dashed border-border hover:border-primary/50 rounded-lg text-sm text-muted-foreground hover:text-primary transition-colors flex items-center justify-center gap-2"
          >
            <Plus className="w-4 h-4" />
            {sectionType === "goals" ? "Добавить цель" : "Добавить пункт"}
          </button>
        </div>
      )}
    </div>
  );
}
