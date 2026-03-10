import { useState, DragEvent, useMemo, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { Modal } from "@/components/ui/Modal";
import { EmployeeMultiSelect } from "@/components/ui/EmployeeMultiSelect";
import { TaskComments } from "@/components/tasks/TaskComments";
import { Plus, Calendar, User, GripVertical, FolderOpen, ChevronDown, ChevronRight, Pencil, Users, Archive, ArchiveRestore, UserCheck, MoreVertical } from "lucide-react";
import { useTasks, useCreateTask, useUpdateTask, DbTask, TaskStatus, TaskPriority, TASK_STATUS_LABELS, TASK_PRIORITY_LABELS, TASK_PRIORITY_COLORS } from "@/hooks/useTasks";
import { useProjects, useUpdateProject, Project } from "@/hooks/useProjects";
import { useEmployees, DbEmployee, getEmployeeDisplayName } from "@/hooks/useEmployees";
import { useCurrentProfile } from "@/hooks/useCurrentProfile";
import { formatDisplayDate } from "@/utils/dateFormat";
import { toast } from "sonner";

const columns: { id: TaskStatus; label: string }[] = [
  { id: "new", label: "Новая" },
  { id: "in_progress", label: "В работе" },
  { id: "done", label: "Готово" },
];

const archivedColumn: { id: TaskStatus; label: string } = { id: "archived", label: "Архив" };

const priorities: { id: TaskPriority; label: string }[] = [
  { id: "critical", label: "Критический" },
  { id: "high", label: "Высокий" },
  { id: "normal", label: "Нормальный" },
  { id: "low", label: "Низкий" },
];

type GroupByMode = "project" | "assignee";

export function TasksModule() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { data: employees = [] } = useEmployees();
  const { data: currentProfile } = useCurrentProfile();

  // Filter tasks by assignee (employee -> profile_id)
  const [assigneeEmployeeFilterId, setAssigneeEmployeeFilterId] = useState<string>("");
  const [showMyTasks, setShowMyTasks] = useState(false);

  const [showArchivedProjects, setShowArchivedProjects] = useState(false);
  const { data: projects = [], isLoading: projectsLoading } = useProjects({ includeArchived: showArchivedProjects });
  const createTask = useCreateTask();
  const updateTask = useUpdateTask();
  const updateProject = useUpdateProject();

  // Build maps using direct profile_id from employees table
  const employeeProfileMaps = useMemo(() => {
    const employeeToProfile = new Map<string, string>();
    const profileToEmployee = new Map<string, string>();

    for (const emp of employees) {
      if (emp.profile_id) {
        employeeToProfile.set(emp.id, emp.profile_id);
        if (!profileToEmployee.has(emp.profile_id)) {
          profileToEmployee.set(emp.profile_id, emp.id);
        }
      }
    }

    return { employeeToProfile, profileToEmployee };
  }, [employees]);

  const assigneeProfileFilterId = useMemo(() => {
    // "My Tasks" filter takes priority
    if (showMyTasks && currentProfile?.id) {
      return currentProfile.id;
    }
    if (!assigneeEmployeeFilterId) return null;
    const profileId = employeeProfileMaps.employeeToProfile.get(assigneeEmployeeFilterId) || null;
    if (!profileId) {
      return null;
    }
    return profileId;
  }, [assigneeEmployeeFilterId, employeeProfileMaps, showMyTasks, currentProfile]);

  const { data: tasks = [], isLoading: tasksLoading } = useTasks({ assigneeId: assigneeProfileFilterId });

  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<DbTask | null>(null);
  const [expandedProjects, setExpandedProjects] = useState<Set<string>>(new Set(["no-project"]));
  const [expandedAssignees, setExpandedAssignees] = useState<Set<string>>(new Set(["no-assignee"]));
  const [groupBy, setGroupBy] = useState<GroupByMode>("project");
  const [showArchived, setShowArchived] = useState(false);
  const [form, setForm] = useState({
    title: "",
    assignee_ids: [] as string[],
    responsible_ids: [] as string[],
    observer_ids: [] as string[],
    project: "",
    due: new Date().toISOString().slice(0, 10),
    priority: "normal" as TaskPriority,
    labels: "",
  });

  // Handle task query param from notifications
  const taskIdFromUrl = searchParams.get("task");
  
  useEffect(() => {
    if (taskIdFromUrl && tasks.length > 0 && !tasksLoading) {
      const task = tasks.find(t => t.id === taskIdFromUrl);
      if (task) {
        // Open the task in edit modal - inline logic to avoid circular dependency
        const assigneeEmployeeIds = (task.assignee_ids || [])
          .map(pid => employeeProfileMaps.profileToEmployee.get(pid))
          .filter(Boolean) as string[];

        const responsibleEmployeeIds = (task.responsible_ids || [])
          .map(pid => employeeProfileMaps.profileToEmployee.get(pid))
          .filter(Boolean) as string[];

        const observerEmployeeIds = (task.observer_ids || [])
          .map(pid => employeeProfileMaps.profileToEmployee.get(pid))
          .filter(Boolean) as string[];

        setEditingTask(task);
        setForm({
          title: task.title,
          assignee_ids: assigneeEmployeeIds,
          responsible_ids: responsibleEmployeeIds,
          observer_ids: observerEmployeeIds,
          project: task.project_id || "",
          due: task.due_date || new Date().toISOString().slice(0, 10),
          priority: task.priority,
          labels: task.labels?.join(", ") || "",
        });
        
        // Expand the project/assignee group containing this task
        if (task.project_id) {
          setExpandedProjects(prev => new Set([...prev, task.project_id!]));
        }
        if (task.assignee_id) {
          setExpandedAssignees(prev => new Set([...prev, task.assignee_id!]));
        }
        // If task is archived and archive is hidden, show archive column
        if (task.status === "archived" && !showArchived) {
          // Don't auto-show archive
        }
        // Clear the URL param after opening
        setSearchParams({}, { replace: true });
      } else {
        // Task not found in current filter - reset filters to find the task
        if (assigneeProfileFilterId !== null) {
          setAssigneeEmployeeFilterId("");
          setShowMyTasks(false);
        }
      }
    }
  }, [taskIdFromUrl, tasks, tasksLoading, employeeProfileMaps, assigneeProfileFilterId, setSearchParams]);

  const handleDragStart = (e: DragEvent, taskId: string) => {
    setDraggedTaskId(taskId);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e: DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  };

  const handleDrop = (e: DragEvent, status: TaskStatus) => {
    e.preventDefault();
    if (draggedTaskId) {
      updateTask.mutate({ id: draggedTaskId, status });
      setDraggedTaskId(null);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim()) return;

    // Convert employee IDs to profile IDs
    const assigneeProfileIds = form.assignee_ids
      .map(id => employeeProfileMaps.employeeToProfile.get(id))
      .filter(Boolean) as string[];

    const responsibleProfileIds = form.responsible_ids
      .map(id => employeeProfileMaps.employeeToProfile.get(id))
      .filter(Boolean) as string[];

    const observerProfileIds = form.observer_ids
      .map(id => employeeProfileMaps.employeeToProfile.get(id))
      .filter(Boolean) as string[];

    createTask.mutate({
      title: form.title,
      assignee_ids: assigneeProfileIds,
      responsible_ids: responsibleProfileIds,
      observer_ids: observerProfileIds,
      project_id: form.project || null,
      due_date: form.due || null,
      status: "new",
      priority: form.priority,
      labels: form.labels.split(",").map((l) => l.trim()).filter(Boolean),
    });

    setForm({
      title: "",
      assignee_ids: [],
      responsible_ids: [],
      observer_ids: [],
      project: "",
      due: new Date().toISOString().slice(0, 10),
      priority: "normal",
      labels: "",
    });
    setIsModalOpen(false);
  };

  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTask || !form.title.trim()) return;

    // Convert employee IDs to profile IDs
    const assigneeProfileIds = form.assignee_ids
      .map(id => employeeProfileMaps.employeeToProfile.get(id))
      .filter(Boolean) as string[];

    const responsibleProfileIds = form.responsible_ids
      .map(id => employeeProfileMaps.employeeToProfile.get(id))
      .filter(Boolean) as string[];

    const observerProfileIds = form.observer_ids
      .map(id => employeeProfileMaps.employeeToProfile.get(id))
      .filter(Boolean) as string[];

    updateTask.mutate({
      id: editingTask.id,
      title: form.title,
      assignee_ids: assigneeProfileIds,
      responsible_ids: responsibleProfileIds,
      observer_ids: observerProfileIds,
      project_id: form.project || null,
      due_date: form.due || null,
      priority: form.priority,
      labels: form.labels.split(",").map((l) => l.trim()).filter(Boolean),
    });

    setEditingTask(null);
  };

  const openEditModal = (task: DbTask) => {
    // Convert profile IDs to employee IDs
    const assigneeEmployeeIds = (task.assignee_ids || [])
      .map(pid => employeeProfileMaps.profileToEmployee.get(pid))
      .filter(Boolean) as string[];

    const responsibleEmployeeIds = (task.responsible_ids || [])
      .map(pid => employeeProfileMaps.profileToEmployee.get(pid))
      .filter(Boolean) as string[];

    const observerEmployeeIds = (task.observer_ids || [])
      .map(pid => employeeProfileMaps.profileToEmployee.get(pid))
      .filter(Boolean) as string[];

    setEditingTask(task);
    setForm({
      title: task.title,
      assignee_ids: assigneeEmployeeIds,
      responsible_ids: responsibleEmployeeIds,
      observer_ids: observerEmployeeIds,
      project: task.project_id || "",
      due: task.due_date || new Date().toISOString().slice(0, 10),
      priority: task.priority,
      labels: task.labels?.join(", ") || "",
    });
  };

  const toggleProject = (projectId: string) => {
    setExpandedProjects((prev) => {
      const next = new Set(prev);
      if (next.has(projectId)) {
        next.delete(projectId);
      } else {
        next.add(projectId);
      }
      return next;
    });
  };

  const toggleAssignee = (assigneeId: string) => {
    setExpandedAssignees((prev) => {
      const next = new Set(prev);
      if (next.has(assigneeId)) {
        next.delete(assigneeId);
      } else {
        next.add(assigneeId);
      }
      return next;
    });
  };

  // Filter out archived tasks unless showArchived is true
  const filteredTasks = useMemo(() => {
    if (showArchived) {
      return tasks;
    }
    return tasks.filter(t => t.status !== "archived");
  }, [tasks, showArchived]);

  // Get visible columns based on showArchived toggle
  const visibleColumns = useMemo(() => {
    if (showArchived) {
      return [...columns, archivedColumn];
    }
    return columns;
  }, [showArchived]);

  // Group tasks by project
  const tasksByProject = useMemo(() => {
    const grouped: Record<string, DbTask[]> = { "no-project": [] };
    projects.forEach((p) => {
      grouped[p.id] = [];
    });

    filteredTasks.forEach((task) => {
      const key = task.project_id || "no-project";
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(task);
    });

    return grouped;
  }, [filteredTasks, projects]);

  const getTasksByStatusAndProject = (status: TaskStatus, projectId: string) =>
    (tasksByProject[projectId] || []).filter((t) => t.status === status);

  // Group tasks by assignee
  const tasksByAssignee = useMemo(() => {
    const grouped: Record<string, DbTask[]> = { "no-assignee": [] };
    
    // Initialize with all employees that have profile_id
    employees.forEach((emp) => {
      if (emp.profile_id) {
        grouped[emp.profile_id] = [];
      }
    });

    filteredTasks.forEach((task) => {
      const key = task.assignee_id || "no-assignee";
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(task);
    });

    return grouped;
  }, [filteredTasks, employees]);

  const getTasksByStatusAndAssignee = (status: TaskStatus, assigneeProfileId: string) =>
    (tasksByAssignee[assigneeProfileId] || []).filter((t) => t.status === status);

  const getEmployeeById = (id: string) => employees.find((e) => e.id === id);

  const getAssigneeEmployeeId = (profileId: string | null) =>
    profileId ? employeeProfileMaps.profileToEmployee.get(profileId) || "" : "";

  const handleAssigneeChange = (taskId: string, employeeId: string) => {
    const profileId = employeeId
      ? employeeProfileMaps.employeeToProfile.get(employeeId) || null
      : null;

    if (employeeId && !profileId) {
      toast.error("Не удалось назначить исполнителя: нет связанного профиля пользователя");
      return;
    }

    updateTask.mutate({ id: taskId, assignee_id: profileId });
  };

  const projectsWithTasks = useMemo(() => {
    const result: (Project | { id: "no-project"; name: string })[] = [];
    
    // Add projects that have tasks
    projects.forEach((p) => {
      if (tasksByProject[p.id]?.length > 0) {
        result.push(p);
      }
    });

    // Add "no project" if there are tasks without project
    if (tasksByProject["no-project"]?.length > 0) {
      result.push({ id: "no-project", name: "Без проекта" });
    }

    // Add projects without tasks at the end
    projects.forEach((p) => {
      if (!tasksByProject[p.id]?.length) {
        result.push(p);
      }
    });

    return result;
  }, [projects, tasksByProject]);

  // Build assignees with tasks list
  const assigneesWithTasks = useMemo(() => {
    const result: { id: string; name: string; isNoAssignee?: boolean }[] = [];
    
    // Add employees that have tasks
    employees.forEach((emp) => {
      if (emp.profile_id && tasksByAssignee[emp.profile_id]?.length > 0) {
        result.push({ id: emp.profile_id, name: getEmployeeDisplayName(emp) });
      }
    });

    // Add "no assignee" if there are tasks without assignee
    if (tasksByAssignee["no-assignee"]?.length > 0) {
      result.push({ id: "no-assignee", name: "Не назначен", isNoAssignee: true });
    }

    // Add employees without tasks at the end
    employees.forEach((emp) => {
      if (emp.profile_id && !tasksByAssignee[emp.profile_id]?.length) {
        result.push({ id: emp.profile_id, name: emp.full_name });
      }
    });

    return result;
  }, [employees, tasksByAssignee]);

  if (tasksLoading || projectsLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-muted-foreground">Загрузка...</div>
      </div>
    );
  }

  return (
    <div className="space-y-4 md:space-y-6">
      <div className="flex flex-col gap-3">
        {/* Top row: count and add button */}
        <div className="flex items-center justify-between">
          <p className="text-sm md:text-base text-muted-foreground">Задач: {filteredTasks.length}</p>
          <button
            onClick={() => setIsModalOpen(true)}
            className="btn-primary h-9 md:h-11 px-3 md:px-5 flex items-center gap-2 text-sm md:text-base"
          >
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">Новая задача</span>
            <span className="sm:hidden">Добавить</span>
          </button>
        </div>

        {/* Filter row */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
          {/* My Tasks toggle */}
          <button
            onClick={() => {
              setShowMyTasks(!showMyTasks);
              if (!showMyTasks) setAssigneeEmployeeFilterId("");
            }}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg border transition-colors flex-shrink-0 ${
              showMyTasks
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-card border-border hover:bg-muted text-foreground"
            }`}
          >
            <UserCheck className="w-3.5 h-3.5" />
            <span>Мои задачи</span>
          </button>
          
          <span className="text-sm text-muted-foreground flex-shrink-0">Исполнитель:</span>
          <div className={`flex-1 min-w-0 ${showMyTasks ? 'opacity-50 pointer-events-none' : ''}`}>
            <EmployeeMultiSelect
              employees={employees}
              selectedIds={assigneeEmployeeFilterId ? [assigneeEmployeeFilterId] : []}
              onChange={(ids) => {
                setAssigneeEmployeeFilterId(ids[0] || "");
                if (ids[0]) setShowMyTasks(false);
              }}
              placeholder="Все исполнители"
              single
            />
          </div>
          {(assigneeEmployeeFilterId || showMyTasks) && (
            <button
              type="button"
              onClick={() => {
                setAssigneeEmployeeFilterId("");
                setShowMyTasks(false);
              }}
              className="btn-secondary h-9 px-3 py-1.5 text-sm flex-shrink-0"
            >
              Сбросить
            </button>
          )}
        </div>
        </div>

        {/* Group by toggle */}
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Группировать:</span>
          <div className="flex rounded-lg border border-border overflow-hidden">
            <button
              onClick={() => setGroupBy("project")}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-sm transition-colors ${
                groupBy === "project"
                  ? "bg-primary text-primary-foreground"
                  : "bg-card hover:bg-muted text-foreground"
              }`}
            >
              <FolderOpen className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">По проектам</span>
            </button>
            <button
              onClick={() => setGroupBy("assignee")}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-sm transition-colors ${
                groupBy === "assignee"
                  ? "bg-primary text-primary-foreground"
                  : "bg-card hover:bg-muted text-foreground"
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">По исполнителям</span>
            </button>
          </div>
          
          {/* Archive toggle */}
          <button
            onClick={() => setShowArchived(!showArchived)}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg border transition-colors ${
              showArchived
                ? "bg-amber-500/10 border-amber-500/30 text-amber-600"
                : "bg-card border-border hover:bg-muted text-muted-foreground"
            }`}
          >
            <Archive className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">{showArchived ? "Скрыть архив" : "Показать архив"}</span>
          </button>

          {/* Archived projects toggle */}
          {groupBy === "project" && (
            <button
              onClick={() => setShowArchivedProjects(!showArchivedProjects)}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg border transition-colors ${
                showArchivedProjects
                  ? "bg-amber-500/10 border-amber-500/30 text-amber-600"
                  : "bg-card border-border hover:bg-muted text-muted-foreground"
              }`}
            >
              <FolderOpen className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">{showArchivedProjects ? "Скрыть архивные проекты" : "Архивные проекты"}</span>
            </button>
          )}
        </div>

      {/* Tasks grouped by project or assignee */}
      <div className="space-y-4">
        {groupBy === "project" ? (
          // Group by Project
          projectsWithTasks.map((project) => {
            const projectTaskCount = tasksByProject[project.id]?.length || 0;
            const isExpanded = expandedProjects.has(project.id);

            return (
              <div key={project.id} className={`border border-border rounded-xl overflow-hidden ${(project as Project).archived ? 'opacity-60' : ''}`}>
                <div className="flex items-center bg-muted/30 hover:bg-muted/50 transition-colors">
                  <button
                    onClick={() => toggleProject(project.id)}
                    className="flex-1 flex items-center gap-3 p-4 text-left"
                  >
                    {isExpanded ? (
                      <ChevronDown className="w-4 h-4 text-muted-foreground" />
                    ) : (
                      <ChevronRight className="w-4 h-4 text-muted-foreground" />
                    )}
                    <FolderOpen className="w-4 h-4 text-primary" />
                    <span className="font-medium text-foreground flex-1">
                      {project.name}
                      {(project as Project).archived && <span className="text-muted-foreground ml-2">(архив)</span>}
                    </span>
                    <span className="chip">{projectTaskCount}</span>
                  </button>
                  
                  {/* Archive project button */}
                  {project.id !== "no-project" && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        const isArchived = (project as Project).archived;
                        updateProject.mutate(
                          { id: project.id, archived: !isArchived },
                          {
                            onSuccess: () => {
                              toast.success(isArchived ? "Проект восстановлен из архива" : "Проект архивирован");
                            },
                          }
                        );
                      }}
                      className="p-2 mr-2 hover:bg-muted rounded-lg transition-colors"
                      title={(project as Project).archived ? "Восстановить из архива" : "Архивировать проект"}
                    >
                      {(project as Project).archived ? (
                        <ArchiveRestore className="w-4 h-4 text-amber-500" />
                      ) : (
                        <Archive className="w-4 h-4 text-muted-foreground hover:text-amber-500" />
                      )}
                    </button>
                  )}
                </div>

                {isExpanded && (
                  <div className="p-2 md:p-4">
                    <div className="flex gap-2 md:gap-3 overflow-x-auto pb-2 -mx-2 px-2">
                      {visibleColumns.map((column) => {
                        const columnTasks = getTasksByStatusAndProject(column.id, project.id);
                        return (
                          <div
                            key={column.id}
                            className="kanban-column shrink-0 min-w-[200px] md:min-w-[240px] max-w-[280px] p-3 md:p-5"
                            onDragOver={handleDragOver}
                            onDrop={(e) => handleDrop(e, column.id)}
                          >
                            <div className="flex items-center justify-between mb-3 md:mb-4">
                              <h3 className="font-semibold text-foreground text-xs md:text-sm truncate">{column.label}</h3>
                              <span className="chip text-xs ml-1 flex-shrink-0">{columnTasks.length}</span>
                            </div>

                            <div className="space-y-2">
                              {columnTasks.map((task) => (
                                <TaskCard
                                  key={task.id}
                                  task={task}
                                  employees={employees}
                                  profileToEmployee={employeeProfileMaps.profileToEmployee}
                                  onDragStart={handleDragStart}
                                  onEdit={openEditModal}
                                    onArchive={(id) => {
                                      const isArchived = task.status === "archived";
                                      const newStatus = isArchived ? "new" : "archived";
                                      updateTask.mutate(
                                        { id, status: newStatus },
                                        {
                                          onSuccess: () => {
                                            toast.success(isArchived ? "Задача восстановлена" : "Задача архивирована");
                                          },
                                          onError: (error) => {
                                            console.error("Failed to archive task:", error);
                                            toast.error("Ошибка при архивировании задачи");
                                          },
                                        }
                                      );
                                    }}
                                />
                              ))}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            );
          })
        ) : (
          // Group by Assignee
          assigneesWithTasks.map((assignee) => {
            const assigneeTaskCount = tasksByAssignee[assignee.id]?.length || 0;
            const isExpanded = expandedAssignees.has(assignee.id);

            return (
              <div key={assignee.id} className="border border-border rounded-xl overflow-hidden">
                <button
                  onClick={() => toggleAssignee(assignee.id)}
                  className="w-full flex items-center gap-3 p-4 bg-muted/30 hover:bg-muted/50 transition-colors text-left"
                >
                  {isExpanded ? (
                    <ChevronDown className="w-4 h-4 text-muted-foreground" />
                  ) : (
                    <ChevronRight className="w-4 h-4 text-muted-foreground" />
                  )}
                  <User className="w-4 h-4 text-primary" />
                  <span className="font-medium text-foreground flex-1">{assignee.name}</span>
                  <span className="chip">{assigneeTaskCount}</span>
                </button>

                {isExpanded && (
                  <div className="p-2 md:p-4">
                    <div className="flex gap-2 md:gap-3 overflow-x-auto pb-2 -mx-2 px-2">
                      {visibleColumns.map((column) => {
                        const columnTasks = getTasksByStatusAndAssignee(column.id, assignee.id);
                        return (
                          <div
                            key={column.id}
                            className="kanban-column shrink-0 min-w-[200px] md:min-w-[240px] max-w-[280px] p-3 md:p-5"
                            onDragOver={handleDragOver}
                            onDrop={(e) => handleDrop(e, column.id)}
                          >
                            <div className="flex items-center justify-between mb-3 md:mb-4">
                              <h3 className="font-semibold text-foreground text-xs md:text-sm truncate">{column.label}</h3>
                              <span className="chip text-xs ml-1 flex-shrink-0">{columnTasks.length}</span>
                            </div>

                            <div className="space-y-2">
                              {columnTasks.map((task) => (
                                <TaskCard
                                  key={task.id}
                                  task={task}
                                  employees={employees}
                                  profileToEmployee={employeeProfileMaps.profileToEmployee}
                                  onDragStart={handleDragStart}
                                  onEdit={openEditModal}
                                    onArchive={(id) => {
                                      const isArchived = task.status === "archived";
                                      const newStatus = isArchived ? "new" : "archived";
                                      updateTask.mutate(
                                        { id, status: newStatus },
                                        {
                                          onSuccess: () => {
                                            toast.success(isArchived ? "Задача восстановлена" : "Задача архивирована");
                                          },
                                          onError: (error) => {
                                            console.error("Failed to archive task:", error);
                                            toast.error("Ошибка при архивировании задачи");
                                          },
                                        }
                                      );
                                    }}
                                />
                              ))}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Новая задача"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">
              Название
            </label>
            <input
              type="text"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              className="input-base w-full"
              placeholder="Введите название задачи"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">
              Проект
            </label>
            <select
              value={form.project}
              onChange={(e) => setForm({ ...form, project: e.target.value })}
              className="input-base w-full"
            >
              <option value="">Без проекта</option>
              {projects.map((proj) => (
                <option key={proj.id} value={proj.id}>
                  {proj.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">
              Приоритет
            </label>
            <select
              value={form.priority}
              onChange={(e) => setForm({ ...form, priority: e.target.value as TaskPriority })}
              className="input-base w-full"
            >
              {priorities.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">
              Исполнители
            </label>
            <EmployeeMultiSelect
              employees={employees}
              selectedIds={form.assignee_ids}
              onChange={(ids) => setForm({ ...form, assignee_ids: ids })}
              placeholder="Выберите исполнителей"
              usePortal
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">
              Ответственные
            </label>
            <EmployeeMultiSelect
              employees={employees}
              selectedIds={form.responsible_ids}
              onChange={(ids) => setForm({ ...form, responsible_ids: ids })}
              placeholder="Выберите ответственных"
              usePortal
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">
              Наблюдатели
            </label>
            <EmployeeMultiSelect
              employees={employees}
              selectedIds={form.observer_ids}
              onChange={(ids) => setForm({ ...form, observer_ids: ids })}
              placeholder="Выберите наблюдателей"
              usePortal
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">
              Срок
            </label>
            <input
              type="date"
              value={form.due}
              onChange={(e) => setForm({ ...form, due: e.target.value })}
              className="input-base w-full"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">
              Метки (через запятую)
            </label>
            <input
              type="text"
              value={form.labels}
              onChange={(e) => setForm({ ...form, labels: e.target.value })}
              className="input-base w-full"
              placeholder="метка1, метка2"
            />
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={() => setIsModalOpen(false)}
              className="btn-secondary"
            >
              Отмена
            </button>
            <button type="submit" className="btn-primary">
              Создать
            </button>
          </div>
        </form>
      </Modal>

      {/* Edit Task Modal */}
      <Modal
        isOpen={!!editingTask}
        onClose={() => setEditingTask(null)}
        title="Редактировать задачу"
      >
        <form onSubmit={handleEditSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">
              Название
            </label>
            <input
              type="text"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              className="input-base w-full"
              placeholder="Введите название задачи"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">
              Проект
            </label>
            <select
              value={form.project}
              onChange={(e) => setForm({ ...form, project: e.target.value })}
              className="input-base w-full"
            >
              <option value="">Без проекта</option>
              {projects.map((proj) => (
                <option key={proj.id} value={proj.id}>
                  {proj.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">
              Приоритет
            </label>
            <select
              value={form.priority}
              onChange={(e) => setForm({ ...form, priority: e.target.value as TaskPriority })}
              className="input-base w-full"
            >
              {priorities.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">
              Исполнители
            </label>
            <EmployeeMultiSelect
              employees={employees}
              selectedIds={form.assignee_ids}
              onChange={(ids) => setForm({ ...form, assignee_ids: ids })}
              placeholder="Выберите исполнителей"
              usePortal
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">
              Ответственные
            </label>
            <EmployeeMultiSelect
              employees={employees}
              selectedIds={form.responsible_ids}
              onChange={(ids) => setForm({ ...form, responsible_ids: ids })}
              placeholder="Выберите ответственных"
              usePortal
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">
              Наблюдатели
            </label>
            <EmployeeMultiSelect
              employees={employees}
              selectedIds={form.observer_ids}
              onChange={(ids) => setForm({ ...form, observer_ids: ids })}
              placeholder="Выберите наблюдателей"
              usePortal
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">
              Срок
            </label>
            <input
              type="date"
              value={form.due}
              onChange={(e) => setForm({ ...form, due: e.target.value })}
              className="input-base w-full"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">
              Метки (через запятую)
            </label>
            <input
              type="text"
              value={form.labels}
              onChange={(e) => setForm({ ...form, labels: e.target.value })}
              className="input-base w-full"
              placeholder="метка1, метка2"
            />
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={() => setEditingTask(null)}
              className="btn-secondary"
            >
              Отмена
            </button>
            <button type="submit" className="btn-primary">
              Сохранить
            </button>
          </div>
        </form>

        {/* Comments section */}
        {editingTask && (
          <div className="mt-6 pt-6 border-t border-border">
            <TaskComments taskId={editingTask.id} taskTitle={editingTask.title} />
          </div>
        )}
      </Modal>
    </div>
  );
}

interface TaskCardProps {
  task: DbTask;
  employees: DbEmployee[];
  profileToEmployee: Map<string, string>;
  onDragStart: (e: DragEvent, id: string) => void;
  onEdit: (task: DbTask) => void;
  onArchive: (id: string) => void;
}

function TaskCard({
  task,
  employees,
  profileToEmployee,
  onDragStart,
  onEdit,
  onArchive,
}: TaskCardProps) {
  const priorityStyles = {
    critical: { border: "border-red-500", bg: "bg-red-500", text: "text-white" },
    high: { border: "border-orange-500", bg: "bg-orange-500", text: "text-white" },
    normal: { border: "border-blue-500", bg: "bg-blue-500", text: "text-white" },
    low: { border: "border-slate-400", bg: "bg-slate-400", text: "text-white" },
  };

  const style = priorityStyles[task.priority] || priorityStyles.normal;

  // Get assignee names
  const getEmployeeNames = (profileIds: string[]) => {
    if (!profileIds || profileIds.length === 0) return null;
    return profileIds
      .map(pid => {
        const empId = profileToEmployee.get(pid);
        const emp = empId ? employees.find(e => e.id === empId) : null;
        return emp?.full_name;
      })
      .filter(Boolean)
      .join(", ");
  };

  const assigneeNames = getEmployeeNames(task.assignee_ids || []);
  const responsibleNames = getEmployeeNames(task.responsible_ids || []);
  const observerNames = getEmployeeNames(task.observer_ids || []);

  return (
    <div
      draggable
      onDragStart={(e) => onDragStart(e, task.id)}
      className={`relative bg-card border-2 ${style.border} rounded-lg p-3 pt-5 cursor-grab active:cursor-grabbing hover:shadow-md transition-shadow`}
    >
      {/* Priority bookmark */}
      <div className={`absolute -top-2 left-3 px-2 py-0.5 rounded text-xs font-semibold ${style.bg} ${style.text} shadow-sm`}>
        {TASK_PRIORITY_LABELS[task.priority]}
      </div>

      {/* Edit and Archive buttons */}
      <div className="absolute top-1 right-1 flex items-center gap-0.5">
        <button
          onClick={(e) => {
            e.stopPropagation();
            onArchive(task.id);
          }}
          className="p-1 hover:bg-muted rounded transition-colors"
          title={task.status === "archived" ? "Восстановить из архива" : "Архивировать"}
        >
          {task.status === "archived" ? (
            <ArchiveRestore className="w-3.5 h-3.5 text-amber-500" />
          ) : (
            <Archive className="w-3.5 h-3.5 text-muted-foreground hover:text-amber-500" />
          )}
        </button>
        <button
          onClick={() => onEdit(task)}
          className="p-1 hover:bg-muted rounded transition-colors"
        >
          <Pencil className="w-3.5 h-3.5 text-muted-foreground" />
        </button>
      </div>

      {/* Labels above title */}
      {task.labels && task.labels.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-2">
          {task.labels.slice(0, 3).map((label) => (
            <span key={label} className="chip text-xs">
              {label}
            </span>
          ))}
          {task.labels.length > 3 && (
            <span className="chip text-xs">+{task.labels.length - 3}</span>
          )}
        </div>
      )}

      {/* Title */}
      <h4 
        className="font-medium text-foreground text-sm cursor-pointer hover:text-primary transition-colors mb-3"
        onClick={() => onEdit(task)}
      >
        {task.title}
      </h4>

      {/* People and deadline */}
      <div className="space-y-1.5 text-xs text-muted-foreground">
        {assigneeNames && (
          <div className="flex items-start gap-2">
            <User className="w-3 h-3 shrink-0 mt-0.5" />
            <span className="line-clamp-2" title={`Исполнители: ${assigneeNames}`}>{assigneeNames}</span>
          </div>
        )}
        
        {responsibleNames && (
          <div className="flex items-start gap-2">
            <Users className="w-3 h-3 shrink-0 mt-0.5 text-blue-500" />
            <span className="line-clamp-1 text-blue-600" title={`Ответственные: ${responsibleNames}`}>{responsibleNames}</span>
          </div>
        )}

        {observerNames && (
          <div className="flex items-start gap-2">
            <User className="w-3 h-3 shrink-0 mt-0.5 text-amber-500" />
            <span className="line-clamp-1 text-amber-600" title={`Наблюдатели: ${observerNames}`}>{observerNames}</span>
          </div>
        )}

        {!assigneeNames && !responsibleNames && !observerNames && (
          <div className="flex items-center gap-2">
            <User className="w-3 h-3 shrink-0" />
            <span className="text-muted-foreground/60">Не назначен</span>
          </div>
        )}
        
        <div className="flex items-center gap-2">
          <Calendar className="w-3 h-3 shrink-0" />
          <span>{task.due_date ? formatDisplayDate(task.due_date) : "Без срока"}</span>
        </div>
      </div>
    </div>
  );
}
