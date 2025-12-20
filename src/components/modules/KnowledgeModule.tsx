import { useState } from "react";
import { useApp } from "@/context/AppContext";
import { Modal } from "@/components/ui/Modal";
import { ChevronRight, FileText, ArrowLeft } from "lucide-react";
import { KBRubric, KBDoc } from "@/types";

export function KnowledgeModule() {
  const { kbRubrics } = useApp();
  const [selectedRubric, setSelectedRubric] = useState<KBRubric | null>(null);
  const [selectedDoc, setSelectedDoc] = useState<KBDoc | null>(null);

  const handleBack = () => {
    if (selectedDoc) {
      setSelectedDoc(null);
    } else if (selectedRubric) {
      setSelectedRubric(null);
    }
  };

  const renderBreadcrumb = () => {
    if (!selectedRubric) return null;

    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground mb-4">
        <button
          onClick={() => {
            setSelectedRubric(null);
            setSelectedDoc(null);
          }}
          className="hover:text-foreground transition-colors"
        >
          База знаний
        </button>
        <ChevronRight className="w-4 h-4" />
        <button
          onClick={() => setSelectedDoc(null)}
          className={`hover:text-foreground transition-colors ${
            !selectedDoc ? "text-foreground font-medium" : ""
          }`}
        >
          {selectedRubric.title}
        </button>
        {selectedDoc && (
          <>
            <ChevronRight className="w-4 h-4" />
            <span className="text-foreground font-medium">{selectedDoc.title}</span>
          </>
        )}
      </div>
    );
  };

  // Document preview
  if (selectedDoc) {
    return (
      <div className="space-y-4">
        {renderBreadcrumb()}

        <button
          onClick={handleBack}
          className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Назад
        </button>

        <div className="card-base p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-foreground">
              {selectedDoc.title}
            </h2>
            <span className="chip">{selectedDoc.type.toUpperCase()}</span>
          </div>
          <p className="text-sm text-muted-foreground mb-6">
            Обновлено: {selectedDoc.updated}
          </p>

          <div className="prose prose-sm max-w-none">
            {selectedDoc.body.split("\n").map((line, i) => {
              if (line.startsWith("# ")) {
                return (
                  <h1 key={i} className="text-2xl font-bold text-foreground mt-6 mb-3">
                    {line.slice(2)}
                  </h1>
                );
              }
              if (line.startsWith("## ")) {
                return (
                  <h2 key={i} className="text-xl font-semibold text-foreground mt-5 mb-2">
                    {line.slice(3)}
                  </h2>
                );
              }
              if (line.startsWith("- ")) {
                return (
                  <li key={i} className="text-foreground ml-4">
                    {line.slice(2)}
                  </li>
                );
              }
              if (line.match(/^\d+\. /)) {
                return (
                  <li key={i} className="text-foreground ml-4 list-decimal">
                    {line.replace(/^\d+\. /, "")}
                  </li>
                );
              }
              if (line.trim()) {
                return (
                  <p key={i} className="text-foreground mb-3">
                    {line}
                  </p>
                );
              }
              return <br key={i} />;
            })}
          </div>
        </div>
      </div>
    );
  }

  // Documents list in rubric
  if (selectedRubric) {
    return (
      <div className="space-y-4">
        {renderBreadcrumb()}

        <button
          onClick={handleBack}
          className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Назад
        </button>

        <div className="grid gap-3">
          {selectedRubric.docs.map((doc) => (
            <button
              key={doc.id}
              onClick={() => setSelectedDoc(doc)}
              className="card-base p-4 flex items-center justify-between hover:border-primary/30 transition-colors text-left"
            >
              <div className="flex items-center gap-3">
                <FileText className="w-5 h-5 text-primary" />
                <div>
                  <p className="font-medium text-foreground">{doc.title}</p>
                  <p className="text-sm text-muted-foreground">
                    {doc.type.toUpperCase()} • Обновлено: {doc.updated}
                  </p>
                </div>
              </div>
              <ChevronRight className="w-5 h-5 text-muted-foreground" />
            </button>
          ))}

          {selectedRubric.docs.length === 0 && (
            <div className="text-center py-12 text-muted-foreground">
              Нет документов в этой рубрике
            </div>
          )}
        </div>
      </div>
    );
  }

  // Rubrics list
  return (
    <div className="space-y-4">
      <p className="text-muted-foreground">
        Выберите раздел для просмотра документов
      </p>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {kbRubrics.map((rubric) => (
          <button
            key={rubric.id}
            onClick={() => setSelectedRubric(rubric)}
            className="card-base p-6 text-left hover:border-primary/30 hover:shadow-md transition-all"
          >
            <h3 className="text-lg font-semibold text-foreground mb-2">
              {rubric.title}
            </h3>
            <p className="text-sm text-muted-foreground">
              {rubric.docs.length}{" "}
              {rubric.docs.length === 1
                ? "документ"
                : rubric.docs.length < 5
                ? "документа"
                : "документов"}
            </p>
          </button>
        ))}

        {kbRubrics.length === 0 && (
          <div className="text-center py-12 text-muted-foreground col-span-full">
            Нет рубрик
          </div>
        )}
      </div>
    </div>
  );
}
