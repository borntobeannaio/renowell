import { X, FileText, Image as ImageIcon, Download } from "lucide-react";
import { isImageFile, formatFileSize, ChatAttachment } from "@/hooks/useChatAttachments";

interface ChatAttachmentPreviewProps {
  attachments: ChatAttachment[];
  onRemove?: (index: number) => void;
  isPreview?: boolean;
}

export function ChatAttachmentPreview({
  attachments,
  onRemove,
  isPreview = false,
}: ChatAttachmentPreviewProps) {
  if (attachments.length === 0) return null;

  return (
    <div className={`flex flex-wrap gap-2 ${isPreview ? "p-2 bg-secondary/30 rounded-lg" : ""}`}>
      {attachments.map((att, index) => (
        <div
          key={index}
          className="relative group rounded-lg overflow-hidden border border-border bg-background"
        >
          {isImageFile(att.contentType) ? (
            <div className="w-16 h-16 relative">
              <img
                src={att.url}
                alt={att.fileName}
                className="w-full h-full object-cover"
              />
              {onRemove && (
                <button
                  onClick={() => onRemove(index)}
                  className="absolute top-0.5 right-0.5 w-5 h-5 bg-destructive text-destructive-foreground rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-2 p-2 pr-3">
              <div className="w-8 h-8 bg-primary/10 rounded flex items-center justify-center">
                <FileText className="w-4 h-4 text-primary" />
              </div>
              <div className="max-w-[100px]">
                <p className="text-xs font-medium truncate">{att.fileName}</p>
                <p className="text-xs text-muted-foreground">
                  {formatFileSize(att.size)}
                </p>
              </div>
              {onRemove && (
                <button
                  onClick={() => onRemove(index)}
                  className="w-5 h-5 bg-destructive text-destructive-foreground rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

interface ChatMessageAttachmentsProps {
  attachments: ChatAttachment[];
}

export function ChatMessageAttachments({ attachments }: ChatMessageAttachmentsProps) {
  if (!attachments || attachments.length === 0) return null;

  const images = attachments.filter((a) => isImageFile(a.contentType));
  const files = attachments.filter((a) => !isImageFile(a.contentType));

  return (
    <div className="mt-2 space-y-2">
      {/* Images grid */}
      {images.length > 0 && (
        <div className={`grid gap-1 ${images.length === 1 ? "grid-cols-1" : "grid-cols-2"}`}>
          {images.map((img, i) => (
            <a
              key={i}
              href={img.url}
              target="_blank"
              rel="noopener noreferrer"
              className="block rounded-lg overflow-hidden hover:opacity-90 transition-opacity"
            >
              <img
                src={img.url}
                alt={img.fileName}
                className="w-full max-h-48 object-cover"
                loading="lazy"
              />
            </a>
          ))}
        </div>
      )}

      {/* Files list */}
      {files.length > 0 && (
        <div className="space-y-1">
          {files.map((file, i) => (
            <a
              key={i}
              href={file.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 p-2 rounded-lg bg-background/50 hover:bg-background transition-colors"
            >
              <FileText className="w-4 h-4 text-primary shrink-0" />
              <span className="text-xs truncate flex-1">{file.fileName}</span>
              <Download className="w-3 h-3 text-muted-foreground shrink-0" />
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
