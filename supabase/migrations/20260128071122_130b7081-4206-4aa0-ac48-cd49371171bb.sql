-- =====================================================
-- Seed Dummy Data for Awadh Dairy (final corrected version)
-- =====================================================

-- Drop and recreate views
DROP VIEW IF EXISTS public.profiles_safe CASCADE;
DROP VIEW IF EXISTS public.customer_accounts_safe CASCADE;
DROP VIEW IF EXISTS public.customers_delivery_view CASCADE;
DROP VIEW IF EXISTS public.employees_auditor_view CASCADE;
DROP VIEW IF EXISTS public.dairy_settings_public CASCADE;

-- 6.1 Dairy Settings
INSERT INTO public.dairy_settings (dairy_name, address, phone, email, currency, invoice_prefix, upi_handle)
SELECT 'Awadh Dairy Farm', '123 Farm Road, Lucknow, UP 226001', '9876543210', 'contact@awadhdairy.com', 'INR', 'AWD', 'awadhdairy@upi'
WHERE NOT EXISTS (SELECT 1 FROM public.dairy_settings LIMIT 1);

-- 6.2 Products
INSERT INTO public.products (name, category, unit, base_price)
SELECT 'Full Cream Milk', 'milk', 'liter', 70
WHERE NOT EXISTS (SELECT 1 FROM public.products WHERE name = 'Full Cream Milk');

INSERT INTO public.products (name, category, unit, base_price)
SELECT 'Toned Milk', 'milk', 'liter', 55
WHERE NOT EXISTS (SELECT 1 FROM public.products WHERE name = 'Toned Milk');

INSERT INTO public.products (name, category, unit, base_price)
SELECT 'Curd', 'curd', 'kg', 80
WHERE NOT EXISTS (SELECT 1 FROM public.products WHERE name = 'Curd');

INSERT INTO public.products (name, category, unit, base_price)
SELECT 'Paneer', 'paneer', 'kg', 350
WHERE NOT EXISTS (SELECT 1 FROM public.products WHERE name = 'Paneer');

INSERT INTO public.products (name, category, unit, base_price)
SELECT 'Ghee', 'ghee', 'kg', 600
WHERE NOT EXISTS (SELECT 1 FROM public.products WHERE name = 'Ghee');

-- 6.3 Routes
INSERT INTO public.routes (name, area, is_active)
SELECT 'Route A - Morning', 'Gomti Nagar, Aliganj', true
WHERE NOT EXISTS (SELECT 1 FROM public.routes WHERE name = 'Route A - Morning');

INSERT INTO public.routes (name, area, is_active)
SELECT 'Route B - Evening', 'Hazratganj, Indira Nagar', true
WHERE NOT EXISTS (SELECT 1 FROM public.routes WHERE name = 'Route B - Evening');

-- 6.4 Cattle
INSERT INTO public.cattle (tag_number, name, breed, cattle_type, status, lactation_status, date_of_birth, weight)
SELECT 'C001', 'Lakshmi', 'Gir', 'cow', 'active', 'lactating', '2020-03-15', 450
WHERE NOT EXISTS (SELECT 1 FROM public.cattle WHERE tag_number = 'C001');

INSERT INTO public.cattle (tag_number, name, breed, cattle_type, status, lactation_status, date_of_birth, weight)
SELECT 'C002', 'Gauri', 'Sahiwal', 'cow', 'active', 'lactating', '2019-07-22', 480
WHERE NOT EXISTS (SELECT 1 FROM public.cattle WHERE tag_number = 'C002');

INSERT INTO public.cattle (tag_number, name, breed, cattle_type, status, lactation_status, date_of_birth, weight)
SELECT 'C003', 'Nandi', 'Murrah', 'buffalo', 'active', 'lactating', '2018-11-10', 550
WHERE NOT EXISTS (SELECT 1 FROM public.cattle WHERE tag_number = 'C003');

INSERT INTO public.cattle (tag_number, name, breed, cattle_type, status, lactation_status, date_of_birth, weight)
SELECT 'C004', 'Kamdhenu', 'HF Cross', 'cow', 'active', 'lactating', '2021-01-05', 500
WHERE NOT EXISTS (SELECT 1 FROM public.cattle WHERE tag_number = 'C004');

INSERT INTO public.cattle (tag_number, name, breed, cattle_type, status, lactation_status, date_of_birth, weight)
SELECT 'C005', 'Sundari', 'Gir', 'cow', 'dry', 'dry', '2017-05-20', 420
WHERE NOT EXISTS (SELECT 1 FROM public.cattle WHERE tag_number = 'C005');

-- 6.5 Customers
DO $$
DECLARE
  route_a_id uuid;
  route_b_id uuid;
