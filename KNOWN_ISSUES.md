# KNOWN_ISSUES

🟢 Low — Recovery activity type granularity. See
`spec/FUTURE_WORK.md` for the full structural item; this entry
exists so the issue is visible in the known-issues scan.

## Slice 1 — Project Scaffold + Auth

### 🟢 Low — Supabase free-tier email rate limit blocks rapid repeat sign-ins

Supabase free-tier email rate limit (~3-4 magic links per hour per
email address) can block testing with rapid repeat sign-ins. The
LoginForm surfaces "email rate limit exceeded" inline and returns to
idle state correctly. Workaround: wait ~1 hour, or use a different
email for repeat tests.

## Slice 2 — Plan Migration

### 🟢 Low — Migration 007 was briefly extended in Slice 2 but the changes did not take effect on the remote

Codex extended `007_rls_policies.sql` with policies for the new
Slice 2 tables and ran `supabase db push --include-all` to force-
apply. The CLI reported success but the remote DB never received the
new policies — the Supabase CLI does not re-apply tracked migrations
even with `--include-all`. The dashboard still showed RLS disabled or
zero policies on every Slice 2 table.

The immutability rule was applied immediately: 007 was reverted to
its Slice 1 form (profiles policies only) and the extended policies
moved to a new `008_extended_rls.sql`, which was applied cleanly via
`supabase db push`. Remote DB now has RLS enabled with correct
policies on all 10 tables.
