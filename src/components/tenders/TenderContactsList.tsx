import { useState } from "react";
import { Plus, Trash2, Phone, User, Edit2, Check, X } from "lucide-react";
import { useTenderContacts, useCreateTenderContact, useUpdateTenderContact, useDeleteTenderContact, TenderContact } from "@/hooks/useTenderContacts";

interface Props {
  tenderId: string;
}

export function TenderContactsList({ tenderId }: Props) {
  const { data: contacts = [], isLoading } = useTenderContacts(tenderId);
  const createContact = useCreateTenderContact();
  const updateContact = useUpdateTenderContact();
  const deleteContact = useDeleteTenderContact();
  const [showAdd, setShowAdd] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", phone: "", description: "" });

  const handleAdd = () => {
    if (!form.name.trim() && !form.phone.trim()) return;
    createContact.mutate({ tender_id: tenderId, ...form });
    setForm({ name: "", phone: "", description: "" });
    setShowAdd(false);
  };

  const startEdit = (c: TenderContact) => {
    setEditingId(c.id);
    setForm({ name: c.name, phone: c.phone, description: c.description });
  };

  const handleSaveEdit = () => {
    if (!editingId) return;
    updateContact.mutate({ id: editingId, tender_id: tenderId, ...form });
    setEditingId(null);
    setForm({ name: "", phone: "", description: "" });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setForm({ name: "", phone: "", description: "" });
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
          <Phone className="w-3.5 h-3.5" />
          Контакты
        </div>
        <button
          onClick={() => { setShowAdd(true); setEditingId(null); setForm({ name: "", phone: "", description: "" }); }}
          className="text-xs text-primary hover:text-primary/80 flex items-center gap-1 transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
          Добавить
        </button>
      </div>

      {/* Add form */}
      {showAdd && (
        <div className="p-3 rounded-lg border border-primary/30 bg-primary/5 mb-2 space-y-2">
          <input
            type="text"
            value={form.name}
            onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))}
            className="input-base w-full text-sm"
            placeholder="Имя контакта"
            autoFocus
          />
          <input
            type="text"
            value={form.phone}
            onChange={(e) => setForm(f => ({ ...f, phone: e.target.value }))}
            className="input-base w-full text-sm"
            placeholder="Телефон"
          />
          <input
            type="text"
            value={form.description}
            onChange={(e) => setForm(f => ({ ...f, description: e.target.value }))}
            className="input-base w-full text-sm"
            placeholder="Описание / должность"
          />
          <div className="flex justify-end gap-2">
            <button onClick={() => setShowAdd(false)} className="p-1.5 text-muted-foreground hover:text-foreground transition-colors">
              <X className="w-4 h-4" />
            </button>
            <button
              onClick={handleAdd}
              disabled={!form.name.trim() && !form.phone.trim()}
              className="p-1.5 text-primary hover:text-primary/80 transition-colors disabled:opacity-50"
            >
              <Check className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Contact cards */}
      {isLoading ? (
        <div className="text-xs text-muted-foreground text-center py-3">Загрузка...</div>
      ) : contacts.length === 0 ? (
        <div className="text-xs text-muted-foreground text-center py-3">Нет контактов</div>
      ) : (
        <div className="space-y-1.5">
          {contacts.map((c) =>
            editingId === c.id ? (
              <div key={c.id} className="p-3 rounded-lg border border-primary/30 bg-primary/5 space-y-2">
                <input type="text" value={form.name} onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))} className="input-base w-full text-sm" placeholder="Имя" />
                <input type="text" value={form.phone} onChange={(e) => setForm(f => ({ ...f, phone: e.target.value }))} className="input-base w-full text-sm" placeholder="Телефон" />
                <input type="text" value={form.description} onChange={(e) => setForm(f => ({ ...f, description: e.target.value }))} className="input-base w-full text-sm" placeholder="Описание" />
                <div className="flex justify-end gap-2">
                  <button onClick={cancelEdit} className="p-1.5 text-muted-foreground hover:text-foreground"><X className="w-4 h-4" /></button>
                  <button onClick={handleSaveEdit} className="p-1.5 text-primary hover:text-primary/80"><Check className="w-4 h-4" /></button>
                </div>
              </div>
            ) : (
              <div
                key={c.id}
                className="group flex items-start gap-3 p-2.5 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors"
              >
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                  <User className="w-4 h-4 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  {c.name && <div className="text-sm font-medium text-foreground">{c.name}</div>}
                  {c.phone && (
                    <a href={`tel:${c.phone}`} className="text-sm text-primary hover:underline flex items-center gap-1">
                      <Phone className="w-3 h-3" />
                      {c.phone}
                    </a>
                  )}
                  {c.description && <div className="text-xs text-muted-foreground mt-0.5">{c.description}</div>}
                </div>
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                  <button onClick={() => startEdit(c)} className="p-1 text-muted-foreground hover:text-foreground">
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={() => deleteContact.mutate({ id: c.id, tender_id: tenderId })} className="p-1 text-muted-foreground hover:text-destructive">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )
          )}
        </div>
      )}
    </div>
  );
}
