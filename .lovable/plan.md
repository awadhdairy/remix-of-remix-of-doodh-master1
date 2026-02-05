
# Comprehensive Fix: Route Creation & Customer-Route Integration

## Root Cause Analysis

### Issue 1: Authentication Failing (Blocks Everything)

**Problem**: The app connects to the **wrong Supabase project** in the Lovable preview environment.

**Evidence from Console**:
```
[Supabase] Connecting to: yxejlcrckdabxuvidgje  ← OLD Lovable Cloud
```

**Root Cause**: Lovable "Secrets" (`EXTERNAL_SUPABASE_URL`, `EXTERNAL_SUPABASE_ANON_KEY`) are designed for **edge functions only** (Deno environment). They are NOT available as `import.meta.env.*` variables in the frontend Vite build.

**Current Code Logic** (src/lib/external-supabase.ts):
```typescript
const EXTERNAL_URL = 
  import.meta.env.EXTERNAL_SUPABASE_URL ||   // undefined (secrets don't work in frontend)
  import.meta.env.VITE_SUPABASE_URL;         // yxejlcrckdabxuvidgje (OLD project)
```

**Result**: Falls back to old project → auth fails → user stuck on /auth → blank Routes page

### Issue 2: Routes Not Integrated with Customers

**Current State**:
- `customers` table has a `route_id` column (foreign key to `routes`)
- Customer form does NOT include route selection
- When creating a new customer, `route_id` is never set
- Auto-delivery scheduler ignores route sequencing

### Issue 3: Database is Empty

The external Supabase project (`iupmzocmmjxpeabkmzri`) has no data:
- No users in `profiles` table
- No customers
- No routes
- Schema may not even be applied

---

## Solution Strategy

### For Lovable Preview Testing (Immediate)
Since we cannot change the auto-generated `.env` file and secrets don't work in frontend, we need to **hardcode the external Supabase URL temporarily** for testing in the Lovable preview.

### For Vercel Production (Final)
The code already works correctly with `VITE_SUPABASE_URL` - just ensure Vercel has the correct environment variables.

---

## Implementation Plan

### Phase 1: Fix Supabase Connection

**File: `src/lib/external-supabase.ts`**

Update to include hardcoded fallback for the external project when running in Lovable preview:

```typescript
// Detection: Check if running in Lovable preview vs Vercel production
const isLovablePreview = typeof window !== 'undefined' && 
  window.location.hostname.includes('lovableproject.com');

// Hardcoded external project for Lovable preview testing
const EXTERNAL_PROJECT_URL = 'https://iupmzocmmjxpeabkmzri.supabase.co';
const EXTERNAL_PROJECT_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'; // Your anon key

// Priority order:
// 1. Hardcoded for Lovable preview (temporary for testing)
// 2. VITE_* env vars (for Vercel production)
const EXTERNAL_URL = isLovablePreview
  ? EXTERNAL_PROJECT_URL
  : import.meta.env.VITE_SUPABASE_URL;

const EXTERNAL_ANON_KEY = isLovablePreview
  ? EXTERNAL_PROJECT_ANON_KEY
  : (import.meta.env.VITE_SUPABASE_ANON_KEY || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY);
```

### Phase 2: Integrate Routes with Customer Creation

**File: `src/pages/Customers.tsx`**

1. Add `route_id` to Customer interface and form data
2. Fetch available routes when form opens
3. Add route selector dropdown to customer form
4. Implement intelligent route suggestion based on area
5. Save `route_id` when creating/updating customer
6. Optionally auto-create route_stop entry

**Changes**:

