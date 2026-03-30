import { useState, useMemo, useRef, useEffect } from "react";
import { Plus, Building, Search, Loader2, Trash2, Edit2, X, ChevronDown, ChevronUp, GripVertical, Phone, MapPin, Calendar, Clock, DollarSign, MessageSquare, Tag } from "lucide-react";
import { TenderInteractionsList } from "@/components/tenders/TenderInteractionsList";
import { TenderContactsList } from "@/components/tenders/TenderContactsList";
import { TenderComments } from "@/components/tenders/TenderComments";
import { TenderChecklist } from "@/components/tenders/TenderChecklist";
import { proxySelect } from "@/lib/dbProxy";
import { useEmployees, getEmployeeDisplayName } from "@/hooks/useEmployees";
import {
  useTenders,
  useCreateTender,
  useUpdateTender,
  useDeleteTender,
  useCreateTenderCompany,
  useTenderCompanies,
  DbTender,
  DbTenderCompany,
  TenderStatus,
  TENDER_STATUS_LABELS,
  TENDER_STATUS_COLUMNS,
} from "@/hooks/useTenders";
import { useDadataSuggest, DadataSuggestion } from "@/hooks/useDadataSuggest";
import { toast } from "sonner";
import { Modal } from "@/components/ui/Modal";

// ── Status column colors ──
const STATUS_COLORS: Record<TenderStatus, string> = {
  first_contact: "from-amber-400 to-amber-500",
  in_progress: "from-blue-500 to-indigo-500",
  meeting: "from-violet-500 to-purple-500",
  won: "from-emerald-400 to-green-500",
  lost: "from-rose-400 to-red-500",
  cancelled: "from-slate-400 to-gray-500",
};

const STATUS_BG: Record<TenderStatus, string> = {
  first_contact: "bg-amber-500/10 text-amber-700 dark:text-amber-400",
  in_progress: "bg-blue-500/10 text-blue-700 dark:text-blue-400",
  meeting: "bg-purple-500/10 text-purple-700 dark:text-purple-400",
  won: "bg-green-500/10 text-green-700 dark:text-green-400",
  lost: "bg-red-500/10 text-red-700 dark:text-red-400",
  cancelled: "bg-gray-500/10 text-gray-600 dark:text-gray-400",
};

const STATUS_ICON: Record<TenderStatus, string> = {
  first_contact: "🔥",
  in_progress: "⚡",
  meeting: "🤝",
  won: "🏆",
  lost: "💔",
  cancelled: "⛔",
};

