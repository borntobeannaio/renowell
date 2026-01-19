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
import { SortableContext, verticalListSortingStrategy, arrayMove } from "@dnd-kit/sortable";
import { Button } from "@/components/ui/button";
import { ProtocolMetadata } from "@/components/protocols/ProtocolMetadata";
import { UniversalSection } from "@/components/protocols/UniversalSection";
import { TenderSection } from "@/components/protocols/TenderSection";
import { ProtocolItemData, ProtocolItemEditor } from "@/components/protocols/ProtocolItemEditor";
import { GoalItemData, GoalItemEditor } from "@/components/protocols/GoalItemEditor";
import { SectionTypeModal } from "@/components/protocols/SectionTypeModal";
import { SortableProtocolSection } from "@/components/protocols/SortableProtocolSection";
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

// Company group for tenders
interface CompanyGroup {
  id: string;
  companyName: string;
  items: ProtocolItemData[];
}

interface SectionGroup {
  id: string; // section id (can be temp id)
  sectionType: SectionType;
  entityId: string | null;
  entityName: string | null;
  defaultResponsible: string | null;
  items: UniversalItemData[];
  // For tender section - company groups
  companyGroups?: CompanyGroup[];
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
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  
  // Track changes to form and sections
  const markAsChanged = useCallback(() => {
    setHasUnsavedChanges(true);
  }, []);

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
        const groups: SectionGroup[] = existingSections.map(section => {
          const sectionItems = existingItems
            .filter(item => item.section_id === section.id)
            .map(item => createItemFromDb(item, section.section_type));
          
          // For tender sections, parse [Company] prefix and build companyGroups
          if (section.section_type === 'tender') {
            const companyGroups = parseTenderItemsToGroups(sectionItems, generateTempId);
            return {
              id: section.id,
              sectionType: section.section_type,
              entityId: section.entity_id,
              entityName: section.entity_name,
              defaultResponsible: section.default_responsible,
              items: [],
              companyGroups,
            };
          }
          
          return {
            id: section.id,
            sectionType: section.section_type,
            entityId: section.entity_id,
            entityName: section.entity_name,
            defaultResponsible: section.default_responsible,
            items: sectionItems,
          };
        });
        
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
        const groups: SectionGroup[] = sourceSections.map(section => {
          const sectionItems = sourceItems
            .filter(item => item.section_id === section.id)
            .map(item => ({
              ...createItemFromDb(item, section.section_type),
              id: generateTempId(),
              create_task: false,
              task_id: null,
            }));
          
          // For tender sections, parse [Company] prefix and build companyGroups
          if (section.section_type === 'tender') {
            const companyGroups = parseTenderItemsToGroups(sectionItems, generateTempId);
            return {
              id: generateTempId(),
              sectionType: section.section_type,
              entityId: section.entity_id,
              entityName: section.entity_name,
              defaultResponsible: section.default_responsible,
              items: [],
              companyGroups,
            };
          }
          
          return {
            id: generateTempId(),
            sectionType: section.section_type,
            entityId: section.entity_id,
            entityName: section.entity_name,
            defaultResponsible: section.default_responsible,
            items: sectionItems,
          };
        });
        
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

  // Helper to parse [Company] prefix from tender items and group them
  function parseTenderItemsToGroups(items: UniversalItemData[], genId: () => string): CompanyGroup[] {
    const companyOrder: string[] = [];
    const byCompany: Record<string, ProtocolItemData[]> = {};
    
    items.forEach(item => {
      const match = item.item_text.match(/^\[([^\]]+)\]\s*(.*)$/);
      if (match) {
        const companyName = match[1].trim();
        const text = (match[2] || "").trim();
        
        if (!byCompany[companyName]) {
          byCompany[companyName] = [];
          companyOrder.push(companyName);
        }
        
        byCompany[companyName].push({
          ...item,
          item_text: text,
        } as ProtocolItemData);
      } else {
        // Item without [Company] prefix - add to "Без названия"
        const defaultCompany = "Без названия";
        if (!byCompany[defaultCompany]) {
          byCompany[defaultCompany] = [];
          companyOrder.push(defaultCompany);
        }
        byCompany[defaultCompany].push(item as ProtocolItemData);
      }
    });
    
