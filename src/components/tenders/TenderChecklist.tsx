import { useState } from "react";
import { Plus, Trash2, CheckSquare, Square, Loader2 } from "lucide-react";
import {
  useTenderChecklist,
  useAddChecklistItem,
  useUpdateChecklistItem,
  useDeleteChecklistItem,
} from "@/hooks/useTenderChecklist";

export function TenderChecklist({ tenderId }: { tenderId: string }) {
  const { data: items = [], isLoading } = useTenderChecklist(tenderId);
  const addItem = useAddChecklistItem();
  const updateItem = useUpdateChecklistItem();
  const deleteItem = useDeleteChecklistItem();
  const [newText, setNewText] = useState("");
  const [adding, setAdding] = useState(false);

  const handleAdd = async () => {
    const text = newText.trim();
    if (!text) return;
    setAdding(true);
    try {
      await addItem.mutateAsync({ tender_id: tenderId, text, sort_order: items.length });
      setNewText("");
    } finally {
      setAdding(false);
    }
  };

  const toggleCompleted = (item: { id: string; completed: boolean }) => {
    updateItem.mutate({ id: item.id, tender_id: tenderId, completed: !item.completed });
  };

  const completedCount = items.filter((i) => i.completed).length;

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <CheckSquare className="w-4 h-4 text-primary" />
          Чеклист
        </h4>
        {items.length > 0 && (
          <span className="text-xs text-muted-foreground">
            {completedCount}/{items.length}
          </span>
        )}
      </div>

      {/* Progress bar */}
      {items.length > 0 && (
        <div className="w-full h-1.5 bg-muted/40 rounded-full mb-3 overflow-hidden">
          <div
            className="h-full bg-primary rounded-full transition-all duration-300"
            style={{ width: `${(completedCount / items.length) * 100}%` }}
          />
        </div>
      )}

      {isLoading ? (
        <div className="flex justify-center py-4">
          <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="space-y-1">
          {items.map((item) => (
            <div
              key={item.id}
              className="group flex items-start gap-2 py-1.5 px-2 rounded-lg hover:bg-muted/30 transition-colors"
            >
              <button
                onClick={() => toggleCompleted(item)}
                className="mt-0.5 shrink-0 text-muted-foreground hover:text-primary transition-colors"
              >
                {item.completed ? (
                  <CheckSquare className="w-4 h-4 text-primary" />
                ) : (
                  <Square className="w-4 h-4" />
                )}
              </button>
              <span
                className={`text-sm flex-1 ${
                  item.completed
                    ? "line-through text-muted-foreground"
                    : "text-foreground"
                }`}
              >
                {item.text}
              </span>
              <button
                onClick={() => deleteItem.mutate({ id: item.id, tender_id: tenderId })}
                className="opacity-0 group-hover:opacity-100 p-1 text-muted-foreground hover:text-destructive rounded transition-all"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Add new item */}
      <div className="flex items-center gap-2 mt-2">
        <input
          type="text"
          value={newText}
          onChange={(e) => setNewText(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleAdd()}
          className="input-base flex-1 text-sm py-1.5"
          placeholder="Новый пункт..."
        />
        <button
          onClick={handleAdd}
          disabled={!newText.trim() || adding}
          className="p-1.5 text-primary hover:bg-primary/10 rounded-lg transition-colors disabled:opacity-50"
        >
          {adding ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
        </button>
      </div>
    </div>
  );
}
