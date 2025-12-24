import { useApp } from "@/context/AppContext";
import { NavigationSection } from "@/types";
import {
  Newspaper,
  FileText,
  CheckSquare,
  Users,
  BookOpen,
} from "lucide-react";

const navItems: { id: NavigationSection; label: string; icon: React.ElementType }[] = [
  { id: "news", label: "Новости", icon: Newspaper },
  { id: "protocols", label: "Протоколы", icon: FileText },
  { id: "tasks", label: "Задачи", icon: CheckSquare },
  { id: "hr", label: "HR", icon: Users },
  { id: "knowledge", label: "База", icon: BookOpen },
];

export function MobileNav() {
  const { currentSection, setCurrentSection } = useApp();

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-card border-t border-border z-40">
      <div className="flex justify-around items-center h-16 px-2">
        {navItems.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setCurrentSection(id)}
            className={`flex flex-col items-center justify-center gap-0.5 p-2 rounded-lg transition-colors min-w-[3.5rem] ${
              currentSection === id
                ? "text-primary"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Icon className="w-5 h-5" />
            <span className="text-[10px] font-medium">{label}</span>
          </button>
        ))}
      </div>
    </nav>
  );
}
