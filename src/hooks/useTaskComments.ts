import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface TaskComment {
  id: string;
  task_id: string;
  author_id: string;
  content: string;
  created_at: string;
  updated_at: string;
  author?: {
    id: string;
    first_name: string | null;
    last_name: string | null;
    avatar_url: string | null;
  };
}

export function useTaskComments(taskId: string | null) {
  return useQuery({
    queryKey: ["task-comments", taskId],
    queryFn: async () => {
      if (!taskId) return [];
      
      const { data, error } = await supabase
        .from("task_comments")
        .select(`
          *,
          author:profiles!task_comments_author_id_fkey(id, first_name, last_name, avatar_url)
        `)
        .eq("task_id", taskId)
        .order("created_at", { ascending: true });

      if (error) throw error;
      return data as TaskComment[];
    },
    enabled: !!taskId,
  });
}

export function useCreateTaskComment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ taskId, content }: { taskId: string; content: string }) => {
      // Get current user's profile id
      const { data: profileData, error: profileError } = await supabase
        .rpc("get_user_profile_id");

      if (profileError) throw profileError;
      if (!profileData) throw new Error("Профиль пользователя не найден");

      const { data, error } = await supabase
        .from("task_comments")
        .insert({
          task_id: taskId,
          author_id: profileData,
          content: content.trim(),
        })
        .select(`
          *,
          author:profiles!task_comments_author_id_fkey(id, first_name, last_name, avatar_url)
        `)
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["task-comments", variables.taskId] });
    },
  });
}

export function useDeleteTaskComment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ commentId, taskId }: { commentId: string; taskId: string }) => {
      const { error } = await supabase
        .from("task_comments")
        .delete()
        .eq("id", commentId);

      if (error) throw error;
      return { taskId };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["task-comments", data.taskId] });
    },
  });
}
