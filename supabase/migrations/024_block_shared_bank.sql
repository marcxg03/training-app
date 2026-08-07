-- Let several blocks share ONE exercise bank.
--
-- The methodology interleaves the same muscle group through a session: Upper
-- runs Chest at positions 1, 4 and 7, between the pulls and shoulders. Those
-- were three separate blocks ("Chest 1/2/3") with three overlapping, separately
-- maintained banks — editing the chest exercise list meant editing it three
-- times, and they drifted.
--
-- A block may now point at another block as the owner of its exercise bank.
-- The slots stay distinct rows, which is what everything else depends on:
-- workout_blocks, set_logs.block_id and workout_completions.completed_block_ids
-- all key on block_id, and the logger identifies a slot by it. Only the bank is
-- shared.

ALTER TABLE blocks
ADD COLUMN bank_source_block_id uuid
  REFERENCES blocks(block_id) ON DELETE SET NULL;

-- A block cannot source its bank from itself.
ALTER TABLE blocks
ADD CONSTRAINT blocks_bank_source_not_self
  CHECK (bank_source_block_id IS NULL OR bank_source_block_id <> block_id);

CREATE INDEX idx_blocks_bank_source ON blocks (bank_source_block_id);

-- One level only: a bank source must itself own its bank. Without this a chain
-- (or cycle) would make "where do this block's exercises live" unanswerable,
-- and resolution is a single lookup everywhere in the app.
CREATE OR REPLACE FUNCTION blocks_bank_source_is_owner()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.bank_source_block_id IS NOT NULL
     AND EXISTS (
       SELECT 1 FROM blocks
       WHERE block_id = NEW.bank_source_block_id
         AND bank_source_block_id IS NOT NULL
     )
  THEN
    RAISE EXCEPTION
      'bank_source_block_id must reference a block that owns its bank (no chains)';
  END IF;

  -- Symmetric guard: a block that others source from cannot itself become a
  -- follower, which would turn an existing link into a chain.
  IF NEW.bank_source_block_id IS NOT NULL
     AND EXISTS (
       SELECT 1 FROM blocks WHERE bank_source_block_id = NEW.block_id
     )
  THEN
    RAISE EXCEPTION
      'this block is already the bank source for another block';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER blocks_bank_source_is_owner_trigger
BEFORE INSERT OR UPDATE OF bank_source_block_id ON blocks
FOR EACH ROW EXECUTE FUNCTION blocks_bank_source_is_owner();
