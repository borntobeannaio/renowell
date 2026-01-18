import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { proxySelect, proxyInsert, proxyDelete, proxyUpdate } from "@/lib/dbProxy";


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
      const { data, error } = await proxySelect<DbProtocol>('protocols', {
        order: [{ column: 'date', ascending: false }],
      });
      if (error) throw new Error(error.message);
      return data || [];
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
      const { data, error } = await proxySelect<DbProtocolItem>('protocol_items', {
        filters: [{ column: 'protocol_id', operator: 'eq', value: protocolId }],
        order: [{ column: 'sort_order', ascending: true }],
      });
      if (error) throw new Error(error.message);
      return data || [];
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
      const { data, error } = await proxyInsert<DbProtocol>(
        "protocols",
        {
          number: protocol.number,
          date: protocol.date,
          title: protocol.title,
          organizer: protocol.organizer || null,
          meeting_type: protocol.meeting_type || null,
          attendees: protocol.attendees || [],
        },
        "*"
      );

      if (error) throw new Error(error.message);
      return data?.[0] as DbProtocol;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["protocols"] });
    },
  });
}

export function useUpdateProtocol() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      ...updates
    }: {
      id: string;
      date?: string;
      title?: string;
      organizer?: string | null;
      meeting_type?: string | null;
      attendees?: string[];
    }) => {
      const { data, error } = await proxyUpdate<DbProtocol>(
        "protocols",
        updates,
        [{ column: "id", operator: "eq", value: id }],
        "*"
      );

      if (error) throw new Error(error.message);
      return data?.[0] as DbProtocol;
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
      const { data, error } = await proxyInsert<DbProtocolItem>(
        "protocol_items",
        {
          protocol_id: item.protocol_id,
          project_id: item.project_id || null,
          item_text: item.item_text,
          responsible: item.responsible || null,
          due_date: item.due_date || null,
          create_task: item.create_task || false,
          sort_order: item.sort_order || 0,
        },
        "*"
      );

      if (error) throw new Error(error.message);
      return data?.[0] as DbProtocolItem;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["protocol_items", variables.protocol_id] });
    },
  });
}

export function useUpdateProtocolItem() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, protocol_id, ...updates }: {
      id: string;
      protocol_id: string;
      item_text?: string;
      responsible?: string | null;
      due_date?: string | null;
      task_id?: string | null;
    }) => {
      const { data, error } = await proxyUpdate<DbProtocolItem>(
        "protocol_items",
        updates,
        [{ column: "id", operator: "eq", value: id }],
        "*"
      );

      if (error) throw new Error(error.message);
      return { ...data?.[0], protocol_id } as DbProtocolItem & { protocol_id: string };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["protocol_items", data.protocol_id] });
    },
  });
}

export function useDeleteProtocolItem() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, protocol_id }: { id: string; protocol_id: string }) => {
      const { error } = await proxyDelete("protocol_items", [{ column: "id", operator: "eq", value: id }]);

      if (error) throw new Error(error.message);
      return { id, protocol_id };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["protocol_items", data.protocol_id] });
    },
  });
}

export function useDeleteProtocol() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      // First delete all protocol items
      const { error: itemsError } = await proxyDelete("protocol_items", [
        { column: "protocol_id", operator: "eq", value: id },
      ]);
      if (itemsError) throw new Error(itemsError.message);

      // Then delete the protocol
      const { error } = await proxyDelete("protocols", [
        { column: "id", operator: "eq", value: id },
      ]);
      if (error) throw new Error(error.message);
      return id;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["protocols"] });
    },
  });
}

export function useNextProtocolNumber() {
  return useQuery({
    queryKey: ["next_protocol_number"],
    queryFn: async () => {
      const { data, error } = await proxySelect<{ number: number }>('protocols', {
        select: 'number',
        order: [{ column: 'number', ascending: false }],
        limit: 1,
      });

      if (error) throw new Error(error.message);
      return (data?.[0]?.number || 0) + 1;
    },
  });
}
