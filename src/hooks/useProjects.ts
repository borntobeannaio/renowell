import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { supabaseQuery } from "@/lib/api";

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
      return supabaseQuery(
        () => supabase.from("projects").select("*").order("name"),
        'Загрузка проектов'
      ) as Promise<Project[]>;
    },
    retry: 2,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 10000),
  });
}
