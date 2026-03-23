import { useState, useCallback } from "react";
import { proxyEdgeFunction } from "@/lib/mediaProxy";

export interface DadataSuggestion {
  inn: string | null;
  name: string;
  full_name: string | null;
  ogrn: string | null;
  address: string | null;
}

export function useDadataSuggest() {
  const [suggestions, setSuggestions] = useState<DadataSuggestion[]>([]);
  const [loading, setLoading] = useState(false);

  const search = useCallback(async (query: string) => {
    if (!query || query.trim().length < 2) {
      setSuggestions([]);
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await proxyEdgeFunction("dadata-suggest", {
        body: { query: query.trim() },
      });
      if (error) throw error;
      setSuggestions(data?.suggestions || []);
    } catch (e) {
      console.error("DaData search error:", e);
      setSuggestions([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const clear = useCallback(() => setSuggestions([]), []);

  return { suggestions, loading, search, clear };
}
