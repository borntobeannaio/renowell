import { format, parseISO } from "date-fns";

/**
 * Format date from YYYY-MM-DD to DD.MM.YYYY for display
 */
export const formatDisplayDate = (dateStr: string | null | undefined): string => {
  if (!dateStr) return "";
  try {
    return format(parseISO(dateStr), "dd.MM.yyyy");
  } catch {
    return dateStr;
  }
};
