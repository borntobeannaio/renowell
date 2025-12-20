import { useState } from "react";
import { useApp } from "@/context/AppContext";
import { Modal } from "@/components/ui/Modal";
import { Plus, Filter } from "lucide-react";
import { NewsItem } from "@/types";

type NewsKind = "all" | "news" | "congrats";

export function NewsModule() {
  const { news, addNews } = useApp();
  const [filter, setFilter] = useState<NewsKind>("all");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [form, setForm] = useState({
    kind: "news" as "news" | "congrats",
    title: "",
    body: "",
    author: "",
    tags: "",
  });

  const filteredNews = news.filter(
    (item) => filter === "all" || item.kind === filter
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim() || !form.body.trim()) return;

    addNews({
      kind: form.kind,
      title: form.title,
      body: form.body,
      author: form.author || "Аноним",
      date: new Date().toISOString().slice(0, 10),
      tags: form.tags.split(",").map((t) => t.trim()).filter(Boolean),
    });

    setForm({ kind: "news", title: "", body: "", author: "", tags: "" });
    setIsModalOpen(false);
  };

  const kindLabel = (kind: string) =>
    kind === "news" ? "Новость" : "Поздравление";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-muted-foreground" />
          <div className="flex gap-1">
            {(["all", "news", "congrats"] as const).map((k) => (
              <button
                key={k}
                onClick={() => setFilter(k)}
                className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                  filter === k
                    ? "bg-primary text-primary-foreground"
                    : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
                }`}
              >
                {k === "all" ? "Все" : kindLabel(k)}
              </button>
            ))}
          </div>
        </div>

        <button
          onClick={() => setIsModalOpen(true)}
          className="btn-primary flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          Добавить
        </button>
      </div>

      <div className="grid gap-4">
        {filteredNews.map((item) => (
          <article key={item.id} className="card-base p-4 animate-fade-in">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-2">
                  <span
                    className={
                      item.kind === "news" ? "chip-info" : "chip-accent"
                    }
                  >
                    {kindLabel(item.kind)}
                  </span>
                  <span className="text-sm text-muted-foreground">
                    {item.date}
                  </span>
                </div>
                <h3 className="text-lg font-semibold text-foreground mb-2">
                  {item.title}
                </h3>
                <p className="text-muted-foreground mb-3">{item.body}</p>
                <div className="flex flex-wrap items-center gap-2">
                  {item.tags.map((tag) => (
                    <span key={tag} className="chip">
                      {tag}
                    </span>
                  ))}
                  <span className="text-sm text-muted-foreground ml-auto">
                    — {item.author}
                  </span>
                </div>
              </div>
            </div>
          </article>
        ))}

        {filteredNews.length === 0 && (
          <div className="text-center py-12 text-muted-foreground">
            Нет публикаций
          </div>
        )}
      </div>

      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Новая публикация"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">
              Тип
            </label>
            <select
              value={form.kind}
              onChange={(e) =>
                setForm({ ...form, kind: e.target.value as "news" | "congrats" })
              }
              className="input-base w-full"
            >
              <option value="news">Новость</option>
              <option value="congrats">Поздравление</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">
              Заголовок
            </label>
            <input
              type="text"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              className="input-base w-full"
              placeholder="Введите заголовок"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">
              Текст
            </label>
            <textarea
              value={form.body}
              onChange={(e) => setForm({ ...form, body: e.target.value })}
              className="input-base w-full min-h-[120px] resize-y"
              placeholder="Введите текст публикации"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">
              Автор
            </label>
            <input
              type="text"
              value={form.author}
              onChange={(e) => setForm({ ...form, author: e.target.value })}
              className="input-base w-full"
              placeholder="Имя автора"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">
              Теги (через запятую)
            </label>
            <input
              type="text"
              value={form.tags}
              onChange={(e) => setForm({ ...form, tags: e.target.value })}
              className="input-base w-full"
              placeholder="тег1, тег2, тег3"
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
              Опубликовать
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
