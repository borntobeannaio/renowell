import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

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
      const { data, error } = await supabase
        .from("tasks")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as DbTask[];
    },
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
      const { data, error } = await supabase
        .from("tasks")
        .insert({
          title: task.title,
          assignee_id: task.assignee_id || null,
          project_id: task.project_id || null,
          due_date: task.due_date || null,
          status: task.status || "inbox",
          labels: task.labels || [],
        })
        .select()
        .single();

      if (error) throw error;
      return data;
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
      const { data, error } = await supabase
        .from("tasks")
        .update(updates)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
    },
  });
}
