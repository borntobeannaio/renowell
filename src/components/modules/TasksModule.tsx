import { useState, DragEvent, useMemo } from "react";
import { Modal } from "@/components/ui/Modal";
import { EmployeeMultiSelect } from "@/components/ui/EmployeeMultiSelect";
import { TaskComments } from "@/components/tasks/TaskComments";
import { Plus, Calendar, User, GripVertical, FolderOpen, ChevronDown, ChevronRight, Pencil } from "lucide-react";
import { useTasks, useCreateTask, useUpdateTask, DbTask, TaskStatus, TaskPriority, TASK_STATUS_LABELS, TASK_PRIORITY_LABELS, TASK_PRIORITY_COLORS } from "@/hooks/useTasks";
import { useProjects, Project } from "@/hooks/useProjects";
import { useEmployees, DbEmployee } from "@/hooks/useEmployees";
import { formatDisplayDate } from "@/utils/dateFormat";
import { toast } from "sonner";

const columns: { id: TaskStatus; label: string }[] = [
  { id: "new", label: "Новая" },
  { id: "in_progress", label: "В работе" },
  { id: "review", label: "На проверке" },
  { id: "done", label: "Готово" },
  { id: "on_hold", label: "Отложено" },
  { id: "blocked", label: "Заблокировано" },
  { id: "cancelled", label: "Отменено" },
];

const priorities: { id: TaskPriority; label: string }[] = [
  { id: "critical", label: "Критический" },
  { id: "high", label: "Высокий" },
  { id: "normal", label: "Нормальный" },
  { id: "low", label: "Низкий" },
];

