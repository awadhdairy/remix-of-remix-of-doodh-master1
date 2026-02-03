
## What’s most likely happening (why BOTH delete + deactivate fail)
Since **both** `delete-user` and `update-user-status` are failing with the same generic “Edge Function returned a non-2xx status code”, the most probable cause is **one shared gate that both functions use**:

### Shared gate = “is requesting user a super_admin?”
Both functions do this pattern:

- verify JWT (`getUser(token)`)
- then:
  ```ts
  const { data: roleData, error: roleError } = await supabaseAdmin
    .from('user_roles')
    .select('role')
    .eq('user_id', requestingUser.id)
    .single()

  if (roleError || roleData?.role !== 'super_admin') return 403
  ```

This will hard-fail (non-2xx) not only when the role is not super_admin, but also when `.single()` errors.

### The critical edge case: `.single()` errors if there are 0 rows OR multiple rows
In Supabase/PostgREST, `.single()` throws an error if:
- there’s **no** matching row (0 rows), OR
- there are **multiple** matching rows (duplicates)

So if your `user_roles` accidentally has:
- **no** row for the logged-in super admin, OR
- **more than one** row for the super admin (duplicate rows),
then both functions return a non-2xx (commonly 403) and the frontend only shows the generic message.

Given your project history (multiple setup iterations), **duplicates in `user_roles` for the super admin is a very plausible cause** and would explain why both actions fail consistently.

---

## Phase 1 — Confirm with 100% certainty (fast checks)
### A) Check the `update-user-status` function logs in the external backend
1. Open external backend → Functions → `update-user-status` → Logs
2. Trigger one deactivate toggle from User Management
3. Copy/paste the log lines here (at least the lines around):
   - `User authenticated: ...`
   - any `roleError` / `Only super admin...` response

This tells us if the failure is:
- 401 (JWT validation failed)
- 403 (role check failed)
- 500 (DB update failed)

### B) Check if `user_roles` has duplicates or missing row (external backend SQL)
Run this in your external backend SQL runner (or equivalent):

```sql
-- 1) What roles exist for the currently logged-in super admin?
-- Replace with the authenticated user's UUID if needed (from logs)
select user_id, role, count(*)
from public.user_roles
group by user_id, role
having count(*) > 1;

-- 2) Show all roles for super admin user id (replace UUID)
select *
from public.user_roles
where user_id = 'YOUR_SUPER_ADMIN_UUID';
```

Expected:
- exactly 1 row: role = `super_admin`

If you see duplicates, that is the root cause.

---

## Phase 2 — Make the backend functions robust (so duplicates can’t break admin actions)
### Change 1: Replace `.single()` with a safe role check
In **both** functions (`delete-user` and `update-user-status`), change role check from:

- `.single()` + `roleData?.role !== 'super_admin'`

to a safer pattern:

Option A (best): use the existing DB function `public.has_role(requestingUser.id, 'super_admin')` via RPC
- This avoids `.single()` errors entirely.
- Even if duplicates exist, the check still returns true.

Option B: query `user_roles` but avoid `.single()`:
- use `.select('role').eq(...).limit(1).maybeSingle()`
- and treat “no row found” as not authorized

### Change 2: Return better error details (debug-friendly)
Right now the frontend shows generic error text.
Backend should return structured JSON like:
```json
{ "error": "Only super admin can update user status", "debug": { "roleError": "..."} }
```
(Only in test/dev; can be removed later.)

---

## Phase 3 — Fix the data problem (recommended)
Even if we harden the function, duplicates are a data integrity bug that will cause other issues.

### Add / enforce uniqueness in `user_roles`
Ensure the table enforces:
- exactly 1 role per user, OR
- if multi-role system: unique(user_id, role)

Then delete duplicates with a one-time cleanup SQL:
- Keep one row per (user_id, role)
- Remove extras

---

## Phase 4 — Frontend: stop hiding the real error
In `UserManagement.tsx`, improve error handling so it shows:
- HTTP status code
- returned JSON `error` message
- any returned `debug` fields

This prevents “blind debugging” in the future.

---

## Deliverables I will implement once you approve (code changes)
1. Update `supabase/functions/update-user-status/index.ts`
   - robust super_admin check (no `.single()` failure)
   - improved error responses
2. Update `supabase/functions/delete-user/index.ts`
   - keep hybrid deletion
   - robust super_admin check (no `.single()` failure)
   - improved error responses
3. Update `src/pages/UserManagement.tsx`
   - display full backend error details (not just generic)
4. Provide you a **copy/paste checklist** for updating the external backend function editors (since your app calls external backend functions)

---

## What I still need from you (1 item)
Please paste the **latest logs for `update-user-status`** right after you try to deactivate a user once. That single log output will tell us whether this is:
- role check failing due to `.single()` (most likely)
- token invalid
- DB update error
- CORS / preflight issue

(Once we confirm, we’ll apply the hardened role check and you’ll be able to delete/deactivate reliably.)