BEGIN
  SELECT id INTO route_a_id FROM public.routes WHERE name LIKE 'Route A%' LIMIT 1;
  SELECT id INTO route_b_id FROM public.routes WHERE name LIKE 'Route B%' LIMIT 1;
  
  IF NOT EXISTS (SELECT 1 FROM public.customers WHERE phone = '9876543001') THEN
    INSERT INTO public.customers (name, phone, address, area, route_id, subscription_type, billing_cycle) 
    VALUES ('Ramesh Kumar', '9876543001', '45 Gomti Nagar, Lucknow', 'Gomti Nagar', route_a_id, 'daily', 'monthly');
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM public.customers WHERE phone = '9876543002') THEN
    INSERT INTO public.customers (name, phone, address, area, route_id, subscription_type, billing_cycle) 
    VALUES ('Priya Sharma', '9876543002', '78 Aliganj, Lucknow', 'Aliganj', route_a_id, 'daily', 'monthly');
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM public.customers WHERE phone = '9876543003') THEN
    INSERT INTO public.customers (name, phone, address, area, route_id, subscription_type, billing_cycle) 
    VALUES ('Amit Verma', '9876543003', '12 Hazratganj, Lucknow', 'Hazratganj', route_b_id, 'alternate', 'weekly');
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM public.customers WHERE phone = '9876543004') THEN
    INSERT INTO public.customers (name, phone, address, area, route_id, subscription_type, billing_cycle) 
    VALUES ('Sunita Devi', '9876543004', '34 Indira Nagar, Lucknow', 'Indira Nagar', route_b_id, 'weekly', 'monthly');
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM public.customers WHERE phone = '9876543005') THEN
    INSERT INTO public.customers (name, phone, address, area, route_id, subscription_type, billing_cycle) 
    VALUES ('Rajesh Gupta', '9876543005', '56 Mahanagar, Lucknow', 'Mahanagar', NULL, 'daily', 'monthly');
  END IF;
END $$;

-- 6.6 Customer subscriptions
DO $$
DECLARE
  cust RECORD;
  prod_milk uuid;
  prod_curd uuid;
BEGIN
  SELECT id INTO prod_milk FROM public.products WHERE name = 'Full Cream Milk' LIMIT 1;
  SELECT id INTO prod_curd FROM public.products WHERE name = 'Curd' LIMIT 1;
  
  IF prod_milk IS NOT NULL THEN
    FOR cust IN SELECT id FROM public.customers LOOP
      IF NOT EXISTS (SELECT 1 FROM public.customer_products WHERE customer_id = cust.id AND product_id = prod_milk) THEN
        INSERT INTO public.customer_products (customer_id, product_id, quantity, is_active)
        VALUES (cust.id, prod_milk, 1, true);
      END IF;
    END LOOP;
  END IF;
END $$;

-- 6.7 Employees
INSERT INTO public.employees (name, phone, role, salary, joining_date, is_active)
SELECT 'Vijay Singh', '9876543101', 'delivery_staff', 15000, '2023-01-15', true
WHERE NOT EXISTS (SELECT 1 FROM public.employees WHERE phone = '9876543101');

INSERT INTO public.employees (name, phone, role, salary, joining_date, is_active)
SELECT 'Meera Yadav', '9876543102', 'farm_worker', 12000, '2022-06-01', true
WHERE NOT EXISTS (SELECT 1 FROM public.employees WHERE phone = '9876543102');

INSERT INTO public.employees (name, phone, role, salary, joining_date, is_active)
SELECT 'Dr. Arun Patel', '9876543103', 'vet_staff', 25000, '2021-03-10', true
WHERE NOT EXISTS (SELECT 1 FROM public.employees WHERE phone = '9876543103');

-- 6.8 Bottles
INSERT INTO public.bottles (bottle_type, size, total_quantity, available_quantity, deposit_amount)
SELECT 'glass', '500ml', 200, 180, 20
WHERE NOT EXISTS (SELECT 1 FROM public.bottles WHERE bottle_type = 'glass' AND size = '500ml');

INSERT INTO public.bottles (bottle_type, size, total_quantity, available_quantity, deposit_amount)
SELECT 'glass', '1L', 300, 270, 30
WHERE NOT EXISTS (SELECT 1 FROM public.bottles WHERE bottle_type = 'glass' AND size = '1L');

INSERT INTO public.bottles (bottle_type, size, total_quantity, available_quantity, deposit_amount)
SELECT 'plastic', '1L', 150, 140, 15
WHERE NOT EXISTS (SELECT 1 FROM public.bottles WHERE bottle_type = 'plastic' AND size = '1L');

