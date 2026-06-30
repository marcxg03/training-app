-- =============================================================================
-- Coaching domain — relationships, notes, and coach-set nutrition targets.
--
-- Design notes:
--   * Athlete tables (set_logs, pr_history, workouts, meal_entries, …) keep
--     their existing strictly-own-data RLS. A coach NEVER reads a client's
--     private logs through these policies; coach-facing analytics are read on
--     the server with the service role AFTER the coach↔client relationship is
--     verified against coach_clients (see src/lib/coach/queries.ts). This keeps
--     the cross-user surface tiny and reviewable and avoids reopening any
--     already-applied migration.
--   * coach_notes is append-only (SELECT + INSERT only) — coaching history,
--     like set_logs / pr_history, accumulates and is never edited or deleted.
-- =============================================================================

CREATE TYPE coach_relationship_status AS ENUM ('invited', 'active', 'paused');
CREATE TYPE coach_note_author AS ENUM ('coach', 'client');

-- The coach ↔ client relationship. A row exists from the moment a coach invites
-- someone (client_user_id NULL, status 'invited') and is linked to a real user
-- once that person signs in with the invited email (see link_pending_coach_invites).
CREATE TABLE coach_clients (
  relationship_id    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  coach_user_id      uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  client_user_id     uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  invite_email       text NOT NULL,
  invite_name        text,
  status             coach_relationship_status NOT NULL DEFAULT 'invited',
  -- Starting goal mode captured at onboard (optional; the client can change it).
  goal_mode          goal_mode_enum,
  -- The coach's library plan assigned to this client (denormalised name so the
  -- client can display it without read access to the coach's training_plans).
  assigned_plan_id   uuid REFERENCES training_plans(plan_id) ON DELETE SET NULL,
  assigned_plan_name text,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT coach_clients_not_self
    CHECK (client_user_id IS NULL OR client_user_id <> coach_user_id)
);

-- One invite per email per coach (case-insensitive).
CREATE UNIQUE INDEX uq_coach_clients_coach_email
  ON coach_clients (coach_user_id, lower(invite_email));
-- One linked relationship per coach/client pair.
CREATE UNIQUE INDEX uq_coach_clients_pair
  ON coach_clients (coach_user_id, client_user_id)
  WHERE client_user_id IS NOT NULL;
CREATE INDEX idx_coach_clients_coach ON coach_clients (coach_user_id);
CREATE INDEX idx_coach_clients_client ON coach_clients (client_user_id);

