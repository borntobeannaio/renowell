import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { proxySelect, proxyUpdate } from '@/lib/dbProxy';
import { useAuth } from './useAuth';

export interface DraftSnapshot {
  id: string;
  draft_id: string;
  draft_data: {
    form?: {
      title?: string;
      date?: string;
      number?: number;
      organizer?: string;
      attendees?: string[];
      meeting_type?: string;
    };
    sectionGroups?: unknown[];
  };
  created_at: string;
}

/**
 * Получить список снепшотов для черновика
 */
export function useDraftSnapshots(formType: string, entityId: string) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['draft-snapshots', user?.id, formType, entityId],
    queryFn: async () => {
      if (!user) return [];

      const { data, error } = await proxySelect<DraftSnapshot>(
        'form_draft_snapshots',
        {
          select: 'id, draft_id, draft_data, created_at',
          filters: [
            { column: 'user_id', operator: 'eq', value: user.id },
            { column: 'form_type', operator: 'eq', value: formType },
            { column: 'entity_id', operator: 'eq', value: entityId },
          ],
          order: [{ column: 'created_at', ascending: false }],
          limit: 50,
        }
      );

      if (error) throw new Error(error.message);
      return data || [];
    },
    enabled: !!user && !!entityId,
    staleTime: 30_000,
  });
}

/**
 * Восстановить черновик из снепшота
 */
export function useRestoreSnapshot() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      formType,
      entityId,
      snapshotData,
    }: {
      formType: string;
      entityId: string;
      snapshotData: unknown;
    }) => {
      if (!user) throw new Error('Not authenticated');

      const { error } = await proxyUpdate(
        'form_drafts',
        {
          draft_data: snapshotData,
          updated_at: new Date().toISOString(),
        },
        [
          { column: 'user_id', operator: 'eq', value: user.id },
          { column: 'form_type', operator: 'eq', value: formType },
          { column: 'entity_id', operator: 'eq', value: entityId },
        ]
      );

      if (error) throw new Error(error.message);
      return snapshotData;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: ['draft-snapshots', user?.id, variables.formType, variables.entityId],
      });
      queryClient.invalidateQueries({
        queryKey: ['protocol-drafts'],
      });
    },
  });
}
