import { useState, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { proxySelect, proxyInsert, proxyDelete } from "@/lib/dbProxy";
import { proxyUpload, proxyGetPublicUrl } from "@/lib/storageProxy";
import { useHRPermissions } from "@/hooks/useHRPermissions";
import { useAuth } from "@/hooks/useAuth";
import { useCurrentProfile } from "@/hooks/useCurrentProfile";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Modal } from "@/components/ui/Modal";
import { toast } from "sonner";
import { formatDisplayDate } from "@/utils/dateFormat";
import { FilePlus, Trash2, Download, Loader2, FileText } from "lucide-react";

interface HRDocument {
  id: string;
  title: string;
  file_type: string;
  file_url: string | null;
  storage_path: string | null;
  uploaded_by: string | null;
  created_at: string;
  updated_at: string;
}

const typeIcons: Record<string, string> = {
  pdf: "📄",
  docx: "📝",
  doc: "📝",
  xlsx: "📊",
  xls: "📊",
  pptx: "📊",
  link: "🔗",
};

function getFileExtension(filename: string): string {
  return filename.split(".").pop()?.toLowerCase() || "pdf";
}

export function DocsTab() {
  const [showAddModal, setShowAddModal] = useState(false);
  const [deletingDoc, setDeletingDoc] = useState<HRDocument | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [title, setTitle] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { canManageEmployees } = useHRPermissions();
  const { user } = useAuth();
  const { data: profile } = useCurrentProfile();
  const queryClient = useQueryClient();

  const { data: docs = [], isLoading } = useQuery({
    queryKey: ["hr_documents"],
    queryFn: async () => {
      const { data, error } = await proxySelect<HRDocument>("hr_documents", {
        select: "*",
        order: [{ column: "created_at", ascending: false }],
      });
      if (error) throw new Error(error.message);
      return data ?? [];
    },
  });

  const handleUpload = async () => {
    if (!file || !title.trim() || !user || !profile) return;
    setIsUploading(true);
    try {
      const ext = getFileExtension(file.name);
      const storagePath = `hr-docs/${Date.now()}_${file.name}`;

      const { error: uploadError } = await proxyUpload(
        "renowell",
        storagePath,
        file,
        { upsert: true }
      );
      if (uploadError) throw new Error(uploadError.message);

      const { data: urlData } = await proxyGetPublicUrl("renowell", storagePath);
      const fileUrl = urlData?.publicUrl || null;

      const { error: insertError } = await proxyInsert("hr_documents", {
        title: title.trim(),
        file_type: ext,
        file_url: fileUrl,
        storage_path: storagePath,
        uploaded_by: profile.id,
      });
      if (insertError) throw new Error(insertError.message);

      toast.success("Документ добавлен");
      setShowAddModal(false);
      setTitle("");
      setFile(null);
      queryClient.invalidateQueries({ queryKey: ["hr_documents"] });
    } catch (err) {
      console.error("Upload error:", err);
      toast.error(`Ошибка загрузки: ${err instanceof Error ? err.message : "Неизвестная ошибка"}`);
    } finally {
      setIsUploading(false);
    }
  };

  const handleDelete = async () => {
    if (!deletingDoc) return;
    setIsDeleting(true);
    try {
      const { error } = await proxyDelete("hr_documents", [
        { column: "id", operator: "eq", value: deletingDoc.id },
      ]);
      if (error) throw new Error(error.message);
      toast.success("Документ удалён");
      setDeletingDoc(null);
      queryClient.invalidateQueries({ queryKey: ["hr_documents"] });
    } catch (err) {
      toast.error("Ошибка удаления");
    } finally {
      setIsDeleting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        Загрузка документов...
      </div>
    );
  }

  return (
    <>
      {canManageEmployees && (
        <div className="flex justify-end mb-4">
          <Button onClick={() => setShowAddModal(true)}>
            <FilePlus className="w-4 h-4 mr-2" />
            Добавить документ
          </Button>
        </div>
      )}

      <div className="space-y-3">
        {docs.map((doc) => (
          <div
            key={doc.id}
            className="card-base p-4 flex items-center justify-between hover:border-primary/30 transition-colors"
          >
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <span className="text-2xl flex-shrink-0">
                {typeIcons[doc.file_type] || "📄"}
              </span>
              <div className="min-w-0">
                <p className="font-medium text-foreground truncate">{doc.title}</p>
                <p className="text-sm text-muted-foreground">
                  Добавлено: {formatDisplayDate(doc.created_at)}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <span className="chip">{doc.file_type.toUpperCase()}</span>
              {doc.file_url && (
                <a
                  href={doc.file_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-2 rounded-md hover:bg-secondary transition-colors"
                >
                  <Download className="w-4 h-4 text-muted-foreground" />
                </a>
              )}
              {canManageEmployees && (
                <button
                  onClick={() => setDeletingDoc(doc)}
                  className="p-2 rounded-md hover:bg-destructive/10 transition-colors"
                >
                  <Trash2 className="w-4 h-4 text-destructive" />
                </button>
              )}
            </div>
          </div>
        ))}

        {docs.length === 0 && (
          <div className="text-center py-12 text-muted-foreground">
            <FileText className="w-12 h-12 mx-auto mb-3 opacity-50" />
            Нет документов
          </div>
        )}
      </div>

      {/* Add document modal */}
      <Modal
        isOpen={showAddModal}
        onClose={() => { setShowAddModal(false); setTitle(""); setFile(null); }}
        title="Добавить документ"
      >
        <div className="space-y-4">
          <div>
            <Label>Название</Label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Например: Трудовой договор (шаблон)"
            />
          </div>
          <div>
            <Label>Файл</Label>
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.doc,.docx,.xls,.xlsx,.pptx"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
              className="block w-full text-sm text-muted-foreground file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-medium file:bg-primary file:text-primary-foreground hover:file:bg-primary/90 cursor-pointer mt-1"
            />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <Button
              variant="outline"
              onClick={() => { setShowAddModal(false); setTitle(""); setFile(null); }}
              disabled={isUploading}
            >
              Отмена
            </Button>
            <Button
              onClick={handleUpload}
              disabled={isUploading || !title.trim() || !file}
            >
              {isUploading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Загрузить
            </Button>
          </div>
        </div>
      </Modal>

      {/* Delete confirmation */}
      <Modal
        isOpen={!!deletingDoc}
        onClose={() => setDeletingDoc(null)}
        title="Удалить документ"
      >
        {deletingDoc && (
          <div className="space-y-4">
            <p className="text-foreground">
              Удалить документ <strong>{deletingDoc.title}</strong>?
            </p>
            <div className="flex justify-end gap-3 pt-2">
              <Button variant="outline" onClick={() => setDeletingDoc(null)} disabled={isDeleting}>
                Отмена
              </Button>
              <Button variant="destructive" onClick={handleDelete} disabled={isDeleting}>
                {isDeleting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Удалить
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </>
  );
}
