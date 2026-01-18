import { useDroppable } from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { DraggableItem } from "./DraggableItem";
import { ProtocolItemData } from "./ProtocolItemEditor";

interface DroppableSectionProps {
  sectionId: string;
  items: ProtocolItemData[];
  employees: { id: string; full_name: string; position: string; avatar_url: string | null; phone: string | null; email: string | null; department: string | null; birthday: string | null; profile_id: string | null }[];
  projectDefaultResponsible: string | null;
  onUpdateItem: (itemId: string, updates: Partial<ProtocolItemData>) => void;
  onRemoveItem: (itemId: string) => void;
}

export function DroppableSection({
  sectionId,
  items,
  employees,
  projectDefaultResponsible,
  onUpdateItem,
  onRemoveItem,
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
          />
        ))}
      </SortableContext>
    </div>
  );
}
