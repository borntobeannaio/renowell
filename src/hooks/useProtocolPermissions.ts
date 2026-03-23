import { useAuth } from "@/hooks/useAuth";

// 7 участников последнего протокола — только они видят модуль
const PROTOCOL_ALLOWED_EMAILS = [
  "oparin@renowell.ru",        // Андрей Опарин
  "moroz@renowell.ru",         // Сергей Мороз
  "a.voichenko@renowell.ru",   // Александр Войченко
  "popova@renowell.ru",        // Марина Попова
  "novikova@renowell.ru",      // Елена Новикова
  "bardina@renowell.ru",       // Елена Бардина
  "s.nechaeva@renowell.ru",    // Софья Нечаева
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

export function useProtocolPermissions() {
  const { user } = useAuth();
  const email = user?.email?.toLowerCase() || "";

  const canViewProtocols = PROTOCOL_ALLOWED_EMAILS.includes(email)
    || PROTOCOL_EDITORS.includes(email);

  const canEditProtocols = PROTOCOL_EDITORS.includes(email);

  const canArchive = PROTOCOL_ADMINS.includes(email);

  return {
    canEditProtocols,
    canCreateProtocol: canEditProtocols,
    canCopyProtocol: canEditProtocols,
    canDeleteProtocol: canEditProtocols,
    canArchive,
    canViewProtocols,
  };
}
