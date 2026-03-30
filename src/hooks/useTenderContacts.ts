import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { proxySelect, proxyInsert, proxyUpdate, proxyDelete } from "@/lib/dbProxy";

export interface TenderContact {
  id: string;
  tender_id: string;
  name: string;
  phone: string;
  description: string;
  created_at: string;
}

export function useTenderContacts(tenderId: string) {
  return useQuery({
    queryKey: ["tender_contacts", tenderId],
    queryFn: async () => {
      const { data, error } = await proxySelect<TenderContact>("tender_contacts", {
        filters: [{ column: "tender_id", operator: "eq", value: tenderId }],
        order: [{ column: "created_at", ascending: true }],
      });
      if (error) throw error;
      return data || [];
    },
    enabled: !!tenderId,
  });
}

export function useCreateTenderContact() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: { tender_id: string; name?: string; phone?: string; description?: string }) => {
      const { data, error } = await proxyInsert("tender_contacts", params);
      if (error) throw error;
      return data;
    },
    onSuccess: (_, vars) => qc.invalidateQueries({ queryKey: ["tender_contacts", vars.tender_id] }),
  });
}

export function useUpdateTenderContact() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: { id: string; tender_id: string; name?: string; phone?: string; description?: string }) => {
      const { id, tender_id, ...rest } = params;
      const { error } = await proxyUpdate("tender_contacts", rest, [{ column: "id", operator: "eq", value: id }]);
      if (error) throw error;
    },
    onSuccess: (_, vars) => qc.invalidateQueries({ queryKey: ["tender_contacts", vars.tender_id] }),
  });
}

export function useDeleteTenderContact() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: { id: string; tender_id: string }) => {
      const { error } = await proxyDelete("tender_contacts", [{ column: "id", operator: "eq", value: params.id }]);
      if (error) throw error;
    },
    onSuccess: (_, vars) => qc.invalidateQueries({ queryKey: ["tender_contacts", vars.tender_id] }),
  });
}
