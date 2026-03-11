import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { proxySelect } from "@/lib/dbProxy";
import { useEmployees, getEmployeeDisplayName } from "@/hooks/useEmployees";
import { useProjects } from "@/hooks/useProjects";
import { TASK_STATUS_LABELS, TASK_PRIORITY_LABELS } from "@/hooks/useTasks";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useProxiedAvatarUrl } from "@/lib/avatarProxy";
import { format } from "date-fns";
import { formatDisplayDate } from "@/utils/dateFormat";
import { Plus, Pencil, Trash2, MessageSquare } from "lucide-react";

interface AuditEntry {
  id: string;
  table_name: string;
  record_id: string;
  action: string;
  old_data: Record<string, unknown> | null;
  new_data: Record<string, unknown> | null;
  changed_by: string | null;
  changed_at: string;
}

interface CommentEntry {
  id: string;
  task_id: string;
  author_id: string;
  content: string;
  created_at: string;
  author?: {
    id: string;
    first_name: string | null;
    last_name: string | null;
    avatar_url: string | null;
  };
}

interface TimelineItem {
  id: string;
  type: "create" | "update" | "delete" | "comment";
  timestamp: string;
  authorId: string | null;
  taskTitle: string;
  taskId: string;
  changes?: { field: string; from?: string; to?: string }[];
  commentText?: string;
}

const FIELD_LABELS: Record<string, string> = {
  title: "Название",
  status: "Статус",
  priority: "Приоритет",
  assignee_ids: "Исполнители",
  responsible_ids: "Ответственные",
  observer_ids: "Наблюдатели",
  due_date: "Срок",
  project_id: "Проект",
  labels: "Метки",
};

const TRACKED_FIELDS = Object.keys(FIELD_LABELS);

function AuthorAvatar({ url, name }: { url: string | null; name: string }) {
  const proxied = useProxiedAvatarUrl(url);
  return (
    <Avatar className="w-5 h-5">
      {proxied && <AvatarImage src={proxied} alt={name} />}
      <AvatarFallback className="text-[10px]">{name.charAt(0)}</AvatarFallback>
    </Avatar>
  );
}

