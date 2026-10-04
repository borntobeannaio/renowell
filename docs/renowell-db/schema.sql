\restrict k789vTHiaw4mai7n4RFF2NzdpwuGIAiIY9bEGKjJjjdzR7H1HGpnLRDSDREn2Gb





CREATE FUNCTION public.renowell_audit_trigger_func() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    INSERT INTO public.renowell_audit_log (table_name, record_id, action, old_data, changed_by)
    VALUES (TG_TABLE_NAME, OLD.id, 'DELETE', to_jsonb(OLD), nullif(current_setting('app.user_id', true),'')::uuid);
    RETURN OLD;
  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO public.renowell_audit_log (table_name, record_id, action, old_data, new_data, changed_by)
    VALUES (TG_TABLE_NAME, NEW.id, 'UPDATE', to_jsonb(OLD), to_jsonb(NEW), nullif(current_setting('app.user_id', true),'')::uuid);
    RETURN NEW;
  ELSIF TG_OP = 'INSERT' THEN
    INSERT INTO public.renowell_audit_log (table_name, record_id, action, new_data, changed_by)
    VALUES (TG_TABLE_NAME, NEW.id, 'INSERT', to_jsonb(NEW), nullif(current_setting('app.user_id', true),'')::uuid);
    RETURN NEW;
  END IF;
END;
$$;

CREATE FUNCTION public.renowell_cleanup_old_snapshots() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  -- Удалить снепшоты старше 7 дней для этого черновика
  DELETE FROM public.renowell_form_draft_snapshots
  WHERE draft_id = NEW.draft_id
    AND created_at < NOW() - INTERVAL '7 days';
  
  -- Оставить только последние 50 снепшотов на черновик
  DELETE FROM public.renowell_form_draft_snapshots
  WHERE id IN (
    SELECT id FROM public.renowell_form_draft_snapshots
    WHERE draft_id = NEW.draft_id
    ORDER BY created_at DESC
    OFFSET 50
  );
  
  RETURN NEW;
END;
$$;

CREATE FUNCTION public.renowell_ensure_unique_direct_chat() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
DECLARE
  conv_type text;
  pair_text text;
  participant_count int;
BEGIN
  -- Получить тип чата
  SELECT type INTO conv_type FROM public.renowell_chat_conversations WHERE id = NEW.conversation_id;
  
  -- Только для direct чатов
  IF conv_type = 'direct' THEN
    -- Подсчитать участников
    SELECT count(*) INTO participant_count 
    FROM public.renowell_chat_participants 
    WHERE conversation_id = NEW.conversation_id;
    
    -- Если это второй участник (завершение создания direct-чата)
    IF participant_count = 2 THEN
      pair_text := public.renowell_get_direct_chat_pair(NEW.conversation_id);
      
      -- Попробовать вставить пару (если уже есть - ошибка)
      INSERT INTO public.renowell_chat_direct_pairs (conversation_id, participant_pair)
      VALUES (NEW.conversation_id, pair_text)
      ON CONFLICT (participant_pair) DO NOTHING;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

CREATE FUNCTION public.renowell_get_direct_chat_pair(conv_id uuid) RETURNS text
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
DECLARE
  participants text[];
BEGIN
  SELECT array_agg(user_id::text ORDER BY user_id)
  INTO participants
  FROM public.renowell_chat_participants
  WHERE conversation_id = conv_id;
  
  RETURN array_to_string(participants, ',');
END;
$$;

CREATE FUNCTION public.renowell_save_draft_snapshot() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  -- Создать снепшот только если данные изменились
  IF OLD.draft_data IS DISTINCT FROM NEW.draft_data THEN
    INSERT INTO public.renowell_form_draft_snapshots 
      (draft_id, user_id, form_type, entity_id, draft_data)
    VALUES 
      (NEW.id, NEW.user_id, NEW.form_type, NEW.entity_id, OLD.draft_data);
  END IF;
  RETURN NEW;
END;
$$;

CREATE FUNCTION public.renowell_sync_profile_to_employee() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  UPDATE public.renowell_employees SET 
    avatar_url = NEW.avatar_url,
    full_name = COALESCE(NULLIF(CONCAT_WS(' ', NEW.last_name, NEW.first_name), ''), 'Пользователь'),
    first_name = NEW.first_name,
    last_name = NEW.last_name,
    middle_name = NEW.middle_name,
    position = COALESCE(NEW.position, 'Сотрудник'),
    birthday = NEW.birthday,
    description = NEW.description
  WHERE profile_id = NEW.id;
  RETURN NEW;
END;
$$;

CREATE FUNCTION public.renowell_update_updated_at_column() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TABLE public.renowell_ai_chat_messages (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    role text NOT NULL,
    content text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT ai_chat_messages_role_check CHECK ((role = ANY (ARRAY['user'::text, 'assistant'::text])))
);

