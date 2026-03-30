import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { proxySelect, proxyInsert, proxyUpdate, proxyDelete } from "@/lib/dbProxy";

export interface TenderChecklistItem {
  id: string;
  tender_id: string;
  text: string;
  completed: boolean;
  sort_order: number;
  created_at: string;
}

export function useTenderChecklist(tenderId: string) {
  return useQuery({
    queryKey: ["tender_checklist", tenderId],
    queryFn: async () => {
      const { data, error } = await proxySelect<TenderChecklistItem>("tender_checklist_items", {
        filters: [{ column: "tender_id", operator: "eq", value: tenderId }],
        order: [{ column: "sort_order", ascending: true }, { column: "created_at", ascending: true }],
      });
      if (error) throw new Error(error.message);
      return (data || []) as TenderChecklistItem[];
    },
    enabled: !!tenderId,
  });
}

export function useAddChecklistItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (item: { tender_id: string; text: string; sort_order?: number }) => {
      const { data, error } = await proxyInsert("tender_checklist_items", item);
      if (error) throw new Error(error.message);
      return data;
    },
    onSuccess: (_, vars) => qc.invalidateQueries({ queryKey: ["tender_checklist", vars.tender_id] }),
  });
}

export function useUpdateChecklistItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, tender_id, ...updates }: { id: string; tender_id: string; text?: string; completed?: boolean }) => {
      const { error } = await proxyUpdate("tender_checklist_items", updates, [
        { column: "id", operator: "eq", value: id },
      ]);
      if (error) throw new Error(error.message);
    },
    onSuccess: (_, vars) => qc.invalidateQueries({ queryKey: ["tender_checklist", vars.tender_id] }),
  });
}

export function useDeleteChecklistItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, tender_id }: { id: string; tender_id: string }) => {
      const { error } = await proxyDelete("tender_checklist_items", [
        { column: "id", operator: "eq", value: id },
      ]);
      if (error) throw new Error(error.message);
    },
    onSuccess: (_, vars) => qc.invalidateQueries({ queryKey: ["tender_checklist", vars.tender_id] }),
  });
}
