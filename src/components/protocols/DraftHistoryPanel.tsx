import { useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { ru } from 'date-fns/locale';
import { History, RotateCcw, FileText, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useDraftSnapshots, useRestoreSnapshot, DraftSnapshot } from '@/hooks/useDraftSnapshots';
import { toast } from 'sonner';

interface DraftHistoryPanelProps {
  formType: string;
  entityId: string;
  onRestore: (data: DraftSnapshot['draft_data']) => void;
  onClose: () => void;
}

export function DraftHistoryPanel({
  formType,
  entityId,
  onRestore,
  onClose,
}: DraftHistoryPanelProps) {
  const { data: snapshots, isLoading, error } = useDraftSnapshots(formType, entityId);
  const restoreMutation = useRestoreSnapshot();
  const [confirmingId, setConfirmingId] = useState<string | null>(null);

  const handleRestore = async (snapshot: DraftSnapshot) => {
    if (confirmingId !== snapshot.id) {
      setConfirmingId(snapshot.id);
      return;
    }

    try {
      await restoreMutation.mutateAsync({
        formType,
        entityId,
        snapshotData: snapshot.draft_data,
      });
      
      onRestore(snapshot.draft_data);
      toast.success('Версия восстановлена');
      onClose();
    } catch (err) {
      toast.error('Ошибка при восстановлении версии');
      console.error('Restore error:', err);
    }
  };

  const getSnapshotPreview = (snapshot: DraftSnapshot) => {
    const data = snapshot.draft_data;
    const title = data?.form?.title || 'Без названия';
    const sectionsCount = Array.isArray(data?.sectionGroups) ? data.sectionGroups.length : 0;
    
    let itemsCount = 0;
    if (Array.isArray(data?.sectionGroups)) {
      data.sectionGroups.forEach((group: unknown) => {
        if (group && typeof group === 'object' && 'items' in group) {
          const items = (group as { items?: unknown[] }).items;
          if (Array.isArray(items)) {
            itemsCount += items.length;
          }
        }
      });
    }

    return { title, sectionsCount, itemsCount };
  };

  const formatTime = (dateStr: string) => {
    try {
      return formatDistanceToNow(new Date(dateStr), { 
        addSuffix: true, 
        locale: ru 
      });
    } catch {
      return dateStr;
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="p-3 border border-border rounded-lg">
            <Skeleton className="h-4 w-24 mb-2" />
            <Skeleton className="h-3 w-48 mb-1" />
            <Skeleton className="h-3 w-32" />
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-8 text-destructive">
        <AlertTriangle className="w-10 h-10 mx-auto mb-2 opacity-50" />
        <p>Ошибка загрузки истории</p>
      </div>
    );
  }

  if (!snapshots || snapshots.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <History className="w-10 h-10 mx-auto mb-2 opacity-30" />
        <p>История изменений пуста</p>
        <p className="text-sm mt-1">Снепшоты появятся после первого автосохранения</p>
      </div>
    );
  }

  return (
    <div className="space-y-3 max-h-[60vh] overflow-y-auto">
      <p className="text-sm text-muted-foreground mb-4">
        Найдено {snapshots.length} {snapshots.length === 1 ? 'версия' : 'версий'}. 
        Выберите версию для восстановления.
      </p>
      
      {snapshots.map((snapshot) => {
        const preview = getSnapshotPreview(snapshot);
        const isConfirming = confirmingId === snapshot.id;

        return (
          <div
            key={snapshot.id}
            className={`p-3 border rounded-lg transition-colors ${
              isConfirming 
                ? 'border-primary bg-primary/5' 
                : 'border-border hover:border-muted-foreground/30'
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                  <History className="w-3.5 h-3.5" />
                  <span>{formatTime(snapshot.created_at)}</span>
                </div>
                
                <div className="flex items-center gap-2 mb-1">
                  <FileText className="w-4 h-4 text-muted-foreground" />
                  <span className="font-medium truncate">{preview.title}</span>
                </div>
                
                <div className="text-xs text-muted-foreground">
                  {preview.sectionsCount} секций • {preview.itemsCount} пунктов
                </div>
              </div>

              <Button
                variant={isConfirming ? 'default' : 'outline'}
                size="sm"
                onClick={() => handleRestore(snapshot)}
                disabled={restoreMutation.isPending}
                className="shrink-0"
              >
                <RotateCcw className="w-4 h-4 mr-1" />
                {isConfirming ? 'Подтвердить' : 'Восстановить'}
              </Button>
            </div>

            {isConfirming && (
              <div className="mt-2 pt-2 border-t border-border">
                <p className="text-xs text-amber-600 dark:text-amber-400">
                  Текущие данные черновика будут заменены. Нажмите ещё раз для подтверждения.
                </p>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setConfirmingId(null)}
                  className="mt-1 text-xs h-7"
                >
                  Отмена
                </Button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
