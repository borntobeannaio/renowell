import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, ChevronDown, ChevronUp, Download, Pencil, Copy, FolderOpen, User, Calendar, CheckCircle2 } from "lucide-react";
import { useProtocols, useProtocolItems, DbProtocol, DbProtocolItem } from "@/hooks/useProtocols";
import { useProjects } from "@/hooks/useProjects";
import { generateProtocolPdf } from "@/utils/protocolPdf";
import { formatDisplayDate } from "@/utils/dateFormat";
import { toast } from "sonner";

export function ProtocolsModule() {
  const navigate = useNavigate();
  const { data: protocols = [], isLoading } = useProtocols();
  const { data: projects = [] } = useProjects();
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const handleNewProtocol = () => {
    window.open('/protocols/new', '_blank');
  };

  const handleCopyProtocol = (protocolId: string) => {
    window.open(`/protocols/new?copy=${protocolId}`, '_blank');
  };

  const handleEditProtocol = (protocolId: string) => {
    window.open(`/protocols/edit/${protocolId}`, '_blank');
  };

  return (
    <div className="space-y-4 md:space-y-6">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm md:text-base text-muted-foreground">
          Протоколов: {protocols.length}
        </p>
        <button
          onClick={handleNewProtocol}
          className="btn-primary h-9 md:h-11 px-3 md:px-5 flex items-center gap-2 text-sm md:text-base"
        >
          <Plus className="w-4 h-4" />
          <span className="hidden sm:inline">Новый протокол</span>
          <span className="sm:hidden">Добавить</span>
        </button>
      </div>

      <div className="space-y-4">
        {isLoading ? (
          <div className="text-center py-12 text-muted-foreground">
            Загрузка...
          </div>
        ) : protocols.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            Нет протоколов
          </div>
        ) : (
          protocols.map((protocol) => (
            <ProtocolCard
              key={protocol.id}
              protocol={protocol}
              projects={projects}
              isExpanded={expandedId === protocol.id}
              onToggleExpand={() => setExpandedId(expandedId === protocol.id ? null : protocol.id)}
              onEdit={() => handleEditProtocol(protocol.id)}
              onCopy={() => handleCopyProtocol(protocol.id)}
            />
          ))
        )}
      </div>
    </div>
  );
}

interface ProtocolCardProps {
  protocol: DbProtocol;
  projects: { id: string; name: string }[];
  isExpanded: boolean;
  onToggleExpand: () => void;
  onEdit: () => void;
  onCopy: () => void;
}

