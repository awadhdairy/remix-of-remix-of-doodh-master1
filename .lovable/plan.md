

# Complete External Supabase Migration Plan

## Overview
This plan migrates the entire project to use ONLY the external Supabase backend, with zero dependency on Lovable Cloud. All edge functions, the frontend client, and dummy data will be configured for your external Supabase at `htsfxnuttobkdquxwvjj.supabase.co`.

---

## Current State Analysis

### What Needs to Change

| Component | Current State | Target State |
|-----------|---------------|--------------|
| Frontend Client | Uses Lovable Cloud variables | Uses external Supabase variables |
| Edge Functions (9) | Use `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | Use `EXTERNAL_SUPABASE_*` |
| Admin Account | Created via bootstrap button | Pre-created permanent account |
| Auth.tsx | Has bootstrap button | Login only |
| Data | Empty tables | Populated with dummy data |

### Edge Functions to Update
1. `auto-deliver-daily`
2. `bootstrap-admin` → **DELETE** (replace with setup function)
3. `change-pin`
4. `create-user`
5. `customer-auth`
6. `delete-user`
7. `health-check`
8. `reset-user-pin`
9. `update-user-status`

---

## Implementation Steps

### Phase 1: Add External Anon Key Secret

First, store the anon key you provided:

**Secret to Add:**
- Name: `EXTERNAL_SUPABASE_ANON_KEY`
- Value: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh0c2Z4bnV0dG9ia2RxdXh3dmpqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk1ODQ1ODgsImV4cCI6MjA4NTE2MDU4OH0.kM-uVIvO_bGqBeBQgoXBLlzTbTyQGVRgL6aVYMG2OcM`

---

### Phase 2: Create External Supabase Client

Create a new Supabase client file that uses the external backend exclusively.

**New File:** `src/lib/external-supabase.ts`

```typescript
import { createClient } from '@supabase/supabase-js';

// External Supabase credentials - completely separate from Lovable Cloud
const EXTERNAL_URL = 'https://htsfxnuttobkdquxwvjj.supabase.co';
const EXTERNAL_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh0c2Z4bnV0dG9ia2RxdXh3dmpqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk1ODQ1ODgsImV4cCI6MjA4NTE2MDU4OH0.kM-uVIvO_bGqBeBQgoXBLlzTbTyQGVRgL6aVYMG2OcM';

export const externalSupabase = createClient(EXTERNAL_URL, EXTERNAL_ANON_KEY, {
  auth: {
    storage: localStorage,
    persistSession: true,
    autoRefreshToken: true,
  }
});

// Edge function base URL for external Supabase
export const EXTERNAL_FUNCTIONS_URL = `${EXTERNAL_URL}/functions/v1`;
```

---

### Phase 3: Update All Frontend Imports

Replace all imports of the Lovable Cloud client with the external client.

**Files to Update:**
- `src/pages/Auth.tsx`
- `src/pages/Dashboard.tsx`
- `src/pages/Cattle.tsx`
- `src/pages/Customers.tsx`
- `src/pages/Deliveries.tsx`
- `src/pages/Production.tsx`
- `src/pages/Employees.tsx`
- And all other pages/components using supabase

**Change:**
```typescript
// FROM:
import { supabase } from "@/integrations/supabase/client";

// TO:
import { externalSupabase as supabase } from "@/lib/external-supabase";
```

---

### Phase 4: Create Setup Edge Function (Replaces Bootstrap)

Create a one-time setup function that:
1. Creates permanent super admin
2. Seeds all dummy data
3. Can only run once

**New File:** `supabase/functions/setup-external-db/index.ts`

This function will:

```text
1. Read BOOTSTRAP_ADMIN_PHONE and BOOTSTRAP_ADMIN_PIN from env
2. Connect to EXTERNAL Supabase using EXTERNAL_SUPABASE_* secrets
3. Check if setup already completed (admin exists)
4. If not completed:
   a. Create auth user: {phone}@awadhdairy.com with PIN as password
   b. Create profile with super_admin role
   c. Create user_roles entry
   d. Insert all dummy data:
      - dairy_settings (1)
      - products (5)
      - routes (2)
      - cattle (5)
      - customers (5)
      - customer_products (5)
      - employees (3)
      - bottles (3)
      - feed_inventory (3)
      - shifts (2)
      - milk_vendors (2)
      - equipment (3)
      - milk_production (70+ records - 7 days)
      - deliveries (35+ records - 7 days)
      - delivery_items (35+ records)
      - attendance (21+ records - 7 days)
5. Return success status
```

---

### Phase 5: Update All Edge Functions

Every edge function must use external Supabase variables:

**Pattern Change in ALL Functions:**

```typescript
// FROM:
const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

// TO:
const supabaseUrl = Deno.env.get('EXTERNAL_SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('EXTERNAL_SUPABASE_SERVICE_ROLE_KEY')!;
const supabaseAnonKey = Deno.env.get('EXTERNAL_SUPABASE_ANON_KEY')!;
```

**Functions to Update:**
| Function | Changes |
|----------|---------|
| `auto-deliver-daily` | Use EXTERNAL_* variables |
| `change-pin` | Use EXTERNAL_* variables |
| `create-user` | Use EXTERNAL_* variables |
| `customer-auth` | Use EXTERNAL_* variables, update ALLOWED_ORIGINS |
| `delete-user` | Use EXTERNAL_* variables |
| `health-check` | Use EXTERNAL_* variables |
| `reset-user-pin` | Use EXTERNAL_* variables |
| `update-user-status` | Use EXTERNAL_* variables |

---

