# Awadh Dairy - Complete Dairy Farm Management System

## Comprehensive Recreation Prompt

This document contains a complete specification to recreate the **Awadh Dairy** management system from scratch. It covers every feature, database schema, component, automation, and design detail.

---

## 1. PROJECT OVERVIEW

**Name:** Awadh Dairy
**Purpose:** Complete dairy farm management solution for independent dairy owners to manage daily operations, cattle, finance, customers, deliveries, and growth.
**Inspiration:** milkwala.store / meridairy.in

**Target Users:**
- Dairy farm owners/managers
- Farm workers
- Veterinary staff
- Delivery personnel
- Accountants
- Auditors
- End customers (mobile app)

---

## 2. TECHNOLOGY STACK

### Frontend
- **Framework:** React 18 with TypeScript
- **Routing:** React Router DOM v6
- **Styling:** Tailwind CSS with custom design tokens
- **UI Library:** shadcn/ui components (Radix primitives)
- **State Management:** TanStack React Query
- **Animations:** Custom CSS animations (float, shimmer, glow, bounce)
- **Charts:** Recharts
- **PDF Generation:** jsPDF + jspdf-autotable
- **Excel Export:** xlsx
- **Date Handling:** date-fns
- **Font:** Outfit (Google Fonts)

### Backend (Supabase/Lovable Cloud)
- **Database:** PostgreSQL with Row Level Security (RLS)
- **Authentication:** Supabase Auth with PIN-based login
- **Edge Functions:** Deno-based serverless functions
- **Storage:** Supabase Storage (for future file uploads)

---

## 3. DATABASE SCHEMA (Complete)

### Enums
```sql
-- User Roles
CREATE TYPE user_role AS ENUM ('super_admin', 'manager', 'accountant', 'delivery_staff', 'farm_worker', 'vet_staff', 'auditor');

-- Cattle Status
CREATE TYPE cattle_status AS ENUM ('active', 'sold', 'deceased', 'dry');

-- Lactation Status
CREATE TYPE lactation_status AS ENUM ('lactating', 'dry', 'pregnant', 'calving');

-- Delivery Status
CREATE TYPE delivery_status AS ENUM ('pending', 'delivered', 'missed', 'partial');

-- Payment Status
CREATE TYPE payment_status AS ENUM ('paid', 'partial', 'pending', 'overdue');

-- Bottle Types
CREATE TYPE bottle_type AS ENUM ('glass', 'plastic');
CREATE TYPE bottle_size AS ENUM ('500ml', '1L', '2L');
```

### Core Tables

#### 1. profiles
User profiles linked to auth.users
```sql
- id: UUID (references auth.users)
- full_name: TEXT
- phone: TEXT (unique for PIN login)
- role: user_role
- pin_hash: TEXT (bcrypt hashed 6-digit PIN)
- avatar_url: TEXT
- is_active: BOOLEAN
- created_at, updated_at: TIMESTAMPTZ
```

#### 2. user_roles
Separate table for RBAC (prevents privilege escalation)
```sql
- id: UUID
- user_id: UUID (references auth.users)
- role: user_role
- created_at: TIMESTAMPTZ
```

#### 3. cattle
Individual animal records
```sql
- id: UUID
- tag_number: TEXT (unique identifier like "C001")
- name: TEXT (optional friendly name)
- breed: TEXT (Holstein, Jersey, Sahiwal, etc.)
- cattle_type: TEXT ('cow' or 'buffalo')
- date_of_birth: DATE
- status: cattle_status
- lactation_status: lactation_status
- lactation_number: INTEGER
- weight: NUMERIC
- last_calving_date: DATE
- expected_calving_date: DATE
- purchase_date: DATE
- purchase_cost: NUMERIC
- image_url: TEXT
- notes: TEXT
- created_by: UUID
- created_at, updated_at: TIMESTAMPTZ
```

#### 4. milk_production
Daily milk collection records
```sql
- id: UUID
- cattle_id: UUID (FK to cattle)
- production_date: DATE
- session: TEXT ('morning' or 'evening')
- quantity_liters: NUMERIC
- fat_percentage: NUMERIC
- snf_percentage: NUMERIC (Solids-Not-Fat)
- quality_notes: TEXT
- recorded_by: UUID
- created_at: TIMESTAMPTZ
- UNIQUE(cattle_id, production_date, session)
```

#### 5. products
Dairy product catalog
```sql
- id: UUID
- name: TEXT
- description: TEXT
- category: TEXT ('milk', 'curd', 'ghee', 'paneer', etc.)
- base_price: NUMERIC
- unit: TEXT ('liter', 'kg', 'piece')
- tax_percentage: NUMERIC
- image_url: TEXT
- is_active: BOOLEAN
- created_at, updated_at: TIMESTAMPTZ
```

