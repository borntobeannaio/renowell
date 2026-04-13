import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Mapping of section types to system project IDs
const SECTION_TYPE_PROJECT_IDS: Partial<Record<string, string>> = {
  tender: "bf2ef5b4-1fe7-4e69-b533-30393a4d386b",
  business: "5b30ab38-7ecd-4643-960e-8dc2bf353d98",
  hr: "620c7f0e-6558-4116-8e80-7681457127b8",
  goals: "39036f39-f9f7-4286-bc70-2c14c10824d2",
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const body = await req.json().catch(() => ({}));
    const mode = body.mode || 'sync';

    if (mode === 'rebuild') {
      return await handleRebuild(supabase, body.protocol_id);
    }

    return new Response(JSON.stringify({ error: 'Unknown mode' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: unknown) {
    console.error('Error:', error);
    const message = error instanceof Error ? error.message : String(error);
    return new Response(JSON.stringify({ success: false, error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

async function handleRebuild(supabase: any, protocolId: string) {
  if (!protocolId) throw new Error('protocol_id is required for rebuild mode');

  const results = {
    tasks_deleted: 0,
    tasks_created: 0,
    items_linked: 0,
    comments_copied: 0,
    completed_tasks: 0,
    errors: [] as string[],
  };

  // ===== 1. Load employees for name→profile_id mapping =====
  const { data: employees } = await supabase
    .from('employees')
    .select('full_name, first_name, last_name, profile_id');

  const employeeList = (employees || []).filter((e: any) => e.profile_id);

  // Order-insensitive name matching: "Берлизова Татьяна" matches "Татьяна Берлизова"
  function findProfileId(name: string): string | null {
    const nameParts = new Set(name.toLowerCase().trim().split(/\s+/));
    for (const emp of employeeList) {
      const fullParts = new Set(emp.full_name.toLowerCase().trim().split(/\s+/));
      if (nameParts.size === fullParts.size && [...nameParts].every((p: string) => fullParts.has(p))) {
        return emp.profile_id;
      }
      // Also try first+last
      const displayParts = new Set([emp.first_name, emp.last_name].filter(Boolean).map((s: string) => s.toLowerCase()));
      if (nameParts.size === displayParts.size && [...nameParts].every((p: string) => displayParts.has(p))) {
        return emp.profile_id;
      }
    }
    // Fallback: partial match on last name
    const nameArr = [...nameParts];
    for (const emp of employeeList) {
      const lastName = (emp.last_name || emp.full_name.split(' ')[0] || '').toLowerCase();
      if (nameArr.includes(lastName)) return emp.profile_id;
    }
    return null;
  }

  function getProfileIds(responsibleStr: string | null): string[] {
    if (!responsibleStr) return [];
    const ids: string[] = [];
    const names = responsibleStr.split(/[,;\/]/).map(n => n.trim()).filter(Boolean);
    for (const name of names) {
      const pid = findProfileId(name);
      if (pid) ids.push(pid);
    }
    return [...new Set(ids)];
  }

  // ===== 2. Clear all task_id references from protocol_items =====
  console.log('Step 1: Clearing task_id references...');
  await supabase.from('protocol_items').update({ task_id: null }).not('task_id', 'is', null);

  // ===== 3. Delete all existing tasks (cascading via comment_mentions → task_comments → tasks) =====
  console.log('Step 2: Deleting existing tasks...');

  // Get all task IDs first for comment_mentions cleanup
  const { data: allTasks } = await supabase.from('tasks').select('id');
  const allTaskIds = (allTasks || []).map((t: any) => t.id);

  if (allTaskIds.length > 0) {
    // Delete comment_mentions for task_comments
    const { data: taskComments } = await supabase
      .from('task_comments')
      .select('id')
      .in('task_id', allTaskIds);
    const commentIds = (taskComments || []).map((c: any) => c.id);
    
    if (commentIds.length > 0) {
      await supabase.from('comment_mentions').delete().in('comment_id', commentIds);
    }

    // Delete task_comments
    await supabase.from('task_comments').delete().in('task_id', allTaskIds);

    // Delete notifications linked to tasks
    await supabase.from('notifications').delete().in('related_task_id', allTaskIds);

    // Delete tasks
    const { error: deleteError } = await supabase.from('tasks').delete().in('id', allTaskIds);
    if (deleteError) throw new Error(`Failed to delete tasks: ${deleteError.message}`);
    results.tasks_deleted = allTaskIds.length;
  }

  console.log(`Deleted ${results.tasks_deleted} tasks`);

  // ===== 4. Load protocol items with sections =====
  console.log('Step 3: Loading protocol items...');
  const { data: items, error: itemsError } = await supabase
    .from('protocol_items')
    .select(`
      id, item_text, responsible, due_date, completed, section_id,
      protocol_sections (entity_id, default_responsible, section_type, entity_name)
    `)
    .eq('protocol_id', protocolId)
    .eq('archived', false)
    .order('sort_order');

  if (itemsError) throw new Error(`Failed to load items: ${itemsError.message}`);
  console.log(`Found ${items?.length || 0} active items`);

  // ===== 5. Create tasks for each item =====
  console.log('Step 4: Creating tasks...');
  for (const item of items || []) {
    const section = item.protocol_sections;
    const sectionType = section?.section_type || null;
    const entityId = section?.entity_id || null;

    // Use item_text as title directly (tender items already have [company] prefix)
    const title = item.item_text;

    // Resolve responsible → profile IDs (first = assignee, rest = observers)
    const responsible = item.responsible || section?.default_responsible;
    const profileIds = getProfileIds(responsible);
    const assigneeIds = profileIds.length > 0 ? [profileIds[0]] : [];
    const observerIds = profileIds.length > 1 ? profileIds.slice(1) : [];

    // Resolve project_id
    let projectId: string | null = null;
    if (sectionType === 'project') {
      projectId = entityId;
    } else if (sectionType && SECTION_TYPE_PROJECT_IDS[sectionType]) {
      projectId = SECTION_TYPE_PROJECT_IDS[sectionType]!;
    }

    // Determine status
    const status = item.completed ? 'done' : 'new';
    if (item.completed) results.completed_tasks++;

    // Create task
    const { data: newTask, error: taskError } = await supabase
      .from('tasks')
      .insert({
        title,
        assignee_ids: assigneeIds,
        responsible_ids: [],
        observer_ids: observerIds,
        project_id: projectId,
        due_date: item.due_date,
        status,
        priority: 'normal',
        origin_type: 'protocol',
      })
      .select('id')
      .single();

    if (taskError) {
      results.errors.push(`Task "${title.substring(0, 50)}": ${taskError.message}`);
      continue;
    }

    results.tasks_created++;

    // Link protocol item to task
    const { error: linkError } = await supabase
      .from('protocol_items')
      .update({ task_id: newTask.id })
      .eq('id', item.id);

    if (linkError) {
      results.errors.push(`Link item ${item.id}: ${linkError.message}`);
    } else {
      results.items_linked++;
    }

    // Copy comments from protocol_item_comments to task_comments
    const { data: comments } = await supabase
      .from('protocol_item_comments')
      .select('author_id, content, created_at')
      .eq('item_id', item.id);

    for (const comment of comments || []) {
      const { error: commentError } = await supabase
        .from('task_comments')
        .insert({
          task_id: newTask.id,
          author_id: comment.author_id,
          content: comment.content,
        });

      if (commentError) {
        results.errors.push(`Comment copy: ${commentError.message}`);
      } else {
        results.comments_copied++;
      }
    }
  }

  console.log('Rebuild complete!', results);

  return new Response(JSON.stringify({
    success: true,
    results,
  }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
