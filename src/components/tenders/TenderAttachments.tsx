import { useRef, useState } from "react";
import { Paperclip, Trash2, Loader2, FileText, Image, File as FileIcon, Download } from "lucide-react";
import {
  useTenderAttachments,
  useUploadTenderAttachment,
  useDeleteTenderAttachment,
} from "@/hooks/useTenderAttachments";
import { toast } from "sonner";

const MAX_SIZE = 20 * 1024 * 1024; // 20 MB

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} Б`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} КБ`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} МБ`;
}

function getFileIcon(contentType: string) {
  if (contentType.startsWith("image/")) return Image;
  if (contentType.includes("pdf") || contentType.includes("document") || contentType.includes("text"))
    return FileText;
  return FileIcon;
}

export function TenderAttachments({ tenderId }: { tenderId: string }) {
  const { data: attachments = [], isLoading } = useTenderAttachments(tenderId);
  const upload = useUploadTenderAttachment();
  const remove = useDeleteTenderAttachment();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const handleFiles = async (files: FileList | null) => {
    if (!files) return;
    const arr = Array.from(files);
    const oversized = arr.filter((f) => f.size > MAX_SIZE);
    if (oversized.length) {
      toast.error(`Файл слишком большой (макс. 20 МБ): ${oversized.map((f) => f.name).join(", ")}`);
      return;
    }

    setUploading(true);
    try {
      for (const file of arr) {
        await upload.mutateAsync({ tenderId, file });
      }
      toast.success(`Загружено файлов: ${arr.length}`);
    } catch (e: any) {
      toast.error(e?.message || "Ошибка загрузки");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const handleDelete = (att: { id: string; storagePath: string }) => {
    remove.mutate(
      { id: att.id, tenderId, storagePath: att.storagePath },
      { onSuccess: () => toast.success("Файл удалён") }
    );
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <Paperclip className="w-4 h-4 text-primary" />
          Файлы
        </h4>
        <button
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="text-xs text-primary hover:text-primary/80 font-medium transition-colors flex items-center gap-1"
        >
          {uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Paperclip className="w-3.5 h-3.5" />}
          Прикрепить
        </button>
        <input
          ref={inputRef}
          type="file"
          multiple
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
        />
      </div>

      {isLoading ? (
        <div className="flex justify-center py-4">
          <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
        </div>
      ) : attachments.length === 0 ? (
        <p className="text-xs text-muted-foreground text-center py-3">Нет прикреплённых файлов</p>
      ) : (
        <div className="space-y-1.5">
          {attachments.map((att) => {
            const Icon = getFileIcon(att.content_type);
            const isImage = att.content_type.startsWith("image/");
            return (
              <div
                key={att.id}
                className="group flex items-center gap-2.5 p-2 rounded-lg hover:bg-muted/30 transition-colors"
              >
                {isImage ? (
                  <img
                    src={att.file_url}
                    alt={att.file_name}
                    className="w-9 h-9 rounded-md object-cover shrink-0 border border-border/40"
                  />
                ) : (
                  <div className="w-9 h-9 rounded-md bg-muted/40 flex items-center justify-center shrink-0">
                    <Icon className="w-4 h-4 text-muted-foreground" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-foreground truncate">{att.file_name}</div>
                  <div className="text-xs text-muted-foreground">{formatSize(att.file_size)}</div>
                </div>
                <a
                  href={att.file_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-1.5 text-muted-foreground hover:text-primary rounded transition-colors opacity-0 group-hover:opacity-100"
                  title="Скачать"
                >
                  <Download className="w-3.5 h-3.5" />
                </a>
                <button
                  onClick={() => handleDelete({ id: att.id, storagePath: att.storage_path })}
                  className="p-1.5 text-muted-foreground hover:text-destructive rounded transition-colors opacity-0 group-hover:opacity-100"
                  title="Удалить"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