#### 6. customers
Customer master data
```sql
- id: UUID
- name: TEXT
- phone: TEXT
- email: TEXT
- address: TEXT
- area: TEXT (locality/zone)
- route_id: UUID (FK to routes)
- subscription_type: TEXT ('daily', 'alternate', 'weekly')
- billing_cycle: TEXT ('weekly', 'monthly', 'fortnightly')
- credit_balance: NUMERIC (amount owed by customer)
- advance_balance: NUMERIC (prepaid amount)
- is_active: BOOLEAN
- notes: TEXT
- created_at, updated_at: TIMESTAMPTZ
```

#### 7. customer_products
Customer subscription items
```sql
- id: UUID
- customer_id: UUID (FK to customers)
- product_id: UUID (FK to products)
- quantity: INTEGER (daily quantity)
- custom_price: NUMERIC (if different from base price)
- is_active: BOOLEAN (can pause individual items)
- created_at: TIMESTAMPTZ
```

#### 8. customer_vacations
Delivery pause periods
```sql
- id: UUID
- customer_id: UUID (FK to customers)
- start_date: DATE
- end_date: DATE
- reason: TEXT
- is_active: BOOLEAN
- created_by: UUID
- created_at: TIMESTAMPTZ
```

#### 9. customer_accounts
Customer app login credentials
```sql
- id: UUID
- customer_id: UUID (FK to customers, UNIQUE)
- phone: TEXT
- pin_hash: TEXT
- is_approved: BOOLEAN
- approval_status: TEXT ('pending', 'approved', 'rejected')
- approved_by: UUID
- approved_at: TIMESTAMPTZ
- last_login: TIMESTAMPTZ
- user_id: UUID
- created_at, updated_at: TIMESTAMPTZ
```

#### 10. deliveries
Daily delivery records
```sql
- id: UUID
- customer_id: UUID (FK to customers)
- delivery_date: DATE
- status: delivery_status
- delivery_time: TIMESTAMPTZ
- delivered_by: UUID
- notes: TEXT
- created_at: TIMESTAMPTZ
- UNIQUE(customer_id, delivery_date)
```

#### 11. delivery_items
Individual items in a delivery
```sql
- id: UUID
- delivery_id: UUID (FK to deliveries)
- product_id: UUID (FK to products)
- quantity: NUMERIC
- unit_price: NUMERIC
- total_amount: NUMERIC
- created_at: TIMESTAMPTZ
```

#### 12. routes
Delivery route definitions
```sql
- id: UUID
- name: TEXT
- area: TEXT
- assigned_staff: UUID (FK to employees)
- sequence_order: INTEGER
- is_active: BOOLEAN
- created_at: TIMESTAMPTZ
```

#### 13. route_stops
Customers on a route with order
```sql
- id: UUID
- route_id: UUID (FK to routes)
- customer_id: UUID (FK to customers)
- stop_order: INTEGER
- estimated_arrival_time: TIME
- notes: TEXT
- created_at: TIMESTAMPTZ
```

#### 14. invoices
Monthly/periodic billing
```sql
- id: UUID
- invoice_number: TEXT (e.g., "INV-202501-001")
- customer_id: UUID (FK to customers)
- billing_period_start: DATE
- billing_period_end: DATE
- total_amount: NUMERIC
- tax_amount: NUMERIC
- discount_amount: NUMERIC
- final_amount: NUMERIC
- paid_amount: NUMERIC
- payment_status: payment_status
- due_date: DATE
- payment_date: DATE
- notes: TEXT
- created_at, updated_at: TIMESTAMPTZ
```

#### 15. payments
Payment transactions
```sql
- id: UUID
- customer_id: UUID (FK to customers)
- invoice_id: UUID (FK to invoices, optional)
- amount: NUMERIC
- payment_date: DATE
- payment_mode: TEXT ('cash', 'upi', 'bank_transfer', 'cheque')
- reference_number: TEXT
- notes: TEXT
- recorded_by: UUID
- created_at: TIMESTAMPTZ
```

#### 16. customer_ledger
Double-entry ledger for customer accounts
```sql
- id: UUID
- customer_id: UUID (FK to customers)
- transaction_date: DATE
- transaction_type: TEXT ('delivery', 'payment', 'invoice', 'adjustment')
- description: TEXT
- debit_amount: NUMERIC
- credit_amount: NUMERIC
- running_balance: NUMERIC
- reference_id: UUID (FK to delivery/payment/invoice)
- created_by: UUID
- created_at: TIMESTAMPTZ
```

#### 17. bottles
Bottle inventory
```sql
- id: UUID
- bottle_type: bottle_type
- size: bottle_size
- total_quantity: INTEGER
- available_quantity: INTEGER
- deposit_amount: NUMERIC
- created_at, updated_at: TIMESTAMPTZ
```

