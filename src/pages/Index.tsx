import { AppProvider, useApp } from "@/context/AppContext";
import { Sidebar } from "@/components/layout/Sidebar";
import { MobileNav } from "@/components/layout/MobileNav";
import { Header } from "@/components/layout/Header";
import { NewsModule } from "@/components/modules/NewsModule";
import { ProtocolsModule } from "@/components/modules/ProtocolsModule";
import { TasksModule } from "@/components/modules/TasksModule";
import { HRModule } from "@/components/modules/HRModule";
import { KnowledgeModule } from "@/components/modules/KnowledgeModule";
import { ChatModule } from "@/components/modules/ChatModule";
import { SearchModule } from "@/components/modules/SearchModule";

function PortalContent() {
  const { currentSection } = useApp();

  const renderModule = () => {
    switch (currentSection) {
      case "news":
        return <NewsModule />;
      case "protocols":
        return <ProtocolsModule />;
      case "tasks":
        return <TasksModule />;
      case "hr":
        return <HRModule />;
      case "knowledge":
        return <KnowledgeModule />;
      case "chats":
        return <ChatModule />;
      case "search":
        return <SearchModule />;
      default:
        return <NewsModule />;
    }
  };

  return (
    <div className="flex min-h-screen w-full bg-background">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <Header />
        <main className="flex-1 p-4 md:p-6 pb-20 md:pb-6">
          {renderModule()}
        </main>
      </div>
      <MobileNav />
    </div>
  );
}

const Index = () => {
  return (
    <AppProvider>
      <PortalContent />
    </AppProvider>
  );
};

export default Index;
