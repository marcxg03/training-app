# SLICE_5_SYNC_LAYER.md

## 1. Goal

Implement a localStorage-backed write queue that catches retryable failures (network, 5xx, 408, 429) for set_log and session_completion writes, drains automatically on reconnect or Logger remount, and surfaces queue state via a dot indicator in the Logger header — without changing the success-path behavior that Slice 4 ships.

## 2. Acceptance Criteria

1. New `src/lib/sync/queue.ts` exposes `enqueue`, `dequeue`, `loadQueue`, `updateAttempt` functions that read/write localStorage under the `training-app:queue:<user_id>:<row_id>` key namespace.
2. Each call to a queue mutation function emits a `queue-change` window event; subscribers receive the event synchronously.
3. New `src/lib/sync/classify.ts` exposes `isRetryable(errorOrResponse)` returning `true` for network errors, fetch aborts, 408, 429, and 5xx; `false` for 4xx other than 408/429; never called for 2xx.
4. New `src/lib/sync/handlers.ts` exposes a `handlers` map keyed by queue row `kind`, where each handler returns `{ ok: boolean, retryable: boolean }` and treats Postgres 23505 / HTTP 409 on retry as `{ ok: true, retryable: false }`.
5. New `src/lib/sync/drain.ts` exposes `drainQueue(userId)` that:
   a. Returns `{ skipped: true }` immediately if a drain is already in progress (re-entrancy guard via module-scope `drainState`).
   b. Loads queue rows in `enqueued_at` ascending order via `loadQueue`.
   c. Dispatches each row to the matching handler.
   d. On handler `{ ok: true }`: removes row from queue. For `set_log_insert` rows, runs PR detection as a derived effect.
   e. On handler `{ ok: false, retryable: true }`: leaves row in queue, calls `updateAttempt` with the error.
   f. Releases the drain lock and updates `drainState.lastDrainAt` after all rows are processed.
   g. Returns `{ skipped: false, succeeded: number, failed: number }`.
6. New `src/lib/sync/triggers.ts` exposes `setupDrainTriggers(userId)` that registers a `window.online` listener calling `drainQueue(userId)` and returns a cleanup function.
7. New `src/lib/sync/useQueueState.ts` exposes a `useQueueState(userId)` React hook returning `{ rows, drainState, pendingCount }`, subscribed to `queue-change` events with cleanup on unmount.
8. New `src/components/log/QueueIndicator.tsx` renders a dot in the Logger header: muted gray when `pendingCount === 0 && !drainState.inProgress`, lilac (`#9b7fd4`) with subtle 1s opacity pulse when `drainState.inProgress`, amber when `pendingCount > 0 && !drainState.inProgress`. Tap toggles `QueuePanel` open/closed.
9. New `src/components/log/QueuePanel.tsx` renders, when open: a header line summarizing state ("All synced — last sync 2 min ago" / "Syncing N..." / "N pending"), a per-row list rendering each row's kind in human-readable form (e.g., "Set 2 saved", "Block marked done", "Session started", "Session completed", "Session ended early") with the row's `attempts` count, and a "Retry now" button at the bottom that calls `drainQueue` and is disabled when `drainState.inProgress`.
10. `src/components/log/SetEntryForm.tsx` modified: pre-generates `set_log_id` client-side via `crypto.randomUUID()` before insert; on save failure, calls `isRetryable()` — if retryable, calls `enqueue` with a `set_log_insert` row and proceeds to next set form (treats save as locally-saved); if not retryable, shows existing inline error.
11. `src/components/log/LoggerShell.tsx` modified: registers `setupDrainTriggers` on mount, calls `drainQueue` directly on mount, renders `<QueueIndicator />` in the header next to "End session early"; same `enqueue`-on-retryable-failure pattern applied to the "Done with this block" handler (queues `session_completion_block_complete`).
12. `src/components/log/SessionSummary.tsx` modified: same `enqueue`-on-retryable-failure pattern applied to the "End session" / "End early" actions (queues `session_completion_end`).
13. `src/lib/auth/signOut.ts` modified: when called, checks `loadQueue(currentUserId).length > 0`; if so, displays a confirmation dialog with text "You have N unsynced sets. They'll be saved next time you sign in to this account on this device." and buttons "Cancel" / "Sign out anyway"; on cancel, sign-out is aborted; on confirm, proceeds with Supabase `signOut()` without clearing the queue.
14. PR detection (`src/lib/pr-detection.ts`) is unchanged; it runs as a derived effect inside the `set_log_insert` handler in `handlers.ts` after a successful insert.
15. `crypto.randomUUID()` is used for both `set_log_id` (in SetEntryForm) and queue row `id` (in `enqueue`); no new dependency added for UUID generation.
16. localStorage `QuotaExceededError` during `enqueue` is caught and surfaced as an inline error to the caller ("Local storage full — clear browser data or contact support") rather than silently dropping the write.
17. Pre-existing Slice 4 success-path behavior is preserved: when a save succeeds on the first attempt, the user experience is unchanged (no queue indicator color change beyond the brief lilac pulse during the in-flight request, which lands as the request completes).

