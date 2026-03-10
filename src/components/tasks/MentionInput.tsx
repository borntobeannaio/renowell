import { useState, useRef, useEffect, useCallback } from "react";
import { Textarea } from "@/components/ui/textarea";
import { useEmployees, getEmployeeDisplayName } from "@/hooks/useEmployees";
import { cn } from "@/lib/utils";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";

interface MentionInputProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit?: () => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

export function MentionInput({
  value,
  onChange,
  onSubmit,
  placeholder,
  disabled,
  className,
}: MentionInputProps) {
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [mentionQuery, setMentionQuery] = useState("");
  const [cursorPosition, setCursorPosition] = useState(0);
  const [selectedIndex, setSelectedIndex] = useState(0);
  
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);
  
  const { data: employees = [] } = useEmployees();

  // Фильтрация сотрудников по запросу
  const filteredEmployees = employees.filter((emp) =>
    getEmployeeDisplayName(emp).toLowerCase().includes(mentionQuery.toLowerCase())
  );

  // Обработка ввода текста
  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = e.target.value;
    const cursor = e.target.selectionStart;
    
    onChange(newValue);
    setCursorPosition(cursor);

    // Проверка на @ символ
    const textBeforeCursor = newValue.slice(0, cursor);
    const lastAtIndex = textBeforeCursor.lastIndexOf("@");

    if (lastAtIndex !== -1) {
      const textAfterAt = textBeforeCursor.slice(lastAtIndex + 1);
      // Показываем suggestions если после @ нет пробела в конце
      if (!textAfterAt.includes(" ") || textAfterAt.split(" ").length <= 2) {
        setMentionQuery(textAfterAt);
        setShowSuggestions(true);
        setSelectedIndex(0);
        return;
      }
    }
    
    setShowSuggestions(false);
  };

  // Вставка упоминания
  const insertMention = useCallback(
    (fullName: string) => {
      const textBeforeCursor = value.slice(0, cursorPosition);
      const lastAtIndex = textBeforeCursor.lastIndexOf("@");
      
      if (lastAtIndex !== -1) {
        const before = value.slice(0, lastAtIndex);
        const after = value.slice(cursorPosition);
        const newValue = `${before}@${fullName} ${after}`;
        
        onChange(newValue);
        setShowSuggestions(false);
        
        // Фокус обратно на textarea
        setTimeout(() => {
          if (textareaRef.current) {
            const newCursor = lastAtIndex + fullName.length + 2; // @ + name + space
            textareaRef.current.focus();
            textareaRef.current.setSelectionRange(newCursor, newCursor);
          }
        }, 0);
      }
    },
    [value, cursorPosition, onChange]
  );

  // Обработка клавиатуры
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (showSuggestions && filteredEmployees.length > 0) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((prev) => 
          prev < filteredEmployees.length - 1 ? prev + 1 : 0
        );
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((prev) => 
          prev > 0 ? prev - 1 : filteredEmployees.length - 1
        );
      } else if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        insertMention(getEmployeeDisplayName(filteredEmployees[selectedIndex]));
      } else if (e.key === "Escape") {
        setShowSuggestions(false);
      }
    } else if (e.key === "Enter" && !e.shiftKey && onSubmit) {
      e.preventDefault();
      onSubmit();
    }
  };

  // Закрытие при клике вне
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        suggestionsRef.current &&
        !suggestionsRef.current.contains(event.target as Node) &&
        !textareaRef.current?.contains(event.target as Node)
      ) {
        setShowSuggestions(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <div className="relative">
      <Textarea
        ref={textareaRef}
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        disabled={disabled}
        className={cn("resize-none", className)}
        rows={2}
      />
      
      {showSuggestions && filteredEmployees.length > 0 && (
        <div
          ref={suggestionsRef}
          className="absolute left-0 right-0 bottom-full mb-1 bg-popover border border-border rounded-lg shadow-lg z-50 max-h-48 overflow-y-auto"
        >
          {filteredEmployees.slice(0, 8).map((employee, index) => (
            <div
              key={employee.id}
              onClick={() => insertMention(getEmployeeDisplayName(employee))}
              className={cn(
                "flex items-center gap-2 px-3 py-2 cursor-pointer transition-colors",
                index === selectedIndex
                  ? "bg-accent text-accent-foreground"
                  : "hover:bg-accent/50"
              )}
            >
              <Avatar className="w-6 h-6">
                <AvatarImage src={employee.avatar_url || undefined} />
                <AvatarFallback className="text-xs">
                  {getInitials(getEmployeeDisplayName(employee))}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{employee.full_name}</p>
                <p className="text-xs text-muted-foreground truncate">
                  {employee.position}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// Utility: парсинг упоминаний из текста
export function extractMentions(text: string): string[] {
  const MENTION_REGEX = /@([А-Яа-яЁёA-Za-z]+\s[А-Яа-яЁёA-Za-z]+)/g;
  const matches = text.match(MENTION_REGEX) || [];
  return matches.map((m) => m.slice(1)); // Убираем @
}
