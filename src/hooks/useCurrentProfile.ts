import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { proxySelect } from "@/lib/dbProxy";

export interface Profile {
  id: string;
  user_id: string;
  first_name: string | null;
  last_name: string | null;
  position: string | null;
  avatar_url: string | null;
  birthday: string | null;
  description: string | null;
  created_at: string;
  updated_at: string;
  // Notification settings
  telegram_chat_id: string | null;
  notify_telegram: boolean;
  notify_email: boolean;
  notify_push: boolean;
  push_subscription: object | null;
}

export function useCurrentProfile() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["current-profile", user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      
      const { data, error } = await proxySelect<Profile>("profiles", {
        filters: [{ column: "user_id", operator: "eq", value: user.id }],
        limit: 1,
      });
      
      if (error) throw new Error(error.message);
      return data?.[0] ?? null;
    },
    enabled: !!user?.id,
    staleTime: 5 * 60 * 1000, // Кэш 5 минут
  });
}
