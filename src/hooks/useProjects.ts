import { useQuery } from "@tanstack/react-query";
import { proxySelect } from "@/lib/dbProxy";

export interface Project {
  id: string;
  name: string;
  created_at: string;
  updated_at: string;
}

export function useProjects() {
  return useQuery({
    queryKey: ["projects"],
    queryFn: async () => {
      const { data, error } = await proxySelect<Project>('projects', {
        order: [{ column: 'name', ascending: true }],
      });
      if (error) throw new Error(error.message);
      return data || [];
    },
    retry: 2,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 10000),
  });
}
