

## Fix: Task archiving blocked by DB constraint

### Problem
The `tasks_status_check` constraint only allows: `new`, `in_progress`, `review`, `done`, `on_hold`, `blocked`, `cancelled`. The status `archived` is missing.

### Solution
Single migration: drop the old constraint and recreate it with `archived` added.

```sql
ALTER TABLE public.tasks DROP CONSTRAINT tasks_status_check;
ALTER TABLE public.tasks ADD CONSTRAINT tasks_status_check 
  CHECK (status = ANY (ARRAY['new','in_progress','review','done','on_hold','blocked','cancelled','archived']));
```

No code changes needed — the UI already sends `status: 'archived'`, the DB just rejects it.

