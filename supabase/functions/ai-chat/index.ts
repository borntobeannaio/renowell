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

    // Fetch portal data for context
    const [tasksResult, protocolsResult, employeesResult, projectsResult] = await Promise.all([
      supabase.from("tasks").select("id, title, status, priority, due_date, labels, project_id").order("created_at", { ascending: false }).limit(50),
      supabase.from("protocols").select("id, title, date, number, organizer, meeting_type, attendees").order("date", { ascending: false }).limit(20),
      supabase.from("employees").select("id, full_name, position, department, email, phone, birthday").limit(100),
      supabase.from("projects").select("id, name").limit(50),
    ]);

    // Create project lookup map
    const projectMap = new Map(projectsResult.data?.map(p => [p.id, p.name]) || []);

    const tasks = tasksResult.data || [];
    const protocols = protocolsResult.data || [];
    const employees = employeesResult.data || [];
    const projects = projectsResult.data || [];

    // Format portal data as context
    const portalContext = `
## Данные портала Renowell (используй для ответов на вопросы):

### Сотрудники (${employees.length}):
${employees.map(e => `- ${e.full_name} | ${e.position || "без должности"} | ${e.department || "без отдела"} | ${e.email || ""} | ${e.phone || ""} | ДР: ${e.birthday || "не указан"}`).join("\n")}

### Проекты (${projects.length}):
${projects.map(p => `- ${p.name}`).join("\n")}

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
  return `- [${statusLabels[t.status] || t.status}] [${priorityLabels[t.priority] || t.priority}] ${t.title} | Проект: ${projectName || "не указан"} | Срок: ${t.due_date || "не указан"} | Метки: ${t.labels?.join(", ") || "нет"}`;
}).join("\n")}

### Протоколы совещаний (${protocols.length}):
${protocols.map(p => `- №${p.number} от ${p.date}: ${p.title} | Организатор: ${p.organizer || "не указан"} | Тип: ${p.meeting_type || "не указан"} | Участники: ${p.attendees?.join(", ") || "не указаны"}`).join("\n")}
`;

    const systemPrompt = `Ты - умный AI-ассистент для корпоративного портала Renowell. Ты имеешь доступ к данным портала и можешь отвечать на вопросы о сотрудниках, задачах, протоколах и проектах.

Правила:
- Отвечай кратко, по делу и на русском языке
- Используй данные портала для ответов на вопросы
- Если информация есть в данных — используй её
- Если информации нет — честно скажи об этом
- Будь дружелюбным и профессиональным
- При поиске сотрудников/задач показывай релевантную информацию

${portalContext}`;

    console.log("AI context loaded:", {
      tasks: tasks.length,
      protocols: protocols.length,
      employees: employees.length,
      projects: projects.length,
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
