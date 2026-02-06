import { useState, useRef, useCallback, useEffect } from "react";
import { createPortal } from "react-dom";
import { SmilePlus } from "lucide-react";

const REACTIONS = ["👍", "❤️", "😂", "😮", "😢", "🔥"];

interface ReactionPickerProps {
  onSelect: (emoji: string) => void;
}

export function ReactionPicker({ onSelect }: ReactionPickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleSelect = (emoji: string) => {
    onSelect(emoji);
    setIsOpen(false);
  };

  const openPicker = useCallback(() => {
    if (btnRef.current) {
      const rect = btnRef.current.getBoundingClientRect();
      setPosition({ top: rect.top, left: rect.left });
    }
    setIsOpen(true);
  }, []);

  const handleLongPressStart = useCallback(() => {
    longPressTimer.current = setTimeout(() => {
      openPicker();
    }, 400);
  }, [openPicker]);

  const handleLongPressEnd = useCallback(() => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  }, []);

  // Recalculate position if panel scrolls
  useEffect(() => {
    if (!isOpen) return;
    const update = () => {
      if (btnRef.current) {
        const rect = btnRef.current.getBoundingClientRect();
        setPosition({ top: rect.top, left: rect.left });
      }
    };
    window.addEventListener("scroll", update, true);
    return () => window.removeEventListener("scroll", update, true);
  }, [isOpen]);

  return (
    <div className="relative inline-flex">
      <button
        ref={btnRef}
        onClick={openPicker}
        onTouchStart={handleLongPressStart}
        onTouchEnd={handleLongPressEnd}
        onTouchCancel={handleLongPressEnd}
        className="p-1 rounded-full text-muted-foreground/50 hover:text-muted-foreground hover:bg-secondary/80 transition-colors"
        aria-label="Реакция"
      >
        <SmilePlus className="w-3.5 h-3.5" />
      </button>

      {isOpen && position && createPortal(
        <>
          <div className="fixed inset-0 z-[100]" onClick={() => setIsOpen(false)} />
          <div
            className="fixed z-[101] bg-card border border-border rounded-lg shadow-lg p-1 flex gap-0.5 animate-in fade-in-0 zoom-in-95"
            style={{
              top: `${position.top - 40}px`,
              left: `${Math.max(4, position.left - 80)}px`,
            }}
          >
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
        </>,
        document.body
      )}
    </div>
  );
}
