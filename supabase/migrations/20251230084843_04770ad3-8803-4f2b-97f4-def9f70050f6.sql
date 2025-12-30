-- Payroll Records table
CREATE TABLE public.payroll_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  pay_period_start DATE NOT NULL,
  pay_period_end DATE NOT NULL,
  base_salary NUMERIC NOT NULL DEFAULT 0,
  overtime_hours NUMERIC DEFAULT 0,
  overtime_rate NUMERIC DEFAULT 0,
  bonus NUMERIC DEFAULT 0,
  deductions NUMERIC DEFAULT 0,
  net_salary NUMERIC NOT NULL DEFAULT 0,
  payment_status TEXT DEFAULT 'pending',
  payment_date DATE,
  payment_mode TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID
);

-- Shifts table
CREATE TABLE public.shifts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Employee Shifts assignment
CREATE TABLE public.employee_shifts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  shift_id UUID NOT NULL REFERENCES public.shifts(id) ON DELETE CASCADE,
  effective_from DATE NOT NULL,
  effective_to DATE,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Breeding Records table
CREATE TABLE public.breeding_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cattle_id UUID NOT NULL REFERENCES public.cattle(id) ON DELETE CASCADE,
  record_type TEXT NOT NULL, -- heat_detection, artificial_insemination, pregnancy_check, calving
  record_date DATE NOT NULL,
  heat_cycle_day INTEGER,
  insemination_bull TEXT,
  insemination_technician TEXT,
  pregnancy_confirmed BOOLEAN,
  expected_calving_date DATE,
  actual_calving_date DATE,
  calf_details JSONB,
  notes TEXT,
  recorded_by UUID,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Route Stops table
