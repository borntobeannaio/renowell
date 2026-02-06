import { useState } from "react";

const YANDEX_UPLOAD_FUNCTION_URL = "https://functions.yandexcloud.net/d4e50l5mk6s2mde1871u";

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

    const tag = "[ChatUpload]";
    console.log(`${tag} Starting upload: ${file.name} (${(file.size / 1024).toFixed(1)} KB, ${file.type})`);

    try {
      setUploadProgress(10);

      const formData = new FormData();
      formData.append("file", file);
      formData.append("folder", "chat-files");

      setUploadProgress(20);

      let response: Response;
      try {
        console.log(`${tag} Sending to Yandex Function: ${YANDEX_UPLOAD_FUNCTION_URL}`);
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 30000);
        response = await fetch(YANDEX_UPLOAD_FUNCTION_URL, {
          method: "POST",
          body: formData,
          signal: controller.signal,
        });
        clearTimeout(timeout);
        console.log(`${tag} Yandex Function response status: ${response.status}`);
      } catch (err: any) {
        console.warn(`${tag} Yandex Function failed: ${err?.name} — ${err?.message}`);
        console.log(`${tag} Trying fallback (Supabase direct)...`);
        const fileBase64 = await fileToBase64(file);
        const controller2 = new AbortController();
        const timeout2 = setTimeout(() => controller2.abort(), 30000);
        response = await fetch(`${SUPABASE_URL}/functions/v1/yandex-s3-upload`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
            apikey: SUPABASE_ANON_KEY,
          },
          body: JSON.stringify({ fileName: file.name, fileBase64, contentType: file.type }),
          signal: controller2.signal,
        });
        clearTimeout(timeout2);
        console.log(`${tag} Fallback response status: ${response.status}`);
      }

      setUploadProgress(80);

      if (!response.ok) {
        const errBody = await response.text();
        console.error(`${tag} Response not ok (${response.status}): ${errBody}`);
        throw new Error(errBody || "Upload failed");
      }

      const data = await response.json();
      console.log(`${tag} Success:`, data);
      setUploadProgress(100);

      return {
        url: data.url,
        fileName: file.name,
        contentType: file.type,
        size: file.size,
      };
    } catch (error: any) {
      console.error(`${tag} Upload failed:`, error?.message || error);
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
