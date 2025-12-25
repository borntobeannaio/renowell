import { useState, useMemo } from "react";
import { Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { brandData } from "./BrandHubData";

interface SearchResult {
  type: string;
  title: string;
  text: string;
  section: string;
}

interface BrandSearchProps {
  onResultClick: (section: string) => void;
}

export function BrandSearch({ onResultClick }: BrandSearchProps) {
  const [query, setQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);

  const searchIndex = useMemo(() => {
    const items: SearchResult[] = [];

    // Add main content
    items.push({ type: "main", title: "Золотое правило", text: brandData.goldenRule.text, section: "hero" });
    items.push({ type: "main", title: "Позиционирование", text: brandData.positioning.text, section: "positioning" });
    items.push({ type: "main", title: "Видение", text: brandData.vision.text, section: "positioning" });
    items.push({ type: "main", title: "Миссия", text: brandData.mission.text, section: "positioning" });

    // Values
    brandData.values.forEach((v) => {
      items.push({ type: "value", title: v.title, text: v.description, section: "values" });
    });

    // Character & Tonality
    brandData.character.forEach((c) => {
      items.push({ type: "character", title: c.title, text: c.description, section: "character" });
    });
    brandData.tonality.forEach((t) => {
      items.push({ type: "tonality", title: t.title, text: t.description, section: "character" });
    });

    // Glossary
    brandData.glossary.forEach((g) => {
      items.push({ type: "glossary", title: g.term, text: g.definition, section: "glossary" });
    });

    // Attributes
    Object.entries(brandData.attributes).forEach(([cat, attrs]) => {
      attrs.forEach((a) => {
        items.push({ type: "attribute", title: a, text: cat, section: "attributes" });
      });
    });

    return items;
  }, []);

  const results = useMemo(() => {
    if (query.length < 2) return [];
    const q = query.toLowerCase();
    return searchIndex.filter(
      (item) =>
        item.title.toLowerCase().includes(q) ||
        item.text.toLowerCase().includes(q)
    ).slice(0, 8);
  }, [query, searchIndex]);

  return (
    <div className="relative">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Поиск по платформе..."
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          className="pl-10 pr-10"
        />
        {query && (
          <Button
            variant="ghost"
            size="sm"
            className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 p-0"
            onClick={() => {
              setQuery("");
              setIsOpen(false);
            }}
          >
            <X className="w-4 h-4" />
          </Button>
        )}
      </div>

      {isOpen && results.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-popover border rounded-lg shadow-lg z-50 max-h-80 overflow-y-auto">
          {results.map((result, i) => (
            <button
              key={i}
              className="w-full text-left p-3 hover:bg-secondary transition-colors border-b last:border-0"
              onClick={() => {
                onResultClick(result.section);
                setIsOpen(false);
                setQuery("");
              }}
            >
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs px-2 py-0.5 rounded bg-primary/10 text-primary">
                  {result.type}
                </span>
                <span className="font-medium text-sm">{result.title}</span>
              </div>
              <p className="text-xs text-muted-foreground line-clamp-1">{result.text}</p>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
