import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { proxySelect, proxyInsert, proxyUpdate, proxyDelete } from "@/lib/dbProxy";

export interface NoteAttachment {
  url: string;
  fileName: string;
  contentType: string;
  size: number;
}

export interface EmployeeNote {
  id: string;
  owner_profile_id: string;
  visibility: "private" | "work";
  title: string;
  body: string;
  pinned: boolean;
  attachments: NoteAttachment[];
  created_at: string;
  updated_at: string;
}

interface UseNotesOpts {
  ownerProfileId?: string | null;
  visibility?: "private" | "work";
}

export function useEmployeeNotes(opts: UseNotesOpts = {}) {
  const { ownerProfileId, visibility } = opts;
  return useQuery({
    queryKey: ["employee_notes", ownerProfileId || "all", visibility || "any"],
    queryFn: async () => {
      const filters: any[] = [];
      if (ownerProfileId) filters.push({ column: "owner_profile_id", operator: "eq", value: ownerProfileId });
      if (visibility) filters.push({ column: "visibility", operator: "eq", value: visibility });
      const { data, error } = await proxySelect<EmployeeNote>("employee_notes", {
        filters,
        order: [
          { column: "pinned", ascending: false },
          { column: "updated_at", ascending: false },
        ],
      });
      if (error) throw new Error(error.message);
      return data || [];
    },
    refetchOnWindowFocus: false,
  });
}

export function useCreateNote() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (note: {
      owner_profile_id: string;
      visibility: "private" | "work";
      title?: string;
      body?: string;
      pinned?: boolean;
    }) => {
      const { data, error } = await proxyInsert<EmployeeNote>("employee_notes", {
        owner_profile_id: note.owner_profile_id,
        visibility: note.visibility,
        title: note.title || "",
        body: note.body || "",
        pinned: note.pinned || false,
      });
      if (error) throw new Error(error.message);
      return data?.[0] as EmployeeNote;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["employee_notes"] }),
  });
}

export function useUpdateNote() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: { id: string } & Partial<EmployeeNote>) => {
      const { error } = await proxyUpdate("employee_notes", updates, [
        { column: "id", operator: "eq", value: id },
      ]);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["employee_notes"] }),
  });
}

export function useDeleteNote() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await proxyDelete("employee_notes", [
        { column: "id", operator: "eq", value: id },
      ]);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["employee_notes"] }),
  });
}
