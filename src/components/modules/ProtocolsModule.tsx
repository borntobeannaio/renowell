import { useState, useMemo, useEffect } from "react";
import { Modal } from "@/components/ui/Modal";
import { EmployeeMultiSelect } from "@/components/ui/EmployeeMultiSelect";
import { Plus, ChevronDown, ChevronUp, Trash2, FolderOpen, CheckCircle2, Download, Pencil, Check, X, Calendar, User, Copy } from "lucide-react";
import { useProtocols, useProtocolItems, useCreateProtocol, useCreateProtocolItem, useDeleteProtocolItem, useUpdateProtocolItem, useNextProtocolNumber, DbProtocolItem, DbProtocol } from "@/hooks/useProtocols";
import { useProjects } from "@/hooks/useProjects";
import { useEmployees } from "@/hooks/useEmployees";
import { useCreateTask, useUpdateTask } from "@/hooks/useTasks";
import { generateProtocolPdf } from "@/utils/protocolPdf";
import { formatDisplayDate } from "@/utils/dateFormat";
import { toast } from "sonner";

interface ProtocolItemForm {
  project_id: string;
  item_text: string;
  responsible_ids: string[];
  due_date: string;
  create_task: boolean;
}

// Temporary item for copying protocol (before save)
interface PendingItem {
  tempId: string;
  project_id: string | null;
  item_text: string;
  responsible: string | null;
  due_date: string | null;
  create_task: boolean;
}

