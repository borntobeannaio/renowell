import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { proxySelect, proxyDelete } from '@/lib/dbProxy';
import { useAuth } from './useAuth';

export interface ProtocolDraft {
  id: string;
  entity_id: string;
  form_type: string;
  draft_data: {
    title?: string;
    date?: string;
    number?: number;
    organizer?: string;
    attendees?: string[];
    meeting_type?: string;
    section_groups?: unknown[];
  };
  updated_at: string;
  created_at: string;
}

export function useProtocolDrafts() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['protocol-drafts', user?.id],
    queryFn: async () => {
      if (!user) return [];

      const { data, error } = await proxySelect<ProtocolDraft>('form_drafts', {
        select: '*',
        filters: [
          { column: 'user_id', operator: 'eq', value: user.id },
          { column: 'form_type', operator: 'eq', value: 'protocol' },
        ],
        order: [{ column: 'updated_at', ascending: false }],
      });

      if (error) throw new Error(error.message);

      return data || [];
    },
    enabled: !!user,
    staleTime: 30_000,
  });
}

export function useDeleteProtocolDraft() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (draftId: string) => {
      if (!user) throw new Error('Not authenticated');

      const { error } = await proxyDelete('form_drafts', [
        { column: 'id', operator: 'eq', value: draftId },
        { column: 'user_id', operator: 'eq', value: user.id },
      ]);

      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['protocol-drafts'] });
    },
  });
}
