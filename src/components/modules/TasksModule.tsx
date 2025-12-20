import { useState, DragEvent } from "react";
import { useApp } from "@/context/AppContext";
import { Modal } from "@/components/ui/Modal";
import { Plus, Calendar, User, GripVertical } from "lucide-react";
import { Task, TaskStatus } from "@/types";

const columns: { id: TaskStatus; label: string }[] = [
  { id: "inbox", label: "Входящие" },
  { id: "doing", label: "В работе" },
  { id: "done", label: "Готово" },
];

export function TasksModule() {
  const { tasks, employees, addTask, updateTaskStatus, updateTaskAssignee, getEmployeeById } = useApp();
  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [form, setForm] = useState({
    title: "",
    assignee: "",
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
      updateTaskStatus(draggedTaskId, status);
      setDraggedTaskId(null);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim() || !form.assignee) return;

    addTask({
      title: form.title,
      assignee: form.assignee,
      due: form.due,
      status: "inbox",
      labels: form.labels.split(",").map((l) => l.trim()).filter(Boolean),
      origin: null,
    });

    setForm({
      title: "",
      assignee: "",
      due: new Date().toISOString().slice(0, 10),
      labels: "",
    });
    setIsModalOpen(false);
  };

  const getTasksByStatus = (status: TaskStatus) =>
    tasks.filter((t) => t.status === status);

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

      <div className="flex gap-4 overflow-x-auto pb-4 -mx-4 px-4 md:mx-0 md:px-0">
        {columns.map((column) => (
          <div
            key={column.id}
            className="kanban-column shrink-0"
            onDragOver={handleDragOver}
            onDrop={(e) => handleDrop(e, column.id)}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-foreground">{column.label}</h3>
              <span className="chip">{getTasksByStatus(column.id).length}</span>
            </div>

            <div className="space-y-3">
              {getTasksByStatus(column.id).map((task) => (
                <TaskCard
                  key={task.id}
                  task={task}
                  employees={employees}
                  getEmployeeById={getEmployeeById}
                  onDragStart={handleDragStart}
                  onStatusChange={updateTaskStatus}
                  onAssigneeChange={updateTaskAssignee}
                />
              ))}
            </div>
          </div>
        ))}
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
              Исполнитель
            </label>
            <select
              value={form.assignee}
              onChange={(e) => setForm({ ...form, assignee: e.target.value })}
              className="input-base w-full"
              required
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
              required
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
  task: Task;
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
  const assignee = getEmployeeById(task.assignee);

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

          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <div className="flex items-center gap-1">
              <Calendar className="w-3 h-3" />
              <span>{task.due}</span>
            </div>
          </div>

          <div className="mt-3 pt-3 border-t border-border flex items-center gap-2">
            <User className="w-3 h-3 text-muted-foreground" />
            <select
              value={task.assignee}
              onChange={(e) => onAssigneeChange(task.id, e.target.value)}
              className="text-xs bg-transparent border-none p-0 focus:ring-0 text-foreground cursor-pointer flex-1"
            >
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
