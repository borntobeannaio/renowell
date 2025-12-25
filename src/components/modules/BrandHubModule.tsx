import { useState, useRef } from "react";
import { Book, Lightbulb, FileQuestion } from "lucide-react";
import { Button } from "@/components/ui/button";
import { HeroBlock } from "./brandhub/HeroBlock";
import { PositioningBlock } from "./brandhub/PositioningBlock";
import { AudienceBlock } from "./brandhub/AudienceBlock";
import { BenefitsBlock } from "./brandhub/BenefitsBlock";
import { ValuesBlock } from "./brandhub/ValuesBlock";
import { CharacterBlock } from "./brandhub/CharacterBlock";
import { AttributesBlock } from "./brandhub/AttributesBlock";
import { PyramidBlock } from "./brandhub/PyramidBlock";
import { BrandSearch } from "./brandhub/BrandSearch";
import { GlossaryModal } from "./brandhub/GlossaryModal";
import { AttributesCatalogModal } from "./brandhub/AttributesCatalogModal";
import { PrerequisitesModal } from "./brandhub/PrerequisitesModal";
import { UsageGuideModal } from "./brandhub/UsageGuideModal";

export function BrandHubModule() {
  const [glossaryOpen, setGlossaryOpen] = useState(false);
  const [catalogOpen, setCatalogOpen] = useState(false);
  const [prerequisitesOpen, setPrerequisitesOpen] = useState(false);
  const [guideOpen, setGuideOpen] = useState(false);
  const cheatsheetRef = useRef<HTMLDivElement>(null);

  const scrollToCheatsheet = () => {
    cheatsheetRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const handleSearchResult = (section: string) => {
    if (section === "glossary") setGlossaryOpen(true);
    else if (section === "attributes") setCatalogOpen(true);
    else {
      const el = document.getElementById(section);
      el?.scrollIntoView({ behavior: "smooth" });
    }
  };

  const handlePyramidClick = (level: number) => {
    const sectionMap: Record<number, string> = {
      1: "hero",
      2: "positioning",
      3: "character",
      4: "benefits",
      5: "positioning"
    };
    const el = document.getElementById(sectionMap[level] || "hero");
    el?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <div className="space-y-8 max-w-5xl mx-auto">
      {/* Header with search and quick links */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Платформа бренда Renowell</h1>
          <p className="text-sm text-muted-foreground">Brand Hub — база смыслов компании</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => setGlossaryOpen(true)}>
            <Book className="w-4 h-4 mr-1" /> Глоссарий
          </Button>
          <Button variant="outline" size="sm" onClick={() => setPrerequisitesOpen(true)}>
            <Lightbulb className="w-4 h-4 mr-1" /> Предпосылки
          </Button>
          <Button variant="outline" size="sm" onClick={() => setGuideOpen(true)}>
            <FileQuestion className="w-4 h-4 mr-1" /> Руководство
          </Button>
        </div>
      </div>

      <BrandSearch onResultClick={handleSearchResult} />

      <div id="hero">
        <HeroBlock onOpenFull={() => setCatalogOpen(true)} onScrollToCheatsheet={scrollToCheatsheet} />
      </div>

      <PyramidBlock onLayerClick={handlePyramidClick} />

      <div id="positioning"><PositioningBlock /></div>
      <AudienceBlock />
      <div id="benefits"><BenefitsBlock /></div>
      <div id="values"><ValuesBlock /></div>
      <div ref={cheatsheetRef} id="character"><CharacterBlock /></div>
      <AttributesBlock onOpenCatalog={() => setCatalogOpen(true)} />

      {/* Modals */}
      <GlossaryModal open={glossaryOpen} onOpenChange={setGlossaryOpen} />
      <AttributesCatalogModal open={catalogOpen} onOpenChange={setCatalogOpen} />
      <PrerequisitesModal open={prerequisitesOpen} onOpenChange={setPrerequisitesOpen} />
      <UsageGuideModal open={guideOpen} onOpenChange={setGuideOpen} />
    </div>
  );
}
