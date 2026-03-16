import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { ArrowLeft, Plus, Loader2, Save, Download, Cloud, ChevronsUpDown, Archive, RotateCcw, History, WifiOff, Building } from "lucide-react";
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
import { AddCompanyModal } from "@/components/protocols/AddCompanyModal";
import { SortableProtocolSection } from "@/components/protocols/SortableProtocolSection";
import { DraftHistoryPanel } from "@/components/protocols/DraftHistoryPanel";
import { Modal } from "@/components/ui/Modal";
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
import { useEmployees, getEmployeeDisplayName } from "@/hooks/useEmployees";
import { useCreateTask, useUpdateTask } from "@/hooks/useTasks";
import { useFormDraft } from "@/hooks/useFormDraft";
import { useAuth } from "@/hooks/useAuth";
import { useProtocolPermissions } from "@/hooks/useProtocolPermissions";
import { DraftSnapshot } from "@/hooks/useDraftSnapshots";
import { generateProtocolPdf } from "@/utils/protocolPdf";
import { proxySelect, proxyPing } from "@/lib/dbProxy";
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
  // Section-level archive flag
  archived?: boolean;
}

// Mapping section types to project IDs for task creation
const SECTION_TYPE_PROJECT_IDS: Partial<Record<SectionType, string>> = {
  tender: "bf2ef5b4-1fe7-4e69-b533-30393a4d386b", // Тендеры/задачи
  business: "5b30ab38-7ecd-4643-960e-8dc2bf353d98", // Бизнес процессы
  hr: "620c7f0e-6558-4116-8e80-7681457127b8", // Подбор персонала
  goals: "39036f39-f9f7-4286-bc70-2c14c10824d2", // Цели компании
};

// Helper to get project ID based on section type
const getProjectIdForSection = (sectionType: SectionType, entityId: string | null): string | null => {
  if (sectionType === "project") {
    return entityId;
  }
  return SECTION_TYPE_PROJECT_IDS[sectionType] || null;
};

// Result type for parallel item processing
interface ItemProcessResult {
  success: boolean;
  itemId: string;
  itemText: string;
  newId?: string;
  taskId?: string;
  error?: Error;
}

