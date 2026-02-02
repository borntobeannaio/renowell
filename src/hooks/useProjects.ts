import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { proxySelect, proxyUpdate } from "@/lib/dbProxy";

export interface Project {
  id: string;
  name: string;
  archived: boolean;
  created_at: string;
  updated_at: string;
}

export function useProjects(options?: { includeArchived?: boolean }) {
  const includeArchived = options?.includeArchived ?? false;
  
  return useQuery({
    queryKey: ["projects", { includeArchived }],
    queryFn: async () => {
      const filters = includeArchived ? undefined : [{ column: 'archived', operator: 'eq' as const, value: false }];
      const { data, error } = await proxySelect<Project>('projects', {
        filters,
        order: [{ column: 'name', ascending: true }],
      });
      if (error) throw new Error(error.message);
      return data || [];
    },
    retry: 2,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 10000),
  });
}

export function useUpdateProject() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      ...updates
    }: {
      id: string;
      name?: string;
      archived?: boolean;
    }) => {
      const { data, error } = await proxyUpdate<Project>(
        'projects',
        updates,
        [{ column: 'id', operator: 'eq', value: id }],
        '*'
      );

      if (error) throw new Error(error.message);
      return data?.[0];
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["projects"] });
    },
  });
}
