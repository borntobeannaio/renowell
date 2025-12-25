import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface TelegramPost {
  id: number;
  text: string;
  date: string;
  imageUrl: string | null;
  link: string;
}

export function useTelegramChannel() {
  return useQuery({
    queryKey: ["telegram-channel"],
    queryFn: async (): Promise<TelegramPost[]> => {
      const { data, error } = await supabase.functions.invoke<{ posts: TelegramPost[] }>(
        "telegram-channel"
      );

      if (error) {
        console.error("Error fetching Telegram channel:", error);
        throw error;
      }

      return data?.posts || [];
    },
    staleTime: 1000 * 60 * 5, // Cache for 5 minutes
    refetchOnWindowFocus: false,
  });
}