export default function ProtocolEditor() {
  const navigate = useNavigate();
  const { id } = useParams<{ id?: string }>();
  const [searchParams] = useSearchParams();
  const copyFromId = searchParams.get("copy");
  const urlType = searchParams.get("type");

  const isNew = !id || id === "new";
  const isEditMode = !!id && id !== "new";
  const isCopyMode = isNew && !!copyFromId;

  // Auth and permissions
  const { user } = useAuth();
  const { canEditProtocols, canArchive, canViewProtocols } = useProtocolPermissions();
  
  // Redirect if user has no protocol access
  const accessDeniedShown = useRef(false);
  useEffect(() => {
    if (canViewProtocols === false && !accessDeniedShown.current) {
      accessDeniedShown.current = true;
      toast.error("Доступ к протоколам ограничён 🔒", {
        description: "У вас недостаточно прав. Напишите в чат техподдержки 💬",
        duration: 6000,
      });
      navigate('/news', { replace: true });
    }
  }, [canViewProtocols, navigate]);
  
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
  
  // Source protocol for copy mode
  const sourceProtocol = isCopyMode ? protocols.find(p => p.id === copyFromId) : null;
  
  // Detect tender mode: from URL param, existing protocol, or source protocol (copy mode)
  const isTenderMode = urlType === 'tender' || existingProtocol?.meeting_type === 'tender' || sourceProtocol?.meeting_type === 'tender';
  const { data: existingItems = [], isLoading: existingItemsLoading } = useProtocolItems(isEditMode ? id : null);
  const { data: existingSections = [], isLoading: existingSectionsLoading } = useProtocolSections(isEditMode ? id : null);

  const { data: sourceItems = [], isLoading: sourceItemsLoading } = useProtocolItems(isCopyMode ? copyFromId : null);
  const { data: sourceSections = [], isLoading: sourceSectionsLoading } = useProtocolSections(isCopyMode ? copyFromId : null);

  // Load profiles for comments
  const [profiles, setProfiles] = useState<{ id: string; first_name: string | null; last_name: string | null; avatar_url: string | null }[]>([]);
  useEffect(() => {
    proxySelect<{ id: string; first_name: string | null; last_name: string | null; avatar_url: string | null }>('profiles', {})
      .then(({ data }) => {
        if (data) setProfiles(data);
      });
  }, []);

  // Loading states
  const isCopyDataLoading = isCopyMode && (protocolsLoading || employeesLoading || sourceItemsLoading || sourceSectionsLoading || !sourceProtocol);
  const isEditDataLoading = isEditMode && (protocolsLoading || employeesLoading || existingItemsLoading || existingSectionsLoading);

  // Redirect if no permissions
  useEffect(() => {
    if (!canEditProtocols && user) {
      toast.error("У вас нет прав на редактирование протоколов");
      navigate("/protocols");
    }
  }, [canEditProtocols, user, navigate]);

  // Form state
  const [form, setForm] = useState({
    date: new Date().toISOString().slice(0, 10),
    title: "",
    organizer_id: "",
    attendee_ids: [] as string[],
  });

  // Section groups with items (unified state for both new and edit modes)
  const defaultSectionGroup: SectionGroup = isTenderMode && isNew && !isCopyMode
    ? { id: 'temp-default', sectionType: 'tender', entityId: null, entityName: 'Тендеры', defaultResponsible: null, items: [], companyGroups: [] }
    : { id: 'temp-default', sectionType: 'project', entityId: null, entityName: null, defaultResponsible: null, items: [] };
  
  const [sectionGroups, setSectionGroups] = useState<SectionGroup[]>([defaultSectionGroup]);
  
  // Tender mode: set default title and organizer when employees load
  const [tenderDefaultsApplied, setTenderDefaultsApplied] = useState(false);
  useEffect(() => {
    if (isTenderMode && isNew && !isCopyMode && !tenderDefaultsApplied && employees.length > 0) {
      const oparinEmployee = employees.find(e => 
        getEmployeeDisplayName(e).toLowerCase().includes("опарин") && getEmployeeDisplayName(e).toLowerCase().includes("андрей")
      );
      setForm(prev => ({
        ...prev,
        title: prev.title || "Тендеры",
        organizer_id: prev.organizer_id || (oparinEmployee?.id || ""),
      }));
      setTenderDefaultsApplied(true);
    }
  }, [isTenderMode, isNew, isCopyMode, tenderDefaultsApplied, employees]);

  const [copyApplied, setCopyApplied] = useState(false);
  const [editInitialized, setEditInitialized] = useState(false);
  const [showSectionModal, setShowSectionModal] = useState(false);
  const [showAddCompanyModal, setShowAddCompanyModal] = useState(false);
  const [showHistoryPanel, setShowHistoryPanel] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [allSectionsCollapsed, setAllSectionsCollapsed] = useState(false);

  const [draftRestorePrompted, setDraftRestorePrompted] = useState(false);
  
  // Connection status state
  const [connectionStatus, setConnectionStatus] = useState<'checking' | 'connected' | 'disconnected'>('checking');
  const connectionCheckRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  
  // Save progress state for UX feedback
  const [saveProgress, setSaveProgress] = useState<string | null>(null);
  
  // Ref to prevent double-submit
  const isSavingRef = useRef(false);
  
  // Connection check effect
  useEffect(() => {
    const checkConnection = async () => {
      try {
        const result = await proxyPing();
        setConnectionStatus(result.error ? 'disconnected' : 'connected');
      } catch {
        setConnectionStatus('disconnected');
      }
    };
    
    // Check immediately
    checkConnection();
    
    // Check every 30 seconds
    connectionCheckRef.current = setInterval(checkConnection, 30000);
    
    return () => {
      if (connectionCheckRef.current) {
        clearInterval(connectionCheckRef.current);
      }
    };
  }, []);
  
  // Draft auto-save hook
  const draftEntityId = isNew ? (isCopyMode ? `copy-${copyFromId}` : 'new') : id!;
  const draftData = { form, sectionGroups };
  
  const {
    isLoading: draftLoading,
    isSaving: draftSaving,
    lastSavedAt: draftLastSavedAt,
    existingDraft,
    acceptDraft,
    discardDraft,
    clearDraft,
    saveNow: saveDraftNow
  } = useFormDraft('protocol', draftEntityId, draftData, {
    autoSaveInterval: 3000,
    enabled: !!user && !isCopyDataLoading,
    saveEnabled: !!user && !isCopyDataLoading && !isEditDataLoading && (editInitialized || isNew) && (hasUnsavedChanges || isNew)
  });
  
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
      .map(name => employees.find(e => getEmployeeDisplayName(e) === name)?.id)
      .filter(Boolean) as string[];
  }, [employees]);

  // Get all profile IDs from responsible string for task assignment
  const getProfileIdsFromResponsible = useCallback((responsible: string | null): string[] => {
    if (!responsible) return [];
    const names = responsible.split(", ").map(n => n.trim());
    return names
      .map(name => employees.find(e => getEmployeeDisplayName(e) === name)?.profile_id)
      .filter(Boolean) as string[];
  }, [employees]);

  // Initialize for edit mode
  useEffect(() => {
    if (isEditMode && existingProtocol && !editInitialized && employees.length > 0 && !existingItemsLoading && !existingSectionsLoading) {
      const organizerEmployee = existingProtocol.organizer
        ? employees.find((e) => getEmployeeDisplayName(e) === existingProtocol.organizer)
        : null;

      const attendeeIds = (existingProtocol.attendees || [])
        .map((name) => employees.find((e) => getEmployeeDisplayName(e) === name)?.id)
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
              archived: section.archived || false,
            };
          }
          
          return {
            id: section.id,
            sectionType: section.section_type,
            entityId: section.entity_id,
            entityName: section.entity_name,
            defaultResponsible: section.default_responsible,
            items: sectionItems,
            archived: section.archived || false,
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
        ? employees.find((e) => getEmployeeDisplayName(e) === sourceProtocol.organizer)
        : null;

      const attendeeIds = (sourceProtocol.attendees || [])
        .map((name) => employees.find((e) => getEmployeeDisplayName(e) === name)?.id)
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
              task_id: item.task_id ?? null,
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
            // Keep task_id link when copying (don't create new tasks)
            task_id: item.task_id,
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
      markAsChanged(); // Включаем автосохранение черновика для копии
    }
  }, [isCopyMode, sourceProtocol, sourceItems, employees, copyApplied, sourceItemsLoading, sourceSections, sourceSectionsLoading, markAsChanged]);

  // Prompt to restore draft when available
  useEffect(() => {
    // Условие показа промпта восстановления:
    // - Новый протокол (не копия): сразу
    // - Копия: после применения данных источника (copyApplied)
    // - Редактирование: после инициализации (editInitialized)
    const canShowDraftRestore = 
      existingDraft && 
      !draftLoading && 
      !draftRestorePrompted && 
      !isEditDataLoading &&
      (
        (isNew && !isCopyMode) || 
        (isCopyMode && copyApplied) || 
        editInitialized
      );
    
    if (canShowDraftRestore) {
      const draftTime = new Date(existingDraft.savedAt).getTime();
      const now = Date.now();
      const maxAge = 24 * 60 * 60 * 1000; // 24 hours
      
      if (now - draftTime < maxAge) {
        const formattedDate = new Date(existingDraft.savedAt).toLocaleString('ru-RU', {
          day: 'numeric',
          month: 'short',
          hour: '2-digit',
          minute: '2-digit'
        });
        
        const restore = window.confirm(
          `Найден черновик от ${formattedDate}.\n\nВосстановить несохранённые изменения?`
        );
        
        if (restore) {
          const data = acceptDraft();
          if (data) {
            setForm(data.form);
            setSectionGroups(data.sectionGroups);
            toast.success('Черновик восстановлен');
          }
        } else {
          discardDraft();
        }
      } else {
        // Draft too old, discard silently
        discardDraft();
      }
      
      setDraftRestorePrompted(true);
    }
  }, [existingDraft, draftLoading, draftRestorePrompted, acceptDraft, discardDraft, isNew, isCopyMode, copyApplied, editInitialized, isEditDataLoading]);

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
        archived: item.archived || false,
        completed: item.completed || false,
        completed_at: item.completed_at,
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
      archived: item.archived || false,
      completed: item.completed || false,
      completed_at: item.completed_at,
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
          archived: false,
          completed: false,
        } as GoalItemData
      : {
          id: generateTempId(),
          project_id: group.entityId,
          item_text: "",
          responsible: null,
          due_date: null,
          create_task: false,
          archived: false,
          completed: false,
        } as ProtocolItemData;
    
    setSectionGroups(prev => prev.map((g, i) =>
      i === groupIndex
        ? { ...g, items: [...g.items, newItem] }
        : g
    ));
    markAsChanged();
  };

  // Persist a temp item to the database (used for auto-save on first comment)
  const handlePersistTempItem = async (groupIndex: number, itemId: string): Promise<string | null> => {
    // Only works for temp items in edit mode (protocol must exist)
    if (!itemId.startsWith("temp-")) return itemId; // Already persisted
    if (!id) {
      toast.error("Сначала сохраните протокол");
      return null;
    }

    const group = sectionGroups[groupIndex];
    const item = group.items.find(i => i.id === itemId);
    if (!item) return null;

    try {
      // For goals section
      if (group.sectionType === 'goals') {
        const goalItem = item as GoalItemData;
        
        // Ensure section is persisted first
        let sectionId = group.id;
        if (group.id.startsWith("temp-")) {
          const sectionResult = await createSection.mutateAsync({
            protocol_id: id,
            section_type: group.sectionType,
            entity_id: group.entityId,
            entity_name: group.entityName || null,
            default_responsible: group.defaultResponsible,
            sort_order: groupIndex,
          });
          sectionId = sectionResult.id;
          
          // Update local state with new section id
          setSectionGroups(prev => prev.map((g, i) =>
            i === groupIndex ? { ...g, id: sectionId } : g
          ));
        }

        const result = await createProtocolItem.mutateAsync({
          protocol_id: id,
          item_text: goalItem.item_text || "Новая цель",
          responsible: goalItem.responsible,
          due_date: goalItem.due_date,
          kpi: goalItem.kpi,
          status: goalItem.status,
          status_date: goalItem.status_date,
          section_id: sectionId,
          completed: goalItem.completed,
          completed_at: goalItem.completed_at,
        });

        const newId = result.id;

        // Update local state with new item id
        setSectionGroups(prev => prev.map((g, i) =>
          i === groupIndex
            ? { ...g, items: g.items.map(it => it.id === itemId ? { ...it, id: newId } : it) }
            : g
        ));

        return newId;
      }

      // For regular items
      const regularItem = item as ProtocolItemData;
      
      // Ensure section is persisted first
      let sectionId = group.id;
      if (group.id.startsWith("temp-")) {
        const sectionResult = await createSection.mutateAsync({
          protocol_id: id,
          section_type: group.sectionType,
          entity_id: group.entityId,
          entity_name: group.sectionType === 'tender' ? 'Тендеры' : (group.entityName || null),
          default_responsible: group.defaultResponsible,
          sort_order: groupIndex,
        });
        sectionId = sectionResult.id;
        
        // Update local state with new section id
        setSectionGroups(prev => prev.map((g, i) =>
          i === groupIndex ? { ...g, id: sectionId } : g
        ));
      }

      const result = await createProtocolItem.mutateAsync({
        protocol_id: id,
        item_text: regularItem.item_text || "Новый пункт",
        responsible: regularItem.responsible,
        due_date: regularItem.due_date,
        project_id: regularItem.project_id || group.entityId,
        section_id: sectionId,
        completed: regularItem.completed,
        completed_at: regularItem.completed_at,
      });

      const newId = result.id;

      // Update local state with new item id
      setSectionGroups(prev => prev.map((g, i) =>
        i === groupIndex
          ? { ...g, items: g.items.map(it => it.id === itemId ? { ...it, id: newId } : it) }
          : g
      ));

      return newId;
    } catch (error) {
      console.error("Failed to persist temp item:", error);
      toast.error("Ошибка сохранения пункта");
      return null;
    }
  };

  // Persist tender item
  const handlePersistTenderItem = async (groupIndex: number, companyId: string, itemId: string): Promise<string | null> => {
    if (!itemId.startsWith("temp-")) return itemId;
    if (!id) {
      toast.error("Сначала сохраните протокол");
      return null;
    }

    const group = sectionGroups[groupIndex];
    const company = group.companyGroups?.find(c => c.id === companyId);
    const item = company?.items.find(i => i.id === itemId);
    if (!item) return null;

    try {
      // Ensure section is persisted first
      let sectionId = group.id;
      if (group.id.startsWith("temp-")) {
        const sectionResult = await createSection.mutateAsync({
          protocol_id: id,
          section_type: 'tender',
          entity_id: group.entityId,
          entity_name: 'Тендеры',
          default_responsible: group.defaultResponsible,
          sort_order: groupIndex,
        });
        sectionId = sectionResult.id;
        
        setSectionGroups(prev => prev.map((g, i) =>
          i === groupIndex ? { ...g, id: sectionId } : g
        ));
      }

      const result = await createProtocolItem.mutateAsync({
        protocol_id: id,
        item_text: `[${company!.companyName}] ${item.item_text || "Новый пункт"}`,
        responsible: item.responsible,
        due_date: item.due_date,
        section_id: sectionId,
        completed: item.completed,
        completed_at: item.completed_at,
      });

      const newId = result.id;

      // Update local state
      setSectionGroups(prev => prev.map((g, i) => {
        if (i !== groupIndex) return g;
        return {
          ...g,
          companyGroups: g.companyGroups?.map(c =>
            c.id === companyId
              ? { ...c, items: c.items.map(it => it.id === itemId ? { ...it, id: newId } : it) }
              : c
          )
        };
      }));

      return newId;
    } catch (error) {
      console.error("Failed to persist tender item:", error);
      toast.error("Ошибка сохранения пункта тендера");
      return null;
    }
  };

  const handleUpdateItem = async (groupIndex: number, itemId: string, updates: Partial<UniversalItemData>) => {
    // Find the item to get task_id for syncing
    const group = sectionGroups[groupIndex];
    const item = group?.items.find(i => i.id === itemId);
    const taskId = item && 'task_id' in item ? (item as ProtocolItemData).task_id : null;

    // If completing item, also update linked task to "done"
    if (taskId && 'completed' in updates && updates.completed === true) {
      try {
        await updateTask.mutateAsync({ id: taskId, status: 'done' });
      } catch (error) {
        console.error("Failed to update linked task status:", error);
      }
    }
    // If uncompleting item, set linked task back to "in_progress"
    if (taskId && 'completed' in updates && updates.completed === false) {
      try {
        await updateTask.mutateAsync({ id: taskId, status: 'in_progress' });
      } catch (error) {
        console.error("Failed to update linked task status:", error);
      }
    }

    setSectionGroups(prev => prev.map((g, i) =>
      i === groupIndex
        ? { ...g, items: g.items.map(item => item.id === itemId ? { ...item, ...updates } : item) }
        : g
    ));
    markAsChanged();
  };

  const handleRemoveItem = async (groupIndex: number, itemId: string) => {
    // Find the item to get task_id before removing
    const group = sectionGroups[groupIndex];
    const item = group?.items.find(i => i.id === itemId);
    const taskId = item && 'task_id' in item ? (item as ProtocolItemData).task_id : null;

    // For edit mode, also delete from DB if it's a real item
    if (isEditMode && !itemId.startsWith("temp-")) {
      try {
        await deleteProtocolItem.mutateAsync({ id: itemId, protocol_id: id! });
      } catch (error) {
        toast.error("Ошибка удаления пункта");
        return;
      }
    }

    // Archive linked task if exists
    if (taskId) {
      try {
        await updateTask.mutateAsync({ id: taskId, status: 'archived' });
      } catch (error) {
        console.error("Failed to archive linked task:", error);
        // Don't block item removal if task archive fails
      }
    }
    
    setSectionGroups(prev => prev.map((g, i) =>
      i === groupIndex
        ? { ...g, items: g.items.filter(item => item.id !== itemId) }
        : g
    ));
    markAsChanged();
  };

  // Archive item handler
  const handleArchiveItem = (groupIndex: number, itemId: string) => {
    setSectionGroups(prev => prev.map((g, i) =>
      i === groupIndex
        ? { 
            ...g, 
            items: g.items.map(item => 
              item.id === itemId 
                ? { ...item, archived: !item.archived } 
                : item
            ) 
          }
        : g
    ));
    markAsChanged();
  };

  // Archive section handler - toggles archived state on the section itself
  const handleArchiveSection = (groupIndex: number) => {
    setSectionGroups(prev => prev.map((g, i) => {
      if (i !== groupIndex) return g;
      return {
        ...g,
        archived: !g.archived,
      };
    }));
    markAsChanged();
  };

  // Restore section from archive handler
  const handleRestoreSection = (groupIndex: number) => {
    setSectionGroups(prev => prev.map((g, i) => {
      if (i !== groupIndex) return g;
      return {
        ...g,
        archived: false,
      };
    }));
    markAsChanged();
  };

  // Move items to another section handler
  const handleMoveItemsToSection = (fromGroupIndex: number, targetSectionId: string) => {
    const targetIndex = sectionGroups.findIndex(g => g.id === targetSectionId);
    if (targetIndex === -1 || targetIndex === fromGroupIndex) return;
    
    const sourceGroup = sectionGroups[fromGroupIndex];
    const targetGroup = sectionGroups[targetIndex];
    
    // Only allow moving if section types are compatible
    if (sourceGroup.sectionType !== targetGroup.sectionType && 
        !['project', 'tender'].includes(sourceGroup.sectionType) &&
        !['project', 'tender'].includes(targetGroup.sectionType)) {
      toast.error('Нельзя перемещать пункты между секциями разных типов');
      return;
    }
    
    setSectionGroups(prev => {
      const newGroups = [...prev];
      const itemsToMove = [...newGroups[fromGroupIndex].items];
      
      // Clear source items
      newGroups[fromGroupIndex] = {
        ...newGroups[fromGroupIndex],
        items: []
      };
      
      // Add to target
      newGroups[targetIndex] = {
        ...newGroups[targetIndex],
        items: [...newGroups[targetIndex].items, ...itemsToMove.map(item => ({
          ...item,
          project_id: targetGroup.sectionType === 'project' ? targetGroup.entityId : null
        }))]
      };
      
      return newGroups;
    });
    markAsChanged();
  };

  // Get other sections for move dropdown
  const getOtherSections = (currentGroupIndex: number) => {
    return sectionGroups
      .filter((g, i) => i !== currentGroupIndex)
      .map(g => {
        // Build a temporary section object for getSectionDisplayName
        const tempSection = {
          id: g.id,
          protocol_id: '',
          section_type: g.sectionType,
          entity_id: g.entityId,
          entity_name: g.entityName,
          default_responsible: g.defaultResponsible,
          sort_order: 0,
          archived: false,
          created_at: '',
          updated_at: ''
        };
        return {
          id: g.id,
          sectionType: g.sectionType,
          entityName: g.entityName,
          displayName: getSectionDisplayName(tempSection, projects)
        };
      });
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
    // Find the item to get task_id before removing
    const group = sectionGroups[groupIndex];
    const companyGroup = group?.companyGroups?.find(c => c.id === companyId);
    const item = companyGroup?.items.find(i => i.id === itemId);
    const taskId = item?.task_id || null;

    // For edit mode, also delete from DB if it's a real item
    if (isEditMode && !itemId.startsWith("temp-")) {
      try {
        await deleteProtocolItem.mutateAsync({ id: itemId, protocol_id: id! });
      } catch (error) {
        toast.error("Ошибка удаления пункта");
        return;
      }
    }

    // Archive linked task if exists
    if (taskId) {
      try {
        await updateTask.mutateAsync({ id: taskId, status: 'archived' });
      } catch (error) {
        console.error("Failed to archive linked task:", error);
        // Don't block item removal if task archive fails
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

  // Deep clone groups to avoid mutation issues
  const cloneGroups = (groups: SectionGroup[]): SectionGroup[] =>
    JSON.parse(JSON.stringify(groups));

  const handleCreate = async () => {
    // Prevent double submission
    if (isSavingRef.current) {
      console.log("Create already in progress, ignoring duplicate call");
      return;
    }
    
    if (!form.title.trim()) {
      toast.error("Введите тему совещания");
      return;
    }

    const organizerName = form.organizer_id
      ? (() => { const e = employees.find((e) => e.id === form.organizer_id); return e ? getEmployeeDisplayName(e) : null; })()
      : null;
    const attendeeNames = form.attendee_ids
      .map((empId) => { const e = employees.find((e) => e.id === empId); return e ? getEmployeeDisplayName(e) : null; })
      .filter(Boolean) as string[];

    isSavingRef.current = true;
    setIsSavingAll(true);
    setSaveProgress("Создание протокола...");
    
    try {
      const result = await createProtocol.mutateAsync({
        number: nextNumber,
        date: form.date,
        title: form.title,
        organizer: organizerName,
        meeting_type: isTenderMode ? 'tender' : form.title,
        attendees: attendeeNames,
      });

      const groupsSnapshot = cloneGroups(sectionGroups);
      const idMapping: Record<string, string> = {}; // tempId -> realId
      const taskIdMapping: Record<string, string> = {}; // itemId -> taskId

      // Create all sections and items
      let sortOrder = 0;
      let sectionSortOrder = 0;

      setSaveProgress("Сохранение секций...");
      
      for (const group of groupsSnapshot) {
        const createdSection = await createSection.mutateAsync({
          protocol_id: result.id,
          section_type: group.sectionType,
          entity_id: group.entityId,
          entity_name: group.sectionType === 'tender' ? 'Тендеры' : (group.entityName || null),
          default_responsible: group.defaultResponsible,
          sort_order: sectionSortOrder++,
        });
        idMapping[group.id] = createdSection.id;

        setSaveProgress("Сохранение пунктов...");

        if (group.sectionType === "tender" && group.companyGroups) {
          for (const company of group.companyGroups) {
            // If company has no items, create a placeholder so the company is preserved
            const itemsToSave = company.items.length > 0
              ? company.items
              : [{ id: generateTempId(), item_text: "", responsible: null, due_date: null, project_id: null, task_id: null } as ProtocolItemData];
            for (const item of itemsToSave) {

              const effectiveResponsible = item.responsible ?? group.defaultResponsible;

              const sectionProjectId = getProjectIdForSection(group.sectionType, group.entityId);

              const createdItem = await createProtocolItem.mutateAsync({
                protocol_id: result.id,
                project_id: sectionProjectId,
                section_id: createdSection.id,
                item_text: `[${company.companyName}] ${item.item_text}`,
                responsible: effectiveResponsible,
                due_date: item.due_date,
                sort_order: sortOrder++,
                kpi: null,
                status: null,
                status_date: null,
              });

              idMapping[item.id] = createdItem.id;

              if (!item.task_id) {
                const assigneeProfileIds = getProfileIdsFromResponsible(effectiveResponsible);

                const taskResult = await createTask.mutateAsync({
                  title: `[${company.companyName}] ${item.item_text}`,
                  assignee_ids: assigneeProfileIds,
                  project_id: sectionProjectId,
                  due_date: item.due_date || null,
                  status: "new",
                  priority: "normal",
                });

                await updateProtocolItem.mutateAsync({
                  id: createdItem.id,
                  protocol_id: result.id,
                  task_id: taskResult.id,
                });

                taskIdMapping[createdItem.id] = taskResult.id;
              } else {
                // Copy mode: link to existing task
                await updateProtocolItem.mutateAsync({
                  id: createdItem.id,
                  protocol_id: result.id,
                  task_id: item.task_id,
                });
                taskIdMapping[createdItem.id] = item.task_id;
              }
            }
          }
        } else {
          for (const item of group.items) {
            if (!item.item_text.trim()) continue;

            const effectiveResponsible = item.responsible ?? group.defaultResponsible;
            const isGoal = group.sectionType === "goals";
            const goalItem = item as GoalItemData;
            const sectionProjectId = getProjectIdForSection(group.sectionType, group.entityId);

            const createdItem = await createProtocolItem.mutateAsync({
              protocol_id: result.id,
              project_id: sectionProjectId,
              section_id: createdSection.id,
              item_text: item.item_text,
              responsible: effectiveResponsible,
              due_date: item.due_date,
              sort_order: sortOrder++,
              kpi: isGoal ? goalItem.kpi : null,
              status: isGoal ? goalItem.status : null,
              status_date: isGoal ? goalItem.status_date : null,
              completed: item.completed || false,
              completed_at: item.completed_at || null,
            });

            idMapping[item.id] = createdItem.id;

            // Always create task for every protocol item (unless copying with existing task)
            if (!item.task_id) {
              const assigneeProfileIds = getProfileIdsFromResponsible(effectiveResponsible);

              const taskResult = await createTask.mutateAsync({
                title: item.item_text,
                assignee_ids: assigneeProfileIds,
                project_id: sectionProjectId,
                due_date: item.due_date || null,
                status: "new",
                priority: "normal",
              });

              await updateProtocolItem.mutateAsync({
                id: createdItem.id,
                protocol_id: result.id,
                task_id: taskResult.id,
              });

              taskIdMapping[createdItem.id] = taskResult.id;
            } else {
              // Copy mode: link to existing task
              await updateProtocolItem.mutateAsync({
                id: createdItem.id,
                protocol_id: result.id,
                task_id: item.task_id,
              });
              taskIdMapping[createdItem.id] = item.task_id;
            }
          }
        }
      }

      setHasUnsavedChanges(false);
      
      // Clear draft after successful save
      await clearDraft();
      
      toast.success(isCopyMode ? "Протокол скопирован" : "Протокол создан");
      navigate(`/protocols/edit/${result.id}`);
    } catch (error) {
      console.error("Protocol create failed:", error);
      const message = error instanceof Error ? error.message : "Неизвестная ошибка";
      toast.error(`Ошибка при создании протокола: ${message}`);
    } finally {
      isSavingRef.current = false;
      setIsSavingAll(false);
      setSaveProgress(null);
    }
  };

  const handleSaveChanges = async () => {
    // Prevent double submission
    if (isSavingRef.current) {
      console.log("Save already in progress, ignoring duplicate call");
      return;
    }
    
    if (!id || !form.title.trim()) {
      toast.error("Введите тему совещания");
      return;
    }

    const organizerName = form.organizer_id
      ? (() => { const e = employees.find((e) => e.id === form.organizer_id); return e ? getEmployeeDisplayName(e) : null; })()
      : null;
    const attendeeNames = form.attendee_ids
      .map((empId) => { const e = employees.find((e) => e.id === empId); return e ? getEmployeeDisplayName(e) : null; })
      .filter(Boolean) as string[];

    isSavingRef.current = true;
    setIsSavingAll(true);
    setSaveProgress("Сохранение протокола...");
    
    try {
      await updateProtocol.mutateAsync({
        id,
        date: form.date,
        title: form.title,
        organizer: organizerName,
        meeting_type: isTenderMode ? 'tender' : form.title,
        attendees: attendeeNames,
      });

      const groupsSnapshot = cloneGroups(sectionGroups);
      const idMapping: Record<string, string> = {}; // tempId -> realId
      const taskIdMapping: Record<string, string> = {}; // itemId -> taskId
      const failedItems: { text: string; error: string }[] = [];

      let sortOrder = 0;
      let sectionSortOrder = 0;

      // Helper to process a single item with error handling
      const processSingleItem = async (
        item: UniversalItemData,
        sectionId: string,
        projectId: string | null,
        defaultResponsible: string | null,
        isGoal: boolean,
        isTender: boolean,
        companyName?: string
      ): Promise<ItemProcessResult> => {
        const effectiveResponsible = item.responsible ?? defaultResponsible;
        const goalItem = item as GoalItemData;
        const itemText = isTender && companyName 
          ? `[${companyName}] ${item.item_text}` 
          : item.item_text;
        const currentSortOrder = sortOrder++;

        try {
          if (item.id.startsWith("temp-")) {
            // Create new item
            const createdItem = await createProtocolItem.mutateAsync({
              protocol_id: id,
              project_id: projectId,
              section_id: sectionId,
              item_text: itemText,
              responsible: effectiveResponsible,
              due_date: item.due_date,
              sort_order: currentSortOrder,
              kpi: isGoal ? goalItem.kpi : null,
              status: isGoal ? goalItem.status : null,
              status_date: isGoal ? goalItem.status_date : null,
              archived: item.archived || false,
              completed: item.completed || false,
              completed_at: item.completed_at || null,
            });

            let taskId: string | undefined;

            // Always create task for new items (unless already has task from copy)
            if (!item.task_id) {
              const assigneeProfileIds = getProfileIdsFromResponsible(effectiveResponsible);

              const taskResult = await createTask.mutateAsync({
                title: itemText,
                assignee_ids: assigneeProfileIds,
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

              taskId = taskResult.id;
            } else {
              // Link to existing task (copy mode)
              await updateProtocolItem.mutateAsync({
                id: createdItem.id,
                protocol_id: id,
                task_id: item.task_id,
              });
              taskId = item.task_id || undefined;
            }
            
            return { success: true, itemId: item.id, itemText: item.item_text, newId: createdItem.id, taskId };
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
              kpi: isGoal ? goalItem.kpi : null,
              status: isGoal ? goalItem.status : null,
              status_date: isGoal ? goalItem.status_date : null,
              sort_order: currentSortOrder,
              archived: item.archived || false,
              completed: item.completed || false,
              completed_at: item.completed_at || null,
            });

            let taskId: string | undefined = item.task_id || undefined;

            // Create task if no task exists yet, update if exists
            if (!item.task_id) {
              const assigneeProfileIds = getProfileIdsFromResponsible(effectiveResponsible);

              const taskResult = await createTask.mutateAsync({
                title: itemText,
                assignee_ids: assigneeProfileIds,
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

              taskId = taskResult.id;
              toast.success(`Задача "${item.item_text.slice(0, 30)}..." создана`);
            } else {
              // Update existing task with current item data (sync all editable fields)
              const assigneeProfileIds = getProfileIdsFromResponsible(effectiveResponsible);

              await updateTask.mutateAsync({
                id: item.task_id,
                title: itemText,
                assignee_ids: assigneeProfileIds,
                project_id: projectId,
                due_date: item.due_date || null,
              });
            }
            
            return { success: true, itemId: item.id, itemText: item.item_text, taskId };
          }
        } catch (error) {
          console.error(`Failed to save item: ${item.item_text}`, error);
          return { 
            success: false, 
            itemId: item.id, 
            itemText: item.item_text, 
            error: error instanceof Error ? error : new Error('Unknown error') 
          };
        }
      };

      // Helper to process items in parallel with error collection
      const processItemsInParallel = async (
        items: UniversalItemData[],
        sectionId: string,
        projectId: string | null,
        defaultResponsible: string | null,
        isGoal: boolean,
        isTender: boolean,
        companyName?: string
      ): Promise<ItemProcessResult[]> => {
        const itemPromises = items
          .filter((item) => item.item_text.trim())
          .map((item) => processSingleItem(
            item,
            sectionId,
            projectId,
            defaultResponsible,
            isGoal,
            isTender,
            companyName
          ));

        const results = await Promise.allSettled(itemPromises);
        
        return results.map((result, idx) => {
          if (result.status === 'fulfilled') {
            return result.value;
          } else {
            const item = items.filter(i => i.item_text.trim())[idx];
            return {
              success: false,
              itemId: item?.id || 'unknown',
              itemText: item?.item_text || 'Unknown item',
              error: result.reason instanceof Error ? result.reason : new Error(String(result.reason))
            };
          }
        });
      };

      setSaveProgress("Сохранение секций...");

      // Process sections - sections need to be sequential (need IDs), but items within can be parallel
      for (const group of groupsSnapshot) {
        // Create section if it's new
        let sectionId = group.id;
        if (group.id.startsWith("temp-")) {
          const createdSection = await createSection.mutateAsync({
            protocol_id: id,
            section_type: group.sectionType,
            entity_id: group.entityId,
            entity_name: group.sectionType === 'tender' ? 'Тендеры' : (group.entityName || null),
            default_responsible: group.defaultResponsible,
            sort_order: sectionSortOrder++,
          });
          sectionId = createdSection.id;
          idMapping[group.id] = createdSection.id;
        } else {
          await updateSection.mutateAsync({
            id: group.id,
            protocol_id: id,
            entity_id: group.entityId,
            entity_name: group.sectionType === 'tender' ? 'Тендеры' : (group.entityName || null),
            default_responsible: group.defaultResponsible,
            sort_order: sectionSortOrder++,
            archived: group.archived || false,
          });
        }

        const projectId = getProjectIdForSection(group.sectionType, group.entityId);
        const isGoal = group.sectionType === "goals";

        setSaveProgress("Сохранение пунктов...");

        if (group.sectionType === "tender" && group.companyGroups) {
          // Process all company groups in parallel
          const companyPromises = group.companyGroups.map((company) =>
            processItemsInParallel(
              company.items,
              sectionId,
              projectId,
              group.defaultResponsible,
              false,
              true,
              company.companyName
            )
          );
          const companyResults = await Promise.all(companyPromises);
          
          // Collect results
          companyResults.flat().forEach(result => {
            if (result.success) {
              if (result.newId) idMapping[result.itemId] = result.newId;
              if (result.taskId) taskIdMapping[result.newId || result.itemId] = result.taskId;
            } else {
              failedItems.push({ text: result.itemText, error: result.error?.message || 'Unknown error' });
            }
          });
        } else {
          // Process items in parallel
          const results = await processItemsInParallel(
            group.items,
            sectionId,
            projectId,
            group.defaultResponsible,
            isGoal,
            false
          );
          
          // Collect results
          results.forEach(result => {
            if (result.success) {
              if (result.newId) idMapping[result.itemId] = result.newId;
              if (result.taskId) taskIdMapping[result.newId || result.itemId] = result.taskId;
            } else {
              failedItems.push({ text: result.itemText, error: result.error?.message || 'Unknown error' });
            }
          });
        }
      }

      // Update local state with new IDs (immutably)
      setSectionGroups(prev => prev.map(group => ({
        ...group,
        id: idMapping[group.id] || group.id,
        items: group.items.map(item => ({
          ...item,
          id: idMapping[item.id] || item.id,
          task_id: taskIdMapping[idMapping[item.id] || item.id] || item.task_id,
        })),
        companyGroups: group.companyGroups?.map(company => ({
          ...company,
          items: company.items.map(item => ({
            ...item,
            id: idMapping[item.id] || item.id,
            task_id: taskIdMapping[idMapping[item.id] || item.id] || item.task_id,
          })),
        })),
      })));

      setHasUnsavedChanges(false);
      
      // Clear draft after successful save
      await clearDraft();
      
      // Show appropriate message based on results
      if (failedItems.length > 0) {
        console.error("Failed items:", failedItems);
        toast.warning(`Протокол сохранён с ошибками (${failedItems.length} пункт(ов) не сохранено)`);
      } else {
        toast.success("Протокол сохранён");
      }
    } catch (error) {
      console.error("Protocol save failed:", error);
      const message = error instanceof Error ? error.message : "Неизвестная ошибка";
      toast.error(`Ошибка при сохранении: ${message}`);
    } finally {
      isSavingRef.current = false;
      setIsSavingAll(false);
      setSaveProgress(null);
    }
  };


  const handleExportPdf = async () => {
    if (!existingProtocol) return;
    try {
      // Convert current state to items format for PDF
      // Use sectionGroups which contains the actual current state (including completed status)
      const currentItems: {
        id: string;
        item_text: string;
        responsible: string | null;
        due_date: string | null;
        project_id?: string | null;
        section_id?: string | null;
        kpi?: string | null;
        status?: string | null;
        sort_order?: number | null;
        completed?: boolean | null;
      }[] = [];
      
      sectionGroups.forEach((group, groupIndex) => {
        if (group.sectionType === "tender" && group.companyGroups) {
          // Tender items
          group.companyGroups.forEach(company => {
            company.items.forEach((item, itemIndex) => {
              currentItems.push({
                id: item.id,
                item_text: `[${company.companyName}] ${item.item_text}`,
                responsible: item.responsible ?? group.defaultResponsible,
                due_date: item.due_date,
                section_id: group.id.startsWith("temp-") ? undefined : group.id,
                sort_order: itemIndex,
                completed: item.completed,
              });
            });
          });
        } else {
          // Regular section items
          group.items.forEach((item, itemIndex) => {
            // Check if this is a GoalItemData (has kpi/status fields)
            const goalItem = item as { kpi?: string | null; status?: string | null };
            currentItems.push({
              id: item.id,
              item_text: item.item_text,
              responsible: item.responsible ?? group.defaultResponsible,
              due_date: item.due_date,
              section_id: group.id.startsWith("temp-") ? undefined : group.id,
              kpi: goalItem.kpi,
              status: goalItem.status,
              sort_order: itemIndex,
              completed: item.completed,
            });
          });
        }
      });
      
      // Get all item IDs to fetch comments (only non-temp items)
      const itemIds = currentItems.filter(item => !item.id.startsWith("temp-")).map(item => item.id);
      
      let comments: { id: string; item_id: string; author_id: string; content: string; created_at: string; author_name?: string }[] = [];
      
      if (itemIds.length > 0) {
        // Fetch comments for all items
        const { data: commentsData } = await proxySelect<{
          id: string;
          item_id: string;
          author_id: string;
          content: string;
          created_at: string;
        }>('protocol_item_comments', {
          // IMPORTANT: our dbProxy expects an array for `in` filters (not a PostgREST string like "(a,b)")
          filters: [{ column: 'item_id', operator: 'in', value: itemIds }],
          order: [{ column: 'created_at', ascending: true }],
        });
        
        if (commentsData && commentsData.length > 0) {
          // Fetch author names
          const authorIds = [...new Set(commentsData.map(c => c.author_id))];
          if (authorIds.length > 0) {
            const { data: authorProfiles } = await proxySelect<{
              id: string;
              first_name: string | null;
              last_name: string | null;
            }>('profiles', {
              filters: [{ column: 'id', operator: 'in', value: authorIds }],
            });
            
            const profileMap = new Map(
              (authorProfiles || []).map(p => [p.id, `${p.first_name || ''} ${p.last_name || ''}`.trim() || 'Пользователь'])
            );
            
            comments = commentsData.map(c => ({
              ...c,
              author_name: profileMap.get(c.author_id) || 'Пользователь'
            }));
          } else {
            comments = commentsData;
          }
        }
      }
      
      // Convert sectionGroups to sections format for PDF
      const currentSections = sectionGroups
        .filter(g => !g.archived)
        .map((group, index) => ({
          id: group.id,
          protocol_id: existingProtocol.id,
          section_type: group.sectionType,
          entity_id: group.entityId,
          entity_name: group.sectionType === 'tender' ? 'Тендеры' : (group.entityName || null),
          default_responsible: group.defaultResponsible,
          sort_order: index,
        }));
      
      await generateProtocolPdf(existingProtocol, currentItems, projects, currentSections, comments);
      toast.success("PDF экспортирован");
    } catch (error) {
      console.error("PDF export error:", error);
      toast.error("Ошибка экспорта PDF");
    }
  };

  // Computed
  const pageTitle = isEditMode
    ? `${isTenderMode ? 'Тендер-протокол' : 'Протокол'} №${existingProtocol?.number || ""}`
    : isCopyMode
      ? "Копирование протокола"
      : isTenderMode
        ? "Новый тендер-протокол"
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
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-semibold text-foreground">{pageTitle}</h1>
                {hasUnsavedChanges && !isSaving && !saveProgress && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-orange-500/10 text-orange-600 dark:text-orange-400 border border-orange-500/20">
                    <span className="w-1.5 h-1.5 bg-orange-500 rounded-full animate-pulse" />
                    Не сохранено
                  </span>
                )}
              </div>
              {saveProgress ? (
                <p className="text-sm text-muted-foreground animate-pulse">{saveProgress}</p>
              ) : (
                <div className="flex items-center gap-2">
                  {draftSaving ? (
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                      <Cloud className="w-3 h-3" />
                      Автосохранение...
                    </p>
                  ) : draftLastSavedAt ? (
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                      <Cloud className="w-3 h-3" />
                      Черновик сохранён в {draftLastSavedAt.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  ) : null}
                  {hasUnsavedChanges && !draftSaving && (
                    <button
                      onClick={saveDraftNow}
                      className="text-xs text-primary hover:text-primary/80 flex items-center gap-1 transition-colors"
                      title="Сохранить черновик сейчас"
                    >
                      <Save className="w-3 h-3" />
                      <span className="hidden sm:inline">Сохранить</span>
                    </button>
                  )}
                  <button
                    onClick={() => setShowHistoryPanel(true)}
                    className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors"
                    title="История версий черновика"
                  >
                    <History className="w-3 h-3" />
                    <span className="hidden sm:inline">История</span>
                  </button>
                </div>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {/* Connection status indicator */}
            {connectionStatus === 'disconnected' && (
              <div 
                className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-destructive/10 text-destructive border border-destructive/20"
                title="Нет подключения к серверу"
              >
                <WifiOff className="w-4 h-4" />
                <span className="text-xs font-medium hidden sm:inline">Нет связи</span>
              </div>
            )}
            {connectionStatus === 'checking' && (
              <div 
                className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-muted text-muted-foreground"
                title="Проверка подключения..."
              >
                <Loader2 className="w-4 h-4 animate-spin" />
              </div>
            )}
            <Button 
              onClick={() => setAllSectionsCollapsed(!allSectionsCollapsed)} 
              variant="outline" 
              size="sm" 
              className="gap-2"
              title={allSectionsCollapsed ? "Развернуть все секции" : "Свернуть все секции"}
            >
              <ChevronsUpDown className="w-4 h-4" />
            </Button>
            {isTenderMode ? (
              <Button onClick={() => setShowAddCompanyModal(true)} variant="outline" size="sm" className="gap-2">
                <Building className="w-4 h-4" />
                <span className="hidden sm:inline">Компания</span>
              </Button>
            ) : (
              <Button onClick={() => setShowSectionModal(true)} variant="outline" size="sm" className="gap-2">
                <Plus className="w-4 h-4" />
                <span className="hidden sm:inline">Секция</span>
              </Button>
            )}
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
                  items={sectionGroups.filter(g => !g.archived).map((g) => `section-group-${g.id}`)}
                  strategy={verticalListSortingStrategy}
                >
                  {sectionGroups.map((group, index) => {
                    // Skip archived sections in main list
                    if (group.archived) return null;
                    
                    return (
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
                              onPersistTempItem={(companyId, itemId) => handlePersistTenderItem(index, companyId, itemId)}
                              onAddItem={(companyId) => handleAddTenderItem(index, companyId)}
                              onAddCompany={(companyName) => handleAddCompany(index, companyName)}
                              onRemoveCompany={(companyId) => handleRemoveCompany(index, companyId)}
                              onRenameCompany={(companyId, newName) => handleRenameCompany(index, companyId, newName)}
                              onRemoveSection={sectionGroups.filter(g => !g.archived).length > 1 ? () => handleRemoveSection(index) : undefined}
                              dragHandle={{ attributes, listeners }}
                              protocolTitle={form.title}
                            />
                          ) : (
                            <UniversalSection
                              sectionId={group.id}
                              sectionIndex={index}
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
                               onArchiveItem={canArchive ? (itemId) => handleArchiveItem(index, itemId) : undefined}
                               onPersistTempItem={(itemId) => handlePersistTempItem(index, itemId)}
                               onAddItem={() => handleAddItemToSection(index)}
                               onChangeEntity={(entityId, entityName) => handleChangeEntity(index, entityId, entityName)}
                               onRemoveSection={sectionGroups.filter(g => !g.archived).length > 1 ? () => handleRemoveSection(index) : undefined}
                               onArchiveSection={canArchive ? () => handleArchiveSection(index) : undefined}
                              onMoveItemsToSection={(targetSectionId) => handleMoveItemsToSection(index, targetSectionId)}
                              otherSections={getOtherSections(index)}
                              canEdit={!isEditMode || group.id.startsWith("temp-")}
                              forceExpanded={!allSectionsCollapsed}
                              dragHandle={{ attributes, listeners }}
                              profiles={profiles}
                              isArchived={false}
                              protocolTitle={form.title}
                            />
                          )
                        }
                      </SortableProtocolSection>
                    );
                  })}
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

            {/* Archived sections panel */}
            {sectionGroups.some(g => g.archived) && (
              <section className="space-y-4">
                <details className="group">
                  <summary className="cursor-pointer text-lg font-medium text-muted-foreground hover:text-foreground flex items-center gap-2">
                    <Archive className="w-5 h-5" />
                    Архив секций ({sectionGroups.filter(g => g.archived).length})
                  </summary>
                  <div className="mt-4 space-y-4">
                    {sectionGroups.map((group, index) => {
                      if (!group.archived) return null;
                      
                      return (
                        <div key={group.id} className="opacity-60">
                          {group.sectionType === "tender" ? (
                            <TenderSection
                              sectionId={group.id}
                              companyGroups={group.companyGroups || []}
                              employees={employees}
                              defaultResponsible={group.defaultResponsible}
                              onChangeDefaultResponsible={(responsible) => handleChangeDefaultResponsible(index, responsible)}
                              onUpdateItem={(companyId, itemId, updates) => handleUpdateTenderItem(index, companyId, itemId, updates)}
                              onRemoveItem={(companyId, itemId) => handleRemoveTenderItem(index, companyId, itemId)}
                              onPersistTempItem={(companyId, itemId) => handlePersistTenderItem(index, companyId, itemId)}
                              onAddItem={(companyId) => handleAddTenderItem(index, companyId)}
                              onAddCompany={(companyName) => handleAddCompany(index, companyName)}
                              onRemoveCompany={(companyId) => handleRemoveCompany(index, companyId)}
                              onRenameCompany={(companyId, newName) => handleRenameCompany(index, companyId, newName)}
                              onRemoveSection={() => handleRemoveSection(index)}
                              protocolTitle={form.title}
                            />
                          ) : (
                            <UniversalSection
                              sectionId={group.id}
                              sectionIndex={index}
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
                               onArchiveItem={canArchive ? (itemId) => handleArchiveItem(index, itemId) : undefined}
                               onPersistTempItem={(itemId) => handlePersistTempItem(index, itemId)}
                               onAddItem={() => handleAddItemToSection(index)}
                               onChangeEntity={(entityId, entityName) => handleChangeEntity(index, entityId, entityName)}
                               onRemoveSection={() => handleRemoveSection(index)}
                               onArchiveSection={canArchive ? () => handleRestoreSection(index) : undefined}
                              onMoveItemsToSection={(targetSectionId) => handleMoveItemsToSection(index, targetSectionId)}
                              otherSections={getOtherSections(index)}
                              canEdit={!isEditMode || group.id.startsWith("temp-")}
                              defaultExpanded={false}
                              profiles={profiles}
                              isArchived={true}
                              protocolTitle={form.title}
                            />
                          )}
                        </div>
                      );
                    })}
                  </div>
                </details>
              </section>
            )}

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

      <AddCompanyModal
        open={showAddCompanyModal}
        onClose={() => setShowAddCompanyModal(false)}
        onAdd={(companyName) => {
          // Find or create the tender section, then add company
          const tenderGroupIndex = sectionGroups.findIndex(g => g.sectionType === 'tender');
          if (tenderGroupIndex >= 0) {
            handleAddCompany(tenderGroupIndex, companyName);
          } else {
            // Create a new tender section with this company
            const newGroup: SectionGroup = {
              id: generateTempId(),
              sectionType: 'tender',
              entityId: null,
              entityName: 'Тендеры',
              defaultResponsible: null,
              items: [],
              companyGroups: [{ id: generateTempId(), companyName, items: [] }],
            };
            setSectionGroups(prev => [...prev, newGroup]);
            markAsChanged();
          }
        }}
      />

      <Modal
        isOpen={showHistoryPanel}
        onClose={() => setShowHistoryPanel(false)}
        title="История версий черновика"
        size="lg"
      >
        <DraftHistoryPanel
          formType="protocol"
          entityId={draftEntityId}
          onRestore={(data: DraftSnapshot['draft_data']) => {
            if (data.form) {
              setForm(prev => ({ ...prev, ...data.form }));
            }
            if (data.sectionGroups) {
              setSectionGroups(data.sectionGroups as SectionGroup[]);
            }
            setShowHistoryPanel(false);
            markAsChanged();
          }}
          onClose={() => setShowHistoryPanel(false)}
        />
      </Modal>
    </div>
  );
}
