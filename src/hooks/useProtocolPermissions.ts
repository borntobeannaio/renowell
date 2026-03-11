import { useAuth } from "@/hooks/useAuth";
import { useEmployees } from "@/hooks/useEmployees";
import { useProtocols } from "@/hooks/useProtocols";
import { useCurrentProfile } from "@/hooks/useCurrentProfile";
import { useMemo } from "react";

// Список email-адресов с правами на редактирование протоколов
const PROTOCOL_EDITORS = [
  "sonya369@gmail.com",
  "anna.rum91@gmail.com",
  "astashkina495@gmail.com",
  "oparin@renowell.ru",
];

// Список email-адресов с правами на архивирование
const PROTOCOL_ADMINS = [
  "sonya369@gmail.com",
  "anna.rum91@gmail.com",
  "astashkina495@gmail.com",
  "oparin@renowell.ru",
];

export function useProtocolPermissions() {
  const { user } = useAuth();
  const { data: profile } = useCurrentProfile();
  const { data: employees = [] } = useEmployees();
  const { data: protocols = [] } = useProtocols();

  const canEditProtocols = user?.email 
    ? PROTOCOL_EDITORS.includes(user.email.toLowerCase())
    : false;

  const canArchive = user?.email
    ? PROTOCOL_ADMINS.includes(user.email.toLowerCase())
    : false;

  // Check if user appears in any protocol as attendee or organizer
  const canViewProtocols = useMemo(() => {
    // Editors always have access
    if (canEditProtocols) return true;
    if (!profile?.id) return false;

    // Find current user's employee record
    const myEmployee = employees.find(e => e.profile_id === profile.id);
    if (!myEmployee) return false;

    // Collect all name variants for this employee
    const nameVariants = new Set<string>();
    if (myEmployee.full_name) nameVariants.add(myEmployee.full_name.toLowerCase());
    if (myEmployee.first_name && myEmployee.last_name) {
      nameVariants.add(`${myEmployee.first_name} ${myEmployee.last_name}`.toLowerCase());
      nameVariants.add(`${myEmployee.last_name} ${myEmployee.first_name}`.toLowerCase());
    }
    if (myEmployee.first_name && myEmployee.last_name && myEmployee.middle_name) {
      nameVariants.add(`${myEmployee.last_name} ${myEmployee.first_name} ${myEmployee.middle_name}`.toLowerCase());
    }

    if (nameVariants.size === 0) return false;

    // Check if any protocol mentions this employee
    return protocols.some(p => {
      const attendees = (p.attendees || []).map(a => a.toLowerCase());
      const organizer = p.organizer?.toLowerCase() || "";

      return attendees.some(a => {
        if (!a) return false;
        for (const variant of nameVariants) {
          if (a.includes(variant) || variant.includes(a)) return true;
        }
        return false;
      }) || (organizer.length > 0 && [...nameVariants].some(v => organizer.includes(v) || v.includes(organizer)));
    });
  }, [canEditProtocols, profile?.id, employees, protocols]);

  return {
    canEditProtocols,
    canCreateProtocol: canEditProtocols,
    canCopyProtocol: canEditProtocols,
    canDeleteProtocol: canEditProtocols,
    canArchive,
    canViewProtocols,
  };
}
