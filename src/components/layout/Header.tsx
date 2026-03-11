import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useApp } from "@/context/AppContext";
import { useAuth } from "@/hooks/useAuth";
import { useCurrentProfile } from "@/hooks/useCurrentProfile";
import { useProxiedAvatarUrl } from "@/lib/avatarProxy";
import { Search, X, LogOut, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/ThemeToggle";
import { NotificationBell } from "@/components/notifications/NotificationBell";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function Header() {
  const location = useLocation();
  const navigate = useNavigate();
  const { searchQuery, setSearchQuery, setCurrentSection } = useApp();
  const { user, signOut } = useAuth();
  const { data: profile } = useCurrentProfile();
  const avatarUrl = useProxiedAvatarUrl(profile?.avatar_url ?? null);
  const [localQuery, setLocalQuery] = useState(searchQuery);

  const initials = `${(profile?.first_name || "").charAt(0)}${(profile?.last_name || "").charAt(0)}`.toUpperCase() || "U";

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
    if (location.pathname === "/search") {
      navigate(-1);
    }
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
          
          <NotificationBell />
          
          <ThemeToggle />
          
          {user && (
            <>
              {/* Desktop: simple logout button */}
              <Button
                variant="ghost"
                size="sm"
                onClick={signOut}
                className="hidden md:flex h-10 px-3 text-muted-foreground hover:text-foreground hover:bg-destructive/10 rounded-xl transition-all duration-300"
              >
                <LogOut className="w-4 h-4" />
                <span className="ml-2">Выйти</span>
              </Button>

              {/* Mobile: avatar dropdown */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild className="md:hidden">
                  <button className="h-9 w-9 rounded-full overflow-hidden border-2 border-border hover:border-primary/50 transition-colors flex-shrink-0">
                    {avatarUrl ? (
                      <img src={avatarUrl} alt="Профиль" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">
                        {initials}
                      </div>
                    )}
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuItem onClick={() => navigate("/profile")} className="gap-2">
                    <User className="w-4 h-4" />
                    Профиль
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={signOut} className="gap-2 text-destructive focus:text-destructive">
                    <LogOut className="w-4 h-4" />
                    Выйти
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