#### 18. bottle_transactions
Bottle circulation tracking
```sql
- id: UUID
- bottle_id: UUID (FK to bottles)
- customer_id: UUID (FK to customers)
- transaction_type: TEXT ('issued', 'returned', 'lost', 'damaged')
- quantity: INTEGER
- transaction_date: DATE
- staff_id: UUID
- notes: TEXT
- created_at: TIMESTAMPTZ
```

#### 19. customer_bottles
Customer bottle holdings
```sql
- id: UUID
- customer_id: UUID (FK to customers)
- bottle_id: UUID (FK to bottles)
- quantity_pending: INTEGER (bottles with customer)
- last_issued_date: DATE
- last_returned_date: DATE
- created_at, updated_at: TIMESTAMPTZ
```

#### 20. cattle_health
Health records (vaccinations, treatments, checkups)
```sql
- id: UUID
- cattle_id: UUID (FK to cattle)
- record_date: DATE
- record_type: TEXT ('vaccination', 'treatment', 'checkup', 'disease')
- title: TEXT
- description: TEXT
- vet_name: TEXT
- cost: NUMERIC
- next_due_date: DATE (for vaccination reminders)
- recorded_by: UUID
- created_at: TIMESTAMPTZ
```

#### 21. breeding_records
Reproduction tracking
```sql
- id: UUID
- cattle_id: UUID (FK to cattle)
- record_type: TEXT ('heat_detection', 'artificial_insemination', 'pregnancy_check', 'calving')
- record_date: DATE
- heat_cycle_day: INTEGER
- insemination_bull: TEXT
- insemination_technician: TEXT
- pregnancy_confirmed: BOOLEAN
- expected_calving_date: DATE (auto-calculated: record_date + 283 days)
- actual_calving_date: DATE
- calf_details: JSONB (gender, weight, tag_number)
- notes: TEXT
- recorded_by: UUID
- created_at: TIMESTAMPTZ
```

#### 22. feed_inventory
Feed stock management
```sql
- id: UUID
- name: TEXT
- category: TEXT ('fodder', 'concentrate', 'mineral', 'supplement')
- unit: TEXT ('kg', 'quintal', 'bale')
- current_stock: NUMERIC
- min_stock_level: NUMERIC (for low stock alerts)
- cost_per_unit: NUMERIC
- supplier: TEXT
- created_at, updated_at: TIMESTAMPTZ
```

#### 23. feed_consumption
Daily feed usage
```sql
- id: UUID
- feed_id: UUID (FK to feed_inventory)
- cattle_id: UUID (optional, for individual tracking)
- consumption_date: DATE
- quantity: NUMERIC
- recorded_by: UUID
- created_at: TIMESTAMPTZ
```

#### 24. equipment
Farm equipment registry
```sql
- id: UUID
- name: TEXT
- category: TEXT ('milking', 'cooling', 'transport', 'cleaning', 'other')
- model: TEXT
- serial_number: TEXT
- purchase_date: DATE
- purchase_cost: NUMERIC
- warranty_expiry: DATE
- status: TEXT ('operational', 'maintenance', 'repair', 'retired')
- location: TEXT
- notes: TEXT
- created_at, updated_at: TIMESTAMPTZ
```

#### 25. maintenance_records
Equipment maintenance log
```sql
- id: UUID
- equipment_id: UUID (FK to equipment)
- maintenance_date: DATE
- maintenance_type: TEXT ('routine', 'repair', 'inspection')
- description: TEXT
- cost: NUMERIC
- performed_by: TEXT
- next_maintenance_date: DATE
- notes: TEXT
- created_at: TIMESTAMPTZ
```

#### 26. expenses
General expense tracking
```sql
- id: UUID
- expense_date: DATE
- category: TEXT ('feed', 'veterinary', 'fuel', 'electricity', 'salary', 'maintenance', 'other')
- title: TEXT
- amount: NUMERIC
- cattle_id: UUID (optional, for cattle-specific expenses)
- receipt_url: TEXT
- notes: TEXT
- recorded_by: UUID
- created_at: TIMESTAMPTZ
```

#### 27. employees
Staff records
```sql
- id: UUID
- name: TEXT
- phone: TEXT
- role: user_role
- address: TEXT
- joining_date: DATE
- salary: NUMERIC (monthly)
- is_active: BOOLEAN
- user_id: UUID (linked auth user)
- created_at, updated_at: TIMESTAMPTZ
```

#### 28. shifts
Work shift definitions
```sql
- id: UUID
- name: TEXT ('Morning', 'Evening', 'Night')
- start_time: TIME
- end_time: TIME
- is_active: BOOLEAN
- created_at: TIMESTAMPTZ
```

#### 29. employee_shifts
Employee shift assignments
```sql
- id: UUID
- employee_id: UUID (FK to employees)
- shift_id: UUID (FK to shifts)
- effective_from: DATE
- effective_to: DATE
- created_at: TIMESTAMPTZ
```

