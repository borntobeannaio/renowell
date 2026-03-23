import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { proxySelect, proxyInsert, proxyUpdate, proxyDelete } from "@/lib/dbProxy";

export type TenderStatus = "in_progress" | "first_contact" | "meeting" | "won" | "lost" | "cancelled";

export const TENDER_STATUS_LABELS: Record<TenderStatus, string> = {
  in_progress: "В работе",
  first_contact: "Первые касания",
  meeting: "Встреча",
  won: "Выиграли",
  lost: "Проиграли",
  cancelled: "Отбой",
};

export const TENDER_STATUS_COLUMNS: TenderStatus[] = [
  "first_contact",
  "in_progress",
  "meeting",
  "won",
  "lost",
  "cancelled",
];

export interface DbTenderCompany {
  id: string;
  inn: string | null;
  name: string;
  full_name: string | null;
  ogrn: string | null;
  address: string | null;
  created_at: string;
}

export interface DbTender {
  id: string;
  company_id: string | null;
  project_name: string;
  status: TenderStatus;
  source: string | null;
  manager: string | null;
  contact_info: string | null;
  area_address: string | null;
  interaction_history: string | null;
  tender_start_date: string | null;
  duration_months: number | null;
  budget: string | null;
  notes: string | null;
  lead_grade: string | null;
  color_label: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
  // joined
  company?: DbTenderCompany;
}

export function useTenders() {
  return useQuery({
    queryKey: ["tenders"],
    queryFn: async () => {
      const { data, error } = await proxySelect<DbTender>("tenders", {
        select: "*, company:tender_companies(*)",
        order: [{ column: "sort_order", ascending: true }, { column: "created_at", ascending: false }],
      });
      if (error) throw new Error(error.message);
      return (data || []) as DbTender[];
    },
  });
}

export function useTenderCompanies() {
  return useQuery({
    queryKey: ["tender_companies"],
    queryFn: async () => {
      const { data, error } = await proxySelect<DbTenderCompany>("tender_companies", {
        order: [{ column: "name", ascending: true }],
      });
      if (error) throw new Error(error.message);
      return (data || []) as DbTenderCompany[];
    },
  });
}

export function useCreateTender() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (tender: Partial<DbTender>) => {
      const { data, error } = await proxyInsert("tenders", tender);
      if (error) throw new Error(error.message);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tenders"] }),
  });
}

export function useUpdateTender() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<DbTender> & { id: string }) => {
      const { data, error } = await proxyUpdate("tenders", updates, [
        { column: "id", operator: "eq", value: id },
      ]);
      if (error) throw new Error(error.message);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tenders"] }),
  });
}

export function useDeleteTender() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await proxyDelete("tenders", [
        { column: "id", operator: "eq", value: id },
      ]);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tenders"] }),
  });
}

export function useCreateTenderCompany() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (company: Partial<DbTenderCompany>) => {
      const { data, error } = await proxyInsert("tender_companies", company);
      if (error) throw new Error(error.message);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tender_companies"] }),
  });
}
