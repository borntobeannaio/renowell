import { useQuery } from "@tanstack/react-query";
import { proxySelect } from "@/lib/dbProxy";

export interface DbEmployee {
  id: string;
  full_name: string;
  first_name: string | null;
  last_name: string | null;
  middle_name: string | null;
  position: string;
  phone: string | null;
  email: string | null;
  department: string | null;
  avatar_url: string | null;
  birthday: string | null;
  profile_id: string | null;
  description: string | null;
}

/** Returns "Имя Фамилия" display name */
export function getEmployeeDisplayName(emp: Pick<DbEmployee, 'first_name' | 'last_name' | 'full_name'>): string {
  if (emp.first_name || emp.last_name) {
    return [emp.first_name, emp.last_name].filter(Boolean).join(" ");
  }
  return emp.full_name || "Сотрудник";
}

/** Returns full name with patronymic: "Фамилия Имя Отчество" */
export function getEmployeeFullDisplayName(emp: Pick<DbEmployee, 'first_name' | 'last_name' | 'middle_name' | 'full_name'>): string {
  if (emp.last_name || emp.first_name) {
    return [emp.last_name, emp.first_name, emp.middle_name].filter(Boolean).join(" ");
  }
  return emp.full_name || "Сотрудник";
}

export function useEmployees() {
  return useQuery({
    queryKey: ['employees'],
    queryFn: async () => {
      const { data, error } = await proxySelect<DbEmployee>('employees', {
        order: [{ column: 'full_name', ascending: true }],
      });
      if (error) throw new Error(error.message);
      return data || [];
    },
    retry: 2,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 10000),
  });
}
