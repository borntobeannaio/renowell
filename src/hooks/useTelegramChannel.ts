import { useQuery } from "@tanstack/react-query";
import { proxySelect } from "@/lib/dbProxy";
import { proxyEdgeFunction } from "@/lib/mediaProxy";

export interface TelegramPost {
  id: string;
  message_id: number;
  text: string | null;
  date: string;
  image_url: string | null;
  video_url: string | null;
  file_id: string | null;
  video_file_id: string | null;
  link: string;
  created_at: string;
  updated_at: string;
}

export function useTelegramChannel() {
  return useQuery({
    queryKey: ["telegram-channel"],
    queryFn: async (): Promise<TelegramPost[]> => {
      // Trigger parsing via proxy (don't fail if it errors)
      try {
        await proxyEdgeFunction("telegram-channel", {});
      } catch (err) {
        console.error("Error invoking telegram-channel function:", err);
      }

      // Read posts from database via proxy
      const { data, error } = await proxySelect<TelegramPost>("telegram_posts", {
        select: "*",
        order: [{ column: "date", ascending: false }],
        limit: 20,
      });

      if (error) {
        console.error("Error fetching telegram posts from DB:", error);
        throw new Error(error.message);
      }

      return data || [];
    },
    staleTime: 1000 * 60 * 5,
    refetchOnWindowFocus: false,
  });
}
