import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { proxySelect, proxyInsert, proxyDelete, proxyUpdate } from "@/lib/dbProxy";

export type SectionType = 'project' | 'tender' | 'hr' | 'business' | 'goals';

export interface DbProtocolSection {
  id: string;
  protocol_id: string;
  section_type: SectionType;
  entity_id: string | null;
  entity_name: string | null;
  default_responsible: string | null;
  sort_order: number;
  archived: boolean;
  created_at: string;
  updated_at: string;
}

export function useProtocolSections(protocolId: string | null) {
  return useQuery({
    queryKey: ["protocol_sections", protocolId],
    queryFn: async () => {
      if (!protocolId) return [];
      const { data, error } = await proxySelect<DbProtocolSection>('protocol_sections', {
        filters: [{ column: 'protocol_id', operator: 'eq', value: protocolId }],
        order: [{ column: 'sort_order', ascending: true }],
      });
      if (error) throw new Error(error.message);
      return data || [];
    },
    enabled: !!protocolId,
    retry: 2,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 10000),
    refetchOnWindowFocus: true,
  });
}

export function useCreateProtocolSection() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (section: {
      protocol_id: string;
      section_type: SectionType;
      entity_id?: string | null;
      entity_name?: string | null;
      default_responsible?: string | null;
      sort_order?: number;
    }) => {
      const { data, error } = await proxyInsert<DbProtocolSection>(
        "protocol_sections",
        {
          protocol_id: section.protocol_id,
          section_type: section.section_type,
          entity_id: section.entity_id || null,
          entity_name: section.entity_name || null,
          default_responsible: section.default_responsible || null,
          sort_order: section.sort_order || 0,
        },
        "*"
      );

      if (error) throw new Error(error.message);
      return data?.[0] as DbProtocolSection;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["protocol_sections", variables.protocol_id] });
    },
  });
}

export function useUpdateProtocolSection() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      protocol_id,
      ...updates
    }: {
      id: string;
      protocol_id: string;
      section_type?: SectionType;
      entity_id?: string | null;
      entity_name?: string | null;
      default_responsible?: string | null;
      sort_order?: number;
      archived?: boolean;
    }) => {
      const { data, error } = await proxyUpdate<DbProtocolSection>(
        "protocol_sections",
        updates,
        [{ column: "id", operator: "eq", value: id }],
        "*"
      );

      if (error) throw new Error(error.message);
      return { ...data?.[0], protocol_id } as DbProtocolSection & { protocol_id: string };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["protocol_sections", data.protocol_id] });
    },
  });
}

export function useDeleteProtocolSection() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, protocol_id }: { id: string; protocol_id: string }) => {
      const { error } = await proxyDelete("protocol_sections", [{ column: "id", operator: "eq", value: id }]);

      if (error) throw new Error(error.message);
      return { id, protocol_id };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["protocol_sections", data.protocol_id] });
    },
  });
}

// Helper to get section display name
export function getSectionDisplayName(
  section: DbProtocolSection,
  projects: { id: string; name: string }[]
): string {
  switch (section.section_type) {
    case 'project':
      if (section.entity_id) {
        const project = projects.find(p => p.id === section.entity_id);
        return project?.name || 'Неизвестный проект';
      }
      return 'Без проекта (общие вопросы)';
    case 'tender':
      return section.entity_name || 'Тендеры';
    case 'hr':
      return section.entity_name || 'Подбор персонала';
    case 'business':
      return section.entity_name || 'Бизнес задачи';
    case 'goals':
      return section.entity_name || 'Цели компании';
    default:
      return section.entity_name || 'Секция';
  }
}

// Helper to get section icon name
export function getSectionIcon(sectionType: SectionType): string {
  switch (sectionType) {
    case 'project': return 'folder';
    case 'tender': return 'building';
    case 'hr': return 'users';
    case 'business': return 'briefcase';
    case 'goals': return 'target';
    default: return 'folder';
  }
}

// Section type labels for UI
export const SECTION_TYPE_LABELS: Record<SectionType, string> = {
  project: 'Проект',
  tender: 'Тендер',
  hr: 'Подбор персонала',
  business: 'Бизнес задачи',
  goals: 'Цели компании',
};
