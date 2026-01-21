import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

interface DraftData<T> {
  data: T;
  savedAt: string;
}

interface UseFormDraftOptions {
  autoSaveInterval?: number;
  enabled?: boolean;
}

export function useFormDraft<T>(
  formType: string,
  entityId: string,
  currentData: T,
  options: UseFormDraftOptions = {}
) {
  const { user } = useAuth();
  const { autoSaveInterval = 10000, enabled = true } = options;
  
  const [isLoading, setIsLoading] = useState(true);
  const [existingDraft, setExistingDraft] = useState<DraftData<T> | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const lastSavedRef = useRef<string | null>(null);
  const hasCheckedDraft = useRef(false);
  const prevEnabledRef = useRef(enabled);

  // Reset check flag when enabled changes from false to true
  useEffect(() => {
    if (enabled && !prevEnabledRef.current) {
      hasCheckedDraft.current = false;
    }
    prevEnabledRef.current = enabled;
  }, [enabled]);

  // Загрузить существующий черновик при монтировании
  useEffect(() => {
    if (!user || !enabled) {
      setIsLoading(false);
      return;
    }
    
    if (hasCheckedDraft.current) {
      return;
    }

    const loadDraft = async () => {
      hasCheckedDraft.current = true;
      console.log('[Draft] Loading draft for:', formType, entityId, 'user:', user.id);
      try {
        const { data, error } = await supabase
          .from('form_drafts')
          .select('draft_data, updated_at')
          .eq('user_id', user.id)
          .eq('form_type', formType)
          .eq('entity_id', entityId)
          .maybeSingle();

        console.log('[Draft] Load result:', { data: !!data, error });
        
        if (data && !error) {
          setExistingDraft({
            data: data.draft_data as T,
            savedAt: data.updated_at
          });
        }
      } catch (err) {
        console.error('Error loading draft:', err);
      } finally {
        setIsLoading(false);
      }
    };

    loadDraft();
  }, [user, formType, entityId, enabled]);

  // Автосохранение каждые N секунд
  useEffect(() => {
    if (!user || !enabled || !hasCheckedDraft.current) return;

    const timer = setInterval(async () => {
      const currentJson = JSON.stringify(currentData);
      
      // Не сохранять, если данные не изменились
      if (currentJson === lastSavedRef.current) return;
      
      console.log('[Draft] Auto-saving draft for:', formType, entityId);
      setIsSaving(true);
      try {
        const { error } = await supabase
          .from('form_drafts')
          .upsert({
            user_id: user.id,
            form_type: formType,
            entity_id: entityId,
            draft_data: JSON.parse(currentJson),
            updated_at: new Date().toISOString()
          }, {
            onConflict: 'user_id,form_type,entity_id'
          });
        if (error) throw error;
        
        console.log('[Draft] Draft saved successfully');
        lastSavedRef.current = currentJson;
      } catch (err) {
        console.error('[Draft] Error saving draft:', err);
      } finally {
        setIsSaving(false);
      }
    }, autoSaveInterval);

    return () => clearInterval(timer);
  }, [user, formType, entityId, currentData, autoSaveInterval, enabled]);

  // Принять черновик
  const acceptDraft = useCallback(() => {
    const draft = existingDraft;
    setExistingDraft(null);
    return draft?.data ?? null;
  }, [existingDraft]);

  // Отклонить черновик
  const discardDraft = useCallback(async () => {
    if (!user) return;
    
    setExistingDraft(null);
    await supabase
      .from('form_drafts')
      .delete()
      .eq('user_id', user.id)
      .eq('form_type', formType)
      .eq('entity_id', entityId);
  }, [user, formType, entityId]);

  // Очистить черновик после успешного сохранения
  const clearDraft = useCallback(async () => {
    if (!user) return;
    
    lastSavedRef.current = null;
    await supabase
      .from('form_drafts')
      .delete()
      .eq('user_id', user.id)
      .eq('form_type', formType)
      .eq('entity_id', entityId);
  }, [user, formType, entityId]);

  // Принудительно сохранить
  const saveNow = useCallback(async () => {
    if (!user) return;
    
    setIsSaving(true);
    try {
      const currentJson = JSON.stringify(currentData);
      const { error } = await supabase
        .from('form_drafts')
        .upsert({
          user_id: user.id,
          form_type: formType,
          entity_id: entityId,
          draft_data: JSON.parse(currentJson),
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'user_id,form_type,entity_id'
        });
      if (error) throw error;
      
      lastSavedRef.current = currentJson;
    } catch (err) {
      console.error('Error saving draft:', err);
    } finally {
      setIsSaving(false);
    }
  }, [user, formType, entityId, currentData]);

  return {
    isLoading,
    isSaving,
    existingDraft,
    acceptDraft,
    discardDraft,
    clearDraft,
    saveNow
  };
}
