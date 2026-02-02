
# План: Система версионирования черновиков

## Архитектура решения

```text
[Автосохранение] → upsert → form_drafts
                             ↓ (BEFORE UPDATE триггер)
                    INSERT → form_draft_snapshots (история)
                             ↓ (AFTER INSERT триггер)
                    Автоочистка старых снепшотов
```

## Этап 1: База данных

### 1.1 Создать таблицу `form_draft_snapshots`

```sql
CREATE TABLE public.form_draft_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  draft_id UUID NOT NULL REFERENCES public.form_drafts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  form_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  draft_data JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Индексы для быстрого поиска
CREATE INDEX idx_snapshots_draft_id ON form_draft_snapshots(draft_id);
CREATE INDEX idx_snapshots_user_entity ON form_draft_snapshots(user_id, form_type, entity_id);
CREATE INDEX idx_snapshots_created_at ON form_draft_snapshots(created_at DESC);
```

### 1.2 Триггер автоматического создания снепшотов

```sql
CREATE OR REPLACE FUNCTION save_draft_snapshot()
RETURNS TRIGGER AS $$
BEGIN
  -- Создать снепшот только если данные изменились
  IF OLD.draft_data IS DISTINCT FROM NEW.draft_data THEN
    INSERT INTO public.form_draft_snapshots 
      (draft_id, user_id, form_type, entity_id, draft_data)
    VALUES 
      (NEW.id, NEW.user_id, NEW.form_type, NEW.entity_id, OLD.draft_data);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER form_draft_snapshot_trigger
BEFORE UPDATE ON public.form_drafts
FOR EACH ROW
EXECUTE FUNCTION save_draft_snapshot();
```

### 1.3 Функция очистки старых снепшотов

```sql
CREATE OR REPLACE FUNCTION cleanup_old_snapshots()
RETURNS TRIGGER AS $$
BEGIN
  -- Удалить снепшоты старше 7 дней для этого черновика
  DELETE FROM public.form_draft_snapshots
  WHERE draft_id = NEW.draft_id
    AND created_at < NOW() - INTERVAL '7 days';
  
  -- Оставить только последние 50 снепшотов на черновик
  DELETE FROM public.form_draft_snapshots
  WHERE id IN (
    SELECT id FROM public.form_draft_snapshots
    WHERE draft_id = NEW.draft_id
    ORDER BY created_at DESC
    OFFSET 50
  );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER cleanup_snapshots_trigger
AFTER INSERT ON public.form_draft_snapshots
FOR EACH ROW
EXECUTE FUNCTION cleanup_old_snapshots();
```

### 1.4 RLS политики

```sql
ALTER TABLE public.form_draft_snapshots ENABLE ROW LEVEL SECURITY;

-- Пользователи могут видеть только свои снепшоты
CREATE POLICY "Users can view own snapshots"
  ON public.form_draft_snapshots FOR SELECT
  USING (user_id = auth.uid());

-- Вставка через триггер (SECURITY DEFINER)
CREATE POLICY "System can insert snapshots"
  ON public.form_draft_snapshots FOR INSERT
  WITH CHECK (true);

-- Пользователи могут удалять свои снепшоты
CREATE POLICY "Users can delete own snapshots"
  ON public.form_draft_snapshots FOR DELETE
  USING (user_id = auth.uid());
```

## Этап 2: Новый хук `useDraftSnapshots.ts`

```typescript
// src/hooks/useDraftSnapshots.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { proxySelect, proxyUpdate } from '@/lib/dbProxy';
import { useAuth } from './useAuth';

export interface DraftSnapshot {
  id: string;
  draft_id: string;
  draft_data: unknown;
  created_at: string;
}

// Получить список снепшотов для черновика
export function useDraftSnapshots(
  formType: string,
  entityId: string
) {
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
    enabled: !!user,
    staleTime: 30_000,
  });
}

// Восстановить черновик из снепшота
export function useRestoreSnapshot() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ 
      formType, 
      entityId, 
      snapshotData 
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
        queryKey: ['draft-snapshots', user?.id, variables.formType, variables.entityId] 
      });
    },
  });
}
```

## Этап 3: Компонент `DraftHistoryPanel.tsx`

```typescript
// src/components/protocols/DraftHistoryPanel.tsx
interface DraftHistoryPanelProps {
  formType: string;
  entityId: string;
  onRestore: (data: unknown) => void;
  onClose: () => void;
}

// Содержит:
// - Список снепшотов с датой/временем
// - Превью данных (кол-во секций, пунктов, заголовок)
// - Кнопка "Восстановить" для каждого снепшота
// - Подтверждение перед восстановлением
```

Функционал компонента:
- Показывает список снепшотов в хронологическом порядке
- Каждый снепшот отображает:
  - Время создания (относительное: "5 мин назад", "2 часа назад")
  - Превью: заголовок протокола и кол-во секций/пунктов
- Кнопка "Восстановить" с подтверждением
- Анимация загрузки и пустое состояние

## Этап 4: Интеграция в `ProtocolEditor.tsx`

### 4.1 Добавить кнопку "История" в шапку

Рядом с индикатором автосохранения добавить кнопку:
```typescript
<Button 
  variant="ghost" 
  size="sm"
  onClick={() => setShowHistoryPanel(true)}
>
  <History className="w-4 h-4 mr-2" />
  История
</Button>
```

### 4.2 Модальное окно с историей

```typescript
{showHistoryPanel && (
  <Modal onClose={() => setShowHistoryPanel(false)}>
    <DraftHistoryPanel
      formType="protocol"
      entityId={draftEntityId}
      onRestore={(data) => {
        setForm(data.form);
        setSectionGroups(data.sectionGroups);
        setShowHistoryPanel(false);
        toast.success('Версия восстановлена');
      }}
      onClose={() => setShowHistoryPanel(false)}
    />
  </Modal>
)}
```

## Файлы для создания/изменения

| Файл | Действие |
|------|----------|
| Миграция БД | Создать таблицу, триггеры, RLS |
| `src/hooks/useDraftSnapshots.ts` | **Создать** |
| `src/components/protocols/DraftHistoryPanel.tsx` | **Создать** |
| `src/pages/ProtocolEditor.tsx` | Добавить кнопку и модальное окно |

## Оценка данных

- Снепшот: ~5KB
- При автосохранении каждые 3 сек за час работы: теоретически ~1200 снепшотов
- С дедупликацией (триггер сохраняет только при изменениях): ~50-100 снепшотов реально
- С лимитом 50 снепшотов и очисткой 7 дней: макс ~250KB на черновик
- Каскадное удаление при удалении черновика

## Ожидаемый результат

- Каждое реальное изменение данных черновика автоматически сохраняется в историю
- Пользователь может открыть историю и выбрать любую предыдущую версию
- При восстановлении текущие данные заменяются на выбранную версию
- Старые снепшоты автоматически удаляются (>7 дней или >50 шт)
- Триггеры работают на уровне БД — не влияют на производительность фронтенда
