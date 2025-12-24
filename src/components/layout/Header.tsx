import { useState } from "react";
import { useApp } from "@/context/AppContext";
import { useAuth } from "@/hooks/useAuth";
import { Search, X, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConnectionStatus } from "@/components/ConnectionStatus";
import { ProxySettings } from "@/components/ProxySettings";

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
    <header className="sticky top-0 z-30 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b border-border">
      <div className="flex items-center justify-between h-16 px-4 md:px-6">
        <div className="flex items-center gap-4">
          <h2 className="text-lg font-semibold text-foreground">
            {sectionTitles[currentSection] || "Портал"}
          </h2>
        </div>

        <div className="flex items-center gap-2">
          <div className="relative">
            <input
              type="text"
              value={localQuery}
              onChange={(e) => setLocalQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Поиск..."
              className="input-base w-40 md:w-64 pr-8"
            />
            {localQuery && (
              <button
                onClick={clearSearch}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
          <button onClick={handleSearch} className="btn-primary flex items-center gap-2">
            <Search className="w-4 h-4" />
            <span className="hidden sm:inline">Поиск</span>
          </button>
          
          <ProxySettings />
          <ConnectionStatus />
          
          {user && (
            <Button
              variant="ghost"
              size="sm"
              onClick={signOut}
              className="ml-2 text-muted-foreground hover:text-foreground"
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
