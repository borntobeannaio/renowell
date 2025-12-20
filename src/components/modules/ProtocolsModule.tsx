import { useState } from "react";
import { useApp } from "@/context/AppContext";
import { Modal } from "@/components/ui/Modal";
import { Plus, ChevronDown, ChevronUp, Trash2 } from "lucide-react";
import { Decision } from "@/types";

export function ProtocolsModule() {
  const { protocols, addProtocol, employees } = useApp();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [form, setForm] = useState({
    date: new Date().toISOString().slice(0, 10),
    title: "",
    attendees: "",
    agenda: "",
  });
  const [decisions, setDecisions] = useState<Decision[]>([
    { text: "", responsible: "", createTask: false },
  ]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim()) return;

    addProtocol({
      date: form.date,
      title: form.title,
      attendees: form.attendees.split(",").map((a) => a.trim()).filter(Boolean),
      agenda: form.agenda.split(",").map((a) => a.trim()).filter(Boolean),
      decisions: decisions.filter((d) => d.text.trim()),
      links: [],
    });

    setForm({
      date: new Date().toISOString().slice(0, 10),
      title: "",
      attendees: "",
      agenda: "",
    });
    setDecisions([{ text: "", responsible: "", createTask: false }]);
    setIsModalOpen(false);
  };

  const updateDecision = (index: number, updates: Partial<Decision>) => {
    setDecisions((prev) =>
      prev.map((d, i) => (i === index ? { ...d, ...updates } : d))
    );
  };

  const addDecision = () => {
    setDecisions((prev) => [...prev, { text: "", responsible: "", createTask: false }]);
  };

  const removeDecision = (index: number) => {
    setDecisions((prev) => prev.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <p className="text-muted-foreground">
          Всего протоколов: {protocols.length}
        </p>
        <button
          onClick={() => setIsModalOpen(true)}
          className="btn-primary flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          Новый протокол
        </button>
      </div>

      <div className="space-y-4">
        {protocols.map((protocol) => (
          <div key={protocol.id} className="card-base overflow-hidden animate-fade-in">
            <button
              onClick={() =>
                setExpandedId(expandedId === protocol.id ? null : protocol.id)
              }
              className="w-full p-4 flex items-center justify-between hover:bg-secondary/50 transition-colors"
            >
              <div className="flex items-center gap-4">
                <span className="text-sm text-muted-foreground">
                  {protocol.date}
                </span>
                <h3 className="font-medium text-foreground">{protocol.title}</h3>
                <span className="chip">
                  {protocol.attendees.length} участников
                </span>
              </div>
              {expandedId === protocol.id ? (
                <ChevronUp className="w-5 h-5 text-muted-foreground" />
              ) : (
                <ChevronDown className="w-5 h-5 text-muted-foreground" />
              )}
            </button>

            {expandedId === protocol.id && (
              <div className="px-4 pb-4 border-t border-border animate-slide-up">
                <div className="pt-4 space-y-4">
                  <div>
                    <h4 className="text-sm font-medium text-muted-foreground mb-2">
                      Участники
                    </h4>
                    <div className="flex flex-wrap gap-2">
                      {protocol.attendees.map((a, i) => (
                        <span key={i} className="chip">
                          {a}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div>
                    <h4 className="text-sm font-medium text-muted-foreground mb-2">
                      Повестка
                    </h4>
                    <ul className="list-disc list-inside text-foreground space-y-1">
                      {protocol.agenda.map((item, i) => (
                        <li key={i}>{item}</li>
                      ))}
                    </ul>
                  </div>

                  <div>
                    <h4 className="text-sm font-medium text-muted-foreground mb-2">
                      Решения
                    </h4>
                    <div className="space-y-2">
                      {protocol.decisions.map((d, i) => (
                        <div
                          key={i}
                          className="p-3 bg-secondary/50 rounded-lg flex items-start justify-between gap-4"
                        >
                          <div>
                            <p className="text-foreground">{d.text}</p>
                            <p className="text-sm text-muted-foreground mt-1">
                              Ответственный: {d.responsible}
                              {d.createTask && d.due && ` • Срок: ${d.due}`}
                            </p>
                          </div>
                          {d.createTask && (
                            <span className="chip-success shrink-0">
                              Задача создана
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        ))}

        {protocols.length === 0 && (
          <div className="text-center py-12 text-muted-foreground">
            Нет протоколов
          </div>
        )}
      </div>

      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Новый протокол"
        size="lg"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">
                Дата
              </label>
              <input
                type="date"
                value={form.date}
                onChange={(e) => setForm({ ...form, date: e.target.value })}
                className="input-base w-full"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">
                Тема совещания
              </label>
              <input
                type="text"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                className="input-base w-full"
                placeholder="Введите тему"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">
              Участники (через запятую)
            </label>
            <input
              type="text"
              value={form.attendees}
              onChange={(e) => setForm({ ...form, attendees: e.target.value })}
              className="input-base w-full"
              placeholder="Иван Иванов, Петр Петров"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">
              Повестка (через запятую)
            </label>
            <input
              type="text"
              value={form.agenda}
              onChange={(e) => setForm({ ...form, agenda: e.target.value })}
              className="input-base w-full"
              placeholder="Пункт 1, Пункт 2"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-3">
              <label className="text-sm font-medium text-foreground">
                Решения
              </label>
              <button
                type="button"
                onClick={addDecision}
                className="text-sm text-primary hover:underline"
              >
                + Добавить решение
              </button>
            </div>

            <div className="space-y-4">
              {decisions.map((decision, index) => (
                <div
                  key={index}
                  className="p-4 bg-secondary/50 rounded-lg space-y-3"
                >
                  <div className="flex items-start gap-3">
                    <div className="flex-1 space-y-3">
                      <input
                        type="text"
                        value={decision.text}
                        onChange={(e) =>
                          updateDecision(index, { text: e.target.value })
                        }
                        className="input-base w-full"
                        placeholder="Текст решения"
                      />

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <select
                          value={decision.responsible}
                          onChange={(e) =>
                            updateDecision(index, { responsible: e.target.value })
                          }
                          className="input-base w-full"
                        >
                          <option value="">Выберите ответственного</option>
                          {employees.map((emp) => (
                            <option key={emp.id} value={emp.name}>
                              {emp.name}
                            </option>
                          ))}
                        </select>

                        <div className="flex items-center gap-4">
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={decision.createTask}
                              onChange={(e) =>
                                updateDecision(index, {
                                  createTask: e.target.checked,
                                  due: e.target.checked ? decision.due : undefined,
                                })
                              }
                              className="w-4 h-4 rounded border-input text-primary focus:ring-ring"
                            />
                            <span className="text-sm text-foreground">
                              Создать задачу
                            </span>
                          </label>
                        </div>
                      </div>

                      {decision.createTask && (
                        <div className="animate-slide-up">
                          <label className="block text-sm font-medium text-foreground mb-1.5">
                            Срок выполнения
                          </label>
                          <input
                            type="date"
                            value={decision.due || ""}
                            onChange={(e) =>
                              updateDecision(index, { due: e.target.value })
                            }
                            className="input-base w-full md:w-auto"
                          />
                        </div>
                      )}
                    </div>

                    {decisions.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeDecision(index)}
                        className="p-2 text-destructive hover:bg-destructive/10 rounded-md transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
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
              Сохранить
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
