

# Add Employee Management (Add/Edit/Delete) for Admins

## Overview

Implement comprehensive employee CRUD (Create, Read, Update, Delete) functionality for admin users on the Employees page. This follows the existing patterns from User Management while ensuring proper security with role-based access control.

## Current State Analysis

| Aspect | Current State |
|--------|---------------|
| **Employee List** | View-only with detail dialog |
| **Add Employee** | Not available |
| **Edit Employee** | Not available |
| **Delete Employee** | Not available |
| **Role Check** | No admin verification |

The User Management page (`UserManagement.tsx`) provides a good pattern to follow for CRUD operations with dialogs and role-based access.

## Implementation Plan

### Part 1: Create Employee Form Dialog Component

**New File: `src/components/employees/EmployeeFormDialog.tsx`**

A reusable dialog component for both adding and editing employees:

```text
- Props: open, onOpenChange, employee (null for add, data for edit), onSuccess
- Form fields:
  - Name (required)
  - Phone (10 digits, validated)
  - Role (dropdown: farm_worker, delivery_staff, vet_staff, etc.)
  - Salary (numeric)
  - Joining Date (date picker)
  - Address (optional textarea)
  - Is Active (toggle switch)
- Validation before submit
- Different button text for Add vs Edit mode
```

### Part 2: Create Delete Confirmation Dialog

**New File: `src/components/employees/DeleteEmployeeDialog.tsx`**

A confirmation dialog with:
- Employee name prominently displayed
- Warning about data cascade (attendance, payroll records)
- Confirm/Cancel buttons
- Loading state during deletion

### Part 3: Update Employees Page

**File: `src/pages/Employees.tsx`**

Changes needed:

1. **Add Role Check at Top**
   ```typescript
   const { role } = useUserRole();
   const isAdmin = role === 'super_admin' || role === 'manager';
   ```

2. **Add State for Dialogs**
   ```typescript
   const [addDialogOpen, setAddDialogOpen] = useState(false);
   const [editEmployee, setEditEmployee] = useState<Employee | null>(null);
   const [deleteEmployee, setDeleteEmployee] = useState<Employee | null>(null);
   ```

3. **Add "Add Employee" Button (Admin Only)**
   - In the Employees tab header, add button visible only for admin roles

4. **Add Action Column to Employee Table**
   ```typescript
   // Only show if isAdmin
   {
     key: "actions",
     header: "Actions",
     render: (row: Employee) => (
       <div className="flex gap-2">
         <Button size="sm" variant="outline" onClick={() => setEditEmployee(row)}>
           <Pencil /> Edit
         </Button>
         <Button size="sm" variant="destructive" onClick={() => setDeleteEmployee(row)}>
           <Trash2 /> Delete
         </Button>
       </div>
     )
   }
   ```

5. **CRUD Handler Functions**
   ```typescript
   const handleAddEmployee = async (data) => {
     const { error } = await supabase.from("employees").insert(data);
     if (!error) { toast.success("Employee added"); fetchData(); }
   };
   
   const handleEditEmployee = async (id, data) => {
     const { error } = await supabase.from("employees").update(data).eq("id", id);
     if (!error) { toast.success("Employee updated"); fetchData(); }
   };
   
   const handleDeleteEmployee = async (id) => {
     const { error } = await supabase.from("employees").delete().eq("id", id);
     if (!error) { toast.success("Employee deleted"); fetchData(); }
   };
   ```

6. **Include Dialog Components**
   - Add EmployeeFormDialog for add/edit
   - Add DeleteEmployeeDialog for delete confirmation

### Part 4: Database Cascade Configuration

**File: `EXTERNAL_SUPABASE_SCHEMA.sql`**

Add `ON DELETE CASCADE` to employee-related foreign keys to ensure clean deletion:

```sql
-- Tables referencing employees that need cascade:
- attendance.employee_id
- payroll_records.employee_id
- employee_shifts.employee_id
- bottle_transactions.staff_id (nullable, SET NULL instead)
```

Also provide migration SQL for existing databases.

### Part 5: Link to User Accounts (Optional Enhancement)

When creating an employee, optionally link them to an existing user profile:
- Add dropdown to select from existing profiles
- This allows matching employees to their login accounts

---

## File Changes Summary

| File | Action | Description |
|------|--------|-------------|
| `src/components/employees/EmployeeFormDialog.tsx` | Create | Add/Edit form dialog |
| `src/components/employees/DeleteEmployeeDialog.tsx` | Create | Delete confirmation dialog |
| `src/pages/Employees.tsx` | Modify | Add CRUD buttons, handlers, role check |
| `EXTERNAL_SUPABASE_SCHEMA.sql` | Modify | Add ON DELETE CASCADE for employee FKs |

---

## Security Considerations

1. **Role-Based Access**
   - Only `super_admin` and `manager` can add/edit/delete employees
   - Regular staff can only view employee list
   - Check handled on frontend AND database via RLS policies

2. **RLS Policies Already in Place**
   - `is_manager_or_admin(auth.uid())` checks exist for INSERT, UPDATE, DELETE
   - View access allowed for broader roles (accountant, auditor for read)

3. **Validation**
   - Phone number: 10 digits
   - Role: Must be valid user_role enum value
   - Salary: Positive number
   - Name: Required, non-empty

---

## UI/UX Enhancements

1. **Responsive Design**
   - Use `ResponsiveDialog` for mobile-friendly modals
   - Form inputs work well on touch screens

2. **Visual Feedback**
   - Loading states during operations
   - Success/error toast notifications
   - Disabled buttons during submission

3. **Confirmation Before Destructive Actions**
   - Delete requires explicit confirmation
   - Shows employee name and warns about related data

---

## Manual SQL Required

After code changes, run this on your external Supabase SQL Editor to add cascades:

```sql
-- Add ON DELETE CASCADE for employee foreign keys
ALTER TABLE public.attendance 
  DROP CONSTRAINT IF EXISTS attendance_employee_id_fkey,
  ADD CONSTRAINT attendance_employee_id_fkey 
    FOREIGN KEY (employee_id) REFERENCES public.employees(id) ON DELETE CASCADE;

ALTER TABLE public.payroll_records 
  DROP CONSTRAINT IF EXISTS payroll_records_employee_id_fkey,
  ADD CONSTRAINT payroll_records_employee_id_fkey 
    FOREIGN KEY (employee_id) REFERENCES public.employees(id) ON DELETE CASCADE;

ALTER TABLE public.employee_shifts 
  DROP CONSTRAINT IF EXISTS employee_shifts_employee_id_fkey,
  ADD CONSTRAINT employee_shifts_employee_id_fkey 
    FOREIGN KEY (employee_id) REFERENCES public.employees(id) ON DELETE CASCADE;

-- Set staff_id to NULL on employee delete (bottle_transactions)
ALTER TABLE public.bottle_transactions 
  DROP CONSTRAINT IF EXISTS bottle_transactions_staff_id_fkey,
  ADD CONSTRAINT bottle_transactions_staff_id_fkey 
    FOREIGN KEY (staff_id) REFERENCES public.employees(id) ON DELETE SET NULL;
```

