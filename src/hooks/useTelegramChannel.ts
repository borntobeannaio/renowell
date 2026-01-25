import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface TelegramPost {
  id: string;
  message_id: number;
  text: string | null;
  date: string;
  image_url: string | null;
  video_url: string | null;
  link: string;
  created_at: string;
  updated_at: string;
}

export function useTelegramChannel() {
  return useQuery({
    queryKey: ["telegram-channel"],
    queryFn: async (): Promise<TelegramPost[]> => {
      // First, trigger the edge function to parse and cache posts
      const { error: invokeError } = await supabase.functions.invoke("telegram-channel");
      
      if (invokeError) {
        console.error("Error invoking telegram-channel function:", invokeError);
        // Continue to try reading from DB even if invoke fails
      }

      // Read posts from database
      const { data, error } = await supabase
        .from("telegram_posts")
        .select("*")
        .order("date", { ascending: false })
        .limit(20);

      if (error) {
        console.error("Error fetching telegram posts from DB:", error);
        throw error;
      }

      return (data as TelegramPost[]) || [];
    },
    staleTime: 1000 * 60 * 5, // Cache for 5 minutes
    refetchOnWindowFocus: false,
  });
}
