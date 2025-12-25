import { useState } from "react";
import { Search, Book } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { brandData } from "./BrandHubData";

interface GlossaryModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function GlossaryModal({ open, onOpenChange }: GlossaryModalProps) {
  const [search, setSearch] = useState("");

  const filteredTerms = brandData.glossary.filter(
    (item) =>
      item.term.toLowerCase().includes(search.toLowerCase()) ||
      item.definition.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Book className="w-5 h-5" />
            Глоссарий платформы бренда
          </DialogTitle>
        </DialogHeader>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Поиск по терминам..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>

        <div className="flex-1 overflow-y-auto space-y-3 pr-2">
          {filteredTerms.map((item) => (
            <div
              key={item.term}
              className="p-4 rounded-lg bg-secondary/50 hover:bg-secondary transition-colors"
            >
              <h3 className="font-semibold text-foreground mb-1">{item.term}</h3>
              <p className="text-sm text-muted-foreground">{item.definition}</p>
            </div>
          ))}

          {filteredTerms.length === 0 && (
            <p className="text-center text-muted-foreground py-8">
              Ничего не найдено
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
