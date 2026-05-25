import { useState, useMemo, useRef } from "react";
import { Plus, Pin, PinOff, Trash2, Loader2, Search, NotebookPen, Users as UsersIcon, Lock, Paperclip, X, FileText, Download } from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useCurrentProfile } from "@/hooks/useCurrentProfile";
import { useEmployees } from "@/hooks/useEmployees";
import {
  useEmployeeNotes,
  useCreateNote,
  useUpdateNote,
  useDeleteNote,
  EmployeeNote,
  NoteAttachment,
} from "@/hooks/useEmployeeNotes";
import { useChatAttachments, isImageFile, formatFileSize } from "@/hooks/useChatAttachments";
import { Sidebar } from "@/components/layout/Sidebar";
import { MobileNav } from "@/components/layout/MobileNav";
import { Header } from "@/components/layout/Header";
import { FloatingChat } from "@/components/chat/FloatingChat";
import { ChatProvider } from "@/context/ChatContext";
import { AppProvider } from "@/context/AppContext";
import { formatDisplayDate } from "@/utils/dateFormat";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

function NotesContent() {
  const { data: profile } = useCurrentProfile();
  const { data: employees = [] } = useEmployees();
  const [activeTab, setActiveTab] = useState<"private" | "work">("private");
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<EmployeeNote | null>(null);
  const [creating, setCreating] = useState<"private" | "work" | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const profileId = profile?.id || null;

  // Личные — только мои
  const privateQuery = useEmployeeNotes({ ownerProfileId: profileId || undefined, visibility: "private" });
  // Рабочие — все рабочие заметки
  const workQuery = useEmployeeNotes({ visibility: "work" });

  const createNote = useCreateNote();
  const updateNote = useUpdateNote();
  const deleteNote = useDeleteNote();

  const employeeName = useMemo(() => {
    const map = new Map<string, string>();
    employees.forEach((e) => {
      if (e.profile_id) map.set(e.profile_id, e.full_name);
    });
    return map;
  }, [employees]);

  const list = activeTab === "private" ? privateQuery.data || [] : workQuery.data || [];
  const isLoading = activeTab === "private" ? privateQuery.isLoading : workQuery.isLoading;

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return list;
    return list.filter(
      (n) =>
        n.title.toLowerCase().includes(q) ||
        n.body.toLowerCase().includes(q),
    );
  }, [list, search]);

  const handleNewNote = () => {
    if (!profileId) {
      toast.error("Профиль не загружен");
      return;
    }
    setCreating(activeTab);
  };

  const handleTogglePin = async (note: EmployeeNote) => {
    try {
      await updateNote.mutateAsync({ id: note.id, pinned: !note.pinned });
    } catch (e: any) {
      toast.error("Ошибка обновления");
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      await deleteNote.mutateAsync(deleteId);
      toast.success("Заметка удалена");
      if (editing?.id === deleteId) setEditing(null);
      setDeleteId(null);
    } catch (e: any) {
      toast.error("Ошибка удаления");
    }
  };

  return (
    <div className="space-y-4 md:space-y-6">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-3">
          <NotebookPen className="w-6 h-6 text-primary" />
          <h1 className="text-2xl font-semibold">Заметки</h1>
        </div>
        <button
          onClick={handleNewNote}
          className="btn-primary h-9 md:h-11 px-3 md:px-5 flex items-center gap-2 text-sm md:text-base"
        >
          <Plus className="w-4 h-4" />
          Новая заметка
        </button>
      </div>

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "private" | "work")}>
        <TabsList>
          <TabsTrigger value="private" className="gap-1.5">
            <Lock className="w-3.5 h-3.5" />
            Личные
            <span className="ml-1 text-xs text-muted-foreground">({privateQuery.data?.length || 0})</span>
          </TabsTrigger>
          <TabsTrigger value="work" className="gap-1.5">
            <UsersIcon className="w-3.5 h-3.5" />
            Рабочие
            <span className="ml-1 text-xs text-muted-foreground">({workQuery.data?.length || 0})</span>
          </TabsTrigger>
        </TabsList>

        <div className="mt-4 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Поиск..."
            className="input-base w-full pl-9"
          />
        </div>

        <TabsContent value={activeTab} className="space-y-3 mt-4">
          {activeTab === "work" && (
            <p className="text-xs text-muted-foreground">
              Рабочие заметки видят все сотрудники. Редактировать может только автор.
            </p>
          )}

          {isLoading ? (
            <div className="text-center py-12 text-muted-foreground">Загрузка...</div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              {search ? "Ничего не найдено" : "Пока нет заметок"}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {filtered.map((note) => {
                const isOwner = note.owner_profile_id === profileId;
                const authorName = employeeName.get(note.owner_profile_id) || "Сотрудник";
                return (
                  <div
                    key={note.id}
                    className="card-base p-4 flex flex-col gap-2 hover:shadow-md transition-shadow cursor-pointer"
                    onClick={() => isOwner && setEditing(note)}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="font-medium text-foreground line-clamp-2 flex-1">
                        {note.title || <span className="text-muted-foreground italic">Без заголовка</span>}
                      </h3>
                      {isOwner && (
                        <div className="flex items-center gap-1">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleTogglePin(note);
                            }}
                            className="p-1 rounded hover:bg-muted text-muted-foreground"
                            title={note.pinned ? "Открепить" : "Закрепить"}
                          >
                            {note.pinned ? (
                              <Pin className="w-4 h-4 text-primary fill-primary" />
                            ) : (
                              <PinOff className="w-4 h-4" />
                            )}
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setDeleteId(note.id);
                            }}
                            className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive"
                            title="Удалить"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground line-clamp-4 whitespace-pre-wrap">
                      {note.body || <span className="italic">Пусто</span>}
                    </p>
                    {note.attachments && note.attachments.length > 0 && (
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Paperclip className="w-3 h-3" />
                        {note.attachments.length} файл(ов)
                      </div>
                    )}
                    <div className="flex items-center justify-between text-xs text-muted-foreground mt-1">
                      {activeTab === "work" ? (
                        <span className="truncate">{authorName}</span>
                      ) : (
                        <span />
                      )}
                      <span>{formatDisplayDate(note.updated_at)}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Editor modal */}
      {editing && (
        <NoteEditor
          mode="edit"
          note={editing}
          onClose={() => setEditing(null)}
        />
      )}
      {creating && profileId && (
        <NoteEditor
          mode="create"
          visibility={creating}
          ownerProfileId={profileId}
          onClose={() => setCreating(null)}
        />
      )}

      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Удалить заметку?</AlertDialogTitle>
            <AlertDialogDescription>
              Это действие нельзя отменить.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Отмена</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Удалить
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

type NoteEditorProps =
  | { mode: "edit"; note: EmployeeNote; onClose: () => void }
  | { mode: "create"; visibility: "private" | "work"; ownerProfileId: string; onClose: () => void };

function NoteEditor(props: NoteEditorProps) {
  const isCreate = props.mode === "create";
  const [title, setTitle] = useState(isCreate ? "" : props.note.title);
  const [body, setBody] = useState(isCreate ? "" : props.note.body);
  const [saving, setSaving] = useState(false);
  const updateNote = useUpdateNote();
  const createNote = useCreateNote();
  const visibility = isCreate ? props.visibility : props.note.visibility;

  const handleSave = async () => {
    if (!title.trim() && !body.trim()) {
      toast.error("Заполните заголовок или текст");
      return;
    }
    setSaving(true);
    try {
      if (isCreate) {
        await createNote.mutateAsync({
          owner_profile_id: props.ownerProfileId,
          visibility: props.visibility,
          title,
          body,
        });
      } else {
        await updateNote.mutateAsync({ id: props.note.id, title, body });
      }
      toast.success("Сохранено");
      props.onClose();
    } catch (e: any) {
      toast.error("Ошибка сохранения");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm" onClick={props.onClose}>
      <div
        className="bg-card border rounded-2xl shadow-xl w-full max-w-2xl max-h-[85vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-4 border-b">
          <input
            autoFocus
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Заголовок"
            className="w-full text-lg font-medium bg-transparent border-0 outline-none focus:ring-0"
          />
          <div className="text-xs text-muted-foreground mt-1">
            {visibility === "private" ? "Личная заметка" : "Рабочая заметка — видна всем сотрудникам"}
          </div>
        </div>
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Текст заметки..."
          className="flex-1 p-4 bg-transparent border-0 outline-none focus:ring-0 resize-none min-h-[300px]"
        />
        <div className="p-4 border-t flex items-center justify-end gap-2">
          <button
            onClick={props.onClose}
            className="px-4 py-2 rounded-lg border hover:bg-muted text-sm"
          >
            Отмена
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="btn-primary px-4 py-2 text-sm flex items-center gap-2"
          >
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            Сохранить
          </button>
        </div>
      </div>
    </div>
  );
}

export default function NotesPage() {
  return (
    <AppProvider>
      <ChatProvider>
        <div className="flex min-h-screen w-full bg-background">
          <Sidebar />
          <div className="flex-1 flex flex-col min-w-0">
            <Header />
            <main className="flex-1 p-3 md:p-6 pb-20 md:pb-6 overflow-x-hidden">
              <NotesContent />
            </main>
          </div>
          <MobileNav />
          <FloatingChat />
        </div>
      </ChatProvider>
    </AppProvider>
  );
}
