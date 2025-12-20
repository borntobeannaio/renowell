import { useApp } from "@/context/AppContext";
import { Search, ArrowRight } from "lucide-react";
import { NavigationSection } from "@/types";

interface SearchResult {
  id: string;
  type: NavigationSection;
  title: string;
  description: string;
  section: string;
}

export function SearchModule() {
  const {
    searchQuery,
    setCurrentSection,
    news,
    protocols,
    tasks,
    employees,
    kbRubrics,
    chats,
    getEmployeeById,
  } = useApp();

  const query = searchQuery.toLowerCase();

  const results: SearchResult[] = [];

  // Search news
  news.forEach((item) => {
    if (
      item.title.toLowerCase().includes(query) ||
      item.body.toLowerCase().includes(query) ||
      item.tags.some((t) => t.toLowerCase().includes(query))
    ) {
      results.push({
        id: item.id,
        type: "news",
        title: item.title,
        description: item.body.slice(0, 100) + "...",
        section: "Новости",
      });
    }
  });

  // Search protocols
  protocols.forEach((item) => {
    if (
      item.title.toLowerCase().includes(query) ||
      item.attendees.some((a) => a.toLowerCase().includes(query)) ||
      item.decisions.some((d) => d.text.toLowerCase().includes(query))
    ) {
      results.push({
        id: item.id,
        type: "protocols",
        title: item.title,
        description: `${item.date} • ${item.attendees.length} участников`,
        section: "Протоколы",
      });
    }
  });

  // Search tasks
  tasks.forEach((item) => {
    const assignee = getEmployeeById(item.assignee);
    if (
      item.title.toLowerCase().includes(query) ||
      item.labels.some((l) => l.toLowerCase().includes(query)) ||
      assignee?.name.toLowerCase().includes(query)
    ) {
      results.push({
        id: item.id,
        type: "tasks",
        title: item.title,
        description: `${assignee?.name || "—"} • ${item.due}`,
        section: "Задачи",
      });
    }
  });

  // Search employees
  employees.forEach((item) => {
    if (
      item.name.toLowerCase().includes(query) ||
      item.role.toLowerCase().includes(query) ||
      item.dept.toLowerCase().includes(query) ||
      item.email.toLowerCase().includes(query)
    ) {
      results.push({
        id: item.id,
        type: "hr",
        title: item.name,
        description: `${item.role} • ${item.dept}`,
        section: "HR и Офис",
      });
    }
  });

  // Search knowledge base
  kbRubrics.forEach((rubric) => {
    rubric.docs.forEach((doc) => {
      if (
        doc.title.toLowerCase().includes(query) ||
        doc.body.toLowerCase().includes(query)
      ) {
        results.push({
          id: doc.id,
          type: "knowledge",
          title: doc.title,
          description: `${rubric.title} • ${doc.type.toUpperCase()}`,
          section: "База знаний",
        });
      }
    });
  });

  // Search chats
  chats.forEach((chat) => {
    if (
      chat.title.toLowerCase().includes(query) ||
      chat.messages.some((m) => m.text.toLowerCase().includes(query))
    ) {
      results.push({
        id: chat.id,
        type: "chats",
        title: chat.title,
        description: `${chat.messages.length} сообщений`,
        section: "Чаты",
      });
    }
  });

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
        <span className="chip">{results.length}</span>
      </div>

      {results.length > 0 ? (
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
