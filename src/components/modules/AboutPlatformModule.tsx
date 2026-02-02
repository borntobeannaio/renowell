import { useState } from "react";
import { Info, ChevronRight, ArrowLeft, Sparkles, Bell, User, FileText, CheckSquare, Calendar, Users, BookOpen, MessageCircle } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

interface Section {
  id: string;
  title: string;
  icon: React.ElementType;
  content: React.ReactNode;
}

const sections: Section[] = [
  {
    id: "profile",
    title: "Настройка профиля",
    icon: User,
    content: (
      <div className="space-y-4">
        <p>После входа в систему рекомендуем настроить ваш профиль:</p>
        <ol className="list-decimal list-inside space-y-2 text-muted-foreground">
          <li>Нажмите на свой профиль в нижней части боковой панели</li>
          <li>Заполните информацию о себе:
            <ul className="list-disc list-inside ml-4 mt-1 space-y-1">
              <li><strong>Имя и фамилия</strong> — для отображения в системе</li>
              <li><strong>Должность</strong> — ваша роль в компании</li>
              <li><strong>Дата рождения</strong> — коллеги смогут поздравить вас</li>
              <li><strong>Описание</strong> — расскажите о себе</li>
            </ul>
          </li>
          <li>Загрузите фотографию профиля, нажав на иконку камеры</li>
        </ol>
      </div>
    ),
  },
  {
    id: "notifications",
    title: "Настройка уведомлений",
    icon: Bell,
    content: (
      <div className="space-y-4">
        <p>Платформа поддерживает несколько каналов уведомлений:</p>
        
        <div className="space-y-4">
          <div className="p-4 rounded-lg bg-secondary/50">
            <h4 className="font-semibold mb-2">📱 Telegram</h4>
            <ol className="list-decimal list-inside space-y-1 text-sm text-muted-foreground">
              <li>В профиле откройте раздел «Уведомления»</li>
              <li>Нажмите «Привязать Telegram»</li>
              <li>Скопируйте 6-значный код</li>
              <li>Отправьте код боту <code className="bg-background px-1 rounded">@renowell_bot</code> в Telegram</li>
              <li>После привязки вы будете получать уведомления о задачах и дедлайнах</li>
            </ol>
          </div>

          <div className="p-4 rounded-lg bg-secondary/50">
            <h4 className="font-semibold mb-2">🔔 Push-уведомления в браузере</h4>
            <ol className="list-decimal list-inside space-y-1 text-sm text-muted-foreground">
              <li>Включите переключатель «Push-уведомления»</li>
              <li>Разрешите уведомления в браузере</li>
              <li>Теперь вы будете получать оповещения даже при закрытой вкладке</li>
            </ol>
          </div>

          <div className="p-4 rounded-lg bg-secondary/50">
            <h4 className="font-semibold mb-2">✉️ Email</h4>
            <ol className="list-decimal list-inside space-y-1 text-sm text-muted-foreground">
              <li>Включите переключатель «Email-уведомления»</li>
              <li>Уведомления будут приходить на почту, указанную при регистрации</li>
            </ol>
          </div>
        </div>
      </div>
    ),
  },
  {
    id: "sections",
    title: "Основные разделы",
    icon: BookOpen,
    content: (
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="p-4 rounded-lg border bg-card">
          <div className="flex items-center gap-2 mb-2">
            <Sparkles className="w-4 h-4 text-primary" />
            <h4 className="font-semibold">О нас (Бренд)</h4>
          </div>
          <p className="text-sm text-muted-foreground">
            Платформа бренда Renowell, блог руководителя, глоссарий
          </p>
        </div>

        <div className="p-4 rounded-lg border bg-card">
          <div className="flex items-center gap-2 mb-2">
            <FileText className="w-4 h-4 text-primary" />
            <h4 className="font-semibold">Протоколы</h4>
          </div>
          <p className="text-sm text-muted-foreground">
            Создание протоколов совещаний, автоматическое создание задач
          </p>
        </div>

        <div className="p-4 rounded-lg border bg-card">
          <div className="flex items-center gap-2 mb-2">
            <CheckSquare className="w-4 h-4 text-primary" />
            <h4 className="font-semibold">Задачи</h4>
          </div>
          <p className="text-sm text-muted-foreground">
            Просмотр назначенных задач, комментирование, упоминания через @
          </p>
        </div>

        <div className="p-4 rounded-lg border bg-card">
          <div className="flex items-center gap-2 mb-2">
            <Calendar className="w-4 h-4 text-primary" />
            <h4 className="font-semibold">Календарь</h4>
          </div>
          <p className="text-sm text-muted-foreground">
            Дни рождения коллег, дедлайны задач
          </p>
        </div>

        <div className="p-4 rounded-lg border bg-card">
          <div className="flex items-center gap-2 mb-2">
            <Users className="w-4 h-4 text-primary" />
            <h4 className="font-semibold">HR и Офис</h4>
          </div>
          <p className="text-sm text-muted-foreground">
            Список сотрудников, фотогалерея с Яндекс.Диска
          </p>
        </div>

        <div className="p-4 rounded-lg border bg-card">
          <div className="flex items-center gap-2 mb-2">
            <BookOpen className="w-4 h-4 text-primary" />
            <h4 className="font-semibold">База знаний</h4>
          </div>
          <p className="text-sm text-muted-foreground">
            Документация, инструкции, процессы и регламенты
          </p>
        </div>
      </div>
    ),
  },
  {
    id: "faq",
    title: "Частые вопросы",
    icon: MessageCircle,
    content: (
      <div className="space-y-4">
        <div className="p-4 rounded-lg border bg-card">
          <h4 className="font-semibold mb-2">Как упомянуть коллегу?</h4>
          <p className="text-sm text-muted-foreground">
            В комментариях к задачам или протоколам введите <code className="bg-secondary px-1 rounded">@</code> и начните вводить имя — появится список сотрудников для выбора.
          </p>
        </div>

        <div className="p-4 rounded-lg border bg-card">
          <h4 className="font-semibold mb-2">Как загрузить фото профиля?</h4>
          <p className="text-sm text-muted-foreground">
            Откройте профиль, наведите на аватар и нажмите на иконку камеры. Выберите изображение — оно автоматически загрузится.
          </p>
        </div>

        <div className="p-4 rounded-lg border bg-card">
          <h4 className="font-semibold mb-2">Не приходят уведомления в Telegram?</h4>
          <p className="text-sm text-muted-foreground">
            Убедитесь, что бот <code className="bg-secondary px-1 rounded">@renowell_bot</code> привязан к вашему профилю. Если код устарел — сгенерируйте новый.
          </p>
        </div>
      </div>
    ),
  },
];

