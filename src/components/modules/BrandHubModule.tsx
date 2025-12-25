import { useState } from "react";
import { Book, Lightbulb, FileQuestion } from "lucide-react";
import { Button } from "@/components/ui/button";
import { InteractivePyramid } from "./brandhub/InteractivePyramid";
import { DetailPanel } from "./brandhub/DetailPanel";
import { GlossaryModal } from "./brandhub/GlossaryModal";
import { PrerequisitesModal } from "./brandhub/PrerequisitesModal";
import { UsageGuideModal } from "./brandhub/UsageGuideModal";

export function BrandHubModule() {
  const [selectedLevel, setSelectedLevel] = useState<number | null>(null);
  const [glossaryOpen, setGlossaryOpen] = useState(false);
  const [prerequisitesOpen, setPrerequisitesOpen] = useState(false);
  const [guideOpen, setGuideOpen] = useState(false);

  return (
    <div className="h-[calc(100vh-8rem)] flex flex-col">
      {/* Header */}
      <div className="flex flex-col gap-4 mb-4">
        <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
          <div>
            <h1 className="text-xl md:text-2xl font-bold">Платформа бренда</h1>
            <p className="text-xs md:text-sm text-muted-foreground">Навигация по смыслам Renowell</p>
          </div>
          
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setGlossaryOpen(true)} className="flex-1 sm:flex-none">
              <Book className="w-4 h-4 mr-1" /> <span className="hidden sm:inline">Глоссарий</span>
            </Button>
            <Button variant="outline" size="sm" onClick={() => setPrerequisitesOpen(true)} className="flex-1 sm:flex-none">
              <Lightbulb className="w-4 h-4 mr-1" /> <span className="hidden sm:inline">Контекст</span>
            </Button>
            <Button variant="outline" size="sm" onClick={() => setGuideOpen(true)} className="flex-1 sm:flex-none">
              <FileQuestion className="w-4 h-4 mr-1" /> <span className="hidden sm:inline">Как использовать</span>
            </Button>
          </div>
        </div>
      </div>

      {/* Main content area */}
      <div className="flex-1 flex gap-4 min-h-0 overflow-hidden">
        {/* Pyramid section */}
        <div 
          className={`
            transition-all duration-500 ease-out overflow-y-auto
            ${selectedLevel ? "w-0 md:w-1/2 opacity-0 md:opacity-100" : "w-full opacity-100"}
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
            transition-all duration-500 ease-out overflow-hidden rounded-xl shadow-lg
            ${selectedLevel 
              ? "w-full md:w-1/2 opacity-100 translate-x-0" 
              : "w-0 opacity-0 translate-x-8"
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
      </div>

      {/* Modals */}
      <GlossaryModal open={glossaryOpen} onOpenChange={setGlossaryOpen} />
      <PrerequisitesModal open={prerequisitesOpen} onOpenChange={setPrerequisitesOpen} />
      <UsageGuideModal open={guideOpen} onOpenChange={setGuideOpen} />
    </div>
  );
}
