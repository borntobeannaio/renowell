import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { supabaseQuery } from "@/lib/api";

export interface DbProtocol {
  id: string;
  number: number;
  date: string;
  title: string;
  organizer: string | null;
  meeting_type: string | null;
  attendees: string[];
  created_at: string;
  updated_at: string;
}

export interface DbProtocolItem {
  id: string;
  protocol_id: string;
  project_id: string | null;
  item_text: string;
  responsible: string | null;
  due_date: string | null;
  create_task: boolean;
  task_id: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export function useProtocols() {
  return useQuery({
    queryKey: ["protocols"],
    queryFn: async () => {
      return supabaseQuery(
        () => supabase.from("protocols").select("*").order("date", { ascending: false }),
        'Загрузка протоколов'
      ) as Promise<DbProtocol[]>;
    },
    retry: 2,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 10000),
  });
}

export function useProtocolItems(protocolId: string | null) {
  return useQuery({
    queryKey: ["protocol_items", protocolId],
    queryFn: async () => {
      if (!protocolId) return [];
      return supabaseQuery(
        () => supabase
          .from("protocol_items")
          .select("*")
          .eq("protocol_id", protocolId)
          .order("sort_order", { ascending: true }),
        'Загрузка пунктов протокола'
      ) as Promise<DbProtocolItem[]>;
    },
    enabled: !!protocolId,
    retry: 2,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 10000),
  });
}

export function useCreateProtocol() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (protocol: {
      number: number;
      date: string;
      title: string;
      organizer?: string | null;
      meeting_type?: string | null;
      attendees?: string[];
    }) => {
      const { data, error } = await supabase
        .from("protocols")
        .insert({
          number: protocol.number,
          date: protocol.date,
          title: protocol.title,
          organizer: protocol.organizer || null,
          meeting_type: protocol.meeting_type || null,
          attendees: protocol.attendees || [],
        })
        .select()
        .single();

      if (error) throw error;
      return data as DbProtocol;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["protocols"] });
    },
  });
}

export function useCreateProtocolItem() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (item: {
      protocol_id: string;
      project_id?: string | null;
      item_text: string;
      responsible?: string | null;
      due_date?: string | null;
      create_task?: boolean;
      sort_order?: number;
    }) => {
      const { data, error } = await supabase
        .from("protocol_items")
        .insert({
          protocol_id: item.protocol_id,
          project_id: item.project_id || null,
          item_text: item.item_text,
          responsible: item.responsible || null,
          due_date: item.due_date || null,
          create_task: item.create_task || false,
          sort_order: item.sort_order || 0,
        })
        .select()
        .single();

      if (error) throw error;
      return data as DbProtocolItem;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["protocol_items", variables.protocol_id] });
    },
  });
}

export function useDeleteProtocolItem() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, protocol_id }: { id: string; protocol_id: string }) => {
      const { error } = await supabase
        .from("protocol_items")
        .delete()
        .eq("id", id);

      if (error) throw error;
      return { id, protocol_id };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["protocol_items", data.protocol_id] });
    },
  });
}

export function useNextProtocolNumber() {
  return useQuery({
    queryKey: ["next_protocol_number"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("protocols")
        .select("number")
        .order("number", { ascending: false })
        .limit(1);

      if (error) throw error;
      return (data?.[0]?.number || 0) + 1;
    },
  });
}
