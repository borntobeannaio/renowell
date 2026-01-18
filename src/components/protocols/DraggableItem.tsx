import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical } from "lucide-react";
import { ProtocolItemEditor, ProtocolItemData } from "./ProtocolItemEditor";

interface DraggableItemProps {
  item: ProtocolItemData;
  employees: { id: string; full_name: string; position: string; avatar_url: string | null; phone: string | null; email: string | null; department: string | null; birthday: string | null; profile_id: string | null }[];
  projectDefaultResponsible: string | null;
  onUpdate: (updates: Partial<ProtocolItemData>) => void;
  onRemove: () => void;
}

export function DraggableItem({
  item,
  employees,
  projectDefaultResponsible,
  onUpdate,
  onRemove,
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
        <ProtocolItemEditor
          item={item}
          employees={employees}
          projectDefaultResponsible={projectDefaultResponsible}
          onUpdate={onUpdate}
          onRemove={onRemove}
        />
      </div>
    </div>
  );
}