#### 30. attendance
Daily attendance with AUTO-PRESENT feature
```sql
- id: UUID
- employee_id: UUID (FK to employees)
- attendance_date: DATE
- status: TEXT ('present', 'absent', 'half_day', 'leave')
- check_in: TIME
- check_out: TIME
- notes: TEXT
- created_at: TIMESTAMPTZ
```

**AUTOMATION:** All active employees are automatically marked "present" daily unless manually changed to absent/half_day/leave.

#### 31. payroll_records
Salary processing
```sql
- id: UUID
- employee_id: UUID (FK to employees)
- pay_period_start: DATE
- pay_period_end: DATE
- base_salary: NUMERIC
- overtime_hours: NUMERIC
- overtime_rate: NUMERIC
- bonus: NUMERIC
- deductions: NUMERIC
- net_salary: NUMERIC
- payment_status: TEXT ('pending', 'paid')
- payment_date: DATE
- payment_mode: TEXT
- notes: TEXT
- created_by: UUID
- created_at: TIMESTAMPTZ
```

#### 32. price_rules
Quality-based dynamic pricing
```sql
- id: UUID
- name: TEXT
- product_id: UUID (FK to products)
- min_fat_percentage: NUMERIC
- max_fat_percentage: NUMERIC
- min_snf_percentage: NUMERIC
- max_snf_percentage: NUMERIC
- price_adjustment: NUMERIC (+ or - amount)
- adjustment_type: TEXT ('fixed', 'percentage')
- is_active: BOOLEAN
- created_at, updated_at: TIMESTAMPTZ
```

#### 33. dairy_settings
Business configuration
```sql
- id: UUID
- dairy_name: TEXT
- address: TEXT
- phone: TEXT
- email: TEXT
- logo_url: TEXT
- invoice_prefix: TEXT ('INV')
- financial_year_start: INTEGER (month, e.g., 4 for April)
- currency: TEXT ('INR')
- settings: JSONB (additional config)
- created_at, updated_at: TIMESTAMPTZ
```

#### 34. notification_templates
SMS/WhatsApp message templates
```sql
- id: UUID
- name: TEXT
- template_type: TEXT ('delivery', 'payment', 'reminder', 'alert')
- channel: TEXT ('sms', 'whatsapp', 'email')
- subject: TEXT
- body: TEXT (with {{variables}})
- variables: JSONB
- is_active: BOOLEAN
- created_at, updated_at: TIMESTAMPTZ
```

#### 35. notification_logs
Sent notification history
```sql
- id: UUID
- template_id: UUID (FK to notification_templates)
- recipient_type: TEXT ('customer', 'employee')
- recipient_id: UUID
- recipient_contact: TEXT
- channel: TEXT
- subject: TEXT
- body: TEXT
- status: TEXT ('pending', 'sent', 'failed')
- sent_at: TIMESTAMPTZ
- error_message: TEXT
- created_at: TIMESTAMPTZ
```

#### 36. activity_logs
Audit trail
```sql
- id: UUID
- user_id: UUID
- action: TEXT ('create', 'update', 'delete', 'login', 'logout')
- entity_type: TEXT ('cattle', 'customer', 'delivery', etc.)
- entity_id: UUID
- details: JSONB (old/new values)
- ip_address: TEXT
- created_at: TIMESTAMPTZ
```

#### 37. auth_attempts
Login security (rate limiting)
```sql
- id: UUID
- phone: TEXT
- failed_count: INTEGER
- last_attempt: TIMESTAMPTZ
- locked_until: TIMESTAMPTZ
```

#### 38. customer_auth_attempts
Customer app login security
```sql
- id: UUID
- phone: TEXT
- failed_count: INTEGER
- last_attempt: TIMESTAMPTZ
- locked_until: TIMESTAMPTZ
```

---

## 4. DATABASE FUNCTIONS

### Authentication
```sql
-- Verify staff PIN login
verify_pin(_phone TEXT, _pin TEXT) RETURNS UUID

-- Verify customer PIN login
verify_customer_pin(_phone TEXT, _pin TEXT) RETURNS TABLE(customer_id UUID, user_id UUID, is_approved BOOLEAN)

-- Register customer account
register_customer_account(_phone TEXT, _pin TEXT) RETURNS JSON

-- Update customer PIN
update_customer_pin(_customer_id UUID, _current_pin TEXT, _new_pin TEXT) RETURNS JSON

-- Update user profile with PIN
update_user_profile_with_pin(_user_id UUID, _full_name TEXT, _phone TEXT, _role user_role, _pin TEXT)

-- Update PIN only
update_pin_only(_user_id UUID, _pin TEXT)
```

### Role Management
```sql
-- Check if user has specific role
has_role(_user_id UUID, _role user_role) RETURNS BOOLEAN

-- Check if user has any of specified roles
has_any_role(_user_id UUID, _roles user_role[]) RETURNS BOOLEAN

-- Check if user is manager or admin
is_manager_or_admin(_user_id UUID) RETURNS BOOLEAN

-- Check if user is authenticated
is_authenticated() RETURNS BOOLEAN
```

