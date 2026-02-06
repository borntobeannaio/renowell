import { useState, useRef, useCallback } from "react";
import { SmilePlus } from "lucide-react";

const REACTIONS = ["👍", "❤️", "😂", "😮", "😢", "🔥"];

interface ReactionPickerProps {
  onSelect: (emoji: string) => void;
}

export function ReactionPicker({ onSelect }: ReactionPickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleSelect = (emoji: string) => {
    onSelect(emoji);
    setIsOpen(false);
  };

  const handleLongPressStart = useCallback(() => {
    longPressTimer.current = setTimeout(() => {
      setIsOpen(true);
    }, 400);
  }, []);

  const handleLongPressEnd = useCallback(() => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  }, []);

  return (
    <div className="relative inline-flex">
      <button
        onClick={() => setIsOpen((v) => !v)}
        onTouchStart={handleLongPressStart}
        onTouchEnd={handleLongPressEnd}
        onTouchCancel={handleLongPressEnd}
        className="p-1 rounded-full text-muted-foreground/50 hover:text-muted-foreground hover:bg-secondary/80 transition-colors"
        aria-label="Реакция"
      >
        <SmilePlus className="w-3.5 h-3.5" />
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
          <div className="absolute bottom-full mb-1 z-50 bg-card border border-border rounded-lg shadow-lg p-1 flex gap-0.5 animate-in fade-in-0 zoom-in-95">
            {REACTIONS.map((emoji) => (
              <button
                key={emoji}
                onClick={(e) => {
                  e.stopPropagation();
                  handleSelect(emoji);
                }}
                className="w-8 h-8 flex items-center justify-center rounded-md hover:bg-secondary transition-colors text-base"
              >
                {emoji}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
