import { ReactNode } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

export type SortableHandleProps = {
  attributes: Record<string, any>;
  listeners: Record<string, any>;
};

type ChildrenFn = (props: SortableHandleProps) => ReactNode;

interface SortableProtocolSectionProps {
  id: string;
  children: ChildrenFn | ReactNode;
}

export function SortableProtocolSection({
  id,
  children,
}: SortableProtocolSectionProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div ref={setNodeRef} style={style} className={isDragging ? "opacity-60" : undefined}>
      {typeof children === "function"
        ? (children as ChildrenFn)({ attributes, listeners })
        : children}
    </div>
  );
}