### Vacation Check
```sql
-- Check if customer is on vacation for a date
is_customer_on_vacation(_customer_id UUID, _check_date DATE DEFAULT CURRENT_DATE) RETURNS BOOLEAN
```

### Auto Attendance
```sql
-- Auto-create daily attendance for all active employees (marked present by default)
auto_create_daily_attendance() RETURNS VOID
```

### Triggers
```sql
-- Update updated_at timestamp
update_updated_at_column() RETURNS TRIGGER

-- Create profile and role for new auth user
handle_new_user() RETURNS TRIGGER

-- Auto attendance on employee insert
attendance_auto_present_on_access() RETURNS TRIGGER
```

---

## 5. EDGE FUNCTIONS

### 1. bootstrap-admin
Initialize first super admin user

### 2. create-user
Create new staff user with:
- Email/phone, name, role
- Auto-generate PIN
- Create profile and user_roles entry

### 3. delete-user
Soft delete user (deactivate)

### 4. update-user-status
Activate/deactivate user accounts

### 5. reset-user-pin
Admin reset user's PIN

### 6. change-pin
User self-service PIN change

### 7. customer-auth
Customer app authentication:
- Login with phone + PIN
- Registration with phone + PIN
- Account approval flow

---

## 6. ROLE-BASED ACCESS CONTROL

### Roles & Permissions

| Role | Dashboard | Access Areas |
|------|-----------|--------------|
| super_admin | Admin | All modules + Settings + User Management |
| manager | Admin | All modules + Settings (no user mgmt) |
| accountant | Accountant | Billing, Expenses, Reports, Customers, Employees |
| delivery_staff | Delivery | Deliveries, Customers, Bottles |
| farm_worker | Farm | Cattle, Production, Health, Inventory |
| vet_staff | Vet | Cattle, Health |
| auditor | Auditor | Reports, Billing, Expenses, Audit Logs (read-only) |

### Sidebar Navigation Filtering
Navigation items are filtered based on user role using `roleSections` mapping.

---

## 7. APPLICATION ROUTES

### Staff Application Routes
```
/auth                   - Staff login (phone + PIN)
/dashboard              - Role-specific dashboard
/cattle                 - Cattle management
/production             - Milk production tracking
/products               - Product catalog
/customers              - Customer management
/deliveries             - Delivery scheduling & tracking
/routes                 - Delivery route management
/billing                - Invoices & payments
/bottles                - Bottle circulation
/health                 - Health records
/breeding               - Breeding management
/inventory              - Feed & inventory
/equipment              - Equipment management
/expenses               - Expense tracking
/price-rules            - Quality-based pricing
/reports                - Analytics & reports
/employees              - Employee management
/users                  - User management (admin only)
/notifications          - Notification templates
/audit-logs             - Activity audit trail
/settings               - Dairy & profile settings
```

### Customer Application Routes
```
/customer/auth          - Customer login/register
/customer/dashboard     - Customer home
/customer/subscription  - Manage subscriptions
/customer/products      - Browse product catalog
/customer/deliveries    - Delivery history
/customer/billing       - Invoices & payments
/customer/profile       - Profile & settings
```

---

## 8. PAGE FEATURES (Detailed)

### 8.1 Dashboard
- **Role-specific views:** Admin, Delivery, Farm, Accountant, Vet, Auditor
- **Admin Dashboard includes:**
  - Today's milk production total
  - Active customers count
  - Pending deliveries
  - Outstanding payments
  - Production chart (last 7 days)
  - Recent activity feed
  - Quick action buttons
  - Integrated alerts panel

### 8.2 Cattle Management
- CRUD operations for cattle
- Stats: Total, Lactating, Pregnant, Dry counts
- Milk history dialog per cattle
- Fields: Tag#, Name, Breed, Type (cow/buffalo), DOB, Status, Lactation Status, Weight
- Status badges with colors
- Searchable data table

### 8.3 Milk Production
- Record production by date + session (Morning/Evening)
- Bulk entry for all lactating cattle
- Fat% and SNF% quality metrics
- Daily totals with clickable history
- Session-wise totals
- Charts and trends
- Quality notes

### 8.4 Customers
- Customer CRUD with subscription management
- Stats: Total, Active, With Balance, With Advance
- Customer ledger view (transaction history)
- Vacation management
- Account approvals for customer app
- Subscription products management
- Balance tracking (credit/advance)

### 8.5 Deliveries
- Date-based delivery list
- Status management: Pending → Delivered/Missed
- Bulk update actions ("Mark All Delivered")
- Vacation indicator badges
- Filter tabs by status
- Quick status buttons

