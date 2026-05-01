ALTER TABLE set_logs
ADD CONSTRAINT set_logs_user_session_block_set_index_key
UNIQUE (user_id, session_id, block_id, set_index);
