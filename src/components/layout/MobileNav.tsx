import { NavigationSection } from "@/types";
import { Link, useLocation } from "react-router-dom";
import {
  Newspaper,
  FileText,
  CheckSquare,
  Users,
  BookOpen,
  Calendar,
} from "lucide-react";

const navItems: { id: NavigationSection; path: string; label: string; icon: React.ElementType }[] = [
  { id: "news", path: "/news", label: "Новости", icon: Newspaper },
  { id: "protocols", path: "/protocols", label: "Протоколы", icon: FileText },
  { id: "tasks", path: "/tasks", label: "Задачи", icon: CheckSquare },
  { id: "calendar", path: "/calendar", label: "Календарь", icon: Calendar },
  { id: "hr", path: "/hr", label: "HR", icon: Users },
];

export function MobileNav() {
  const location = useLocation();
  const isActive = (path: string) => location.pathname === path;

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-card/95 backdrop-blur-xl border-t border-border/50 z-40">
      <div className="flex justify-around items-center h-16 px-2">
        {navItems.map(({ id, path, label, icon: Icon }) => (
          <Link
            key={id}
            to={path}
            className={`flex flex-col items-center justify-center gap-0.5 p-2 rounded-xl transition-all duration-300 min-w-[3.5rem] ${
              isActive(path)
                ? "text-primary scale-105"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Icon className="w-5 h-5" />
            <span className="text-[10px] font-medium">{label}</span>
          </Link>
        ))}
      </div>
    </nav>
  );
}