CREATE TABLE public.route_stops (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  route_id UUID NOT NULL REFERENCES public.routes(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  stop_order INTEGER NOT NULL,
  estimated_arrival_time TIME,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Price Rules table (Quality-based pricing)
CREATE TABLE public.price_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  product_id UUID REFERENCES public.products(id) ON DELETE CASCADE,
  min_fat_percentage NUMERIC,
  max_fat_percentage NUMERIC,
  min_snf_percentage NUMERIC,
  max_snf_percentage NUMERIC,
  price_adjustment NUMERIC NOT NULL DEFAULT 0, -- per liter adjustment
  adjustment_type TEXT DEFAULT 'fixed', -- fixed or percentage
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Equipment table
CREATE TABLE public.equipment (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  model TEXT,
  serial_number TEXT,
  purchase_date DATE,
  purchase_cost NUMERIC,
  warranty_expiry DATE,
  status TEXT DEFAULT 'active', -- active, under_maintenance, retired
  location TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Maintenance Records table
CREATE TABLE public.maintenance_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  equipment_id UUID NOT NULL REFERENCES public.equipment(id) ON DELETE CASCADE,
  maintenance_type TEXT NOT NULL, -- scheduled, repair, inspection
  maintenance_date DATE NOT NULL,
  description TEXT,
  cost NUMERIC DEFAULT 0,
  performed_by TEXT,
  next_maintenance_date DATE,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Notification Templates table
CREATE TABLE public.notification_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  template_type TEXT NOT NULL, -- payment_reminder, delivery_alert, health_alert, inventory_alert
  channel TEXT NOT NULL, -- sms, whatsapp, email
  subject TEXT,
  body TEXT NOT NULL,
  variables JSONB DEFAULT '[]',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Notification Logs table
CREATE TABLE public.notification_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID REFERENCES public.notification_templates(id),
  recipient_type TEXT NOT NULL, -- customer, employee
  recipient_id UUID NOT NULL,
  recipient_contact TEXT,
  channel TEXT NOT NULL,
  subject TEXT,
  body TEXT NOT NULL,
  status TEXT DEFAULT 'pending', -- pending, sent, failed
  sent_at TIMESTAMPTZ,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS on all new tables
ALTER TABLE public.payroll_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shifts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employee_shifts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.breeding_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.route_stops ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.price_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.equipment ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.maintenance_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies for payroll_records
CREATE POLICY "Managers and admins have full access to payroll_records" ON public.payroll_records FOR ALL USING (is_manager_or_admin(auth.uid()));
CREATE POLICY "Accountants can manage payroll_records" ON public.payroll_records FOR ALL USING (has_role(auth.uid(), 'accountant'));
CREATE POLICY "Auditors can read payroll_records" ON public.payroll_records FOR SELECT USING (has_role(auth.uid(), 'auditor'));

-- RLS Policies for shifts
CREATE POLICY "Managers and admins have full access to shifts" ON public.shifts FOR ALL USING (is_manager_or_admin(auth.uid()));
CREATE POLICY "Staff can read shifts" ON public.shifts FOR SELECT USING (is_authenticated());

-- RLS Policies for employee_shifts
CREATE POLICY "Managers and admins have full access to employee_shifts" ON public.employee_shifts FOR ALL USING (is_manager_or_admin(auth.uid()));
CREATE POLICY "Staff can read employee_shifts" ON public.employee_shifts FOR SELECT USING (is_authenticated());

-- RLS Policies for breeding_records
CREATE POLICY "Managers and admins have full access to breeding_records" ON public.breeding_records FOR ALL USING (is_manager_or_admin(auth.uid()));
CREATE POLICY "Farm workers can manage breeding_records" ON public.breeding_records FOR ALL USING (has_role(auth.uid(), 'farm_worker'));
CREATE POLICY "Vet staff can manage breeding_records" ON public.breeding_records FOR ALL USING (has_role(auth.uid(), 'vet_staff'));
CREATE POLICY "Auditors can read breeding_records" ON public.breeding_records FOR SELECT USING (has_role(auth.uid(), 'auditor'));

-- RLS Policies for route_stops
CREATE POLICY "Managers and admins have full access to route_stops" ON public.route_stops FOR ALL USING (is_manager_or_admin(auth.uid()));
CREATE POLICY "Delivery staff can read route_stops" ON public.route_stops FOR SELECT USING (has_role(auth.uid(), 'delivery_staff'));

-- RLS Policies for price_rules
CREATE POLICY "Managers and admins have full access to price_rules" ON public.price_rules FOR ALL USING (is_manager_or_admin(auth.uid()));
CREATE POLICY "Staff can read price_rules" ON public.price_rules FOR SELECT USING (is_authenticated());

-- RLS Policies for equipment
CREATE POLICY "Managers and admins have full access to equipment" ON public.equipment FOR ALL USING (is_manager_or_admin(auth.uid()));
CREATE POLICY "Staff can read equipment" ON public.equipment FOR SELECT USING (is_authenticated());

-- RLS Policies for maintenance_records
CREATE POLICY "Managers and admins have full access to maintenance_records" ON public.maintenance_records FOR ALL USING (is_manager_or_admin(auth.uid()));
CREATE POLICY "Farm workers can manage maintenance_records" ON public.maintenance_records FOR ALL USING (has_role(auth.uid(), 'farm_worker'));
CREATE POLICY "Auditors can read maintenance_records" ON public.maintenance_records FOR SELECT USING (has_role(auth.uid(), 'auditor'));

-- RLS Policies for notification_templates
CREATE POLICY "Managers and admins have full access to notification_templates" ON public.notification_templates FOR ALL USING (is_manager_or_admin(auth.uid()));
CREATE POLICY "Staff can read notification_templates" ON public.notification_templates FOR SELECT USING (is_authenticated());

-- RLS Policies for notification_logs
CREATE POLICY "Managers and admins have full access to notification_logs" ON public.notification_logs FOR ALL USING (is_manager_or_admin(auth.uid()));
CREATE POLICY "Staff can read notification_logs" ON public.notification_logs FOR SELECT USING (is_authenticated());

-- Insert default shifts
INSERT INTO public.shifts (name, start_time, end_time) VALUES 
  ('Morning Shift', '05:00', '13:00'),
  ('Evening Shift', '13:00', '21:00'),
  ('Night Shift', '21:00', '05:00');

-- Insert default notification templates
INSERT INTO public.notification_templates (name, template_type, channel, subject, body, variables) VALUES 
  ('Payment Reminder', 'payment_reminder', 'sms', NULL, 'Dear {{customer_name}}, your payment of ₹{{amount}} is due on {{due_date}}. Please pay to avoid service interruption.', '["customer_name", "amount", "due_date"]'),
  ('Delivery Confirmation', 'delivery_alert', 'whatsapp', NULL, 'Hi {{customer_name}}, your {{product_name}} ({{quantity}}) has been delivered. Thank you!', '["customer_name", "product_name", "quantity"]'),
  ('Health Alert', 'health_alert', 'sms', NULL, 'Alert: Cattle {{tag_number}} - {{health_issue}}. Next checkup: {{next_date}}.', '["tag_number", "health_issue", "next_date"]'),
  ('Low Stock Alert', 'inventory_alert', 'sms', NULL, 'Stock Alert: {{item_name}} is running low. Current stock: {{current_stock}} {{unit}}. Minimum: {{min_stock}} {{unit}}.', '["item_name", "current_stock", "min_stock", "unit"]');