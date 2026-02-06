import { useState } from "react";

// TODO: Replace with actual Yandex Cloud Function URL after creation
const YANDEX_UPLOAD_FUNCTION_URL = "https://functions.yandexcloud.net/PLACEHOLDER";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

export interface ChatAttachment {
  url: string;
  fileName: string;
  contentType: string;
  size: number;
}

export function useChatAttachments() {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  const uploadFile = async (file: File): Promise<ChatAttachment | null> => {
    setIsUploading(true);
    setUploadProgress(0);

    try {
      setUploadProgress(10);

      // Build FormData — file goes as binary, no base64
      const formData = new FormData();
      formData.append("file", file);
      formData.append("folder", "chat-files");

      setUploadProgress(20);

      let response: Response;
      try {
        // Direct multipart upload to dedicated Yandex Cloud Function
        response = await fetch(YANDEX_UPLOAD_FUNCTION_URL, {
          method: "POST",
          body: formData, // browser sets Content-Type: multipart/form-data automatically
        });
      } catch {
        // Fallback: direct Supabase edge function (requires VPN in Russia)
        const fileBase64 = await fileToBase64(file);
        response = await fetch(`${SUPABASE_URL}/functions/v1/yandex-s3-upload`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
            apikey: SUPABASE_ANON_KEY,
          },
          body: JSON.stringify({
            fileName: file.name,
            fileBase64,
            contentType: file.type,
          }),
        });
      }

      setUploadProgress(80);

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Upload failed");
      }

      const data = await response.json();
      setUploadProgress(100);

      return {
        url: data.url,
        fileName: file.name,
        contentType: file.type,
        size: file.size,
      };
    } catch (error) {
      console.error("Upload error:", error);
      return null;
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
    }
  };

  // Helper for fallback base64 encoding
  async function fileToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        resolve(result.split(",")[1]);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  const uploadFiles = async (files: File[]): Promise<ChatAttachment[]> => {
    const results: ChatAttachment[] = [];
    for (const file of files) {
      const attachment = await uploadFile(file);
      if (attachment) {
        results.push(attachment);
      }
    }
    return results;
  };

  return {
    uploadFile,
    uploadFiles,
    isUploading,
    uploadProgress,
  };
}

export function isImageFile(contentType: string): boolean {
  return contentType.startsWith("image/");
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
