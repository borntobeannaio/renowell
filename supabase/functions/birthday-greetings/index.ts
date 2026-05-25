// Автоматические поздравления с днём рождения:
// - находит сотрудников, у кого сегодня (МСК) день рождения
// - через Lovable AI генерирует тёплый персональный текст
// - публикует поздравление в ленте новостей (news_posts)
// - отправляет Telegram-сообщение имениннику и всем сотрудникам с привязанным TG
// - логирует факт поздравления (один сотрудник = 1 поздравление в год)

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;
const TELEGRAM_BOT_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN")!;

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);

function todayMoscow(): { month: number; day: number; year: number; iso: string } {
  const now = new Date();
  const msk = new Date(now.toLocaleString("en-US", { timeZone: "Europe/Moscow" }));
  return {
    month: msk.getMonth() + 1,
    day: msk.getDate(),
    year: msk.getFullYear(),
    iso: msk.toISOString().slice(0, 10),
  };
}

function calcAge(birthdayIso: string, todayYear: number, todayMonth: number, todayDay: number): number | null {
  const [y, m, d] = birthdayIso.split("-").map(Number);
  if (!y || y < 1900) return null;
  let age = todayYear - y;
  if (todayMonth < m || (todayMonth === m && todayDay < d)) age -= 1;
  return age;
}

interface AiGreeting {
  newsTitle: string;
  newsBody: string;
  telegramPersonal: string;
  telegramBroadcast: string;
}

async function generateGreeting(employee: {
  full_name: string;
  first_name?: string | null;
  position?: string | null;
  age?: number | null;
}): Promise<AiGreeting> {
  const sys = `Ты пишешь тёплые, душевные и каждый раз РАЗНЫЕ поздравления с днём рождения для сотрудников компании Renowell.
Стиль: искренний, человечный, без официоза и без штампов. Можно лёгкие эмодзи (1–2 на блок, не больше). Без хэштегов.
Язык: русский. Обращение на «ты», по имени.
Никогда не выдумывай факты о человеке — опирайся только на имя, должность и возраст (если он указан).`;

  const ageHint = employee.age && employee.age > 0 && employee.age < 100
    ? `Возраст сегодня: ${employee.age}.`
    : "Возраст не указывать.";

  const user = `Сотрудник: ${employee.full_name}${employee.first_name ? ` (имя: ${employee.first_name})` : ""}.
Должность: ${employee.position || "сотрудник"}.
${ageHint}

Сгенерируй 4 текста для одного и того же поздравления:
1) newsTitle — короткий заголовок поста в новостях (до 60 символов), упомяни имя.
2) newsBody — пост в ленту новостей (2–4 коротких абзаца, тёплое поздравление от лица команды Renowell, можно 1 эмодзи).
3) telegramPersonal — личное сообщение имениннику в Telegram от команды Renowell (2–4 предложения, на «ты», тепло и по-доброму, 1–2 эмодзи).
4) telegramBroadcast — короткое сообщение всем коллегам в Telegram: «Сегодня день рождения у …», пригласи поздравить (2–3 предложения, 1 эмодзи).

Каждое поздравление должно ощущаться свежим и непохожим на шаблон. Ответ верни СТРОГО в формате JSON без какого-либо текста вокруг:
{"newsTitle":"...","newsBody":"...","telegramPersonal":"...","telegramBroadcast":"..."}`;

  const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${LOVABLE_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages: [
        { role: "system", content: sys },
        { role: "user", content: user },
      ],
      response_format: { type: "json_object" },
    }),
  });

  if (!resp.ok) {
    const txt = await resp.text();
    throw new Error(`Lovable AI ${resp.status}: ${txt}`);
  }
  const data = await resp.json();
  const content = data?.choices?.[0]?.message?.content ?? "{}";
  const parsed = JSON.parse(content) as AiGreeting;
  if (!parsed.newsTitle || !parsed.newsBody || !parsed.telegramPersonal || !parsed.telegramBroadcast) {
    throw new Error("AI вернул неполный JSON");
  }
  return parsed;
}

