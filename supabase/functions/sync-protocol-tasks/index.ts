import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ProtocolItem {
  id: string;
  item_text: string;
  responsible: string | null;
  due_date: string | null;
  task_id: string | null;
  section_id: string | null;
  protocol_id: string;
}

interface ProtocolSection {
  entity_id: string | null;
  default_responsible: string | null;
  section_type: string;
}

interface Protocol {
  id: string;
  date: string;
  number: number;
}

interface Employee {
  full_name: string;
  profile_id: string | null;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const results = {
      step1_linked_duplicates: 0,
      step2_tasks_created: 0,
      step2_items_linked: 0,
      step3_orphans_deleted: 0,
      step4_tasks_synced: 0,
      errors: [] as string[],
    };

    // ========== STEP 1: Spread existing task links to duplicates ==========
    console.log('Step 1: Spreading existing task links to duplicates...');
    
    // Get all items with task_id
    const { data: itemsWithTasks, error: itemsWithTasksError } = await supabase
      .from('protocol_items')
      .select('item_text, task_id')
      .not('task_id', 'is', null);

    if (itemsWithTasksError) {
      throw new Error(`Failed to get items with tasks: ${itemsWithTasksError.message}`);
    }

    // Create a map of item_text -> task_id
    const textToTaskMap = new Map<string, string>();
    for (const item of itemsWithTasks || []) {
      if (!textToTaskMap.has(item.item_text)) {
        textToTaskMap.set(item.item_text, item.task_id);
      }
    }

    // Update all duplicates without task_id
    for (const [itemText, taskId] of textToTaskMap) {
      const { data: updated, error: updateError } = await supabase
        .from('protocol_items')
        .update({ task_id: taskId })
        .eq('item_text', itemText)
        .is('task_id', null)
        .select('id');

      if (updateError) {
        results.errors.push(`Failed to update duplicates for "${itemText.substring(0, 50)}...": ${updateError.message}`);
      } else {
        results.step1_linked_duplicates += updated?.length || 0;
      }
    }

    console.log(`Step 1 complete: linked ${results.step1_linked_duplicates} duplicate items`);

    // ========== STEP 2: Create tasks for unique items without tasks ==========
    console.log('Step 2: Creating tasks for unique items without tasks...');

    // Get all employees for mapping responsible names to profile_ids
    const { data: employees, error: employeesError } = await supabase
      .from('employees')
      .select('full_name, profile_id');

    if (employeesError) {
      throw new Error(`Failed to get employees: ${employeesError.message}`);
    }

    const employeeMap = new Map<string, string>();
    for (const emp of employees || []) {
      if (emp.profile_id) {
        // Normalize name for matching
        const normalizedName = emp.full_name.toLowerCase().trim();
        employeeMap.set(normalizedName, emp.profile_id);
      }
    }

    // Get all protocol items with protocol and section data
    const { data: allItems, error: allItemsError } = await supabase
      .from('protocol_items')
      .select(`
        id, item_text, responsible, due_date, task_id, section_id, protocol_id, archived,
        protocols!inner (id, date, number),
        protocol_sections (entity_id, default_responsible, section_type)
      `)
      .eq('archived', false)
      .order('item_text');

    if (allItemsError) {
      throw new Error(`Failed to get all items: ${allItemsError.message}`);
    }

    // Group items by text and find unique items without tasks
    const itemsByText = new Map<string, any[]>();
    for (const item of allItems || []) {
      const text = item.item_text;
      if (!itemsByText.has(text)) {
        itemsByText.set(text, []);
      }
      itemsByText.get(text)!.push(item);
    }

    // Helper function to parse responsible string and get profile IDs
    function getProfileIds(responsibleStr: string | null): string[] {
      if (!responsibleStr) return [];
      
      const profileIds: string[] = [];
      // Split by common delimiters
      const names = responsibleStr.split(/[,;\/]/).map(n => n.trim()).filter(Boolean);
      
      for (const name of names) {
        const normalizedName = name.toLowerCase().trim();
        // Try exact match first
        if (employeeMap.has(normalizedName)) {
          profileIds.push(employeeMap.get(normalizedName)!);
        } else {
          // Try partial match (last name only or first name only)
          for (const [empName, profileId] of employeeMap) {
            if (empName.includes(normalizedName) || normalizedName.includes(empName.split(' ')[0])) {
              profileIds.push(profileId);
              break;
            }
          }
        }
      }
      
      return [...new Set(profileIds)]; // Remove duplicates
    }

    // Process each unique item text
    for (const [itemText, items] of itemsByText) {
      // Check if any item already has a task
      const hasTask = items.some(item => item.task_id);
      if (hasTask) continue;

      // Find the latest version (by protocol date, then number)
      const sortedItems = items.sort((a, b) => {
        const dateA = new Date(a.protocols.date).getTime();
        const dateB = new Date(b.protocols.date).getTime();
        if (dateB !== dateA) return dateB - dateA;
        return b.protocols.number - a.protocols.number;
      });
      
      const latestItem = sortedItems[0];
      
      // Get responsible from item or section
      const responsible = latestItem.responsible || latestItem.protocol_sections?.default_responsible;
      const profileIds = getProfileIds(responsible);
      
      // Get project_id from section if it's a project type
      const projectId = latestItem.protocol_sections?.section_type === 'project' 
        ? latestItem.protocol_sections.entity_id 
        : null;

      // Create task
      const { data: newTask, error: taskError } = await supabase
        .from('tasks')
        .insert({
          title: latestItem.item_text,
          assignee_ids: profileIds.length > 0 ? profileIds : null,
          project_id: projectId,
          due_date: latestItem.due_date,
          status: 'new',
          priority: 'normal',
          origin_type: 'protocol',
        })
        .select('id')
        .single();

      if (taskError) {
        results.errors.push(`Failed to create task for "${itemText.substring(0, 50)}...": ${taskError.message}`);
        continue;
      }

      results.step2_tasks_created++;

      // Link all items with this text to the new task
      const itemIds = items.map(item => item.id);
      const { error: linkError } = await supabase
        .from('protocol_items')
        .update({ task_id: newTask.id })
        .in('id', itemIds);

      if (linkError) {
        results.errors.push(`Failed to link items to task: ${linkError.message}`);
      } else {
        results.step2_items_linked += itemIds.length;
      }
    }