-- 6.9 Feed Inventory
INSERT INTO public.feed_inventory (name, category, unit, current_stock, min_stock_level, cost_per_unit)
SELECT 'Green Fodder', 'green_fodder', 'kg', 500, 100, 5
WHERE NOT EXISTS (SELECT 1 FROM public.feed_inventory WHERE name = 'Green Fodder');

INSERT INTO public.feed_inventory (name, category, unit, current_stock, min_stock_level, cost_per_unit)
SELECT 'Cattle Feed', 'concentrate', 'kg', 200, 50, 25
WHERE NOT EXISTS (SELECT 1 FROM public.feed_inventory WHERE name = 'Cattle Feed');

INSERT INTO public.feed_inventory (name, category, unit, current_stock, min_stock_level, cost_per_unit)
SELECT 'Mineral Mix', 'supplement', 'kg', 50, 10, 150
WHERE NOT EXISTS (SELECT 1 FROM public.feed_inventory WHERE name = 'Mineral Mix');

-- 6.10 Shifts
INSERT INTO public.shifts (name, start_time, end_time, is_active)
SELECT 'Morning Shift', '05:00', '13:00', true
WHERE NOT EXISTS (SELECT 1 FROM public.shifts WHERE name = 'Morning Shift');

INSERT INTO public.shifts (name, start_time, end_time, is_active)
SELECT 'Evening Shift', '13:00', '21:00', true
WHERE NOT EXISTS (SELECT 1 FROM public.shifts WHERE name = 'Evening Shift');

-- 6.11 Milk Vendors
INSERT INTO public.milk_vendors (name, phone, address, area, current_balance, is_active)
SELECT 'Sharma Dairy Farm', '9876543201', 'Village Kakori, Lucknow', 'Kakori', 0, true
WHERE NOT EXISTS (SELECT 1 FROM public.milk_vendors WHERE phone = '9876543201');

INSERT INTO public.milk_vendors (name, phone, address, area, current_balance, is_active)
SELECT 'Verma Cattle Farm', '9876543202', 'Village Malihabad, Lucknow', 'Malihabad', 0, true
WHERE NOT EXISTS (SELECT 1 FROM public.milk_vendors WHERE phone = '9876543202');

-- 6.12 Equipment
INSERT INTO public.equipment (name, category, model, status, purchase_date, purchase_cost)
SELECT 'Milk Chiller 500L', 'storage', 'MC-500', 'operational', '2022-01-15', 75000
WHERE NOT EXISTS (SELECT 1 FROM public.equipment WHERE name = 'Milk Chiller 500L');

INSERT INTO public.equipment (name, category, model, status, purchase_date, purchase_cost)
SELECT 'Milking Machine', 'milking', 'MM-200', 'operational', '2021-06-20', 45000
WHERE NOT EXISTS (SELECT 1 FROM public.equipment WHERE name = 'Milking Machine');

INSERT INTO public.equipment (name, category, model, status, purchase_date, purchase_cost)
SELECT 'Cream Separator', 'processing', 'CS-100', 'operational', '2023-03-10', 25000
WHERE NOT EXISTS (SELECT 1 FROM public.equipment WHERE name = 'Cream Separator');

-- 6.13 Sample Milk Production (last 7 days)
DO $$
DECLARE
  cattle_rec RECORD;
  prod_date date;
  i integer;
BEGIN
  FOR cattle_rec IN SELECT id FROM public.cattle WHERE status = 'active' LOOP
    FOR i IN 0..6 LOOP
      prod_date := CURRENT_DATE - i;
      
      IF NOT EXISTS (SELECT 1 FROM public.milk_production WHERE cattle_id = cattle_rec.id AND production_date = prod_date AND session = 'morning') THEN
        INSERT INTO public.milk_production (cattle_id, production_date, session, quantity_liters, fat_percentage, snf_percentage)
        VALUES (cattle_rec.id, prod_date, 'morning', 4 + random() * 4, 3.5 + random() * 2, 8.0 + random() * 1.5);
      END IF;
      
      IF NOT EXISTS (SELECT 1 FROM public.milk_production WHERE cattle_id = cattle_rec.id AND production_date = prod_date AND session = 'evening') THEN
        INSERT INTO public.milk_production (cattle_id, production_date, session, quantity_liters, fat_percentage, snf_percentage)
        VALUES (cattle_rec.id, prod_date, 'evening', 3.5 + random() * 3.5, 3.5 + random() * 2, 8.0 + random() * 1.5);
      END IF;
    END LOOP;
  END LOOP;
END $$;

-- 6.14 Sample Deliveries (last 7 days)
DO $$
DECLARE
  cust RECORD;
  del_date date;
  del_id uuid;
  prod_rec RECORD;
  i integer;
  status_val text;