### Phase 6: Remove Bootstrap Admin Flow

**Delete:** `supabase/functions/bootstrap-admin/` directory

**Update:** `src/pages/Auth.tsx`

Remove:
- `handleBootstrap` function (lines 54-101)
- `bootstrapping` state variable (line 27)
- "Setup Admin Account" button (lines 257-274)
- `showBootstrapOption` variable (line 153)

Keep:
- Standard login form
- Phone + PIN authentication
- Navigation to dashboard on success

---

### Phase 7: Update Customer Auth Allowed Origins

Update `customer-auth` function to include new project preview URL:

```typescript
const ALLOWED_ORIGINS = [
  'https://awadhd.lovable.app',
  'https://id-preview--0e2105bf-7600-40c7-b696-88cb152c3e30.lovable.app',
  'http://localhost:5173',
  'http://localhost:3000',
];
```

---

## Dummy Data Summary

### Dairy Settings
| Field | Value |
|-------|-------|
| dairy_name | Awadh Dairy Farm |
| address | 123 Farm Road, Lucknow, UP 226001 |
| phone | 9876543210 |
| email | info@awadhdairy.com |
| currency | INR |
| invoice_prefix | AWD |

### Products (5 items)
| Name | Category | Base Price | Unit |
|------|----------|------------|------|
| Full Cream Milk | milk | 70 | liter |
| Toned Milk | milk | 55 | liter |
| Fresh Curd | curd | 80 | kg |
| Paneer | paneer | 350 | kg |
| Desi Ghee | ghee | 600 | kg |

### Cattle (5 animals)
| Tag | Name | Breed | Type | Status |
|-----|------|-------|------|--------|
| C001 | Lakshmi | Gir | cow | active, lactating |
| C002 | Gauri | Sahiwal | cow | active, lactating |
| C003 | Nandi | Murrah | buffalo | active, lactating |
| C004 | Kamdhenu | HF Cross | cow | active, lactating |
| C005 | Sundari | Gir | cow | active, dry |

### Customers (5)
| Name | Phone | Area | Subscription |
|------|-------|------|--------------|
| Sharma Family | 9999000001 | Gomti Nagar | daily |
| Gupta Residence | 9999000002 | Aliganj | daily |
| Verma House | 9999000003 | Hazratganj | weekly |
| Pandey Home | 9999000004 | Indira Nagar | alternate |
| Singh Bungalow | 9999000005 | Gomti Nagar | daily |

### Employees (3)
| Name | Role | Salary |
|------|------|--------|
| Vijay Singh | delivery_staff | 15,000 |
| Meera Yadav | farm_worker | 12,000 |
| Dr. Arun Patel | vet_staff | 25,000 |

### Routes (2)
| Name | Areas |
|------|-------|
| Route A - Morning | Gomti Nagar, Aliganj |
| Route B - Evening | Hazratganj, Indira Nagar |

### Additional Data
- **Bottles:** 3 types (Glass 500ml, Glass 1L, Plastic 1L)
- **Feed Inventory:** 3 items (Green Fodder, Cattle Feed, Mineral Mix)
- **Shifts:** 2 (Morning 6AM-2PM, Evening 2PM-10PM)
- **Milk Vendors:** 2 external suppliers
- **Equipment:** 3 items (Bulk Milk Chiller, Milking Machine, Cream Separator)
- **Milk Production:** 7 days × 5 cattle × 2 sessions = 70 records
- **Deliveries:** 7 days × 5 customers = 35 records with items
- **Attendance:** 7 days × 3 employees = 21 records

---

## File Changes Summary

| Action | File | Description |
|--------|------|-------------|
| Create | `src/lib/external-supabase.ts` | External Supabase client |
| Create | `supabase/functions/setup-external-db/index.ts` | Setup + seed function |
| Delete | `supabase/functions/bootstrap-admin/` | Remove bootstrap function |
| Modify | `src/pages/Auth.tsx` | Remove bootstrap, login only |
| Modify | `supabase/functions/create-user/index.ts` | Use EXTERNAL_* vars |
| Modify | `supabase/functions/delete-user/index.ts` | Use EXTERNAL_* vars |
| Modify | `supabase/functions/customer-auth/index.ts` | Use EXTERNAL_* vars + origins |
| Modify | `supabase/functions/health-check/index.ts` | Use EXTERNAL_* vars |
| Modify | `supabase/functions/change-pin/index.ts` | Use EXTERNAL_* vars |
| Modify | `supabase/functions/reset-user-pin/index.ts` | Use EXTERNAL_* vars |
| Modify | `supabase/functions/update-user-status/index.ts` | Use EXTERNAL_* vars |
| Modify | `supabase/functions/auto-deliver-daily/index.ts` | Use EXTERNAL_* vars |
| Modify | All pages/components | Import external-supabase |

---

## Post-Implementation Steps

1. **Deploy Edge Functions** - Automatic on save
2. **Call Setup Function Once**
   - Run `setup-external-db` to create admin + seed data
   - This populates all tables with dummy data
3. **Verify Login**
   - Use phone from `BOOTSTRAP_ADMIN_PHONE`
   - Use PIN from `BOOTSTRAP_ADMIN_PIN`
4. **Test All Features**
   - Dashboard loads with data
   - Cattle, Customers, Deliveries pages work
   - CRUD operations function

---

## Security Notes

- All credentials stored only in external Supabase secrets
- No sensitive data in Lovable Cloud
- PIN hashes use bcrypt via pgcrypto
- RLS policies enforced on all tables
- Bootstrap removed to prevent unauthorized account creation
- Setup function is idempotent (runs once safely)

