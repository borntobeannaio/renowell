import { useEffect } from "react";
import { proxyPing } from "@/lib/dbProxy";

/**
 * Keeps db-proxy function warm to reduce cold-start latency in some regions.
 */
export function useDbProxyWarmup() {
  useEffect(() => {
    let cancelled = false;

    const ping = async () => {
      try {
        await proxyPing();
      } catch {
        // ignore
      }
    };

    // initial warmup
    ping();

    // keep warm every 4 minutes
    const id = window.setInterval(() => {
      if (!cancelled) ping();
    }, 240_000);

    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, []);
}
