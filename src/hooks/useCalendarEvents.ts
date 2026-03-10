import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { proxySelect, proxyInsert, proxyUpdate, proxyDelete } from "@/lib/dbProxy";
import { proxyEdgeFunction } from "@/lib/mediaProxy";
import { toast } from "sonner";
import { format } from "date-fns";
import { ru } from "date-fns/locale";

export interface CalendarEventAttendee {
  name: string;
  email: string;
  status: string;
}

export interface CalendarEventAttachment {
  filename: string;
  url: string;
}

export interface CalendarEvent {
  id: string;
  title: string;
  description: string | null;
  start_time: string;
  end_time: string;
  location: string | null;
  is_online: boolean;
  creator_id: string;
  participant_ids: string[];
  source: string;
  external_uid: string | null;
  created_at: string;
  updated_at: string;
  organizer: string | null;
  attendees: CalendarEventAttendee[];
  url: string | null;
  attachments: CalendarEventAttachment[];
}

export function useCalendarEvents() {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["calendar_events"],
    queryFn: async () => {
      const { data, error } = await proxySelect<CalendarEvent>("calendar_events", {
        order: [{ column: "start_time", ascending: true }],
      });
      if (error) throw new Error(error.message);
      return data || [];
    },
    retry: 2,
  });

  const createEvent = useMutation({
    mutationFn: async (event: {
      title: string;
      description?: string;
      start_time: string;
      end_time: string;
      location?: string;
      is_online: boolean;
      creator_id: string;
      participant_ids: string[];
    }) => {
      const { data, error } = await proxyInsert<CalendarEvent>(
        "calendar_events",
        event,
        "*"
      );
      if (error) throw new Error(error.message);
      return data?.[0];
    },
    onSuccess: (newEvent) => {
      queryClient.invalidateQueries({ queryKey: ["calendar_events"] });
      toast.success("Встреча создана");

      // Send in-app notifications to participants
      if (newEvent && newEvent.participant_ids?.length > 0) {
        const startFormatted = format(new Date(newEvent.start_time), "d MMMM, HH:mm", { locale: ru });
        const recipients = newEvent.participant_ids.filter((id: string) => id !== newEvent.creator_id);
        for (const recipientId of recipients) {
          proxyInsert("notifications", {
            recipient_id: recipientId,
            type: "calendar_invite",
            title: "Вас добавили во встречу",
            body: `${newEvent.title} — ${startFormatted}`,
            link: "/calendar",
          }).catch((err) => console.error("Failed to create calendar notification:", err));
        }
      }

      // Send calendar invite in background
      if (newEvent?.id && newEvent.participant_ids?.length > 0) {
        supabase.functions
          .invoke("send-calendar-invite", {
            body: { event_id: newEvent.id },
          })
          .then(({ error }) => {
            if (error) {
              console.error("Failed to send invites:", error);
            } else {
              toast.success("Приглашения отправлены на email");
            }
          });
      }
    },
    onError: (err) => {
      toast.error("Ошибка создания встречи: " + err.message);
    },
  });

  const updateEvent = useMutation({
    mutationFn: async (payload: {
      id: string;
      title: string;
      description?: string;
      start_time: string;
      end_time: string;
      location?: string;
      is_online: boolean;
      participant_ids: string[];
    }) => {
      const { id, ...fields } = payload;
      const { error } = await proxyUpdate("calendar_events", fields, [
        { column: "id", operator: "eq", value: id },
      ]);
      if (error) throw new Error(error.message);
      return payload;
    },
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: ["calendar_events"] });
      toast.success("Встреча обновлена");

      // Send in-app notifications about update
      if (updated.participant_ids?.length > 0) {
        const startFormatted = format(new Date(updated.start_time), "d MMMM, HH:mm", { locale: ru });
        for (const recipientId of updated.participant_ids) {
          proxyInsert("notifications", {
            recipient_id: recipientId,
            type: "calendar_invite",
            title: "Встреча обновлена",
            body: `${updated.title} — ${startFormatted}`,
            link: "/calendar",
          }).catch((err) => console.error("Failed to create calendar notification:", err));
        }
      }

      if (updated.participant_ids?.length > 0) {
        supabase.functions
          .invoke("send-calendar-invite", {
            body: { event_id: updated.id, update: true },
          })
          .then(({ error }) => {
            if (error) console.error("Failed to send update invites:", error);
            else toast.success("Обновлённые приглашения отправлены");
          });
      }
    },
    onError: (err) => {
      toast.error("Ошибка обновления: " + err.message);
    },
  });

  const deleteEvent = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await proxyDelete("calendar_events", [
        { column: "id", operator: "eq", value: id },
      ]);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["calendar_events"] });
      toast.success("Встреча удалена");
    },
    onError: (err) => {
      toast.error("Ошибка удаления: " + err.message);
    },
  });

  const syncCalendars = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("sync-ics-calendar");
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["calendar_events"] });
      const results = data?.results;
      if (results?.length) {
        const total = results.reduce((s: number, r: { synced: number }) => s + r.synced, 0);
        toast.success(`Синхронизировано: ${total} событий`);
      } else {
        toast.info("Нет календарей для синхронизации");
      }
    },
    onError: (err) => {
      toast.error("Ошибка синхронизации: " + (err instanceof Error ? err.message : String(err)));
    },
  });

  return {
    events: query.data || [],
    isLoading: query.isLoading,
    error: query.error,
    createEvent,
    updateEvent,
    deleteEvent,
    syncCalendars,
  };
}