export function TendersKanbanModule() {
  const { data: tenders = [], isLoading } = useTenders();
  const createTender = useCreateTender();
  const updateTender = useUpdateTender();
  const deleteTender = useDeleteTender();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingTender, setEditingTender] = useState<DbTender | null>(null);
  const [viewingTender, setViewingTender] = useState<DbTender | null>(null);

  const grouped = useMemo(() => {
    const map: Record<TenderStatus, DbTender[]> = {} as any;
    TENDER_STATUS_COLUMNS.forEach((s) => (map[s] = []));
    tenders.forEach((t) => {
      if (map[t.status]) map[t.status].push(t);
      else map.in_progress.push(t);
    });
    return map;
  }, [tenders]);

  const handleStatusChange = (tenderId: string, newStatus: TenderStatus) => {
    updateTender.mutate({ id: tenderId, status: newStatus });
  };

  const handleDelete = (id: string) => {
    deleteTender.mutate(id, {
      onSuccess: () => {
        toast.success("Тендер удалён");
        setViewingTender(null);
      },
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent">
            Тендеры
          </h1>
          <p className="text-sm text-muted-foreground mt-1">{tenders.length} проектов в работе</p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-accent to-accent/80 text-accent-foreground rounded-xl text-sm font-semibold hover:shadow-lg hover:shadow-accent/25 hover:-translate-y-0.5 transition-all duration-200"
        >
          <Plus className="w-4 h-4" />
          Новый тендер
        </button>
      </div>

      {/* Kanban Board */}
      <div className="flex gap-4 overflow-x-auto pb-4">
        {TENDER_STATUS_COLUMNS.map((status) => (
          <KanbanColumn
            key={status}
            status={status}
            tenders={grouped[status]}
            onStatusChange={handleStatusChange}
            onView={setViewingTender}
            onEdit={setEditingTender}
          />
        ))}
      </div>

      {/* Create Modal */}
      {showCreateModal && (
        <CreateTenderModal
          onClose={() => setShowCreateModal(false)}
          onCreate={async (data) => {
            await createTender.mutateAsync(data);
            toast.success("Тендер создан");
            setShowCreateModal(false);
          }}
        />
      )}

      {/* Edit Modal */}
      {editingTender && (
        <CreateTenderModal
          initialData={editingTender}
          onClose={() => setEditingTender(null)}
          onCreate={async (data) => {
            await updateTender.mutateAsync({ id: editingTender.id, ...data });
            toast.success("Тендер обновлён");
            setEditingTender(null);
          }}
        />
      )}

      {/* View Modal */}
      {viewingTender && (
        <TenderDetailModal
          tender={viewingTender}
          onClose={() => setViewingTender(null)}
          onEdit={() => {
            setEditingTender(viewingTender);
            setViewingTender(null);
          }}
          onDelete={() => handleDelete(viewingTender.id)}
          onStatusChange={(s) => {
            handleStatusChange(viewingTender.id, s);
            setViewingTender({ ...viewingTender, status: s });
          }}
        />
      )}
    </div>
  );
}

// ── Kanban Column ──
function KanbanColumn({
  status,
  tenders,
  onStatusChange,
  onView,
  onEdit,
}: {
  status: TenderStatus;
  tenders: DbTender[];
  onStatusChange: (id: string, status: TenderStatus) => void;
  onView: (t: DbTender) => void;
  onEdit: (t: DbTender) => void;
}) {
  return (
    <div className="flex-shrink-0 w-72 md:w-80">
      <div className="rounded-2xl bg-card/80 backdrop-blur-sm border border-border/40 overflow-hidden shadow-sm hover:shadow-md transition-shadow duration-300">
        {/* Gradient top bar */}
        <div className={`h-1.5 bg-gradient-to-r ${STATUS_COLORS[status]}`} />
        {/* Column Header */}
        <div className="px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className="text-lg">{STATUS_ICON[status]}</span>
            <span className="font-semibold text-sm text-foreground">
              {TENDER_STATUS_LABELS[status]}
            </span>
          </div>
          <span className="text-xs font-bold bg-muted text-muted-foreground px-2 py-0.5 rounded-full min-w-[24px] text-center">
            {tenders.length}
          </span>
        </div>

        {/* Cards */}
        <div className="px-3 pb-3 space-y-2.5 max-h-[calc(100vh-280px)] overflow-y-auto">
          {tenders.length === 0 && (
            <div className="flex flex-col items-center py-8 text-muted-foreground/50">
              <div className="text-3xl mb-2 opacity-50">{STATUS_ICON[status]}</div>
              <p className="text-xs">Нет тендеров</p>
            </div>
          )}
          {tenders.map((tender) => (
            <TenderCard
              key={tender.id}
              tender={tender}
              onClick={() => onView(tender)}
              onStatusChange={onStatusChange}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Tender Card ──
function TenderCard({
  tender,
  onClick,
  onStatusChange,
}: {
  tender: DbTender;
  onClick: () => void;
  onStatusChange: (id: string, status: TenderStatus) => void;
}) {
  const { data: employees = [] } = useEmployees();
  const managerName = useMemo(() => {
    if (!tender.manager) return null;
    const emp = employees.find(e => e.profile_id === tender.manager);
    return emp ? getEmployeeDisplayName(emp) : tender.manager;
  }, [tender.manager, employees]);
  return (
    <div
      onClick={onClick}
      className="bg-background rounded-xl border border-border/40 p-3.5 cursor-pointer hover:shadow-lg hover:shadow-primary/5 hover:border-primary/20 hover:-translate-y-0.5 transition-all duration-300 group relative overflow-hidden"
    >
      {/* Subtle gradient overlay on hover */}
      <div className="absolute inset-0 bg-gradient-to-br from-primary/[0.02] to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />
      
      <div className="relative">
        <div className="flex items-start justify-between gap-2 mb-2">
          <h4 className="text-sm font-bold text-foreground line-clamp-2 group-hover:text-primary transition-colors duration-200">
            {tender.project_name}
          </h4>
          {tender.lead_grade && (
            <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold whitespace-nowrap shrink-0 ${
              tender.lead_grade === "горячие" ? "bg-gradient-to-r from-red-500/15 to-orange-500/15 text-red-600 dark:text-red-400" :
              tender.lead_grade === "теплые/подогретые" ? "bg-gradient-to-r from-orange-500/15 to-amber-500/15 text-orange-600 dark:text-orange-400" :
              tender.lead_grade === "в процессе.." ? "bg-gradient-to-r from-blue-500/15 to-indigo-500/15 text-blue-600 dark:text-blue-400" :
              "bg-muted text-muted-foreground"
            }`}>
              {tender.lead_grade === "горячие" ? "🔥" : tender.lead_grade === "теплые/подогретые" ? "🌡️" : "⏳"} {tender.lead_grade}
            </span>
          )}
        </div>

        {tender.company && (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-2">
            <div className="w-5 h-5 rounded-md bg-primary/8 flex items-center justify-center shrink-0">
              <Building className="w-3 h-3 text-primary/70" />
            </div>
            <span className="truncate font-medium">{tender.company.name}</span>
          </div>
        )}

        {tender.area_address && (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-2">
            <MapPin className="w-3 h-3 shrink-0 text-muted-foreground/60" />
            <span className="truncate">{tender.area_address}</span>
          </div>
        )}

        <div className="flex items-center justify-between mt-2.5 pt-2 border-t border-border/20">
          {managerName ? (
            <div className="flex items-center gap-1.5">
              <div className="w-5 h-5 rounded-full bg-primary/10 flex items-center justify-center text-[10px] font-bold text-primary">
                {managerName.charAt(0)}
              </div>
              <span className="text-xs text-muted-foreground truncate">{managerName}</span>
            </div>
          ) : <div />}
          {tender.source && (
            <span className="text-[10px] bg-secondary/80 px-2 py-0.5 rounded-full text-muted-foreground truncate max-w-[120px] font-medium">
              {tender.source}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Create/Edit Modal ──
function CreateTenderModal({
  onClose,
  onCreate,
  initialData,
}: {
  onClose: () => void;
  onCreate: (data: Partial<DbTender>) => Promise<void>;
  initialData?: DbTender;
}) {
  const [projectName, setProjectName] = useState(initialData?.project_name || "");
  const [status, setStatus] = useState<TenderStatus>(initialData?.status || "in_progress");
  const [source, setSource] = useState(initialData?.source || "");
  const [manager, setManager] = useState(initialData?.manager || "");
  const [contactInfo, setContactInfo] = useState(initialData?.contact_info || "");
  const [areaAddress, setAreaAddress] = useState(initialData?.area_address || "");
  const [interactionHistory, setInteractionHistory] = useState(initialData?.interaction_history || "");
  const [tenderStartDate, setTenderStartDate] = useState(initialData?.tender_start_date || "");
  const [durationMonths, setDurationMonths] = useState(initialData?.duration_months?.toString() || "");
  const [budget, setBudget] = useState(initialData?.budget || "");
  const [notes, setNotes] = useState(initialData?.notes || "");
  const [leadGrade, setLeadGrade] = useState(initialData?.lead_grade || "");
  const [saving, setSaving] = useState(false);
  const { data: employees = [] } = useEmployees();
  // Company search
  const { suggestions, loading: searchLoading, search, clear } = useDadataSuggest();
  const [companyQuery, setCompanyQuery] = useState(initialData?.company?.name || "");
  const [selectedCompany, setSelectedCompany] = useState<DadataSuggestion | null>(
    initialData?.company ? {
      inn: initialData.company.inn,
      name: initialData.company.name,
      full_name: initialData.company.full_name,
      ogrn: initialData.company.ogrn,
      address: initialData.company.address,
    } : null
  );
  const [showSuggestions, setShowSuggestions] = useState(false);
  const createCompany = useCreateTenderCompany();
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout>>();

  const handleCompanySearch = (val: string) => {
    setCompanyQuery(val);
    setSelectedCompany(null);
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    if (val.length >= 2) {
      searchTimeoutRef.current = setTimeout(() => {
        search(val);
        setShowSuggestions(true);
      }, 300);
    } else {
      clear();
      setShowSuggestions(false);
    }
  };

  const handleSelectCompany = (s: DadataSuggestion) => {
    setSelectedCompany(s);
    setCompanyQuery(s.name);
    setShowSuggestions(false);
    clear();
  };

  const handleSubmit = async () => {
    if (!projectName.trim()) return;
    setSaving(true);
    try {
      let company_id = initialData?.company_id || null;

      if (selectedCompany) {
        // Create or find company
        const companyData: any = {
          name: selectedCompany.name,
          full_name: selectedCompany.full_name,
          inn: selectedCompany.inn,
          ogrn: selectedCompany.ogrn,
          address: selectedCompany.address,
        };
        const result = await createCompany.mutateAsync(companyData);
        company_id = (result as any)?.[0]?.id || null;
      }

      await onCreate({
        project_name: projectName.trim(),
        status,
        source: source || null,
        manager: manager || null,
        contact_info: contactInfo || null,
        area_address: areaAddress || null,
        interaction_history: interactionHistory || null,
        tender_start_date: tenderStartDate || null,
        duration_months: durationMonths ? parseInt(durationMonths) : null,
        budget: budget || null,
        notes: notes || null,
        lead_grade: leadGrade || null,
        company_id,
      });
    } catch (e: any) {
      toast.error(e.message || "Ошибка сохранения");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      isOpen
      onClose={onClose}
      title={initialData ? "Редактировать тендер" : "Новый тендер"}
    >
      <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
        {/* Project Name */}
        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1 block">Название проекта *</label>
          <input
            type="text"
            value={projectName}
            onChange={(e) => setProjectName(e.target.value)}
            className="input-base w-full"
            placeholder="Например: Офис ЛУКОЙЛ"
          />
        </div>

        {/* Company Search */}
        <div className="relative">
          <label className="text-xs font-medium text-muted-foreground mb-1 block">Компания (поиск по ИНН или названию)</label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              value={companyQuery}
              onChange={(e) => handleCompanySearch(e.target.value)}
              onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
              className="input-base w-full pl-9"
              placeholder="Введите ИНН или название компании"
            />
            {searchLoading && (
              <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-muted-foreground" />
            )}
          </div>
          {showSuggestions && suggestions.length > 0 && (
            <div className="absolute z-50 w-full mt-1 bg-popover border border-border rounded-lg shadow-lg max-h-60 overflow-y-auto">
              {suggestions.map((s, i) => (
                <button
                  key={`${s.inn}-${i}`}
                  onClick={() => handleSelectCompany(s)}
                  className="w-full text-left px-3 py-2.5 hover:bg-accent/50 transition-colors border-b border-border/30 last:border-0"
                >
                  <div className="font-medium text-sm text-foreground">{s.name}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    {s.inn && <span>ИНН {s.inn}</span>}
                    {s.address && <span className="ml-2">· {s.address}</span>}
                  </div>
                </button>
              ))}
            </div>
          )}
          {selectedCompany && (
            <div className="mt-2 p-2 bg-accent/30 rounded-lg text-xs">
              <div className="font-medium">{selectedCompany.name}</div>
              {selectedCompany.inn && <span className="text-muted-foreground">ИНН: {selectedCompany.inn}</span>}
            </div>
          )}
        </div>

        {/* Status */}
        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1 block">Статус</label>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as TenderStatus)}
            className="input-base w-full"
          >
            {TENDER_STATUS_COLUMNS.map((s) => (
              <option key={s} value={s}>{TENDER_STATUS_LABELS[s]}</option>
            ))}
          </select>
        </div>

        {/* Two columns */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Менеджер</label>
            <select value={manager} onChange={(e) => setManager(e.target.value)} className="input-base w-full">
              <option value="">Не выбран</option>
              {employees.map((emp) => {
                const name = getEmployeeDisplayName(emp);
                return (
                  <option key={emp.id} value={emp.profile_id || emp.id}>{name}</option>
                );
              })}
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Источник</label>
            <input type="text" value={source} onChange={(e) => setSource(e.target.value)} className="input-base w-full" placeholder="Лидогенератор, рекомендация..." />
          </div>
        </div>

        {/* Contact Info */}
        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1 block">Контакты ЛПР / Информация</label>
          <textarea
            value={contactInfo}
            onChange={(e) => setContactInfo(e.target.value)}
            className="input-base w-full min-h-[60px] resize-y"
            placeholder="ФИО, телефон, описание контакта..."
          />
        </div>

        {/* Area/Address */}
        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1 block">Площадь / Адрес объекта</label>
          <input type="text" value={areaAddress} onChange={(e) => setAreaAddress(e.target.value)} className="input-base w-full" placeholder="1000м, офис, ст.м. ..." />
        </div>

        {/* Dates and Duration */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Дата начала тендера</label>
            <input type="date" value={tenderStartDate} onChange={(e) => setTenderStartDate(e.target.value)} className="input-base w-full" />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Срок реализации (мес.)</label>
            <input type="number" value={durationMonths} onChange={(e) => setDurationMonths(e.target.value)} className="input-base w-full" placeholder="6" />
          </div>
        </div>

        {/* Budget */}
        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1 block">Бюджет</label>
          <input type="text" value={budget} onChange={(e) => setBudget(e.target.value)} className="input-base w-full" placeholder="от 5 млн..." />
        </div>

        {/* Lead Grade */}
        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1 block">Степень проработки лида</label>
          <select value={leadGrade} onChange={(e) => setLeadGrade(e.target.value)} className="input-base w-full">
            <option value="">Не указана</option>
            <option value="горячие">🔥 Горячие</option>
            <option value="теплые/подогретые">🌡️ Тёплые / подогретые</option>
            <option value="в процессе..">⏳ В процессе</option>
            <option value="отбой">❌ Отбой</option>
          </select>
        </div>

        {/* History */}
        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1 block">История взаимодействий</label>
          <textarea
            value={interactionHistory}
            onChange={(e) => setInteractionHistory(e.target.value)}
            className="input-base w-full min-h-[80px] resize-y"
            placeholder="Хронология контактов..."
          />
        </div>

        {/* Notes */}
        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1 block">Примечание</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="input-base w-full min-h-[60px] resize-y"
          />
        </div>
      </div>

      {/* Actions */}
      <div className="flex justify-end gap-2 mt-4 pt-4 border-t border-border">
        <button onClick={onClose} className="px-4 py-2 text-sm text-muted-foreground hover:bg-secondary rounded-lg transition-colors">
          Отмена
        </button>
        <button
          onClick={handleSubmit}
          disabled={!projectName.trim() || saving}
          className="px-4 py-2 text-sm bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center gap-2"
        >
          {saving && <Loader2 className="w-4 h-4 animate-spin" />}
          {initialData ? "Сохранить" : "Создать"}
        </button>
      </div>
    </Modal>
  );
}

// ── Detail Modal ──
function TenderDetailModal({
  tender,
  onClose,
  onEdit,
  onDelete,
  onStatusChange,
}: {
  tender: DbTender;
  onClose: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onStatusChange: (s: TenderStatus) => void;
}) {
  const [profiles, setProfiles] = useState<{ id: string; first_name: string | null; last_name: string | null; avatar_url: string | null }[]>([]);
  const { data: employees = [] } = useEmployees();
  useEffect(() => {
    proxySelect<{ id: string; first_name: string | null; last_name: string | null; avatar_url: string | null }>("profiles", {
      select: "id,first_name,last_name,avatar_url",
    }).then(({ data }) => setProfiles(data || []));
  }, []);
  const managerName = useMemo(() => {
    if (!tender.manager) return null;
    const emp = employees.find(e => e.profile_id === tender.manager);
    return emp ? getEmployeeDisplayName(emp) : tender.manager;
  }, [tender.manager, employees]);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 animate-fade-in" onClick={onClose}>
      <div
        className="bg-card rounded-2xl shadow-2xl w-full max-w-4xl mx-4 overflow-hidden animate-scale-in"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header with actions */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h3 className="text-lg font-bold text-foreground truncate">{tender.project_name}</h3>
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              onClick={onEdit}
              className="p-2 text-muted-foreground hover:text-primary hover:bg-primary/10 rounded-lg transition-colors"
              title="Редактировать"
            >
              <Edit2 className="w-4 h-4" />
            </button>
            <button
              onClick={onDelete}
              className="p-2 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg transition-colors"
              title="Удалить"
            >
              <Trash2 className="w-4 h-4" />
            </button>
            <button
              onClick={onClose}
              className="p-2 text-muted-foreground hover:text-foreground hover:bg-secondary rounded-lg transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="px-6 py-5 max-h-[75vh] overflow-y-auto">
          {/* Status selector */}
          <div className="flex items-center gap-2 flex-wrap mb-5">
            {TENDER_STATUS_COLUMNS.map((s) => (
              <button
                key={s}
                onClick={() => onStatusChange(s)}
                className={`px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all duration-200 ${
                  tender.status === s
                    ? STATUS_BG[s] + " shadow-sm ring-2 ring-offset-2 ring-offset-background ring-current scale-105"
                    : "bg-muted/60 text-muted-foreground hover:bg-muted hover:scale-105"
                }`}
              >
                {STATUS_ICON[s]} {TENDER_STATUS_LABELS[s]}
              </button>
            ))}
          </div>

          {/* Two-column layout on desktop */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Left column — Info */}
            <div className="space-y-4">
              {tender.company && (
                <div className="p-4 rounded-xl bg-gradient-to-br from-primary/5 to-primary/[0.02] border border-primary/10">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                      <Building className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <div className="font-semibold text-foreground">{tender.company.name}</div>
                      {tender.company.inn && (
                        <div className="text-xs text-muted-foreground">ИНН {tender.company.inn}</div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                {managerName && <DetailCard icon={Tag} label="Менеджер" value={managerName} />}
                {tender.source && <DetailCard icon={Tag} label="Источник" value={tender.source} />}
                {tender.area_address && <DetailCard icon={MapPin} label="Площадь / Адрес" value={tender.area_address} />}
                {tender.budget && <DetailCard icon={DollarSign} label="Бюджет" value={tender.budget} />}
                {tender.tender_start_date && <DetailCard icon={Calendar} label="Дата начала" value={tender.tender_start_date} />}
                {tender.duration_months && <DetailCard icon={Clock} label="Срок" value={`${tender.duration_months} мес.`} />}
                {tender.lead_grade && <DetailCard icon={Tag} label="Степень лида" value={tender.lead_grade} />}
              </div>

              {tender.notes && (
                <div className="p-3 rounded-xl bg-muted/30 border border-border/30">
                  <div className="text-xs font-medium text-muted-foreground mb-1.5">Примечание</div>
                  <div className="text-sm text-foreground whitespace-pre-wrap">{tender.notes}</div>
                </div>
              )}

              <div className="p-4 rounded-xl bg-card border border-border/50">
                <TenderContactsList tenderId={tender.id} />
              </div>
            </div>

            {/* Right column */}
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-card border border-border/50">
                <TenderInteractionsList tenderId={tender.id} />
              </div>
              <div className="p-4 rounded-xl bg-card border border-border/50">
                <TenderComments tenderId={tender.id} profiles={profiles} />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function DetailCard({ icon: Icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <div className="p-3 rounded-xl bg-muted/20 border border-border/30">
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
        <Icon className="w-3.5 h-3.5" />
        {label}
      </div>
      <div className="text-sm font-medium text-foreground">{value}</div>
    </div>
  );
}
