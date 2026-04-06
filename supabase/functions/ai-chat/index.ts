import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messages } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    // Create Supabase client to fetch portal data
    const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);

    // Fetch ALL portal data for context
    const [tasksResult, protocolsResult, protocolItemsResult, employeesResult, projectsResult, profilesResult, tendersResult, tenderContactsResult, tenderInteractionsResult, tenderCompaniesResult, tenderCommentsResult, taskCommentsResult] = await Promise.all([
      supabase.from("tasks").select("id, title, status, priority, due_date, labels, project_id, assignee_id, origin_type, origin_id").order("created_at", { ascending: false }).limit(100),
      supabase.from("protocols").select("id, title, date, number, organizer, meeting_type, attendees").order("date", { ascending: false }).limit(50),
      supabase.from("protocol_items").select("id, item_text, responsible, due_date, create_task, task_id, project_id, protocol_id").order("sort_order").limit(200),
      supabase.from("employees").select("id, full_name, position, department, email, phone, birthday").limit(100),
      supabase.from("projects").select("id, name").limit(50),
      supabase.from("profiles").select("id, user_id, first_name, last_name, position").limit(100),
      supabase.from("tenders").select("id, project_name, status, source, manager, budget, area_address, contact_info, notes, company_id, lead_grade, duration_months, tender_start_date").order("created_at", { ascending: false }).limit(100),
      supabase.from("tender_contacts").select("id, tender_id, name, phone, description").order("created_at").limit(200),
      supabase.from("tender_interactions").select("id, tender_id, content, created_at").order("created_at", { ascending: false }).limit(200),
      supabase.from("tender_companies").select("id, name, inn, ogrn, address").limit(100),
      supabase.from("tender_comments").select("id, tender_id, author_id, content, created_at").order("created_at", { ascending: false }).limit(200),
      supabase.from("task_comments").select("id, task_id, author_id, content, created_at").order("created_at", { ascending: false }).limit(200),
    ]);

    const tasks = tasksResult.data || [];
    const protocols = protocolsResult.data || [];
    const protocolItems = protocolItemsResult.data || [];
    const employees = employeesResult.data || [];
    const projects = projectsResult.data || [];
    const profiles = profilesResult.data || [];
    const tenders = tendersResult.data || [];
    const tenderContacts = tenderContactsResult.data || [];
    const tenderInteractions = tenderInteractionsResult.data || [];
    const tenderCompanies = tenderCompaniesResult.data || [];
    const tenderComments = tenderCommentsResult.data || [];
    const taskComments = taskCommentsResult.data || [];

    // Create lookup maps for relationships
    const projectMap = new Map(projects.map(p => [p.id, p.name]));
    const profileMap = new Map(profiles.map(p => [p.id, `${p.first_name || ''} ${p.last_name || ''}`.trim() || 'Без имени']));
    const protocolMap = new Map(protocols.map(p => [p.id, `№${p.number} от ${p.date}: ${p.title}`]));
    const taskMap = new Map(tasks.map(t => [t.id, t.title]));
    const companyMap = new Map(tenderCompanies.map(c => [c.id, c]));

    // Format portal data as context
    const portalContext = `
## Данные портала Renowell (используй для ответов на вопросы):

### Сотрудники (${employees.length}):
${employees.map(e => `- ${e.full_name} | ${e.position || "без должности"} | ${e.department || "без отдела"} | ${e.email || ""} | ${e.phone || ""} | ДР: ${e.birthday || "не указан"}`).join("\n")}

### Пользователи системы (${profiles.length}):
${profiles.map(p => `- ID: ${p.id} | ${p.first_name || ''} ${p.last_name || ''} | ${p.position || "без должности"}`).join("\n")}

### Проекты (${projects.length}):
${projects.map(p => `- ID: ${p.id} | ${p.name}`).join("\n")}

### Задачи (${tasks.length}):
${tasks.map(t => {
  const statusLabels: Record<string, string> = {
    new: "Новая", in_progress: "В работе", review: "На проверке", 
    done: "Готово", on_hold: "Отложено", blocked: "Заблокировано", cancelled: "Отменено"
  };
  const priorityLabels: Record<string, string> = {
    critical: "Критический", high: "Высокий", normal: "Нормальный", low: "Низкий"
  };
  const projectName = t.project_id ? projectMap.get(t.project_id) : null;
  const assigneeName = t.assignee_id ? profileMap.get(t.assignee_id) : null;
  const originInfo = t.origin_type ? `Источник: ${t.origin_type === 'protocol' ? 'Протокол' : t.origin_type}` : '';
  const tComments = taskComments.filter(c => c.task_id === t.id);
  const commentsText = tComments.length > 0
    ? ` | Комментарии: ${tComments.slice(0, 3).map(c => `[${profileMap.get(c.author_id) || '?'}, ${c.created_at?.slice(0, 10)}] ${c.content}`).join('; ')}`
    : '';
  return `- [${statusLabels[t.status] || t.status}] [${priorityLabels[t.priority] || t.priority}] ${t.title} | Проект: ${projectName || "не указан"} | Исполнитель: ${assigneeName || "не назначен"} | Срок: ${t.due_date || "не указан"} | Метки: ${t.labels?.join(", ") || "нет"} ${originInfo}${commentsText}`;
}).join("\n")}

### Протоколы совещаний (${protocols.length}):
${protocols.map(p => {
  const items = protocolItems.filter(i => i.protocol_id === p.id);
  const itemsText = items.length > 0 
    ? `\n  Пункты протокола:\n${items.map(i => {
        const itemProject = i.project_id ? projectMap.get(i.project_id) : null;
        const linkedTask = i.task_id ? taskMap.get(i.task_id) : null;
        return `    • ${i.item_text} | Ответственный: ${i.responsible || "не указан"} | Срок: ${i.due_date || "не указан"} | Проект: ${itemProject || "не указан"}${linkedTask ? ` | Связанная задача: ${linkedTask}` : ''}`;
      }).join("\n")}`
    : '';
  return `- №${p.number} от ${p.date}: ${p.title} | Организатор: ${p.organizer || "не указан"} | Тип: ${p.meeting_type || "не указан"} | Участники: ${p.attendees?.join(", ") || "не указаны"}${itemsText}`;
}).join("\n")}

### Пункты протоколов (${protocolItems.length}):
${protocolItems.map(i => {
  const protocolInfo = i.protocol_id ? protocolMap.get(i.protocol_id) : null;
  const itemProject = i.project_id ? projectMap.get(i.project_id) : null;
  return `- ${i.item_text} | Протокол: ${protocolInfo || "не указан"} | Ответственный: ${i.responsible || "не указан"} | Срок: ${i.due_date || "не указан"} | Проект: ${itemProject || "не указан"} | Задача создана: ${i.create_task ? 'Да' : 'Нет'}`;
}).join("\n")}

### Тендеры (${tenders.length}):
${tenders.map(t => {
  const statusLabels: Record<string, string> = {
    initial_contact: "Первичный контакт", in_progress: "В работе", meeting: "Встреча",
    won: "Выиграли", lost: "Проиграли", cancelled: "Отбой"
  };
  const company = t.company_id ? companyMap.get(t.company_id) : null;
  const contacts = tenderContacts.filter(c => c.tender_id === t.id);
  const interactions = tenderInteractions.filter(i => i.tender_id === t.id);
  const contactsText = contacts.length > 0
    ? `\n  Контакты: ${contacts.map(c => `${c.name || ''} ${c.phone || ''} ${c.description || ''}`.trim()).join('; ')}`
    : '';
  const interactionsText = interactions.length > 0
    ? `\n  Последние взаимодействия: ${interactions.slice(0, 5).map(i => `[${i.created_at?.slice(0, 10)}] ${i.content}`).join('; ')}`
    : '';
  const tComments = tenderComments.filter(c => c.tender_id === t.id);
  const commentsText = tComments.length > 0
    ? `\n  Комментарии: ${tComments.slice(0, 5).map(c => `[${profileMap.get(c.author_id) || '?'}, ${c.created_at?.slice(0, 10)}] ${c.content}`).join('; ')}`
    : '';
  return `- [${statusLabels[t.status] || t.status}] ${t.project_name} | Компания: ${company?.name || "не указана"}${company?.inn ? ` (ИНН: ${company.inn})` : ''} | Менеджер: ${t.manager || "не указан"} | Бюджет: ${t.budget || "не указан"} | Адрес: ${t.area_address || "не указан"} | Источник: ${t.source || "не указан"} | Грейд: ${t.lead_grade || "не указан"}${contactsText}${interactionsText}${commentsText}`;
}).join("\n")}
`;

    // Brand Hub context
    const brandContext = `
## Платформа бренда Renowell (используй для ответов о бренде, позиционировании, ценностях):

### Золотое правило Renowell:
"Ведём проект так, как вели бы свой: чётко и в срок, с упреждением и вниманием к деталям за клиента, чтобы результат работал долгие годы."
Это не слоган, это ключевой смысл, к которому приводим всю деятельность.

### Позиционирование:
Комплексный fit-out офисных пространств для компаний с высокими требованиями; ведём проект как свой — с упреждением, структурой этапов и ответственностью за результат.

### Видение:
Принцип «ведём проект как свой» становится нормой рынка. Разделить ответственность и внимание к процессу и результату, так же, как заказчик.

### Миссия:
Превращаем ремонт офисов в управляемую услугу с чёткой структурой этапов, прозрачной экономикой и предсказуемыми сроками, чтобы каждый рубль и день работали на бизнес-цели заказчика.

### Целевые аудитории:
1. **Не понимают в стройке, но включаются**: Важно превращать сложное в понятное и вдохновляющее. Потребности: вовлечённость и доверие, статус через технологии, пространство под стиль и амбиции.
2. **Понимают в стройке**: Ценят подрядчика-партнёра. Потребности: умеет договариваться по-человечески, технологии ради пользы, проекты, которыми можно гордиться.

### Рациональные выгоды:
- **Партнёрство**: Прозрачная и управляемая экономика, предсказуемые сроки, риск-менеджмент, открытая смета, отсутствие «сюрпризов»
- **Качество**: Стандарты «вшиты» в процесс, чек-листы и snag-лист, протоколы скрытых работ, контроль качества на каждом этапе, меньше дефектов и переделок
- **Инженерно-дизайнерская ценность**: «Умный офис» / IoT, эргономика, дизайн в связке с брендом / HR-KPI, кейсовый «клиентский успех»

### Эмоциональные выгоды:
- **Доверие и спокойствие**: Риски под контролем, открытые цифры, понятные решения и протоколы
- **Чувство поддержки**: «Мы в одной команде», общий язык, ответственность
- **Правильный выбор партнёра**: «Сделано на годы», инженерно выверено, умные системы, актуальные материалы

### Ценности бренда:
1. **Безопасность** (safety-first): Безопасность — приоритет №1 на каждом объекте
2. **Открытость** (прозрачность): Норма прозрачности, признаём риски
3. **Ответственность** (надёжность): Держим слово, предсказуемый результат
4. **Профессионализм** (экспертиза): Культ ремесла и экспертиза
5. **Сотрудничество** (партнёрство): Партнёрская модель взаимодействия

### Характер бренда:
- **Аккуратность**: Чисто, собрано
- **Исполнительность и надёжность**: Следуем договорённостям, ценим вашу уверенность в нас
- **Организованность**: Структурность; держим этапы, метрики, чек-листы
- **Гибкость**: Предлагаем варианты без потери стандарта

### Тональность коммуникации:
- **Ясно**: Понятно с первого раза
- **Уверенно и ровно**: Без паники и бравады
- **Компетентно**: Без директивности, корректно, «по делу»
- **По-партнёрски**: «Мы+Вы» как команда, такт, не мы выше

### Атрибуты бренда:
- **Продукт**: Комплексная реализация, цифровой контроль, эргономика, тренды, умные системы / IoT, High-tech решения
- **Сервис**: «Проект-манифест», единая команда с клиентом, прозрачный процесс (отчёты, план-факт, трекер задач, открытая смета), чек-листы / snag-лист, риск-менеджмент, Value Engineering, «Язык клиента»
- **Репутация**: Партнёрства, NPS, «Понятные партнёры», культура открытости
- **Дополнительно**: Эмпатия, вовлечённость руководителей

### Глоссарий бренда:
- **Fit-out**: Комплексный ремонт и отделка офисного пространства «под ключ»
- **Snag-лист**: Перечень недочётов для устранения перед сдачей объекта
- **Value Engineering**: Оптимизация решений для достижения максимальной ценности при контроле бюджета
- **IoT**: Internet of Things — умные системы управления офисом
- **NPS**: Net Promoter Score — индекс лояльности клиентов
- **HR-KPI**: Ключевые показатели эффективности пространства для сотрудников
- **План-факт**: Сравнение плановых и фактических показателей проекта
- **Риск-менеджмент**: Управление рисками на всех этапах проекта
- **Протокол скрытых работ**: Документальная фиксация работ, которые будут скрыты отделкой

### Предпосылки бренда:
- **Care Economy**: Экономика заботы — бизнес-модель, где ценность создаётся через внимание к клиенту и его потребностям. Renowell ведёт проект как свой, потому что забота о результате — это наша основа.
- **H2H (Human to Human)**: Человек к человеку. В B2B-сегменте решения принимают люди. Мы строим отношения на доверии, понимании и общем языке.
- **Прозрачность как норма**: Открытые сметы, честные сроки, признание рисков — это не конкурентное преимущество, а базовое ожидание современного клиента.

### Как использовать платформу бренда:
- Проводите тренинги по платформе бренда для новых сотрудников
- Используйте формулировки из платформы в презентациях и письмах
- При сомнениях — сверяйтесь с золотым правилом
- Регулярно проводите Q&A-сессии по вопросам бренда
`;

    const systemPrompt = `Ты - умный AI-ассистент для корпоративного портала Renowell. Ты имеешь полный доступ к данным портала и платформе бренда. Можешь отвечать на любые вопросы о сотрудниках, задачах, протоколах, проектах, а также о бренде Renowell (позиционирование, ценности, характер, тональность, выгоды и т.д.).

Правила:
- Отвечай кратко, по делу и на русском языке
- Используй данные портала и платформу бренда для ответов на вопросы
- Если информация есть в данных — используй её
- Если информации нет — честно скажи об этом
- Будь дружелюбным и профессиональным
- При поиске сотрудников/задач показывай релевантную информацию
- Можешь анализировать связи между данными (задачи по проектам, пункты протоколов, исполнители и т.д.)
- При ответах о задачах по проекту - ищи по названию проекта в данных задач
- При ответах о протоколах - включай информацию о пунктах протокола
- При вопросах о тендерах — используй данные тендеров, включая контакты, компании, взаимодействия
- При вопросах о бренде (позиционирование, ценности, миссия, видение, характер, тональность, выгоды, атрибуты) — используй платформу бренда
- Можешь помогать формулировать тексты в соответствии с тональностью бренда

${brandContext}

${portalContext}`;

    console.log("AI context loaded:", {
      tasks: tasks.length,
      protocols: protocols.length,
      protocolItems: protocolItems.length,
      employees: employees.length,
      projects: projects.length,
      profiles: profiles.length,
      tenders: tenders.length,
      tenderContacts: tenderContacts.length,
      tenderInteractions: tenderInteractions.length,
    });

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          ...messages,
        ],
        stream: true,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Превышен лимит запросов, попробуйте позже." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Требуется пополнение баланса AI." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const text = await response.text();
      console.error("AI gateway error:", response.status, text);
      return new Response(JSON.stringify({ error: "Ошибка AI сервиса" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (error) {
    console.error("AI chat error:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
