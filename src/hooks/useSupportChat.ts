import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { proxySelect, proxyInsert, proxyInvoke } from "@/lib/dbProxy";
import { useCurrentProfile } from "@/hooks/useCurrentProfile";
import { toast } from "sonner";

export interface SupportMessage {
  id: string;
  user_profile_id: string;
  direction: "outgoing" | "incoming";
  content: string;
  created_at: string;
}

export function useSupportMessages() {
  const { data: profile } = useCurrentProfile();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["support_messages", profile?.id],
    queryFn: async () => {
      if (!profile) return [];
      const { data, error } = await proxySelect<SupportMessage>("support_messages", {
        filters: [{ column: "user_profile_id", operator: "eq", value: profile.id }],
        order: [{ column: "created_at", ascending: true }],
      });
      if (error) throw new Error(error.message);
      return data || [];
    },
    enabled: !!profile,
    // Опрос новых сообщений вместо подписки в реальном времени
    refetchInterval: 4000,
  });

  return query;
}

export function useSendSupportMessage() {
  const queryClient = useQueryClient();
  const { data: profile } = useCurrentProfile();

  return useMutation({
    mutationFn: async (content: string) => {
      if (!profile) throw new Error("Not authenticated");

      // Insert message
      const { data, error } = await proxyInsert<SupportMessage>("support_messages", {
        user_profile_id: profile.id,
        direction: "outgoing",
        content,
      }, "*");

      if (error) throw new Error(error.message);
      const msg = data?.[0];

      // Notify support via Telegram (fire and forget)
      if (msg) {
        proxyInvoke("support-notify", { message_id: msg.id }).catch((err) =>
          console.error("Support notify error:", err)
        );
      }

      return msg;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["support_messages"] });
    },
    onError: (err) => {
      toast.error("Ошибка отправки: " + err.message);
    },
  });
}
