import { useState } from "react";
import { FolderOpen, Plus, Pencil, Check, X, Archive, ArchiveRestore, Loader2 } from "lucide-react";
import { useProjects, useCreateProject, useUpdateProject } from "@/hooks/useProjects";
import { toast } from "sonner";

interface ProjectsTabProps {
  canManage: boolean;
}

export function ProjectsTab({ canManage }: ProjectsTabProps) {
  const { data: projects = [], isLoading } = useProjects({ includeArchived: true });
  const createProject = useCreateProject();
  const updateProject = useUpdateProject();

  const [newName, setNewName] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");

  const activeProjects = projects.filter(p => !p.archived);
  const archivedProjects = projects.filter(p => p.archived);

  const handleAdd = async () => {
    const name = newName.trim();
    if (!name) return;
    if (projects.some(p => p.name.trim().toLowerCase() === name.toLowerCase())) {
      toast.error("Проект с таким названием уже существует");
      return;
    }
    try {
      await createProject.mutateAsync({ name });
      setNewName("");
      toast.success("Проект добавлен");
    } catch (error) {
      toast.error("Ошибка добавления проекта");
    }
  };

  const handleStartEdit = (id: string, currentName: string) => {
    setEditingId(id);
    setEditingName(currentName);
  };

  const handleSaveEdit = async () => {
    if (!editingId) return;
    const name = editingName.trim();
    if (!name) return;
    if (projects.some(p => p.id !== editingId && p.name.trim().toLowerCase() === name.toLowerCase())) {
      toast.error("Проект с таким названием уже существует");
      return;
    }
    try {
      await updateProject.mutateAsync({ id: editingId, name });
      setEditingId(null);
      toast.success("Проект переименован");
    } catch (error) {
      toast.error("Ошибка переименования проекта");
    }
  };

  const handleToggleArchive = async (id: string, archived: boolean) => {
    try {
      await updateProject.mutateAsync({ id, archived: !archived });
      toast.success(archived ? "Проект восстановлен" : "Проект архивирован");
    } catch (error) {
      toast.error("Ошибка обновления проекта");
    }
  };

  if (isLoading) {
    return <div className="text-center py-12 text-muted-foreground">Загрузка...</div>;
  }

  const renderProject = (project: { id: string; name: string; archived: boolean }) => (
    <div
      key={project.id}
      className="card-base flex items-center gap-2 p-3"
    >
      <FolderOpen className={`w-4 h-4 shrink-0 ${project.archived ? 'text-muted-foreground' : 'text-primary'}`} />
      {editingId === project.id ? (
        <>
          <input
            type="text"
            value={editingName}
            onChange={(e) => setEditingName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleSaveEdit();
              if (e.key === 'Escape') setEditingId(null);
            }}
            className="input-base flex-1"
            autoFocus
          />
          <button
            onClick={handleSaveEdit}
            disabled={updateProject.isPending}
            className="p-1.5 text-green-600 hover:bg-green-500/10 rounded transition-colors"
            title="Сохранить"
          >
            <Check className="w-4 h-4" />
          </button>
          <button
            onClick={() => setEditingId(null)}
            className="p-1.5 text-muted-foreground hover:bg-secondary rounded transition-colors"
            title="Отмена"
          >
            <X className="w-4 h-4" />
          </button>
        </>
      ) : (
        <>
          <span className={`flex-1 font-medium ${project.archived ? 'text-muted-foreground line-through' : 'text-foreground'}`}>
            {project.name}
          </span>
          {canManage && (
            <>
              <button
                onClick={() => handleStartEdit(project.id, project.name)}
                className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-secondary rounded transition-colors"
                title="Переименовать"
              >
                <Pencil className="w-4 h-4" />
              </button>
              <button
                onClick={() => handleToggleArchive(project.id, project.archived)}
                disabled={updateProject.isPending}
                className={`p-1.5 rounded transition-colors ${
                  project.archived
                    ? 'text-green-600 hover:bg-green-500/10'
                    : 'text-muted-foreground hover:text-amber-600 hover:bg-amber-500/10'
                }`}
                title={project.archived ? "Восстановить из архива" : "Архивировать"}
              >
                {project.archived ? <ArchiveRestore className="w-4 h-4" /> : <Archive className="w-4 h-4" />}
              </button>
            </>
          )}
        </>
      )}
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm md:text-base text-muted-foreground">
          Проектов: {activeProjects.length}
        </p>
      </div>

      {canManage && (
        <div className="card-base p-4 flex items-center gap-2">
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
            placeholder="Название нового проекта"
            className="input-base flex-1"
          />
          <button
            onClick={handleAdd}
            disabled={createProject.isPending || !newName.trim()}
            className="btn-primary h-10 px-4 flex items-center gap-2 text-sm"
          >
            {createProject.isPending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Plus className="w-4 h-4" />
            )}
            Добавить
          </button>
        </div>
      )}

      {activeProjects.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">Нет активных проектов</div>
      ) : (
        <div className="space-y-2">
          {activeProjects.map(renderProject)}
        </div>
      )}

      {archivedProjects.length > 0 && (
        <details className="mt-6">
          <summary className="cursor-pointer text-sm text-muted-foreground hover:text-foreground flex items-center gap-2">
            <Archive className="w-4 h-4" />
            Архивные проекты ({archivedProjects.length})
          </summary>
          <div className="mt-3 space-y-2 opacity-70">
            {archivedProjects.map(renderProject)}
          </div>
        </details>
      )}
    </div>
  );
}
