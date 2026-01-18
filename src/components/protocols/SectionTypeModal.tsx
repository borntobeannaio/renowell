import { useState } from "react";
import { X, FolderOpen, Building, Users, Briefcase, Target } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SectionType, SECTION_TYPE_LABELS } from "@/hooks/useProtocolSections";

interface SectionTypeModalProps {
  open: boolean;
  onClose: () => void;
  onSelect: (type: SectionType, entityId: string | null, entityName: string | null) => void;
  projects: { id: string; name: string }[];
  usedProjectIds: string[];
}

const SECTION_ICONS: Record<SectionType, React.ReactNode> = {
  project: <FolderOpen className="w-5 h-5" />,
  tender: <Building className="w-5 h-5" />,
  hr: <Users className="w-5 h-5" />,
  business: <Briefcase className="w-5 h-5" />,
  goals: <Target className="w-5 h-5" />,
};

export function SectionTypeModal({
  open,
  onClose,
  onSelect,
  projects,
  usedProjectIds,
}: SectionTypeModalProps) {
  const [step, setStep] = useState<'type' | 'details'>('type');
  const [selectedType, setSelectedType] = useState<SectionType | null>(null);
  const [entityName, setEntityName] = useState("");
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);

  const availableProjects = projects.filter(p => !usedProjectIds.includes(p.id));

  const handleTypeSelect = (type: SectionType) => {
    setSelectedType(type);
    
    // For project type, go to project selection
    if (type === 'project') {
      setStep('details');
    } else if (type === 'tender') {
      // For tender, need company name
      setStep('details');
    } else {
      // For hr, business, goals - create directly
      onSelect(type, null, SECTION_TYPE_LABELS[type]);
      handleClose();
    }
  };

  const handleConfirm = () => {
    if (!selectedType) return;

    if (selectedType === 'project') {
      onSelect('project', selectedProjectId, null);
    } else if (selectedType === 'tender') {
      onSelect('tender', null, entityName.trim() || 'Компания');
    }
    
    handleClose();
  };

  const handleClose = () => {
    setStep('type');
    setSelectedType(null);
    setEntityName("");
    setSelectedProjectId(null);
    onClose();
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-card rounded-xl shadow-xl w-full max-w-md mx-4 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h3 className="text-lg font-semibold text-foreground">
            {step === 'type' ? 'Выберите тип секции' : 'Настройка секции'}
          </h3>
          <button
            onClick={handleClose}
            className="p-2 hover:bg-secondary rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4">
          {step === 'type' && (
            <div className="space-y-2">
              {(Object.keys(SECTION_TYPE_LABELS) as SectionType[]).map((type) => (
                <button
                  key={type}
                  onClick={() => handleTypeSelect(type)}
                  className="w-full flex items-center gap-3 p-4 rounded-lg border border-border hover:border-primary hover:bg-primary/5 transition-all text-left"
                >
                  <div className="p-2 rounded-lg bg-primary/10 text-primary">
                    {SECTION_ICONS[type]}
                  </div>
                  <div>
                    <div className="font-medium text-foreground">{SECTION_TYPE_LABELS[type]}</div>
                    <div className="text-sm text-muted-foreground">
                      {type === 'project' && 'Выбор из справочника проектов'}
                      {type === 'tender' && 'Укажите название компании'}
                      {type === 'hr' && 'Пункты по подбору персонала'}
                      {type === 'business' && 'Общие бизнес задачи'}
                      {type === 'goals' && 'Цели с KPI и статусами'}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}

          {step === 'details' && selectedType === 'project' && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Выберите проект
                </label>
                <select
                  value={selectedProjectId || ""}
                  onChange={(e) => setSelectedProjectId(e.target.value || null)}
                  className="input-base w-full"
                >
                  <option value="">Без проекта (общие вопросы)</option>
                  {availableProjects.map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
                {availableProjects.length === 0 && projects.length > 0 && (
                  <p className="text-xs text-muted-foreground mt-2">
                    Все проекты уже добавлены
                  </p>
                )}
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setStep('type')}>
                  Назад
                </Button>
                <Button onClick={handleConfirm}>
                  Добавить
                </Button>
              </div>
            </div>
          )}

          {step === 'details' && selectedType === 'tender' && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Название компании
                </label>
                <input
                  type="text"
                  value={entityName}
                  onChange={(e) => setEntityName(e.target.value)}
                  className="input-base w-full"
                  placeholder="Введите название компании"
                  autoFocus
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setStep('type')}>
                  Назад
                </Button>
                <Button onClick={handleConfirm} disabled={!entityName.trim()}>
                  Добавить
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
