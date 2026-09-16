-- One-time login codes for parents. Replaces Supabase Auth.
--
-- The code itself is never stored — only a keyed hash — so a leaked database
-- dump cannot be used to log in as a parent. Codes expire, are single-use, and
-- give up after a handful of wrong attempts.

CREATE TABLE IF NOT EXISTS public.auth_codes (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    email       text        NOT NULL,
    code_hash   text        NOT NULL,
    expires_at  timestamptz NOT NULL,
    attempts    integer     NOT NULL DEFAULT 0,
    consumed_at timestamptz,
    created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS auth_codes_email_idx
    ON public.auth_codes (lower(email), created_at DESC);

-- Parents are matched on email, case-insensitively, so make that lookup cheap
-- and guard against the same address being attached to two parent rows.
CREATE UNIQUE INDEX IF NOT EXISTS parents_email_lower_uniq
    ON public.parents (lower(email)) WHERE email IS NOT NULL;
