import { useState } from "react";
import { useApp } from "@/context/AppContext";
import { useAuth } from "@/hooks/useAuth";
import { Search, X, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";

export function Header() {
  const { currentSection, setCurrentSection, searchQuery, setSearchQuery } = useApp();
  const { user, signOut } = useAuth();
  const [localQuery, setLocalQuery] = useState(searchQuery);

  const handleSearch = () => {
    if (localQuery.trim()) {
      setSearchQuery(localQuery.trim());
      setCurrentSection("search");
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleSearch();
    }
  };

  const clearSearch = () => {
    setLocalQuery("");
    setSearchQuery("");
  };

  const sectionTitles: Record<string, string> = {
    news: "Новости",
    protocols: "Протоколы совещаний",
    tasks: "Задачи",
    hr: "HR и Офис",
    knowledge: "База знаний",
    chats: "Чаты",
    search: "Результаты поиска",
  };

  return (
    <header className="sticky top-0 z-30 bg-background/80 backdrop-blur-xl border-b border-border/50 shadow-sm">
      <div className="flex items-center justify-between h-16 px-4 md:px-6">
        <div className="flex items-center gap-4">
          <h2 className="text-lg font-bold text-foreground tracking-tight">
            {sectionTitles[currentSection] || "Портал"}
          </h2>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative group">
            <input
              type="text"
              value={localQuery}
              onChange={(e) => setLocalQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Поиск..."
              className="input-base w-44 md:w-72 pr-9 group-hover:border-primary/30 transition-all duration-300"
            />
            {localQuery && (
              <button
                onClick={clearSearch}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors duration-200"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
          <button 
            onClick={handleSearch} 
            className="btn-primary flex items-center gap-2 shadow-md shadow-primary/20"
          >
            <Search className="w-4 h-4" />
            <span className="hidden sm:inline">Поиск</span>
          </button>
          {user && (
            <Button
              variant="ghost"
              size="sm"
              onClick={signOut}
              className="ml-1 text-muted-foreground hover:text-foreground hover:bg-destructive/10 rounded-xl transition-all duration-300"
            >
              <LogOut className="w-4 h-4" />
              <span className="hidden sm:inline ml-2">Выйти</span>
            </Button>
          )}
        </div>
      </div>
    </header>
  );
}