    return companyOrder.map(companyName => ({
      id: genId(),
      companyName,
      items: byCompany[companyName],
    }));
  }

  // Helper functions
  const handleAddSection = (type: SectionType, entityId: string | null, entityName: string | null) => {
    // For tender, check if one already exists - only allow one tender section
    if (type === 'tender') {
      const hasTender = sectionGroups.some(g => g.sectionType === 'tender');
      if (hasTender) {
        toast.error("Секция тендеров уже существует. Добавьте компанию внутри неё.");
        return;
      }
    }
    
    setSectionGroups(prev => [...prev, {
      id: generateTempId(),
      sectionType: type,
      entityId,
      entityName,
      defaultResponsible: null,
      items: [],
      companyGroups: type === 'tender' ? [] : undefined,
    }]);
    markAsChanged();
  };

  const handleChangeDefaultResponsible = async (groupIndex: number, responsible: string | null) => {
    const group = sectionGroups[groupIndex];
    
    setSectionGroups(prev => prev.map((g, idx) => 
      idx === groupIndex ? { ...g, defaultResponsible: responsible } : g
    ));
    markAsChanged();

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
    markAsChanged();
  };

  const handleChangeEntity = (index: number, entityId: string | null, entityName: string | null) => {
    setSectionGroups(prev => prev.map((group, i) => 
      i === index ? { ...group, entityId, entityName } : group
    ));
    markAsChanged();
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
    markAsChanged();
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
    markAsChanged();
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
    markAsChanged();
  };

  // ===== Tender company handlers =====
  const handleAddCompany = (groupIndex: number, companyName: string) => {
    setSectionGroups(prev => prev.map((g, i) => {
      if (i !== groupIndex || g.sectionType !== 'tender') return g;
      const newCompany: CompanyGroup = {
        id: generateTempId(),
        companyName,
        items: [],
      };
      return { ...g, companyGroups: [...(g.companyGroups || []), newCompany] };
    }));
    markAsChanged();
  };

  const handleRemoveCompany = (groupIndex: number, companyId: string) => {
    setSectionGroups(prev => prev.map((g, i) => {
      if (i !== groupIndex || g.sectionType !== 'tender') return g;
      return { 
        ...g, 
        companyGroups: (g.companyGroups || []).filter(c => c.id !== companyId) 
      };
    }));
    markAsChanged();
  };

  const handleRenameCompany = (groupIndex: number, companyId: string, newName: string) => {
    setSectionGroups(prev => prev.map((g, i) => {
      if (i !== groupIndex || g.sectionType !== 'tender') return g;
      return {
        ...g,
        companyGroups: (g.companyGroups || []).map(c =>
          c.id === companyId ? { ...c, companyName: newName } : c
        ),
      };
    }));
    markAsChanged();
  };

  const handleAddTenderItem = (groupIndex: number, companyId: string) => {
    setSectionGroups(prev => prev.map((g, i) => {
      if (i !== groupIndex || g.sectionType !== 'tender') return g;
      const newItem: ProtocolItemData = {
        id: generateTempId(),
        project_id: null,
        item_text: "",
        responsible: null,
        due_date: null,
        create_task: false,
      };
      return {
        ...g,
        companyGroups: (g.companyGroups || []).map(c =>
          c.id === companyId ? { ...c, items: [...c.items, newItem] } : c
        ),
      };
    }));
    markAsChanged();
  };

  const handleUpdateTenderItem = (groupIndex: number, companyId: string, itemId: string, updates: Partial<ProtocolItemData>) => {
    setSectionGroups(prev => prev.map((g, i) => {
      if (i !== groupIndex || g.sectionType !== 'tender') return g;
      return {
        ...g,
        companyGroups: (g.companyGroups || []).map(c =>
          c.id === companyId
            ? { ...c, items: c.items.map(item => item.id === itemId ? { ...item, ...updates } : item) }
            : c
        ),
      };
    }));
    markAsChanged();
  };

  const handleRemoveTenderItem = async (groupIndex: number, companyId: string, itemId: string) => {
    // For edit mode, also delete from DB if it's a real item
    if (isEditMode && !itemId.startsWith("temp-")) {
      try {
        await deleteProtocolItem.mutateAsync({ id: itemId, protocol_id: id! });
      } catch (error) {
        toast.error("Ошибка удаления пункта");
        return;
      }
    }

    setSectionGroups(prev => prev.map((g, i) => {
      if (i !== groupIndex || g.sectionType !== 'tender') return g;
      return {
        ...g,
        companyGroups: (g.companyGroups || []).map(c =>
          c.id === companyId
            ? { ...c, items: c.items.filter(item => item.id !== itemId) }
            : c
        ),
      };
    }));
    markAsChanged();
  };

  // DnD state
  const [activeId, setActiveId] = useState<string | null>(null);
  const [activeSectionId, setActiveSectionId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  const isSectionDragId = (dragId: string) => dragId.startsWith("section-group-");

  // Find item by id across all groups
  const findItemById = (itemId: string): { item: UniversalItemData; groupIndex: number } | null => {
    for (let i = 0; i < sectionGroups.length; i++) {
      const item = sectionGroups[i].items.find((item) => item.id === itemId);
      if (item) return { item, groupIndex: i };
    }
    return null;
  };

  // Find group index by section id
  const findGroupIndexBySectionId = (sectionId: string): number => {
    const actualSectionId = sectionId.replace("section-", "");
    return sectionGroups.findIndex((g) => g.id === actualSectionId);
  };

  const handleDragStart = (event: DragStartEvent) => {
    const idStr = event.active.id as string;
    if (isSectionDragId(idStr)) {
      setActiveSectionId(idStr);
      setActiveId(null);
      return;
    }
    setActiveId(idStr);
    setActiveSectionId(null);
  };

  const handleDragOver = (event: DragOverEvent) => {
    const { active, over } = event;
    if (!over) return;

    const activeItemId = active.id as string;
    if (isSectionDragId(activeItemId)) return; // section sorting handled onDragEnd

    const overId = over.id as string;

    const activeResult = findItemById(activeItemId);
    if (!activeResult) return;

    const { groupIndex: activeGroupIndex } = activeResult;

    let overGroupIndex: number;

    if (overId.startsWith("section-")) {
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
      setSectionGroups((prev) => {
        const newGroups = [...prev];
        const activeItem = newGroups[activeGroupIndex].items.find((i) => i.id === activeItemId);
        if (!activeItem) return prev;

        newGroups[activeGroupIndex] = {
          ...newGroups[activeGroupIndex],
          items: newGroups[activeGroupIndex].items.filter((i) => i.id !== activeItemId),
        };

        const updatedItem = { ...activeItem } as any;
        if ("project_id" in updatedItem) {
          updatedItem.project_id = newGroups[overGroupIndex].entityId;
        }

        if (overId.startsWith("section-")) {
          newGroups[overGroupIndex] = {
            ...newGroups[overGroupIndex],
            items: [...newGroups[overGroupIndex].items, updatedItem],
          };
        } else {
          const overIndex = newGroups[overGroupIndex].items.findIndex((i) => i.id === overId);
          const newItems = [...newGroups[overGroupIndex].items];
          newItems.splice(Math.max(overIndex, 0), 0, updatedItem);
          newGroups[overGroupIndex] = {
            ...newGroups[overGroupIndex],
            items: newItems,
          };
        }

        return newGroups;
      });
      markAsChanged();
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    const activeDragId = active.id as string;
    const overId = over?.id as string | undefined;

    // Section reorder
    if (isSectionDragId(activeDragId)) {
      setActiveSectionId(null);
      if (!overId || !isSectionDragId(overId) || activeDragId === overId) return;

      const fromId = activeDragId.replace("section-group-", "");
      const toId = overId.replace("section-group-", "");
      const oldIndex = sectionGroups.findIndex((g) => g.id === fromId);
      const newIndex = sectionGroups.findIndex((g) => g.id === toId);
      if (oldIndex === -1 || newIndex === -1) return;

      setSectionGroups((prev) => arrayMove(prev, oldIndex, newIndex));
      markAsChanged();
      return;
    }

    // Item reorder
    setActiveId(null);

    if (!overId) return;
    if (activeDragId === overId) return;

    const activeResult = findItemById(activeDragId);
    if (!activeResult) return;

    const { groupIndex } = activeResult;

    if (!overId.startsWith("section-")) {
      const overResult = findItemById(overId);
      if (overResult && overResult.groupIndex === groupIndex) {
        setSectionGroups((prev) => {
          const newGroups = [...prev];
          const group = newGroups[groupIndex];
          const oldIndex = group.items.findIndex((i) => i.id === activeDragId);
          const newIndex = group.items.findIndex((i) => i.id === overId);

          if (oldIndex !== -1 && newIndex !== -1) {
            const newItems = arrayMove(group.items, oldIndex, newIndex);
            newGroups[groupIndex] = {
              ...group,
              items: newItems,
            };
          }

          return newGroups;
        });
        markAsChanged();
      }
    }
  };

  const activeItem = activeId ? findItemById(activeId)?.item : null;
  const activeGroupIndex = activeId ? findItemById(activeId)?.groupIndex : null;


  // Save handlers
  const [isSavingAll, setIsSavingAll] = useState(false);

  const cloneGroups = (groups: SectionGroup[]): SectionGroup[] =>
    groups.map((g) => ({
      ...g,
      items: [...g.items],
      companyGroups: g.companyGroups
        ? g.companyGroups.map((c) => ({
            ...c,
            items: [...c.items],
          }))
        : undefined,
    }));

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

    setIsSavingAll(true);
    try {
      const result = await createProtocol.mutateAsync({
        number: nextNumber,
        date: form.date,
        title: form.title,
        organizer: organizerName,
        meeting_type: form.title,
        attendees: attendeeNames,
      });

      const groupsSnapshot = cloneGroups(sectionGroups);

      // Create all sections and items
      let sortOrder = 0;
      let sectionSortOrder = 0;

      for (const group of groupsSnapshot) {
        const createdSection = await createSection.mutateAsync({
          protocol_id: result.id,
          section_type: group.sectionType,
          entity_id: group.entityId,
          entity_name: group.entityName,
          default_responsible: group.defaultResponsible,
          sort_order: sectionSortOrder++,
        });
        group.id = createdSection.id;

        if (group.sectionType === "tender" && group.companyGroups) {
          for (const company of group.companyGroups) {
            for (const item of company.items) {
              if (!item.item_text.trim()) continue;

              const effectiveResponsible = item.responsible ?? group.defaultResponsible;

              const createdItem = await createProtocolItem.mutateAsync({
                protocol_id: result.id,
                project_id: null,
                section_id: createdSection.id,
                item_text: `[${company.companyName}] ${item.item_text}`,
                responsible: effectiveResponsible,
                due_date: item.due_date,
                create_task: item.create_task,
                sort_order: sortOrder++,
                kpi: null,
                status: null,
                status_date: null,
              });

              item.id = createdItem.id;

              if (item.create_task) {
                const responsibleIds = getEmployeeIdsFromResponsible(effectiveResponsible);
                const firstEmployee = responsibleIds[0] ? employees.find((e) => e.id === responsibleIds[0]) : null;
                const assigneeProfileId = firstEmployee?.profile_id || null;

                const taskResult = await createTask.mutateAsync({
                  title: item.item_text,
                  assignee_id: assigneeProfileId,
                  project_id: null,
                  due_date: item.due_date || null,
                  status: "new",
                  priority: "normal",
                });

                await updateProtocolItem.mutateAsync({
                  id: createdItem.id,
                  protocol_id: result.id,
                  task_id: taskResult.id,
                });

                item.task_id = taskResult.id;
              }
            }
          }
        } else {
          for (const item of group.items) {
            if (!item.item_text.trim()) continue;

            const effectiveResponsible = item.responsible ?? group.defaultResponsible;
            const isGoal = group.sectionType === "goals";
            const goalItem = item as GoalItemData;

            const createdItem = await createProtocolItem.mutateAsync({
              protocol_id: result.id,
              project_id: group.sectionType === "project" ? group.entityId : null,
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

            item.id = createdItem.id;

            if (item.create_task) {
              const responsibleIds = getEmployeeIdsFromResponsible(effectiveResponsible);
              const firstEmployee = responsibleIds[0] ? employees.find((e) => e.id === responsibleIds[0]) : null;
              const assigneeProfileId = firstEmployee?.profile_id || null;

              const taskResult = await createTask.mutateAsync({
                title: item.item_text,
                assignee_id: assigneeProfileId,
                project_id: group.sectionType === "project" ? group.entityId : null,
                due_date: item.due_date || null,
                status: "new",
                priority: "normal",
              });

              await updateProtocolItem.mutateAsync({
                id: createdItem.id,
                protocol_id: result.id,
                task_id: taskResult.id,
              });

              item.task_id = taskResult.id;
            }
          }
        }
      }

      setHasUnsavedChanges(false);
      toast.success(isCopyMode ? "Протокол скопирован" : "Протокол создан");
      navigate(`/protocols/edit/${result.id}`);
    } catch (error) {
      console.error("Protocol create failed:", error);
      const message = error instanceof Error ? error.message : "Неизвестная ошибка";
      toast.error(`Ошибка при создании протокола: ${message}`);
    } finally {
      setIsSavingAll(false);
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

    setIsSavingAll(true);
    try {
      await updateProtocol.mutateAsync({
        id,
        date: form.date,
        title: form.title,
        organizer: organizerName,
        meeting_type: form.title,
        attendees: attendeeNames,
      });

      const groupsSnapshot = cloneGroups(sectionGroups);

      let sortOrder = 0;
      let sectionSortOrder = 0;

      // Helper to process items in parallel
      const processItemsInParallel = async (
        items: UniversalItemData[],
        sectionId: string,
        projectId: string | null,
        defaultResponsible: string | null,
        isGoal: boolean,
        isTender: boolean,
        companyName?: string
      ) => {
        const itemPromises = items
          .filter((item) => item.item_text.trim())
          .map(async (item, idx) => {
            const effectiveResponsible = item.responsible ?? defaultResponsible;
            const goalItem = item as GoalItemData;
            const itemText = isTender && companyName 
              ? `[${companyName}] ${item.item_text}` 
              : item.item_text;
            const currentSortOrder = sortOrder++;

            if (item.id.startsWith("temp-")) {
              // Create new item
              const createdItem = await createProtocolItem.mutateAsync({
                protocol_id: id,
                project_id: projectId,
                section_id: sectionId,
                item_text: itemText,
                responsible: effectiveResponsible,
                due_date: item.due_date,
                create_task: item.create_task,
                sort_order: currentSortOrder,
                kpi: isGoal ? goalItem.kpi : null,
                status: isGoal ? goalItem.status : null,
                status_date: isGoal ? goalItem.status_date : null,
              });

              item.id = createdItem.id;

              // Create task if needed
              if (item.create_task) {
                const responsibleIds = getEmployeeIdsFromResponsible(effectiveResponsible);
                const firstEmployee = responsibleIds[0] ? employees.find((e) => e.id === responsibleIds[0]) : null;
                const assigneeProfileId = firstEmployee?.profile_id || null;

                const taskResult = await createTask.mutateAsync({
                  title: item.item_text,
                  assignee_id: assigneeProfileId,
                  project_id: projectId,
                  due_date: item.due_date || null,
                  status: "new",
                  priority: "normal",
                });

                await updateProtocolItem.mutateAsync({
                  id: createdItem.id,
                  protocol_id: id,
                  task_id: taskResult.id,
                });

                item.task_id = taskResult.id;
              }
            } else {
              // Update existing item
              await updateProtocolItem.mutateAsync({
                id: item.id,
                protocol_id: id,
                project_id: projectId,
                section_id: sectionId,
                item_text: itemText,
                responsible: effectiveResponsible,
                due_date: item.due_date,
                create_task: item.create_task,
                kpi: isGoal ? goalItem.kpi : null,
                status: isGoal ? goalItem.status : null,
                status_date: isGoal ? goalItem.status_date : null,
                sort_order: currentSortOrder,
              });

              // Create task if checkbox was set and no task exists yet
              if (item.create_task && !item.task_id) {
                const responsibleIds = getEmployeeIdsFromResponsible(effectiveResponsible);
                const firstEmployee = responsibleIds[0] ? employees.find((e) => e.id === responsibleIds[0]) : null;
                const assigneeProfileId = firstEmployee?.profile_id || null;

                const taskResult = await createTask.mutateAsync({
                  title: item.item_text,
                  assignee_id: assigneeProfileId,
                  project_id: projectId,
                  due_date: item.due_date || null,
                  status: "new",
                  priority: "normal",
                });

                await updateProtocolItem.mutateAsync({
                  id: item.id,
                  protocol_id: id,
                  task_id: taskResult.id,
                });

                item.task_id = taskResult.id;
                toast.success(`Задача "${item.item_text}" создана на канбан`);
              } else if (item.task_id) {
                // Update existing task
                const responsibleIds = getEmployeeIdsFromResponsible(effectiveResponsible);
                const firstEmployee = responsibleIds[0] ? employees.find((e) => e.id === responsibleIds[0]) : null;
                const assigneeProfileId = firstEmployee?.profile_id || null;

                await updateTask.mutateAsync({
                  id: item.task_id,
                  title: item.item_text,
                  assignee_id: assigneeProfileId,
                  due_date: item.due_date || null,
                });
              }
            }
          });

        await Promise.all(itemPromises);
      };

      // Process sections - sections need to be sequential (need IDs), but items within can be parallel
      for (const group of groupsSnapshot) {
        // Create section if it's new
        let sectionId = group.id;
        if (group.id.startsWith("temp-")) {
          const createdSection = await createSection.mutateAsync({
            protocol_id: id,
            section_type: group.sectionType,
            entity_id: group.entityId,
            entity_name: group.entityName,
            default_responsible: group.defaultResponsible,
            sort_order: sectionSortOrder++,
          });
          sectionId = createdSection.id;
          group.id = createdSection.id;
        } else {
          await updateSection.mutateAsync({
            id: group.id,
            protocol_id: id,
            entity_id: group.entityId,
            entity_name: group.entityName,
            default_responsible: group.defaultResponsible,
            sort_order: sectionSortOrder++,
          });
        }

        const projectId = group.sectionType === "project" ? group.entityId : null;
        const isGoal = group.sectionType === "goals";

        if (group.sectionType === "tender" && group.companyGroups) {
          // Process all company groups in parallel
          const companyPromises = group.companyGroups.map((company) =>
            processItemsInParallel(
              company.items,
              sectionId,
              null,
              group.defaultResponsible,
              false,
              true,
              company.companyName
            )
          );
          await Promise.all(companyPromises);
        } else {
          // Process items in parallel
          await processItemsInParallel(
            group.items,
            sectionId,
            projectId,
            group.defaultResponsible,
            isGoal,
            false
          );
        }
      }

      setSectionGroups(groupsSnapshot);
      setHasUnsavedChanges(false);
      toast.success("Протокол сохранён");
    } catch (error) {
      console.error("Protocol save failed:", error);
      const message = error instanceof Error ? error.message : "Неизвестная ошибка";
      toast.error(`Ошибка при сохранении: ${message}`);
    } finally {
      setIsSavingAll(false);
    }
  };


  const handleExportPdf = async () => {
    if (!existingProtocol) return;
    try {
      await generateProtocolPdf(existingProtocol, existingItems, projects, existingSections);
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

  const totalItems = sectionGroups.reduce((sum, g) => {
    if (g.sectionType === "tender" && g.companyGroups) {
      return sum + g.companyGroups.reduce((cs, c) => cs + c.items.length, 0);
    }
    return sum + g.items.length;
  }, 0);
  const isLoading = isCopyDataLoading || isEditDataLoading;
  const isSaving = isSavingAll;

  const usedProjectIds = sectionGroups
    .filter((g) => g.sectionType === "project" && g.entityId)
    .map((g) => g.entityId!);

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
            <Button onClick={() => setShowSectionModal(true)} variant="outline" size="sm" className="gap-2">
              <Plus className="w-4 h-4" />
              <span className="hidden sm:inline">Секция</span>
            </Button>
            {isEditMode && (
              <Button onClick={handleExportPdf} variant="outline" size="sm" className="gap-2">
                <Download className="w-4 h-4" />
                <span className="hidden sm:inline">PDF</span>
              </Button>
            )}
            <Button
              onClick={isEditMode ? handleSaveChanges : handleCreate}
              disabled={isSaving || !form.title.trim()}
              className={`gap-2 ${hasUnsavedChanges && !isSaving ? "ring-2 ring-orange-400 ring-offset-2 ring-offset-background" : ""}`}
            >
              {isSaving ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : hasUnsavedChanges ? (
                <span className="relative">
                  <Save className="w-4 h-4" />
                  <span className="absolute -top-1 -right-1 w-2 h-2 bg-orange-500 rounded-full" />
                </span>
              ) : (
                <Save className="w-4 h-4" />
              )}
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
              onChange={(updates) => {
                setForm(prev => ({ ...prev, ...updates }));
                markAsChanged();
              }}
              employees={employees}
              protocolNumber={isEditMode ? existingProtocol?.number || nextNumber : nextNumber}
              isEditMode={isEditMode}
              defaultCollapsed={isEditMode}
            />

            <section className="space-y-4">
              <h2 className="text-lg font-medium text-foreground">
                Пункты протокола ({totalItems})
              </h2>

              <DndContext
                sensors={sensors}
                collisionDetection={closestCorners}
                onDragStart={handleDragStart}
                onDragOver={handleDragOver}
                onDragEnd={handleDragEnd}
              >
                <SortableContext
                  items={sectionGroups.map((g) => `section-group-${g.id}`)}
                  strategy={verticalListSortingStrategy}
                >
                  {sectionGroups.map((group, index) => (
                    <SortableProtocolSection key={group.id} id={`section-group-${group.id}`}>
                      {({ attributes, listeners }) =>
                        group.sectionType === "tender" ? (
                          <TenderSection
                            sectionId={group.id}
                            companyGroups={group.companyGroups || []}
                            employees={employees}
                            defaultResponsible={group.defaultResponsible}
                            onChangeDefaultResponsible={(responsible) => handleChangeDefaultResponsible(index, responsible)}
                            onUpdateItem={(companyId, itemId, updates) => handleUpdateTenderItem(index, companyId, itemId, updates)}
                            onRemoveItem={(companyId, itemId) => handleRemoveTenderItem(index, companyId, itemId)}
                            onAddItem={(companyId) => handleAddTenderItem(index, companyId)}
                            onAddCompany={(companyName) => handleAddCompany(index, companyName)}
                            onRemoveCompany={(companyId) => handleRemoveCompany(index, companyId)}
                            onRenameCompany={(companyId, newName) => handleRenameCompany(index, companyId, newName)}
                            onRemoveSection={sectionGroups.length > 1 ? () => handleRemoveSection(index) : undefined}
                            dragHandle={{ attributes, listeners }}
                          />
                        ) : (
                          <UniversalSection
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
                            dragHandle={{ attributes, listeners }}
                          />
                        )
                      }
                    </SortableProtocolSection>
                  ))}
                </SortableContext>

                <DragOverlay>
                  {activeItem && activeGroupIndex !== null ? (
                    <div className="opacity-90 shadow-lg">
                      {sectionGroups[activeGroupIndex]?.sectionType === "goals" ? (
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
