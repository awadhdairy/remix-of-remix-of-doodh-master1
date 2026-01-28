
## External Supabase Backend Setup Plan

### Overview
This plan will set up your external Supabase project with all required tables, database functions, RLS policies, views, and seed dummy data for testing. The setup ensures complete integration with the remixed project while keeping all data and secrets on your external Supabase instance.

---

### Current Architecture Understanding

**Database Schema Requirements:**
- **35+ Tables** including profiles, user_roles, cattle, milk_production, customers, deliveries, invoices, employees, etc.
- **7 Custom Enums**: user_role, cattle_status, lactation_status, delivery_status, payment_status, bottle_type, bottle_size
- **30+ Database Functions** for authentication, user management, customer portal, auto-delivery, etc.
- **5 Views**: profiles_safe, customer_accounts_safe, customers_delivery_view, employees_auditor_view, dairy_settings_public
- **RLS Policies** on all tables for security

**Edge Functions Required:**
- bootstrap-admin
- create-user
- delete-user
- reset-user-pin
- update-user-status
- customer-auth
- change-pin
- auto-deliver-daily
- health-check

---

### Implementation Plan

#### Phase 1: Create Database Schema

**1.1 Create Enums**
```sql
CREATE TYPE public.user_role AS ENUM ('super_admin', 'manager', 'accountant', 'delivery_staff', 'farm_worker', 'vet_staff', 'auditor');
CREATE TYPE public.cattle_status AS ENUM ('active', 'sold', 'deceased', 'dry');
CREATE TYPE public.lactation_status AS ENUM ('lactating', 'dry', 'pregnant', 'calving');
CREATE TYPE public.delivery_status AS ENUM ('pending', 'delivered', 'missed', 'partial');
CREATE TYPE public.payment_status AS ENUM ('paid', 'partial', 'pending', 'overdue');
CREATE TYPE public.bottle_type AS ENUM ('glass', 'plastic');
CREATE TYPE public.bottle_size AS ENUM ('500ml', '1L', '2L');
```

**1.2 Create Core Tables (in dependency order)**

| Table | Purpose |
|-------|---------|
| `profiles` | Staff user profiles with PIN authentication |
| `user_roles` | Role-based access control |
| `auth_attempts` | Rate limiting for login |
| `auth_sessions` | Session management |
| `cattle` | Animal records |
| `milk_production` | Daily milk yield records |
| `products` | Dairy products catalog |
| `customers` | Customer master data |
| `customer_products` | Subscription preferences |
| `customer_accounts` | Customer portal login |
| `customer_auth_attempts` | Customer login rate limiting |
| `customer_vacations` | Delivery pause periods |
| `customer_ledger` | Transaction history |
| `customer_bottles` | Bottle deposits |
| `routes` | Delivery routes |
| `route_stops` | Route planning |
| `deliveries` | Daily deliveries |
| `delivery_items` | Delivery line items |
| `invoices` | Billing records |
| `payments` | Payment transactions |
| `bottles` | Bottle inventory |
| `bottle_transactions` | Bottle issue/return |
| `cattle_health` | Health records |
| `breeding_records` | Breeding tracking |
| `feed_inventory` | Feed stock |
| `feed_consumption` | Feed usage |
| `expenses` | Expense tracking |
| `employees` | Employee master |
| `attendance` | Daily attendance |
| `employee_shifts` | Shift assignments |
| `shifts` | Shift definitions |
| `payroll_records` | Salary processing |
| `equipment` | Farm equipment |
| `maintenance_records` | Equipment maintenance |
| `milk_vendors` | External suppliers |
| `milk_procurement` | Purchased milk |
| `vendor_payments` | Supplier payments |
| `price_rules` | Dynamic pricing |
| `notification_templates` | Message templates |
| `notification_logs` | Sent notifications |
| `dairy_settings` | System configuration |
| `activity_logs` | Audit trail |

---

#### Phase 2: Create Database Functions

