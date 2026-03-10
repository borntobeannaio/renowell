import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { proxySelect, proxyInsert, proxyUpdate } from "@/lib/dbProxy";

export type TaskStatus = "new" | "in_progress" | "done" | "archived";
export type TaskPriority = "critical" | "high" | "normal" | "low";

export const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  new: "Новая",
  in_progress: "В работе",
  done: "Готово",
  archived: "Архив",
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
  assignee_ids: string[];
  responsible_ids: string[];
  observer_ids: string[];
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
        filters: assigneeId ? [{ column: "assignee_ids", operator: "cs", value: [assigneeId] }] : undefined,
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
      assignee_ids?: string[];
      responsible_ids?: string[];
      observer_ids?: string[];
      project_id?: string | null;
      due_date?: string | null;
      status?: TaskStatus;
      priority?: TaskPriority;
      labels?: string[];
    }) => {
      const { data, error } = await proxyInsert<DbTask>('tasks', {
        title: task.title,
        assignee_ids: task.assignee_ids || [],
        responsible_ids: task.responsible_ids || [],
        observer_ids: task.observer_ids || [],
        project_id: task.project_id || null,
        due_date: task.due_date || null,
        status: task.status || "new",
        priority: task.priority || "normal",
        labels: task.labels || [],
      }, '*');

      if (error) throw new Error(error.message);
      
      const newTask = data?.[0];
      
      // Создаём уведомления о назначении задачи для всех исполнителей
      if (newTask && task.assignee_ids && task.assignee_ids.length > 0) {
        const notifications = task.assignee_ids.map(assigneeId => ({
          recipient_id: assigneeId,
          type: 'task_assigned',
          title: 'У вас появилась новая задача',
          body: task.title,
          link: `/tasks?task=${newTask.id}`,
          related_task_id: newTask.id,
        }));
        await proxyInsert('notifications', notifications);
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
      // Fetch current task to diff assignee_ids and get title
      let previousAssigneeIds: string[] = [];
      let taskTitle = '';
      if (updates.assignee_ids) {
        const { data: current } = await proxySelect<DbTask>('tasks', {
          filters: [{ column: 'id', operator: 'eq', value: id }],
          select: 'assignee_ids,title',
        });
        previousAssigneeIds = current?.[0]?.assignee_ids || [];
        taskTitle = current?.[0]?.title || '';
      }

      const { data, error } = await proxyUpdate<DbTask>(
        'tasks',
        updates,
        [{ column: 'id', operator: 'eq', value: id }],
        '*'
      );

      if (error) throw new Error(error.message);

      // Send notifications to newly added assignees
      if (updates.assignee_ids) {
        const newAssignees = updates.assignee_ids.filter(
          aid => !previousAssigneeIds.includes(aid)
        );
        if (newAssignees.length > 0) {
          const title = updates.title || taskTitle || 'Задача';
          const notifications = newAssignees.map(assigneeId => ({
            recipient_id: assigneeId,
            type: 'task_assigned',
            title: 'Вас назначили исполнителем задачи',
            body: title,
            link: `/tasks?task=${id}`,
            related_task_id: id,
          }));
          await proxyInsert('notifications', notifications);
        }
      }

      return data?.[0];
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
    },
  });
}