## 3. Files to Create or Modify

### New files

- `src/lib/sync/queue.ts`
- `src/lib/sync/drain.ts`
- `src/lib/sync/handlers.ts`
- `src/lib/sync/classify.ts`
- `src/lib/sync/triggers.ts`
- `src/lib/sync/useQueueState.ts`
- `src/components/log/QueueIndicator.tsx`
- `src/components/log/QueuePanel.tsx`

### Modified files

- `src/components/log/SetEntryForm.tsx` — pre-generate `set_log_id`; classify failures; enqueue on retryable
- `src/components/log/LoggerShell.tsx` — register drain triggers on mount; render QueueIndicator; classify failures on "Done with this block"; enqueue on retryable
- `src/components/log/SessionSummary.tsx` — classify failures on "End session" / "End early"; enqueue on retryable
- `src/lib/auth/signOut.ts` — queue-non-empty confirmation modal gate

### Unchanged files (explicitly out of scope)

- `src/lib/pr-detection.ts` — invoked by handlers.ts as derived effect, not modified
- `src/lib/supabase/types.ts` — no DB schema changes (queue is localStorage)
- `src/lib/units/index.ts` — Slice 4.5 unit conversion unchanged
- All Supabase migration files — no new migrations
- All other Logger components (SetLogRow, etc.) — unchanged

## 4. Component / Function Contracts

### `queue.ts`

```typescript
type QueueRowKind =
  | 'set_log_insert'
  | 'session_completion_start'
  | 'session_completion_block_complete'
  | 'session_completion_end';

interface QueueRowBase {
  id: string;              // crypto.randomUUID()
  kind: QueueRowKind;
  payload: object;         // discriminated by kind, see types below
  attempts: number;        // increments on each drain attempt
  enqueued_at: string;     // ISO timestamp
  last_attempt_at: string | null;
  last_error: string | null;  // truncated to 200 chars
}

// Discriminated union of payloads (full schema per kind)
type QueueRow =
  | (QueueRowBase & { kind: 'set_log_insert'; payload: SetLogInsertPayload })
  | (QueueRowBase & { kind: 'session_completion_start'; payload: SessionCompletionStartPayload })
  | (QueueRowBase & { kind: 'session_completion_block_complete'; payload: SessionCompletionBlockCompletePayload })
  | (QueueRowBase & { kind: 'session_completion_end'; payload: SessionCompletionEndPayload });

// Public API
function enqueue(userId: string, row: QueueRow): void;
  // Writes to localStorage[`training-app:queue:${userId}:${row.id}`]
  // On QuotaExceededError: re-throws the error; caller responsible for inline error
  // Emits window CustomEvent('queue-change', { detail: { userId } })

function dequeue(userId: string, rowId: string): void;
  // Removes localStorage[`training-app:queue:${userId}:${rowId}`]
  // Emits window CustomEvent('queue-change', { detail: { userId } })

function loadQueue(userId: string): QueueRow[];
  // Scans localStorage keys matching `training-app:queue:${userId}:*`
  // Parses JSON, returns rows sorted by enqueued_at ascending
  // On parse error: skips that row, logs warning, does not throw

function updateAttempt(userId: string, rowId: string, error: string | null): void;
  // Reads existing row, increments attempts, sets last_attempt_at = now,
  // sets last_error = error.slice(0, 200) | null
  // Writes back to same key
  // Emits window CustomEvent('queue-change', { detail: { userId } })
```

### `classify.ts`

```typescript
function isRetryable(errorOrResponse: Error | Response): boolean;
  // Error: any Error (network failure, fetch abort) → true
  // Response with status 408, 429, 500-599 → true
  // Response with status 400-407, 409, 410-499 (excluding 408/429) → false
  // Response with status 200-299 → never reaches this function (caller's bug)
  // Note: 23505 / 409 on retry is treated as success in handlers.ts BEFORE
  //       reaching classify.ts; this fn is for the first-attempt-failure path
```

### `handlers.ts`

