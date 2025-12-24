import { useState, DragEvent, useMemo } from "react";
import { Modal } from "@/components/ui/Modal";
import { Plus, Calendar, User, GripVertical, FolderOpen, ChevronDown, ChevronRight } from "lucide-react";
import { useTasks, useCreateTask, useUpdateTask, DbTask } from "@/hooks/useTasks";
import { useProjects, Project } from "@/hooks/useProjects";
import { useApp } from "@/context/AppContext";

type TaskStatus = "inbox" | "doing" | "done";

const columns: { id: TaskStatus; label: string }[] = [
  { id: "inbox", label: "Входящие" },
  { id: "doing", label: "В работе" },
  { id: "done", label: "Готово" },
];

export function TasksModule() {
  const { employees, getEmployeeById } = useApp();
  const { data: tasks = [], isLoading: tasksLoading } = useTasks();
  const { data: projects = [], isLoading: projectsLoading } = useProjects();
  const createTask = useCreateTask();
  const updateTask = useUpdateTask();

  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [expandedProjects, setExpandedProjects] = useState<Set<string>>(new Set(["no-project"]));
  const [form, setForm] = useState({
    title: "",
    assignee: "",
    project: "",
    due: new Date().toISOString().slice(0, 10),
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

    createTask.mutate({
      title: form.title,
      assignee_id: form.assignee || null,
      project_id: form.project || null,
      due_date: form.due || null,
      status: "inbox",
      labels: form.labels.split(",").map((l) => l.trim()).filter(Boolean),
    });

    setForm({
      title: "",
      assignee: "",
      project: "",
      due: new Date().toISOString().slice(0, 10),
      labels: "",
    });
    setIsModalOpen(false);
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

  // Group tasks by project
  const tasksByProject = useMemo(() => {
    const grouped: Record<string, DbTask[]> = { "no-project": [] };
    projects.forEach((p) => {
      grouped[p.id] = [];
    });

    tasks.forEach((task) => {
      const key = task.project_id || "no-project";
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(task);
    });

    return grouped;
  }, [tasks, projects]);

  const getTasksByStatusAndProject = (status: TaskStatus, projectId: string) =>
    (tasksByProject[projectId] || []).filter((t) => t.status === status);

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
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <p className="text-muted-foreground">Всего задач: {tasks.length}</p>
        <button
          onClick={() => setIsModalOpen(true)}
          className="btn-primary flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          Новая задача
        </button>
      </div>

      {/* Projects with Kanban */}
      <div className="space-y-4">
        {projectsWithTasks.map((project) => {
          const projectTaskCount = tasksByProject[project.id]?.length || 0;
          const isExpanded = expandedProjects.has(project.id);

          return (
            <div key={project.id} className="border border-border rounded-lg overflow-hidden">
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
                <div className="p-4">
                  <div className="flex gap-4 overflow-x-auto pb-2">
                    {columns.map((column) => {
                      const columnTasks = getTasksByStatusAndProject(column.id, project.id);
                      return (
                        <div
                          key={column.id}
                          className="kanban-column shrink-0"
                          onDragOver={handleDragOver}
                          onDrop={(e) => handleDrop(e, column.id)}
                        >
                          <div className="flex items-center justify-between mb-4">
                            <h3 className="font-semibold text-foreground">{column.label}</h3>
                            <span className="chip">{columnTasks.length}</span>
                          </div>

                          <div className="space-y-3">
                            {columnTasks.map((task) => (
                              <TaskCard
                                key={task.id}
                                task={task}
                                employees={employees}
                                getEmployeeById={getEmployeeById}
                                onDragStart={handleDragStart}
                                onStatusChange={(id, status) => updateTask.mutate({ id, status })}
                                onAssigneeChange={(id, assignee_id) => updateTask.mutate({ id, assignee_id })}
                              />
                            ))}
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
              Исполнитель
            </label>
            <select
              value={form.assignee}
              onChange={(e) => setForm({ ...form, assignee: e.target.value })}
              className="input-base w-full"
            >
              <option value="">Выберите исполнителя</option>
              {employees.map((emp) => (
                <option key={emp.id} value={emp.id}>
                  {emp.name}
                </option>
              ))}
            </select>
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
    </div>
  );
}

interface TaskCardProps {
  task: DbTask;
  employees: { id: string; name: string }[];
  getEmployeeById: (id: string) => { name: string } | undefined;
  onDragStart: (e: DragEvent, id: string) => void;
  onStatusChange: (id: string, status: TaskStatus) => void;
  onAssigneeChange: (id: string, assignee: string) => void;
}

function TaskCard({
  task,
  employees,
  getEmployeeById,
  onDragStart,
  onStatusChange,
  onAssigneeChange,
}: TaskCardProps) {
  const assignee = task.assignee_id ? getEmployeeById(task.assignee_id) : null;

  return (
    <div
      draggable
      onDragStart={(e) => onDragStart(e, task.id)}
      className="kanban-card"
    >
      <div className="flex items-start gap-2">
        <GripVertical className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
        <div className="flex-1 min-w-0">
          <h4 className="font-medium text-foreground text-sm mb-2">{task.title}</h4>

          {task.labels.length > 0 && (
            <div className="flex flex-wrap gap-1 mb-3">
              {task.labels.slice(0, 2).map((label) => (
                <span key={label} className="chip text-xs">
                  {label}
                </span>
              ))}
              {task.labels.length > 2 && (
                <span className="chip text-xs">+{task.labels.length - 2}</span>
              )}
            </div>
          )}

          {task.due_date && (
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <div className="flex items-center gap-1">
                <Calendar className="w-3 h-3" />
                <span>{task.due_date}</span>
              </div>
            </div>
          )}

          <div className="mt-3 pt-3 border-t border-border flex items-center gap-2">
            <User className="w-3 h-3 text-muted-foreground" />
            <select
              value={task.assignee_id || ""}
              onChange={(e) => onAssigneeChange(task.id, e.target.value)}
              className="text-xs bg-transparent border-none p-0 focus:ring-0 text-foreground cursor-pointer flex-1"
            >
              <option value="">Не назначен</option>
              {employees.map((emp) => (
                <option key={emp.id} value={emp.id}>
                  {emp.name}
                </option>
              ))}
            </select>

            <select
              value={task.status}
              onChange={(e) => onStatusChange(task.id, e.target.value as TaskStatus)}
              className="text-xs bg-transparent border-none p-0 focus:ring-0 text-muted-foreground cursor-pointer"
            >
              <option value="inbox">Входящие</option>
              <option value="doing">В работе</option>
              <option value="done">Готово</option>
            </select>
          </div>
        </div>
      </div>
    </div>
  );
}
