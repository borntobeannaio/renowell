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
    const [tasksResult, protocolsResult, protocolItemsResult, employeesResult, projectsResult, profilesResult] = await Promise.all([
      supabase.from("tasks").select("id, title, status, priority, due_date, labels, project_id, assignee_id, origin_type, origin_id").order("created_at", { ascending: false }).limit(100),
      supabase.from("protocols").select("id, title, date, number, organizer, meeting_type, attendees").order("date", { ascending: false }).limit(50),
      supabase.from("protocol_items").select("id, item_text, responsible, due_date, create_task, task_id, project_id, protocol_id").order("sort_order").limit(200),
      supabase.from("employees").select("id, full_name, position, department, email, phone, birthday").limit(100),
      supabase.from("projects").select("id, name").limit(50),
      supabase.from("profiles").select("id, user_id, first_name, last_name, position").limit(100),
    ]);

    const tasks = tasksResult.data || [];
    const protocols = protocolsResult.data || [];
    const protocolItems = protocolItemsResult.data || [];
    const employees = employeesResult.data || [];
    const projects = projectsResult.data || [];
    const profiles = profilesResult.data || [];

    // Create lookup maps for relationships
    const projectMap = new Map(projects.map(p => [p.id, p.name]));
    const profileMap = new Map(profiles.map(p => [p.id, `${p.first_name || ''} ${p.last_name || ''}`.trim() || 'Без имени']));
    const protocolMap = new Map(protocols.map(p => [p.id, `№${p.number} от ${p.date}: ${p.title}`]));
    const taskMap = new Map(tasks.map(t => [t.id, t.title]));

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
  return `- [${statusLabels[t.status] || t.status}] [${priorityLabels[t.priority] || t.priority}] ${t.title} | Проект: ${projectName || "не указан"} | Исполнитель: ${assigneeName || "не назначен"} | Срок: ${t.due_date || "не указан"} | Метки: ${t.labels?.join(", ") || "нет"} ${originInfo}`;
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
`;

    const systemPrompt = `Ты - умный AI-ассистент для корпоративного портала Renowell. Ты имеешь полный доступ к данным портала и можешь отвечать на любые вопросы о сотрудниках, задачах, протоколах, проектах и их взаимосвязях.

Правила:
- Отвечай кратко, по делу и на русском языке
- Используй данные портала для ответов на вопросы
- Если информация есть в данных — используй её
- Если информации нет — честно скажи об этом
- Будь дружелюбным и профессиональным
- При поиске сотрудников/задач показывай релевантную информацию
- Можешь анализировать связи между данными (задачи по проектам, пункты протоколов, исполнители и т.д.)
- При ответах о задачах по проекту - ищи по названию проекта в данных задач
- При ответах о протоколах - включай информацию о пунктах протокола

${portalContext}`;

    console.log("AI context loaded:", {
      tasks: tasks.length,
      protocols: protocols.length,
      protocolItems: protocolItems.length,
      employees: employees.length,
      projects: projects.length,
      profiles: profiles.length,
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