```typescript
interface HandlerResult {
  ok: boolean;
  retryable: boolean;
}

const handlers: Record<QueueRowKind, (row: QueueRow) => Promise>;

// set_log_insert handler:
//   POST to set_logs via Supabase client with row.payload
//   Success → { ok: true, retryable: false }
//     — Caller (drain.ts) runs PR detection on the inserted set_log
//   23505 (UNIQUE violation, set already exists) → { ok: true, retryable: false }
//     — Idempotent retry; row is conceptually saved; caller still runs PR detection
//   Network/5xx/408/429 → { ok: false, retryable: true }
//   Other 4xx → { ok: false, retryable: false }
//     — Logged as anomaly; should not happen if enqueue did its job

// session_completion_start handler:
//   INSERT into session_completions with row.payload
//   Success → { ok: true, retryable: false }
//   23505 (completion_id already exists) → { ok: true, retryable: false }
//     — Idempotent: completion was created by earlier successful retry
//   Network/5xx/408/429 → { ok: false, retryable: true }

// session_completion_block_complete handler:
//   UPDATE session_completions SET completed_block_ids = array_append(...)
//     WHERE completion_id = $1 AND NOT ($2 = ANY(completed_block_ids))
//   Success (rowCount === 1 OR rowCount === 0) → { ok: true, retryable: false }
//     — rowCount 0 means block_id was already in array (idempotent success)
//   Network/5xx/408/429 → { ok: false, retryable: true }

// session_completion_end handler:
//   UPDATE session_completions SET completed_at = $1, was_ended_early = $2
//     WHERE completion_id = $3
//   Success → { ok: true, retryable: false }
//   Network/5xx/408/429 → { ok: false, retryable: true }
```

### `drain.ts`

```typescript
interface DrainState {
  inProgress: boolean;
  lastDrainAt: string | null;
}

// Module-scope, NOT exported
let drainState: DrainState = { inProgress: false, lastDrainAt: null };

interface DrainResult {
  skipped: boolean;
  succeeded?: number;
  failed?: number;
}

async function drainQueue(userId: string): Promise;
  // 1. If drainState.inProgress: return { skipped: true }
  // 2. Set drainState.inProgress = true
  //    Emit CustomEvent('queue-change') so UI reflects "syncing" immediately
  // 3. Load rows via loadQueue(userId)
  // 4. For each row in enqueued_at order:
  //      result = await handlers[row.kind](row)
  //      If result.ok:
  //        dequeue(userId, row.id)
  //        If row.kind === 'set_log_insert':
  //          await runPrDetection(row.payload)  // imports from pre-detect.ts
  //      Else if result.retryable:
  //        updateAttempt(userId, row.id, lastErrorString(result))
  //      Else:
  //        // Should not happen; log warning
  //        updateAttempt(userId, row.id, lastErrorString(result))
  // 5. drainState.inProgress = false
  //    drainState.lastDrainAt = new Date().toISOString()
  //    Emit CustomEvent('queue-change') so UI reflects final state
  // 6. Return { skipped: false, succeeded: , failed:  }

// Exported solely for useQueueState hook to read
function getDrainState(): Readonly;
```

### `triggers.ts`

```typescript
function setupDrainTriggers(userId: string): () => void;
  // Registers window.addEventListener('online', () => drainQueue(userId))
  // Returns cleanup: () => window.removeEventListener('online', ...)
  // Does NOT register mount-time trigger; LoggerShell calls drainQueue
  //   directly on mount in its useEffect
  // Does NOT register manual-retry trigger; QueuePanel's "Retry now" button
  //   calls drainQueue directly via onClick
```

### `useQueueState.ts`

```typescript
interface QueueState {
  rows: QueueRow[];
  drainState: { inProgress: boolean; lastDrainAt: string | null };
  pendingCount: number;
}

function useQueueState(userId: string): QueueState;
  // useState initialized via { rows: loadQueue(userId), drainState: getDrainState(), pendingCount: rows.length }
  // useEffect: subscribe to window 'queue-change' event
  //   On event: re-read loadQueue, re-read getDrainState, setState
  //   Cleanup: removeEventListener
```

### `QueueIndicator.tsx`

```typescript
interface QueueIndicatorProps {
  userId: string;
  // No other props; reads queue state via useQueueState(userId)
}

function QueueIndicator({ userId }: QueueIndicatorProps): JSX.Element;
  // const { rows, drainState, pendingCount } = useQueueState(userId)
  // const [panelOpen, setPanelOpen] = useState(false)
  // Color logic:
  //   if drainState.inProgress: 'lilac' (#9b7fd4) with pulse animation
  //   else if pendingCount > 0: 'amber'
  //   else: 'gray' (text-zinc-500 or similar)
  // Renders a small button (8x8 dot inside larger tap target ~32x32)
  // onClick: setPanelOpen(!panelOpen)
  // When panelOpen: renders <QueuePanel onClose={() => setPanelOpen(false)} userId={userId} />
```

### `QueuePanel.tsx`

