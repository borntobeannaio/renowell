import { useAuth } from "@/hooks/useAuth";

// Список email-адресов с правами на редактирование протоколов
const PROTOCOL_EDITORS = [
  "sonya369@gmail.com",
  "anna.rum91@gmail.com",
  "astashkina495@gmail.com",
];

export function useProtocolPermissions() {
  const { user } = useAuth();

  const canEditProtocols = user?.email 
    ? PROTOCOL_EDITORS.includes(user.email.toLowerCase())
    : false;

  return {
    canEditProtocols,
    canCreateProtocol: canEditProtocols,
    canCopyProtocol: canEditProtocols,
    canDeleteProtocol: canEditProtocols,
  };
}
