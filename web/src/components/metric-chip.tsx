"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

type MetricChipProps = {
  id: string;
  name: string;
  onRemove: () => void;
  className?: string;
};

export function MetricChip({ id, name, onRemove, className }: MetricChipProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "inline-flex items-center gap-1 rounded-full border bg-background px-2 py-1 text-xs transition-colors hover:bg-accent",
        isDragging && "opacity-50",
        className
      )}
      {...attributes}
      {...listeners}
    >
      <span className="truncate max-w-32">{name}</span>
      <button
        onClick={(e) => {
          e.stopPropagation();
          onRemove();
        }}
        className="h-4 w-4 p-0 hover:bg-destructive hover:text-destructive-foreground rounded-sm flex items-center justify-center"
      >
        <X className="h-2 w-2" />
      </button>
    </div>
  );
}
