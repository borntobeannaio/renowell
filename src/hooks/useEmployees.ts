import { useQuery } from "@tanstack/react-query";
import { supabaseQuery } from "@/lib/api";
import { supabase } from "@/integrations/supabase/client";

export interface DbEmployee {
  id: string;
  full_name: string;
  position: string;
  phone: string | null;
  email: string | null;
  department: string | null;
  avatar_url: string | null;
  birthday: string | null;
}

export function useEmployees() {
  return useQuery({
    queryKey: ['employees'],
    queryFn: async () => {
      return supabaseQuery(
        () => supabase.from('employees').select('*').order('full_name'),
        'Загрузка сотрудников'
      ) as Promise<DbEmployee[]>;
    },
    retry: 2,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 10000),
  });
}