**Authentication Functions:**
- `verify_pin(_phone, _pin)` - Staff PIN verification
- `verify_staff_pin(_phone, _pin)` - Staff login
- `verify_customer_pin(_phone, _pin)` - Customer login
- `staff_login(_phone, _pin)` - Create staff session
- `staff_logout(_session_token)` - End session
- `customer_login(_phone, _pin)` - Customer session
- `customer_logout(_session_token)` - End customer session
- `validate_session(_session_token)` - Check session validity
- `validate_customer_session(_session_token)` - Customer session check

**User Management Functions:**
- `bootstrap_super_admin(_phone, _pin)` - Initial admin setup
- `admin_create_staff_user(...)` - Create staff
- `admin_delete_user(_target_user_id)` - Remove user
- `admin_reset_user_pin(...)` - Reset PIN
- `admin_update_user_status(...)` - Activate/deactivate
- `change_own_pin(_current, _new)` - Self-service PIN change
- `update_pin_only(_user_id, _pin)` - Direct PIN update

**Customer Portal Functions:**
- `customer_register(_phone, _pin)` - New customer signup
- `register_customer_account(_phone, _pin)` - Account creation
- `update_customer_pin(...)` - Customer PIN change
- `is_customer_on_vacation(_customer_id, _date)` - Vacation check

**Automation Functions:**
- `run_auto_delivery()` - Daily delivery automation
- `auto_create_daily_attendance()` - Attendance auto-mark
- `recalculate_vendor_balance(vendor_id)` - Balance sync

**Utility Functions:**
- `has_role(_user_id, _role)` - Role check
- `has_any_role(_user_id, _roles[])` - Multi-role check
- `is_authenticated()` - Auth check
- `is_manager_or_admin(_user_id)` - Admin check
- `update_updated_at_column()` - Timestamp trigger

---

#### Phase 3: Create Views

| View | Purpose |
|------|---------|
| `profiles_safe` | Profiles without pin_hash |
| `customer_accounts_safe` | Accounts without pin_hash |
| `customers_delivery_view` | Minimal customer data for delivery staff |
| `employees_auditor_view` | Employee data without salary |
| `dairy_settings_public` | Non-sensitive settings |

---

#### Phase 4: Enable RLS & Create Policies

**Enable RLS on all tables** and create policies:
- Authenticated users can access operational data
- Super admin can manage users and roles
- Delivery staff limited to delivery-related views
- Customers can only access their own data

---

#### Phase 5: Create Triggers

| Trigger | Table | Function |
|---------|-------|----------|
| `on_auth_user_created` | `auth.users` | `handle_new_user()` |
| `update_profiles_updated_at` | `profiles` | `update_updated_at_column()` |
| `update_cattle_updated_at` | `cattle` | `update_updated_at_column()` |
| `update_vendor_balance_on_payment` | `vendor_payments` | `update_vendor_balance_on_payment()` |
| `update_vendor_balance_on_procurement` | `milk_procurement` | `update_vendor_balance_on_procurement()` |

---

#### Phase 6: Seed Dummy Data

**6.1 Dairy Settings**
```text
- Dairy Name: "Awadh Dairy Farm"
- Address: "123 Farm Road, Lucknow, UP"
- Phone: "9876543210"
- Email: "contact@awadhdairy.com"
- Currency: "INR"
- Invoice Prefix: "AWD"
```

**6.2 Products (5 items)**
| Name | Category | Unit | Price |
|------|----------|------|-------|
| Full Cream Milk | milk | liter | 70 |
| Toned Milk | milk | liter | 55 |
| Curd | curd | kg | 80 |
| Paneer | paneer | kg | 350 |
| Ghee | ghee | kg | 600 |

**6.3 Cattle (5 animals)**
| Tag | Name | Breed | Type | Status |
|-----|------|-------|------|--------|
| C001 | Lakshmi | Gir | cow | active |
| C002 | Gauri | Sahiwal | cow | active |
| C003 | Nandi | Murrah | buffalo | active |
| C004 | Kamdhenu | HF Cross | cow | active |
| C005 | Sundari | Gir | cow | dry |

