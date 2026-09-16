-- NextGen / Machakos 2026 — schema for Neon
-- Generated from the Supabase cluster backup by migration/extract.py
-- No RLS: access control lives in the server routes, not the database,
-- because the browser no longer holds a database key.

BEGIN;

CREATE TABLE public.swimmers (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    age integer,
    gender text,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT swimmers_gender_check CHECK ((gender = ANY (ARRAY['Male'::text, 'Female'::text])))
);

CREATE TABLE public.parents (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    full_name text NOT NULL,
    gender text,
    phone text NOT NULL,
    staying_overnight text DEFAULT 'Yet to decide'::text NOT NULL,
    user_id uuid,
    backfill_note text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    email text,
    CONSTRAINT parents_gender_check CHECK ((gender = ANY (ARRAY['Male'::text, 'Female'::text]))),
    CONSTRAINT parents_phone_check CHECK ((phone ~ '^254[0-9]{9}$'::text)),
    CONSTRAINT parents_staying_overnight_check CHECK ((staying_overnight = ANY (ARRAY['Yes'::text, 'No'::text, 'Yet to decide'::text])))
);

CREATE TABLE public.swimmer_parents (
    swimmer_id uuid NOT NULL,
    parent_id uuid NOT NULL,
    sort_order integer DEFAULT 1 NOT NULL
);

CREATE TABLE public.registrations (
    swimmer_id uuid NOT NULL,
    age integer NOT NULL,
    gender text NOT NULL,
    parent_sleepover text NOT NULL,
    owns_cellphone text NOT NULL,
    parent1_name text NOT NULL,
    parent2_name text,
    primary_phone text NOT NULL,
    secondary_phone text,
    dietary text,
    allergies text,
    health_conditions text,
    special_requests text,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    guardian_gender text,
    CONSTRAINT registrations_gender_check CHECK ((gender = ANY (ARRAY['Male'::text, 'Female'::text]))),
    CONSTRAINT registrations_guardian_gender_check CHECK (((guardian_gender IS NULL) OR (guardian_gender = ANY (ARRAY['Male'::text, 'Female'::text])))),
    CONSTRAINT registrations_owns_cellphone_check CHECK ((owns_cellphone = ANY (ARRAY['Yes'::text, 'No'::text]))),
    CONSTRAINT registrations_parent_sleepover_check CHECK ((parent_sleepover = ANY (ARRAY['Yes'::text, 'No'::text, 'Yet to decide'::text])))
);

CREATE TABLE public.payments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    swimmer_id uuid NOT NULL,
    amount numeric(10,2) NOT NULL,
    reference text NOT NULL,
    type text NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    child_count integer DEFAULT 1 NOT NULL,
    swimmer_ids jsonb DEFAULT '[]'::jsonb NOT NULL,
    CONSTRAINT payments_amount_check CHECK ((amount > (0)::numeric)),
    CONSTRAINT payments_child_count_check CHECK ((child_count >= 1)),
    CONSTRAINT payments_type_check CHECK ((type = ANY (ARRAY['Deposit'::text, 'Partial'::text, 'Final'::text])))
);

-- primary keys
ALTER TABLE ONLY public.parents ADD CONSTRAINT parents_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.payments ADD CONSTRAINT payments_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.registrations ADD CONSTRAINT registrations_pkey PRIMARY KEY (swimmer_id);
ALTER TABLE ONLY public.swimmer_parents ADD CONSTRAINT swimmer_parents_pkey PRIMARY KEY (swimmer_id, parent_id);
ALTER TABLE ONLY public.swimmers ADD CONSTRAINT swimmers_pkey PRIMARY KEY (id);

-- foreign keys
ALTER TABLE ONLY public.payments ADD CONSTRAINT payments_swimmer_id_fkey FOREIGN KEY (swimmer_id) REFERENCES public.swimmers(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.registrations ADD CONSTRAINT registrations_swimmer_id_fkey FOREIGN KEY (swimmer_id) REFERENCES public.swimmers(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.swimmer_parents ADD CONSTRAINT swimmer_parents_parent_id_fkey FOREIGN KEY (parent_id) REFERENCES public.parents(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.swimmer_parents ADD CONSTRAINT swimmer_parents_swimmer_id_fkey FOREIGN KEY (swimmer_id) REFERENCES public.swimmers(id) ON DELETE CASCADE;

-- indexes
CREATE INDEX idx_payments_created_at ON public.payments USING btree (created_at DESC);
CREATE INDEX idx_payments_swimmer_id ON public.payments USING btree (swimmer_id);
CREATE INDEX idx_registrations_swimmer_id ON public.registrations USING btree (swimmer_id);
CREATE INDEX parents_email_idx ON public.parents USING btree (email);
CREATE UNIQUE INDEX parents_user_id_uniq ON public.parents USING btree (user_id) WHERE (user_id IS NOT NULL);
CREATE INDEX swimmer_parents_parent_id_idx ON public.swimmer_parents USING btree (parent_id);

COMMIT;