CREATE TRIGGER coach_clients_set_updated_at
  BEFORE UPDATE ON coach_clients
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Notes thread between coach and client. Append-only.
CREATE TABLE coach_notes (
  note_id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  relationship_id uuid NOT NULL REFERENCES coach_clients(relationship_id)
                    ON DELETE CASCADE,
  author          coach_note_author NOT NULL,
  body            text NOT NULL CHECK (length(btrim(body)) > 0),
  -- Coach notes are client-visible by design; flag kept explicit for private
  -- coach memos in future. Client-authored notes are always visible to both.
  client_visible  boolean NOT NULL DEFAULT true,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_coach_notes_relationship
  ON coach_notes (relationship_id, created_at);

-- Coach-set nutrition targets for a client (one set per relationship).
CREATE TABLE coach_client_targets (
  relationship_id uuid PRIMARY KEY REFERENCES coach_clients(relationship_id)
                    ON DELETE CASCADE,
  goal_mode       goal_mode_enum NOT NULL DEFAULT 'maintain',
  cal_min         integer NOT NULL,
  cal_max         integer NOT NULL,
  protein_min_g   integer NOT NULL,
  protein_max_g   integer NOT NULL,
  carbs_min_g     integer NOT NULL,
  carbs_max_g     integer NOT NULL,
  fat_min_g       integer NOT NULL,
  fat_max_g       integer NOT NULL,
  updated_at      timestamptz NOT NULL DEFAULT now(),
  CHECK (cal_max >= cal_min),
  CHECK (protein_max_g >= protein_min_g),
  CHECK (carbs_max_g >= carbs_min_g),
  CHECK (fat_max_g >= fat_min_g)
);

CREATE TRIGGER coach_client_targets_set_updated_at
  BEFORE UPDATE ON coach_client_targets
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Links any pending invites addressed to the caller's verified email to the
-- caller and activates them. SECURITY DEFINER so it can read auth.users; it only
-- ever touches rows whose invite_email matches the caller's own email, so a user
-- can never attach themselves to an arbitrary relationship.
CREATE OR REPLACE FUNCTION link_pending_coach_invites()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller_email text;
  linked_count integer;
BEGIN
  SELECT email INTO caller_email FROM auth.users WHERE id = auth.uid();

  IF caller_email IS NULL THEN
    RETURN 0;
  END IF;

  UPDATE coach_clients
     SET client_user_id = auth.uid(),
         status = CASE WHEN status = 'invited' THEN 'active' ELSE status END,
         updated_at = now()
   WHERE client_user_id IS NULL
     AND lower(invite_email) = lower(caller_email)
     -- Guard against the unique-pair index: skip if this coach already has the
     -- caller linked through another row.
     AND NOT EXISTS (
       SELECT 1 FROM coach_clients existing
        WHERE existing.coach_user_id = coach_clients.coach_user_id
          AND existing.client_user_id = auth.uid()
     );

  GET DIAGNOSTICS linked_count = ROW_COUNT;
  RETURN linked_count;
END;
$$;

REVOKE ALL ON FUNCTION link_pending_coach_invites() FROM public;
GRANT EXECUTE ON FUNCTION link_pending_coach_invites() TO authenticated;

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

ALTER TABLE coach_clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE coach_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE coach_client_targets ENABLE ROW LEVEL SECURITY;

-- coach_clients: the coach owns/manages the row; the client may read their own.
CREATE POLICY "coach_manage" ON coach_clients
  FOR ALL
  USING (auth.uid() = coach_user_id)
  WITH CHECK (auth.uid() = coach_user_id);

CREATE POLICY "client_read" ON coach_clients
  FOR SELECT
  USING (auth.uid() = client_user_id);

-- coach_notes: append-only. Coach sees all notes on their relationships; client
-- sees coach notes marked visible plus their own notes.
CREATE POLICY "notes_select" ON coach_notes
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM coach_clients cc
       WHERE cc.relationship_id = coach_notes.relationship_id
         AND (
           cc.coach_user_id = auth.uid()
           OR (
             cc.client_user_id = auth.uid()
             AND (coach_notes.client_visible OR coach_notes.author = 'client')
           )
         )
    )
  );

CREATE POLICY "notes_insert_coach" ON coach_notes
  FOR INSERT
  WITH CHECK (
    author = 'coach'
    AND EXISTS (
      SELECT 1 FROM coach_clients cc
       WHERE cc.relationship_id = coach_notes.relationship_id
         AND cc.coach_user_id = auth.uid()
    )
  );

CREATE POLICY "notes_insert_client" ON coach_notes
  FOR INSERT
  WITH CHECK (
    author = 'client'
    AND EXISTS (
      SELECT 1 FROM coach_clients cc
       WHERE cc.relationship_id = coach_notes.relationship_id
         AND cc.client_user_id = auth.uid()
    )
  );

-- No UPDATE / DELETE policies on coach_notes — append-only.

-- coach_client_targets: coach manages; client reads.
CREATE POLICY "targets_coach_manage" ON coach_client_targets
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM coach_clients cc
       WHERE cc.relationship_id = coach_client_targets.relationship_id
         AND cc.coach_user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM coach_clients cc
       WHERE cc.relationship_id = coach_client_targets.relationship_id
         AND cc.coach_user_id = auth.uid()
    )
  );

CREATE POLICY "targets_client_read" ON coach_client_targets
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM coach_clients cc
       WHERE cc.relationship_id = coach_client_targets.relationship_id
         AND cc.client_user_id = auth.uid()
    )
  );
