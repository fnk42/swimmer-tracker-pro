-- Two parents per swimmer.
--
-- A child usually has two adults who both need to see the registration, the
-- balance and the swimming. Until now the link table allowed one, and the
-- second adult to try was refused as if they were a stranger claiming someone
-- else's child.
--
-- The cap is enforced here rather than only in the API, so an application bug
-- cannot quietly attach a third adult to a child. sort_order is the slot — 1
-- or 2 — and a swimmer can hold each slot once, which means at most two rows
-- per swimmer and no way to express a third.
--
-- Safe on the current data: 24 links, every one in slot 1, no duplicates.

ALTER TABLE public.swimmer_parents
  DROP CONSTRAINT IF EXISTS swimmer_parents_slot_check;

ALTER TABLE public.swimmer_parents
  ADD CONSTRAINT swimmer_parents_slot_check CHECK (sort_order IN (1, 2));

DROP INDEX IF EXISTS public.swimmer_parents_one_per_slot;

CREATE UNIQUE INDEX swimmer_parents_one_per_slot
  ON public.swimmer_parents (swimmer_id, sort_order);
