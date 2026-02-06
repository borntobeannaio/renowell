import { useState } from "react";
import { toast } from "sonner";

const YANDEX_UPLOAD_FUNCTION_URL = "https://functions.yandexcloud.net/d4e50l5mk6s2mde1871u";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50 MB

export interface ChatAttachment {
  url: string;
  fileName: string;
  contentType: string;
  size: number;
}

async function compressImage(file: File, maxDim = 1920, quality = 0.8): Promise<File> {
  if (!file.type.startsWith("image/") || file.type === "image/gif") {
    return file;
  }

  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      const { width, height } = img;

      if (width <= maxDim && height <= maxDim) {
        resolve(file);
        return;
      }

      const scale = Math.min(maxDim / width, maxDim / height);
      const newW = Math.round(width * scale);
      const newH = Math.round(height * scale);

      const canvas = document.createElement("canvas");
      canvas.width = newW;
      canvas.height = newH;
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(img, 0, 0, newW, newH);

      canvas.toBlob(
        (blob) => {
          if (!blob) {
            resolve(file);
            return;
          }
          const compressed = new File([blob], file.name, { type: "image/jpeg", lastModified: Date.now() });
          resolve(compressed);
        },
        "image/jpeg",
        quality,
      );
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(file);
    };
    img.src = url;
  });
}

// Primary Yandex Function gets a short timeout so we fail-over quickly on mobile
const YANDEX_TIMEOUT_MS = 15_000;

function getFallbackTimeout(fileSize: number): number {
  return Math.min(120_000, 30_000 + Math.ceil(fileSize / (1024 * 1024)) * 10_000);
}

export function useChatAttachments() {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  const uploadFile = async (file: File): Promise<ChatAttachment | null> => {
    const tag = "[ChatUpload]";

    if (file.size > MAX_FILE_SIZE) {
      toast.error("Файл слишком большой (максимум 50 МБ)");
      return null;
    }

    setIsUploading(true);
    setUploadProgress(0);

    console.log(`${tag} Starting upload: ${file.name} (${(file.size / 1024).toFixed(1)} KB, ${file.type})`);

    // Simulate progress so user sees movement while waiting
    let progressInterval: ReturnType<typeof setInterval> | null = null;
    const startProgressSimulation = (from: number, to: number) => {
      let current = from;
      progressInterval = setInterval(() => {
        current = Math.min(current + 1, to);
        setUploadProgress(current);
        if (current >= to && progressInterval) {
          clearInterval(progressInterval);
          progressInterval = null;
        }
      }, 500);
    };
    const stopProgressSimulation = () => {
      if (progressInterval) {
        clearInterval(progressInterval);
        progressInterval = null;
      }
    };

    try {
      setUploadProgress(5);

      // Compress images before upload
      const fileToUpload = await compressImage(file);
      if (fileToUpload !== file) {
        console.log(`${tag} Compressed: ${(file.size / 1024).toFixed(1)} KB → ${(fileToUpload.size / 1024).toFixed(1)} KB`);
      }

      const formData = new FormData();
      formData.append("file", fileToUpload);
      formData.append("folder", "chat-files");

      setUploadProgress(15);
      startProgressSimulation(15, 70);

      let response: Response;

      try {
        console.log(`${tag} Sending to Yandex Function (timeout ${YANDEX_TIMEOUT_MS}ms)`);
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), YANDEX_TIMEOUT_MS);
        response = await fetch(YANDEX_UPLOAD_FUNCTION_URL, {
          method: "POST",
          body: formData,
          signal: controller.signal,
        });
        clearTimeout(timeout);
        console.log(`${tag} Yandex Function response status: ${response.status}`);
      } catch (err: any) {
        console.warn(`${tag} Yandex Function failed (${err?.name}): ${err?.message}`);
        console.log(`${tag} Trying fallback (Supabase edge function)...`);
        stopProgressSimulation();
        setUploadProgress(30);
        startProgressSimulation(30, 70);

        const fallbackTimeoutMs = getFallbackTimeout(fileToUpload.size);
        const fileBase64 = await fileToBase64(fileToUpload);
        const controller2 = new AbortController();
        const timeout2 = setTimeout(() => controller2.abort(), fallbackTimeoutMs);
        response = await fetch(`${SUPABASE_URL}/functions/v1/yandex-s3-upload`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
            apikey: SUPABASE_ANON_KEY,
          },
          body: JSON.stringify({ fileName: fileToUpload.name, fileBase64, contentType: fileToUpload.type }),
          signal: controller2.signal,
        });
        clearTimeout(timeout2);
        console.log(`${tag} Fallback response status: ${response.status}`);
      }

      stopProgressSimulation();
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
      toast.error("Не удалось загрузить файл");
      return null;
    } finally {
      stopProgressSimulation();
      setIsUploading(false);
      setUploadProgress(0);
    }
  };

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