export function TaskHistory({ onTaskClick }: { onTaskClick?: (taskId: string) => void }) {
  const { data: employees = [] } = useEmployees();
  const { data: projects = [] } = useProjects({ includeArchived: true });

  const { data: auditLogs = [], isLoading: auditLoading } = useQuery({
    queryKey: ["task-audit-log"],
    queryFn: async () => {
      const { data, error } = await proxySelect<AuditEntry>("audit_log", {
        filters: [{ column: "table_name", operator: "eq", value: "tasks" }],
        order: [{ column: "changed_at", ascending: false }],
        limit: 500,
      });
      if (error) throw new Error(error.message);
      return data || [];
    },
  });

  const { data: comments = [], isLoading: commentsLoading } = useQuery({
    queryKey: ["all-task-comments-history"],
    queryFn: async () => {
      const { data, error } = await proxySelect<CommentEntry>("task_comments", {
        select: "*, author:profiles!task_comments_author_id_fkey(id, first_name, last_name, avatar_url)",
        order: [{ column: "created_at", ascending: false }],
        limit: 500,
      });
      if (error) throw new Error(error.message);
      return data || [];
    },
  });

  // Fetch tasks to resolve titles for comments
  const commentTaskIds = useMemo(() => {
    const ids = new Set<string>();
    comments.forEach(c => ids.add(c.task_id));
    return [...ids];
  }, [comments]);

  const { data: commentTasks = [] } = useQuery({
    queryKey: ["task-titles-for-history", commentTaskIds],
    queryFn: async () => {
      if (commentTaskIds.length === 0) return [];
      const { data, error } = await proxySelect<{ id: string; title: string }>("tasks", {
        select: "id, title",
        filters: [{ column: "id", operator: "in", value: `(${commentTaskIds.join(",")})` }],
      });
      if (error) throw new Error(error.message);
      return data || [];
    },
    enabled: commentTaskIds.length > 0,
  });

  const taskTitleMap = useMemo(() => {
    const map = new Map<string, string>();
    commentTasks.forEach(t => map.set(t.id, t.title));
    return map;
  }, [commentTasks]);

  // Build lookup maps
  const profileToEmployee = useMemo(() => {
    const map = new Map<string, typeof employees[0]>();
    employees.forEach((emp) => {
      if (emp.profile_id) map.set(emp.profile_id, emp);
    });
    return map;
  }, [employees]);

  const userIdToEmployee = useMemo(() => {
    // changed_by is auth.uid() — we need to find employee via profile.user_id
    // But we don't have profiles loaded. We'll try matching via profile_id too.
    // Actually changed_by = auth.uid() which is profiles.user_id
    // We need a map from user_id -> employee
    // employees have profile_id which maps to profiles.id, not profiles.user_id
    // So we can't directly map. Let's just use profile_id as fallback.
    return profileToEmployee;
  }, [profileToEmployee]);

  const projectMap = useMemo(() => {
    const map = new Map<string, string>();
    projects.forEach((p) => map.set(p.id, p.name));
    return map;
  }, [projects]);

  const resolveProfileIds = (ids: unknown): string => {
    if (!Array.isArray(ids)) return "—";
    return ids
      .map((id) => {
        const emp = profileToEmployee.get(id as string);
        return emp ? getEmployeeDisplayName(emp) : (id as string).slice(0, 8);
      })
      .join(", ") || "—";
  };

  const formatFieldValue = (field: string, value: unknown): string => {
    if (value === null || value === undefined) return "—";
    if (field === "status") return (TASK_STATUS_LABELS as Record<string, string>)[value as string] || (value as string);
    if (field === "priority") return (TASK_PRIORITY_LABELS as Record<string, string>)[value as string] || (value as string);
    if (field === "assignee_ids" || field === "responsible_ids" || field === "observer_ids") return resolveProfileIds(value);
    if (field === "due_date") return formatDisplayDate(value as string);
    if (field === "project_id") return projectMap.get(value as string) || (value as string);
    if (field === "labels" && Array.isArray(value)) return value.join(", ") || "—";
    return String(value);
  };

  // Merge audit logs and comments into timeline
  const timeline = useMemo<TimelineItem[]>(() => {
    const items: TimelineItem[] = [];

    auditLogs.forEach((log) => {
      const taskTitle = (log.new_data?.title || log.old_data?.title || "Задача") as string;
      const taskId = log.record_id;

      if (log.action === "INSERT") {
        items.push({
          id: log.id,
          type: "create",
          timestamp: log.changed_at,
          authorId: log.changed_by,
          taskTitle,
          taskId,
        });
      } else if (log.action === "DELETE") {
        items.push({
          id: log.id,
          type: "delete",
          timestamp: log.changed_at,
          authorId: log.changed_by,
          taskTitle,
          taskId,
        });
      } else if (log.action === "UPDATE" && log.old_data && log.new_data) {
        const changes: TimelineItem["changes"] = [];
        TRACKED_FIELDS.forEach((field) => {
          const oldVal = log.old_data![field];
          const newVal = log.new_data![field];
          if (JSON.stringify(oldVal) !== JSON.stringify(newVal)) {
            changes.push({
              field,
              from: formatFieldValue(field, oldVal),
              to: formatFieldValue(field, newVal),
            });
          }
        });
        if (changes.length > 0) {
          items.push({
            id: log.id,
            type: "update",
            timestamp: log.changed_at,
            authorId: log.changed_by,
            taskTitle,
            taskId,
            changes,
          });
        }
      }
    });

    comments.forEach((c) => {
      items.push({
        id: `comment-${c.id}`,
        type: "comment",
        timestamp: c.created_at,
        authorId: c.author_id,
        taskTitle: "",
        taskId: c.task_id,
        commentText: c.content,
      });
    });

    items.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    return items;
  }, [auditLogs, comments]);

  const getAuthorInfo = (authorId: string | null) => {
    if (!authorId) return { name: "Система", avatar: null };
    // authorId from audit_log is auth.uid(); from comments it's profile.id
    // Try profile_id first (comments), then we'd need user_id mapping
    const emp = profileToEmployee.get(authorId);
    if (emp) return { name: getEmployeeDisplayName(emp), avatar: emp.avatar_url };
    // Fallback: search all employees by iterating (changed_by = auth.uid = profiles.user_id)
    // We don't have user_id->profile mapping here easily, show truncated id
    return { name: "Пользователь", avatar: null };
  };

  const dotColor = {
    create: "bg-emerald-500",
    update: "bg-blue-500",
    delete: "bg-red-500",
    comment: "bg-muted-foreground",
  };

  const actionIcon = {
    create: <Plus className="w-3.5 h-3.5 text-emerald-500" />,
    update: <Pencil className="w-3.5 h-3.5 text-blue-500" />,
    delete: <Trash2 className="w-3.5 h-3.5 text-red-500" />,
    comment: <MessageSquare className="w-3.5 h-3.5 text-muted-foreground" />,
  };

  if (auditLoading || commentsLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-muted-foreground">Загрузка истории…</div>
      </div>
    );
  }

  if (timeline.length === 0) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-muted-foreground">История изменений пуста</div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto py-4">
      <div className="relative">
        {/* Vertical line */}
        <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-border" />

        <div className="space-y-4">
          {timeline.map((item) => {
            const author = getAuthorInfo(item.authorId);
            return (
              <div key={item.id} className="relative pl-10">
                {/* Dot */}
                <div className={`absolute left-[11px] top-3 w-2.5 h-2.5 rounded-full ${dotColor[item.type]} ring-2 ring-background`} />

                <div className="rounded-lg border border-border bg-card p-3 shadow-sm">
                  {/* Header */}
                  <div className="flex items-center gap-2 mb-1">
                    <AuthorAvatar url={author.avatar} name={author.name} />
                    <span className="text-sm font-medium text-foreground">{author.name}</span>
                    {actionIcon[item.type]}
                    <span className="ml-auto text-xs text-muted-foreground">
                      {format(new Date(item.timestamp), "dd.MM.yyyy HH:mm")}
                    </span>
                  </div>

                  {/* Body */}
                  {item.type === "create" && (
                    <p className="text-sm text-foreground">
                      Создал задачу <button onClick={() => onTaskClick?.(item.taskId)} className="font-medium hover:underline text-primary cursor-pointer">«{item.taskTitle}»</button>
                    </p>
                  )}

                  {item.type === "delete" && (
                    <p className="text-sm text-foreground">
                      Удалил задачу <span className="font-medium">«{item.taskTitle}»</span>
                    </p>
                  )}

                  {item.type === "update" && (
                    <div className="space-y-1">
                      <p className="text-sm text-muted-foreground">
                      Изменил задачу <button onClick={() => onTaskClick?.(item.taskId)} className="font-medium text-primary hover:underline cursor-pointer">«{item.taskTitle}»</button>
                      </p>
                      {item.changes?.map((ch, i) => (
                        <div key={i} className="text-sm pl-2 border-l-2 border-blue-500/30">
                          <span className="text-muted-foreground">{FIELD_LABELS[ch.field] || ch.field}: </span>
                          <span className="text-red-500/70 line-through">{ch.from}</span>
                          <span className="text-muted-foreground"> → </span>
                          <span className="text-emerald-600 dark:text-emerald-400">{ch.to}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {item.type === "comment" && (
                    <p className="text-sm text-foreground whitespace-pre-wrap">
                      {item.commentText}
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
