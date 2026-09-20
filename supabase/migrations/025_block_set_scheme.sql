-- Adjustable set-scheme per block.
--
-- The logger used to hardcode every 'failure' block as WU + W1 + W2 — a fixed
-- three sets, auto-completing after the third. The methodology needs more: a
-- block might be 2 working sets, 2 sets to failure, or 1 warm-up + 2 working.
--
-- The scheme is three additive columns on `blocks`. Their defaults reproduce
-- today's behavior exactly (1 warm-up + 2 working = 3 sets), so every existing
-- block is unchanged without a backfill. Nothing else in the wiring contract
-- moves: set_logs / pr_history stay append-only, weight_kg stays as-is, no
-- column is renamed, and there is NO set_role column — a set's role stays
-- derived from its set_index position (index 1..warmup_sets = warm-ups, the
-- rest = working sets, the last working set optionally taken to failure).

ALTER TABLE blocks
ADD COLUMN warmup_sets int NOT NULL DEFAULT 1,
ADD COLUMN working_sets int NOT NULL DEFAULT 2,
ADD COLUMN to_failure boolean NOT NULL DEFAULT false;

-- A block must have at least one working set to be loggable; warm-ups may be
-- zero. These bound the scheme without touching the wiring contract.
ALTER TABLE blocks
ADD CONSTRAINT blocks_warmup_sets_nonneg CHECK (warmup_sets >= 0),
ADD CONSTRAINT blocks_working_sets_positive CHECK (working_sets >= 1);
