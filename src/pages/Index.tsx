import { useLocation, useNavigate, useSearchParams, Navigate } from "react-router-dom";
import { useEffect, useMemo } from "react";
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
import { FloatingChat } from "@/components/chat/FloatingChat";
import { useDbProxyWarmup } from "@/hooks/useDbProxyWarmup";
import { useProtocolPermissions } from "@/hooks/useProtocolPermissions";
import { NavigationSection } from "@/types";

const sectionFromPath = (pathname: string): NavigationSection => {
  const path = pathname.slice(1) || "news";
  const validSections: NavigationSection[] = ["news", "protocols", "tasks", "hr", "knowledge", "calendar", "chats", "search", "brandhub", "about"];
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

  // Sync context -> URL (for search navigation)
  useEffect(() => {
    if (currentSection === "search" && location.pathname !== "/search") {
      navigate("/search");
    }
  }, [currentSection, location.pathname, navigate]);

  const renderModule = () => {
    switch (sectionFromUrl) {
      case "news":
        return <NewsModule />;
      case "protocols":
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
