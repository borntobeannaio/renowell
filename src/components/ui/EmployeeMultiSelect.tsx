import { useState, useRef, useEffect } from "react";
import { Check, ChevronDown, X, User } from "lucide-react";
import { DbEmployee } from "@/hooks/useEmployees";

interface EmployeeMultiSelectProps {
  employees: DbEmployee[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  placeholder?: string;
  single?: boolean;
}

export function EmployeeMultiSelect({
  employees,
  selectedIds,
  onChange,
  placeholder = "Выберите сотрудников",
  single = false,
}: EmployeeMultiSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const filteredEmployees = employees.filter((emp) =>
    emp.full_name.toLowerCase().includes(search.toLowerCase()) ||
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

  return (
    <div ref={containerRef} className="relative">
      <button
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
                {emp.full_name}
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
        <div className="absolute z-50 mt-1 w-full bg-popover border border-border rounded-lg shadow-lg max-h-60 overflow-hidden">
          <div className="p-2 border-b border-border">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Поиск..."
              className="input-base w-full h-8 text-sm"
              autoFocus
            />
          </div>
          <div className="overflow-y-auto max-h-48">
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
                      <p className="text-sm font-medium text-foreground truncate">{emp.full_name}</p>
                      <p className="text-xs text-muted-foreground truncate">{emp.position}</p>
                    </div>
                    {isSelected && <Check className="w-4 h-4 text-primary shrink-0" />}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
