import { useState } from "react";
import { X, FolderOpen, Building, Users, Briefcase, Target, Plus, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SectionType, SECTION_TYPE_LABELS } from "@/hooks/useProtocolSections";
import { useCreateProject, useProjects } from "@/hooks/useProjects";
import { toast } from "sonner";

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
  const [isCreatingProject, setIsCreatingProject] = useState(false);
  const [newProjectName, setNewProjectName] = useState("");
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const createProject = useCreateProject();
  const { data: allProjects = [] } = useProjects({ includeArchived: true });

  const availableProjects = projects.filter(p => !usedProjectIds.includes(p.id));

  const handleTypeSelect = (type: SectionType) => {
    setSelectedType(type);
    
    // For project type, go to project selection
    if (type === 'project') {
      setStep('details');
    } else {
      // For tender, hr, business, goals - create directly (tender now has internal company groups)
      onSelect(type, null, SECTION_TYPE_LABELS[type]);
      handleClose();
    }
  };

  const handleConfirm = () => {
    if (!selectedType) return;

    if (selectedType === 'project') {
      onSelect('project', selectedProjectId, null);
    }
    
    handleClose();
  };

  const handleCreateProject = async () => {
    if (createProject.isPending) return;
    const name = newProjectName.trim();
    if (!name) {
      toast.error("Введите название проекта");
      return;
    }
    if (allProjects.some(project => project.name.trim().toLowerCase() === name.toLowerCase())) {
      toast.error("Проект с таким названием уже существует");
      return;
    }
    try {
      const id = crypto.randomUUID();
      const project = await createProject.mutateAsync({ name, id });
      onSelect('project', project?.id ?? id, name);
      toast.success("Проект создан и добавлен в протокол");
      handleClose();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Ошибка создания проекта");
    }
  };

  const handleClose = () => {
    if (createProject.isPending) return;
    setStep('type');
    setSelectedType(null);
    setIsCreatingProject(false);
    setNewProjectName("");
    setSelectedProjectId(null);
    onClose();
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-card rounded-xl shadow-xl w-full max-w-md mx-4 max-h-[90dvh] overflow-y-auto">
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
                      {type === 'tender' && 'Компании с пунктами внутри секции'}
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
              {!isCreatingProject && <div>
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
              </div>}
              {isCreatingProject ? (
                <div className="space-y-2">
                  <label htmlFor="protocol-new-project-name" className="block text-sm font-medium text-foreground">
                    Название нового проекта
                  </label>
                  <input
                    id="protocol-new-project-name"
                    value={newProjectName}
                    onChange={(event) => setNewProjectName(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') {
                        event.preventDefault();
                        void handleCreateProject();
                      }
                    }}
                    disabled={createProject.isPending}
                    className="input-base w-full"
                    autoFocus
                  />
                </div>
              ) : (
                <Button variant="outline" className="w-full gap-2" onClick={() => setIsCreatingProject(true)}>
                  <Plus className="w-4 h-4" />
                  Новый проект
                </Button>
              )}
              <div className="flex justify-end gap-2">
                <Button variant="outline" disabled={createProject.isPending} onClick={() => isCreatingProject ? setIsCreatingProject(false) : setStep('type')}>
                  Назад
                </Button>
                <Button
                  onClick={isCreatingProject ? handleCreateProject : handleConfirm}
                  disabled={createProject.isPending || (isCreatingProject && !newProjectName.trim())}
                  className="gap-2"
                >
                  {createProject.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                  {isCreatingProject ? 'Создать и добавить' : 'Добавить'}
                </Button>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
