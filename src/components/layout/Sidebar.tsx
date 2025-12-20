import { useApp } from "@/context/AppContext";
import { NavigationSection } from "@/types";
import {
  Newspaper,
  FileText,
  CheckSquare,
  Users,
  BookOpen,
  MessageCircle,
} from "lucide-react";

const navItems: { id: NavigationSection; label: string; icon: React.ElementType }[] = [
  { id: "news", label: "Новости", icon: Newspaper },
  { id: "protocols", label: "Протоколы", icon: FileText },
  { id: "tasks", label: "Задачи", icon: CheckSquare },
  { id: "hr", label: "HR и Офис", icon: Users },
  { id: "knowledge", label: "База знаний", icon: BookOpen },
  { id: "chats", label: "Чаты", icon: MessageCircle },
];

export function Sidebar() {
  const { currentSection, setCurrentSection } = useApp();

  return (
    <aside className="hidden md:flex flex-col w-64 bg-sidebar border-r border-sidebar-border h-screen sticky top-0">
      <div className="p-6 border-b border-sidebar-border">
        <h1 className="text-xl font-bold text-sidebar-foreground">Портал</h1>
        <p className="text-sm text-muted-foreground mt-1">Внутренняя система</p>
      </div>
      
      <nav className="flex-1 p-4 space-y-1">
        {navItems.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setCurrentSection(id)}
            className={currentSection === id ? "nav-item-active w-full" : "nav-item w-full"}
          >
            <Icon className="w-5 h-5" />
            <span>{label}</span>
          </button>
        ))}
      </nav>

      <div className="p-4 border-t border-sidebar-border">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
            <span className="text-sm font-medium text-primary">АП</span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-sidebar-foreground truncate">Александр Петров</p>
            <p className="text-xs text-muted-foreground">Редактор</p>
          </div>
        </div>
      </div>
    </aside>
  );
}
