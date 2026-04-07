
import { useAuth } from "@/hooks/useAuth";
import { NavigationSection } from "@/types";
import { proxySelect } from "@/lib/dbProxy";
import { useQuery } from "@tanstack/react-query";
import { Link, useLocation } from "react-router-dom";
import {
  Newspaper,
  FileText,
  CheckSquare,
  Users,
  BookOpen,
  Calendar,
  Sparkles,
  Info,
  Building,
} from "lucide-react";
import renowellLogo from "@/assets/renowell-logo-text.png";


const allNavItems: { id: NavigationSection; path: string; label: string; icon: React.ElementType }[] = [
  { id: "brandhub", path: "/brandhub", label: "О нас", icon: Sparkles },
  { id: "news", path: "/news", label: "Новости", icon: Newspaper },
  { id: "protocols", path: "/protocols", label: "Протоколы", icon: FileText },
  { id: "tasks", path: "/tasks", label: "Задачи", icon: CheckSquare },
  { id: "tenders", path: "/tenders", label: "Коммерческий\nотдел", icon: Building },
  { id: "hr", path: "/hr", label: "HR и Офис", icon: Users },
  { id: "calendar", path: "/calendar", label: "Календарь", icon: Calendar },
  { id: "knowledge", path: "/knowledge", label: "База знаний", icon: BookOpen },
  { id: "about" as NavigationSection, path: "/about", label: "О платформе", icon: Info },
];

interface ProfileData {
  first_name: string | null;
  last_name: string | null;
  position: string | null;
  avatar_url: string | null;
}

export function Sidebar() {
  const location = useLocation();
  const { user } = useAuth();

  const { data: profile } = useQuery({
    queryKey: ['profile', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data, error } = await proxySelect<ProfileData>('profiles', {
        select: 'first_name, last_name, position, avatar_url',
        filters: [{ column: 'user_id', operator: 'eq', value: user.id }],
        limit: 1,
      });
      if (error) throw new Error(error.message);
      return data?.[0] ?? null;
    },
    enabled: !!user?.id,
  });

  const firstName = profile?.first_name || '';
  const lastName = profile?.last_name || '';
  const position = profile?.position || 'Сотрудник';
  const avatarUrl = profile?.avatar_url;
  const initials = `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase() || 'U';
  const fullName = [firstName, lastName].filter(Boolean).join(' ') || 'Пользователь';

  const navItems = allNavItems;

  const isActive = (path: string) => location.pathname === path;

  return (
    <aside className="hidden md:flex flex-col w-64 bg-gradient-to-b from-sidebar via-sidebar to-sidebar/95 border-r border-sidebar-border/50 h-screen sticky top-0 backdrop-blur-xl">
      {/* Logo Section with subtle glow */}
      <div className="p-6 border-b border-sidebar-border/30">
        <div className="flex items-center gap-3">
          <img 
            src={renowellLogo} 
            alt="Реновель" 
            className="h-7 w-auto dark:invert transition-all duration-300 hover:scale-105"
          />
        </div>
        <p className="text-xs text-muted-foreground mt-2 tracking-wide uppercase">Внутренняя система</p>
      </div>
      
      {/* Navigation with improved styling */}
      <nav className="flex-1 p-4 space-y-1.5">
        {navItems.map(({ id, path, label, icon: Icon }) => (
          <Link
            key={id}
            to={path}
            className={`
              w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium
              transition-all duration-300 ease-out
              ${isActive(path)
                ? "bg-gradient-to-r from-primary to-primary/80 text-primary-foreground shadow-lg shadow-primary/25 scale-[1.02]" 
                : "text-muted-foreground hover:text-foreground hover:bg-secondary/80 hover:translate-x-1"
              }
            `}
          >
            <Icon className={`w-5 h-5 transition-transform duration-300 ${isActive(path) ? 'scale-110' : ''}`} />
            <span className="whitespace-pre-line leading-tight">{label}</span>
          </Link>
        ))}
      </nav>

      {/* User Profile with glass effect - clickable */}
      <div className="p-4 border-t border-sidebar-border/30 bg-gradient-to-t from-sidebar-accent/20 to-transparent">
        <Link
          to="/profile"
          className="flex items-center gap-3 p-3 rounded-xl bg-card/50 backdrop-blur-sm border border-border/30 hover:border-primary/30 hover:bg-card/70 transition-all duration-300 cursor-pointer"
        >
          {avatarUrl ? (
            <img 
              src={avatarUrl} 
              alt={fullName}
              className="w-10 h-10 rounded-full object-cover shadow-md shadow-primary/20"
            />
          ) : (
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center shadow-md shadow-primary/20">
              <span className="text-sm font-semibold text-primary-foreground">{initials}</span>
            </div>
          )}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-sidebar-foreground truncate">{fullName}</p>
            <p className="text-xs text-muted-foreground truncate">{position}</p>
          </div>
        </Link>
      </div>
    </aside>
  );
}
