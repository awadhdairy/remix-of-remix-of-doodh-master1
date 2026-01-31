

# Fix Plan: External Supabase Schema Missing - Root Cause Analysis & Solution

## Problem Summary

The website is non-functional because **all database tables return 404 errors**. Login works (authentication succeeded), but every query to tables like `user_roles`, `cattle`, `customers`, `milk_production`, etc. fails.

---

## Root Cause Analysis

### Evidence from Network Requests

| Request Type | Status | Meaning |
|--------------|--------|---------|
| `/auth/v1/token` | 200 OK | Authentication works |
| `/auth/v1/user` | 200 OK | User session valid |
| `/rest/v1/user_roles` | 404 Not Found | Table doesn't exist |
| `/rest/v1/cattle` | 404 Not Found | Table doesn't exist |
| `/rest/v1/customers` | 404 Not Found | Table doesn't exist |
| `/rest/v1/milk_production` | 404 Not Found | Table doesn't exist |
| All other tables | 404 Not Found | Tables don't exist |

### The Core Issue

The external Supabase instance (`htsfxnuttobkdquxwvjj.supabase.co`) was created but **never had its database schema initialized**. 

The `setup-external-db` edge function:
1. Is deployed to **Lovable Cloud** (not external Supabase)
2. Only seeds DATA into existing tables - it doesn't CREATE tables
3. When it tries to insert into `profiles`, `user_roles`, etc., those tables don't exist

---

## Technical Architecture Gap

```text
What exists in External Supabase:
├── Auth (working - user can login)
└── Database
    └── EMPTY (no tables at all)

What the app expects:
├── Auth (working)
└── Database
    ├── profiles
    ├── user_roles  
    ├── cattle
    ├── customers
    ├── deliveries
    ├── milk_production
    └── ... 35+ more tables
```

---

## Why Sidebar & User Data Don't Load

### Sidebar Issue

```typescript
// In useUserRole.ts (line 31-35)
const { data: roleData } = await supabase
  .from("user_roles")  // ← Table doesn't exist → 404
  .select("role")
  .eq("user_id", user.id)
```

- Returns null due to 404 error
- `role` stays null
- Sidebar has no visible items (all filtered out)
- User name shows "Loading..."

### Dashboard Issue

```typescript
// In useDashboardData.ts 
const cattlePromise = supabase
  .from("cattle")  // ← Table doesn't exist → 404
  .select(...)

const customersPromise = supabase
  .from("customers")  // ← Table doesn't exist → 404
  .select(...)
```

- All queries return empty/error
- Stats show 0 for everything
- Charts have no data

---

## Solution: Create Database Schema in External Supabase

You need to run SQL migrations directly in the external Supabase dashboard to create all required tables. This is a **one-time setup** that must be done manually.

### Step 1: Access External Supabase Dashboard

Go to: `https://supabase.com/dashboard/project/htsfxnuttobkdquxwvjj`

Navigate to: **SQL Editor**

### Step 2: Execute Schema Creation

The schema includes 35+ tables with their relationships, RLS policies, functions, views, and triggers. The main tables are:

| Category | Tables |
|----------|--------|
| Auth & Roles | `profiles`, `user_roles`, `auth_sessions`, `auth_attempts` |
| Cattle & Farm | `cattle`, `breeding_records`, `cattle_health`, `milk_production` |
| Customers | `customers`, `customer_products`, `customer_ledger`, `customer_accounts`, `customer_vacations` |
| Deliveries | `deliveries`, `delivery_items`, `routes` |
| Billing | `invoices`, `products`, `price_rules` |
| Operations | `employees`, `attendance`, `expenses`, `bottles`, `bottle_transactions` |
| Inventory | `feed_inventory`, `feed_consumption`, `equipment`, `maintenance_records` |
| Procurement | `milk_procurement`, `milk_vendors` |
| Settings | `dairy_settings`, `shifts`, `activity_logs` |

### Step 3: Required Database Functions

Critical functions that must be created:
- `has_role(uuid, user_role)` - Check user role
- `has_any_role(uuid, user_role[])` - Check multiple roles
- `is_manager_or_admin(uuid)` - Permission check
- `is_authenticated()` - Auth check
- `update_pin_only(uuid, text)` - PIN hash update
- `verify_pin(uuid, text)` - PIN verification
- `staff_login(text, text)` - Staff authentication
- `customer_login(text, text)` - Customer authentication

### Step 4: Required Views

Secure views for sensitive data:
- `profiles_safe` - Excludes pin_hash column
- `customer_accounts_safe` - Excludes pin_hash column
- `employees_auditor_view` - Limited employee data
- `dairy_settings_public` - Public settings
- `customers_delivery_view` - Delivery-focused customer data

### Step 5: RLS Policies

Row Level Security policies must be enabled on all tables with role-based access control.

---

## What I Can Do Now

Since I cannot execute SQL directly on the external Supabase database, I can:

1. **Generate a Complete SQL Migration Script** - A single file containing all `CREATE TABLE`, `CREATE FUNCTION`, `CREATE VIEW`, and RLS policy statements

2. **Create a Setup Guide Document** - Step-by-step instructions for running the migration in the external Supabase SQL Editor

3. **Update the `setup-external-db` Function** - Modify it to work with the external Supabase edge functions host (requires deploying to external Supabase, not Lovable Cloud)

---

## Recommended Next Steps

### Option A: Manual Schema Setup (Fastest)

1. I generate the complete SQL migration script
2. You run it in the external Supabase SQL Editor
3. Then call `setup-external-db` to seed data
4. Website becomes functional

### Option B: Hybrid Approach

1. Keep using **Lovable Cloud's database** for actual data storage
2. Only use external Supabase for **edge function hosting** if needed
3. Revert the client import changes

### Option C: Export & Re-import

1. Export the complete schema from Lovable Cloud
2. Import into external Supabase
3. Update foreign key references

---

## Summary

| Issue | Cause | Fix |
|-------|-------|-----|
| Sidebar not loading | `user_roles` table doesn't exist | Create table in external Supabase |
| User name not loading | `profiles_safe` view doesn't exist | Create view in external Supabase |
| Dashboard shows 0s | All data tables missing | Create all tables in external Supabase |
| No cattle/customers | Tables don't exist | Create tables + seed data |

**The migration to external Supabase is incomplete - only the frontend client was updated, but the backend database schema was never created.**

