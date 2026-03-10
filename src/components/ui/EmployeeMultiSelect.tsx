import { useState, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown, X, User } from "lucide-react";
import { DbEmployee, getEmployeeDisplayName } from "@/hooks/useEmployees";

interface EmployeeMultiSelectProps {
  employees: DbEmployee[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  placeholder?: string;
  single?: boolean;
  /** Use portal for rendering dropdown (needed inside modals) */
  usePortal?: boolean;
}

export function EmployeeMultiSelect({
  employees,
  selectedIds,
  onChange,
  placeholder = "Выберите сотрудников",
  single = false,
  usePortal = false,
}: EmployeeMultiSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [dropdownStyle, setDropdownStyle] = useState<React.CSSProperties>({});
  const containerRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Position dropdown when using portal
  useEffect(() => {
    if (isOpen && usePortal && buttonRef.current) {
      const updatePosition = () => {
        if (!buttonRef.current) return;
        const rect = buttonRef.current.getBoundingClientRect();
        setDropdownStyle({
          position: "fixed",
          top: rect.bottom + 4,
          left: rect.left,
          width: rect.width,
          zIndex: 99999,
        });
      };
      updatePosition();
      window.addEventListener("scroll", updatePosition, true);
      window.addEventListener("resize", updatePosition);
      return () => {
        window.removeEventListener("scroll", updatePosition, true);
        window.removeEventListener("resize", updatePosition);
      };
    }
  }, [isOpen, usePortal]);

  // Focus search input without scrolling
  useEffect(() => {
    if (isOpen && searchInputRef.current) {
      searchInputRef.current.focus({ preventScroll: true });
    }
  }, [isOpen]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node) &&
        !(event.target as HTMLElement).closest("[data-employee-dropdown]")
      ) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const filteredEmployees = employees.filter((emp) =>
    getEmployeeDisplayName(emp).toLowerCase().includes(search.toLowerCase()) ||
    emp.position.toLowerCase().includes(search.toLowerCase())
  );

  const selectedEmployees = employees.filter((e) => selectedIds.includes(e.id));

  const toggleEmployee = (id: string) => {
    if (single) {
      onChange([id]);
      setIsOpen(false);
    } else {
      if (selectedIds.includes(id)) {
        onChange(selectedIds.filter((s) => s !== id));
      } else {
        onChange([...selectedIds, id]);
      }
    }
  };

  const removeEmployee = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    onChange(selectedIds.filter((s) => s !== id));
  };

  const dropdownContent = (
    <div
      data-employee-dropdown
      style={usePortal ? dropdownStyle : undefined}
      className={`bg-popover border border-border rounded-lg shadow-xl max-h-60 flex flex-col ${
        usePortal ? "" : "absolute z-50 mt-1 w-full"
      }`}
      onPointerDown={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
      onTouchStart={(e) => e.stopPropagation()}
    >
      <div className="p-2 border-b border-border">
        <input
          ref={searchInputRef}
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Поиск..."
          className="input-base w-full h-8 text-sm"
        />
      </div>
      <div className="overflow-y-auto min-h-0 flex-1">
        {filteredEmployees.length === 0 ? (
          <div className="p-3 text-sm text-muted-foreground text-center">
            Не найдено
          </div>
        ) : (
          filteredEmployees.map((emp) => {
            const isSelected = selectedIds.includes(emp.id);
            return (
              <button
                key={emp.id}
                type="button"
                onClick={() => toggleEmployee(emp.id)}
                className={`w-full flex items-center gap-3 px-3 py-2 text-left hover:bg-muted/50 transition-colors ${
                  isSelected ? "bg-primary/5" : ""
                }`}
              >
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                  {emp.avatar_url ? (
                    <img src={emp.avatar_url} alt="" className="w-8 h-8 rounded-full object-cover" />
                  ) : (
                    <User className="w-4 h-4 text-primary" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{getEmployeeDisplayName(emp)}</p>
                  <p className="text-xs text-muted-foreground truncate">{emp.position}</p>
                </div>
                {isSelected && <Check className="w-4 h-4 text-primary shrink-0" />}
              </button>
            );
          })
        )}
      </div>
    </div>
  );

  return (
    <div ref={containerRef} className="relative">
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="input-base w-full flex items-center justify-between gap-2 text-left"
      >
        <div className="flex-1 flex flex-wrap gap-1 min-h-[24px]">
          {selectedEmployees.length === 0 ? (
            <span className="text-muted-foreground">{placeholder}</span>
          ) : (
            selectedEmployees.map((emp) => (
              <span
                key={emp.id}
                className="inline-flex items-center gap-1 px-2 py-0.5 bg-primary/10 text-primary text-xs rounded-full"
              >
                {getEmployeeDisplayName(emp)}
                {!single && (
                  <button
                    type="button"
                    onClick={(e) => removeEmployee(emp.id, e)}
                    className="hover:bg-primary/20 rounded-full p-0.5"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </span>
            ))
          )}
        </div>
        <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${isOpen ? "rotate-180" : ""}`} />
      </button>

      {isOpen && (
        usePortal
          ? createPortal(dropdownContent, document.body)
          : dropdownContent
      )}
    </div>
  );
}