async function tgSend(chatId: string, text: string): Promise<boolean> {
  try {
    const r = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: "HTML",
        disable_web_page_preview: true,
      }),
    });
    if (!r.ok) {
      console.warn(`[birthday] TG ${chatId} failed:`, r.status, await r.text());
      return false;
    }
    return true;
  } catch (e) {
    console.warn(`[birthday] TG ${chatId} threw:`, e);
    return false;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const today = todayMoscow();
  const monthDay = `${String(today.month).padStart(2, "0")}-${String(today.day).padStart(2, "0")}`;
  console.log(`[birthday] checking ${monthDay} (МСК ${today.iso})`);

  // 1. Все сотрудники с днём рождения сегодня (по MM-DD)
  const { data: employees, error: empErr } = await supabase
    .from("employees")
    .select("id, full_name, first_name, position, birthday, profile_id")
    .not("birthday", "is", null);

  if (empErr) {
    return new Response(JSON.stringify({ error: empErr.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const birthdays = (employees ?? []).filter((e) => {
    if (!e.birthday) return false;
    const [, m, d] = String(e.birthday).split("-");
    return `${m}-${d}` === monthDay;
  });

  if (birthdays.length === 0) {
    return new Response(JSON.stringify({ ok: true, message: "Сегодня именинников нет", date: monthDay }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // 2. Уже поздравленные в этом году — отфильтровываем
  const { data: alreadyLogged } = await supabase
    .from("birthday_greetings_log")
    .select("employee_id")
    .eq("year", today.year)
    .in("employee_id", birthdays.map((b) => b.id));

  const loggedSet = new Set((alreadyLogged ?? []).map((r) => r.employee_id));
  const targets = birthdays.filter((b) => !loggedSet.has(b.id));

  if (targets.length === 0) {
    return new Response(JSON.stringify({ ok: true, message: "Все именинники уже поздравлены", date: monthDay }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // 3. Список Telegram-чатов всех сотрудников (для broadcast)
  const { data: tgProfiles } = await supabase
    .from("profiles")
    .select("id, telegram_chat_id, notify_telegram")
    .not("telegram_chat_id", "is", null);

  const broadcastChats = (tgProfiles ?? [])
    .filter((p) => p.telegram_chat_id && p.notify_telegram !== false);

  const results: Array<{ employee: string; ok: boolean; error?: string }> = [];

  for (const emp of targets) {
    try {
      const age = emp.birthday ? calcAge(emp.birthday, today.year, today.month, today.day) : null;

      // 3.1 — AI
      const greeting = await generateGreeting({
        full_name: emp.full_name,
        first_name: emp.first_name,
        position: emp.position,
        age,
      });

      // 3.2 — Пост в ленте новостей
      const { data: post, error: postErr } = await supabase
        .from("news_posts")
        .insert({
          kind: "congrats",
          title: greeting.newsTitle,
          body: greeting.newsBody,
          author: "Команда Renowell",
          tags: ["день рождения"],
          related_employee_id: emp.id,
          date: today.iso,
        })
        .select("id")
        .single();

      if (postErr) throw new Error(`news_posts insert: ${postErr.message}`);

      // 3.3 — Telegram имениннику (если есть привязка)
      let telegramSent = false;
      let personalChatId: string | null = null;
      if (emp.profile_id) {
        const personalProfile = (tgProfiles ?? []).find((p) => p.id === emp.profile_id);
        if (personalProfile?.telegram_chat_id) {
          personalChatId = personalProfile.telegram_chat_id;
          telegramSent = await tgSend(personalChatId, greeting.telegramPersonal);
        }
      }

      // 3.4 — Telegram всем остальным
      const broadcastText =
        `🎂 <b>День рождения сегодня!</b>\n\n` +
        greeting.telegramBroadcast +
        `\n\n— Команда Renowell`;
      for (const chat of broadcastChats) {
        if (chat.telegram_chat_id === personalChatId) continue; // имениннику уже отправили личное
        await tgSend(chat.telegram_chat_id!, broadcastText);
      }

      // 3.5 — Лог
      await supabase.from("birthday_greetings_log").insert({
        employee_id: emp.id,
        year: today.year,
        news_post_id: post.id,
        telegram_sent: telegramSent,
      });

      results.push({ employee: emp.full_name, ok: true });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error(`[birthday] failed for ${emp.full_name}:`, msg);
      results.push({ employee: emp.full_name, ok: false, error: msg });
    }
  }

  return new Response(JSON.stringify({ ok: true, date: monthDay, processed: results }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
