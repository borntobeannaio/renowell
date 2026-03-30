import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { proxySelect, proxyInsert, proxyDelete } from "@/lib/dbProxy";

export interface TenderInteraction {
  id: string;
  tender_id: string;
  content: string;
  created_at: string;
  author_id: string | null;
}

export function useTenderInteractions(tenderId: string) {
  return useQuery({
    queryKey: ["tender_interactions", tenderId],
    queryFn: async () => {
      const { data, error } = await proxySelect<TenderInteraction>("tender_interactions", {
        filters: [{ column: "tender_id", operator: "eq", value: tenderId }],
        order: [{ column: "created_at", ascending: false }],
      });
      if (error) throw error;
      return data || [];
    },
    enabled: !!tenderId,
  });
}

export function useCreateTenderInteraction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: { tender_id: string; content: string; author_id?: string }) => {
      const { data, error } = await proxyInsert("tender_interactions", params);
      if (error) throw error;
      return data;
    },
    onSuccess: (_, vars) => qc.invalidateQueries({ queryKey: ["tender_interactions", vars.tender_id] }),
  });
}

export function useDeleteTenderInteraction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: { id: string; tender_id: string }) => {
      const { error } = await proxyDelete("tender_interactions", [{ column: "id", operator: "eq", value: params.id }]);
      if (error) throw error;
    },
    onSuccess: (_, vars) => qc.invalidateQueries({ queryKey: ["tender_interactions", vars.tender_id] }),
  });
}