```typescript
// Updated interface
interface Customer {
  // ... existing fields
  route_id: string | null;
}

// Updated form data
const emptyFormData = {
  // ... existing fields
  route_id: "",
};

// Fetch routes in component
const [routes, setRoutes] = useState<Route[]>([]);

// Add to fetchCustomers or separate function
const fetchRoutes = async () => {
  const { data } = await supabase
    .from("routes")
    .select("id, name, area")
    .eq("is_active", true)
    .order("name");
  if (data) setRoutes(data);
};

// Auto-suggest route based on area match
const suggestRouteForArea = (area: string) => {
  if (!area) return null;
  const match = routes.find(r => 
    r.area?.toLowerCase().includes(area.toLowerCase()) ||
    area.toLowerCase().includes(r.area?.toLowerCase() || '')
  );
  return match?.id || null;
};

// UI: Route selector after Area field
<div className="space-y-2">
  <Label htmlFor="route">Delivery Route</Label>
  <Select
    value={formData.route_id}
    onValueChange={(v) => setFormData({ ...formData, route_id: v })}
  >
    <SelectTrigger>
      <SelectValue placeholder="Select route (optional)" />
    </SelectTrigger>
    <SelectContent>
      <SelectItem value="">No route assigned</SelectItem>
      {routes.map(route => (
        <SelectItem key={route.id} value={route.id}>
          {route.name} {route.area && `(${route.area})`}
        </SelectItem>
      ))}
    </SelectContent>
  </Select>
  <p className="text-xs text-muted-foreground">
    Assign to a delivery route for optimized scheduling
  </p>
</div>

// Update payload in handleSave
const payload = {
  // ... existing fields
  route_id: formData.route_id || null,
};

// After customer creation, optionally add to route_stops
if (newCustomer && formData.route_id) {
  // Get next stop order
  const { data: existingStops } = await supabase
    .from("route_stops")
    .select("stop_order")
    .eq("route_id", formData.route_id)
    .order("stop_order", { ascending: false })
    .limit(1);
  
  const nextOrder = (existingStops?.[0]?.stop_order || 0) + 1;
  
  await supabase.from("route_stops").insert({
    route_id: formData.route_id,
    customer_id: newCustomer.id,
    stop_order: nextOrder,
  });
}
```

### Phase 3: Update Customer Detail Dialog

**File: `src/components/customers/CustomerDetailDialog.tsx`**

Show assigned route in customer details and allow editing.

### Phase 4: Add Route Display to Customer Table

Add a "Route" column to the customers table showing assigned route name.

---

## Files to Modify

| File | Changes |
|------|---------|
| `src/lib/external-supabase.ts` | Fix connection to use correct external project |
| `src/pages/Customers.tsx` | Add route_id to form, fetch routes, auto-suggest |
| `src/components/customers/CustomerDetailDialog.tsx` | Display/edit route assignment |
| `src/pages/Routes.tsx` | Minor improvements (no structural changes needed) |

---

## Database Status

The code changes will work once the external Supabase project has:
1. ✅ Schema applied (run `EXTERNAL_SUPABASE_SCHEMA.sql`)
2. ✅ Edge functions deployed
3. ✅ Admin user bootstrapped
4. ✅ Some initial routes created

---

## Integration Safety Checks

### No Breaking Changes
- ✅ `route_id` is nullable - existing customers unaffected
- ✅ Route assignment is optional in form
- ✅ All existing form validation preserved
- ✅ Subscription product logic unchanged

### Automation Compatibility
- ✅ Auto-delivery scheduler continues to work (doesn't require route_id)
- ✅ Ledger automation unaffected
- ✅ Customer account approvals unaffected

### Future Enhancement Opportunities
- Delivery staff can see customers grouped by route
- Auto-delivery can process routes in sequence_order
- Route optimization can suggest stop order

---

## Expected Outcome

After implementation:
1. **Lovable Preview**: App connects to external Supabase (`iupmzocmmjxpeabkmzri`)
2. **Auth Works**: Login with phone `7897716792`, PIN `101101`
3. **Routes Page**: Loads correctly, "Create Route" works
4. **Customer Form**: Shows route selector with intelligent suggestions
5. **New Customers**: Automatically added to route_stops when route assigned
6. **Vercel Production**: Works with `VITE_SUPABASE_*` environment variables