```typescript
interface QueuePanelProps {
  userId: string;
  onClose: () => void;
}

function QueuePanel({ userId, onClose }: QueuePanelProps): JSX.Element;
  // const { rows, drainState, pendingCount } = useQueueState(userId)
  // Header line:
  //   if drainState.inProgress: "Syncing {N}..." + spinner
  //   else if pendingCount > 0: "{N} pending"
  //   else: "All synced" + lastDrainAt formatted as "2 min ago" if not null
  // Per-row list (only shown when pendingCount > 0):
  //   For each row: render a line like:
  //     "Set 2 of Block 4" (for set_log_insert: derive from payload.set_index + payload.block_id)
  //     "Block 4 marked done" (for session_completion_block_complete)
  //     "Session started" / "Session ended" (for the two session_completion kinds)
  //     ...followed by "Retried Nx" if attempts > 0
  // "Retry now" button at bottom (always rendered, but disabled when drainState.inProgress)
  //   onClick: drainQueue(userId)
  // Click outside panel: onClose()
```

### Modified: `SetEntryForm.tsx` (delta)

```typescript
// At save handler entry:
const setLogId = crypto.randomUUID();  // pre-generate for idempotent retry

const payload: SetLogInsertPayload = {
  set_log_id: setLogId,
  user_id: userId,
  session_id: sessionId,
  block_id: blockId,
  exercise_id: selectedExerciseId,
  set_index: nextSetIndex,
  set_kind: setKind,
  weight_kg: lbsToKg(weightLbs),  // Slice 4.5 unchanged
  reps: parseInt(repsString, 10),
  is_failure: isFailureChecked,
  notes: notesText || null,
  logged_at: new Date().toISOString(),
};

try {
  const response = await supabase.from('set_logs').insert(payload);
  if (response.error) throw response.error;
  // Success path: existing Slice 4 behavior (advance to next set, run PR detection, etc.)
  await runPrDetection(payload);  // unchanged from Slice 4
  advanceToNextSet();
} catch (error) {
  if (isRetryable(error)) {
    try {
      enqueue(userId, {
        id: crypto.randomUUID(),
        kind: 'set_log_insert',
        payload,
        attempts: 0,
        enqueued_at: new Date().toISOString(),
        last_attempt_at: null,
        last_error: null,
      });
      // Treat as locally-saved: advance to next set form
      advanceToNextSet();
      // Note: PR detection does NOT run here — only after the queued
      //       insert succeeds in handlers.ts
    } catch (quotaError) {
      // localStorage full
      setInlineError('Local storage full — clear browser data or contact support');
    }
  } else {
    // Slice 4 inline error path — unchanged
    setInlineError(error.message || 'Save failed');
  }
}
```

### Modified: `LoggerShell.tsx` (delta)

```typescript
// In LoggerShell component:
useEffect(() => {
  // Drain on mount
  drainQueue(userId);
  // Register online event trigger
  const cleanup = setupDrainTriggers(userId);
  return cleanup;
}, [userId]);

// In header JSX (next to "End session early" button):


// In "Done with this block" handler:
try {
  // Existing UPDATE call to session_completions
  ...
} catch (error) {
  if (isRetryable(error)) {
    enqueue(userId, {
      id: crypto.randomUUID(),
      kind: 'session_completion_block_complete',
      payload: { completion_id, block_id },
      // ... base fields
    });
    // Advance UI to next block (treat as locally-saved)
    advanceToNextBlock();
  } else {
    setInlineError(error.message);
  }
}
```

### Modified: `SessionSummary.tsx` (delta)

Same pattern as LoggerShell's "Done with this block": classify error, enqueue if retryable, fall through to existing inline error path otherwise. Two action handlers affected: "End session" and "End early."

### Modified: `signOut.ts` (delta)

