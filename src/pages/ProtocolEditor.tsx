import { useState, useEffect, useMemo } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { ArrowLeft, Plus, Trash2, Check, FolderOpen, CheckCircle2, Pencil, Loader2, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmployeeMultiSelect } from "@/components/ui/EmployeeMultiSelect";
import {
  useProtocols,
  useProtocolItems,
  useCreateProtocol,
  useUpdateProtocol,
  useCreateProtocolItem,
  useDeleteProtocolItem,
  useUpdateProtocolItem,
  useNextProtocolNumber,
  DbProtocolItem,
} from "@/hooks/useProtocols";
import { useProjects } from "@/hooks/useProjects";
import { useEmployees } from "@/hooks/useEmployees";
import { useCreateTask, useUpdateTask } from "@/hooks/useTasks";
import { toast } from "sonner";
import { formatDisplayDate } from "@/utils/dateFormat";

interface PendingItem {
  tempId: string;
  project_id: string | null;
  item_text: string;
  responsible: string | null;
  due_date: string | null;
  create_task: boolean;
}

interface ProtocolItemForm {
  project_id: string;
  item_text: string;
  responsible_ids: string[];
  due_date: string;
  create_task: boolean;
}

export default function ProtocolEditor() {
  const navigate = useNavigate();
  const { id } = useParams<{ id?: string }>();
  const [searchParams] = useSearchParams();
  const copyFromId = searchParams.get("copy");
  
  // Support both /protocols/new (no param) and /protocols/:id where id="new"
  const isNew = !id || id === "new";
  const isEditMode = !!id && id !== "new";
  const isCopyMode = isNew && !!copyFromId;

  const { data: protocols = [], isLoading: protocolsLoading } = useProtocols();
  const { data: projects = [] } = useProjects();
  const { data: employees = [], isLoading: employeesLoading } = useEmployees();
  const { data: nextNumber = 1 } = useNextProtocolNumber();
  const createProtocol = useCreateProtocol();
  const updateProtocol = useUpdateProtocol();
  const createProtocolItem = useCreateProtocolItem();
  const deleteProtocolItem = useDeleteProtocolItem();
  const updateProtocolItem = useUpdateProtocolItem();
  const createTask = useCreateTask();
  const updateTask = useUpdateTask();


  // Existing protocol data for edit mode
  const existingProtocol = isEditMode ? protocols.find(p => p.id === id) : null;
  const { data: existingItems = [] } = useProtocolItems(isEditMode ? id : null);

  // Source protocol for copy mode
  const sourceProtocol = isCopyMode ? protocols.find(p => p.id === copyFromId) : null;
  const { data: sourceItems = [], isLoading: sourceItemsLoading } = useProtocolItems(isCopyMode ? copyFromId : null);
  
  // Loading state for copy mode
  const isCopyDataLoading = isCopyMode && (protocolsLoading || employeesLoading || sourceItemsLoading || !sourceProtocol);

  // Form state
  const [form, setForm] = useState({
    date: new Date().toISOString().slice(0, 10),
    title: "",
    organizer_id: "",
    attendee_ids: [] as string[],
  });

  const [pendingItems, setPendingItems] = useState<PendingItem[]>([]);
  const [itemForm, setItemForm] = useState<ProtocolItemForm>({
    project_id: "",
    item_text: "",
    responsible_ids: [],
    due_date: "",
    create_task: false,
  });
  const [showAddItemForm, setShowAddItemForm] = useState(false);

  // Initialize form for edit & copy modes
  useEffect(() => {
    // Edit mode: load existing protocol into local form for editing
    if (isEditMode && existingProtocol) {
      const organizerEmployee = existingProtocol.organizer
        ? employees.find((e) => e.full_name === existingProtocol.organizer)
        : null;

      const attendeeIds = (existingProtocol.attendees || [])
        .map((name) => employees.find((e) => e.full_name === name)?.id)
        .filter(Boolean) as string[];

      setForm({
        date: existingProtocol.date,
        title: existingProtocol.title,
        organizer_id: organizerEmployee?.id || "",
        attendee_ids: attendeeIds,
      });
    }
  }, [isEditMode, existingProtocol, employees]);

  // Track if copy data was already applied
  const [copyApplied, setCopyApplied] = useState(false);

  useEffect(() => {
    // Copy mode: prefill from source protocol + items (only once when data is ready)
    if (isCopyMode && sourceProtocol && sourceItems.length >= 0 && employees.length > 0 && !copyApplied && !sourceItemsLoading) {
      const organizerEmployee = sourceProtocol.organizer
        ? employees.find((e) => e.full_name === sourceProtocol.organizer)
        : null;

      const attendeeIds = (sourceProtocol.attendees || [])
        .map((name) => employees.find((e) => e.full_name === name)?.id)
        .filter(Boolean) as string[];

      setForm({
        date: new Date().toISOString().slice(0, 10),
        title: sourceProtocol.title,
        organizer_id: organizerEmployee?.id || "",
        attendee_ids: attendeeIds,
      });

      const copiedItems: PendingItem[] = sourceItems.map((item, index) => ({
        tempId: `temp-${Date.now()}-${index}`,
        project_id: item.project_id,
        item_text: item.item_text,
        responsible: item.responsible,
        due_date: item.due_date,
        create_task: false,
      }));
      setPendingItems(copiedItems);
      setCopyApplied(true);
    }
  }, [isCopyMode, sourceProtocol, sourceItems, employees, copyApplied, sourceItemsLoading]);


  // Helper functions
  const getEmployeeIdsFromResponsible = (responsible: string | null): string[] => {
    if (!responsible) return [];
    const names = responsible.split(", ").map(n => n.trim());
    return names
      .map(name => employees.find(e => e.full_name === name)?.id)
      .filter(Boolean) as string[];
  };

  const handleUpdatePendingItem = (tempId: string, updates: Partial<PendingItem>) => {
    setPendingItems(prev => prev.map(item => 
      item.tempId === tempId ? { ...item, ...updates } : item
    ));
  };

  const handleRemovePendingItem = (tempId: string) => {
    setPendingItems(prev => prev.filter(item => item.tempId !== tempId));
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

  const resetItemForm = () => {
    setItemForm({
      project_id: "",
      item_text: "",
      responsible_ids: [],
      due_date: "",
      create_task: false,
    });
  };

  // Create new protocol
  const handleCreate = async () => {
    if (!form.title.trim()) {
      toast.error("Введите тему совещания");
      return;
    }

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

      // Create pending items
      for (let i = 0; i < pendingItems.length; i++) {
        const item = pendingItems[i];
        if (!item.item_text.trim()) continue;

        const createdItem = await createProtocolItem.mutateAsync({
          protocol_id: result.id,
          project_id: item.project_id,
          item_text: item.item_text,
          responsible: item.responsible,
          due_date: item.due_date,
          create_task: item.create_task,
          sort_order: i,
        });

        // Create task if needed
        if (item.create_task && item.item_text.trim()) {
          const responsibleIds = getEmployeeIdsFromResponsible(item.responsible);
          const firstResponsibleEmployeeId = responsibleIds[0];
          const firstResponsibleEmployee = firstResponsibleEmployeeId 
            ? employees.find(e => e.id === firstResponsibleEmployeeId) 
            : null;
          const assigneeProfileId = firstResponsibleEmployee?.profile_id || null;

          const taskResult = await createTask.mutateAsync({
            title: item.item_text,
            assignee_id: assigneeProfileId,
            due_date: item.due_date || null,
            status: "new",
            priority: "normal",
          });

          // Link task to protocol item
          await updateProtocolItem.mutateAsync({
            id: createdItem.id,
            protocol_id: result.id,
            task_id: taskResult.id,
          });
        }
      }

      toast.success(isCopyMode ? "Протокол скопирован" : "Протокол создан");
      navigate(`/protocols/edit/${result.id}`);
    } catch (error) {
      toast.error("Ошибка при создании протокола");
    }
  };

  // Add item to existing protocol
  const handleAddItem = async () => {
    if (!id || isNew || !itemForm.item_text.trim()) return;

    const responsibleNames = itemForm.responsible_ids
      .map(empId => employees.find(e => e.id === empId)?.full_name)
      .filter(Boolean)
      .join(", ");

    try {
      const createdItem = await createProtocolItem.mutateAsync({
        protocol_id: id,
        project_id: itemForm.project_id || null,
        item_text: itemForm.item_text,
        responsible: responsibleNames || null,
        due_date: itemForm.due_date || null,
        create_task: itemForm.create_task,
        sort_order: existingItems.length,
      });

      if (itemForm.create_task && itemForm.item_text.trim()) {
        const firstResponsibleEmployeeId = itemForm.responsible_ids[0];
        const firstResponsibleEmployee = firstResponsibleEmployeeId 
          ? employees.find(e => e.id === firstResponsibleEmployeeId) 
          : null;
        const assigneeProfileId = firstResponsibleEmployee?.profile_id || null;

        await createTask.mutateAsync({
          title: itemForm.item_text,
          assignee_id: assigneeProfileId,
          due_date: itemForm.due_date || null,
          status: "new",
          priority: "normal",
        });

        toast.success("Пункт добавлен с задачей");
      } else {
        toast.success("Пункт добавлен");
      }

      resetItemForm();
      setShowAddItemForm(false);
    } catch (error) {
      toast.error("Ошибка при добавлении пункта");
    }
  };

  // Delete item
  const handleDeleteItem = async (itemId: string) => {
    if (!id) return;
    try {
      await deleteProtocolItem.mutateAsync({ id: itemId, protocol_id: id });
      toast.success("Пункт удален");
    } catch (error) {
      toast.error("Ошибка удаления");
    }
  };

  // Group items by project
  const itemsByProject = useMemo(() => {
    const items = isEditMode ? existingItems : [];
    const groups: Record<string, typeof items> = {};
    items.forEach((item) => {
      const key = item.project_id || "no_project";
      if (!groups[key]) groups[key] = [];
      groups[key].push(item);
    });
    return groups;
  }, [existingItems, isEditMode]);

  const getProjectName = (projectId: string | null) => {
    if (!projectId) return "Без проекта";
    return projects.find((p) => p.id === projectId)?.name || "Неизвестный проект";
  };

  const pageTitle = isEditMode 
    ? `Протокол №${existingProtocol?.number || ""}` 
    : isCopyMode 
      ? "Копирование протокола" 
      : "Новый протокол";

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-background border-b border-border">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center gap-4">
          <button
            onClick={() => navigate("/protocols")}
            className="p-2 hover:bg-secondary rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-xl font-semibold text-foreground">{pageTitle}</h1>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        {/* Loading state for copy mode */}
        {isCopyDataLoading && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
            <span className="ml-3 text-muted-foreground">Загрузка данных протокола...</span>
          </div>
        )}

        {/* Protocol metadata form */}
        {!isCopyDataLoading && (
        <section className="card-base p-6 space-y-4">
          <h2 className="text-lg font-medium text-foreground">Информация о совещании</h2>
          
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">Номер</label>
                <input
                  type="number"
                  value={isEditMode ? existingProtocol?.number || "" : nextNumber}
                  disabled
                  className="input-base w-full bg-muted"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">Дата</label>
                <input
                  type="date"
                  value={form.date}
                  onChange={(e) => setForm({ ...form, date: e.target.value })}
                  className="input-base w-full"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">Тема совещания</label>
              <input
                type="text"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                className="input-base w-full"
                placeholder="Введите тему"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">Организатор</label>
              <EmployeeMultiSelect
                employees={employees}
                selectedIds={form.organizer_id ? [form.organizer_id] : []}
                onChange={(ids) => setForm({ ...form, organizer_id: ids[0] || "" })}
                placeholder="Выберите организатора"
                single
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">Участники</label>
              <EmployeeMultiSelect
                employees={employees}
                selectedIds={form.attendee_ids}
                onChange={(ids) => setForm({ ...form, attendee_ids: ids })}
                placeholder="Выберите участников"
              />
            </div>


            {/* Actions */}
            <div className="pt-4 flex justify-end gap-2">
              {isEditMode && (
                <button
                  onClick={async () => {
                    if (!id) return;
                    if (!form.title.trim()) {
                      toast.error("Введите тему совещания");
                      return;
                    }

                    const organizerName = form.organizer_id
                      ? employees.find((e) => e.id === form.organizer_id)?.full_name || null
                      : null;
                    const attendeeNames = form.attendee_ids
                      .map((empId) => employees.find((e) => e.id === empId)?.full_name)
                      .filter(Boolean) as string[];

                    try {
                      await updateProtocol.mutateAsync({
                        id,
                        date: form.date,
                        title: form.title,
                        organizer: organizerName,
                        meeting_type: form.title,
                        attendees: attendeeNames,
                      });
                      toast.success("Протокол обновлён");
                    } catch {
                      toast.error("Ошибка при сохранении");
                    }
                  }}
                  className="btn-primary"
                  disabled={updateProtocol.isPending || !form.title.trim()}
                >
                  {updateProtocol.isPending ? "Сохранение..." : "Сохранить"}
                </button>
              )}

              {isNew && (
                <Button
                  onClick={handleCreate}
                  size="lg"
                  disabled={createProtocol.isPending || !form.title.trim()}
                  className="gap-2 text-base font-semibold px-8"
                >
                  <Save className="w-5 h-5" />
                  {createProtocol.isPending
                    ? "Сохранение..."
                    : "Сохранить протокол"}
                </Button>
              )}
            </div>

        </section>
        )}

        {/* Items section - for new protocol (pending items) */}
        {isNew && !isCopyDataLoading && (
          <section className="card-base p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-medium text-foreground">
                Пункты протокола ({pendingItems.length})
              </h2>
              <button
                onClick={handleAddPendingItem}
                className="btn-secondary text-sm flex items-center gap-2"
              >
                <Plus className="w-4 h-4" />
                Добавить пункт
              </button>
            </div>

            <div className="space-y-3">
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
              {pendingItems.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-8">
                  Нет пунктов. Нажмите «Добавить пункт» чтобы начать.
                </p>
              )}
            </div>
          </section>
        )}

        {/* Items section - for existing protocol */}
        {isEditMode && (
          <section className="card-base p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-medium text-foreground">
                Пункты протокола ({existingItems.length})
              </h2>
              <button
                onClick={() => setShowAddItemForm(!showAddItemForm)}
                className="btn-secondary text-sm flex items-center gap-2"
              >
                <Plus className="w-4 h-4" />
                Добавить пункт
              </button>
            </div>

            {/* Add item form */}
            {showAddItemForm && (
              <div className="p-4 bg-muted/50 rounded-lg space-y-3 border border-border">
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
                    ))}</select>
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
                    onClick={handleAddItem}
                    className="btn-primary text-sm"
                    disabled={!itemForm.item_text.trim()}
                  >
                    Добавить
                  </button>
                </div>
              </div>
            )}

            {/* Existing items grouped by project */}
            {Object.entries(itemsByProject).length === 0 && !showAddItemForm ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                Нет пунктов
              </p>
            ) : (
              Object.entries(itemsByProject).map(([projectId, projectItems]) => (
                <div key={projectId} className="space-y-2">
                  <div className="flex items-center gap-2">
                    <FolderOpen className="w-4 h-4 text-primary" />
                    <span className="font-medium text-foreground">
                      {getProjectName(projectId === "no_project" ? null : projectId)}
                    </span>
                  </div>
                  <div className="ml-6 space-y-2">
                    {projectItems.map((item) => (
                      <ExistingItemRow
                        key={item.id}
                        item={item}
                        employees={employees}
                        onDelete={() => handleDeleteItem(item.id)}
                        protocolId={id!}
                        updateProtocolItem={updateProtocolItem}
                        updateTask={updateTask}
                      />
                    ))}
                  </div>
                </div>
              ))
            )}
          </section>
        )}
      </main>
    </div>
  );
}