### 8.6 Routes
- Define delivery routes
- Assign customers to routes with stop order
- Assign staff to routes
- Route sequencing

### 8.7 Billing
- Generate invoices (manual or bulk)
- Stats: Total Billed, Collected, Pending, Overdue
- Payment recording
- Invoice PDF generation
- Payment status tracking
- Bulk invoice generation for all customers

### 8.8 Bottles
- Bottle inventory (Glass/Plastic, sizes)
- Issue/Return transactions
- Customer bottle holdings
- Loss tracking
- Deposit management

### 8.9 Health Records
- Record vaccinations, treatments, checkups, diseases
- Next due date for reminders
- Vet name and cost tracking
- Upcoming reminders panel
- Type-based filtering

### 8.10 Breeding
- Heat detection records
- Artificial insemination tracking
- Pregnancy confirmation
- Expected calving calculation (283 days)
- Calving records with calf details
- Calendar view + List view
- Upcoming calvings panel
- Color-coded record types

### 8.11 Inventory (Feed)
- Feed stock management
- Categories: Fodder, Concentrate, Mineral, Supplement
- Low stock alerts
- Stock in/out transactions
- Consumption tracking

### 8.12 Equipment
- Equipment registry
- Maintenance scheduling
- Warranty tracking
- Status management
- Maintenance cost tracking

### 8.13 Expenses
- Category-based expense tracking
- Cattle-linked expenses
- Date range filtering
- Monthly totals
- Category breakdown charts

### 8.14 Price Rules
- Quality-based pricing rules
- Fat% and SNF% ranges
- Fixed or percentage adjustments
- Product-specific rules

### 8.15 Employees
- Employee CRUD
- Attendance tracking (AUTO-PRESENT by default)
- Shift management
- Payroll processing
- Attendance status: Present, Absent, Half Day, Leave

### 8.16 Reports
- Production reports
- Financial reports
- Customer reports
- Cattle reports
- Export to Excel functionality

### 8.17 Settings
- Dairy information
- User profile
- Security (PIN change)
- Notification preferences (placeholder)

### 8.18 User Management (Admin)
- Create staff users
- Assign roles
- Reset PINs
- Activate/Deactivate accounts

### 8.19 Audit Logs
- Activity history
- User action tracking
- Entity change history

### 8.20 Notifications
- Template management (placeholder)
- SMS/WhatsApp templates

---

## 9. CUSTOMER APP FEATURES

### 9.1 Authentication
- Phone + PIN login
- Self-registration (requires admin approval)
- Auto-approval if phone matches existing customer
- PIN change

### 9.2 Customer Dashboard
- Outstanding balance display
- Today's delivery status
- Vacation status banner
- Active subscription summary
- Quick actions (pause/resume delivery)

### 9.3 Subscription Management
- View subscribed products
- Pause/Resume individual items
- Change quantities
- Add new products

### 9.4 Product Catalog
- Browse available products
- View prices and descriptions
- Add to subscription

### 9.5 Delivery History
- Past delivery records
- Delivery status

### 9.6 Billing
- View invoices
- Payment history
- Outstanding balance

### 9.7 Profile
- Update contact info
- Change PIN
- Support contact

---

## 10. AUTOMATION HOOKS

### 10.1 useAutoAttendance
- Auto-creates attendance records for all active employees daily
- Default status: "present"
- Runs on employees page load

### 10.2 useAutoDeliveryScheduler
- Schedules deliveries based on customer subscriptions
- Respects vacation periods
- Handles daily/alternate/weekly schedules

### 10.3 useAutoInvoiceGenerator
- Generates monthly invoices from delivery data
- Calculates totals from delivery items
- Applies discounts and taxes

### 10.4 useCattleStatusAutomation
- Updates lactation status based on:
  - Calving records → Lactating
  - Days since calving → Dry reminder
  - Pregnancy confirmation → Pregnant
  - Milk production data

### 10.5 useLedgerAutomation
- Auto-creates ledger entries for:
  - Deliveries (debit)
  - Payments (credit)
  - Invoices
- Calculates running balance

### 10.6 useIntegratedAlerts
- Aggregates alerts from all modules:
  - Breeding (upcoming calvings, heat reminders)
  - Health (overdue vaccinations)
  - Inventory (low stock)
  - Payments (overdue)
  - Production (anomalies)

### 10.7 useProductionAnalytics
- Calculates per-cattle performance
- Detects production trends
- Identifies top/underperforming cattle
- Session distribution analysis

### 10.8 useBreedingAlerts
- Heat cycle predictions
- Pregnancy check reminders
- Calving countdown

---

## 11. UI/UX DESIGN SYSTEM