    console.log(`Step 2 complete: created ${results.step2_tasks_created} tasks, linked ${results.step2_items_linked} items`);

    // ========== STEP 3: Delete orphan tasks ==========
    console.log('Step 3: Deleting orphan tasks...');

    // Get all tasks with origin_type = 'protocol'
    const { data: protocolTasks, error: protocolTasksError } = await supabase
      .from('tasks')
      .select('id')
      .eq('origin_type', 'protocol');

    if (protocolTasksError) {
      throw new Error(`Failed to get protocol tasks: ${protocolTasksError.message}`);
    }

    // Get all task_ids that are linked from protocol_items
    const { data: linkedTaskIds, error: linkedTaskIdsError } = await supabase
      .from('protocol_items')
      .select('task_id')
      .not('task_id', 'is', null);

    if (linkedTaskIdsError) {
      throw new Error(`Failed to get linked task IDs: ${linkedTaskIdsError.message}`);
    }

    const linkedSet = new Set((linkedTaskIds || []).map(item => item.task_id));
    const orphanTaskIds = (protocolTasks || [])
      .filter(task => !linkedSet.has(task.id))
      .map(task => task.id);

    if (orphanTaskIds.length > 0) {
      const { error: deleteError } = await supabase
        .from('tasks')
        .delete()
        .in('id', orphanTaskIds);

      if (deleteError) {
        results.errors.push(`Failed to delete orphan tasks: ${deleteError.message}`);
      } else {
        results.step3_orphans_deleted = orphanTaskIds.length;
      }
    }

    console.log(`Step 3 complete: deleted ${results.step3_orphans_deleted} orphan tasks`);

    // ========== STEP 4: Sync task data from latest items ==========
    console.log('Step 4: Syncing task data from latest items...');

    // Get all unique task_ids with their latest item data
    const { data: latestItems, error: latestItemsError } = await supabase
      .from('protocol_items')
      .select(`
        id, item_text, responsible, due_date, task_id, section_id,
        protocols!inner (id, date, number),
        protocol_sections (entity_id, default_responsible, section_type)
      `)
      .not('task_id', 'is', null)
      .eq('archived', false);

    if (latestItemsError) {
      throw new Error(`Failed to get latest items: ${latestItemsError.message}`);
    }

    // Group by task_id and find the latest for each
    const latestByTask = new Map<string, any>();
    for (const item of latestItems || []) {
      const existing = latestByTask.get(item.task_id);
      const itemProtocol = item.protocols as unknown as Protocol;
      if (!existing) {
        latestByTask.set(item.task_id, item);
      } else {
        const existingProtocol = existing.protocols as unknown as Protocol;
        const existingDate = new Date(existingProtocol.date).getTime();
        const itemDate = new Date(itemProtocol.date).getTime();
        if (itemDate > existingDate || 
            (itemDate === existingDate && itemProtocol.number > existingProtocol.number)) {
          latestByTask.set(item.task_id, item);
        }
      }
    }

    // Update each task with data from its latest item
    for (const [taskId, item] of latestByTask) {
      const responsible = item.responsible || item.protocol_sections?.default_responsible;
      const profileIds = getProfileIds(responsible);
      const projectId = item.protocol_sections?.section_type === 'project' 
        ? item.protocol_sections.entity_id 
        : null;

      const { error: updateError } = await supabase
        .from('tasks')
        .update({
          title: item.item_text,
          assignee_ids: profileIds.length > 0 ? profileIds : null,
          project_id: projectId,
          due_date: item.due_date,
        })
        .eq('id', taskId);

      if (updateError) {
        results.errors.push(`Failed to update task ${taskId}: ${updateError.message}`);
      } else {
        results.step4_tasks_synced++;
      }
    }

    console.log(`Step 4 complete: synced ${results.step4_tasks_synced} tasks`);

    // ========== SUMMARY ==========
    console.log('Migration complete!', results);

    return new Response(JSON.stringify({
      success: true,
      results,
      summary: {
        duplicates_linked: results.step1_linked_duplicates,
        new_tasks_created: results.step2_tasks_created,
        items_linked_to_new_tasks: results.step2_items_linked,
        orphan_tasks_deleted: results.step3_orphans_deleted,
        tasks_synced: results.step4_tasks_synced,
        errors_count: results.errors.length,
      }
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: unknown) {
    console.error('Migration error:', error);
    const message = error instanceof Error ? error.message : String(error);
    return new Response(JSON.stringify({
      success: false,
      error: message,
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
