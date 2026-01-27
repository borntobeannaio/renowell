import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { proxySelect, proxyInsert, proxyUpdate } from "@/lib/dbProxy";

export type TaskStatus = "new" | "in_progress" | "review" | "done" | "on_hold" | "blocked" | "cancelled";
export type TaskPriority = "critical" | "high" | "normal" | "low";

export const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  new: "Новая",
  in_progress: "В работе",
  review: "На проверке",
  done: "Готово",
  on_hold: "Отложено",
  blocked: "Заблокировано",
  cancelled: "Отменено",
};

export const TASK_PRIORITY_LABELS: Record<TaskPriority, string> = {
  critical: "Критический",
  high: "Высокий",
  normal: "Нормальный",
  low: "Низкий",
};

export const TASK_PRIORITY_COLORS: Record<TaskPriority, string> = {
  critical: "border-l-4 border-l-red-500",
  high: "border-l-4 border-l-orange-500",
  normal: "border-l-4 border-l-blue-500",
  low: "border-l-4 border-l-slate-400",
};

export interface DbTask {
  id: string;
  title: string;
  assignee_id: string | null;
  project_id: string | null;
  due_date: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  labels: string[];
  origin_type: string | null;
  origin_id: string | null;
  created_at: string;
  updated_at: string;
}

export function useTasks(options?: { assigneeId?: string | null }) {
  const assigneeId = options?.assigneeId ?? null;

  return useQuery({
    queryKey: ["tasks", { assigneeId }],
    queryFn: async () => {
      const { data, error } = await proxySelect<DbTask>("tasks", {
        order: [{ column: "created_at", ascending: false }],
        filters: assigneeId ? [{ column: "assignee_id", operator: "eq", value: assigneeId }] : undefined,
      });
      if (error) throw new Error(error.message);
      return data || [];
    },
    retry: 2,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 10000),
  });
}

export function useCreateTask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (task: {
      title: string;
      assignee_id?: string | null;
      project_id?: string | null;
      due_date?: string | null;
      status?: TaskStatus;
      priority?: TaskPriority;
      labels?: string[];
    }) => {
      const { data, error } = await proxyInsert<DbTask>('tasks', {
        title: task.title,
        assignee_id: task.assignee_id || null,
        project_id: task.project_id || null,
        due_date: task.due_date || null,
        status: task.status || "new",
        priority: task.priority || "normal",
        labels: task.labels || [],
      }, '*');

      if (error) throw new Error(error.message);
      
      const newTask = data?.[0];
      
      // Создаём уведомление о назначении задачи
      if (newTask && task.assignee_id) {
        await proxyInsert('notifications', {
          recipient_id: task.assignee_id,
          type: 'task_assigned',
          title: 'Новая задача',
          body: task.title,
          related_task_id: newTask.id,
        });
      }
      
      return newTask;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
    },
  });
}

export function useUpdateTask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      ...updates
    }: Partial<DbTask> & { id: string }) => {
      const { data, error } = await proxyUpdate<DbTask>(
        'tasks',
        updates,
        [{ column: 'id', operator: 'eq', value: id }],
        '*'
      );

      if (error) throw new Error(error.message);
      return data?.[0];
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
    },
  });
}