### Color Palette (HSL)
```css
/* Core */
--primary: 155 55% 32% (Forest green)
--secondary: 45 45% 92% (Warm cream)
--accent: 162 60% 42% (Emerald)
--background: 48 35% 97% (Off-white)
--foreground: 150 30% 12% (Dark green)

/* Status Colors */
--success: 145 75% 42% (Green)
--warning: 42 95% 52% (Amber)
--info: 205 92% 52% (Blue)
--destructive: 0 75% 55% (Red)

/* Role Colors */
--role-admin: 0 78% 55% (Red)
--role-manager: 220 95% 58% (Blue)
--role-accountant: 145 75% 42% (Green)
--role-delivery: 28 98% 55% (Orange)
--role-farm: 42 95% 52% (Yellow)
--role-vet: 275 85% 58% (Purple)
--role-auditor: 220 12% 52% (Gray)

/* Breeding Colors */
--breeding-heat: 335 85% 58% (Pink)
--breeding-insemination: 220 95% 58% (Blue)
--breeding-pregnancy: 275 85% 58% (Purple)
--breeding-calving: 145 75% 42% (Green)

/* Health Colors */
--health-vaccination: 192 88% 52% (Cyan)
--health-checkup: 172 78% 40% (Teal)
--health-treatment: 0 78% 55% (Red)

/* Sidebar */
--sidebar-background: 152 32% 16% (Dark green)
--sidebar-foreground: 48 25% 94% (Cream)
--sidebar-primary: 162 60% 52% (Bright emerald)
```

### Typography
- Font: Outfit (Google Fonts)
- Weights: 300-800
- Headings: font-semibold, tracking-tight

### Animations
```css
/* Keyframes */
- fadeIn
- slideUp
- slideInLeft
- scaleIn
- pulseSoft
- float
- shimmer
- bounceGentle
- glow
- spin

/* Classes */
.animate-fade-in
.animate-slide-up
.animate-scale-in
.animate-float
.animate-shimmer
.animate-glow
.hover-lift
.hover-scale
.hover-glow
.shine-effect
.glass
.glass-hover
```

### Shadows
```css
--shadow-sm, --shadow-md, --shadow-lg, --shadow-xl
--shadow-glow (colored glow)
--shadow-colored (primary color shadow)
```

### Component Styling
- Cards: Rounded corners, subtle shadows, hover lift effect
- Buttons: Gradient variants, lift on hover, active scale
- Inputs: Focus ring with primary color, hover border change
- Badges: Multiple variants (default, success, warning, info, gradient)
- Tables: Striped rows, hover highlight, animated loading state

---

## 12. COMPONENT STRUCTURE

### Layout Components
```
src/components/layout/
├── DashboardLayout.tsx      # Main layout with sidebar
└── AppSidebar.tsx           # Navigation sidebar with role filtering
```

### Dashboard Components
```
src/components/dashboard/
├── AdminDashboard.tsx       # Full admin dashboard
├── DeliveryDashboard.tsx    # Delivery staff dashboard
├── FarmDashboard.tsx        # Farm worker dashboard
├── AccountantDashboard.tsx  # Accountant dashboard
├── VetDashboard.tsx         # Vet staff dashboard
├── AuditorDashboard.tsx     # Auditor dashboard
├── StatCard.tsx             # Stats display card
├── ProductionChart.tsx      # Recharts production graph
├── QuickActionsCard.tsx     # Action buttons
├── RecentActivityCard.tsx   # Activity feed
├── AlertsCard.tsx           # System alerts
├── IntegratedAlertsCard.tsx # Cross-module alerts
└── ProductionInsights.tsx   # Analytics panel
```

### Common Components
```
src/components/common/
├── PageHeader.tsx           # Page title with action button
├── DataTable.tsx            # Generic data table with search
├── StatusBadge.tsx          # Color-coded status badges
├── ConfirmDialog.tsx        # Confirmation modal
├── ExportButton.tsx         # Excel export functionality
└── ThemeToggle.tsx          # Dark/light mode toggle
```

### Feature Components
```
src/components/
├── billing/
│   ├── InvoicePDFGenerator.tsx
│   └── BulkInvoiceGenerator.tsx
├── breeding/
│   ├── BreedingCalendar.tsx
│   └── BreedingAlertsPanel.tsx
├── customers/
│   ├── CustomerLedger.tsx
│   ├── VacationManager.tsx
│   └── CustomerAccountApprovals.tsx
├── deliveries/
│   └── BulkDeliveryActions.tsx
├── production/
│   └── MilkHistoryDialog.tsx
├── customer/ (Customer app)
│   ├── CustomerLayout.tsx
│   └── CustomerNavbar.tsx
└── mobile/
    ├── MobileNavbar.tsx
    ├── MobileCattleCard.tsx
    ├── MobileDeliveryCard.tsx
    └── QuickActionFab.tsx
```

