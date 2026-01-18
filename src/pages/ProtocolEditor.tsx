import { useState, useEffect, useCallback } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { ArrowLeft, Plus, Loader2, Save, Download } from "lucide-react";
import {
  DndContext,
  DragEndEvent,
  DragOverEvent,
  DragStartEvent,
  DragOverlay,
  closestCorners,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { Button } from "@/components/ui/button";
import { ProtocolMetadata } from "@/components/protocols/ProtocolMetadata";
import { UniversalSection } from "@/components/protocols/UniversalSection";
import { ProtocolItemData, ProtocolItemEditor } from "@/components/protocols/ProtocolItemEditor";
import { GoalItemData, GoalItemEditor } from "@/components/protocols/GoalItemEditor";
import { SectionTypeModal } from "@/components/protocols/SectionTypeModal";
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
import {
  useProtocolSections,
  useCreateProtocolSection,
  useUpdateProtocolSection,
  useDeleteProtocolSection,
  SectionType,
  getSectionDisplayName,
} from "@/hooks/useProtocolSections";
import { useProjects } from "@/hooks/useProjects";
import { useEmployees } from "@/hooks/useEmployees";
import { useCreateTask, useUpdateTask } from "@/hooks/useTasks";
import { generateProtocolPdf } from "@/utils/protocolPdf";
import { toast } from "sonner";

// Unified item type for both regular items and goals
type UniversalItemData = ProtocolItemData | GoalItemData;

interface SectionGroup {
  id: string; // section id (can be temp id)
  sectionType: SectionType;
  entityId: string | null;
  entityName: string | null;
  defaultResponsible: string | null;
  items: UniversalItemData[];
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
  
  // Section hooks
  const createSection = useCreateProtocolSection();
  const updateSection = useUpdateProtocolSection();
  const deleteSection = useDeleteProtocolSection();

  // Existing protocol data
  const existingProtocol = isEditMode ? protocols.find(p => p.id === id) : null;
  const { data: existingItems = [], isLoading: existingItemsLoading } = useProtocolItems(isEditMode ? id : null);
  const { data: existingSections = [], isLoading: existingSectionsLoading } = useProtocolSections(isEditMode ? id : null);

  // Source protocol for copy mode
  const sourceProtocol = isCopyMode ? protocols.find(p => p.id === copyFromId) : null;
  const { data: sourceItems = [], isLoading: sourceItemsLoading } = useProtocolItems(isCopyMode ? copyFromId : null);
  const { data: sourceSections = [], isLoading: sourceSectionsLoading } = useProtocolSections(isCopyMode ? copyFromId : null);

  // Loading states
  const isCopyDataLoading = isCopyMode && (protocolsLoading || employeesLoading || sourceItemsLoading || sourceSectionsLoading || !sourceProtocol);
  const isEditDataLoading = isEditMode && (protocolsLoading || employeesLoading || existingItemsLoading || existingSectionsLoading);

  // Form state
  const [form, setForm] = useState({
    date: new Date().toISOString().slice(0, 10),
    title: "",
    organizer_id: "",
    attendee_ids: [] as string[],
  });

  // Section groups with items (unified state for both new and edit modes)
  const [sectionGroups, setSectionGroups] = useState<SectionGroup[]>([
    { id: 'temp-default', sectionType: 'project', entityId: null, entityName: null, defaultResponsible: null, items: [] }
  ]);

  const [copyApplied, setCopyApplied] = useState(false);
  const [editInitialized, setEditInitialized] = useState(false);
  const [showSectionModal, setShowSectionModal] = useState(false);

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
    if (isEditMode && existingProtocol && !editInitialized && employees.length > 0 && !existingItemsLoading && !existingSectionsLoading) {
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

      // Build section groups from sections and items
      if (existingSections.length > 0) {
        const groups: SectionGroup[] = existingSections.map(section => ({
          id: section.id,
          sectionType: section.section_type,
          entityId: section.entity_id,
          entityName: section.entity_name,
          defaultResponsible: section.default_responsible,
          items: existingItems
            .filter(item => item.section_id === section.id)
            .map(item => createItemFromDb(item, section.section_type)),
        }));
        
        if (groups.length === 0) {
          groups.push({ id: 'temp-default', sectionType: 'project', entityId: null, entityName: null, defaultResponsible: null, items: [] });
        }
        
        setSectionGroups(groups);
      } else {
        // Legacy: group by project_id for old protocols without sections
        const groups: Record<string, UniversalItemData[]> = {};
        existingItems.forEach(item => {
          const key = item.project_id || "no_project";
          if (!groups[key]) groups[key] = [];
          groups[key].push(createItemFromDb(item, 'project'));
        });

        const sectionGroupsList: SectionGroup[] = Object.entries(groups).map(([key, items]) => ({
          id: generateTempId(),
          sectionType: 'project' as SectionType,
          entityId: key === "no_project" ? null : key,
          entityName: null,
          defaultResponsible: null,
          items: items.sort((a, b) => existingItems.findIndex(i => i.id === a.id) - existingItems.findIndex(i => i.id === b.id)),
        }));

        if (sectionGroupsList.length === 0) {
          sectionGroupsList.push({ id: 'temp-default', sectionType: 'project', entityId: null, entityName: null, defaultResponsible: null, items: [] });
        }

        setSectionGroups(sectionGroupsList);
      }
      
      setEditInitialized(true);
    }
  }, [isEditMode, existingProtocol, employees, editInitialized, existingItems, existingItemsLoading, existingSections, existingSectionsLoading]);

  // Initialize for copy mode
  useEffect(() => {
    if (isCopyMode && sourceProtocol && !copyApplied && employees.length > 0 && !sourceItemsLoading && !sourceSectionsLoading) {
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

      // Build section groups from source
      if (sourceSections.length > 0) {
        const groups: SectionGroup[] = sourceSections.map(section => ({
          id: generateTempId(),
          sectionType: section.section_type,
          entityId: section.entity_id,
          entityName: section.entity_name,
          defaultResponsible: section.default_responsible,
          items: sourceItems
            .filter(item => item.section_id === section.id)
            .map(item => ({
              ...createItemFromDb(item, section.section_type),
              id: generateTempId(),
              create_task: false,
              task_id: null,
            })),
        }));
        
        if (groups.length === 0) {
          groups.push({ id: 'temp-default', sectionType: 'project', entityId: null, entityName: null, defaultResponsible: null, items: [] });
        }
        
        setSectionGroups(groups);
      } else {
        // Legacy: group by project_id
        const groups: Record<string, UniversalItemData[]> = {};
        sourceItems.forEach(item => {
          const key = item.project_id || "no_project";
          if (!groups[key]) groups[key] = [];
          groups[key].push({
            ...createItemFromDb(item, 'project'),
            id: generateTempId(),
            create_task: false,
            task_id: null,
          });
        });

        const sectionGroupsList: SectionGroup[] = Object.entries(groups).map(([key, items]) => ({
          id: generateTempId(),
          sectionType: 'project' as SectionType,
          entityId: key === "no_project" ? null : key,
          entityName: null,
          defaultResponsible: null,
          items,
        }));

        if (sectionGroupsList.length === 0) {
          sectionGroupsList.push({ id: 'temp-default', sectionType: 'project', entityId: null, entityName: null, defaultResponsible: null, items: [] });
        }

        setSectionGroups(sectionGroupsList);
      }

      setCopyApplied(true);
    }
  }, [isCopyMode, sourceProtocol, sourceItems, employees, copyApplied, sourceItemsLoading, sourceSections, sourceSectionsLoading]);

  // Helper to create item from DB record
  function createItemFromDb(item: any, sectionType: SectionType): UniversalItemData {
    if (sectionType === 'goals') {
      return {
        id: item.id,
        section_id: item.section_id,
        item_text: item.item_text,
        responsible: item.responsible,
        due_date: item.due_date,
        kpi: item.kpi,
        status: item.status,
        status_date: item.status_date,
        create_task: item.create_task,
        task_id: item.task_id,
      } as GoalItemData;
    }
    return {
      id: item.id,
      project_id: item.project_id,
      item_text: item.item_text,
      responsible: item.responsible,
      due_date: item.due_date,
      create_task: item.create_task,
      task_id: item.task_id,
    } as ProtocolItemData;
  }

  // Helper functions
  const handleAddSection = (type: SectionType, entityId: string | null, entityName: string | null) => {
    setSectionGroups(prev => [...prev, {
      id: generateTempId(),
      sectionType: type,
      entityId,
      entityName,
      defaultResponsible: null,
      items: [],
    }]);
  };

  const handleChangeDefaultResponsible = async (groupIndex: number, responsible: string | null) => {
    const group = sectionGroups[groupIndex];
    
    setSectionGroups(prev => prev.map((g, idx) => 
      idx === groupIndex ? { ...g, defaultResponsible: responsible } : g
    ));

    // If editing and section exists in DB, update it
    if (isEditMode && id && !group.id.startsWith('temp-')) {
      try {
        await updateSection.mutateAsync({
          id: group.id,
          protocol_id: id,
          default_responsible: responsible,
        });
      } catch (error) {
        console.error('Failed to update section default responsible:', error);
      }
    }
  };

  const handleRemoveSection = async (index: number) => {
    const group = sectionGroups[index];
    
    // If editing and section exists in DB, delete it
    if (isEditMode && id && !group.id.startsWith('temp-')) {
      try {
        await deleteSection.mutateAsync({ id: group.id, protocol_id: id });
      } catch (error) {
        toast.error("Ошибка удаления секции");
        return;
      }
    }
    
    setSectionGroups(prev => prev.filter((_, i) => i !== index));
  };

  const handleChangeEntity = (index: number, entityId: string | null, entityName: string | null) => {
    setSectionGroups(prev => prev.map((group, i) => 
      i === index ? { ...group, entityId, entityName } : group
    ));
  };

  const handleAddItemToSection = (groupIndex: number) => {
    const group = sectionGroups[groupIndex];
    
    const newItem: UniversalItemData = group.sectionType === 'goals' 
      ? {
          id: generateTempId(),
          section_id: group.id,
          item_text: "",
          responsible: null,
          due_date: null,
          kpi: null,
          status: null,
          status_date: null,
          create_task: false,
        } as GoalItemData
      : {
          id: generateTempId(),
          project_id: group.entityId,
          item_text: "",
          responsible: null,
          due_date: null,
          create_task: false,
        } as ProtocolItemData;
    
    setSectionGroups(prev => prev.map((g, i) =>
      i === groupIndex ? { ...g, items: [...g.items, newItem] } : g
    ));
  };

  const handleUpdateItem = (groupIndex: number, itemId: string, updates: Partial<UniversalItemData>) => {
    setSectionGroups(prev => prev.map((g, i) =>
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
    
    setSectionGroups(prev => prev.map((g, i) =>
      i === groupIndex
        ? { ...g, items: g.items.filter(item => item.id !== itemId) }
        : g
    ));
  };

  // DnD state
  const [activeId, setActiveId] = useState<string | null>(null);
  
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  // Find item by id across all groups
  const findItemById = (itemId: string): { item: UniversalItemData; groupIndex: number } | null => {
    for (let i = 0; i < sectionGroups.length; i++) {
      const item = sectionGroups[i].items.find(item => item.id === itemId);
      if (item) return { item, groupIndex: i };
    }
    return null;
  };

  // Find group index by section id
  const findGroupIndexBySectionId = (sectionId: string): number => {
    const actualSectionId = sectionId.replace('section-', '');
    return sectionGroups.findIndex(g => g.id === actualSectionId);
  };

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragOver = (event: DragOverEvent) => {
    const { active, over } = event;
    if (!over) return;

    const activeItemId = active.id as string;
    const overId = over.id as string;

    const activeResult = findItemById(activeItemId);
    if (!activeResult) return;

    const { groupIndex: activeGroupIndex } = activeResult;
    
    let overGroupIndex: number;
    
    if (overId.startsWith('section-')) {
      overGroupIndex = findGroupIndexBySectionId(overId);
    } else {
      const overResult = findItemById(overId);
      if (!overResult) return;
      overGroupIndex = overResult.groupIndex;
    }

    // Only allow moving within same section type (can't mix goals with regular items)
    if (sectionGroups[activeGroupIndex].sectionType !== sectionGroups[overGroupIndex].sectionType) {
      return;
    }

    if (activeGroupIndex !== overGroupIndex) {
      setSectionGroups(prev => {
        const newGroups = [...prev];
        const activeItem = newGroups[activeGroupIndex].items.find(i => i.id === activeItemId);
        if (!activeItem) return prev;

        newGroups[activeGroupIndex] = {
          ...newGroups[activeGroupIndex],
          items: newGroups[activeGroupIndex].items.filter(i => i.id !== activeItemId),
        };

        const updatedItem = { ...activeItem };
        if ('project_id' in updatedItem) {
          updatedItem.project_id = newGroups[overGroupIndex].entityId;
        }

        if (overId.startsWith('section-')) {
          newGroups[overGroupIndex] = {
            ...newGroups[overGroupIndex],
            items: [...newGroups[overGroupIndex].items, updatedItem],
          };
        } else {
          const overIndex = newGroups[overGroupIndex].items.findIndex(i => i.id === overId);
          const newItems = [...newGroups[overGroupIndex].items];
          newItems.splice(overIndex, 0, updatedItem);
          newGroups[overGroupIndex] = {
            ...newGroups[overGroupIndex],
            items: newItems,
          };
        }

        return newGroups;
      });
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);

    if (!over) return;

    const activeItemId = active.id as string;
    const overId = over.id as string;

    if (activeItemId === overId) return;

    const activeResult = findItemById(activeItemId);
    if (!activeResult) return;

    const { groupIndex } = activeResult;

    if (!overId.startsWith('section-')) {
      const overResult = findItemById(overId);
      if (overResult && overResult.groupIndex === groupIndex) {
        setSectionGroups(prev => {
          const newGroups = [...prev];
          const group = newGroups[groupIndex];
          const oldIndex = group.items.findIndex(i => i.id === activeItemId);
          const newIndex = group.items.findIndex(i => i.id === overId);
          
          if (oldIndex !== -1 && newIndex !== -1) {
            const newItems = [...group.items];
            const [movedItem] = newItems.splice(oldIndex, 1);
            newItems.splice(newIndex, 0, movedItem);
            
            newGroups[groupIndex] = {
              ...group,
              items: newItems,
            };
          }
          
          return newGroups;
        });
      }
    }
  };

  const activeItem = activeId ? findItemById(activeId)?.item : null;
  const activeGroupIndex = activeId ? findItemById(activeId)?.groupIndex : null;

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
      .map((empId) => employees.find((e) => e.id === empId)?.full_name)
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

      // Create all sections and items
      let sortOrder = 0;
      let sectionSortOrder = 0;
      
      for (const group of sectionGroups) {
        // Create section in DB
        const createdSection = await createSection.mutateAsync({
          protocol_id: result.id,
          section_type: group.sectionType,
          entity_id: group.entityId,
          entity_name: group.entityName,
          default_responsible: group.defaultResponsible,
          sort_order: sectionSortOrder++,
        });

        for (const item of group.items) {
          if (!item.item_text.trim()) continue;

          const effectiveResponsible = item.responsible ?? group.defaultResponsible;
          const isGoal = group.sectionType === 'goals';
          const goalItem = item as GoalItemData;

          const createdItem = await createProtocolItem.mutateAsync({
            protocol_id: result.id,
            project_id: group.sectionType === 'project' ? group.entityId : null,
            section_id: createdSection.id,
            item_text: item.item_text,
            responsible: effectiveResponsible,
            due_date: item.due_date,
            create_task: item.create_task,
            sort_order: sortOrder++,
            kpi: isGoal ? goalItem.kpi : null,
            status: isGoal ? goalItem.status : null,
            status_date: isGoal ? goalItem.status_date : null,
          });

          if (item.create_task) {
            const responsibleIds = getEmployeeIdsFromResponsible(effectiveResponsible);
            const firstEmployee = responsibleIds[0] ? employees.find(e => e.id === responsibleIds[0]) : null;
            const assigneeProfileId = firstEmployee?.profile_id || null;

            const taskResult = await createTask.mutateAsync({
              title: item.item_text,
              assignee_id: assigneeProfileId,
              project_id: group.sectionType === 'project' ? group.entityId : null,
              due_date: item.due_date || null,
              status: "new",
              priority: "normal",
            });

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
      await updateProtocol.mutateAsync({
        id,
        date: form.date,
        title: form.title,
        organizer: organizerName,
        meeting_type: form.title,
        attendees: attendeeNames,
      });

      let sortOrder = 0;
      let sectionSortOrder = 0;
      
      for (const group of sectionGroups) {
        // Create section if it's new
        let sectionId = group.id;
        if (group.id.startsWith('temp-')) {
          const createdSection = await createSection.mutateAsync({
            protocol_id: id,
            section_type: group.sectionType,
            entity_id: group.entityId,
            entity_name: group.entityName,
            default_responsible: group.defaultResponsible,
            sort_order: sectionSortOrder++,
          });
          sectionId = createdSection.id;
        } else {
          // Update existing section
          await updateSection.mutateAsync({
            id: group.id,
            protocol_id: id,
            entity_id: group.entityId,
            entity_name: group.entityName,
            default_responsible: group.defaultResponsible,
            sort_order: sectionSortOrder++,
          });
        }

        for (const item of group.items) {
          if (!item.item_text.trim()) continue;

          const effectiveResponsible = item.responsible ?? group.defaultResponsible;
          const isGoal = group.sectionType === 'goals';
          const goalItem = item as GoalItemData;

          if (item.id.startsWith("temp-")) {
            const createdItem = await createProtocolItem.mutateAsync({
              protocol_id: id,
              project_id: group.sectionType === 'project' ? group.entityId : null,
              section_id: sectionId,
              item_text: item.item_text,
              responsible: effectiveResponsible,
              due_date: item.due_date,
              create_task: item.create_task,
              sort_order: sortOrder++,
              kpi: isGoal ? goalItem.kpi : null,
              status: isGoal ? goalItem.status : null,
              status_date: isGoal ? goalItem.status_date : null,
            });

            if (item.create_task) {
              const responsibleIds = getEmployeeIdsFromResponsible(effectiveResponsible);
              const firstEmployee = responsibleIds[0] ? employees.find(e => e.id === responsibleIds[0]) : null;
              const assigneeProfileId = firstEmployee?.profile_id || null;

              const taskResult = await createTask.mutateAsync({
                title: item.item_text,
                assignee_id: assigneeProfileId,
                project_id: group.sectionType === 'project' ? group.entityId : null,
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
            await updateProtocolItem.mutateAsync({
              id: item.id,
              protocol_id: id,
              project_id: group.sectionType === 'project' ? group.entityId : null,
              section_id: sectionId,
              item_text: item.item_text,
              responsible: effectiveResponsible,
              due_date: item.due_date,
              kpi: isGoal ? goalItem.kpi : null,
              status: isGoal ? goalItem.status : null,
              status_date: isGoal ? goalItem.status_date : null,
            });

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

  const totalItems = sectionGroups.reduce((sum, g) => sum + g.items.length, 0);
  const isLoading = isCopyDataLoading || isEditDataLoading;
  const isSaving = createProtocol.isPending || updateProtocol.isPending;

  const usedProjectIds = sectionGroups
    .filter(g => g.sectionType === 'project' && g.entityId)
    .map(g => g.entityId!);

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
              {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              {isSaving ? "Сохранение..." : "Сохранить"}
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        {isLoading && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
            <span className="ml-3 text-muted-foreground">Загрузка...</span>
          </div>
        )}

        {!isLoading && (
          <>
            <ProtocolMetadata
              form={form}
              onChange={(updates) => setForm(prev => ({ ...prev, ...updates }))}
              employees={employees}
              protocolNumber={isEditMode ? existingProtocol?.number || nextNumber : nextNumber}
              isEditMode={isEditMode}
              defaultCollapsed={isEditMode}
            />

            <section className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-medium text-foreground">
                  Пункты протокола ({totalItems})
                </h2>
                <Button
                  onClick={() => setShowSectionModal(true)}
                  variant="outline"
                  size="sm"
                  className="gap-2"
                >
                  <Plus className="w-4 h-4" />
                  Добавить секцию
                </Button>
              </div>

              <DndContext
                sensors={sensors}
                collisionDetection={closestCorners}
                onDragStart={handleDragStart}
                onDragOver={handleDragOver}
                onDragEnd={handleDragEnd}
              >
                {sectionGroups.map((group, index) => (
                  <UniversalSection
                    key={group.id}
                    sectionId={group.id}
                    sectionType={group.sectionType}
                    entityId={group.entityId}
                    entityName={group.entityName}
                    items={group.items}
                    employees={employees}
                    projects={projects}
                    defaultResponsible={group.defaultResponsible}
                    onChangeDefaultResponsible={(responsible) => handleChangeDefaultResponsible(index, responsible)}
                    onUpdateItem={(itemId, updates) => handleUpdateItem(index, itemId, updates)}
                    onRemoveItem={(itemId) => handleRemoveItem(index, itemId)}
                    onAddItem={() => handleAddItemToSection(index)}
                    onChangeEntity={(entityId, entityName) => handleChangeEntity(index, entityId, entityName)}
                    onRemoveSection={sectionGroups.length > 1 ? () => handleRemoveSection(index) : undefined}
                    canEdit={!isEditMode || group.id.startsWith("temp-")}
                  />
                ))}

                <DragOverlay>
                  {activeItem && activeGroupIndex !== null ? (
                    <div className="opacity-90 shadow-lg">
                      {sectionGroups[activeGroupIndex]?.sectionType === 'goals' ? (
                        <GoalItemEditor
                          item={activeItem as GoalItemData}
                          employees={employees}
                          projectDefaultResponsible={sectionGroups[activeGroupIndex]?.defaultResponsible ?? null}
                          onUpdate={() => {}}
                          onRemove={() => {}}
                          disabled
                        />
                      ) : (
                        <ProtocolItemEditor
                          item={activeItem as ProtocolItemData}
                          employees={employees}
                          projectDefaultResponsible={sectionGroups[activeGroupIndex]?.defaultResponsible ?? null}
                          onUpdate={() => {}}
                          onRemove={() => {}}
                          disabled
                        />
                      )}
                    </div>
                  ) : null}
                </DragOverlay>
              </DndContext>
            </section>

            <div className="pt-4 flex justify-center border-t border-border">
              <Button
                onClick={isEditMode ? handleSaveChanges : handleCreate}
                size="lg"
                disabled={isSaving || !form.title.trim()}
                className="gap-2 text-base font-semibold px-8"
              >
                {isSaving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
                {isSaving ? "Сохранение..." : "Сохранить протокол"}
              </Button>
            </div>
          </>
        )}
      </main>

      <SectionTypeModal
        open={showSectionModal}
        onClose={() => setShowSectionModal(false)}
        onSelect={handleAddSection}
        projects={projects}
        usedProjectIds={usedProjectIds}
      />
    </div>
  );
}
