import { useState, useMemo } from "react";
import { Modal } from "@/components/ui/Modal";
import { Users, Plus, Loader2, Check } from "lucide-react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { proxySelect, proxyInsert } from "@/lib/dbProxy";
import { toast } from "sonner";

interface Profile {
  id: string;
  first_name: string | null;
  last_name: string | null;
  avatar_url: string | null;
}

interface GroupParticipantsModalProps {
  isOpen: boolean;
  onClose: () => void;
  conversationId: string;
  conversationTitle: string;
}

export function GroupParticipantsModal({
  isOpen,
  onClose,
  conversationId,
  conversationTitle,
}: GroupParticipantsModalProps) {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [selectedToAdd, setSelectedToAdd] = useState<Set<string>>(new Set());

  // Current participants
  const { data: participantIds = [], isLoading: loadingParticipants } = useQuery({
    queryKey: ["chat-participants", conversationId],
    queryFn: async () => {
      const { data, error } = await proxySelect<{ user_id: string }>("chat_participants", {
        select: "user_id",
        filters: [{ column: "conversation_id", operator: "eq", value: conversationId }],
      });
      if (error) throw new Error(error.message);
      return (data || []).map((p) => p.user_id);
    },
    enabled: isOpen,
  });

  // All profiles
  const { data: profiles = [] } = useQuery({
    queryKey: ["profiles-all"],
    queryFn: async () => {
      const { data, error } = await proxySelect<Profile>("profiles", {
        select: "id, first_name, last_name, avatar_url",
      });
      if (error) throw new Error(error.message);
      return data || [];
    },
    enabled: isOpen,
  });

  const fullName = (p: Profile) =>
    [p.first_name, p.last_name].filter(Boolean).join(" ") || "Без имени";

  const currentParticipants = useMemo(
    () => profiles.filter((p) => participantIds.includes(p.id)),
    [profiles, participantIds]
  );

  const availableToAdd = useMemo(() => {
    const q = search.trim().toLowerCase();
    return profiles
      .filter((p) => !participantIds.includes(p.id))
      .filter((p) => !q || fullName(p).toLowerCase().includes(q));
  }, [profiles, participantIds, search]);

  const addMutation = useMutation({
    mutationFn: async (userIds: string[]) => {
      const rows = userIds.map((user_id) => ({
        conversation_id: conversationId,
        user_id,
      }));
      const { error } = await proxyInsert("chat_participants", rows);
      if (error) throw new Error(error.message);

      // Notifications about being added (history is fully visible — no DB filtering)
      const notifs = userIds.map((recipient_id) => ({
        recipient_id,
        type: "chat_added",
        title: "Вас добавили в чат",
        body: conversationTitle,
        link: `#chat:${conversationId}`,
      }));
      await proxyInsert("notifications", notifs);
    },
    onSuccess: () => {
      toast.success("Участники добавлены");
      setSelectedToAdd(new Set());
      queryClient.invalidateQueries({ queryKey: ["chat-participants", conversationId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggleSelect = (id: string) => {
    setSelectedToAdd((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleAdd = () => {
    if (selectedToAdd.size === 0) return;
    addMutation.mutate(Array.from(selectedToAdd));
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Участники чата">
      <div className="space-y-4">
        {/* Current participants */}
        <div>
          <h4 className="text-sm font-semibold text-foreground mb-2 flex items-center gap-2">
            <Users className="w-4 h-4" />
            В чате ({currentParticipants.length})
          </h4>
          {loadingParticipants ? (
            <div className="flex justify-center py-4">
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="max-h-40 overflow-y-auto space-y-1 rounded-lg border border-border p-2">
              {currentParticipants.map((p) => (
                <div
                  key={p.id}
                  className="flex items-center gap-2 text-sm px-2 py-1.5 rounded hover:bg-secondary/50"
                >
                  <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center text-xs font-medium text-primary shrink-0">
                    {(p.first_name?.[0] || p.last_name?.[0] || "?").toUpperCase()}
                  </div>
                  <span className="truncate">{fullName(p)}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Add new participants */}
        <div>
          <h4 className="text-sm font-semibold text-foreground mb-2 flex items-center gap-2">
            <Plus className="w-4 h-4" />
            Добавить участников
          </h4>
          <p className="text-xs text-muted-foreground mb-2">
            Новым участникам будет доступна вся история чата.
          </p>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Поиск по имени..."
            className="w-full px-3 py-2 text-sm rounded-lg border border-border bg-background mb-2 focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
          <div className="max-h-48 overflow-y-auto space-y-1 rounded-lg border border-border p-2">
            {availableToAdd.length === 0 && (
              <p className="text-xs text-muted-foreground text-center py-3">
                Никого не найдено
              </p>
            )}
            {availableToAdd.map((p) => {
              const checked = selectedToAdd.has(p.id);
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => toggleSelect(p.id)}
                  className={`w-full flex items-center gap-2 text-sm px-2 py-1.5 rounded text-left transition-colors ${
                    checked ? "bg-primary/10" : "hover:bg-secondary/50"
                  }`}
                >
                  <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center text-xs font-medium text-primary shrink-0">
                    {(p.first_name?.[0] || p.last_name?.[0] || "?").toUpperCase()}
                  </div>
                  <span className="truncate flex-1">{fullName(p)}</span>
                  {checked && <Check className="w-4 h-4 text-primary shrink-0" />}
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-2 border-t border-border">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm rounded-lg hover:bg-secondary transition-colors"
          >
            Закрыть
          </button>
          <button
            onClick={handleAdd}
            disabled={selectedToAdd.size === 0 || addMutation.isPending}
            className="px-4 py-2 text-sm rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {addMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
            Добавить{selectedToAdd.size > 0 ? ` (${selectedToAdd.size})` : ""}
          </button>
        </div>
      </div>
    </Modal>
  );
}
