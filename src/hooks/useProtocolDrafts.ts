import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
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

      const { data, error } = await supabase
        .from('form_drafts')
        .select('*')
        .eq('user_id', user.id)
        .eq('form_type', 'protocol')
        .order('updated_at', { ascending: false });

      if (error) throw error;

      return (data || []) as ProtocolDraft[];
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

      const { error } = await supabase
        .from('form_drafts')
        .delete()
        .eq('id', draftId)
        .eq('user_id', user.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['protocol-drafts'] });
    },
  });
}
