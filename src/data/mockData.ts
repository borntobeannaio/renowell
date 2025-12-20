import {
  Employee,
  NewsItem,
  Protocol,
  Task,
  HRVacation,
  HRDoc,
  Photo,
  KBRubric,
  ChatThread,
} from "@/types";

export const mockEmployees: Employee[] = [
  {
    id: "e1",
    name: "Александр Петров",
    role: "Разработчик",
    dept: "IT",
    email: "a.petrov@company.ru",
    phone: "+7 (999) 123-45-67",
    avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Alex",
  },
  {
    id: "e2",
    name: "Мария Иванова",
    role: "HR-менеджер",
    dept: "HR",
    email: "m.ivanova@company.ru",
    phone: "+7 (999) 234-56-78",
    avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Maria",
  },
  {
    id: "e3",
    name: "Дмитрий Сидоров",
    role: "Тимлид",
    dept: "IT",
    email: "d.sidorov@company.ru",
    phone: "+7 (999) 345-67-89",
    avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Dmitry",
  },
  {
    id: "e4",
    name: "Елена Козлова",
    role: "Дизайнер",
    dept: "Design",
    email: "e.kozlova@company.ru",
    phone: "+7 (999) 456-78-90",
    avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Elena",
  },
  {
    id: "e5",
    name: "Игорь Новиков",
    role: "Менеджер проектов",
    dept: "Management",
    email: "i.novikov@company.ru",
    phone: "+7 (999) 567-89-01",
    avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Igor",
  },
];

export const mockNews: NewsItem[] = [
  {
    id: "n1",
    kind: "news",
    title: "Обновление политики удалённой работы",
    body: "С 1 января 2025 года вступают в силу новые правила работы из дома. Теперь сотрудники могут работать удалённо до 3 дней в неделю при согласовании с руководителем.",
    author: "HR-отдел",
    date: "2024-12-18",
    tags: ["политика", "удалёнка"],
  },
  {
    id: "n2",
    kind: "congrats",
    title: "Поздравляем Марию с юбилеем!",
    body: "Сегодня у нашей коллеги Марии Ивановой юбилей — 5 лет в компании! Желаем дальнейших успехов и карьерного роста!",
    author: "Коллектив",
    date: "2024-12-17",
    tags: ["поздравление", "юбилей"],
  },
  {
    id: "n3",
    kind: "news",
    title: "Запуск нового продукта",
    body: "Рады сообщить о успешном запуске нового продукта! Благодарим всю команду за отличную работу. Релиз прошёл без критических ошибок.",
    author: "Продуктовый отдел",
    date: "2024-12-15",
    tags: ["продукт", "релиз"],
  },
];

export const mockProtocols: Protocol[] = [
  {
    id: "p1",
    date: "2024-12-16",
    title: "Планирование спринта 24",
    attendees: ["Дмитрий Сидоров", "Александр Петров", "Елена Козлова"],
    agenda: ["Ретроспектива прошлого спринта", "Планирование задач", "Распределение ресурсов"],
    decisions: [
      { text: "Внедрить новую систему тестирования", responsible: "Александр Петров", createTask: true, due: "2024-12-25" },
      { text: "Обновить документацию API", responsible: "Дмитрий Сидоров", createTask: true, due: "2024-12-23" },
    ],
    links: [],
  },
];

export const mockTasks: Task[] = [
  {
    id: "t1",
    title: "Внедрить новую систему тестирования",
    assignee: "e1",
    due: "2024-12-25",
    status: "inbox",
    labels: ["protocol", "Планирование спринта 24"],
    origin: { type: "protocol", protocolId: "p1" },
  },
  {
    id: "t2",
    title: "Обновить документацию API",
    assignee: "e3",
    due: "2024-12-23",
    status: "doing",
    labels: ["protocol", "Планирование спринта 24"],
    origin: { type: "protocol", protocolId: "p1" },
  },
  {
    id: "t3",
    title: "Подготовить отчёт за квартал",
    assignee: "e5",
    due: "2024-12-28",
    status: "inbox",
    labels: ["отчётность"],
  },
  {
    id: "t4",
    title: "Провести код-ревью",
    assignee: "e3",
    due: "2024-12-20",
    status: "done",
    labels: ["разработка"],
  },
];

export const mockVacations: HRVacation[] = [
  { id: "v1", userId: "e1", from: "2024-12-25", to: "2025-01-08", status: "approved" },
  { id: "v2", userId: "e4", from: "2024-12-30", to: "2025-01-03", status: "pending" },
];

export const mockHRDocs: HRDoc[] = [
  { id: "d1", title: "Трудовой договор (шаблон)", type: "docx", updated: "2024-11-01" },
  { id: "d2", title: "Политика конфиденциальности", type: "pdf", updated: "2024-10-15" },
  { id: "d3", title: "Инструкция по охране труда", type: "pdf", updated: "2024-09-20" },
];

export const mockPhotos: Photo[] = [
  { id: "ph1", url: "https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=400", title: "Корпоратив 2024" },
  { id: "ph2", url: "https://images.unsplash.com/photo-1517048676732-d65bc937f952?w=400", title: "Тимбилдинг" },
  { id: "ph3", url: "https://images.unsplash.com/photo-1556761175-b413da4baf72?w=400", title: "Офис" },
  { id: "ph4", url: "https://images.unsplash.com/photo-1600880292203-757bb62b4baf?w=400", title: "Рабочий процесс" },
];

export const mockKBRubrics: KBRubric[] = [
  {
    id: "kb1",
    title: "Онбординг",
    docs: [
      { id: "kd1", title: "Гайд для новичков", type: "md", updated: "2024-11-15", body: "# Добро пожаловать!\n\nЭто руководство поможет вам быстрее влиться в команду.\n\n## Первые шаги\n\n1. Получите доступ к корпоративной почте\n2. Настройте VPN\n3. Познакомьтесь с командой" },
      { id: "kd2", title: "Настройка рабочего места", type: "md", updated: "2024-10-20", body: "# Настройка рабочего места\n\n## Необходимое ПО\n\n- VS Code\n- Git\n- Docker\n\n## Доступы\n\nОбратитесь к администратору для получения доступов." },
    ],
  },
  {
    id: "kb2",
    title: "Процессы",
    docs: [
      { id: "kd3", title: "Правила код-ревью", type: "md", updated: "2024-12-01", body: "# Код-ревью\n\n## Правила\n\n- Ревью должно быть завершено в течение 24 часов\n- Минимум 2 апрува для мержа\n- Используйте конструктивную критику" },
    ],
  },
];

export const mockChats: ChatThread[] = [
  {
    id: "c1",
    title: "Общий чат",
    type: "group",
    participants: ["e1", "e2", "e3", "e4", "e5"],
    messages: [
      { id: "m1", author: "e1", text: "Привет всем! Как дела с проектом?", ts: Date.now() - 3600000 },
      { id: "m2", author: "e3", text: "Всё по плану, заканчиваем тестирование", ts: Date.now() - 1800000 },
      { id: "m3", author: "e4", text: "Макеты готовы, можно забирать", ts: Date.now() - 900000 },
    ],
  },
  {
    id: "c2",
    title: "IT-отдел",
    type: "group",
    participants: ["e1", "e3"],
    messages: [
      { id: "m4", author: "e3", text: "Нужно обсудить архитектуру нового модуля", ts: Date.now() - 7200000 },
      { id: "m5", author: "e1", text: "Давай завтра созвонимся", ts: Date.now() - 5400000 },
    ],
  },
];