function ProtocolCard({
  protocol,
  projects,
  isExpanded,
  onToggleExpand,
  onEdit,
  onCopy,
}: ProtocolCardProps) {
  const { data: items = [] } = useProtocolItems(isExpanded ? protocol.id : null);

  const handleExportPdf = async () => {
    try {
      await generateProtocolPdf(protocol, items, projects);
      toast.success("PDF экспортирован");
    } catch (error) {
      console.error("PDF export error:", error);
      toast.error("Ошибка экспорта PDF");
    }
  };

  // Group items by project
  const itemsByProject = useMemo(() => {
    const groups: Record<string, typeof items> = {};
    items.forEach((item) => {
      const key = item.project_id || "no_project";
      if (!groups[key]) groups[key] = [];
      groups[key].push(item);
    });
    return groups;
  }, [items]);

  const getProjectName = (projectId: string | null) => {
    if (!projectId) return "Без проекта";
    return projects.find((p) => p.id === projectId)?.name || "Неизвестный проект";
  };

  return (
    <div className="card-base overflow-hidden animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between p-4 hover:bg-secondary/50 transition-colors">
        <button
          onClick={onToggleExpand}
          className="flex items-center gap-4 flex-1 text-left"
        >
          <span className="text-sm font-medium text-primary">
            №{protocol.number}
          </span>
          <span className="text-sm text-muted-foreground">
            {formatDisplayDate(protocol.date)}
          </span>
          <h3 className="font-medium text-foreground flex-1">{protocol.title}</h3>
          <span className="chip shrink-0">
            {protocol.attendees.length} участников
          </span>
        </button>
        <div className="flex items-center gap-1">
          <button
            onClick={onCopy}
            className="p-2 text-muted-foreground hover:text-primary hover:bg-primary/10 rounded-lg transition-colors"
            title="Копировать протокол"
          >
            <Copy className="w-4 h-4" />
          </button>
          <button
            onClick={onEdit}
            className="p-2 text-muted-foreground hover:text-primary hover:bg-primary/10 rounded-lg transition-colors"
            title="Редактировать протокол"
          >
            <Pencil className="w-4 h-4" />
          </button>
          <button
            onClick={handleExportPdf}
            className="p-2 text-muted-foreground hover:text-primary hover:bg-primary/10 rounded-lg transition-colors"
            title="Экспорт в PDF"
          >
            <Download className="w-4 h-4" />
          </button>
          <button onClick={onToggleExpand} className="p-2">
            {isExpanded ? (
              <ChevronUp className="w-5 h-5 text-muted-foreground" />
            ) : (
              <ChevronDown className="w-5 h-5 text-muted-foreground" />
            )}
          </button>
        </div>
      </div>

      {/* Expanded content (read-only) */}
      {isExpanded && (
        <div className="px-4 pb-4 border-t border-border animate-slide-up">
          <div className="pt-4 space-y-4">
            {/* Attendees */}
            {protocol.attendees.length > 0 && (
              <div>
                <h4 className="text-sm font-medium text-muted-foreground mb-2">
                  Участники
                </h4>
                <div className="flex flex-wrap gap-2">
                  {protocol.attendees.map((a, i) => (
                    <span key={i} className="chip">
                      {a}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Items grouped by project */}
            <div>
              <h4 className="text-sm font-medium text-muted-foreground mb-3">
                Пункты протокола
              </h4>

              {Object.entries(itemsByProject).length === 0 ? (
                <p className="text-sm text-muted-foreground">Нет пунктов</p>
              ) : (
                Object.entries(itemsByProject).map(([projectId, projectItems]) => (
                  <div key={projectId} className="mb-4">
                    <div className="flex items-center gap-2 mb-2">
                      <FolderOpen className="w-4 h-4 text-primary" />
                      <span className="font-medium text-foreground">
                        {getProjectName(projectId === "no_project" ? null : projectId)}
                      </span>
                    </div>
                    <div className="ml-6 space-y-2">
                      {projectItems.map((item) => (
                        <ProtocolItemView key={item.id} item={item} />
                      ))}
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Edit button */}
            <div className="pt-4 border-t border-border flex justify-end">
              <button
                onClick={onEdit}
                className="btn-secondary text-sm flex items-center gap-2"
              >
                <Pencil className="w-4 h-4" />
                Редактировать
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

interface ProtocolItemViewProps {
  item: DbProtocolItem;
}

function ProtocolItemView({ item }: ProtocolItemViewProps) {
  return (
    <div className="p-3 bg-secondary/50 rounded-lg">
      <p className="text-foreground">{item.item_text}</p>
      <div className="flex flex-wrap items-center gap-3 mt-2 text-sm">
        {item.responsible && (
          <div className="flex items-center gap-1 text-muted-foreground">
            <User className="w-3.5 h-3.5" />
            <span>{item.responsible}</span>
          </div>
        )}
        {item.due_date && (
          <div className="flex items-center gap-1 text-muted-foreground">
            <Calendar className="w-3.5 h-3.5" />
            <span>{formatDisplayDate(item.due_date)}</span>
          </div>
        )}
        {item.create_task && (
          <span className="chip-success shrink-0 flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3" />
            Задача
          </span>
        )}
      </div>
    </div>
  );
}
