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
  action: 'select' | 'insert' | 'update' | 'delete' | 'upsert';
  table: string;
  data?: Record<string, unknown> | Record<string, unknown>[];
  filters?: Filter[];
  select?: string;
  order?: OrderBy[];
  limit?: number;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    const body: ProxyRequest = await req.json();
    const { action, table, data, filters, select, order, limit } = body;
    
    console.log(`[db-proxy] Action: ${action}, Table: ${table}`);
    
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
            if (operator === 'eq') query = query.eq(column, value);
            else if (operator === 'neq') query = query.neq(column, value);
            else if (operator === 'gt') query = query.gt(column, value);
            else if (operator === 'gte') query = query.gte(column, value);
            else if (operator === 'lt') query = query.lt(column, value);
            else if (operator === 'lte') query = query.lte(column, value);
            else if (operator === 'like') query = query.like(column, value);
            else if (operator === 'ilike') query = query.ilike(column, value);
            else if (operator === 'in') query = query.in(column, value);
            else if (operator === 'is') query = query.is(column, value);
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
    
    if (result.error) {
      console.error(`[db-proxy] Error:`, result.error);
      return new Response(JSON.stringify({ error: result.error }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    
    console.log(`[db-proxy] Success`);
    
    return new Response(JSON.stringify({ data: result.data }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
    
  } catch (err) {
    const error = err as Error;
    console.error('[db-proxy] Error:', error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
