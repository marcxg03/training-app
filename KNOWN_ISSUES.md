# KNOWN_ISSUES

## Slice 1 — Project Scaffold + Auth

### 🟢 Low — Supabase free-tier email rate limit blocks rapid repeat sign-ins

Supabase free-tier email rate limit (~3-4 magic links per hour per
email address) can block testing with rapid repeat sign-ins. The
LoginForm surfaces "email rate limit exceeded" inline and returns to
idle state correctly. Workaround: wait ~1 hour, or use a different
email for repeat tests.
