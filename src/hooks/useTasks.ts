import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { proxySelect, proxyInsert, proxyUpdate } from "@/lib/dbProxy";

export interface DbTask {
  id: string;
  title: string;
  assignee_id: string | null;
  project_id: string | null;
  due_date: string | null;
  status: "inbox" | "doing" | "done";
  labels: string[];
  origin_type: string | null;
  origin_id: string | null;
  created_at: string;
  updated_at: string;
}

export function useTasks() {
  return useQuery({
    queryKey: ["tasks"],
    queryFn: async () => {
      const { data, error } = await proxySelect<DbTask>('tasks', {
        order: [{ column: 'created_at', ascending: false }],
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
      status?: "inbox" | "doing" | "done";
      labels?: string[];
    }) => {
      const { data, error } = await proxyInsert<DbTask>('tasks', {
        title: task.title,
        assignee_id: task.assignee_id || null,
        project_id: task.project_id || null,
        due_date: task.due_date || null,
        status: task.status || "inbox",
        labels: task.labels || [],
      }, '*');

      if (error) throw new Error(error.message);
      return data?.[0];
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
