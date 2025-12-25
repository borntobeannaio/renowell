import { useState } from "react";
import { Book, Lightbulb, FileQuestion, Download, Sparkles, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { InteractivePyramid } from "./brandhub/InteractivePyramid";
import { DetailPanel } from "./brandhub/DetailPanel";
import { GlossaryModal } from "./brandhub/GlossaryModal";
import { PrerequisitesModal } from "./brandhub/PrerequisitesModal";
import { UsageGuideModal } from "./brandhub/UsageGuideModal";
import { TelegramChannelBlock } from "./brandhub/TelegramChannelBlock";

export function BrandHubModule() {
  const [selectedLevel, setSelectedLevel] = useState<number | null>(null);
  const [glossaryOpen, setGlossaryOpen] = useState(false);
  const [prerequisitesOpen, setPrerequisitesOpen] = useState(false);
  const [guideOpen, setGuideOpen] = useState(false);

  return (
    <div className="h-[calc(100vh-8rem)] flex flex-col relative">
      {/* Subtle background gradient */}
      <div className="absolute inset-0 -z-10 overflow-hidden pointer-events-none">
        <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-gradient-to-bl from-primary/5 via-transparent to-transparent rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-gradient-to-tr from-accent/5 via-transparent to-transparent rounded-full blur-3xl" />
      </div>

      {/* Header */}
      <div className="flex flex-col gap-4 mb-6">
        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-primary to-primary/80 
                            flex items-center justify-center text-primary-foreground shadow-lg shadow-primary/20">
              <Sparkles className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl md:text-3xl font-bold bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text">
                Платформа бренда
              </h1>
              <p className="text-sm text-muted-foreground">Навигация по смыслам Renowell</p>
            </div>
          </div>
          
          <div className="flex gap-2 flex-wrap">
            <Button 
              variant="default" 
              size="sm" 
              asChild 
              className="bg-gradient-to-r from-primary to-primary/90 hover:shadow-lg hover:shadow-primary/20 transition-all duration-300"
            >
              <a href="/docs/brand-platform.pdf" download="Платформа_бренда_Реновель.pdf">
                <Download className="w-4 h-4 mr-2" /> 
                <span className="hidden sm:inline">Скачать PDF</span>
                <span className="sm:hidden">PDF</span>
              </a>
            </Button>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => setGlossaryOpen(true)} 
              className="hover:bg-violet-500/10 hover:text-violet-600 hover:border-violet-500/30 transition-all duration-300"
            >
              <Book className="w-4 h-4 mr-1" /> 
              <span className="hidden sm:inline">Глоссарий</span>
            </Button>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => setPrerequisitesOpen(true)} 
              className="hover:bg-amber-500/10 hover:text-amber-600 hover:border-amber-500/30 transition-all duration-300"
            >
              <Lightbulb className="w-4 h-4 mr-1" /> 
              <span className="hidden sm:inline">Контекст</span>
            </Button>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => setGuideOpen(true)} 
              className="hover:bg-emerald-500/10 hover:text-emerald-600 hover:border-emerald-500/30 transition-all duration-300"
            >
              <FileQuestion className="w-4 h-4 mr-1" /> 
              <span className="hidden sm:inline">Как использовать</span>
            </Button>
          </div>
        </div>
      </div>

      {/* Main content area with tabs */}
      <Tabs defaultValue="platform" className="flex-1 flex flex-col min-h-0">
        <TabsList className="w-fit mb-4">
          <TabsTrigger value="platform" className="gap-2">
            <Sparkles className="w-4 h-4" />
            Платформа
          </TabsTrigger>
          <TabsTrigger value="channel" className="gap-2">
            <Send className="w-4 h-4" />
            Бренд-канал
          </TabsTrigger>
        </TabsList>

        <TabsContent value="platform" className="flex-1 flex gap-6 min-h-0 overflow-hidden mt-0">
          {/* Pyramid section */}
          <div 
            className={`
              transition-all duration-700 ease-out overflow-y-auto scrollbar-thin
              ${selectedLevel ? "w-0 md:w-1/2 opacity-0 md:opacity-100 md:pr-2" : "w-full opacity-100"}
            `}
          >
            <InteractivePyramid
              onLayerSelect={setSelectedLevel}
              selectedLevel={selectedLevel}
            />
          </div>

          {/* Detail panel */}
          <div 
            className={`
              transition-all duration-700 ease-out overflow-hidden 
              rounded-2xl shadow-2xl shadow-black/10
              border border-border/50
              ${selectedLevel 
                ? "w-full md:w-1/2 opacity-100 translate-x-0 scale-100" 
                : "w-0 opacity-0 translate-x-12 scale-95"
              }
            `}
          >
            {selectedLevel && (
              <DetailPanel
                level={selectedLevel}
                isQuickMode={false}
                onClose={() => setSelectedLevel(null)}
              />
            )}
          </div>
        </TabsContent>

        <TabsContent value="channel" className="flex-1 overflow-y-auto mt-0">
          <TelegramChannelBlock />
        </TabsContent>
      </Tabs>

      {/* Modals */}
      <GlossaryModal open={glossaryOpen} onOpenChange={setGlossaryOpen} />
      <PrerequisitesModal open={prerequisitesOpen} onOpenChange={setPrerequisitesOpen} />
      <UsageGuideModal open={guideOpen} onOpenChange={setGuideOpen} />
    </div>
  );
}