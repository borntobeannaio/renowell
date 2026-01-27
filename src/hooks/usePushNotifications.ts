import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/hooks/useAuth";
import { proxySelect, proxyUpdate } from "@/lib/dbProxy";

// VAPID public key - safe to expose in client code
const VAPID_PUBLIC_KEY = "BCbN8Vmp7W-Pdn7CjKXrDZVTpQI_sLo3TKkH-wqK_fgWn2lt0dvKq0EE7phVvZPkD7Ttl6V8gEkSeyRyYJN4eP4";

function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding)
    .replace(/-/g, "+")
    .replace(/_/g, "/");
  const rawData = window.atob(base64);
  const buffer = new ArrayBuffer(rawData.length);
  const outputArray = new Uint8Array(buffer);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export function usePushNotifications() {
  const { user } = useAuth();
  const [permission, setPermission] = useState<NotificationPermission>("default");
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [registration, setRegistration] = useState<ServiceWorkerRegistration | null>(null);

  // Check current permission and subscription state
  useEffect(() => {
    if (!("Notification" in window) || !("serviceWorker" in navigator)) {
      return;
    }

    setPermission(Notification.permission);

    // Check existing subscription
    navigator.serviceWorker.ready.then((reg) => {
      setRegistration(reg);
      reg.pushManager.getSubscription().then((sub) => {
        setIsSubscribed(!!sub);
      });
    });

    // Register service worker if not already
    navigator.serviceWorker.register("/sw.js").catch((err) => {
      console.error("Service Worker registration failed:", err);
    });
  }, []);

  const subscribe = useCallback(async (): Promise<boolean> => {
    if (!("Notification" in window) || !("serviceWorker" in navigator)) {
      console.error("Push notifications not supported");
      return false;
    }

    setIsLoading(true);

    try {
      // Request permission
      const perm = await Notification.requestPermission();
      setPermission(perm);

      if (perm !== "granted") {
        console.log("Push notification permission denied");
        return false;
      }

      // Get or wait for service worker registration
      const reg = registration || await navigator.serviceWorker.ready;
      setRegistration(reg);

      // Subscribe to push
      const subscription = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      });

      // Save subscription to profile
      if (user?.id) {
        const { data: profiles } = await proxySelect<{ id: string }>("profiles", {
          select: "id",
          filters: [{ column: "user_id", operator: "eq", value: user.id }],
          limit: 1,
        });

        if (profiles?.[0]) {
          await proxyUpdate(
            "profiles",
            {
              notify_push: true,
              push_subscription: subscription.toJSON(),
            },
            [{ column: "id", operator: "eq", value: profiles[0].id }]
          );
        }
      }

      setIsSubscribed(true);
      return true;
    } catch (error) {
      console.error("Error subscribing to push:", error);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [user?.id, registration]);

  const unsubscribe = useCallback(async (): Promise<boolean> => {
    if (!registration) return false;

    setIsLoading(true);

    try {
      const subscription = await registration.pushManager.getSubscription();
      if (subscription) {
        await subscription.unsubscribe();
      }

      // Clear subscription from profile
      if (user?.id) {
        const { data: profiles } = await proxySelect<{ id: string }>("profiles", {
          select: "id",
          filters: [{ column: "user_id", operator: "eq", value: user.id }],
          limit: 1,
        });

        if (profiles?.[0]) {
          await proxyUpdate(
            "profiles",
            {
              notify_push: false,
              push_subscription: null,
            },
            [{ column: "id", operator: "eq", value: profiles[0].id }]
          );
        }
      }

      setIsSubscribed(false);
      return true;
    } catch (error) {
      console.error("Error unsubscribing from push:", error);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [user?.id, registration]);

  return {
    permission,
    isSubscribed,
    isLoading,
    isSupported: "Notification" in window && "serviceWorker" in navigator,
    subscribe,
    unsubscribe,
  };
}
