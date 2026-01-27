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
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false },
    });

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Даты для проверки
    const inOneDay = new Date(today);
    inOneDay.setDate(inOneDay.getDate() + 1);
    
    const inOneWeek = new Date(today);
    inOneWeek.setDate(inOneWeek.getDate() + 7);

    const formatDate = (d: Date) => d.toISOString().split("T")[0];

    console.log(`[deadline-notifications] Checking deadlines for ${formatDate(inOneDay)} and ${formatDate(inOneWeek)}`);

    // Задачи с дедлайном завтра
    const { data: tasksTomorrow, error: errTomorrow } = await supabase
      .from("tasks")
      .select("id, title, assignee_id, due_date")
      .eq("due_date", formatDate(inOneDay))
      .not("assignee_id", "is", null)
      .not("status", "eq", "done")
      .not("status", "eq", "cancelled");

    if (errTomorrow) {
      console.error("[deadline-notifications] Error fetching tomorrow tasks:", errTomorrow);
    }

    // Задачи с дедлайном через неделю
    const { data: tasksWeek, error: errWeek } = await supabase
      .from("tasks")
      .select("id, title, assignee_id, due_date")
      .eq("due_date", formatDate(inOneWeek))
      .not("assignee_id", "is", null)
      .not("status", "eq", "done")
      .not("status", "eq", "cancelled");

    if (errWeek) {
      console.error("[deadline-notifications] Error fetching week tasks:", errWeek);
    }

    const notifications: Array<{
      recipient_id: string;
      type: string;
      title: string;
      body: string;
      related_task_id: string;
    }> = [];

    // Уведомления о дедлайне завтра
    if (tasksTomorrow?.length) {
      for (const task of tasksTomorrow) {
        // Проверяем, не было ли уже уведомления
        const { data: existing } = await supabase
          .from("notifications")
          .select("id")
          .eq("related_task_id", task.id)
          .eq("type", "deadline_day")
          .limit(1);

        if (!existing?.length) {
          notifications.push({
            recipient_id: task.assignee_id,
            type: "deadline_day",
            title: "Дедлайн завтра",
            body: task.title,
            related_task_id: task.id,
          });
        }
      }
    }

    // Уведомления о дедлайне через неделю
    if (tasksWeek?.length) {
      for (const task of tasksWeek) {
        // Проверяем, не было ли уже уведомления
        const { data: existing } = await supabase
          .from("notifications")
          .select("id")
          .eq("related_task_id", task.id)
          .eq("type", "deadline_week")
          .limit(1);

        if (!existing?.length) {
          notifications.push({
            recipient_id: task.assignee_id,
            type: "deadline_week",
            title: "Дедлайн через неделю",
            body: task.title,
            related_task_id: task.id,
          });
        }
      }
    }

    // Вставляем уведомления
    if (notifications.length > 0) {
      const { error: insertError } = await supabase
        .from("notifications")
        .insert(notifications);

      if (insertError) {
        console.error("[deadline-notifications] Error inserting notifications:", insertError);
        throw insertError;
      }

      console.log(`[deadline-notifications] Created ${notifications.length} notifications`);
    } else {
      console.log("[deadline-notifications] No new notifications to create");
    }

    return new Response(
      JSON.stringify({
        success: true,
        created: notifications.length,
        tomorrow: tasksTomorrow?.length ?? 0,
        week: tasksWeek?.length ?? 0,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("[deadline-notifications] Error:", error);
    return new Response(
      JSON.stringify({ error: (error as Error).message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
