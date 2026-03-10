import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical } from "lucide-react";
import { ProtocolItemEditor, ProtocolItemData } from "./ProtocolItemEditor";
import { GoalItemEditor, GoalItemData } from "./GoalItemEditor";
import { SectionType } from "@/hooks/useProtocolSections";

// Union type for all item types
export type UniversalItemData = ProtocolItemData | GoalItemData;

// Type guard to check if item is a GoalItemData
function isGoalItem(item: UniversalItemData): item is GoalItemData {
  return 'kpi' in item || 'status' in item || 'status_date' in item || 'section_id' in item;
}

interface DraggableItemProps {
  item: UniversalItemData;
  employees: { id: string; full_name: string; position: string; avatar_url: string | null; phone: string | null; email: string | null; department: string | null; birthday: string | null; profile_id: string | null; description: string | null; middle_name: string | null }[];
  projectDefaultResponsible: string | null;
  onUpdate: (updates: Partial<UniversalItemData>) => void;
  onRemove: () => void;
  onArchive?: () => void;
  onPersistTempItem?: () => Promise<string | null>;
  sectionType?: SectionType;
  itemNumber?: string;
  profiles?: { id: string; first_name: string | null; last_name: string | null; avatar_url: string | null }[];
  protocolTitle?: string;
}

export function DraggableItem({
  item,
  employees,
  projectDefaultResponsible,
  onUpdate,
  onRemove,
  onArchive,
  onPersistTempItem,
  sectionType = 'project',
  itemNumber,
  profiles = [],
  protocolTitle,
}: DraggableItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const isGoal = sectionType === 'goals';

  return (
    <div ref={setNodeRef} style={style} className="relative">
      <div className="absolute left-0 top-1/2 -translate-y-1/2 -ml-2 z-10">
        <button
          {...attributes}
          {...listeners}
          className="p-1.5 cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground hover:bg-secondary rounded transition-colors touch-none"
          title="Перетащить пункт"
        >
          <GripVertical className="w-4 h-4" />
        </button>
      </div>
      <div className="pl-6">
        {isGoal ? (
          <GoalItemEditor
            item={item as GoalItemData}
            employees={employees}
            projectDefaultResponsible={projectDefaultResponsible}
            onUpdate={onUpdate as (updates: Partial<GoalItemData>) => void}
            onRemove={onRemove}
            onArchive={onArchive}
            onPersistTempItem={onPersistTempItem}
            itemNumber={itemNumber}
            profiles={profiles}
            protocolTitle={protocolTitle}
          />
        ) : (
          <ProtocolItemEditor
            item={item as ProtocolItemData}
            employees={employees}
            projectDefaultResponsible={projectDefaultResponsible}
            onUpdate={onUpdate as (updates: Partial<ProtocolItemData>) => void}
            onRemove={onRemove}
            onArchive={onArchive}
            onPersistTempItem={onPersistTempItem}
            itemNumber={itemNumber}
            profiles={profiles}
            protocolTitle={protocolTitle}
          />
        )}
      </div>
    </div>
  );
}