export function TasksModule() {
  const { data: employees = [] } = useEmployees();

  // Filter tasks by assignee (employee -> profile_id)
  const [assigneeEmployeeFilterId, setAssigneeEmployeeFilterId] = useState<string>("");

  const { data: projects = [], isLoading: projectsLoading } = useProjects();
  const createTask = useCreateTask();
  const updateTask = useUpdateTask();

  // Build maps using direct profile_id from employees table
  const employeeProfileMaps = useMemo(() => {
    const employeeToProfile = new Map<string, string>();
    const profileToEmployee = new Map<string, string>();

    for (const emp of employees) {
      if (emp.profile_id) {
        employeeToProfile.set(emp.id, emp.profile_id);
        if (!profileToEmployee.has(emp.profile_id)) {
          profileToEmployee.set(emp.profile_id, emp.id);
        }
      }
    }

    return { employeeToProfile, profileToEmployee };
  }, [employees]);

  const assigneeProfileFilterId = useMemo(() => {
    if (!assigneeEmployeeFilterId) return null;
    const profileId = employeeProfileMaps.employeeToProfile.get(assigneeEmployeeFilterId) || null;
    if (!profileId) {
      // Should not happen if all employees are linked, but keep UX safe
      toast.error("У выбранного сотрудника нет связанного профиля");
      return null;
    }
    return profileId;
  }, [assigneeEmployeeFilterId, employeeProfileMaps]);

  const { data: tasks = [], isLoading: tasksLoading } = useTasks({ assigneeId: assigneeProfileFilterId });

  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<DbTask | null>(null);
  const [expandedProjects, setExpandedProjects] = useState<Set<string>>(new Set(["no-project"]));
  const [form, setForm] = useState({
    title: "",
    assignee_id: "",
    project: "",
    due: new Date().toISOString().slice(0, 10),
    priority: "normal" as TaskPriority,
    labels: "",
  });

  const handleDragStart = (e: DragEvent, taskId: string) => {
    setDraggedTaskId(taskId);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e: DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  };

  const handleDrop = (e: DragEvent, status: TaskStatus) => {
    e.preventDefault();
    if (draggedTaskId) {
      updateTask.mutate({ id: draggedTaskId, status });
      setDraggedTaskId(null);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim()) return;

    const profileId = form.assignee_id
      ? employeeProfileMaps.employeeToProfile.get(form.assignee_id) || null
      : null;

    if (form.assignee_id && !profileId) {
      toast.error("Не удалось назначить исполнителя: нет связанного профиля пользователя");
      return;
    }

    createTask.mutate({
      title: form.title,
      assignee_id: profileId,
      project_id: form.project || null,
      due_date: form.due || null,
      status: "new",
      priority: form.priority,
      labels: form.labels.split(",").map((l) => l.trim()).filter(Boolean),
    });

    setForm({
      title: "",
      assignee_id: "",
      project: "",
      due: new Date().toISOString().slice(0, 10),
      priority: "normal",
      labels: "",
    });
    setIsModalOpen(false);
  };

  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTask || !form.title.trim()) return;

    const profileId = form.assignee_id
      ? employeeProfileMaps.employeeToProfile.get(form.assignee_id) || null
      : null;

    if (form.assignee_id && !profileId) {
      toast.error("Не удалось назначить исполнителя: нет связанного профиля пользователя");
      return;
    }

    updateTask.mutate({
      id: editingTask.id,
      title: form.title,
      assignee_id: profileId,
      project_id: form.project || null,
      due_date: form.due || null,
      priority: form.priority,
      labels: form.labels.split(",").map((l) => l.trim()).filter(Boolean),
    });

    setEditingTask(null);
  };

  const openEditModal = (task: DbTask) => {
    const employeeId = task.assignee_id
      ? employeeProfileMaps.profileToEmployee.get(task.assignee_id) || ""
      : "";

    setEditingTask(task);
    setForm({
      title: task.title,
      assignee_id: employeeId,
      project: task.project_id || "",
      due: task.due_date || new Date().toISOString().slice(0, 10),
      priority: task.priority,
      labels: task.labels?.join(", ") || "",
    });
  };

  const toggleProject = (projectId: string) => {
    setExpandedProjects((prev) => {
      const next = new Set(prev);
      if (next.has(projectId)) {
        next.delete(projectId);
      } else {
        next.add(projectId);
      }
      return next;
    });
  };

  const filteredTasks = tasks;

  // Group tasks by project
  const tasksByProject = useMemo(() => {
    const grouped: Record<string, DbTask[]> = { "no-project": [] };
    projects.forEach((p) => {
      grouped[p.id] = [];
    });

    filteredTasks.forEach((task) => {
      const key = task.project_id || "no-project";
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(task);
    });

    return grouped;
  }, [filteredTasks, projects]);

  const getTasksByStatusAndProject = (status: TaskStatus, projectId: string) =>
    (tasksByProject[projectId] || []).filter((t) => t.status === status);

  const getEmployeeById = (id: string) => employees.find((e) => e.id === id);

  const getAssigneeEmployeeId = (profileId: string | null) =>
    profileId ? employeeProfileMaps.profileToEmployee.get(profileId) || "" : "";

  const handleAssigneeChange = (taskId: string, employeeId: string) => {
    const profileId = employeeId
      ? employeeProfileMaps.employeeToProfile.get(employeeId) || null
      : null;

    if (employeeId && !profileId) {
      toast.error("Не удалось назначить исполнителя: нет связанного профиля пользователя");
      return;
    }

    updateTask.mutate({ id: taskId, assignee_id: profileId });
  };

  const projectsWithTasks = useMemo(() => {
    const result: (Project | { id: "no-project"; name: string })[] = [];
    
    // Add projects that have tasks
    projects.forEach((p) => {
      if (tasksByProject[p.id]?.length > 0) {
        result.push(p);
      }
    });

    // Add "no project" if there are tasks without project
    if (tasksByProject["no-project"]?.length > 0) {
      result.push({ id: "no-project", name: "Без проекта" });
    }

    // Add projects without tasks at the end
    projects.forEach((p) => {
      if (!tasksByProject[p.id]?.length) {
        result.push(p);
      }
    });

    return result;
  }, [projects, tasksByProject]);

  if (tasksLoading || projectsLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-muted-foreground">Загрузка...</div>
      </div>
    );
  }

  return (
    <div className="space-y-4 md:space-y-6">
      <div className="flex flex-col gap-3">
        {/* Top row: count and add button */}
        <div className="flex items-center justify-between">
          <p className="text-sm md:text-base text-muted-foreground">Задач: {filteredTasks.length}</p>
          <button
            onClick={() => setIsModalOpen(true)}
            className="btn-primary h-9 md:h-11 px-3 md:px-5 flex items-center gap-2 text-sm md:text-base"
          >
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">Новая задача</span>
            <span className="sm:hidden">Добавить</span>
          </button>
        </div>

        {/* Filter row */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
          <span className="text-sm text-muted-foreground flex-shrink-0">Исполнитель:</span>
          <div className="flex-1 min-w-0">
            <EmployeeMultiSelect
              employees={employees}
              selectedIds={assigneeEmployeeFilterId ? [assigneeEmployeeFilterId] : []}
              onChange={(ids) => setAssigneeEmployeeFilterId(ids[0] || "")}
              placeholder="Все исполнители"
              single
            />
          </div>
          {assigneeEmployeeFilterId && (
            <button
              type="button"
              onClick={() => setAssigneeEmployeeFilterId("")}
              className="btn-secondary h-9 px-3 py-1.5 text-sm flex-shrink-0"
            >
              Сбросить
            </button>
          )}
        </div>
      </div>

      {/* Projects with Kanban */}
      <div className="space-y-4">
        {projectsWithTasks.map((project) => {
          const projectTaskCount = tasksByProject[project.id]?.length || 0;
          const isExpanded = expandedProjects.has(project.id);

          return (
            <div key={project.id} className="border border-border rounded-xl overflow-hidden">
              <button
                onClick={() => toggleProject(project.id)}
                className="w-full flex items-center gap-3 p-4 bg-muted/30 hover:bg-muted/50 transition-colors text-left"
              >
                {isExpanded ? (
                  <ChevronDown className="w-4 h-4 text-muted-foreground" />
                ) : (
                  <ChevronRight className="w-4 h-4 text-muted-foreground" />
                )}
                <FolderOpen className="w-4 h-4 text-primary" />
                <span className="font-medium text-foreground flex-1">{project.name}</span>
                <span className="chip">{projectTaskCount}</span>
              </button>

              {isExpanded && (
                <div className="p-2 md:p-4">
                  <div className="flex gap-2 md:gap-3 overflow-x-auto pb-2 -mx-2 px-2">
                    {columns.map((column) => {
                      const columnTasks = getTasksByStatusAndProject(column.id, project.id);
                      return (
                        <div
                          key={column.id}
                          className="kanban-column shrink-0 min-w-[200px] md:min-w-[240px] max-w-[280px] p-3 md:p-5"
                          onDragOver={handleDragOver}
                          onDrop={(e) => handleDrop(e, column.id)}
                        >
                          <div className="flex items-center justify-between mb-3 md:mb-4">
                            <h3 className="font-semibold text-foreground text-xs md:text-sm truncate">{column.label}</h3>
                            <span className="chip text-xs ml-1 flex-shrink-0">{columnTasks.length}</span>
                          </div>

                          <div className="space-y-2">
                            {columnTasks.map((task) => {
                              const assigneeEmployeeId = getAssigneeEmployeeId(task.assignee_id);
                              const assigneeEmployee = assigneeEmployeeId ? getEmployeeById(assigneeEmployeeId) : null;

                              return (
                                <TaskCard
                                  key={task.id}
                                  task={task}
                                  employees={employees}
                                  assigneeEmployeeId={assigneeEmployeeId}
                                  assigneeLabel={assigneeEmployee?.full_name || "Не назначен"}
                                  onDragStart={handleDragStart}
                                  onEdit={openEditModal}
                                  onStatusChange={(id, status) => updateTask.mutate({ id, status })}
                                  onPriorityChange={(id, priority) => updateTask.mutate({ id, priority })}
                                  onAssigneeChange={handleAssigneeChange}
                                />
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Новая задача"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">
              Название
            </label>
            <input
              type="text"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              className="input-base w-full"
              placeholder="Введите название задачи"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">
              Проект
            </label>
            <select
              value={form.project}
              onChange={(e) => setForm({ ...form, project: e.target.value })}
              className="input-base w-full"
            >
              <option value="">Без проекта</option>
              {projects.map((proj) => (
                <option key={proj.id} value={proj.id}>
                  {proj.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">
              Приоритет
            </label>
            <select
              value={form.priority}
              onChange={(e) => setForm({ ...form, priority: e.target.value as TaskPriority })}
              className="input-base w-full"
            >
              {priorities.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">
              Исполнитель
            </label>
            <EmployeeMultiSelect
              employees={employees}
              selectedIds={form.assignee_id ? [form.assignee_id] : []}
              onChange={(ids) => setForm({ ...form, assignee_id: ids[0] || "" })}
              placeholder="Выберите исполнителя"
              single
              usePortal
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">
              Срок
            </label>
            <input
              type="date"
              value={form.due}
              onChange={(e) => setForm({ ...form, due: e.target.value })}
              className="input-base w-full"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">
              Метки (через запятую)
            </label>
            <input
              type="text"
              value={form.labels}
              onChange={(e) => setForm({ ...form, labels: e.target.value })}
              className="input-base w-full"
              placeholder="метка1, метка2"
            />
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={() => setIsModalOpen(false)}
              className="btn-secondary"
            >
              Отмена
            </button>
            <button type="submit" className="btn-primary">
              Создать
            </button>
          </div>
        </form>
      </Modal>

      {/* Edit Task Modal */}
      <Modal
        isOpen={!!editingTask}
        onClose={() => setEditingTask(null)}
        title="Редактировать задачу"
      >
        <form onSubmit={handleEditSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">
              Название
            </label>
            <input
              type="text"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              className="input-base w-full"
              placeholder="Введите название задачи"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">
              Проект
            </label>
            <select
              value={form.project}
              onChange={(e) => setForm({ ...form, project: e.target.value })}
              className="input-base w-full"
            >
              <option value="">Без проекта</option>
              {projects.map((proj) => (
                <option key={proj.id} value={proj.id}>
                  {proj.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">
              Приоритет
            </label>
            <select
              value={form.priority}
              onChange={(e) => setForm({ ...form, priority: e.target.value as TaskPriority })}
              className="input-base w-full"
            >
              {priorities.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">
              Исполнитель
            </label>
            <EmployeeMultiSelect
              employees={employees}
              selectedIds={form.assignee_id ? [form.assignee_id] : []}
              onChange={(ids) => setForm({ ...form, assignee_id: ids[0] || "" })}
              placeholder="Выберите исполнителя"
              single
              usePortal
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">
              Срок
            </label>
            <input
              type="date"
              value={form.due}
              onChange={(e) => setForm({ ...form, due: e.target.value })}
              className="input-base w-full"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">
              Метки (через запятую)
            </label>
            <input
              type="text"
              value={form.labels}
              onChange={(e) => setForm({ ...form, labels: e.target.value })}
              className="input-base w-full"
              placeholder="метка1, метка2"
            />
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={() => setEditingTask(null)}
              className="btn-secondary"
            >
              Отмена
            </button>
            <button type="submit" className="btn-primary">
              Сохранить
            </button>
          </div>
        </form>

        {/* Comments section */}
        {editingTask && (
          <div className="mt-6 pt-6 border-t border-border">
            <TaskComments taskId={editingTask.id} />
          </div>
        )}
      </Modal>
    </div>
  );
}

interface TaskCardProps {
  task: DbTask;
  employees: DbEmployee[];
  assigneeEmployeeId: string;
  assigneeLabel: string;
  onDragStart: (e: DragEvent, id: string) => void;
  onEdit: (task: DbTask) => void;
  onStatusChange: (id: string, status: TaskStatus) => void;
  onPriorityChange: (id: string, priority: TaskPriority) => void;
  onAssigneeChange: (id: string, employeeId: string) => void;
}

function TaskCard({
  task,
  employees,
  assigneeEmployeeId,
  assigneeLabel,
  onDragStart,
  onEdit,
  onStatusChange,
  onPriorityChange,
  onAssigneeChange,
}: TaskCardProps) {
  const priorityStyles = {
    critical: { border: "border-red-500", bg: "bg-red-500", text: "text-white" },
    high: { border: "border-orange-500", bg: "bg-orange-500", text: "text-white" },
    normal: { border: "border-blue-500", bg: "bg-blue-500", text: "text-white" },
    low: { border: "border-slate-400", bg: "bg-slate-400", text: "text-white" },
  };

  const style = priorityStyles[task.priority] || priorityStyles.normal;

  return (
    <div
      draggable
      onDragStart={(e) => onDragStart(e, task.id)}
      className={`relative bg-card border-2 ${style.border} rounded-lg p-3 pt-5 cursor-grab active:cursor-grabbing hover:shadow-md transition-shadow`}
    >
      {/* Priority bookmark */}
      <div className={`absolute -top-2 left-3 px-2 py-0.5 rounded text-xs font-semibold ${style.bg} ${style.text} shadow-sm`}>
        {TASK_PRIORITY_LABELS[task.priority]}
      </div>

      {/* Edit button */}
      <button
        onClick={() => onEdit(task)}
        className="absolute top-1 right-1 p-1 hover:bg-muted rounded transition-colors"
      >
        <Pencil className="w-3.5 h-3.5 text-muted-foreground" />
      </button>

      {/* Labels above title */}
      {task.labels && task.labels.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-2">
          {task.labels.slice(0, 3).map((label) => (
            <span key={label} className="chip text-xs">
              {label}
            </span>
          ))}
          {task.labels.length > 3 && (
            <span className="chip text-xs">+{task.labels.length - 3}</span>
          )}
        </div>
      )}

      {/* Title */}
      <h4 
        className="font-medium text-foreground text-sm cursor-pointer hover:text-primary transition-colors mb-3"
        onClick={() => onEdit(task)}
      >
        {task.title}
      </h4>

      {/* Assignee and deadline stacked */}
      <div className="space-y-1.5 text-xs text-muted-foreground">
        <div className="flex items-center gap-2">
          <User className="w-3 h-3 shrink-0" />
          <select
            value={assigneeEmployeeId}
            title={assigneeLabel}
            onChange={(e) => {
              e.stopPropagation();
              onAssigneeChange(task.id, e.target.value);
            }}
            onClick={(e) => e.stopPropagation()}
            className="flex-1 bg-transparent border-none p-0 text-xs text-foreground cursor-pointer focus:ring-0 focus:outline-none truncate"
          >
            <option value="">Не назначен</option>
            {employees.map((emp) => (
              <option key={emp.id} value={emp.id}>
                {emp.full_name}
              </option>
            ))}
          </select>
        </div>
        
        <div className="flex items-center gap-2">
          <Calendar className="w-3 h-3 shrink-0" />
          <span>{task.due_date ? formatDisplayDate(task.due_date) : "Без срока"}</span>
        </div>
      </div>
    </div>
  );
}
