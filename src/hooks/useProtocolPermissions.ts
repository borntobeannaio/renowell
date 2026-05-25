import { useAuth } from "@/hooks/useAuth";

// 7 участников последнего протокола — только они видят модуль
const PROTOCOL_ALLOWED_EMAILS = [
  "oparin@renowell.ru",
  "moroz@renowell.ru",
  "a.voichenko@renowell.ru",
  "popova@renowell.ru",
  "novikova@renowell.ru",
  "bardina@renowell.ru",
  "s.nechaeva@renowell.ru",
];

// Список email-адресов с правами на редактирование протоколов
const PROTOCOL_EDITORS = [
  "sonya369@gmail.com",
  "anna.rum91@gmail.com",
  "astashkina495@gmail.com",
  "oparin@renowell.ru",
  "s.nechaeva@renowell.ru",
];

// Список email-адресов с правами на архивирование
const PROTOCOL_ADMINS = [
  "sonya369@gmail.com",
  "anna.rum91@gmail.com",
  "astashkina495@gmail.com",
  "oparin@renowell.ru",
  "s.nechaeva@renowell.ru",
];

// Руководители проектов, которые могут создавать строительные протоколы
const CONSTRUCTION_AUTHORS = [
  "m.akopyan@renowell.ru",
  "popov@renowell.ru",
  "e.lazarev@renowell.ru",
  "a.gorbatov@renowell.ru",
];

// Полный доступ ко всем строй-протоколам
const CONSTRUCTION_ADMINS = [
  "sonya369@gmail.com",
  "anna.rum91@gmail.com",
];

export function useProtocolPermissions() {
  const { user } = useAuth();
  const email = user?.email?.toLowerCase() || "";

  const canViewProtocols = PROTOCOL_ALLOWED_EMAILS.includes(email)
    || PROTOCOL_EDITORS.includes(email)
    || CONSTRUCTION_AUTHORS.includes(email)
    || CONSTRUCTION_ADMINS.includes(email);

  const canEditProtocols = PROTOCOL_EDITORS.includes(email);
  const canArchive = PROTOCOL_ADMINS.includes(email);

  const isConstructionAuthor = CONSTRUCTION_AUTHORS.includes(email);
  const isConstructionAdmin = CONSTRUCTION_ADMINS.includes(email);
  const canCreateConstructionProtocol = isConstructionAuthor || isConstructionAdmin;

  // Доступ к конкретному строй-протоколу: admin (полный) или участник (включая автора)
  const canViewConstructionProtocol = (
    protocolParticipantIds: string[] | null | undefined,
    currentProfileId: string | null | undefined,
  ) => {
    if (isConstructionAdmin) return true;
    if (!currentProfileId) return false;
    return Array.isArray(protocolParticipantIds) && protocolParticipantIds.includes(currentProfileId);
  };

  const canEditConstructionProtocol = canViewConstructionProtocol;

  return {
    canEditProtocols,
    canCreateProtocol: canEditProtocols,
    canCopyProtocol: canEditProtocols,
    canDeleteProtocol: canEditProtocols,
    canArchive,
    canViewProtocols,
    // construction
    canCreateConstructionProtocol,
    isConstructionAdmin,
    canViewConstructionProtocol,
    canEditConstructionProtocol,
  };
}