```typescript
async function signOut(userId: string): Promise {
  const queue = loadQueue(userId);
  if (queue.length > 0) {
    const confirmed = await showConfirmDialog({
      title: 'Sign out?',
      body: `You have ${queue.length} unsynced ${queue.length === 1 ? 'item' : 'items'}. They'll be saved next time you sign in to this account on this device.`,
      confirmLabel: 'Sign out anyway',
      cancelLabel: 'Cancel',
    });
    if (!confirmed) {
      return { aborted: true };
    }
  }
  await supabase.auth.signOut();
  // Note: queue is NOT cleared. It persists in localStorage under
  //       training-app:queue::* until that user signs back in.
  return { aborted: false };
}
```

(`showConfirmDialog` reuses whatever modal infrastructure already exists; if none exists, inline a simple `<dialog>` element. Do NOT create a new modal component file.)

## 5. Edge Cases to Handle

1. **Drain attempt while drain already in progress.** `drainQueue` re-entrancy guard via module-scope `drainState.inProgress` flag. Second concurrent call returns `{ skipped: true }` immediately.
2. **Queue contains rows with unknown `kind`.** `drain.ts`'s handler dispatch must guard against `handlers[row.kind] === undefined`. On unknown kind: log warning, leave row in queue, continue to next row. Do NOT crash the drain loop.
3. **Sign-out called while queue is mid-drain.** Don't interrupt the in-flight request. The sign-out flow checks `loadQueue` and prompts for confirmation; the drain continues to completion regardless. If user confirms sign-out, Supabase `signOut()` runs after the drain completes (or in parallel — the queue layer doesn't block the auth call).
4. **Logger remounts during active drain.** New mount's `useEffect` calls `drainQueue(userId)`, which sees `drainState.inProgress === true` and returns `{ skipped: true }`. No duplicate concurrent drain.
5. **Same set saved twice client-side (user double-tap on Save).** Slice 4's existing UNIQUE constraint on `(user_id, session_id, block_id, set_index)` catches this. Second insert fails with 23505. Queue layer treats 23505 on retry as success.
6. **Block completion queued, but user later ends session early before that completion drains.** Both rows in queue. `session_completion_end` payload reflects the FINAL state (may include the just-queued block in `completed_block_ids`, computed at enqueue time from local state). On drain, both apply idempotently: `array_append` with NOT ANY guard for the block, then `completed_at` UPDATE.
7. **localStorage quota exceeded during enqueue.** `enqueue` throws `QuotaExceededError`; caller catches and surfaces inline error "Local storage full — clear browser data or contact support". Do NOT silently drop the write.
8. **User signs in as different account on same device.** Previous user's queue rows remain in localStorage under their `user_id` namespace, untouched. Current user's `useQueueState(currentUserId)` only reads keys matching their own namespace.

## 6. Test Cases

These are the explicit tests run during Section 6 verification. Each maps to one or more acceptance criteria from §2.

### Happy path

**Test 1.** With network online, save a set in the Logger. Verify: set saves immediately to set_logs (Network tab shows 200), no queue rows created, QueueIndicator stays gray with no flicker, set appears in SetLogRow list. (AC 17)

**Test 2.** With network online, complete a block via "Done with this block." Verify: session_completion update lands (Network tab 200), no queue rows, QueueIndicator stays gray. (AC 17)

### Network failure → queue → drain on reconnect

**Test 3.** Open DevTools, set Network to "Offline." Save a set. Verify: QueueIndicator turns amber, "1 pending" in panel; set appears in SetLogRow list (treated as locally-saved); no row in set_logs database (Supabase query confirms). (AC 4, 8, 10, 17)

**Test 4.** Continuing from Test 3, save a second set. Verify: QueueIndicator shows amber, panel shows "2 pending" with both rows listed; database still has no rows for this session/block. (AC 8, 10)

**Test 5.** Continuing from Test 4, set Network back to "Online." Verify within ~2 seconds: QueueIndicator pulses lilac during drain, then turns gray; both queue rows are removed from localStorage (DevTools → Application → Local Storage); both set_logs appear in the database; PR detection has fired (pr_history rows exist if applicable). (AC 5, 6, 8)

### Manual retry

**Test 6.** With network offline, save a set (queues it). Open the QueuePanel. Tap "Retry now." Verify: drain attempts, fails (still offline), QueueIndicator stays amber, panel shows attempts=1 on the row. (AC 9)

**Test 7.** Continuing from Test 6, bring network back online. Tap "Retry now" before the `online` event fires. Verify: drain succeeds, queue empties, indicator returns to gray. (AC 9)

### Logger remount drain trigger

**Test 8.** With network offline, save a set (queues it). Navigate away from Logger (to `/today`). Bring network back online without triggering visibility change (browser tab stays focused). Verify: queue does NOT drain (no `online` event fired because tab was always foreground? — actually `online` does fire; this test specifically validates the mount trigger). Re-enter Logger via `/log/<session_id>`. Verify: on mount, drain fires; queue empties; indicator returns to gray.

**Note:** Test 8's premise (validating mount trigger separately from online trigger) requires careful sequencing. If `online` event already drained the queue before remount, the mount-trigger drain will return `{ skipped: false, succeeded: 0, failed: 0 }` (queue already empty). To isolate the mount trigger, perform the test by: keeping network online throughout, navigate away from Logger, manually call `enqueue` from the DevTools console while not on Logger (queue indicator not visible), then navigate to Logger. Mount-trigger drain should fire and clean up. (AC 11)

### 23505 idempotency on retry

**Test 9.** With network offline, save a set with set_index=5 in block X. The save queues. With DevTools, manually run an `INSERT INTO set_logs ...` SQL with the same `set_log_id` from the queue row (simulating a successful earlier retry). Bring network online. Verify: drain attempts the insert, gets 23505, treats as success, removes row from queue, runs PR detection (should be no-op given the row already exists in pr_history if applicable). QueueIndicator returns to gray. (AC 4, 5d)

### Inline error path preserved (4xx-other)

**Test 10.** With network online, save a set with an invalid input that triggers a 4xx (e.g., manipulate the payload via DevTools to send a malformed UUID for session_id). Verify: 4xx response, `isRetryable` returns false, inline error appears in SetEntryForm, no queue row created, QueueIndicator stays gray. (AC 3, 10)

### Sign-out queue confirmation

**Test 11.** With queue empty, sign out. Verify: no confirmation modal; sign-out proceeds directly. (AC 13)

**Test 12.** With network offline, save a set (queues it). Sign out. Verify: confirmation modal appears with text "You have 1 unsynced item." Tap Cancel. Verify: still signed in, queue intact. (AC 13)

**Test 13.** Continuing from Test 12, sign out again, tap "Sign out anyway." Verify: signed out; localStorage still contains the queue row under `training-app:queue:<old_user_id>:*`. Sign back in as same user. Verify: on next Logger mount, drain fires; queue drains (network must be online). (AC 13, edge case 8)

### localStorage quota

**Test 14.** Manually fill localStorage to ~5MB (write a large dummy key). With network offline, save a set. Verify: inline error appears with "Local storage full — clear browser data or contact support"; no queue row added. (AC 16)

### Re-entrancy guard

**Test 15.** With network online and one queue row present, simultaneously trigger drain from two sources (tap "Retry now" while `online` event fires). Verify: only one HTTP request goes out (Network tab); second drain returns `{ skipped: true }` silently; no duplicate inserts. (AC 5a, edge case 1)

### Queue indicator color states

**Test 16.** Start with queue empty: indicator gray. Save offline (queue→1): indicator turns amber. Tap Retry while still offline: indicator briefly pulses lilac during attempt, returns to amber on failure. Bring online and let drain happen: indicator pulses lilac during drain, returns to gray. (AC 8)

### PR detection runs on queued retry success

**Test 17.** With pr_history baseline at e.g. 200 lbs Bench, save offline a set at 220 lbs × 8 reps for Bench. Queue. Bring online. Verify: drain succeeds; pr_history has a new row at 220 lbs (Type A weight PR fired); set_log row exists in DB. (AC 5d, 14)

### Multi-account isolation

**Test 18.** Sign in as User A, save offline (queues 1 row keyed by A). Sign out (confirm "Sign out anyway"). Sign in as User B. Verify: User B's QueueIndicator shows gray (User A's queue invisible). User B's `useQueueState` does not load A's rows. Sign back in as User A. Verify: A's queue row still present, drains on mount. (AC 1, 7, edge case 8)

### Total: 18 tests across 7 categories.

## 7. Codex Generation Prompt

CONTEXT:
Slice 5 of training-app, a personal-first PWA for Marcus's training methodology.
Tech stack: Next.js 15 App Router + TypeScript strict + Tailwind + shadcn/ui +
Supabase (PostgreSQL) + pnpm + Node 20. Repo state: Slice 4 (Workout Logger)
and Slice 4.5 (lbs/kg display) shipped to main. Slice 4 mobility verified live.
Database is clean (3 historical PRs only). Spec docs in /spec/ are fully
reconciled with the locked Slice 5 design (MASTER_SPEC §4 §6 §8 §9 §10,
ARCHITECTURE §2 §4 §6 §7 §8 §9 §13).

TASK:
Implement the localStorage write queue for set_log and session_completion
operations, with drain triggers (online event + Logger mount + manual retry),
queue indicator UI in the Logger header, sign-out confirmation modal when
queue is non-empty. Pre-existing Slice 4 success-path behavior must be
preserved unchanged.

FILES TO CREATE:

src/lib/sync/queue.ts          // localStorage R/W, key namespacing, queue-change events
src/lib/sync/drain.ts          // re-entrant drainQueue with handler dispatch
src/lib/sync/handlers.ts       // typed handlers per row kind
src/lib/sync/classify.ts       // isRetryable(errorOrResponse)
src/lib/sync/triggers.ts       // setupDrainTriggers(userId)
src/lib/sync/useQueueState.ts  // React hook
src/components/log/QueueIndicator.tsx
src/components/log/QueuePanel.tsx

FILES TO MODIFY (only these — do not touch any others):

src/components/log/SetEntryForm.tsx
src/components/log/LoggerShell.tsx
src/components/log/SessionSummary.tsx
src/lib/auth/signOut.ts

CONSTRAINTS:

Tech stack: TypeScript strict mode; React functional components only;
Tailwind for styling; no new dependencies (use built-in localStorage,
built-in crypto.randomUUID, existing @supabase/ssr client, existing
React hooks).
Naming: follow /spec/ARCHITECTURE.md §4 Module Map for module names and
paths. Functions: camelCase. Types: PascalCase. React components:
PascalCase. Files: kebab-case for non-component .ts files; PascalCase
for .tsx component files. localStorage key namespace:
training-app:queue:<user_id>:<row_id>.
Color tokens: muted gray = text-zinc-500 (or existing token if defined
in tailwind.config.ts); lilac accent = #9b7fd4 (or existing token); amber
= use Tailwind's amber-500 or amber-400. The pulse animation on the
syncing dot is a 1s opacity loop (40%-100%-40%); use CSS keyframes,
not framer-motion.
Live database schema (set_logs, session_completions, pr_history): NO
changes. Slice 5 does not touch the database schema. Read the live schema
from src/lib/supabase/types.ts to ensure handler payloads match column
names.

ACCEPTANCE CRITERIA:
[Copy all 17 acceptance criteria from §2 above, numbered identically.]

EDGE CASES:
[Copy all 8 edge cases from §5 above.]

DO NOT:

Modify any file outside the allowlist above. Specifically: do NOT modify
src/lib/pr-detection.ts, src/lib/units/index.ts, src/lib/supabase/types.ts,
any other Logger components (SetLogRow, etc.), any Supabase migration
files, any /spec/ files, or any /tests/ files.
Add new dependencies (no IndexedDB libs, no Zustand, no framer-motion,
no UUID library — use built-in primitives only).
Create a new modal component file. Reuse existing modal infrastructure
for the sign-out confirmation; if none exists in the codebase, inline a
simple <dialog> element directly in signOut.ts.
Use a Context provider for queue state. The locked design is module-scope
drainState in drain.ts + useQueueState hook reading from localStorage and
drain.ts via 'queue-change' events. Adding Context here violates the
hybrid-state-pattern decision in ARCHITECTURE §7 Slice 5 subsection.
Implement periodic background drain (deferred per MASTER_SPEC §10 OS5.2).
Implement retry attempt cap or "needs attention" UI (deferred per
MASTER_SPEC §8 Sync semantics + §10 OS5.3).
Run PR detection inside the queue layer except as a derived effect of
set_log_insert handler success in drain.ts. PR detection logic itself
(src/lib/pr-detection.ts) is NOT modified.
Leave placeholder comments, TODOs, or stub functions.

OUTPUT:
Write the complete implementation across the 8 new files and the 4
modified files. Do not explain — just produce the code. At the end, list:

Every assumption you made
Every column name from set_logs / session_completions / pr_history that
you referenced (so I can diff against types.ts)
Every external API endpoint called (Supabase RPC names if any)
Every env var read (should be none — Slice 5 doesn't add any)


## 8. Claude Code Quality Review Prompt

CONTEXT:
Slice 5 of training-app: localStorage write queue with drain triggers,
queue indicator UI, sign-out confirmation modal. Codex just generated
the implementation across 8 new files and 4 modified files. The slice
doc is at /spec/slices/SLICE_5_SYNC_LAYER.md.

FILES CODEX TOUCHED:

src/lib/sync/queue.ts (new)
src/lib/sync/drain.ts (new)
src/lib/sync/handlers.ts (new)
src/lib/sync/classify.ts (new)
src/lib/sync/triggers.ts (new)
src/lib/sync/useQueueState.ts (new)
src/components/log/QueueIndicator.tsx (new)
src/components/log/QueuePanel.tsx (new)
src/components/log/SetEntryForm.tsx (modified)
src/components/log/LoggerShell.tsx (modified)
src/components/log/SessionSummary.tsx (modified)
src/lib/auth/signOut.ts (modified)

REVIEW CHECKLIST:
Read every file in the list above and address, in order:

Naming consistency across files. Variables, functions, types, queue row
kinds, localStorage key namespace. Especially: every reference to the
queue key namespace must be exactly training-app:queue:<userId>:<rowId>
(no variants). Every queue row kind must use exactly the four strings
from §4 contracts: 'set_log_insert', 'session_completion_start',
'session_completion_block_complete', 'session_completion_end'.
Error handling. Every Supabase call in handlers.ts must catch errors
and route through isRetryable. Every localStorage read in queue.ts
loadQueue must handle JSON.parse failure (skip row, log, continue —
do not throw). Every localStorage write must handle QuotaExceededError
at the caller (enqueue must propagate the error; SetEntryForm must
catch and show inline error).
Re-entrancy guard in drain.ts. drainState.inProgress must be set BEFORE
any await; released in finally block (or equivalent) so an exception
doesn't leave the lock stuck.
PR detection trigger. drain.ts must call runPrDetection ONLY after a
set_log_insert handler returns { ok: true }. Not for other kinds. Not
for failed handlers. Not redundantly (check the existing pr-detection.ts
internal idempotency on pr_history UNIQUE).
Color tokens in QueueIndicator. Three states only: gray (idle),
lilac with pulse (syncing), amber (pending). No green. No red. Pulse
animation must be CSS keyframes (not JS-driven, not framer-motion).
Sign-out flow. signOut.ts must check queue length BEFORE calling
Supabase signOut. Cancel must abort the entire flow (no Supabase call).
"Sign out anyway" must NOT clear the queue from localStorage. The
confirmation dialog must use existing modal infrastructure if any
exists; if not, an inline <dialog> element is acceptable but a new
modal component file is NOT.
Idempotency on 23505 / 409. handlers.ts for set_log_insert and
session_completion_start must treat the unique-violation response as
{ ok: true, retryable: false } — NOT as a retryable error and NOT as
a non-retryable failure. Same for session_completion_block_complete's
array_append idempotency (rowCount === 0 means block was already in
the array, treat as success).
set_log_id pre-generation. SetEntryForm.tsx must generate set_log_id
via crypto.randomUUID() BEFORE the insert call. The same set_log_id
must be used in both the immediate insert path and the queued retry
path (so retries are idempotent against the existing UNIQUE constraint
on user_id+session_id+block_id+set_index).
Cross-file concerns:

useQueueState's CustomEvent type matches what queue.ts emits
QueueIndicator's color logic matches drain.ts's drainState shape
QueuePanel's per-row rendering matches the discriminated union from
queue.ts's QueueRow type
signOut.ts's queue length check uses the same loadQueue function
as the rest of the system


Dead code, unused imports, commented-out blocks: remove.
Placeholder TODOs, stub functions, "implement later" notes: remove
or surface as flagged items.
Slice 4.5 unit handling preserved: SetEntryForm.tsx must still call
lbsToKg() before assembling the queue payload. weight_kg in the
payload is canonical kg, not lbs.
.env.example: no new env vars introduced by Slice 5. Verify the file
is unchanged.

AUTO-FIX vs FLAG:

Auto-fix: items 1-12 above when the fix is local and unambiguous
Flag for approval: structural changes (e.g., extracting a shared helper
across multiple files, moving a function to a different module, changing
the discriminated union shape), API contract changes, refactors that
alter the queue's public API, subjective style preferences when the
existing code is acceptable

CONSTRAINTS:

Do not add new features
Do not change the folder structure from ARCHITECTURE.md §3
Do not modify files outside the list above
Preserve Codex's overall structure unless it violates ARCHITECTURE.md
conventions or one of the review items above

OUTPUT:
Summary with four parts:

Files changed and why (one line each)
Items flagged for user approval with reasoning
Any issues logged for KNOWN_ISSUES.md
Ready-for-testing verdict (yes / no — if no, what's blocking)


## 9. Claude Code Debugging Prompt

CONTEXT:
Slice 5 of training-app: localStorage write queue with drain triggers,
queue indicator UI, sign-out confirmation modal. Implementation generated
by Codex and reviewed by Claude Code's quality pass. Now in testing.

CURRENT PROBLEM:
[FILL IN: exact error message, screenshot description, or symptom. Be
specific — "the queue isn't draining" is not enough; "drainQueue returns
{ skipped: false, succeeded: 0, failed: 1 } and the network tab shows a
401 instead of the expected 200" is what's needed.]

RELEVANT FILES:
[List of files involved — pull from the slice doc's Files to Create/Modify
section if uncertain]

WHAT CODEX BUILT / QUALITY REVIEW COVERED:
[Brief summary — what's working, what's not, what the review pass already
addressed. Reference the review pass output if available.]

CONSTRAINTS:

Tech stack: TypeScript strict, React, Tailwind, Supabase via @supabase/ssr.
Do not refactor outside the current problem.
Slice 5 design constraints from ARCHITECTURE.md and MASTER_SPEC.md still
apply: no Context for queue state, no new dependencies, no schema changes,
module-scope drainState in drain.ts.
Slice 4 PR detection unchanged — if a fix involves modifying
src/lib/pr-detection.ts, surface it as a flagged item rather than
applying directly (PR detection bugs may require a separate Slice 4.7
corrective).

ACCEPTANCE CRITERIA:
[Pull the specific acceptance criterion(a) being violated from §2. Include
all relevant ones — do not narrow prematurely.]

DO NOT:

Rewrite files that are working
Add features outside the current fix
Change the folder structure from ARCHITECTURE.md
Generate a new slice from scratch — if that's what's needed, stop and
tell me to take it to Codex

OUTPUT:
Fix the problem. Summarize what was changed, why, and list any follow-up
issues for the next session.
