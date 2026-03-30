import { useState } from "react";
import { Plus, Trash2, Clock, Send } from "lucide-react";
import { useTenderInteractions, useCreateTenderInteraction, useDeleteTenderInteraction } from "@/hooks/useTenderInteractions";
import { format } from "date-fns";
import { ru } from "date-fns/locale";

interface Props {
  tenderId: string;
  currentProfileId?: string;
}

export function TenderInteractionsList({ tenderId, currentProfileId }: Props) {
  const { data: interactions = [], isLoading } = useTenderInteractions(tenderId);
  const createInteraction = useCreateTenderInteraction();
  const deleteInteraction = useDeleteTenderInteraction();
  const [newText, setNewText] = useState("");

  const handleAdd = () => {
    if (!newText.trim()) return;
    createInteraction.mutate({
      tender_id: tenderId,
      content: newText.trim(),
      author_id: currentProfileId,
    });
    setNewText("");
  };

  return (
    <div>
      <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground mb-2">
        <Clock className="w-3.5 h-3.5" />
        История взаимодействий
      </div>

      {/* Add new */}
      <div className="flex gap-2 mb-3">
        <input
          type="text"
          value={newText}
          onChange={(e) => setNewText(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleAdd()}
          className="input-base flex-1 text-sm"
          placeholder="Добавить запись..."
        />
        <button
          onClick={handleAdd}
          disabled={!newText.trim() || createInteraction.isPending}
          className="p-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50 shrink-0"
        >
          <Send className="w-4 h-4" />
        </button>
      </div>

      {/* List */}
      {isLoading ? (
        <div className="text-xs text-muted-foreground text-center py-3">Загрузка...</div>
      ) : interactions.length === 0 ? (
        <div className="text-xs text-muted-foreground text-center py-3">Нет записей</div>
      ) : (
        <div className="space-y-1.5 max-h-[250px] overflow-y-auto">
          {interactions.map((item) => (
            <div
              key={item.id}
              className="group flex items-start gap-2 p-2 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors"
            >
              <div className="flex-1 min-w-0">
                <p className="text-sm text-foreground">{item.content}</p>
                <span className="text-[10px] text-muted-foreground">
                  {format(new Date(item.created_at), "dd MMM yyyy, HH:mm", { locale: ru })}
                </span>
              </div>
              <button
                onClick={() => deleteInteraction.mutate({ id: item.id, tender_id: tenderId })}
                className="p-1 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-all shrink-0"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
