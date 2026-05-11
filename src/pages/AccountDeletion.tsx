import { Link } from "react-router-dom";
import { ArrowLeft, Mail, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function AccountDeletion() {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="container mx-auto px-4 py-4 flex items-center gap-4">
          <Link to="/" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" /> На главную
          </Link>
          <h1 className="text-lg font-semibold">Удаление аккаунта</h1>
        </div>
      </header>
      <main className="container mx-auto px-4 py-8 max-w-3xl space-y-6">
        <div className="rounded-lg border bg-card p-6 space-y-4">
          <h2 className="text-xl font-semibold">Как удалить аккаунт Renowell</h2>
          <p className="text-muted-foreground">
            Renowell — корпоративный сервис компании Renowell. Регистрация открыта только
            для сотрудников. Вы можете запросить полное удаление своей учётной записи
            и связанных данных одним из двух способов:
          </p>

          <div className="space-y-4">
            <div className="rounded-md border p-4">
              <h3 className="font-medium mb-2 flex items-center gap-2">
                <Trash2 className="h-4 w-4" /> Способ 1. Из приложения
              </h3>
              <ol className="list-decimal list-inside text-sm text-muted-foreground space-y-1">
                <li>Войдите в приложение Renowell.</li>
                <li>Откройте раздел «Профиль».</li>
                <li>В блоке «Удаление аккаунта» нажмите «Запросить удаление».</li>
                <li>Подтвердите действие. Запрос поступит администратору.</li>
              </ol>
              <Button asChild className="mt-3" size="sm">
                <Link to="/profile">Перейти в профиль</Link>
              </Button>
            </div>

            <div className="rounded-md border p-4">
              <h3 className="font-medium mb-2 flex items-center gap-2">
                <Mail className="h-4 w-4" /> Способ 2. По электронной почте
              </h3>
              <p className="text-sm text-muted-foreground">
                Отправьте письмо с темой «Удаление аккаунта Renowell» на адрес{" "}
                <a className="text-primary underline" href="mailto:info@silkagro.ru">
                  info@silkagro.ru
                </a>
                . Укажите email, привязанный к учётной записи.
              </p>
            </div>
          </div>

          <div className="rounded-md bg-muted p-4 text-sm space-y-2">
            <p className="font-medium">Что будет удалено:</p>
            <ul className="list-disc list-inside text-muted-foreground">
              <li>Учётная запись и профиль (имя, фото, контакты).</li>
              <li>Личные сообщения и комментарии.</li>
              <li>Push-подписки и связи с Telegram.</li>
              <li>Черновики форм и персональные настройки.</li>
            </ul>
            <p className="font-medium pt-2">Что может быть сохранено:</p>
            <ul className="list-disc list-inside text-muted-foreground">
              <li>
                Записи аудита и протоколы встреч с упоминанием участника — в обезличенном
                виде, если того требует законодательство РФ.
              </li>
            </ul>
            <p className="text-muted-foreground pt-2">Срок выполнения запроса: до 30 календарных дней.</p>
          </div>
        </div>
      </main>
    </div>
  );
}