BEGIN
  FOR cust IN SELECT c.id, c.subscription_type FROM public.customers c WHERE c.is_active = true LOOP
    FOR i IN 0..6 LOOP
      del_date := CURRENT_DATE - i;
      
      IF cust.subscription_type = 'alternate' AND i % 2 = 1 THEN
        CONTINUE;
      END IF;
      IF cust.subscription_type = 'weekly' AND i > 0 THEN
        CONTINUE;
      END IF;
      
      IF NOT EXISTS (SELECT 1 FROM public.deliveries WHERE customer_id = cust.id AND delivery_date = del_date) THEN
        IF i > 1 THEN
          status_val := 'delivered';
        ELSIF random() > 0.2 THEN
          status_val := 'delivered';
        ELSE
          status_val := 'pending';
        END IF;
        
        INSERT INTO public.deliveries (customer_id, delivery_date, status, notes)
        VALUES (cust.id, del_date, status_val::public.delivery_status, 'Auto-generated sample')
        RETURNING id INTO del_id;
        
        IF del_id IS NOT NULL THEN
          FOR prod_rec IN 
            SELECT cp.product_id, cp.quantity, COALESCE(cp.custom_price, p.base_price) as price
            FROM public.customer_products cp
            JOIN public.products p ON p.id = cp.product_id
            WHERE cp.customer_id = cust.id AND cp.is_active = true
          LOOP
            INSERT INTO public.delivery_items (delivery_id, product_id, quantity, unit_price, total_amount)
            VALUES (del_id, prod_rec.product_id, prod_rec.quantity, prod_rec.price, prod_rec.quantity * prod_rec.price);
          END LOOP;
        END IF;
      END IF;
    END LOOP;
  END LOOP;
END $$;

-- 6.15 Sample Attendance (last 7 days)
DO $$
DECLARE
  emp RECORD;
  att_date date;
  i integer;
BEGIN
  FOR emp IN SELECT id FROM public.employees WHERE is_active = true LOOP
    FOR i IN 0..6 LOOP
      att_date := CURRENT_DATE - i;
      IF NOT EXISTS (SELECT 1 FROM public.attendance WHERE employee_id = emp.id AND attendance_date = att_date) THEN
        INSERT INTO public.attendance (employee_id, attendance_date, status, check_in, check_out)
        VALUES (emp.id, att_date, 'present', '09:00', '18:00');
      END IF;
    END LOOP;
  END LOOP;
END $$;

-- 6.16 Sample Milk Procurement (last 7 days)
DO $$
DECLARE
  vendor_rec RECORD;
  proc_date date;
  i integer;
  qty numeric;
  rate numeric;
BEGIN
  FOR vendor_rec IN SELECT id, name FROM public.milk_vendors WHERE is_active = true LOOP
    FOR i IN 0..6 LOOP
      proc_date := CURRENT_DATE - i;
      qty := 50 + random() * 100;
      rate := 45 + random() * 10;
      
      IF NOT EXISTS (SELECT 1 FROM public.milk_procurement WHERE vendor_id = vendor_rec.id AND procurement_date = proc_date) THEN
        INSERT INTO public.milk_procurement (vendor_id, vendor_name, procurement_date, session, quantity_liters, rate_per_liter, total_amount, fat_percentage, snf_percentage, payment_status)
        VALUES (vendor_rec.id, vendor_rec.name, proc_date, 'morning', qty, rate, qty * rate, 4.0 + random() * 2, 8.0 + random() * 1, 'pending');
      END IF;
    END LOOP;
  END LOOP;
END $$;

-- =====================================================
-- Recreate Views
-- =====================================================

CREATE OR REPLACE VIEW public.profiles_safe AS
SELECT id, full_name, phone, role, is_active, created_at, updated_at
FROM public.profiles;

CREATE OR REPLACE VIEW public.customer_accounts_safe AS
SELECT id, customer_id, phone, is_approved, approval_status, last_login, created_at
FROM public.customer_accounts;

CREATE OR REPLACE VIEW public.customers_delivery_view AS
SELECT c.id, c.name, c.phone, c.address, c.area, c.route_id, c.subscription_type
FROM public.customers c
WHERE c.is_active = true;

CREATE OR REPLACE VIEW public.employees_auditor_view AS
SELECT id, user_id, name, phone, role, joining_date, is_active, created_at
FROM public.employees;

CREATE OR REPLACE VIEW public.dairy_settings_public AS
SELECT dairy_name, address, phone, email, logo_url, currency, invoice_prefix
FROM public.dairy_settings
LIMIT 1;