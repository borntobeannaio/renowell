import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, ChevronDown, ChevronUp, Download, Pencil, Copy, FolderOpen, User, Calendar, CheckCircle2, Trash2, Loader2, Building, Users, Briefcase, Target } from "lucide-react";
import { useProtocols, useProtocolItems, useDeleteProtocol, DbProtocol, DbProtocolItem } from "@/hooks/useProtocols";
import { useProjects } from "@/hooks/useProjects";
import { proxySelect } from "@/lib/dbProxy";
import { generateProtocolPdf } from "@/utils/protocolPdf";
import { formatDisplayDate } from "@/utils/dateFormat";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export function ProtocolsModule() {
  const navigate = useNavigate();
  const { data: protocols = [], isLoading } = useProtocols();
  const { data: projects = [] } = useProjects();
  const deleteProtocol = useDeleteProtocol();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [protocolToDelete, setProtocolToDelete] = useState<DbProtocol | null>(null);

  const handleNewProtocol = () => {
    window.open('/protocols/new', '_blank');
  };

  const handleCopyProtocol = (protocolId: string) => {
    window.open(`/protocols/new?copy=${protocolId}`, '_blank');
  };

  const handleEditProtocol = (protocolId: string) => {
    window.open(`/protocols/edit/${protocolId}`, '_blank');
  };

  const handleDeleteClick = (protocol: DbProtocol) => {
    setProtocolToDelete(protocol);
    setDeleteDialogOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!protocolToDelete) return;
    try {
      await deleteProtocol.mutateAsync(protocolToDelete.id);
      toast.success("Протокол удалён");
      setDeleteDialogOpen(false);
      setProtocolToDelete(null);
    } catch (error) {
      toast.error("Ошибка удаления протокола");
    }
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
              onDelete={() => handleDeleteClick(protocol)}
            />
          ))
        )}
      </div>

      {/* Delete confirmation dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Удалить протокол?</AlertDialogTitle>
            <AlertDialogDescription>
              Протокол №{protocolToDelete?.number} от {protocolToDelete ? formatDisplayDate(protocolToDelete.date) : ""} будет удалён вместе со всеми пунктами. Это действие нельзя отменить.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Отмена</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteProtocol.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : (
                <Trash2 className="w-4 h-4 mr-2" />
              )}
              Удалить
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
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
  onDelete: () => void;
}

function ProtocolCard({
  protocol,
  projects,
  isExpanded,
  onToggleExpand,
  onEdit,
  onCopy,
  onDelete,
}: ProtocolCardProps) {
  const { data: items = [] } = useProtocolItems(isExpanded ? protocol.id : null);
  const [isExporting, setIsExporting] = useState(false);

  const handleExportPdf = async () => {
    setIsExporting(true);
    try {
      // Fetch fresh items for PDF export
      const { data: freshItems, error: itemsError } = await proxySelect<DbProtocolItem>('protocol_items', {
        filters: [{ column: 'protocol_id', operator: 'eq', value: protocol.id }],
        order: [{ column: 'sort_order', ascending: true }],
      });
      
      if (itemsError) throw new Error(itemsError.message);
      
      // Fetch sections for proper PDF grouping
      const { data: sections, error: sectionsError } = await proxySelect<{
        id: string;
        protocol_id: string;
        section_type: string;
        entity_id: string | null;
        entity_name: string | null;
        default_responsible: string | null;
        sort_order: number | null;
      }>('protocol_sections', {
        filters: [{ column: 'protocol_id', operator: 'eq', value: protocol.id }],
        order: [{ column: 'sort_order', ascending: true }],
      });
      
      if (sectionsError) throw new Error(sectionsError.message);
      
      await generateProtocolPdf(protocol, freshItems || [], projects, sections || undefined);
      toast.success("PDF экспортирован");
    } catch (error) {
      console.error("PDF export error:", error);
      toast.error("Ошибка экспорта PDF");
    } finally {
      setIsExporting(false);
    }
  };

  // Fetch sections when expanded
  const [sections, setSections] = useState<{
    id: string;
    protocol_id: string;
    section_type: string;
    entity_id: string | null;
    entity_name: string | null;
    default_responsible: string | null;
    sort_order: number | null;
  }[]>([]);

  // Load sections when expanded
  useMemo(() => {
    if (isExpanded && protocol.id) {
      proxySelect<{
        id: string;
        protocol_id: string;
        section_type: string;
        entity_id: string | null;
        entity_name: string | null;
        default_responsible: string | null;
        sort_order: number | null;
      }>('protocol_sections', {
        filters: [{ column: 'protocol_id', operator: 'eq', value: protocol.id }],
        order: [{ column: 'sort_order', ascending: true }],
      }).then(({ data }) => {
        setSections(data || []);
      });
    }
  }, [isExpanded, protocol.id]);

  // Group items by section
  const itemsBySection = useMemo(() => {
    const groups: Record<string, typeof items> = {};
    
    // If we have sections, group by section_id
    if (sections.length > 0) {
      sections.forEach(section => {
        groups[section.id] = items.filter(item => item.section_id === section.id);
      });
      // Items without section_id
      const orphanItems = items.filter(item => !item.section_id);
      if (orphanItems.length > 0) {
        groups["no_section"] = orphanItems;
      }
    } else {
      // Fallback to project grouping for legacy protocols
      items.forEach((item) => {
        const key = item.project_id || "no_project";
        if (!groups[key]) groups[key] = [];
        groups[key].push(item);
      });
    }
    return groups;
  }, [items, sections]);

  const getSectionName = (sectionId: string) => {
    if (sectionId === "no_section") return "Без секции";
    if (sectionId === "no_project") return "Без проекта";
    
    const section = sections.find(s => s.id === sectionId);
    if (!section) {
      // Legacy: treat as project_id
      const project = projects.find(p => p.id === sectionId);
      return project?.name || "Неизвестный проект";
    }
    
    switch (section.section_type) {
      case 'project':
        if (section.entity_id) {
          const project = projects.find(p => p.id === section.entity_id);
          return project?.name || "Неизвестный проект";
        }
        return "Без проекта";
      case 'tender':
        return `Тендер: ${section.entity_name || 'Без названия'}`;
      case 'hr':
        return section.entity_name || 'Подбор персонала';
      case 'business':
        return section.entity_name || 'Бизнес задачи';
      case 'goals':
        return section.entity_name || 'Цели компании';
      default:
        return section.entity_name || 'Секция';
    }
  };

  const getSectionIcon = (sectionId: string) => {
    if (sectionId === "no_section" || sectionId === "no_project") return FolderOpen;
    const section = sections.find(s => s.id === sectionId);
    if (!section) return FolderOpen;
    
    switch (section.section_type) {
      case 'tender': return Building;
      case 'hr': return Users;
      case 'business': return Briefcase;
      case 'goals': return Target;
      default: return FolderOpen;
    }
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
            disabled={isExporting}
            className="p-2 text-muted-foreground hover:text-primary hover:bg-primary/10 rounded-lg transition-colors disabled:opacity-50"
            title="Экспорт в PDF"
          >
            {isExporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
          </button>
          <button
            onClick={onDelete}
            className="p-2 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg transition-colors"
            title="Удалить протокол"
          >
            <Trash2 className="w-4 h-4" />
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

            {/* Items grouped by section */}
            <div>
              <h4 className="text-sm font-medium text-muted-foreground mb-3">
                Пункты протокола
              </h4>

              {Object.entries(itemsBySection).length === 0 ? (
                <p className="text-sm text-muted-foreground">Нет пунктов</p>
              ) : (
                Object.entries(itemsBySection).map(([sectionId, sectionItems]) => {
                  const SectionIcon = getSectionIcon(sectionId);
                  const section = sections.find(s => s.id === sectionId);
                  const isTableSection = section?.section_type === 'hr' || section?.section_type === 'business';
                  
                  return (
                    <div key={sectionId} className="mb-4">
                      <div className="flex items-center gap-2 mb-2">
                        <SectionIcon className="w-4 h-4 text-primary" />
                        <span className="font-medium text-foreground">
                          {getSectionName(sectionId)}
                        </span>
                      </div>
                      {isTableSection ? (
                        <div className="ml-6 overflow-x-auto">
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="border-b border-border">
                                <th className="text-left py-2 px-3 font-medium text-muted-foreground">Задача</th>
                                <th className="text-left py-2 px-3 font-medium text-muted-foreground">Ответственный</th>
                                <th className="text-left py-2 px-3 font-medium text-muted-foreground">Срок</th>
                              </tr>
                            </thead>
                            <tbody>
                              {sectionItems.map((item) => (
                                <tr key={item.id} className="border-b border-border/50">
                                  <td className="py-2 px-3 text-foreground">{item.item_text}</td>
                                  <td className="py-2 px-3 text-muted-foreground">{item.responsible || '—'}</td>
                                  <td className="py-2 px-3 text-muted-foreground">
                                    {item.due_date ? formatDisplayDate(item.due_date) : '—'}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      ) : (
                        <div className="ml-6 space-y-2">
                          {sectionItems.map((item) => (
                            <ProtocolItemView key={item.id} item={item} />
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })
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
