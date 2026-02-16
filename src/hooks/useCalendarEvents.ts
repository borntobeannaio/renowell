import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { proxySelect, proxyInsert, proxyUpdate, proxyDelete } from "@/lib/dbProxy";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

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
    deleteEvent,
    syncCalendars,
  };
}
