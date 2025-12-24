import { useQuery } from "@tanstack/react-query";
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
      const { data, error } = await supabase
        .from('employees')
        .select('*')
        .order('full_name');
      if (error) throw error;
      return data as DbEmployee[];
    },
  });
}
