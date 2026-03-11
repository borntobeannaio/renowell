import { useState, useMemo, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, ChevronDown, ChevronUp, Download, Pencil, Copy, FolderOpen, User, Calendar, CheckCircle2, Trash2, Loader2, Building, Users, Briefcase, Target, MessageCircle } from "lucide-react";
import { useProtocols, useProtocolItems, useDeleteProtocol, DbProtocol, DbProtocolItem } from "@/hooks/useProtocols";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useProjects } from "@/hooks/useProjects";
import { useProtocolPermissions } from "@/hooks/useProtocolPermissions";
import { proxySelect } from "@/lib/dbProxy";

interface ItemComment {
  id: string;
  item_id: string;
  author_id: string;
  content: string;
  created_at: string;
  author_name?: string;
}
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
import { DraftsSection } from "./protocols/DraftsSection";

export function ProtocolsModule() {
  const navigate = useNavigate();
  const { data: protocols = [], isLoading } = useProtocols();
  const { data: projects = [] } = useProjects();
  const deleteProtocol = useDeleteProtocol();
  const { canCreateProtocol, canEditProtocols, canCopyProtocol, canDeleteProtocol } = useProtocolPermissions();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [protocolToDelete, setProtocolToDelete] = useState<DbProtocol | null>(null);

  // Split protocols into meeting and tender
  const meetingProtocols = useMemo(() => protocols.filter(p => p.meeting_type !== 'tender'), [protocols]);
  const tenderProtocols = useMemo(() => protocols.filter(p => p.meeting_type === 'tender'), [protocols]);

  const handleNewProtocol = () => {
    window.open('/protocols/new', '_blank');
  };

  const handleNewTenderProtocol = () => {
    window.open('/protocols/new?type=tender', '_blank');
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

  const renderProtocolList = (list: DbProtocol[]) => {
    if (isLoading) {
      return <div className="text-center py-12 text-muted-foreground">Загрузка...</div>;
    }
    if (list.length === 0) {
      return <div className="text-center py-12 text-muted-foreground">Нет протоколов</div>;
    }
    return list.map((protocol) => (
      <ProtocolCard
        key={protocol.id}
        protocol={protocol}
        projects={projects}
        isExpanded={expandedId === protocol.id}
        onToggleExpand={() => setExpandedId(expandedId === protocol.id ? null : protocol.id)}
        onEdit={canEditProtocols ? () => handleEditProtocol(protocol.id) : undefined}
        onCopy={canCopyProtocol ? () => handleCopyProtocol(protocol.id) : undefined}
        onDelete={canDeleteProtocol ? () => handleDeleteClick(protocol) : undefined}
      />
    ));
  };

  return (
    <div className="space-y-4 md:space-y-6">
      <Tabs defaultValue="meetings" className="w-full">
        <div className="flex items-center justify-between gap-2">
          <TabsList>
            <TabsTrigger value="meetings">
              Протоколы совещаний
              <span className="ml-1.5 text-xs text-muted-foreground">({meetingProtocols.length})</span>
            </TabsTrigger>
            <TabsTrigger value="tenders" className="gap-1.5">
              <Building className="w-3.5 h-3.5" />
              Тендер-протоколы
              <span className="ml-1.5 text-xs text-muted-foreground">({tenderProtocols.length})</span>
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="meetings" className="space-y-4">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm md:text-base text-muted-foreground">
              Протоколов: {meetingProtocols.length}
            </p>
            {canCreateProtocol && (
              <button
                onClick={handleNewProtocol}
                className="btn-primary h-9 md:h-11 px-3 md:px-5 flex items-center gap-2 text-sm md:text-base"
              >
                <Plus className="w-4 h-4" />
                <span className="hidden sm:inline">Новый протокол</span>
                <span className="sm:hidden">Добавить</span>
              </button>
            )}
          </div>

          {canEditProtocols && <DraftsSection />}

          <div className="space-y-4">
            {renderProtocolList(meetingProtocols)}
          </div>
        </TabsContent>

        <TabsContent value="tenders" className="space-y-4">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm md:text-base text-muted-foreground">
              Тендер-протоколов: {tenderProtocols.length}
            </p>
            {canCreateProtocol && (
              <button
                onClick={handleNewTenderProtocol}
                className="btn-primary h-9 md:h-11 px-3 md:px-5 flex items-center gap-2 text-sm md:text-base"
              >
                <Building className="w-4 h-4" />
                <span className="hidden sm:inline">Новый тендер-протокол</span>
                <span className="sm:hidden">Добавить</span>
              </button>
            )}
          </div>

          <div className="space-y-4">
            {renderProtocolList(tenderProtocols)}
          </div>
        </TabsContent>
      </Tabs>

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
  onEdit?: () => void;
  onCopy?: () => void;
  onDelete?: () => void;
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
  const [itemComments, setItemComments] = useState<Record<string, ItemComment[]>>({});

  // Load comments when expanded
  useEffect(() => {
    if (isExpanded && items.length > 0) {
      const loadComments = async () => {
        const itemIds = items.filter(i => !i.id.startsWith("temp-")).map(i => i.id);
        if (itemIds.length === 0) return;

        const { data: commentsData, error } = await proxySelect<ItemComment>('protocol_item_comments', {
          filters: [{ column: 'item_id', operator: 'in', value: itemIds }],
          order: [{ column: 'created_at', ascending: true }],
        });

        if (error || !commentsData || commentsData.length === 0) {
          setItemComments({});
          return;
        }

        // Fetch author names
        const authorIds = [...new Set(commentsData.map(c => c.author_id))];
        let authorMap = new Map<string, string>();
        
        if (authorIds.length > 0) {
          const { data: profiles } = await proxySelect<{
            id: string;
            first_name: string | null;
            last_name: string | null;
          }>('profiles', {
            filters: [{ column: 'id', operator: 'in', value: authorIds }],
          });
          
          authorMap = new Map(
            (profiles || []).map(p => [p.id, `${p.first_name || ''} ${p.last_name || ''}`.trim() || 'Пользователь'])
          );
        }

        // Group by item_id
        const grouped: Record<string, ItemComment[]> = {};
        commentsData.forEach(c => {
          if (!grouped[c.item_id]) grouped[c.item_id] = [];
          grouped[c.item_id].push({
            ...c,
            author_name: authorMap.get(c.author_id) || 'Пользователь'
          });
        });
        setItemComments(grouped);
      };
      loadComments();
    }
  }, [isExpanded, items]);

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

      // Fetch comments for all items
      const itemIds = (freshItems || []).map(item => item.id);
      let comments: { id: string; item_id: string; author_id: string; content: string; created_at: string }[] = [];
      
      if (itemIds.length > 0) {
        const { data: commentsData, error: commentsError } = await proxySelect<{
          id: string;
          item_id: string;
          author_id: string;
          content: string;
          created_at: string;
        }>('protocol_item_comments', {
          // IMPORTANT: dbProxy expects an array for `in` filters
          filters: [{ column: 'item_id', operator: 'in', value: itemIds }],
          order: [{ column: 'created_at', ascending: true }],
        });
        
        if (!commentsError && commentsData) {
          // Fetch author names from profiles
          const authorIds = [...new Set(commentsData.map(c => c.author_id))];
          if (authorIds.length > 0) {
            const { data: profiles } = await proxySelect<{
              id: string;
              first_name: string | null;
              last_name: string | null;
            }>('profiles', {
              filters: [{ column: 'id', operator: 'in', value: authorIds }],
            });
            
            const profileMap = new Map(
              (profiles || []).map(p => [p.id, `${p.first_name || ''} ${p.last_name || ''}`.trim() || 'Пользователь'])
            );
            
            comments = commentsData.map(c => ({
              ...c,
              author_name: profileMap.get(c.author_id) || 'Пользователь'
            }));
          } else {
            comments = commentsData;
          }
        }
      }
      
      await generateProtocolPdf(protocol, freshItems || [], projects, sections || undefined, comments);
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
    archived: boolean | null;
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
        archived: boolean | null;
      }>('protocol_sections', {
        filters: [
          { column: 'protocol_id', operator: 'eq', value: protocol.id },
          { column: 'archived', operator: 'neq', value: true },
        ],
        order: [{ column: 'sort_order', ascending: true }],
      }).then(({ data }) => {
        setSections(data || []);
      });
    }
  }, [isExpanded, protocol.id]);

  // Group items by section (excluding archived items)
  const itemsBySection = useMemo(() => {
    const groups: Record<string, typeof items> = {};
    
    // Filter out archived items
    const activeItems = items.filter(item => !item.archived);
    
    // If we have sections, group by section_id
    if (sections.length > 0) {
      sections.forEach(section => {
        groups[section.id] = activeItems.filter(item => item.section_id === section.id);
      });
      // Items without section_id
      const orphanItems = activeItems.filter(item => !item.section_id);
      if (orphanItems.length > 0) {
        groups["no_section"] = orphanItems;
      }
    } else {
      // Fallback to project grouping for legacy protocols
      activeItems.forEach((item) => {
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
        return section.entity_name || 'Тендеры';
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
          {onCopy && (
            <button
              onClick={onCopy}
              className="p-2 text-muted-foreground hover:text-primary hover:bg-primary/10 rounded-lg transition-colors"
              title="Копировать протокол"
            >
              <Copy className="w-4 h-4" />
            </button>
          )}
          {onEdit && (
            <button
              onClick={onEdit}
              className="p-2 text-muted-foreground hover:text-primary hover:bg-primary/10 rounded-lg transition-colors"
              title="Редактировать протокол"
            >
              <Pencil className="w-4 h-4" />
            </button>
          )}
          <button
            onClick={handleExportPdf}
            disabled={isExporting}
            className="p-2 text-muted-foreground hover:text-primary hover:bg-primary/10 rounded-lg transition-colors disabled:opacity-50"
            title="Экспорт в PDF"
          >
            {isExporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
          </button>
          {onDelete && (
            <button
              onClick={onDelete}
              className="p-2 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg transition-colors"
              title="Удалить протокол"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
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
                                <tr key={item.id} className={`border-b border-border/50 ${item.completed ? 'opacity-60' : ''}`}>
                                  <td className="py-2 px-3 text-foreground">
                                    <span className={item.completed ? 'line-through' : ''}>{item.item_text}</span>
                                    {item.completed && (
                                      <span className="ml-2 inline-flex items-center gap-1 text-xs text-green-600 dark:text-green-400">
                                        <CheckCircle2 className="w-3 h-3" />
                                        Готово
                                      </span>
                                    )}
                                  </td>
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
                            <ProtocolItemView 
                              key={item.id} 
                              item={item} 
                              comments={itemComments[item.id] || []}
                            />
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>

            {/* Edit button */}
            {onEdit && (
              <div className="pt-4 border-t border-border flex justify-end">
                <button
                  onClick={onEdit}
                  className="btn-secondary text-sm flex items-center gap-2"
                >
                  <Pencil className="w-4 h-4" />
                  Редактировать
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

interface ProtocolItemViewProps {
  item: DbProtocolItem;
  comments?: ItemComment[];
}

function ProtocolItemView({ item, comments = [] }: ProtocolItemViewProps) {
  return (
    <div className={`p-3 bg-secondary/50 rounded-lg ${item.completed ? 'opacity-60' : ''}`}>
      <p className={`text-foreground ${item.completed ? 'line-through' : ''}`}>
        {item.item_text}
        {item.completed && (
          <span className="ml-2 inline-flex items-center gap-1 text-xs text-green-600 dark:text-green-400 no-underline">
            <CheckCircle2 className="w-3 h-3" />
            Готово
          </span>
        )}
      </p>
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
        {item.task_id && (
          <span className="chip-success shrink-0 flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3" />
            Задача
          </span>
        )}
      </div>
      
      {/* Comments section */}
      {comments.length > 0 && (
        <div className="mt-3 pt-3 border-t border-border/50 space-y-2">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <MessageCircle className="w-3.5 h-3.5" />
            <span>Комментарии ({comments.length})</span>
          </div>
          {comments.map(comment => (
            <div key={comment.id} className="text-sm pl-5">
              <span className="font-medium text-foreground">{comment.author_name}</span>
              <span className="text-muted-foreground">: {comment.content}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