export function AboutPlatformModule() {
  const [selectedSection, setSelectedSection] = useState<Section | null>(null);

  if (selectedSection) {
    return (
      <div className="space-y-4">
        <button
          onClick={() => setSelectedSection(null)}
          className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Назад
        </button>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <selectedSection.icon className="w-5 h-5 text-primary" />
              {selectedSection.title}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {selectedSection.content}
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-primary to-primary/80 
                        flex items-center justify-center text-primary-foreground shadow-lg shadow-primary/20">
          <Info className="w-6 h-6" />
        </div>
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">О платформе</h1>
          <p className="text-sm text-muted-foreground">Руководство по работе с системой</p>
        </div>
      </div>

      {/* Welcome card */}
      <Card className="bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20">
        <CardHeader>
          <CardTitle>Добро пожаловать на платформу Renowell!</CardTitle>
          <CardDescription>
            Это руководство поможет вам начать работу и использовать все возможности системы.
          </CardDescription>
        </CardHeader>
      </Card>

      {/* Sections grid */}
      <div className="grid gap-4 sm:grid-cols-2">
        {sections.map((section) => (
          <button
            key={section.id}
            onClick={() => setSelectedSection(section)}
            className="card-base p-6 text-left hover:border-primary/30 hover:shadow-md transition-all"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                  <section.icon className="w-5 h-5 text-primary" />
                </div>
                <h3 className="font-semibold">{section.title}</h3>
              </div>
              <ChevronRight className="w-5 h-5 text-muted-foreground" />
            </div>
          </button>
        ))}
      </div>

      {/* Support note */}
      <Card className="bg-secondary/30">
        <CardContent className="pt-6">
          <p className="text-sm text-muted-foreground">
            <strong className="text-foreground">Техническая поддержка:</strong> При возникновении вопросов обращайтесь к администратору системы.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
