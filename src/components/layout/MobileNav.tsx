import { NavigationSection } from "@/types";
import { Link, useLocation } from "react-router-dom";
import {
  Newspaper,
  FileText,
  CheckSquare,
  Users,
  Calendar,
  Building,
} from "lucide-react";

const allNavItems: { id: NavigationSection; path: string; label: string; icon: React.ElementType }[] = [
  { id: "news", path: "/news", label: "Новости", icon: Newspaper },
  { id: "protocols", path: "/protocols", label: "Протоколы", icon: FileText },
  { id: "tasks", path: "/tasks", label: "Задачи", icon: CheckSquare },
  { id: "hr", path: "/hr", label: "HR", icon: Users },
  { id: "calendar", path: "/calendar", label: "Календарь", icon: Calendar },
];

export function MobileNav() {
  const location = useLocation();
  const isActive = (path: string) => location.pathname === path;

  const navItems = allNavItems;

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-card/95 backdrop-blur-xl border-t border-border/50 z-40 safe-area-pb">
      <div className="flex justify-between items-center h-14 px-1">
        {navItems.map(({ id, path, label, icon: Icon }) => (
          <Link
            key={id}
            to={path}
            className={`flex flex-col items-center justify-center gap-0.5 py-1.5 px-1 rounded-lg transition-all duration-200 flex-1 min-w-0 ${
              isActive(path)
                ? "text-primary"
                : "text-muted-foreground active:text-foreground"
            }`}
          >
            <Icon className={`w-5 h-5 flex-shrink-0 ${isActive(path) ? 'scale-110' : ''}`} />
            <span className="text-[9px] font-medium truncate max-w-full">{label}</span>
          </Link>
        ))}
      </div>
    </nav>
  );
}
