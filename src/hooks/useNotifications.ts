import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useCurrentProfile } from "@/hooks/useCurrentProfile";
import { proxySelect, proxyInsert, proxyUpdate, proxyDelete } from "@/lib/dbProxy";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

export type NotificationType = "task_assigned" | "deadline_week" | "deadline_day" | "mention" | "chat_message" | "chat_created";

export interface Notification {
  id: string;
  recipient_id: string;
  type: NotificationType;
  title: string;
  body: string;
  link: string | null;
  related_task_id: string | null;
  is_read: boolean;
  created_at: string;
}

export function useNotifications() {
  const { data: profile } = useCurrentProfile();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["notifications", profile?.id],
    queryFn: async () => {
      if (!profile?.id) return [];
      
      const { data, error } = await proxySelect<Notification>("notifications", {
        filters: [{ column: "recipient_id", operator: "eq", value: profile.id }],
        order: [{ column: "created_at", ascending: false }],
        limit: 50,
      });
      
      if (error) throw new Error(error.message);
      return data ?? [];
    },
    enabled: !!profile?.id,
  });

  // Realtime subscription для новых уведомлений
  useEffect(() => {
    if (!profile?.id) return;

    const channel = supabase
      .channel(`notifications-${profile.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `recipient_id=eq.${profile.id}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ["notifications", profile.id] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [profile?.id, queryClient]);

  return query;
}

export function useUnreadNotificationsCount() {
  const { data: notifications } = useNotifications();
  return notifications?.filter((n) => !n.is_read).length ?? 0;
}

export function useMarkNotificationRead() {
  const queryClient = useQueryClient();
  const { data: profile } = useCurrentProfile();

  return useMutation({
    mutationFn: async (notificationId: string) => {
      const { error } = await proxyUpdate(
        "notifications",
        { is_read: true },
        [{ column: "id", operator: "eq", value: notificationId }]
      );
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications", profile?.id] });
    },
  });
}

export function useMarkAllNotificationsRead() {
  const queryClient = useQueryClient();
  const { data: profile } = useCurrentProfile();

  return useMutation({
    mutationFn: async () => {
      if (!profile?.id) return;
      
      const { error } = await proxyUpdate(
        "notifications",
        { is_read: true },
        [
          { column: "recipient_id", operator: "eq", value: profile.id },
          { column: "is_read", operator: "eq", value: false },
        ]
      );
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications", profile?.id] });
    },
  });
}

export function useDeleteNotification() {
  const queryClient = useQueryClient();
  const { data: profile } = useCurrentProfile();

  return useMutation({
    mutationFn: async (notificationId: string) => {
      const { error } = await proxyDelete("notifications", [
        { column: "id", operator: "eq", value: notificationId },
      ]);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications", profile?.id] });
    },
  });
}

export function useCreateNotification() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (notification: {
      recipient_id: string;
      type: NotificationType;
      title: string;
      body: string;
      link?: string;
      related_task_id?: string;
    }) => {
      const { data, error } = await proxyInsert<Notification>("notifications", {
        recipient_id: notification.recipient_id,
        type: notification.type,
        title: notification.title,
        body: notification.body,
        link: notification.link || null,
        related_task_id: notification.related_task_id || null,
      });
      if (error) throw new Error(error.message);
      return data?.[0];
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["notifications", variables.recipient_id] });
    },
  });
}
