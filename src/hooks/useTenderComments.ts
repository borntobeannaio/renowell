import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { proxySelect, proxyInsert, proxyUpdate, proxyDelete } from "@/lib/dbProxy";

export interface DbTenderComment {
  id: string;
  tender_id: string;
  author_id: string;
  content: string;
  created_at: string;
  updated_at: string;
}

export function useTenderComments(tenderId: string | null) {
  return useQuery({
    queryKey: ["tender_comments", tenderId],
    queryFn: async () => {
      if (!tenderId) return [];
      const { data, error } = await proxySelect<DbTenderComment>("tender_comments", {
        filters: [{ column: "tender_id", operator: "eq", value: tenderId }],
        order: [{ column: "created_at", ascending: true }],
      });
      if (error) throw new Error(error.message);
      return data || [];
    },
    enabled: !!tenderId,
  });
}

export function useCreateTenderComment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (comment: { tender_id: string; author_id: string; content: string }) => {
      const { data, error } = await proxyInsert("tender_comments", comment);
      if (error) throw new Error(error.message);
      return data;
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ["tender_comments", vars.tender_id] });
    },
  });
}

export function useUpdateTenderComment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, tender_id, content }: { id: string; tender_id: string; content: string }) => {
      const { error } = await proxyUpdate("tender_comments", { content }, [
        { column: "id", operator: "eq", value: id },
      ]);
      if (error) throw new Error(error.message);
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ["tender_comments", vars.tender_id] });
    },
  });
}

export function useDeleteTenderComment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, tender_id }: { id: string; tender_id: string }) => {
      const { error } = await proxyDelete("tender_comments", [
        { column: "id", operator: "eq", value: id },
      ]);
      if (error) throw new Error(error.message);
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ["tender_comments", vars.tender_id] });
    },
  });
}
