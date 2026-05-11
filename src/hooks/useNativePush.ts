import { useEffect } from 'react';
import { Capacitor } from '@capacitor/core';
import { useAuth } from '@/hooks/useAuth';
import { proxySelect, proxyUpdate } from '@/lib/dbProxy';

/**
 * Регистрирует устройство для нативных push-уведомлений (iOS/APNs, Android/FCM).
 * Все вызовы плагина обёрнуты в try/catch, чтобы отсутствие FCM-конфига
 * (google-services.json) не роняло приложение после логина.
 */
export function useNativePush() {
  const { user } = useAuth();

  useEffect(() => {
    if (!Capacitor.isNativePlatform() || !user?.id) return;

    let removed = false;
    const handles: Array<Promise<{ remove: () => Promise<void> }>> = [];

    (async () => {
      try {
        const { PushNotifications } = await import('@capacitor/push-notifications');

        try {
          let perm = await PushNotifications.checkPermissions();
          if (perm.receive === 'prompt' || perm.receive === 'prompt-with-rationale') {
            perm = await PushNotifications.requestPermissions();
          }
          if (perm.receive !== 'granted') return;
        } catch (err) {
          console.warn('[NativePush] permissions error', err);
          return;
        }

        try {
          handles.push(
            PushNotifications.addListener('registration', async (token) => {
              try {
                const { data: profiles } = await proxySelect<{ id: string }>('profiles', {
                  select: 'id',
                  filters: [{ column: 'user_id', operator: 'eq', value: user.id }],
                  limit: 1,
                });
                if (!profiles?.[0] || removed) return;
                await proxyUpdate(
                  'profiles',
                  {
                    notify_push: true,
                    push_subscription: {
                      native: true,
                      platform: Capacitor.getPlatform(),
                      token: token.value,
                    },
                  },
                  [{ column: 'id', operator: 'eq', value: profiles[0].id }],
                );
              } catch (err) {
                console.error('[NativePush] save token error', err);
              }
            }),
          );

          handles.push(
            PushNotifications.addListener('registrationError', (err) => {
              console.error('[NativePush] registration failed', err);
            }),
          );

          handles.push(
            PushNotifications.addListener('pushNotificationReceived', (notification) => {
              console.log('[NativePush] received', notification);
            }),
          );

          handles.push(
            PushNotifications.addListener('pushNotificationActionPerformed', (action) => {
              const url = (action.notification.data as { url?: string })?.url;
              if (url) window.location.href = url;
            }),
          );
        } catch (err) {
          console.warn('[NativePush] listeners error', err);
        }

        try {
          await PushNotifications.register();
        } catch (err) {
          console.warn('[NativePush] register error', err);
        }
      } catch (err) {
        console.warn('[NativePush] plugin unavailable', err);
      }
    })();

    return () => {
      removed = true;
      handles.forEach((p) => p.then((h) => h.remove()).catch(() => {}));
    };
  }, [user?.id]);
}
