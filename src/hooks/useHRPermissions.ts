import { useAuth } from "@/hooks/useAuth";

// Список email-адресов с правами на управление сотрудниками
const HR_ADMINS = [
  "sonya369@gmail.com",
  "astashkina495@gmail.com",
  "anna.rum91@gmail.com",
  "oparin@renowell.ru",
];

export function useHRPermissions() {
  const { user } = useAuth();

  const canManageEmployees = user?.email 
    ? HR_ADMINS.includes(user.email.toLowerCase())
    : false;

  return {
    canManageEmployees,
    canAddEmployee: canManageEmployees,
    canEditEmployee: canManageEmployees,
    canDeleteEmployee: canManageEmployees,
  };
}