CREATE TABLE public.renowell_audit_log (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    table_name text NOT NULL,
    record_id uuid NOT NULL,
    action text NOT NULL,
    old_data jsonb,
    new_data jsonb,
    changed_by uuid,
    changed_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT audit_log_action_check CHECK ((action = ANY (ARRAY['INSERT'::text, 'UPDATE'::text, 'DELETE'::text])))
);

CREATE TABLE public.renowell_birthday_greetings_log (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    employee_id uuid NOT NULL,
    year integer NOT NULL,
    news_post_id uuid,
    telegram_sent boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.renowell_bot_settings (
    key text NOT NULL,
    value text NOT NULL
);

CREATE TABLE public.renowell_calendar_events (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    title text NOT NULL,
    description text,
    start_time timestamp with time zone NOT NULL,
    end_time timestamp with time zone NOT NULL,
    location text,
    is_online boolean DEFAULT false NOT NULL,
    creator_id uuid NOT NULL,
    participant_ids uuid[] DEFAULT '{}'::uuid[] NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    source text DEFAULT 'internal'::text NOT NULL,
    external_uid text,
    organizer text,
    attendees jsonb DEFAULT '[]'::jsonb,
    url text,
    attachments jsonb DEFAULT '[]'::jsonb
);

CREATE TABLE public.renowell_call_participants (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    call_id uuid NOT NULL,
    user_id uuid NOT NULL,
    joined_at timestamp with time zone,
    left_at timestamp with time zone,
    status text DEFAULT 'invited'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.renowell_calls (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    conversation_id uuid,
    caller_id uuid,
    channel_name text NOT NULL,
    call_type text DEFAULT 'video'::text NOT NULL,
    status text DEFAULT 'ringing'::text NOT NULL,
    started_at timestamp with time zone DEFAULT now() NOT NULL,
    ended_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.renowell_chat_conversations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    title text NOT NULL,
    type text DEFAULT 'direct'::text NOT NULL,
    created_by uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT chat_conversations_type_check CHECK ((type = ANY (ARRAY['direct'::text, 'group'::text])))
);

CREATE TABLE public.renowell_chat_direct_pairs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    conversation_id uuid NOT NULL,
    participant_pair text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.renowell_chat_message_reactions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    message_id uuid NOT NULL,
    user_id uuid NOT NULL,
    emoji text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.renowell_chat_messages (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    conversation_id uuid NOT NULL,
    sender_id uuid NOT NULL,
    content text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    attachments jsonb DEFAULT '[]'::jsonb
);

COMMENT ON COLUMN public.renowell_chat_messages.attachments IS 'Array of file attachments: [{name: string, url: string, type: string, size: number}]';

CREATE TABLE public.renowell_chat_participants (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    conversation_id uuid NOT NULL,
    user_id uuid NOT NULL,
    joined_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.renowell_chat_read_status (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    conversation_id uuid NOT NULL,
    user_id uuid NOT NULL,
    last_read_at timestamp with time zone DEFAULT now() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.renowell_comment_mentions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    comment_id uuid NOT NULL,
    mentioned_user_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.renowell_employee_notes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    owner_profile_id uuid NOT NULL,
    visibility text NOT NULL,
    title text DEFAULT ''::text NOT NULL,
    body text DEFAULT ''::text NOT NULL,
    pinned boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    attachments jsonb DEFAULT '[]'::jsonb NOT NULL,
    CONSTRAINT employee_notes_visibility_check CHECK ((visibility = ANY (ARRAY['private'::text, 'work'::text])))
);

CREATE TABLE public.renowell_employees (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    full_name text NOT NULL,
    "position" text NOT NULL,
    phone text,
    email text,
    department text,
    avatar_url text,
    birthday date,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    profile_id uuid,
    description text,
    middle_name text,
    first_name text,
    last_name text
);

CREATE TABLE public.renowell_form_draft_snapshots (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    draft_id uuid NOT NULL,
    user_id uuid NOT NULL,
    form_type text NOT NULL,
    entity_id text NOT NULL,
    draft_data jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.renowell_form_drafts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    form_type text NOT NULL,
    entity_id text NOT NULL,
    draft_data jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.renowell_hr_documents (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    title text NOT NULL,
    file_type text DEFAULT 'pdf'::text NOT NULL,
    file_url text,
    storage_path text,
    uploaded_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.renowell_news_posts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    kind text DEFAULT 'news'::text NOT NULL,
    title text NOT NULL,
    body text NOT NULL,
    author text DEFAULT 'Renowell'::text NOT NULL,
    tags text[] DEFAULT '{}'::text[] NOT NULL,
    related_employee_id uuid,
    mentioned_employees uuid[] DEFAULT '{}'::uuid[] NOT NULL,
    date date DEFAULT ((now() AT TIME ZONE 'Europe/Moscow'::text))::date NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.renowell_notifications (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    recipient_id uuid NOT NULL,
    type text NOT NULL,
    title text NOT NULL,
    body text NOT NULL,
    link text,
    related_task_id uuid,
    is_read boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    attachments jsonb,
    send_after timestamp with time zone,
    external_sent boolean DEFAULT false,
    CONSTRAINT notifications_type_check CHECK ((type = ANY (ARRAY['task_assigned'::text, 'deadline_week'::text, 'deadline_day'::text, 'mention'::text, 'chat_message'::text, 'chat_created'::text, 'calendar_invite'::text])))
);

COMMENT ON COLUMN public.renowell_notifications.attachments IS 'Массив вложений [{url, fileName, contentType, size}]';

CREATE TABLE public.renowell_profiles (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    first_name text,
    last_name text,
    "position" text,
    avatar_url text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    birthday date,
    description text,
    telegram_chat_id text,
    notify_telegram boolean DEFAULT false,
    notify_email boolean DEFAULT false,
    notify_push boolean DEFAULT false,
    push_subscription jsonb,
    ics_url text,
    middle_name text
);

COMMENT ON COLUMN public.renowell_profiles.telegram_chat_id IS 'Telegram chat ID for sending notifications';

COMMENT ON COLUMN public.renowell_profiles.notify_telegram IS 'Whether Telegram public.renowell_notifications are enabled';

COMMENT ON COLUMN public.renowell_profiles.notify_email IS 'Whether Email public.renowell_notifications are enabled';

COMMENT ON COLUMN public.renowell_profiles.notify_push IS 'Whether browser Push public.renowell_notifications are enabled';

COMMENT ON COLUMN public.renowell_profiles.push_subscription IS 'Web Push subscription data (endpoint, keys)';

CREATE TABLE public.renowell_projects (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    archived boolean DEFAULT false NOT NULL
);

CREATE TABLE public.renowell_protocol_item_comment_mentions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    comment_id uuid NOT NULL,
    mentioned_user_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.renowell_protocol_item_comments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    item_id uuid NOT NULL,
    author_id uuid NOT NULL,
    content text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.renowell_protocol_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    protocol_id uuid NOT NULL,
    project_id uuid,
    item_text text NOT NULL,
    responsible text,
    due_date date,
    create_task boolean DEFAULT false,
    task_id uuid,
    sort_order integer DEFAULT 0,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    section_id uuid,
    kpi text,
    status text,
    status_date date,
    archived boolean DEFAULT false,
    completed boolean DEFAULT false,
    completed_at timestamp with time zone
);

CREATE TABLE public.renowell_protocol_sections (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    protocol_id uuid NOT NULL,
    section_type text DEFAULT 'project'::text NOT NULL,
    entity_id uuid,
    entity_name text,
    default_responsible text,
    sort_order integer DEFAULT 0,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    archived boolean DEFAULT false
);

CREATE TABLE public.renowell_protocols (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    number integer NOT NULL,
    date date NOT NULL,
    title text NOT NULL,
    organizer text,
    meeting_type text,
    attendees text[] DEFAULT '{}'::text[],
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    participant_ids uuid[] DEFAULT '{}'::uuid[] NOT NULL
);

CREATE TABLE public.renowell_support_messages (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_profile_id uuid NOT NULL,
    direction text DEFAULT 'outgoing'::text NOT NULL,
    content text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT support_messages_direction_check CHECK ((direction = ANY (ARRAY['outgoing'::text, 'incoming'::text])))
);

CREATE TABLE public.renowell_support_telegram_map (
    telegram_message_id bigint NOT NULL,
    user_profile_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.renowell_task_comments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    task_id uuid NOT NULL,
    author_id uuid NOT NULL,
    content text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.renowell_tasks (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    title text NOT NULL,
    assignee_id uuid,
    project_id uuid,
    due_date date,
    status text DEFAULT 'inbox'::text NOT NULL,
    labels text[] DEFAULT '{}'::text[],
    origin_type text,
    origin_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    priority text DEFAULT 'normal'::text,
    assignee_ids uuid[] DEFAULT '{}'::uuid[],
    responsible_ids uuid[] DEFAULT '{}'::uuid[],
    observer_ids uuid[] DEFAULT '{}'::uuid[],
    CONSTRAINT tasks_priority_check CHECK ((priority = ANY (ARRAY['critical'::text, 'high'::text, 'normal'::text, 'low'::text]))),
    CONSTRAINT tasks_status_check CHECK ((status = ANY (ARRAY['new'::text, 'in_progress'::text, 'review'::text, 'done'::text, 'on_hold'::text, 'blocked'::text, 'cancelled'::text, 'archived'::text])))
);

CREATE TABLE public.renowell_telegram_posts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    message_id integer NOT NULL,
    text text,
    date timestamp with time zone NOT NULL,
    image_url text,
    video_url text,
    link text NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    file_id text,
    video_file_id text
);

CREATE TABLE public.renowell_tender_attachments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tender_id uuid NOT NULL,
    file_name text NOT NULL,
    file_url text NOT NULL,
    storage_path text NOT NULL,
    content_type text DEFAULT 'application/octet-stream'::text NOT NULL,
    file_size integer DEFAULT 0 NOT NULL,
    uploaded_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.renowell_tender_checklist_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tender_id uuid NOT NULL,
    text text DEFAULT ''::text NOT NULL,
    completed boolean DEFAULT false NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.renowell_tender_comments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tender_id uuid NOT NULL,
    author_id uuid NOT NULL,
    content text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.renowell_tender_companies (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    inn text,
    name text NOT NULL,
    full_name text,
    ogrn text,
    address text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.renowell_tender_contacts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tender_id uuid NOT NULL,
    name text DEFAULT ''::text,
    phone text DEFAULT ''::text,
    description text DEFAULT ''::text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.renowell_tender_interactions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tender_id uuid NOT NULL,
    content text DEFAULT ''::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    author_id uuid
);

CREATE TABLE public.renowell_tenders (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    company_id uuid,
    project_name text NOT NULL,
    status text DEFAULT 'in_progress'::text NOT NULL,
    source text,
    manager text,
    contact_info text,
    area_address text,
    interaction_history text,
    tender_start_date date,
    duration_months integer,
    budget text,
    notes text,
    lead_grade text,
    color_label text,
    sort_order integer DEFAULT 0,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE ONLY public.renowell_ai_chat_messages
    ADD CONSTRAINT renowell_ai_chat_messages_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.renowell_audit_log
    ADD CONSTRAINT renowell_audit_log_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.renowell_birthday_greetings_log
    ADD CONSTRAINT renowell_birthday_greetings_log_employee_id_year_key UNIQUE (employee_id, year);

ALTER TABLE ONLY public.renowell_birthday_greetings_log
    ADD CONSTRAINT renowell_birthday_greetings_log_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.renowell_bot_settings
    ADD CONSTRAINT renowell_bot_settings_pkey PRIMARY KEY (key);

ALTER TABLE ONLY public.renowell_calendar_events
    ADD CONSTRAINT renowell_calendar_events_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.renowell_call_participants
    ADD CONSTRAINT renowell_call_participants_call_id_user_id_key UNIQUE (call_id, user_id);

ALTER TABLE ONLY public.renowell_call_participants
    ADD CONSTRAINT renowell_call_participants_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.renowell_calls
    ADD CONSTRAINT renowell_calls_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.renowell_chat_conversations
    ADD CONSTRAINT renowell_chat_conversations_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.renowell_chat_direct_pairs
    ADD CONSTRAINT renowell_chat_direct_pairs_participant_pair_key UNIQUE (participant_pair);

ALTER TABLE ONLY public.renowell_chat_direct_pairs
    ADD CONSTRAINT renowell_chat_direct_pairs_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.renowell_chat_message_reactions
    ADD CONSTRAINT renowell_chat_message_reactions_message_id_user_id_emoji_key UNIQUE (message_id, user_id, emoji);

ALTER TABLE ONLY public.renowell_chat_message_reactions
    ADD CONSTRAINT renowell_chat_message_reactions_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.renowell_chat_messages
    ADD CONSTRAINT renowell_chat_messages_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.renowell_chat_participants
    ADD CONSTRAINT renowell_chat_participants_conversation_id_user_id_key UNIQUE (conversation_id, user_id);

ALTER TABLE ONLY public.renowell_chat_participants
    ADD CONSTRAINT renowell_chat_participants_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.renowell_chat_read_status
    ADD CONSTRAINT renowell_chat_read_status_conversation_id_user_id_key UNIQUE (conversation_id, user_id);

ALTER TABLE ONLY public.renowell_chat_read_status
    ADD CONSTRAINT renowell_chat_read_status_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.renowell_comment_mentions
    ADD CONSTRAINT renowell_comment_mentions_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.renowell_employee_notes
    ADD CONSTRAINT renowell_employee_notes_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.renowell_employees
    ADD CONSTRAINT renowell_employees_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.renowell_form_draft_snapshots
    ADD CONSTRAINT renowell_form_draft_snapshots_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.renowell_form_drafts
    ADD CONSTRAINT renowell_form_drafts_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.renowell_form_drafts
    ADD CONSTRAINT renowell_form_drafts_user_id_form_type_entity_id_key UNIQUE (user_id, form_type, entity_id);

ALTER TABLE ONLY public.renowell_hr_documents
    ADD CONSTRAINT renowell_hr_documents_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.renowell_news_posts
    ADD CONSTRAINT renowell_news_posts_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.renowell_notifications
    ADD CONSTRAINT renowell_notifications_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.renowell_profiles
    ADD CONSTRAINT renowell_profiles_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.renowell_profiles
    ADD CONSTRAINT renowell_profiles_user_id_key UNIQUE (user_id);

ALTER TABLE ONLY public.renowell_projects
    ADD CONSTRAINT renowell_projects_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.renowell_protocol_item_comment_mentions
    ADD CONSTRAINT renowell_protocol_item_comment_mentions_comment_id_mentioned_user_id_key UNIQUE (comment_id, mentioned_user_id);

ALTER TABLE ONLY public.renowell_protocol_item_comment_mentions
    ADD CONSTRAINT renowell_protocol_item_comment_mentions_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.renowell_protocol_item_comments
    ADD CONSTRAINT renowell_protocol_item_comments_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.renowell_protocol_items
    ADD CONSTRAINT renowell_protocol_items_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.renowell_protocol_sections
    ADD CONSTRAINT renowell_protocol_sections_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.renowell_protocols
    ADD CONSTRAINT renowell_protocols_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.renowell_support_messages
    ADD CONSTRAINT renowell_support_messages_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.renowell_support_telegram_map
    ADD CONSTRAINT renowell_support_telegram_map_pkey PRIMARY KEY (telegram_message_id);

ALTER TABLE ONLY public.renowell_task_comments
    ADD CONSTRAINT renowell_task_comments_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.renowell_tasks
    ADD CONSTRAINT renowell_tasks_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.renowell_telegram_posts
    ADD CONSTRAINT renowell_telegram_posts_message_id_key UNIQUE (message_id);

ALTER TABLE ONLY public.renowell_telegram_posts
    ADD CONSTRAINT renowell_telegram_posts_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.renowell_tender_attachments
    ADD CONSTRAINT renowell_tender_attachments_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.renowell_tender_checklist_items
    ADD CONSTRAINT renowell_tender_checklist_items_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.renowell_tender_comments
    ADD CONSTRAINT renowell_tender_comments_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.renowell_tender_companies
    ADD CONSTRAINT renowell_tender_companies_inn_key UNIQUE (inn);

ALTER TABLE ONLY public.renowell_tender_companies
    ADD CONSTRAINT renowell_tender_companies_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.renowell_tender_contacts
    ADD CONSTRAINT renowell_tender_contacts_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.renowell_tender_interactions
    ADD CONSTRAINT renowell_tender_interactions_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.renowell_tenders
    ADD CONSTRAINT renowell_tenders_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.renowell_calendar_events
    ADD CONSTRAINT renowell_uq_calendar_events_creator_external_uid UNIQUE (creator_id, external_uid);

CREATE INDEX renowell_idx_ai_chat_messages_created ON public.renowell_ai_chat_messages USING btree (created_at);

CREATE INDEX renowell_idx_ai_chat_messages_user ON public.renowell_ai_chat_messages USING btree (user_id);

CREATE INDEX renowell_idx_audit_log_changed_at ON public.renowell_audit_log USING btree (changed_at DESC);

CREATE INDEX renowell_idx_audit_log_table_record ON public.renowell_audit_log USING btree (table_name, record_id);

CREATE INDEX renowell_idx_chat_message_reactions_message_id ON public.renowell_chat_message_reactions USING btree (message_id);

CREATE INDEX renowell_idx_chat_messages_attachments ON public.renowell_chat_messages USING gin (attachments);

CREATE INDEX renowell_idx_chat_messages_conversation ON public.renowell_chat_messages USING btree (conversation_id);

CREATE INDEX renowell_idx_chat_messages_created ON public.renowell_chat_messages USING btree (created_at);

CREATE INDEX renowell_idx_chat_participants_conversation ON public.renowell_chat_participants USING btree (conversation_id);

CREATE INDEX renowell_idx_chat_participants_user ON public.renowell_chat_participants USING btree (user_id);

CREATE INDEX renowell_idx_chat_read_status_conversation ON public.renowell_chat_read_status USING btree (conversation_id);

CREATE INDEX renowell_idx_chat_read_status_user ON public.renowell_chat_read_status USING btree (user_id);

CREATE INDEX renowell_idx_employee_notes_owner ON public.renowell_employee_notes USING btree (owner_profile_id);

CREATE INDEX renowell_idx_employee_notes_visibility ON public.renowell_employee_notes USING btree (visibility);

CREATE INDEX renowell_idx_form_drafts_updated ON public.renowell_form_drafts USING btree (updated_at DESC);

CREATE INDEX renowell_idx_form_drafts_user ON public.renowell_form_drafts USING btree (user_id);

CREATE INDEX renowell_idx_news_posts_date ON public.renowell_news_posts USING btree (date DESC, created_at DESC);

CREATE INDEX renowell_idx_projects_archived ON public.renowell_projects USING btree (archived);

CREATE INDEX renowell_idx_snapshots_created_at ON public.renowell_form_draft_snapshots USING btree (created_at DESC);

CREATE INDEX renowell_idx_snapshots_draft_id ON public.renowell_form_draft_snapshots USING btree (draft_id);

CREATE INDEX renowell_idx_snapshots_user_entity ON public.renowell_form_draft_snapshots USING btree (user_id, form_type, entity_id);

CREATE INDEX renowell_idx_support_messages_user ON public.renowell_support_messages USING btree (user_profile_id, created_at);

CREATE INDEX renowell_idx_telegram_posts_date ON public.renowell_telegram_posts USING btree (date DESC);

CREATE INDEX renowell_idx_telegram_posts_file_id ON public.renowell_telegram_posts USING btree (file_id) WHERE (file_id IS NOT NULL);

CREATE TRIGGER audit_employees AFTER INSERT OR DELETE OR UPDATE ON public.renowell_employees FOR EACH ROW EXECUTE FUNCTION public.renowell_audit_trigger_func();

CREATE TRIGGER audit_protocol_items AFTER INSERT OR DELETE OR UPDATE ON public.renowell_protocol_items FOR EACH ROW EXECUTE FUNCTION public.renowell_audit_trigger_func();

CREATE TRIGGER audit_protocol_sections AFTER INSERT OR DELETE OR UPDATE ON public.renowell_protocol_sections FOR EACH ROW EXECUTE FUNCTION public.renowell_audit_trigger_func();

CREATE TRIGGER audit_protocols AFTER INSERT OR DELETE OR UPDATE ON public.renowell_protocols FOR EACH ROW EXECUTE FUNCTION public.renowell_audit_trigger_func();

CREATE TRIGGER audit_tasks AFTER INSERT OR DELETE OR UPDATE ON public.renowell_tasks FOR EACH ROW EXECUTE FUNCTION public.renowell_audit_trigger_func();

CREATE TRIGGER cleanup_snapshots_trigger AFTER INSERT ON public.renowell_form_draft_snapshots FOR EACH ROW EXECUTE FUNCTION public.renowell_cleanup_old_snapshots();

CREATE TRIGGER form_draft_snapshot_trigger BEFORE UPDATE ON public.renowell_form_drafts FOR EACH ROW EXECUTE FUNCTION public.renowell_save_draft_snapshot();

CREATE TRIGGER on_profile_updated AFTER UPDATE ON public.renowell_profiles FOR EACH ROW EXECUTE FUNCTION public.renowell_sync_profile_to_employee();

CREATE TRIGGER sync_profile_to_employee_trigger AFTER UPDATE ON public.renowell_profiles FOR EACH ROW EXECUTE FUNCTION public.renowell_sync_profile_to_employee();

CREATE TRIGGER trg_cleanup_old_snapshots AFTER INSERT ON public.renowell_form_draft_snapshots FOR EACH ROW EXECUTE FUNCTION public.renowell_cleanup_old_snapshots();

CREATE TRIGGER trg_employee_notes_updated_at BEFORE UPDATE ON public.renowell_employee_notes FOR EACH ROW EXECUTE FUNCTION public.renowell_update_updated_at_column();

CREATE TRIGGER trg_ensure_unique_direct_chat AFTER INSERT ON public.renowell_chat_participants FOR EACH ROW EXECUTE FUNCTION public.renowell_ensure_unique_direct_chat();

CREATE TRIGGER trg_save_draft_snapshot BEFORE UPDATE ON public.renowell_form_drafts FOR EACH ROW EXECUTE FUNCTION public.renowell_save_draft_snapshot();

CREATE TRIGGER update_calendar_events_updated_at BEFORE UPDATE ON public.renowell_calendar_events FOR EACH ROW EXECUTE FUNCTION public.renowell_update_updated_at_column();

CREATE TRIGGER update_chat_conversations_updated_at BEFORE UPDATE ON public.renowell_chat_conversations FOR EACH ROW EXECUTE FUNCTION public.renowell_update_updated_at_column();

CREATE TRIGGER update_employees_updated_at BEFORE UPDATE ON public.renowell_employees FOR EACH ROW EXECUTE FUNCTION public.renowell_update_updated_at_column();

CREATE TRIGGER update_form_drafts_updated_at BEFORE UPDATE ON public.renowell_form_drafts FOR EACH ROW EXECUTE FUNCTION public.renowell_update_updated_at_column();

CREATE TRIGGER update_news_posts_updated_at BEFORE UPDATE ON public.renowell_news_posts FOR EACH ROW EXECUTE FUNCTION public.renowell_update_updated_at_column();

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.renowell_profiles FOR EACH ROW EXECUTE FUNCTION public.renowell_update_updated_at_column();

CREATE TRIGGER update_projects_updated_at BEFORE UPDATE ON public.renowell_projects FOR EACH ROW EXECUTE FUNCTION public.renowell_update_updated_at_column();

CREATE TRIGGER update_protocol_items_updated_at BEFORE UPDATE ON public.renowell_protocol_items FOR EACH ROW EXECUTE FUNCTION public.renowell_update_updated_at_column();

CREATE TRIGGER update_protocol_sections_updated_at BEFORE UPDATE ON public.renowell_protocol_sections FOR EACH ROW EXECUTE FUNCTION public.renowell_update_updated_at_column();

CREATE TRIGGER update_protocols_updated_at BEFORE UPDATE ON public.renowell_protocols FOR EACH ROW EXECUTE FUNCTION public.renowell_update_updated_at_column();

CREATE TRIGGER update_task_comments_updated_at BEFORE UPDATE ON public.renowell_task_comments FOR EACH ROW EXECUTE FUNCTION public.renowell_update_updated_at_column();

CREATE TRIGGER update_tasks_updated_at BEFORE UPDATE ON public.renowell_tasks FOR EACH ROW EXECUTE FUNCTION public.renowell_update_updated_at_column();

CREATE TRIGGER update_tender_comments_updated_at BEFORE UPDATE ON public.renowell_tender_comments FOR EACH ROW EXECUTE FUNCTION public.renowell_update_updated_at_column();

CREATE TRIGGER update_tender_companies_updated_at BEFORE UPDATE ON public.renowell_tender_companies FOR EACH ROW EXECUTE FUNCTION public.renowell_update_updated_at_column();

CREATE TRIGGER update_tenders_updated_at BEFORE UPDATE ON public.renowell_tenders FOR EACH ROW EXECUTE FUNCTION public.renowell_update_updated_at_column();

ALTER TABLE ONLY public.renowell_birthday_greetings_log
    ADD CONSTRAINT renowell_birthday_greetings_log_news_post_id_fkey FOREIGN KEY (news_post_id) REFERENCES public.renowell_news_posts(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.renowell_calendar_events
    ADD CONSTRAINT renowell_calendar_events_creator_id_fkey FOREIGN KEY (creator_id) REFERENCES public.renowell_profiles(id);

ALTER TABLE ONLY public.renowell_call_participants
    ADD CONSTRAINT renowell_call_participants_call_id_fkey FOREIGN KEY (call_id) REFERENCES public.renowell_calls(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.renowell_call_participants
    ADD CONSTRAINT renowell_call_participants_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.renowell_profiles(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.renowell_calls
    ADD CONSTRAINT renowell_calls_caller_id_fkey FOREIGN KEY (caller_id) REFERENCES public.renowell_profiles(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.renowell_calls
    ADD CONSTRAINT renowell_calls_conversation_id_fkey FOREIGN KEY (conversation_id) REFERENCES public.renowell_chat_conversations(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.renowell_chat_conversations
    ADD CONSTRAINT renowell_chat_conversations_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.renowell_profiles(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.renowell_chat_direct_pairs
    ADD CONSTRAINT renowell_chat_direct_pairs_conversation_id_fkey FOREIGN KEY (conversation_id) REFERENCES public.renowell_chat_conversations(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.renowell_chat_message_reactions
    ADD CONSTRAINT renowell_chat_message_reactions_message_id_fkey FOREIGN KEY (message_id) REFERENCES public.renowell_chat_messages(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.renowell_chat_message_reactions
    ADD CONSTRAINT renowell_chat_message_reactions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.renowell_profiles(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.renowell_chat_messages
    ADD CONSTRAINT renowell_chat_messages_conversation_id_fkey FOREIGN KEY (conversation_id) REFERENCES public.renowell_chat_conversations(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.renowell_chat_messages
    ADD CONSTRAINT renowell_chat_messages_sender_id_fkey FOREIGN KEY (sender_id) REFERENCES public.renowell_profiles(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.renowell_chat_participants
    ADD CONSTRAINT renowell_chat_participants_conversation_id_fkey FOREIGN KEY (conversation_id) REFERENCES public.renowell_chat_conversations(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.renowell_chat_participants
    ADD CONSTRAINT renowell_chat_participants_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.renowell_profiles(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.renowell_chat_read_status
    ADD CONSTRAINT renowell_chat_read_status_conversation_id_fkey FOREIGN KEY (conversation_id) REFERENCES public.renowell_chat_conversations(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.renowell_chat_read_status
    ADD CONSTRAINT renowell_chat_read_status_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.renowell_profiles(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.renowell_comment_mentions
    ADD CONSTRAINT renowell_comment_mentions_comment_id_fkey FOREIGN KEY (comment_id) REFERENCES public.renowell_task_comments(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.renowell_comment_mentions
    ADD CONSTRAINT renowell_comment_mentions_mentioned_user_id_fkey FOREIGN KEY (mentioned_user_id) REFERENCES public.renowell_profiles(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.renowell_employees
    ADD CONSTRAINT renowell_employees_profile_id_fkey FOREIGN KEY (profile_id) REFERENCES public.renowell_profiles(id);

ALTER TABLE ONLY public.renowell_form_draft_snapshots
    ADD CONSTRAINT renowell_form_draft_snapshots_draft_id_fkey FOREIGN KEY (draft_id) REFERENCES public.renowell_form_drafts(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.renowell_hr_documents
    ADD CONSTRAINT renowell_hr_documents_uploaded_by_fkey FOREIGN KEY (uploaded_by) REFERENCES public.renowell_profiles(id);

ALTER TABLE ONLY public.renowell_notifications
    ADD CONSTRAINT renowell_notifications_recipient_id_fkey FOREIGN KEY (recipient_id) REFERENCES public.renowell_profiles(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.renowell_notifications
    ADD CONSTRAINT renowell_notifications_related_task_id_fkey FOREIGN KEY (related_task_id) REFERENCES public.renowell_tasks(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.renowell_protocol_item_comment_mentions
    ADD CONSTRAINT renowell_protocol_item_comment_mentions_comment_id_fkey FOREIGN KEY (comment_id) REFERENCES public.renowell_protocol_item_comments(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.renowell_protocol_item_comment_mentions
    ADD CONSTRAINT renowell_protocol_item_comment_mentions_mentioned_user_id_fkey FOREIGN KEY (mentioned_user_id) REFERENCES public.renowell_profiles(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.renowell_protocol_item_comments
    ADD CONSTRAINT renowell_protocol_item_comments_item_id_fkey FOREIGN KEY (item_id) REFERENCES public.renowell_protocol_items(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.renowell_protocol_items
    ADD CONSTRAINT renowell_protocol_items_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.renowell_projects(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.renowell_protocol_items
    ADD CONSTRAINT renowell_protocol_items_protocol_id_fkey FOREIGN KEY (protocol_id) REFERENCES public.renowell_protocols(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.renowell_protocol_items
    ADD CONSTRAINT renowell_protocol_items_section_id_fkey FOREIGN KEY (section_id) REFERENCES public.renowell_protocol_sections(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.renowell_protocol_items
    ADD CONSTRAINT renowell_protocol_items_task_id_fkey FOREIGN KEY (task_id) REFERENCES public.renowell_tasks(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.renowell_protocol_sections
    ADD CONSTRAINT renowell_protocol_sections_entity_id_fkey FOREIGN KEY (entity_id) REFERENCES public.renowell_projects(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.renowell_protocol_sections
    ADD CONSTRAINT renowell_protocol_sections_protocol_id_fkey FOREIGN KEY (protocol_id) REFERENCES public.renowell_protocols(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.renowell_support_messages
    ADD CONSTRAINT renowell_support_messages_user_profile_id_fkey FOREIGN KEY (user_profile_id) REFERENCES public.renowell_profiles(id);

ALTER TABLE ONLY public.renowell_support_telegram_map
    ADD CONSTRAINT renowell_support_telegram_map_user_profile_id_fkey FOREIGN KEY (user_profile_id) REFERENCES public.renowell_profiles(id);

ALTER TABLE ONLY public.renowell_task_comments
    ADD CONSTRAINT renowell_task_comments_author_id_fkey FOREIGN KEY (author_id) REFERENCES public.renowell_profiles(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.renowell_task_comments
    ADD CONSTRAINT renowell_task_comments_task_id_fkey FOREIGN KEY (task_id) REFERENCES public.renowell_tasks(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.renowell_tasks
    ADD CONSTRAINT renowell_tasks_assignee_id_fkey FOREIGN KEY (assignee_id) REFERENCES public.renowell_profiles(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.renowell_tasks
    ADD CONSTRAINT renowell_tasks_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.renowell_projects(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.renowell_tender_attachments
    ADD CONSTRAINT renowell_tender_attachments_tender_id_fkey FOREIGN KEY (tender_id) REFERENCES public.renowell_tenders(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.renowell_tender_attachments
    ADD CONSTRAINT renowell_tender_attachments_uploaded_by_fkey FOREIGN KEY (uploaded_by) REFERENCES public.renowell_profiles(id);

ALTER TABLE ONLY public.renowell_tender_checklist_items
    ADD CONSTRAINT renowell_tender_checklist_items_tender_id_fkey FOREIGN KEY (tender_id) REFERENCES public.renowell_tenders(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.renowell_tender_comments
    ADD CONSTRAINT renowell_tender_comments_tender_id_fkey FOREIGN KEY (tender_id) REFERENCES public.renowell_tenders(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.renowell_tender_contacts
    ADD CONSTRAINT renowell_tender_contacts_tender_id_fkey FOREIGN KEY (tender_id) REFERENCES public.renowell_tenders(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.renowell_tender_interactions
    ADD CONSTRAINT renowell_tender_interactions_author_id_fkey FOREIGN KEY (author_id) REFERENCES public.renowell_profiles(id);

ALTER TABLE ONLY public.renowell_tender_interactions
    ADD CONSTRAINT renowell_tender_interactions_tender_id_fkey FOREIGN KEY (tender_id) REFERENCES public.renowell_tenders(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.renowell_tenders
    ADD CONSTRAINT renowell_tenders_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.renowell_tender_companies(id) ON DELETE SET NULL;

CREATE TABLE public.renowell_users (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), email text NOT NULL UNIQUE, encrypted_password text, raw_user_meta_data jsonb DEFAULT '{}'::jsonb, created_at timestamptz NOT NULL DEFAULT now(), last_sign_in_at timestamptz);
CREATE TABLE public.renowell_refresh_tokens (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL REFERENCES public.renowell_users(id) ON DELETE CASCADE, token_hash text NOT NULL UNIQUE, expires_at timestamptz NOT NULL, created_at timestamptz NOT NULL DEFAULT now());
ALTER TABLE ONLY public.renowell_profiles ADD CONSTRAINT renowell_profiles_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.renowell_users(id) ON DELETE CASCADE NOT VALID;
