import { useState, useEffect, useMemo, useCallback } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { ArrowLeft, Plus, Loader2, Save, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ProtocolMetadata } from "@/components/protocols/ProtocolMetadata";
import { ProjectSection } from "@/components/protocols/ProjectSection";
import { ProtocolItemData } from "@/components/protocols/ProtocolItemEditor";
import {
  useProtocols,
  useProtocolItems,
  useCreateProtocol,
  useUpdateProtocol,
  useCreateProtocolItem,
  useDeleteProtocolItem,
  useUpdateProtocolItem,
  useNextProtocolNumber,
} from "@/hooks/useProtocols";
import { useProjects } from "@/hooks/useProjects";
import { useEmployees } from "@/hooks/useEmployees";
import { useCreateTask, useUpdateTask } from "@/hooks/useTasks";
import { generateProtocolPdf } from "@/utils/protocolPdf";
import { toast } from "sonner";

interface ProjectGroup {
  projectId: string | null;
  defaultResponsible: string | null;
  items: ProtocolItemData[];
}

export default function ProtocolEditor() {
  const navigate = useNavigate();
  const { id } = useParams<{ id?: string }>();
  const [searchParams] = useSearchParams();
  const copyFromId = searchParams.get("copy");

  const isNew = !id || id === "new";
  const isEditMode = !!id && id !== "new";
  const isCopyMode = isNew && !!copyFromId;

  // Data hooks
  const { data: protocols = [], isLoading: protocolsLoading } = useProtocols();
  const { data: projects = [] } = useProjects();
  const { data: employees = [], isLoading: employeesLoading } = useEmployees();
  const { data: nextNumber = 1 } = useNextProtocolNumber();
  const createProtocol = useCreateProtocol();
  const updateProtocol = useUpdateProtocol();
  const createProtocolItem = useCreateProtocolItem();
  const deleteProtocolItem = useDeleteProtocolItem();
  const updateProtocolItem = useUpdateProtocolItem();
  const createTask = useCreateTask();
  const updateTask = useUpdateTask();

  // Existing protocol data
  const existingProtocol = isEditMode ? protocols.find(p => p.id === id) : null;
  const { data: existingItems = [], isLoading: existingItemsLoading } = useProtocolItems(isEditMode ? id : null);

  // Source protocol for copy mode
  const sourceProtocol = isCopyMode ? protocols.find(p => p.id === copyFromId) : null;
  const { data: sourceItems = [], isLoading: sourceItemsLoading } = useProtocolItems(isCopyMode ? copyFromId : null);

  // Loading states
  const isCopyDataLoading = isCopyMode && (protocolsLoading || employeesLoading || sourceItemsLoading || !sourceProtocol);
  const isEditDataLoading = isEditMode && (protocolsLoading || employeesLoading || existingItemsLoading);

  // Form state
  const [form, setForm] = useState({
    date: new Date().toISOString().slice(0, 10),
    title: "",
    organizer_id: "",
    attendee_ids: [] as string[],
  });

  // Project groups with items (unified state for both new and edit modes)
  const [projectGroups, setProjectGroups] = useState<ProjectGroup[]>([
    { projectId: null, defaultResponsible: null, items: [] }
  ]);

  const [copyApplied, setCopyApplied] = useState(false);
  const [editInitialized, setEditInitialized] = useState(false);

  // Helper to generate temp IDs
  const generateTempId = () => `temp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

  // Get employee IDs from responsible string
  const getEmployeeIdsFromResponsible = useCallback((responsible: string | null): string[] => {
    if (!responsible) return [];
    const names = responsible.split(", ").map(n => n.trim());
    return names
      .map(name => employees.find(e => e.full_name === name)?.id)
      .filter(Boolean) as string[];
  }, [employees]);

  // Initialize for edit mode
  useEffect(() => {
    if (isEditMode && existingProtocol && !editInitialized && employees.length > 0 && !existingItemsLoading) {
      const organizerEmployee = existingProtocol.organizer
        ? employees.find((e) => e.full_name === existingProtocol.organizer)
        : null;

      const attendeeIds = (existingProtocol.attendees || [])
        .map((name) => employees.find((e) => e.full_name === name)?.id)
        .filter(Boolean) as string[];

      setForm({
        date: existingProtocol.date,
        title: existingProtocol.title,
        organizer_id: organizerEmployee?.id || "",
        attendee_ids: attendeeIds,
      });

      // Group existing items by project
      const groups: Record<string, ProtocolItemData[]> = {};
      existingItems.forEach(item => {
        const key = item.project_id || "no_project";
        if (!groups[key]) groups[key] = [];
        groups[key].push({
          id: item.id,
          project_id: item.project_id,
          item_text: item.item_text,
          responsible: item.responsible,
          due_date: item.due_date,
          create_task: item.create_task,
          task_id: item.task_id,
        });
      });

      const projectGroupsList: ProjectGroup[] = Object.entries(groups).map(([key, items]) => ({
        projectId: key === "no_project" ? null : key,
        defaultResponsible: null,
        items: items.sort((a, b) => existingItems.findIndex(i => i.id === a.id) - existingItems.findIndex(i => i.id === b.id)),
      }));

      if (projectGroupsList.length === 0) {
        projectGroupsList.push({ projectId: null, defaultResponsible: null, items: [] });
      }

      setProjectGroups(projectGroupsList);
      setEditInitialized(true);
    }
  }, [isEditMode, existingProtocol, employees, editInitialized, existingItems, existingItemsLoading]);

  // Initialize for copy mode
  useEffect(() => {
    if (isCopyMode && sourceProtocol && !copyApplied && employees.length > 0 && !sourceItemsLoading) {
      const organizerEmployee = sourceProtocol.organizer
        ? employees.find((e) => e.full_name === sourceProtocol.organizer)
        : null;

      const attendeeIds = (sourceProtocol.attendees || [])
        .map((name) => employees.find((e) => e.full_name === name)?.id)
        .filter(Boolean) as string[];

      setForm({
        date: new Date().toISOString().slice(0, 10),
        title: sourceProtocol.title,
        organizer_id: organizerEmployee?.id || "",
        attendee_ids: attendeeIds,
      });

      // Group source items by project
      const groups: Record<string, ProtocolItemData[]> = {};
      sourceItems.forEach((item, index) => {
        const key = item.project_id || "no_project";
        if (!groups[key]) groups[key] = [];
        groups[key].push({
          id: generateTempId(),
          project_id: item.project_id,
          item_text: item.item_text,
          responsible: item.responsible,
          due_date: item.due_date,
          create_task: false, // Don't auto-create tasks for copied items
        });
      });

      const projectGroupsList: ProjectGroup[] = Object.entries(groups).map(([key, items]) => ({
        projectId: key === "no_project" ? null : key,
        defaultResponsible: null,
        items,
      }));

      if (projectGroupsList.length === 0) {
        projectGroupsList.push({ projectId: null, defaultResponsible: null, items: [] });
      }

      setProjectGroups(projectGroupsList);
      setCopyApplied(true);
    }
  }, [isCopyMode, sourceProtocol, sourceItems, employees, copyApplied, sourceItemsLoading]);

  // Helper functions
  const getProjectName = (projectId: string | null) => {
    if (!projectId) return "Без проекта (общие вопросы)";
    return projects.find((p) => p.id === projectId)?.name || "Неизвестный проект";
  };

  const handleAddProject = () => {
    // Find first project not yet added
    const usedProjectIds = projectGroups.map(g => g.projectId);
    const availableProject = projects.find(p => !usedProjectIds.includes(p.id));
    
    setProjectGroups(prev => [...prev, {
      projectId: availableProject?.id || null,
      defaultResponsible: null,
      items: [],
    }]);
  };

  const handleChangeProjectResponsible = (groupIndex: number, responsible: string | null) => {
    setProjectGroups(prev => prev.map((g, idx) => 
      idx === groupIndex ? { ...g, defaultResponsible: responsible } : g
    ));
  };

  const handleRemoveProjectSection = (index: number) => {
    setProjectGroups(prev => prev.filter((_, i) => i !== index));
  };

  const handleChangeProject = (index: number, newProjectId: string | null) => {
    setProjectGroups(prev => prev.map((group, i) => 
      i === index ? { ...group, projectId: newProjectId } : group
    ));
  };

  const handleAddItemToProject = (groupIndex: number) => {
    const group = projectGroups[groupIndex];
    const newItem: ProtocolItemData = {
      id: generateTempId(),
      project_id: group.projectId,
      item_text: "",
      responsible: null,
      due_date: null,
      create_task: false,
    };
    setProjectGroups(prev => prev.map((g, i) =>
      i === groupIndex ? { ...g, items: [...g.items, newItem] } : g
    ));
  };

  const handleUpdateItem = (groupIndex: number, itemId: string, updates: Partial<ProtocolItemData>) => {
    setProjectGroups(prev => prev.map((g, i) =>
      i === groupIndex
        ? {
            ...g,
            items: g.items.map(item =>
              item.id === itemId ? { ...item, ...updates } : item
            ),
          }
        : g
    ));
  };

  const handleRemoveItem = async (groupIndex: number, itemId: string) => {
    // For edit mode, also delete from DB if it's a real item
    if (isEditMode && !itemId.startsWith("temp-")) {
      try {
        await deleteProtocolItem.mutateAsync({ id: itemId, protocol_id: id! });
      } catch (error) {
        toast.error("Ошибка удаления пункта");
        return;
      }
    }
    
    setProjectGroups(prev => prev.map((g, i) =>
      i === groupIndex
        ? { ...g, items: g.items.filter(item => item.id !== itemId) }
        : g
    ));
  };

  // Save handlers
  const handleCreate = async () => {
    if (!form.title.trim()) {
      toast.error("Введите тему совещания");
      return;
    }

    const organizerName = form.organizer_id
      ? employees.find((e) => e.id === form.organizer_id)?.full_name || null
      : null;
    const attendeeNames = form.attendee_ids
      .map((id) => employees.find((e) => e.id === id)?.full_name)
      .filter(Boolean) as string[];

    try {
      const result = await createProtocol.mutateAsync({
        number: nextNumber,
        date: form.date,
        title: form.title,
        organizer: organizerName,
        meeting_type: form.title,
        attendees: attendeeNames,
      });

      // Create all items
      let sortOrder = 0;
      for (const group of projectGroups) {
        for (const item of group.items) {
          if (!item.item_text.trim()) continue;

          // Use project default responsible if item has none
          const effectiveResponsible = item.responsible ?? group.defaultResponsible;

          const createdItem = await createProtocolItem.mutateAsync({
            protocol_id: result.id,
            project_id: group.projectId,
            item_text: item.item_text,
            responsible: effectiveResponsible,
            due_date: item.due_date,
            create_task: item.create_task,
            sort_order: sortOrder++,
          });

          // Create task if needed
          if (item.create_task) {
            const responsibleIds = getEmployeeIdsFromResponsible(effectiveResponsible);
            const firstEmployee = responsibleIds[0] ? employees.find(e => e.id === responsibleIds[0]) : null;
            const assigneeProfileId = firstEmployee?.profile_id || null;

            const taskResult = await createTask.mutateAsync({
              title: item.item_text,
              assignee_id: assigneeProfileId,
              project_id: group.projectId,
              due_date: item.due_date || null,
              status: "new",
              priority: "normal",
            });

            // Link task to protocol item
            await updateProtocolItem.mutateAsync({
              id: createdItem.id,
              protocol_id: result.id,
              task_id: taskResult.id,
            });
          }
        }
      }

      toast.success(isCopyMode ? "Протокол скопирован" : "Протокол создан");
      navigate(`/protocols/edit/${result.id}`);
    } catch (error) {
      toast.error("Ошибка при создании протокола");
    }
  };

  const handleSaveChanges = async () => {
    if (!id || !form.title.trim()) {
      toast.error("Введите тему совещания");
      return;
    }

    const organizerName = form.organizer_id
      ? employees.find((e) => e.id === form.organizer_id)?.full_name || null
      : null;
    const attendeeNames = form.attendee_ids
      .map((empId) => employees.find((e) => e.id === empId)?.full_name)
      .filter(Boolean) as string[];

    try {
      // Update protocol metadata
      await updateProtocol.mutateAsync({
        id,
        date: form.date,
        title: form.title,
        organizer: organizerName,
        meeting_type: form.title,
        attendees: attendeeNames,
      });

      // Sync items
      let sortOrder = 0;
      for (const group of projectGroups) {
        for (const item of group.items) {
          if (!item.item_text.trim()) continue;

          // Use project default responsible if item has none
          const effectiveResponsible = item.responsible ?? group.defaultResponsible;

          if (item.id.startsWith("temp-")) {
            // Create new item
            const createdItem = await createProtocolItem.mutateAsync({
              protocol_id: id,
              project_id: group.projectId,
              item_text: item.item_text,
              responsible: effectiveResponsible,
              due_date: item.due_date,
              create_task: item.create_task,
              sort_order: sortOrder++,
            });

            // Create task if needed
            if (item.create_task) {
              const responsibleIds = getEmployeeIdsFromResponsible(effectiveResponsible);
              const firstEmployee = responsibleIds[0] ? employees.find(e => e.id === responsibleIds[0]) : null;
              const assigneeProfileId = firstEmployee?.profile_id || null;

              const taskResult = await createTask.mutateAsync({
                title: item.item_text,
                assignee_id: assigneeProfileId,
                project_id: group.projectId,
                due_date: item.due_date || null,
                status: "new",
                priority: "normal",
              });

              await updateProtocolItem.mutateAsync({
                id: createdItem.id,
                protocol_id: id,
                task_id: taskResult.id,
              });
            }
          } else {
            // Update existing item
            await updateProtocolItem.mutateAsync({
              id: item.id,
              protocol_id: id,
              item_text: item.item_text,
              responsible: effectiveResponsible,
              due_date: item.due_date,
            });

            // Update linked task if exists
            if (item.task_id) {
              const responsibleIds = getEmployeeIdsFromResponsible(effectiveResponsible);
              const firstEmployee = responsibleIds[0] ? employees.find(e => e.id === responsibleIds[0]) : null;
              const assigneeProfileId = firstEmployee?.profile_id || null;

              await updateTask.mutateAsync({
                id: item.task_id,
                title: item.item_text,
                assignee_id: assigneeProfileId,
                due_date: item.due_date || null,
              });
            }
          }
          sortOrder++;
        }
      }

      toast.success("Протокол сохранён");
    } catch (error) {
      toast.error("Ошибка при сохранении");
    }
  };

  const handleExportPdf = async () => {
    if (!existingProtocol) return;
    try {
      await generateProtocolPdf(existingProtocol, existingItems, projects);
      toast.success("PDF экспортирован");
    } catch (error) {
      toast.error("Ошибка экспорта PDF");
    }
  };

  // Computed
  const pageTitle = isEditMode
    ? `Протокол №${existingProtocol?.number || ""}`
    : isCopyMode
    ? "Копирование протокола"
    : "Новый протокол";

  const totalItems = projectGroups.reduce((sum, g) => sum + g.items.length, 0);
  const isLoading = isCopyDataLoading || isEditDataLoading;
  const isSaving = createProtocol.isPending || updateProtocol.isPending;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-background border-b border-border">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate("/protocols")}
              className="p-2 hover:bg-secondary rounded-lg transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <h1 className="text-xl font-semibold text-foreground">{pageTitle}</h1>
          </div>
          <div className="flex items-center gap-2">
            {isEditMode && (
              <Button
                onClick={handleExportPdf}
                variant="outline"
                size="sm"
                className="gap-2"
              >
                <Download className="w-4 h-4" />
                <span className="hidden sm:inline">PDF</span>
              </Button>
            )}
            <Button
              onClick={isEditMode ? handleSaveChanges : handleCreate}
              disabled={isSaving || !form.title.trim()}
              className="gap-2"
            >
              <Save className="w-4 h-4" />
              {isSaving ? "Сохранение..." : "Сохранить"}
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        {/* Loading state */}
        {isLoading && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
            <span className="ml-3 text-muted-foreground">Загрузка...</span>
          </div>
        )}

        {!isLoading && (
          <>
            {/* Protocol metadata (collapsible) */}
            <ProtocolMetadata
              form={form}
              onChange={(updates) => setForm(prev => ({ ...prev, ...updates }))}
              employees={employees}
              protocolNumber={isEditMode ? existingProtocol?.number || nextNumber : nextNumber}
              isEditMode={isEditMode}
              defaultCollapsed={isEditMode}
            />

            {/* Project sections */}
            <section className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-medium text-foreground">
                  Пункты протокола ({totalItems})
                </h2>
                <Button
                  onClick={handleAddProject}
                  variant="outline"
                  size="sm"
                  className="gap-2"
                >
                  <Plus className="w-4 h-4" />
                  Добавить проект
                </Button>
              </div>

              {projectGroups.map((group, index) => (
                <ProjectSection
                  key={`${group.projectId}-${index}`}
                  projectId={group.projectId}
                  projectName={getProjectName(group.projectId)}
                  items={group.items}
                  employees={employees}
                  projects={projects}
                  defaultResponsible={group.defaultResponsible}
                  onChangeDefaultResponsible={(responsible) => handleChangeProjectResponsible(index, responsible)}
                  onUpdateItem={(itemId, updates) => handleUpdateItem(index, itemId, updates)}
                  onRemoveItem={(itemId) => handleRemoveItem(index, itemId)}
                  onAddItem={() => handleAddItemToProject(index)}
                  onChangeProject={(newProjectId) => handleChangeProject(index, newProjectId)}
                  onRemoveSection={projectGroups.length > 1 ? () => handleRemoveProjectSection(index) : undefined}
                  canChangeProject={!isEditMode || group.items.every(i => i.id.startsWith("temp-"))}
                />
              ))}
            </section>

            {/* Bottom save button */}
            <div className="pt-4 flex justify-center border-t border-border">
              <Button
                onClick={isEditMode ? handleSaveChanges : handleCreate}
                size="lg"
                disabled={isSaving || !form.title.trim()}
                className="gap-2 text-base font-semibold px-8"
              >
                <Save className="w-5 h-5" />
                {isSaving ? "Сохранение..." : "Сохранить протокол"}
              </Button>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
