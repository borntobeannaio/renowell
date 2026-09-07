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

// Сотрудники строительного отдела — просмотр и редактирование всех строй-протоколов
const CONSTRUCTION_VIEWERS = [
  "a.bikkuzhin@renowell.ru",   // Биккужин Артур
  "moroz@renowell.ru",         // Мороз Сергей
  "a.voichenko@renowell.ru",   // Войченко Александр
  "popov@renowell.ru",         // Попов Никита
  "a.zaveryachev@renowell.ru", // Заверячев Александр
  "murashko@renowell.ru",      // Мурашко Александр
  "m.akopyan@renowell.ru",     // Акопян Марк
  "d.davaakay@renowell.ru",    // Даваакай Дажы
  "r.panchenko@renowell.ru",   // Панченко Ростислав
  "a.gorbatov@renowell.ru",    // Горбатов Александр
  "t.lagiev@renowell.ru",      // Лагиев Тагир
  "e.lazarev@renowell.ru",     // Лазарев Евгений
  "k.magomedov@renowell.ru",   // Магомедов Курбан
  "a.serov@renowell.ru",       // Серов Александр
  "e.litvin@renowell.ru",      // Литвин Евгений
  "oparin@renowell.ru",        // Опарин Андрей
  "s.nechaeva@renowell.ru",    // Нечаева Софья
  "m.vlasova@renowell.ru",     // Власова Мария
  "la@renowell.ru",            // Лизунок Анастасия
];

export function useProtocolPermissions() {
  const { user } = useAuth();
  const email = user?.email?.toLowerCase() || "";

  const canViewProtocols = PROTOCOL_ALLOWED_EMAILS.includes(email)
    || PROTOCOL_EDITORS.includes(email)
    || CONSTRUCTION_AUTHORS.includes(email)
    || CONSTRUCTION_ADMINS.includes(email)
    || CONSTRUCTION_VIEWERS.includes(email);

  const canEditProtocols = PROTOCOL_EDITORS.includes(email);
  const canArchive = PROTOCOL_ADMINS.includes(email);

  const isConstructionAuthor = CONSTRUCTION_AUTHORS.includes(email);
  const isConstructionAdmin = CONSTRUCTION_ADMINS.includes(email);
  const isConstructionViewer = CONSTRUCTION_VIEWERS.includes(email);
  const canCreateConstructionProtocol = isConstructionAuthor || isConstructionAdmin;

  // Доступ к конкретному строй-протоколу: admin (полный), сотрудник стройотдела или участник
  const canViewConstructionProtocol = (
    protocolParticipantIds: string[] | null | undefined,
    currentProfileId: string | null | undefined,
  ) => {
    if (isConstructionAdmin || isConstructionViewer) return true;
    if (!currentProfileId) return false;
    return Array.isArray(protocolParticipantIds) && protocolParticipantIds.includes(currentProfileId);
  };

  // Редактировать могут админы и участники протокола; сотрудники стройотдела (viewers) — только просмотр
  const canEditConstructionProtocol = (
    protocolParticipantIds: string[] | null | undefined,
    currentProfileId: string | null | undefined,
  ) => {
    if (isConstructionAdmin) return true;
    if (isConstructionViewer) return false;
    if (!currentProfileId) return false;
    return Array.isArray(protocolParticipantIds) && protocolParticipantIds.includes(currentProfileId);
  };

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
