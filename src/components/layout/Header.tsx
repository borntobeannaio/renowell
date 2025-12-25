import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useApp } from "@/context/AppContext";
import { useAuth } from "@/hooks/useAuth";
import { Search, X, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/ThemeToggle";

export function Header() {
  const location = useLocation();
  const navigate = useNavigate();
  const { searchQuery, setSearchQuery, setCurrentSection } = useApp();
  const { user, signOut } = useAuth();
  const [localQuery, setLocalQuery] = useState(searchQuery);

  const handleSearch = () => {
    if (localQuery.trim()) {
      setSearchQuery(localQuery.trim());
      setCurrentSection("search");
      navigate("/search");
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
    "/news": "Новости",
    "/protocols": "Протоколы совещаний",
    "/tasks": "Задачи",
    "/hr": "HR и Офис",
    "/knowledge": "База знаний",
    "/chats": "Чаты",
    "/search": "Результаты поиска",
  };

  const currentTitle = sectionTitles[location.pathname] || "Портал";

  return (
    <header className="sticky top-0 z-30 bg-background/80 backdrop-blur-xl border-b border-border/50 shadow-sm">
      <div className="flex items-center justify-between h-14 md:h-16 px-3 md:px-6 gap-2">
        {/* Title - hidden on very small screens */}
        <h2 className="text-sm md:text-lg font-bold text-foreground tracking-tight truncate min-w-0 flex-shrink">
          {currentTitle}
        </h2>

        {/* Right side controls */}
        <div className="flex items-center gap-1.5 md:gap-3 flex-shrink-0">
          {/* Search - responsive width */}
          <div className="relative group">
            <input
              type="text"
              value={localQuery}
              onChange={(e) => setLocalQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Поиск..."
              className="input-base h-9 md:h-11 w-24 sm:w-36 md:w-64 pr-8 text-sm md:text-base group-hover:border-primary/30 transition-all duration-300"
            />
            {localQuery && (
              <button
                onClick={clearSearch}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors duration-200"
              >
                <X className="w-3.5 h-3.5 md:w-4 md:h-4" />
              </button>
            )}
          </div>
          
          {/* Search button - icon only on mobile */}
          <button 
            onClick={handleSearch} 
            className="btn-primary h-9 md:h-11 px-2.5 md:px-5 flex items-center gap-2 shadow-md shadow-primary/20"
          >
            <Search className="w-4 h-4" />
            <span className="hidden sm:inline">Поиск</span>
          </button>
          
          <ThemeToggle />
          
          {user && (
            <Button
              variant="ghost"
              size="sm"
              onClick={signOut}
              className="h-9 md:h-10 px-2 md:px-3 text-muted-foreground hover:text-foreground hover:bg-destructive/10 rounded-xl transition-all duration-300"
            >
              <LogOut className="w-4 h-4" />
              <span className="hidden md:inline ml-2">Выйти</span>
            </Button>
          )}
        </div>
      </div>
    </header>
  );
}
