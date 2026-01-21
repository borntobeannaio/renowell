import { useState } from 'react';
import { FileText, Trash2, ExternalLink, Clock, Loader2 } from 'lucide-react';
import { useProtocolDrafts, useDeleteProtocolDraft, ProtocolDraft } from '@/hooks/useProtocolDrafts';
import { formatDisplayDate } from '@/utils/dateFormat';
import { toast } from 'sonner';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

export function DraftsSection() {
  const { data: drafts = [], isLoading } = useProtocolDrafts();
  const deleteDraft = useDeleteProtocolDraft();
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [draftToDelete, setDraftToDelete] = useState<ProtocolDraft | null>(null);

  if (isLoading) {
    return null; // Не показываем пока загружается
  }

  if (drafts.length === 0) {
    return null; // Скрываем секцию если нет черновиков
  }

  const handleContinue = (draft: ProtocolDraft) => {
    const entityId = draft.entity_id;
    
    // Определяем URL на основе entity_id
    if (entityId === 'new') {
      // Новый протокол
      window.open('/protocols/new', '_blank');
    } else if (entityId.startsWith('copy-')) {
      // Копия протокола
      const sourceId = entityId.replace('copy-', '');
      window.open(`/protocols/new?copy=${sourceId}`, '_blank');
    } else {
      // Редактирование существующего
      window.open(`/protocols/edit/${entityId}`, '_blank');
    }
  };

  const handleDeleteClick = (draft: ProtocolDraft) => {
    setDraftToDelete(draft);
    setDeleteDialogOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!draftToDelete) return;
    
    try {
      await deleteDraft.mutateAsync(draftToDelete.id);
      toast.success('Черновик удалён');
      setDeleteDialogOpen(false);
      setDraftToDelete(null);
    } catch (error) {
      toast.error('Ошибка удаления черновика');
    }
  };

  const getDraftTitle = (draft: ProtocolDraft) => {
    const title = draft.draft_data?.title;
    const entityId = draft.entity_id;
    
    if (title) return title;
    
    if (entityId === 'new') return 'Новый протокол';
    if (entityId.startsWith('copy-')) return 'Копия протокола';
    return 'Протокол';
  };

  const getDraftLabel = (draft: ProtocolDraft) => {
    const entityId = draft.entity_id;
    
    if (entityId === 'new') return 'Новый';
    if (entityId.startsWith('copy-')) return 'Копия';
    return 'Редактирование';
  };

  const formatRelativeTime = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'только что';
    if (diffMins < 60) return `${diffMins} мин. назад`;
    if (diffHours < 24) return `${diffHours} ч. назад`;
    if (diffDays === 1) return 'вчера';
    return formatDisplayDate(dateStr);
  };

  return (
    <div className="mb-6">
      <h3 className="text-sm font-medium text-muted-foreground mb-3 flex items-center gap-2">
        <FileText className="w-4 h-4" />
        Мои черновики
      </h3>
      
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {drafts.map((draft) => (
          <div
            key={draft.id}
            className="group flex items-center justify-between p-3 bg-secondary/50 hover:bg-secondary rounded-lg border border-border/50 transition-colors"
          >
            <div className="flex-1 min-w-0 mr-2">
              <div className="flex items-center gap-2 mb-1">
                <span className="chip text-xs">
                  {getDraftLabel(draft)}
                </span>
                {draft.draft_data?.number && (
                  <span className="text-xs text-muted-foreground">
                    №{draft.draft_data.number}
                  </span>
                )}
              </div>
              <p className="text-sm font-medium text-foreground truncate">
                {getDraftTitle(draft)}
              </p>
              <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground">
                <Clock className="w-3 h-3" />
                <span>{formatRelativeTime(draft.updated_at)}</span>
              </div>
            </div>
            
            <div className="flex items-center gap-1">
              <button
                onClick={() => handleContinue(draft)}
                className="p-2 text-primary hover:bg-primary/10 rounded-lg transition-colors"
                title="Продолжить редактирование"
              >
                <ExternalLink className="w-4 h-4" />
              </button>
              <button
                onClick={() => handleDeleteClick(draft)}
                className="p-2 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                title="Удалить черновик"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Delete confirmation */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Удалить черновик?</AlertDialogTitle>
            <AlertDialogDescription>
              Черновик "{getDraftTitle(draftToDelete!)}" будет удалён. Это действие нельзя отменить.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Отмена</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteDraft.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : (
                <Trash2 className="w-4 h-4 mr-2" />
              )}
              Удалить
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
