import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { proxySelect, proxyInsert, proxyDelete as dbProxyDelete } from "@/lib/dbProxy";
import { proxyUpload, proxyDelete as storageProxyDelete } from "@/lib/storageProxy";
import { supabase } from "@/integrations/supabase/client";

export interface TenderAttachment {
  id: string;
  tender_id: string;
  file_name: string;
  file_url: string;
  storage_path: string;
  content_type: string;
  file_size: number;
  uploaded_by: string | null;
  created_at: string;
}

export function useTenderAttachments(tenderId: string) {
  return useQuery({
    queryKey: ["tender_attachments", tenderId],
    queryFn: async () => {
      const { data, error } = await proxySelect<TenderAttachment>("tender_attachments", {
        filters: [{ column: "tender_id", operator: "eq", value: tenderId }],
        order: [{ column: "created_at", ascending: false }],
      });
      if (error) throw new Error(error.message);
      return (data || []) as TenderAttachment[];
    },
    enabled: !!tenderId,
  });
}

export function useUploadTenderAttachment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ tenderId, file }: { tenderId: string; file: File }) => {
      const { data: { user } } = await supabase.auth.getUser();
      
      // Get profile id
      let profileId: string | null = null;
      if (user) {
        const { data: profiles } = await proxySelect<{ id: string }>("profiles", {
          filters: [{ column: "user_id", operator: "eq", value: user.id }],
          select: "id",
        });
        profileId = profiles?.[0]?.id || null;
      }

      const timestamp = Date.now();
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const storagePath = `tenders/${tenderId}/${timestamp}_${safeName}`;

      // Upload to storage
      const { error: uploadError } = await proxyUpload("renowell", storagePath, file);
      if (uploadError) throw new Error(uploadError.message);

      // Build public URL
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const fileUrl = `${supabaseUrl}/storage/v1/object/public/renowell/${storagePath}`;

      // Save record
      const { error: dbError } = await proxyInsert("tender_attachments", {
        tender_id: tenderId,
        file_name: file.name,
        file_url: fileUrl,
        storage_path: storagePath,
        content_type: file.type || "application/octet-stream",
        file_size: file.size,
        uploaded_by: profileId,
      });
      if (dbError) throw new Error(dbError.message);
    },
    onSuccess: (_, vars) => qc.invalidateQueries({ queryKey: ["tender_attachments", vars.tenderId] }),
  });
}

export function useDeleteTenderAttachment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, tenderId, storagePath }: { id: string; tenderId: string; storagePath: string }) => {
      // Delete from storage
      await storageProxyDelete("renowell", [storagePath]);
      // Delete DB record
      const { error } = await dbProxyDelete("tender_attachments", [
        { column: "id", operator: "eq", value: id },
      ]);
      if (error) throw new Error(error.message);
    },
    onSuccess: (_, vars) => qc.invalidateQueries({ queryKey: ["tender_attachments", vars.tenderId] }),
  });
}
