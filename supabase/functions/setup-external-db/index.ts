import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// PERMANENT ADMIN CREDENTIALS - hardcoded for reliability
// No bootstrap environment variables needed
const PERMANENT_ADMIN_PHONE = '7897716792'
const PERMANENT_ADMIN_PIN = '101101'
const PERMANENT_ADMIN_NAME = 'Super Admin'

/**
 * One-time setup function for external Supabase database
 * Creates permanent super admin and seeds all dummy data
 * 
 * This function is idempotent - running it multiple times is safe
 */
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    // Use EXTERNAL Supabase variables
    const supabaseUrl = Deno.env.get('EXTERNAL_SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('EXTERNAL_SUPABASE_SERVICE_ROLE_KEY')!

    if (!supabaseUrl || !supabaseServiceKey) {
      return new Response(
        JSON.stringify({ error: 'External Supabase not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey)

    console.log('[SETUP] Starting external database setup...')
    console.log('[SETUP] Using permanent admin phone:', PERMANENT_ADMIN_PHONE)

    // Check if admin already exists
    const email = `${PERMANENT_ADMIN_PHONE}@awadhdairy.com`
    const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers()
    const existingAdmin = existingUsers?.users?.find(u => u.email === email)

    let adminUserId: string

    if (existingAdmin) {
      console.log('[SETUP] Admin already exists, updating...')
      adminUserId = existingAdmin.id

      // Ensure admin has correct password
      await supabaseAdmin.auth.admin.updateUserById(adminUserId, {
        password: PERMANENT_ADMIN_PIN,
        email_confirm: true
      })

      // Update profile
      await supabaseAdmin
        .from('profiles')
        .upsert({
          id: adminUserId,
          full_name: PERMANENT_ADMIN_NAME,
          phone: PERMANENT_ADMIN_PHONE,
          role: 'super_admin',
          is_active: true
        }, { onConflict: 'id' })

      // Update PIN hash
      await supabaseAdmin.rpc('update_pin_only', {
        _user_id: adminUserId,
        _pin: PERMANENT_ADMIN_PIN
      })

      // Update role
      await supabaseAdmin
        .from('user_roles')
        .upsert({ user_id: adminUserId, role: 'super_admin' }, { onConflict: 'user_id' })

    } else {
      console.log('[SETUP] Creating new admin...')

      // Create auth user
      const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
        email,
        password: PERMANENT_ADMIN_PIN,
        email_confirm: true,
        user_metadata: {
          phone: PERMANENT_ADMIN_PHONE,
          full_name: PERMANENT_ADMIN_NAME
        }
      })

      if (authError) {
        throw new Error(`Failed to create admin: ${authError.message}`)
      }

      adminUserId = authData.user.id

      // Create profile
      await supabaseAdmin
        .from('profiles')
        .insert({
          id: adminUserId,
          full_name: PERMANENT_ADMIN_NAME,
          phone: PERMANENT_ADMIN_PHONE,
          role: 'super_admin',
          is_active: true
        })

      // Set PIN hash
      await supabaseAdmin.rpc('update_pin_only', {
        _user_id: adminUserId,
        _pin: PERMANENT_ADMIN_PIN
      })

      // Create role
      await supabaseAdmin
        .from('user_roles')
        .insert({ user_id: adminUserId, role: 'super_admin' })

      console.log('[SETUP] Admin created with ID:', adminUserId)
    }

    // ====== SEED DUMMY DATA ======

    console.log('[SETUP] Seeding dummy data...')

    // 1. Dairy Settings
    const { data: existingSettings } = await supabaseAdmin
      .from('dairy_settings')
      .select('id')
      .limit(1)
      .maybeSingle()

    if (!existingSettings) {
      await supabaseAdmin.from('dairy_settings').insert({
        dairy_name: 'Awadh Dairy Farm',
        address: '123 Farm Road, Lucknow, UP 226001',
        phone: '9876543210',
        email: 'info@awadhdairy.com',
        currency: 'INR',
        invoice_prefix: 'AWD',
        financial_year_start: 4,
        upi_handle: 'awadhdairy@upi'
      })
      console.log('[SETUP] Dairy settings created')
    }

    // 2. Products
    const { data: existingProducts } = await supabaseAdmin.from('products').select('id').limit(1)
    if (!existingProducts?.length) {
      await supabaseAdmin.from('products').insert([
        { name: 'Full Cream Milk', category: 'milk', base_price: 70, unit: 'liter', description: 'Pure full cream cow milk', is_active: true },
        { name: 'Toned Milk', category: 'milk', base_price: 55, unit: 'liter', description: 'Toned milk with 3% fat', is_active: true },
        { name: 'Fresh Curd', category: 'curd', base_price: 80, unit: 'kg', description: 'Fresh homemade curd', is_active: true },
        { name: 'Paneer', category: 'paneer', base_price: 350, unit: 'kg', description: 'Fresh cottage cheese', is_active: true },
        { name: 'Desi Ghee', category: 'ghee', base_price: 600, unit: 'kg', description: 'Pure clarified butter', is_active: true }
      ])
      console.log('[SETUP] Products created')
    }

    // 3. Routes
    const { data: existingRoutes } = await supabaseAdmin.from('routes').select('id').limit(1)
    let routeIds: string[] = []
    if (!existingRoutes?.length) {
      const { data: routes } = await supabaseAdmin.from('routes').insert([
        { name: 'Route A - Morning', area: 'Gomti Nagar, Aliganj', is_active: true, sequence_order: 1 },
        { name: 'Route B - Evening', area: 'Hazratganj, Indira Nagar', is_active: true, sequence_order: 2 }
      ]).select('id')
      routeIds = routes?.map(r => r.id) || []
      console.log('[SETUP] Routes created')
    } else {
      const { data: routes } = await supabaseAdmin.from('routes').select('id')
      routeIds = routes?.map(r => r.id) || []
    }

    // 4. Cattle
    const { data: existingCattle } = await supabaseAdmin.from('cattle').select('id').limit(1)
    let cattleIds: string[] = []
    if (!existingCattle?.length) {
      const { data: cattle } = await supabaseAdmin.from('cattle').insert([
        { tag_number: 'C001', name: 'Lakshmi', breed: 'Gir', cattle_type: 'cow', status: 'active', lactation_status: 'lactating', lactation_number: 3, date_of_birth: '2019-03-15' },
        { tag_number: 'C002', name: 'Gauri', breed: 'Sahiwal', cattle_type: 'cow', status: 'active', lactation_status: 'lactating', lactation_number: 2, date_of_birth: '2020-06-20' },
        { tag_number: 'C003', name: 'Nandi', breed: 'Murrah', cattle_type: 'buffalo', status: 'active', lactation_status: 'lactating', lactation_number: 4, date_of_birth: '2018-09-10' },
        { tag_number: 'C004', name: 'Kamdhenu', breed: 'HF Cross', cattle_type: 'cow', status: 'active', lactation_status: 'lactating', lactation_number: 2, date_of_birth: '2020-01-05' },
        { tag_number: 'C005', name: 'Sundari', breed: 'Gir', cattle_type: 'cow', status: 'active', lactation_status: 'dry', lactation_number: 1, date_of_birth: '2021-04-12' }
      ]).select('id')
      cattleIds = cattle?.map(c => c.id) || []
      console.log('[SETUP] Cattle created')
    } else {
      const { data: cattle } = await supabaseAdmin.from('cattle').select('id')
      cattleIds = cattle?.map(c => c.id) || []
    }

    // 5. Customers
    const { data: existingCustomers } = await supabaseAdmin.from('customers').select('id').limit(1)
    let customerIds: string[] = []
    if (!existingCustomers?.length) {
      const { data: customers } = await supabaseAdmin.from('customers').insert([
        { name: 'Sharma Family', phone: '9999000001', address: 'A-101, Gomti Nagar', area: 'Gomti Nagar', subscription_type: 'daily', billing_cycle: 'monthly', is_active: true, route_id: routeIds[0] },
        { name: 'Gupta Residence', phone: '9999000002', address: 'B-202, Aliganj', area: 'Aliganj', subscription_type: 'daily', billing_cycle: 'monthly', is_active: true, route_id: routeIds[0] },
        { name: 'Verma House', phone: '9999000003', address: 'C-303, Hazratganj', area: 'Hazratganj', subscription_type: 'weekly', billing_cycle: 'monthly', is_active: true, route_id: routeIds[1] },
        { name: 'Pandey Home', phone: '9999000004', address: 'D-404, Indira Nagar', area: 'Indira Nagar', subscription_type: 'alternate', billing_cycle: 'monthly', is_active: true, route_id: routeIds[1] },
        { name: 'Singh Bungalow', phone: '9999000005', address: 'E-505, Gomti Nagar', area: 'Gomti Nagar', subscription_type: 'daily', billing_cycle: 'monthly', is_active: true, route_id: routeIds[0] }
      ]).select('id')
      customerIds = customers?.map(c => c.id) || []
      console.log('[SETUP] Customers created')
    } else {
      const { data: customers } = await supabaseAdmin.from('customers').select('id')
      customerIds = customers?.map(c => c.id) || []
    }

    // 6. Customer Products (subscriptions)
    const { data: existingSubscriptions } = await supabaseAdmin.from('customer_products').select('id').limit(1)
    if (!existingSubscriptions?.length && customerIds.length > 0) {
      const { data: products } = await supabaseAdmin.from('products').select('id').limit(1)
      if (products?.length) {
        await supabaseAdmin.from('customer_products').insert(
          customerIds.map(cid => ({
            customer_id: cid,
            product_id: products[0].id,
            quantity: 1,
            is_active: true
          }))
        )
        console.log('[SETUP] Customer subscriptions created')
      }
    }

    // 7. Employees
    const { data: existingEmployees } = await supabaseAdmin.from('employees').select('id').limit(1)
    let employeeIds: string[] = []
    if (!existingEmployees?.length) {
      const { data: employees } = await supabaseAdmin.from('employees').insert([
        { name: 'Vijay Singh', phone: '9888000001', role: 'delivery_staff', salary: 15000, is_active: true, joining_date: '2023-01-15', address: 'Village Road, Lucknow' },
        { name: 'Meera Yadav', phone: '9888000002', role: 'farm_worker', salary: 12000, is_active: true, joining_date: '2023-03-01', address: 'Farm Colony, Lucknow' },
        { name: 'Dr. Arun Patel', phone: '9888000003', role: 'vet_staff', salary: 25000, is_active: true, joining_date: '2022-06-01', address: 'Medical Lane, Lucknow' }
      ]).select('id')
      employeeIds = employees?.map(e => e.id) || []
      console.log('[SETUP] Employees created')
    } else {
      const { data: employees } = await supabaseAdmin.from('employees').select('id')
      employeeIds = employees?.map(e => e.id) || []
    }

    // 8. Bottles
    const { data: existingBottles } = await supabaseAdmin.from('bottles').select('id').limit(1)
    if (!existingBottles?.length) {
      await supabaseAdmin.from('bottles').insert([
        { bottle_type: 'glass', size: '500ml', total_quantity: 100, available_quantity: 80, deposit_amount: 30 },
        { bottle_type: 'glass', size: '1L', total_quantity: 200, available_quantity: 150, deposit_amount: 50 },
        { bottle_type: 'plastic', size: '1L', total_quantity: 300, available_quantity: 280, deposit_amount: 20 }
      ])
      console.log('[SETUP] Bottles created')
    }

    // 9. Feed Inventory
    const { data: existingFeed } = await supabaseAdmin.from('feed_inventory').select('id').limit(1)
    if (!existingFeed?.length) {
      await supabaseAdmin.from('feed_inventory').insert([
        { name: 'Green Fodder', category: 'fodder', unit: 'kg', current_stock: 500, min_stock_level: 100, cost_per_unit: 5, supplier: 'Local Farm' },
        { name: 'Cattle Feed', category: 'concentrate', unit: 'kg', current_stock: 200, min_stock_level: 50, cost_per_unit: 35, supplier: 'Agro Mills' },
        { name: 'Mineral Mix', category: 'supplement', unit: 'kg', current_stock: 30, min_stock_level: 10, cost_per_unit: 150, supplier: 'Vet Supplies' }
      ])
      console.log('[SETUP] Feed inventory created')
    }

    // 10. Shifts
    const { data: existingShifts } = await supabaseAdmin.from('shifts').select('id').limit(1)
    if (!existingShifts?.length) {
      await supabaseAdmin.from('shifts').insert([
        { name: 'Morning Shift', start_time: '06:00', end_time: '14:00', is_active: true },
        { name: 'Evening Shift', start_time: '14:00', end_time: '22:00', is_active: true }
      ])
      console.log('[SETUP] Shifts created')
    }

    // 11. Milk Vendors
    const { data: existingVendors } = await supabaseAdmin.from('milk_vendors').select('id').limit(1)
    if (!existingVendors?.length) {
      await supabaseAdmin.from('milk_vendors').insert([
        { name: 'Ram Dairy Farm', phone: '9777000001', area: 'Outer Lucknow', is_active: true, current_balance: 0 },
        { name: 'Shyam Milk Center', phone: '9777000002', area: 'Barabanki Road', is_active: true, current_balance: 0 }
      ])
      console.log('[SETUP] Milk vendors created')
    }

    // 12. Equipment
    const { data: existingEquipment } = await supabaseAdmin.from('equipment').select('id').limit(1)
    if (!existingEquipment?.length) {
      await supabaseAdmin.from('equipment').insert([
        { name: 'Bulk Milk Chiller', category: 'cooling', model: 'BMC-500', status: 'active', purchase_date: '2022-01-15', purchase_cost: 150000, location: 'Dairy Hall' },
        { name: 'Milking Machine', category: 'milking', model: 'MM-4', status: 'active', purchase_date: '2021-06-01', purchase_cost: 45000, location: 'Milking Shed' },
        { name: 'Cream Separator', category: 'processing', model: 'CS-100', status: 'active', purchase_date: '2022-03-10', purchase_cost: 25000, location: 'Processing Room' }
      ])
      console.log('[SETUP] Equipment created')
    }

    // 13. Milk Production (7 days of data)
    const { data: existingProduction } = await supabaseAdmin.from('milk_production').select('id').limit(1)
    if (!existingProduction?.length && cattleIds.length > 0) {
      const productionRecords = []
      const today = new Date()
      
      for (let d = 0; d < 7; d++) {
        const date = new Date(today)
        date.setDate(date.getDate() - d)
        const dateStr = date.toISOString().split('T')[0]
        
        for (const cattleId of cattleIds.slice(0, 4)) { // Only lactating cattle
          productionRecords.push(
            { cattle_id: cattleId, production_date: dateStr, session: 'morning', quantity_liters: 8 + Math.random() * 4, fat_percentage: 3.5 + Math.random() * 0.5 },
            { cattle_id: cattleId, production_date: dateStr, session: 'evening', quantity_liters: 6 + Math.random() * 3, fat_percentage: 3.5 + Math.random() * 0.5 }
          )
        }
      }
      
      await supabaseAdmin.from('milk_production').insert(productionRecords)
      console.log('[SETUP] Milk production records created:', productionRecords.length)
    }

    // 14. Deliveries and Delivery Items (7 days)
    const { data: existingDeliveries } = await supabaseAdmin.from('deliveries').select('id').limit(1)
    if (!existingDeliveries?.length && customerIds.length > 0) {
      const { data: products } = await supabaseAdmin.from('products').select('id, base_price').limit(1)
      const product = products?.[0]
      
      if (product) {
        const today = new Date()
        
        for (let d = 0; d < 7; d++) {
          const date = new Date(today)
          date.setDate(date.getDate() - d)
          const dateStr = date.toISOString().split('T')[0]
          
          for (const customerId of customerIds) {
            const { data: delivery } = await supabaseAdmin.from('deliveries').insert({
              customer_id: customerId,
              delivery_date: dateStr,
              status: 'delivered',
              delivery_time: date.toISOString(),
              notes: 'Regular delivery'
            }).select('id').single()
            
            if (delivery) {
              await supabaseAdmin.from('delivery_items').insert({
                delivery_id: delivery.id,
                product_id: product.id,
                quantity: 1,
                unit_price: product.base_price,
                total_amount: product.base_price
              })
            }
          }
        }
        console.log('[SETUP] Deliveries created')
      }
    }

    // 15. Attendance (7 days)
    const { data: existingAttendance } = await supabaseAdmin.from('attendance').select('id').limit(1)
    if (!existingAttendance?.length && employeeIds.length > 0) {
      const attendanceRecords = []
      const today = new Date()
      
      for (let d = 0; d < 7; d++) {
        const date = new Date(today)
        date.setDate(date.getDate() - d)
        const dateStr = date.toISOString().split('T')[0]
        
        for (const employeeId of employeeIds) {
          attendanceRecords.push({
            employee_id: employeeId,
            attendance_date: dateStr,
            status: 'present',
            check_in: '09:00',
            check_out: '18:00'
          })
        }
      }
      
      await supabaseAdmin.from('attendance').insert(attendanceRecords)
      console.log('[SETUP] Attendance records created:', attendanceRecords.length)
    }

    console.log('[SETUP] Complete!')

    return new Response(
      JSON.stringify({
        success: true,
        message: 'External database setup complete',
        admin_id: adminUserId,
        admin_phone: PERMANENT_ADMIN_PHONE,
        data_seeded: true
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('[SETUP] Error:', error)
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Setup failed' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
