

# Implementation Plan: Contact Information Updates & Consistency Fixes

## Analysis Summary

### Screenshots Verification
The screenshots confirm that your external Supabase project (`ohrytohcbbkorivsuukm`) has:
- All 9 edge functions deployed and functioning
- All required database functions present (customer_login, customer_register, staff_login, bootstrap_super_admin, etc.)
- Proper infrastructure for authentication and PIN management

### Issues Identified

| File | Line | Current Value | Required Value |
|------|------|---------------|----------------|
| `CustomerAuth.tsx` | 306 | `support@doodhwallah.app` | `contact@awadhdairy.com` |
| `CustomerProfile.tsx` | 118 | `support@awadhdairy.com` | `contact@awadhdairy.com` |
| `CustomerProfile.tsx` | 119 | `+91 XXXXXXXXXX` | `+91 78977 16792` |
| `AWADH_DAIRY_COMPLETE_BLUEPRINT.md` | Multiple | `doodhwallah.app` references | `awadhdairy.com` |

---

## Technical Approach

### Philosophy: Minimal Changes, Maximum Safety
- Only modify the exact strings that need updating
- No logic changes, no structural changes
- All integrations remain untouched
- Edge function calls continue to work exactly as before

---

## Phase 1: Customer Authentication Page

**File:** `src/pages/customer/CustomerAuth.tsx`

**Change (Line 306):**
```tsx
// FROM:
<p>Need help? Contact us at support@doodhwallah.app</p>

// TO:
<p>Need help? Contact us at contact@awadhdairy.com</p>
```

**Impact Assessment:**
- Pure text change in footer
- No logic affected
- No Supabase integration affected
- Customer login/register functions unchanged

---

## Phase 2: Customer Profile Page

**File:** `src/pages/customer/CustomerProfile.tsx`

**Change 1 (Line 118):**
```tsx
// FROM:
<span>Contact: support@awadhdairy.com</span>

// TO:
<span>Contact: contact@awadhdairy.com</span>
```

**Change 2 (Line 119):**
```tsx
// FROM:
<span>Call: +91 XXXXXXXXXX</span>

// TO:
<span>Call: +91 78977 16792</span>
```

**Impact Assessment:**
- Pure text changes in support section
- Profile editing functionality unchanged
- PIN change functionality unchanged
- Logout functionality unchanged
- All Supabase integrations intact

---

## Phase 3: Documentation Update

**File:** `AWADH_DAIRY_COMPLETE_BLUEPRINT.md`

Update all `doodhwallah.app` references to `awadhdairy.com`:
- Line ~973: `{phone}@doodhwallah.app` → `{phone}@awadhdairy.com`
- Line ~985: `customer_{phone}@doodhwallah.app` → `customer_{phone}@awadhdairy.com`
- Line ~995: `{phone}@doodhwallah.app` → `{phone}@awadhdairy.com`
- Line ~1040: `{phone}@doodhwallah.app` → `{phone}@awadhdairy.com`
- Lines ~1862-1863: Email pattern documentation

**Note:** This is documentation only - the actual code in edge functions already uses `@awadhdairy.com` (verified in customer-auth/index.ts and create-user/index.ts)

---

## Integration Verification Checklist

### What Remains Unchanged (Verified):

| Component | Status |
|-----------|--------|
| Customer login via edge function | Unchanged - uses `customer-auth` function |
| Customer registration | Unchanged - calls `customer-auth` with action='register' |
| PIN verification via `verify_customer_pin` RPC | Unchanged |
| Session management | Unchanged - `supabase.auth.setSession()` works as before |
| Profile editing via `customers` table | Unchanged |
| PIN change via `useCustomerAuth.changePin()` | Unchanged |
| Logout functionality | Unchanged |

### Code Flow Verification:

```
CustomerAuth.tsx Flow:
┌─────────────────────────────────────────────────────────────┐
│  User enters phone + PIN                                     │
│       ↓                                                      │
│  supabase.functions.invoke('customer-auth', {body})         │
│       ↓                                                      │
│  Edge function calls verify_customer_pin RPC                 │
│       ↓                                                      │
│  Returns session tokens                                      │
│       ↓                                                      │
│  supabase.auth.setSession() - stores in localStorage         │
│       ↓                                                      │
│  Navigate to /customer/dashboard                             │
└─────────────────────────────────────────────────────────────┘
```

This flow is completely untouched by our changes.

---

## Files Modified

| File | Type of Change | Risk Level |
|------|---------------|------------|
| `src/pages/customer/CustomerAuth.tsx` | Text only | None |
| `src/pages/customer/CustomerProfile.tsx` | Text only | None |
| `AWADH_DAIRY_COMPLETE_BLUEPRINT.md` | Documentation | None |

---

## What We Are NOT Changing

To ensure no functionality is lost:

1. **Edge Functions** - All 9 functions remain exactly as deployed
2. **Database Functions** - All RPCs remain unchanged
3. **Authentication Logic** - No changes to login/register handlers
4. **Supabase Client** - `external-supabase.ts` unchanged
5. **useCustomerAuth Hook** - All methods remain identical
6. **Invoice PDF Generator** - Already uses `contact@awadhdairy.com`
7. **Form Validation** - Zod schemas unchanged
8. **Error Handling** - Toast notifications unchanged

---

## Post-Implementation Verification

After changes are applied, verify:

1. Customer Auth page loads correctly
2. Login/Register tabs function
3. Form submission works
4. Error messages display properly
5. Customer Profile page loads
6. Edit profile works
7. PIN change dialog functions
8. Logout works
9. Support contact shows correct email and phone

