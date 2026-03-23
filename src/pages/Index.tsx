import { useLocation, useNavigate, useSearchParams, Navigate } from "react-router-dom";
import { useEffect, useMemo, useRef } from "react";
import { AppProvider, useApp } from "@/context/AppContext";
import { ChatProvider, useChatContext } from "@/context/ChatContext";
import { Sidebar } from "@/components/layout/Sidebar";
import { MobileNav } from "@/components/layout/MobileNav";
import { Header } from "@/components/layout/Header";
import { NewsModule } from "@/components/modules/NewsModule";
import { ProtocolsModule } from "@/components/modules/ProtocolsModule";
import { TasksModule } from "@/components/modules/TasksModule";
import { HRModule } from "@/components/modules/HRModule";
import { KnowledgeModule } from "@/components/modules/KnowledgeModule";
import { CalendarModule } from "@/components/modules/CalendarModule";
import { ChatModule } from "@/components/modules/ChatModule";
import { SearchModule } from "@/components/modules/SearchModule";
import { BrandHubModule } from "@/components/modules/BrandHubModule";
import { AboutPlatformModule } from "@/components/modules/AboutPlatformModule";
import { TendersKanbanModule } from "@/components/modules/TendersKanbanModule";
import { FloatingChat } from "@/components/chat/FloatingChat";
import { useDbProxyWarmup } from "@/hooks/useDbProxyWarmup";
import { useProtocolPermissions } from "@/hooks/useProtocolPermissions";
import { NavigationSection } from "@/types";
import { toast } from "sonner";
import { ShieldAlert } from "lucide-react";

function ProtocolAccessDenied() {
  const navigate = useNavigate();
  const shown = useRef(false);

  useEffect(() => {
    if (!shown.current) {
      shown.current = true;
      toast("Доступ к протоколам ограничён 🔒", {
        description: "У вас недостаточно прав для просмотра этого раздела. Напишите в чат техподдержки, если считаете, что это ошибка 💬",
        duration: 6000,
        icon: <ShieldAlert className="w-5 h-5 text-amber-500" />,
      });
      navigate("/news", { replace: true });
    }
  }, [navigate]);

  return null;
}

const sectionFromPath = (pathname: string): NavigationSection => {
  const path = pathname.slice(1) || "news";
  const validSections: NavigationSection[] = ["news", "protocols", "tasks", "hr", "knowledge", "calendar", "chats", "search", "brandhub", "about", "tenders"];
  return validSections.includes(path as NavigationSection) ? (path as NavigationSection) : "news";
};

function PortalContent() {
  useDbProxyWarmup();
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { currentSection, setCurrentSection, setSearchQuery, searchQuery } = useApp();
  const { openChat } = useChatContext();
  const { canViewProtocols } = useProtocolPermissions();

  const sectionFromUrl = useMemo(() => sectionFromPath(location.pathname), [location.pathname]);

  // Handle open_chat URL parameter from external notifications
  useEffect(() => {
    const chatId = searchParams.get("open_chat");
    if (chatId) {
      openChat(chatId);
      // Remove the parameter from URL
      searchParams.delete("open_chat");
      setSearchParams(searchParams, { replace: true });
    }
  }, [searchParams, openChat, setSearchParams]);

  // Sync URL -> context
  useEffect(() => {
    if (sectionFromUrl !== currentSection) {
      setCurrentSection(sectionFromUrl);
    }
  }, [sectionFromUrl, currentSection, setCurrentSection]);

  // When navigating away from search, clear search context
  useEffect(() => {
    if (sectionFromUrl !== "search" && currentSection === "search") {
      setCurrentSection(sectionFromUrl);
    }
  }, [sectionFromUrl, currentSection, setCurrentSection]);

  const renderModule = () => {
    switch (sectionFromUrl) {
      case "news":
        return <NewsModule />;
      case "protocols":
        if (!canViewProtocols) {
          return <ProtocolAccessDenied />;
        }
        return <ProtocolsModule />;
      case "tasks":
        return <TasksModule />;
      case "calendar":
        return <CalendarModule />;
      case "hr":
        return <HRModule />;
      case "knowledge":
        return <KnowledgeModule />;
      case "chats":
        return <ChatModule />;
      case "search":
        return <SearchModule />;
      case "brandhub":
        return <BrandHubModule />;
      case "tenders":
        return <TendersKanbanModule />;
      case "about":
        return <AboutPlatformModule />;
      default:
        return <NewsModule />;
    }
  };

  return (
    <div className="flex min-h-screen w-full bg-background">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <Header />
        <main className="flex-1 p-3 md:p-6 pb-20 md:pb-6 overflow-x-hidden">
          {renderModule()}
        </main>
      </div>
      <MobileNav />
      <FloatingChat />
    </div>
  );
}

const Index = () => {
  return (
    <AppProvider>
      <ChatProvider>
        <PortalContent />
      </ChatProvider>
    </AppProvider>
  );
};

export default Index;
