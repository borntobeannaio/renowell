import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface Filter {
  column: string;
  operator: string;
  value: unknown;
}

interface OrderBy {
  column: string;
  ascending?: boolean;
}

interface ProxyRequest {
  action: 'ping' | 'select' | 'insert' | 'update' | 'delete' | 'upsert';
  table?: string;
  data?: Record<string, unknown> | Record<string, unknown>[];
  filters?: Filter[];
  select?: string;
  order?: OrderBy[];
  limit?: number;
}

// Create client once at module level for connection reuse
const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { persistSession: false },
  db: { schema: 'public' },
});

console.log('[db-proxy] Module initialized');

serve(async (req) => {
  const startTime = Date.now();
  
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body: ProxyRequest = await req.json();
    const { action, table, data, filters, select, order, limit } = body;

    if (action === 'ping') {
      return new Response(JSON.stringify({ data: 'ok' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!table) throw new Error('Missing table');

    console.log(`[db-proxy] ${action} ${table}`);
    
    // deno-lint-ignore no-explicit-any
    let result: any;
    
    switch (action) {
      case 'select': {
        // deno-lint-ignore no-explicit-any
        let query: any = supabase.from(table).select(select || '*');
        
        // Apply filters
        if (filters) {
          for (const filter of filters) {
            const { column, operator, value } = filter;
            switch (operator) {
              case 'eq': query = query.eq(column, value); break;
              case 'neq': query = query.neq(column, value); break;
              case 'gt': query = query.gt(column, value); break;
              case 'gte': query = query.gte(column, value); break;
              case 'lt': query = query.lt(column, value); break;
              case 'lte': query = query.lte(column, value); break;
              case 'like': query = query.like(column, value); break;
              case 'ilike': query = query.ilike(column, value); break;
              case 'in': query = query.in(column, value); break;
              case 'is': query = query.is(column, value); break;
            }
          }
        }
        
        // Apply ordering
        if (order) {
          for (const o of order) {
            query = query.order(o.column, { ascending: o.ascending ?? true });
          }
        }
        
        // Apply limit
        if (limit) {
          query = query.limit(limit);
        }
        
        result = await query;
        break;
      }
      
      case 'insert': {
        // deno-lint-ignore no-explicit-any
        let query: any = supabase.from(table).insert(data);
        if (select) {
          query = query.select(select);
        }
        result = await query;
        break;
      }
      
      case 'update': {
        // deno-lint-ignore no-explicit-any
        let query: any = supabase.from(table).update(data);
        
        // Apply filters for update
        if (filters) {
          for (const filter of filters) {
            if (filter.operator === 'eq') {
              query = query.eq(filter.column, filter.value);
            }
          }
        }
        
        if (select) {
          query = query.select(select);
        }
        result = await query;
        break;
      }
      
      case 'delete': {
        // deno-lint-ignore no-explicit-any
        let query: any = supabase.from(table).delete();
        
        // Apply filters for delete
        if (filters) {
          for (const filter of filters) {
            if (filter.operator === 'eq') {
              query = query.eq(filter.column, filter.value);
            }
          }
        }
        
        result = await query;
        break;
      }
      
      case 'upsert': {
        // deno-lint-ignore no-explicit-any
        let query: any = supabase.from(table).upsert(data);
        if (select) {
          query = query.select(select);
        }
        result = await query;
        break;
      }
      
      default:
        throw new Error(`Unknown action: ${action}`);
    }
    
    const duration = Date.now() - startTime;
    
    if (result.error) {
      console.error(`[db-proxy] Error (${duration}ms):`, result.error);
      return new Response(JSON.stringify({ error: result.error }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    
    console.log(`[db-proxy] OK ${action} ${table} (${duration}ms, ${result.data?.length || 0} rows)`);
    
    return new Response(JSON.stringify({ data: result.data }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
    
  } catch (err) {
    const error = err as Error;
    const duration = Date.now() - startTime;
    console.error(`[db-proxy] Error (${duration}ms):`, error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
