// Замена подписок в реальном времени: периодический опрос через прокси.
import { useEffect, useRef } from "react";
import { proxySelect } from "@/lib/dbProxy";

export const POLL_INTERVAL_MS = 4000;

/** Вызывает callback каждые intervalMs, пока вкладка видима. */
export function useInterval(callback: () => void, enabled: boolean, intervalMs = POLL_INTERVAL_MS) {
  const cbRef = useRef(callback);
  cbRef.current = callback;
  useEffect(() => {
    if (!enabled) return;
    const id = window.setInterval(() => {
      if (document.visibilityState === "visible") cbRef.current();
    }, intervalMs);
    return () => window.clearInterval(id);
  }, [enabled, intervalMs]);
}

/** Отслеживает новые строки таблицы (по created_at) и отдаёт их в onInsert. */
export function useNewRows<T extends { id: string; created_at: string }>(
  table: string,
  onInsert: (row: T) => void,
  enabled: boolean,
  intervalMs = POLL_INTERVAL_MS,
) {
  const sinceRef = useRef<string>(new Date().toISOString());
  const seenRef = useRef<Set<string>>(new Set());
  const cbRef = useRef(onInsert);
  cbRef.current = onInsert;
  useInterval(async () => {
    const { data } = await proxySelect<T>(table, {
      filters: [{ column: "created_at", operator: "gt", value: sinceRef.current }],
      order: [{ column: "created_at", ascending: true }],
      limit: 100,
    });
    for (const row of data ?? []) {
      if (seenRef.current.has(row.id)) continue;
      seenRef.current.add(row.id);
      if (row.created_at > sinceRef.current) sinceRef.current = row.created_at;
      cbRef.current(row);
    }
  }, enabled, intervalMs);
}
