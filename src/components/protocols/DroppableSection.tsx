import { useDroppable } from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { DraggableItem } from "./DraggableItem";
import { ProtocolItemData } from "./ProtocolItemEditor";
import { GoalItemData } from "./GoalItemEditor";
import { SectionType } from "@/hooks/useProtocolSections";

// Union type for all item types
export type UniversalItemData = ProtocolItemData | GoalItemData;

interface DroppableSectionProps {
  sectionId: string;
  items: UniversalItemData[];
  employees: { id: string; full_name: string; position: string; avatar_url: string | null; phone: string | null; email: string | null; department: string | null; birthday: string | null; profile_id: string | null }[];
  projectDefaultResponsible: string | null;
  onUpdateItem: (itemId: string, updates: Partial<UniversalItemData>) => void;
  onRemoveItem: (itemId: string) => void;
  sectionType?: SectionType;
}

export function DroppableSection({
  sectionId,
  items,
  employees,
  projectDefaultResponsible,
  onUpdateItem,
  onRemoveItem,
  sectionType = 'project',
}: DroppableSectionProps) {
  const { setNodeRef, isOver } = useDroppable({
    id: sectionId,
  });

  return (
    <div
      ref={setNodeRef}
      className={`space-y-3 min-h-[60px] rounded-lg transition-colors ${
        isOver ? "bg-primary/10 ring-2 ring-primary/30" : ""
      }`}
    >
      <SortableContext items={items.map(i => i.id)} strategy={verticalListSortingStrategy}>
        {items.map((item) => (
          <DraggableItem
            key={item.id}
            item={item}
            employees={employees}
            projectDefaultResponsible={projectDefaultResponsible}
            onUpdate={(updates) => onUpdateItem(item.id, updates)}
            onRemove={() => onRemoveItem(item.id)}
            sectionType={sectionType}
          />
        ))}
      </SortableContext>
    </div>
  );
}