// Component for pending items (new protocol)
interface PendingItemRowProps {
  item: PendingItem;
  projects: { id: string; name: string }[];
  employees: { id: string; full_name: string; position: string; avatar_url: string | null; phone: string | null; email: string | null; department: string | null; birthday: string | null; profile_id: string | null }[];
  onUpdate: (updates: Partial<PendingItem>) => void;
  onRemove: () => void;
}

function PendingItemRow({ item, projects, employees, onUpdate, onRemove }: PendingItemRowProps) {
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

// Component for existing items (edit mode)
interface ExistingItemRowProps {
  item: DbProtocolItem;
  employees: { id: string; full_name: string; position: string; avatar_url: string | null; phone: string | null; email: string | null; department: string | null; birthday: string | null; profile_id: string | null }[];
  onDelete: () => void;
  protocolId: string;
  updateProtocolItem: ReturnType<typeof useUpdateProtocolItem>;
  updateTask: ReturnType<typeof useUpdateTask>;
}

function ExistingItemRow({ item, employees, onDelete, protocolId, updateProtocolItem, updateTask }: ExistingItemRowProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState(item.item_text);
  const [editResponsibleIds, setEditResponsibleIds] = useState<string[]>([]);
  const [editDueDate, setEditDueDate] = useState(item.due_date || "");

  const getEmployeeIdsFromResponsible = (responsible: string | null): string[] => {
    if (!responsible) return [];
    const names = responsible.split(", ").map(n => n.trim());
    return names
      .map(name => employees.find(e => e.full_name === name)?.id)
      .filter(Boolean) as string[];
  };

  useEffect(() => {
    setEditResponsibleIds(getEmployeeIdsFromResponsible(item.responsible));
  }, [item.responsible, employees]);

  const handleSave = async () => {
    const responsibleNames = editResponsibleIds
      .map(id => employees.find(e => e.id === id)?.full_name)
      .filter(Boolean)
      .join(", ");

    try {
      await updateProtocolItem.mutateAsync({
        id: item.id,
        protocol_id: protocolId,
        item_text: editText.trim(),
        responsible: responsibleNames || null,
        due_date: editDueDate || null,
      });

      // Update linked task if exists
      if (item.task_id) {
        const firstResponsibleEmployeeId = editResponsibleIds[0];
        const firstResponsibleEmployee = firstResponsibleEmployeeId 
          ? employees.find(e => e.id === firstResponsibleEmployeeId) 
          : null;
        const assigneeProfileId = firstResponsibleEmployee?.profile_id || null;

        await updateTask.mutateAsync({
          id: item.task_id,
          title: editText.trim(),
          assignee_id: assigneeProfileId,
          due_date: editDueDate || null,
        });
      }

      toast.success("Пункт обновлён");
      setIsEditing(false);
    } catch (error) {
      toast.error("Ошибка обновления");
    }
  };

  if (isEditing) {
    return (
      <div className="p-3 bg-secondary/50 rounded-lg space-y-2">
        <input
          type="text"
          value={editText}
          onChange={(e) => setEditText(e.target.value)}
          className="input-base w-full"
          autoFocus
        />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          <EmployeeMultiSelect
            employees={employees}
            selectedIds={editResponsibleIds}
            onChange={setEditResponsibleIds}
            placeholder="Ответственные"
          />
          <input
            type="date"
            value={editDueDate}
            onChange={(e) => setEditDueDate(e.target.value)}
            className="input-base"
          />
        </div>
        <div className="flex justify-end gap-2">
          <button
            onClick={() => setIsEditing(false)}
            className="btn-secondary text-sm"
          >
            Отмена
          </button>
          <button
            onClick={handleSave}
            className="btn-primary text-sm"
            disabled={updateProtocolItem.isPending}
          >
            Сохранить
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="group p-3 bg-secondary/50 rounded-lg flex items-start justify-between gap-4">
      <div className="flex-1">
        <p className="text-foreground">{item.item_text}</p>
        <div className="flex flex-wrap items-center gap-3 mt-2 text-sm text-muted-foreground">
          {item.responsible && <span>{item.responsible}</span>}
          {item.due_date && <span>{formatDisplayDate(item.due_date)}</span>}
        </div>
      </div>
      <div className="flex items-center gap-2">
        {item.create_task && (
          <span className="chip-success shrink-0 flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3" />
            Задача
          </span>
        )}
        <button
          onClick={() => setIsEditing(true)}
          className="p-1.5 text-muted-foreground hover:text-primary hover:bg-primary/10 rounded transition-colors"
          title="Редактировать"
        >
          <Pencil className="w-4 h-4" />
        </button>
        <button
          onClick={onDelete}
          className="p-1.5 text-destructive/60 hover:text-destructive hover:bg-destructive/10 rounded transition-colors"
          title="Удалить"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