### UI Components (shadcn/ui)
```
src/components/ui/
├── button.tsx
├── card.tsx
├── dialog.tsx
├── input.tsx
├── select.tsx
├── table.tsx
├── tabs.tsx
├── badge.tsx
├── toast.tsx
├── tooltip.tsx
├── calendar.tsx
├── accordion.tsx
├── sheet.tsx
├── dropdown-menu.tsx
├── form.tsx
├── checkbox.tsx
├── switch.tsx
├── progress.tsx
├── skeleton.tsx
├── scroll-area.tsx
├── separator.tsx
├── avatar.tsx
└── ...more
```

---

## 13. HOOKS

```
src/hooks/
├── useUserRole.ts           # Get current user role & permissions
├── useCustomerAuth.tsx      # Customer app auth context
├── useAutoAttendance.ts     # Auto-create daily attendance
├── useAutoDeliveryScheduler.ts
├── useAutoInvoiceGenerator.ts
├── useCattleStatusAutomation.ts
├── useLedgerAutomation.ts
├── useIntegratedAlerts.ts
├── useProductionAnalytics.ts
├── useBreedingAlerts.ts
├── useMilkHistory.ts        # Fetch milk production history
├── useSoundFeedback.ts      # Web Audio API sounds
├── useInteractions.ts       # Confetti + sound combinations
├── use-mobile.tsx           # Mobile detection
└── use-toast.ts             # Toast notifications
```

---

## 14. UTILITY LIBRARIES

```
src/lib/
├── utils.ts                 # cn() classname merger
├── confetti.ts              # Canvas confetti animations
├── export.ts                # Excel export utilities
└── errors.ts                # Error handling utilities
```

---

## 15. MICRO-INTERACTIONS

### Sound Feedback (Web Audio API)
- Click sounds (subtle tick)
- Success sounds (ascending notes)
- Error sounds (descending tone)
- Hover sounds (optional)

### Confetti Effects (canvas-confetti)
- Success confetti (center burst)
- Side confetti (dual side cannons)
- Star confetti (star shapes)
- Celebration (full celebration)

### Theme Toggle
- Animated sun/moon icon swap
- Smooth color transitions
- LocalStorage persistence
- System preference detection

---

## 16. SECURITY FEATURES

### Authentication
- PIN-based login (6-digit numeric)
- bcrypt password hashing
- Rate limiting (5 attempts, 15-min lockout)
- Session management via Supabase Auth

### Row Level Security (RLS)
- All tables have RLS enabled
- Policies based on user roles
- Data isolation per user/role

### Sensitive Data Protection
- Salaries visible only to accountant/admin
- Customer balances protected
- Audit logs immutable

---

## 17. SEO & META

```html
<title>Doodh Wallah - Complete Dairy Farm Management Solution</title>
<meta name="description" content="Streamline your dairy operations with Doodh Wallah. Manage cattle, track milk production, handle customer deliveries, billing, and inventory - all in one place."/>
<meta name="keywords" content="dairy management, milk production, cattle tracking, farm software"/>
<meta property="og:type" content="website"/>
<meta property="og:locale" content="en_IN"/>
```

### Structured Data (JSON-LD)
```json
{
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  "name": "Doodh Wallah",
  "applicationCategory": "BusinessApplication",
  "operatingSystem": "Web"
}
```

---

## 18. RESPONSIVE DESIGN

- Mobile-first approach
- Breakpoints: sm (640px), md (768px), lg (1024px), xl (1280px)
- Collapsible sidebar on mobile
- Touch-friendly buttons
- Mobile-optimized data tables
- Bottom navigation for customer app

---

## 19. PERFORMANCE OPTIMIZATIONS

- React Query for data caching
- Lazy loading for images
- Debounced search inputs
- Pagination for large datasets (50-100 items)
- Optimistic updates for status changes
- Skeleton loading states

---

## 20. FUTURE ENHANCEMENTS (Placeholders)

- SMS/WhatsApp notification integration
- Payment gateway integration (Razorpay/UPI)
- QR code for cattle identification
- Image uploads for cattle/receipts
- Multi-language support
- Offline mode for delivery staff
- Mobile native app (React Native)
- Report exports to PDF
- Dashboard customization
- API for third-party integrations

---

## RECREATION STEPS

1. **Initialize Project**
   - Create React + Vite + TypeScript project
   - Install dependencies (see package.json)
   - Configure Tailwind CSS

2. **Setup Supabase/Lovable Cloud**
   - Create all tables with RLS
   - Add database functions
   - Deploy edge functions
   - Configure auth settings

3. **Build UI Components**
   - Install shadcn/ui components
   - Apply custom design tokens in index.css
   - Configure tailwind.config.ts

4. **Implement Features**
   - Start with auth flow
   - Build layout components
   - Create pages in order of dependency
   - Add automation hooks
   - Implement customer app

5. **Test & Polish**
   - Verify all CRUD operations
   - Test role-based access
   - Add animations and micro-interactions
   - Mobile responsiveness testing

---

**END OF COMPREHENSIVE PROMPT**
