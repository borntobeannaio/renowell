import { PropsWithChildren } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

export type SortableHandleProps = {
  attributes: Record<string, any>;
  listeners: Record<string, any>;
};

export function SortableProtocolSection({
  id,
  children,
}: PropsWithChildren<{ id: string }>) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div ref={setNodeRef} style={style} className={isDragging ? "opacity-60" : undefined}>
      {/* children expect to use data-sort-handle on some element */}
      {typeof children === "function"
        ? (children as any)({ attributes, listeners } satisfies SortableHandleProps)
        : children}
    </div>
  );
}