export function ProtocolsModule() {
  const { data: protocols = [], isLoading } = useProtocols();
  const { data: projects = [] } = useProjects();
  const { data: employees = [] } = useEmployees();
  const { data: nextNumber = 1 } = useNextProtocolNumber();
  const createProtocol = useCreateProtocol();
  const createProtocolItem = useCreateProtocolItem();
  const deleteProtocolItem = useDeleteProtocolItem();
  const createTask = useCreateTask();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editingProtocolId, setEditingProtocolId] = useState<string | null>(null);
  
  // Copy mode state
  const [copySourceId, setCopySourceId] = useState<string | null>(null);
  const [pendingItems, setPendingItems] = useState<PendingItem[]>([]);
  
  // Form for new protocol
  const [form, setForm] = useState({
    date: new Date().toISOString().slice(0, 10),
    title: "",
    organizer_id: "",
    attendee_ids: [] as string[],
  });

  // Form for adding items to existing protocol
  const [itemForm, setItemForm] = useState<ProtocolItemForm>({
    project_id: "",
    item_text: "",
    responsible_ids: [],
    due_date: "",
    create_task: false,
  });

  const resetForm = () => {
    setForm({
      date: new Date().toISOString().slice(0, 10),
      title: "",
      organizer_id: "",
      attendee_ids: [],
    });
    setPendingItems([]);
    setCopySourceId(null);
  };

  const resetItemForm = () => {
    setItemForm({
      project_id: "",
      item_text: "",
      responsible_ids: [],
      due_date: "",
      create_task: false,
    });
  };

  // Handle copying a protocol
  const handleCopyProtocol = (protocol: DbProtocol, sourceItems: DbProtocolItem[]) => {
    // Find organizer employee ID from name
    const organizerEmployee = protocol.organizer 
      ? employees.find(e => e.full_name === protocol.organizer) 
      : null;
    
    // Find attendee employee IDs from names
    const attendeeIds = protocol.attendees
      .map(name => employees.find(e => e.full_name === name)?.id)
      .filter(Boolean) as string[];

    // Prefill form with source protocol data
    setForm({
      date: new Date().toISOString().slice(0, 10), // Today's date for the copy
      title: protocol.title,
      organizer_id: organizerEmployee?.id || "",
      attendee_ids: attendeeIds,
    });

    // Copy items as pending items
    const copiedItems: PendingItem[] = sourceItems.map((item, index) => ({
      tempId: `temp-${Date.now()}-${index}`,
      project_id: item.project_id,
      item_text: item.item_text,
      responsible: item.responsible,
      due_date: item.due_date,
      create_task: false, // Don't auto-create tasks for copied items
    }));

    setPendingItems(copiedItems);
    setCopySourceId(protocol.id);
    setIsModalOpen(true);
  };

  const handleCreateProtocol = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim()) return;

    // Convert employee IDs to names for storage
    const organizerName = form.organizer_id
      ? employees.find((e) => e.id === form.organizer_id)?.full_name || null
      : null;
    const attendeeNames = form.attendee_ids
      .map((id) => employees.find((e) => e.id === id)?.full_name)
      .filter(Boolean) as string[];

    try {
      const result = await createProtocol.mutateAsync({
        number: nextNumber,
        date: form.date,
        title: form.title,
        organizer: organizerName,
        meeting_type: form.title,
        attendees: attendeeNames,
      });
      
      // If we have pending items from copy, create them
      if (pendingItems.length > 0) {
        for (let i = 0; i < pendingItems.length; i++) {
          const item = pendingItems[i];
          await createProtocolItem.mutateAsync({
            protocol_id: result.id,
            project_id: item.project_id,
            item_text: item.item_text,
            responsible: item.responsible,
            due_date: item.due_date,
            create_task: item.create_task,
            sort_order: i,
          });
        }
        toast.success("Протокол скопирован");
      } else {
        toast.success("Протокол создан");
      }

      resetForm();
      setIsModalOpen(false);
      setEditingProtocolId(result.id);
      setExpandedId(result.id);
    } catch (error) {
      toast.error("Ошибка при создании протокола");
    }
  };

  // Pending items management for copy mode
  const handleRemovePendingItem = (tempId: string) => {
    setPendingItems(prev => prev.filter(item => item.tempId !== tempId));
  };

  const handleUpdatePendingItem = (tempId: string, updates: Partial<PendingItem>) => {
    setPendingItems(prev => prev.map(item => 
      item.tempId === tempId ? { ...item, ...updates } : item
    ));
  };

  const handleAddPendingItem = () => {
    setPendingItems(prev => [...prev, {
      tempId: `temp-${Date.now()}`,
      project_id: null,
      item_text: "",
      responsible: null,
      due_date: null,
      create_task: false,
    }]);
  };

  const handleAddItem = async (protocolId: string) => {
    if (!itemForm.item_text.trim()) return;

    // Convert selected employee IDs to names for storage
    const responsibleNames = itemForm.responsible_ids
      .map(id => employees.find(e => e.id === id)?.full_name)
      .filter(Boolean)
      .join(", ");

    try {
      const item = await createProtocolItem.mutateAsync({
        protocol_id: protocolId,
        project_id: itemForm.project_id || null,
        item_text: itemForm.item_text,
        responsible: responsibleNames || null,
        due_date: itemForm.due_date || null,
        create_task: itemForm.create_task,
      });

      // If create_task is true, create the task
      if (itemForm.create_task && itemForm.due_date) {
        // Get the first responsible employee's profile_id for task assignee
        const firstResponsibleEmployeeId = itemForm.responsible_ids[0];
        const firstResponsibleEmployee = firstResponsibleEmployeeId 
          ? employees.find(e => e.id === firstResponsibleEmployeeId) 
          : null;
        const assigneeProfileId = firstResponsibleEmployee?.profile_id || null;

        await createTask.mutateAsync({
          title: itemForm.item_text,
          assignee_id: assigneeProfileId,
          project_id: itemForm.project_id || null,
          due_date: itemForm.due_date,
          status: "new",
          labels: ["протокол"],
        });
        toast.success("Пункт и задача добавлены");
      } else {
        toast.success("Пункт добавлен");
      }

      resetItemForm();
    } catch (error) {
      toast.error("Ошибка при добавлении пункта");
    }
  };

  const handleDeleteItem = async (itemId: string, protocolId: string) => {
    try {
      await deleteProtocolItem.mutateAsync({ id: itemId, protocol_id: protocolId });
      toast.success("Пункт удален");
    } catch (error) {
      toast.error("Ошибка при удалении");
    }
  };

  return (
    <div className="space-y-4 md:space-y-6">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm md:text-base text-muted-foreground">
          Протоколов: {protocols.length}
        </p>
        <button
          onClick={() => setIsModalOpen(true)}
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
              employees={employees}
              isExpanded={expandedId === protocol.id}
              isEditing={editingProtocolId === protocol.id}
              onToggleExpand={() => {
                const newExpandedId = expandedId === protocol.id ? null : protocol.id;
                setExpandedId(newExpandedId);
                // Reset editing mode when collapsing or switching to another protocol
                if (newExpandedId !== protocol.id && editingProtocolId === protocol.id) {
                  setEditingProtocolId(null);
                  resetItemForm();
                }
              }}
              onStartEditing={() => setEditingProtocolId(protocol.id)}
              onStopEditing={() => setEditingProtocolId(null)}
              itemForm={itemForm}
              setItemForm={setItemForm}
              onAddItem={() => handleAddItem(protocol.id)}
              onDeleteItem={(itemId) => handleDeleteItem(itemId, protocol.id)}
              resetItemForm={resetItemForm}
              onCopyProtocol={handleCopyProtocol}
            />
          ))
        )}
      </div>

      {/* Modal for creating new protocol */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          resetForm();
        }}
        title={copySourceId ? "Копирование протокола" : "Новый протокол"}
        size="lg"
      >
        <form onSubmit={handleCreateProtocol} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">
                Номер
              </label>
              <input
                type="number"
                value={nextNumber}
                disabled
                className="input-base w-full bg-muted"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">
                Дата
              </label>
              <input
                type="date"
                value={form.date}
                onChange={(e) => setForm({ ...form, date: e.target.value })}
                className="input-base w-full"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">
              Тема совещания
            </label>
            <input
              type="text"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              className="input-base w-full"
              placeholder="Введите тему"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">
              Организатор
            </label>
            <EmployeeMultiSelect
              employees={employees}
              selectedIds={form.organizer_id ? [form.organizer_id] : []}
              onChange={(ids) => setForm({ ...form, organizer_id: ids[0] || "" })}
              placeholder="Выберите организатора"
              single
              usePortal
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">
              Участники
            </label>
            <EmployeeMultiSelect
              employees={employees}
              selectedIds={form.attendee_ids}
              onChange={(ids) => setForm({ ...form, attendee_ids: ids })}
              placeholder="Выберите участников"
              usePortal
            />
          </div>

          {/* Pending items section for copy mode */}
          {pendingItems.length > 0 && (
            <div className="border-t border-border pt-4">
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-sm font-medium text-foreground">
                  Пункты протокола ({pendingItems.length})
                </h4>
                <button
                  type="button"
                  onClick={handleAddPendingItem}
                  className="btn-secondary text-xs flex items-center gap-1"
                >
                  <Plus className="w-3 h-3" />
                  Добавить
                </button>
              </div>
              <div className="space-y-3 max-h-[300px] overflow-y-auto">
                {pendingItems.map((item) => (
                  <PendingItemRow
                    key={item.tempId}
                    item={item}
                    projects={projects}
                    employees={employees}
                    onUpdate={(updates) => handleUpdatePendingItem(item.tempId, updates)}
                    onRemove={() => handleRemovePendingItem(item.tempId)}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Add items button if not in copy mode */}
          {copySourceId === null && pendingItems.length === 0 && (
            <div className="border-t border-border pt-4">
              <button
                type="button"
                onClick={handleAddPendingItem}
                className="btn-secondary text-sm flex items-center gap-2"
              >
                <Plus className="w-4 h-4" />
                Добавить пункты сразу
              </button>
            </div>
          )}

          <div className="flex justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={() => {
                setIsModalOpen(false);
                resetForm();
              }}
              className="btn-secondary"
            >
              Отмена
            </button>
            <button type="submit" className="btn-primary" disabled={createProtocol.isPending}>
              {createProtocol.isPending ? "Создание..." : copySourceId ? "Создать копию" : "Создать протокол"}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

// Component for editing pending items in modal
interface PendingItemRowProps {
  item: PendingItem;
  projects: { id: string; name: string }[];
  employees: { id: string; full_name: string; position: string; avatar_url: string | null; phone: string | null; email: string | null; department: string | null; birthday: string | null; profile_id: string | null }[];
  onUpdate: (updates: Partial<PendingItem>) => void;
  onRemove: () => void;
}

function PendingItemRow({ item, projects, employees, onUpdate, onRemove }: PendingItemRowProps) {
  // Convert responsible string to IDs for the multi-select
  const getEmployeeIdsFromResponsible = (responsible: string | null): string[] => {
    if (!responsible) return [];
    const names = responsible.split(", ").map(n => n.trim());
    return names
      .map(name => employees.find(e => e.full_name === name)?.id)
      .filter(Boolean) as string[];
  };

  const handleResponsibleChange = (ids: string[]) => {
    const responsibleNames = ids
      .map(id => employees.find(e => e.id === id)?.full_name)
      .filter(Boolean)
      .join(", ");
    onUpdate({ responsible: responsibleNames || null });
  };

  return (
    <div className="p-3 bg-secondary/50 rounded-lg space-y-2">
      <div className="flex items-start gap-2">
        <input
          type="text"
          value={item.item_text}
          onChange={(e) => onUpdate({ item_text: e.target.value })}
          className="input-base flex-1 text-sm"
          placeholder="Текст пункта"
        />
        <button
          type="button"
          onClick={onRemove}
          className="p-1.5 text-destructive/60 hover:text-destructive hover:bg-destructive/10 rounded shrink-0"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
        <select
          value={item.project_id || ""}
          onChange={(e) => onUpdate({ project_id: e.target.value || null })}
          className="input-base text-sm"
        >
          <option value="">Без проекта</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
        <div className="min-w-0">
          <EmployeeMultiSelect
            employees={employees}
            selectedIds={getEmployeeIdsFromResponsible(item.responsible)}
            onChange={handleResponsibleChange}
            placeholder="Ответственные"
            usePortal
          />
        </div>
        <input
          type="date"
          value={item.due_date || ""}
          onChange={(e) => onUpdate({ due_date: e.target.value || null })}
          className="input-base text-sm"
        />
      </div>
      <label className="flex items-center gap-2 cursor-pointer">
        <input
          type="checkbox"
          checked={item.create_task}
          onChange={(e) => onUpdate({ create_task: e.target.checked })}
          className="w-4 h-4 rounded border-input text-primary focus:ring-ring"
        />
        <span className="text-sm text-muted-foreground">
          Создать задачу на канбан
        </span>
      </label>
    </div>
  );
}

interface ProtocolCardProps {
  protocol: DbProtocol;
  projects: { id: string; name: string }[];
  employees: { id: string; full_name: string; position: string; avatar_url: string | null; phone: string | null; email: string | null; department: string | null; birthday: string | null; profile_id: string | null }[];
  isExpanded: boolean;
  isEditing: boolean;
  onToggleExpand: () => void;
  onStartEditing: () => void;
  onStopEditing: () => void;
  itemForm: ProtocolItemForm;
  setItemForm: React.Dispatch<React.SetStateAction<ProtocolItemForm>>;
  onAddItem: () => void;
  onDeleteItem: (itemId: string) => void;
  resetItemForm: () => void;
  onCopyProtocol: (protocol: DbProtocol, items: DbProtocolItem[]) => void;
}

function ProtocolCard({
  protocol,
  projects,
  employees,
  isExpanded,
  isEditing,
  onToggleExpand,
  onStartEditing,
  onStopEditing,
  itemForm,
  setItemForm,
  onAddItem,
  onDeleteItem,
  resetItemForm,
  onCopyProtocol,
}: ProtocolCardProps) {
  const { data: items = [] } = useProtocolItems(protocol.id);
  const updateProtocolItem = useUpdateProtocolItem();
  const updateTask = useUpdateTask();
  
  // State for inline editing
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editingItemText, setEditingItemText] = useState("");
  const [showAddItemForm, setShowAddItemForm] = useState(false);
  
  // State for editing responsible/due_date
  const [editingResponsibleItemId, setEditingResponsibleItemId] = useState<string | null>(null);
  const [editingResponsibleIds, setEditingResponsibleIds] = useState<string[]>([]);
  const [editingDueDateItemId, setEditingDueDateItemId] = useState<string | null>(null);
  const [editingDueDate, setEditingDueDate] = useState("");

  // Helper to find employee IDs from responsible names string
  const getEmployeeIdsFromResponsible = (responsible: string | null): string[] => {
    if (!responsible) return [];
    const names = responsible.split(", ").map(n => n.trim());
    return names
      .map(name => employees.find(e => e.full_name === name)?.id)
      .filter(Boolean) as string[];
  };

  const handleStartEditItem = (itemId: string, currentText: string) => {
    setEditingItemId(itemId);
    setEditingItemText(currentText);
  };

  const handleSaveItemText = async () => {
    if (!editingItemId || !editingItemText.trim()) return;
    try {
      await updateProtocolItem.mutateAsync({
        id: editingItemId,
        protocol_id: protocol.id,
        item_text: editingItemText.trim(),
      });
      setEditingItemId(null);
      setEditingItemText("");
      toast.success("Текст пункта обновлён");
    } catch (error) {
      toast.error("Ошибка обновления");
    }
  };

  const handleCancelEditItem = () => {
    setEditingItemId(null);
    setEditingItemText("");
  };

  // Handlers for responsible editing
  const handleStartEditResponsible = (item: DbProtocolItem) => {
    setEditingResponsibleItemId(item.id);
    setEditingResponsibleIds(getEmployeeIdsFromResponsible(item.responsible));
  };

  const handleSaveResponsible = async (item: DbProtocolItem) => {
    const responsibleNames = editingResponsibleIds
      .map(id => employees.find(e => e.id === id)?.full_name)
      .filter(Boolean)
      .join(", ");

    try {
      await updateProtocolItem.mutateAsync({
        id: item.id,
        protocol_id: protocol.id,
        responsible: responsibleNames || null,
      });

      // If there's a linked task, update its assignee too
      if (item.task_id) {
        const firstResponsibleEmployeeId = editingResponsibleIds[0];
        const firstResponsibleEmployee = firstResponsibleEmployeeId 
          ? employees.find(e => e.id === firstResponsibleEmployeeId) 
          : null;
        const assigneeProfileId = firstResponsibleEmployee?.profile_id || null;

        await updateTask.mutateAsync({
          id: item.task_id,
          assignee_id: assigneeProfileId,
        });
        toast.success("Ответственный обновлён в пункте и задаче");
      } else {
        toast.success("Ответственный обновлён");
      }

      setEditingResponsibleItemId(null);
      setEditingResponsibleIds([]);
    } catch (error) {
      toast.error("Ошибка обновления");
    }
  };

  const handleCancelEditResponsible = () => {
    setEditingResponsibleItemId(null);
    setEditingResponsibleIds([]);
  };

  // Handlers for due date editing
  const handleStartEditDueDate = (item: DbProtocolItem) => {
    setEditingDueDateItemId(item.id);
    setEditingDueDate(item.due_date || "");
  };

  const handleSaveDueDate = async (item: DbProtocolItem) => {
    try {
      await updateProtocolItem.mutateAsync({
        id: item.id,
        protocol_id: protocol.id,
        due_date: editingDueDate || null,
      });

      // If there's a linked task, update its due date too
      if (item.task_id) {
        await updateTask.mutateAsync({
          id: item.task_id,
          due_date: editingDueDate || null,
        });
        toast.success("Срок обновлён в пункте и задаче");
      } else {
        toast.success("Срок обновлён");
      }

      setEditingDueDateItemId(null);
      setEditingDueDate("");
    } catch (error) {
      toast.error("Ошибка обновления");
    }
  };

  const handleCancelEditDueDate = () => {
    setEditingDueDateItemId(null);
    setEditingDueDate("");
  };

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
          <h3 className="font-medium text-foreground">{protocol.title}</h3>
          <span className="chip">
            {protocol.attendees.length} участников
          </span>
        </button>
        <div className="flex items-center gap-1">
          <button
            onClick={() => onCopyProtocol(protocol, items)}
            className="p-2 text-muted-foreground hover:text-primary hover:bg-primary/10 rounded-lg transition-colors"
            title="Копировать протокол"
          >
            <Copy className="w-4 h-4" />
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
              <div className="mb-3">
                <h4 className="text-sm font-medium text-muted-foreground">
                  Пункты по проектам
                </h4>
              </div>

              {Object.entries(itemsByProject).length === 0 && !isEditing && (
                <p className="text-sm text-muted-foreground">Нет пунктов</p>
              )}

              {Object.entries(itemsByProject).map(([projectId, projectItems]) => (
                <div key={projectId} className="mb-4">
                  <div className="flex items-center gap-2 mb-2">
                    <FolderOpen className="w-4 h-4 text-primary" />
                    <span className="font-medium text-foreground">
                      {getProjectName(projectId === "no_project" ? null : projectId)}
                    </span>
                  </div>
                  <div className="ml-6 space-y-2">
                    {projectItems.map((item) => (
                      <div
                        key={item.id}
                        className="group p-3 bg-secondary/50 rounded-lg flex items-start justify-between gap-4"
                      >
                        <div className="flex-1">
                          {editingItemId === item.id ? (
                            <div className="flex items-center gap-2">
                              <input
                                type="text"
                                value={editingItemText}
                                onChange={(e) => setEditingItemText(e.target.value)}
                                className="input-base flex-1"
                                autoFocus
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") handleSaveItemText();
                                  if (e.key === "Escape") handleCancelEditItem();
                                }}
                              />
                              <button
                                onClick={handleSaveItemText}
                                className="p-1.5 text-green-600 hover:bg-green-100 rounded"
                                disabled={updateProtocolItem.isPending}
                              >
                                <Check className="w-4 h-4" />
                              </button>
                              <button
                                onClick={handleCancelEditItem}
                                className="p-1.5 text-muted-foreground hover:bg-muted rounded"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            </div>
                          ) : (
                            <p className="text-foreground">{item.item_text}</p>
                          )}
                          
                          {/* Editable responsible and due date */}
                          <div className="flex flex-wrap items-center gap-3 mt-2 text-sm">
                            {/* Responsible field */}
                            <div className="flex items-center gap-1">
                              <User className="w-3.5 h-3.5 text-muted-foreground" />
                              {editingResponsibleItemId === item.id ? (
                                <div className="flex items-center gap-1">
                                  <div className="min-w-[180px]">
                                    <EmployeeMultiSelect
                                      employees={employees}
                                      selectedIds={editingResponsibleIds}
                                      onChange={setEditingResponsibleIds}
                                      placeholder="Выберите"
                                      usePortal
                                    />
                                  </div>
                                  <button
                                    onClick={() => handleSaveResponsible(item)}
                                    className="p-1 text-green-600 hover:bg-green-100 rounded"
                                    disabled={updateProtocolItem.isPending}
                                  >
                                    <Check className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    onClick={handleCancelEditResponsible}
                                    className="p-1 text-muted-foreground hover:bg-muted rounded"
                                  >
                                    <X className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              ) : (
                                <span
                                  className={`text-muted-foreground ${isEditing ? 'cursor-pointer hover:text-primary hover:underline' : ''}`}
                                  onClick={() => isEditing && handleStartEditResponsible(item)}
                                >
                                  {item.responsible || (isEditing ? "Назначить" : "—")}
                                </span>
                              )}
                            </div>

                            {/* Due date field */}
                            <div className="flex items-center gap-1">
                              <Calendar className="w-3.5 h-3.5 text-muted-foreground" />
                              {editingDueDateItemId === item.id ? (
                                <div className="flex items-center gap-1">
                                  <input
                                    type="date"
                                    value={editingDueDate}
                                    onChange={(e) => setEditingDueDate(e.target.value)}
                                    className="input-base text-sm py-1 px-2"
                                    autoFocus
                                  />
                                  <button
                                    onClick={() => handleSaveDueDate(item)}
                                    className="p-1 text-green-600 hover:bg-green-100 rounded"
                                    disabled={updateProtocolItem.isPending}
                                  >
                                    <Check className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    onClick={handleCancelEditDueDate}
                                    className="p-1 text-muted-foreground hover:bg-muted rounded"
                                  >
                                    <X className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              ) : (
                                <span
                                  className={`text-muted-foreground ${isEditing ? 'cursor-pointer hover:text-primary hover:underline' : ''}`}
                                  onClick={() => isEditing && handleStartEditDueDate(item)}
                                >
                                  {item.due_date ? formatDisplayDate(item.due_date) : (isEditing ? "Установить" : "—")}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {item.create_task && (
                            <span className="chip-success shrink-0 flex items-center gap-1">
                              <CheckCircle2 className="w-3 h-3" />
                              Задача
                            </span>
                          )}
                          {isEditing && editingItemId !== item.id && (
                            <button
                              onClick={() => handleStartEditItem(item.id, item.item_text)}
                              className="p-1 text-muted-foreground hover:text-primary hover:bg-primary/10 rounded"
                              title="Редактировать текст"
                            >
                              <Pencil className="w-4 h-4" />
                            </button>
                          )}
                          {isEditing && (
                            <button
                              onClick={() => onDeleteItem(item.id)}
                              className="p-1 text-destructive/60 hover:text-destructive hover:bg-destructive/10 rounded"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}

              {/* Add item button and form */}
              {isEditing && (
                <div className="mt-4">
                  {!showAddItemForm ? (
                    <button
                      onClick={() => setShowAddItemForm(true)}
                      className="btn-secondary text-sm flex items-center gap-2"
                    >
                      <Plus className="w-4 h-4" />
                      Добавить пункт
                    </button>
                  ) : (
                    <div className="p-4 bg-muted/50 rounded-lg space-y-3">
                      <h5 className="font-medium text-foreground">Новый пункт</h5>
                      
                      <div>
                        <label className="block text-sm text-muted-foreground mb-1">
                          Проект
                        </label>
                        <select
                          value={itemForm.project_id}
                          onChange={(e) => setItemForm({ ...itemForm, project_id: e.target.value })}
                          className="input-base w-full"
                        >
                          <option value="">Без проекта</option>
                          {projects.map((project) => (
                            <option key={project.id} value={project.id}>
                              {project.name}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-sm text-muted-foreground mb-1">
                          Текст пункта
                        </label>
                        <input
                          type="text"
                          value={itemForm.item_text}
                          onChange={(e) => setItemForm({ ...itemForm, item_text: e.target.value })}
                          className="input-base w-full"
                          placeholder="Описание задачи/действия"
                        />
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-sm text-muted-foreground mb-1">
                            Ответственные
                          </label>
                          <EmployeeMultiSelect
                            employees={employees}
                            selectedIds={itemForm.responsible_ids}
                            onChange={(ids) => setItemForm({ ...itemForm, responsible_ids: ids })}
                            placeholder="Выберите ответственных"
                            usePortal
                          />
                        </div>
                        <div>
                          <label className="block text-sm text-muted-foreground mb-1">
                            Срок
                          </label>
                          <input
                            type="date"
                            value={itemForm.due_date}
                            onChange={(e) => setItemForm({ ...itemForm, due_date: e.target.value })}
                            className="input-base w-full"
                          />
                        </div>
                      </div>

                      <div className="flex items-center gap-4">
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={itemForm.create_task}
                            onChange={(e) => setItemForm({ ...itemForm, create_task: e.target.checked })}
                            className="w-4 h-4 rounded border-input text-primary focus:ring-ring"
                          />
                          <span className="text-sm text-foreground">
                            Создать задачу на канбан
                          </span>
                        </label>
                      </div>

                      <div className="flex justify-end gap-2 pt-2">
                        <button
                          type="button"
                          onClick={() => {
                            resetItemForm();
                            setShowAddItemForm(false);
                          }}
                          className="btn-secondary text-sm"
                        >
                          Отмена
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            onAddItem();
                            setShowAddItemForm(false);
                          }}
                          className="btn-primary text-sm"
                          disabled={!itemForm.item_text.trim()}
                        >
                          Добавить
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Edit/Done buttons at bottom */}
            <div className="mt-4 pt-4 border-t border-border flex justify-end">
              {!isEditing ? (
                <button
                  onClick={onStartEditing}
                  className="btn-secondary text-sm flex items-center gap-2"
                >
                  <Pencil className="w-4 h-4" />
                  Редактировать
                </button>
              ) : (
                <button
                  onClick={() => {
                    onStopEditing();
                    resetItemForm();
                  }}
                  className="btn-primary text-sm flex items-center gap-2"
                >
                  <Check className="w-4 h-4" />
                  Готово
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
