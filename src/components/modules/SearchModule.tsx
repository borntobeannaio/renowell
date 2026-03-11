import { useApp } from "@/context/AppContext";
import { useEmployees, getEmployeeDisplayName } from "@/hooks/useEmployees";
import { useProtocols } from "@/hooks/useProtocols";
import { useTasks } from "@/hooks/useTasks";
import { Search, ArrowRight, Loader2 } from "lucide-react";
import { NavigationSection } from "@/types";

interface SearchResult {
  id: string;
  type: NavigationSection;
  title: string;
  description: string;
  section: string;
}

export function SearchModule() {
  const { searchQuery, setCurrentSection } = useApp();
  const { data: employees = [], isLoading: loadingEmp } = useEmployees();
  const { data: protocols = [], isLoading: loadingProt } = useProtocols();
  const { data: tasks = [], isLoading: loadingTasks } = useTasks();

  const query = searchQuery.toLowerCase();
  const isLoading = loadingEmp || loadingProt || loadingTasks;

  const results: SearchResult[] = [];

  if (query) {
    // Search employees
    employees.forEach((emp) => {
      if (
        emp.full_name?.toLowerCase().includes(query) ||
        emp.position?.toLowerCase().includes(query) ||
        emp.department?.toLowerCase().includes(query) ||
        emp.email?.toLowerCase().includes(query) ||
        emp.first_name?.toLowerCase().includes(query) ||
        emp.last_name?.toLowerCase().includes(query)
      ) {
        results.push({
          id: emp.id,
          type: "hr",
          title: getEmployeeDisplayName(emp),
          description: [emp.position, emp.department].filter(Boolean).join(" • "),
          section: "HR и Офис",
        });
      }
    });

    // Search protocols
    protocols.forEach((p) => {
      if (
        p.title.toLowerCase().includes(query) ||
        p.attendees?.some((a) => a.toLowerCase().includes(query)) ||
        p.organizer?.toLowerCase().includes(query) ||
        String(p.number).includes(query)
      ) {
        results.push({
          id: p.id,
          type: "protocols",
          title: `№${p.number} — ${p.title}`,
          description: `${p.date} • ${p.attendees?.length || 0} участников`,
          section: "Протоколы",
        });
      }
    });

    // Search tasks
    tasks.forEach((task) => {
      const assigneeNames = (task.assignee_ids || [])
        .map((aid) => employees.find((e) => e.profile_id === aid || e.id === aid))
        .filter(Boolean)
        .map((e) => getEmployeeDisplayName(e!));

      if (
        task.title.toLowerCase().includes(query) ||
        task.labels?.some((l) => l.toLowerCase().includes(query)) ||
        assigneeNames.some((n) => n.toLowerCase().includes(query))
      ) {
        results.push({
          id: task.id,
          type: "tasks",
          title: task.title,
          description: [
            assigneeNames.length ? assigneeNames.join(", ") : "—",
            task.due_date || "",
          ]
            .filter(Boolean)
            .join(" • "),
          section: "Задачи",
        });
      }
    });
  }

  const handleOpen = (result: SearchResult) => {
    setCurrentSection(result.type);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 text-muted-foreground">
        <Search className="w-5 h-5" />
        <span>
          Результаты поиска по запросу:{" "}
          <span className="font-medium text-foreground">"{searchQuery}"</span>
        </span>
        {!isLoading && <span className="chip">{results.length}</span>}
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12 gap-2 text-muted-foreground">
          <Loader2 className="w-5 h-5 animate-spin" />
          <span>Поиск...</span>
        </div>
      ) : results.length > 0 ? (
        <div className="space-y-3">
          {results.map((result) => (
            <div
              key={`${result.type}-${result.id}`}
              className="card-base p-4 flex items-center justify-between gap-4 hover:border-primary/30 transition-colors"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="chip-primary">{result.section}</span>
                </div>
                <h4 className="font-medium text-foreground truncate">
                  {result.title}
                </h4>
                <p className="text-sm text-muted-foreground truncate">
                  {result.description}
                </p>
              </div>
              <button
                onClick={() => handleOpen(result)}
                className="btn-secondary flex items-center gap-2 shrink-0"
              >
                Открыть
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-12">
          <Search className="w-12 h-12 mx-auto mb-4 text-muted-foreground opacity-50" />
          <p className="text-muted-foreground">Ничего не найдено</p>
          <p className="text-sm text-muted-foreground mt-1">
            Попробуйте изменить поисковый запрос
          </p>
        </div>
      )}
    </div>
  );
}