**6.4 Customers (5 customers)**
| Name | Phone | Area | Subscription |
|------|-------|------|-------------|
| Ramesh Kumar | 9876543001 | Gomti Nagar | daily |
| Priya Sharma | 9876543002 | Aliganj | daily |
| Amit Verma | 9876543003 | Hazratganj | alternate |
| Sunita Devi | 9876543004 | Indira Nagar | weekly |
| Rajesh Gupta | 9876543005 | Mahanagar | daily |

**6.5 Employees (3 employees)**
| Name | Phone | Role | Salary |
|------|-------|------|--------|
| Vijay Singh | 9876543101 | delivery_staff | 15000 |
| Meera Yadav | 9876543102 | farm_worker | 12000 |
| Dr. Arun Patel | 9876543103 | vet_staff | 25000 |

**6.6 Routes (2 routes)**
| Name | Area |
|------|------|
| Route A - Morning | Gomti Nagar, Aliganj |
| Route B - Evening | Hazratganj, Indira Nagar |

**6.7 Bottles**
| Type | Size | Total Qty | Available |
|------|------|-----------|-----------|
| glass | 500ml | 200 | 180 |
| glass | 1L | 300 | 270 |
| plastic | 1L | 150 | 140 |

**6.8 Feed Inventory (3 items)**
| Name | Category | Stock | Unit |
|------|----------|-------|------|
| Green Fodder | green_fodder | 500 | kg |
| Cattle Feed | concentrate | 200 | kg |
| Mineral Mix | supplement | 50 | kg |

**6.9 Shifts (2 shifts)**
| Name | Start | End |
|------|-------|-----|
| Morning Shift | 05:00 | 13:00 |
| Evening Shift | 13:00 | 21:00 |

**6.10 Sample Milk Production (last 7 days)**
- Daily records for all active cattle
- Morning and evening sessions
- Realistic quantities (8-15 liters/day)
- Fat: 3.5-6.5%, SNF: 8.0-9.5%

**6.11 Sample Deliveries (last 7 days)**
- Daily deliveries for subscribed customers
- Mix of delivered/pending statuses
- Corresponding delivery items

---

#### Phase 7: Configure Edge Function Secrets

The following secrets must be set in your external Supabase project:

| Secret | Purpose |
|--------|---------|
| `SUPABASE_URL` | Your external Supabase URL |
| `SUPABASE_ANON_KEY` | Public anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key for admin operations |
| `BOOTSTRAP_ADMIN_PHONE` | Phone for initial admin (already configured) |
| `BOOTSTRAP_ADMIN_PIN` | PIN for initial admin (already configured) |

---

#### Phase 8: Verify Integration

**Test Checklist:**
1. Bootstrap admin account via `/auth` page
2. Login with admin credentials
3. Verify dashboard loads with dummy data
4. Test CRUD operations on cattle, customers, products
5. Verify delivery scheduling works
6. Test customer portal authentication
7. Confirm RLS policies restrict data appropriately

---

### Database Migration Script

I will create a single comprehensive SQL migration that:
1. Creates all enums and tables
2. Sets up all functions and triggers
3. Creates all views
4. Enables RLS and creates policies
5. Seeds all dummy data

This will be executed via the database migration tool.

---

### Files to Create/Modify

| Action | File/Resource | Purpose |
|--------|---------------|---------|
| Create | Database migration | Complete schema + seed data |
| Deploy | Edge functions | All 9 edge functions auto-deploy |
| Verify | Integration test | Confirm external Supabase works |

---

### Expected Results

After implementation:
- Complete database schema matching current types.ts
- All 35+ tables with proper relationships
- All database functions for authentication and automation
- RLS policies protecting all data
- Realistic dummy data for testing
- Working admin bootstrap flow
- Customer portal ready for testing
- All edge functions connected to external Supabase

---

### Security Notes

- All secrets stored in external Supabase, not Lovable Cloud
- PIN hashes use bcrypt via pgcrypto extension
- RLS enforced on all tables
- Rate limiting on authentication attempts
- Session expiration configured (7 days staff, 30 days customers)
