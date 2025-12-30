-- Create enums for roles and statuses
CREATE TYPE public.user_role AS ENUM ('super_admin', 'manager', 'accountant', 'delivery_staff', 'farm_worker', 'vet_staff', 'auditor');
CREATE TYPE public.cattle_status AS ENUM ('active', 'sold', 'deceased', 'dry');
CREATE TYPE public.lactation_status AS ENUM ('lactating', 'dry', 'pregnant', 'calving');
CREATE TYPE public.delivery_status AS ENUM ('pending', 'delivered', 'missed', 'partial');
CREATE TYPE public.payment_status AS ENUM ('paid', 'partial', 'pending', 'overdue');
CREATE TYPE public.bottle_type AS ENUM ('glass', 'plastic');
CREATE TYPE public.bottle_size AS ENUM ('500ml', '1L', '2L');

-- Profiles table for user management
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  phone TEXT,
  role user_role NOT NULL DEFAULT 'farm_worker',
  avatar_url TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- User roles table for role-based access
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role user_role NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, role)
);

-- Cattle table for animal management
CREATE TABLE public.cattle (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tag_number TEXT NOT NULL UNIQUE,
  name TEXT,
  breed TEXT NOT NULL,
  cattle_type TEXT NOT NULL DEFAULT 'cow', -- cow, buffalo
  date_of_birth DATE,
  purchase_date DATE,
  purchase_cost DECIMAL(10,2),
  weight DECIMAL(6,2),
  status cattle_status DEFAULT 'active',
  lactation_status lactation_status DEFAULT 'dry',
  lactation_number INTEGER DEFAULT 0,
  last_calving_date DATE,
  expected_calving_date DATE,
  notes TEXT,
  image_url TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Milk production records
CREATE TABLE public.milk_production (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cattle_id UUID REFERENCES public.cattle(id) ON DELETE CASCADE NOT NULL,
  production_date DATE NOT NULL,
  session TEXT NOT NULL CHECK (session IN ('morning', 'evening')),
  quantity_liters DECIMAL(6,2) NOT NULL,
  fat_percentage DECIMAL(4,2),
  snf_percentage DECIMAL(4,2),
  quality_notes TEXT,
  recorded_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(cattle_id, production_date, session)
);

-- Products table
CREATE TABLE public.products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  category TEXT NOT NULL, -- milk, curd, paneer, ghee, butter, other
  unit TEXT NOT NULL DEFAULT 'liter',
  base_price DECIMAL(10,2) NOT NULL,
  tax_percentage DECIMAL(4,2) DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  description TEXT,
  image_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Customers table
CREATE TABLE public.customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  address TEXT,
  area TEXT,
  route_id UUID,
  subscription_type TEXT DEFAULT 'daily', -- daily, alternate, weekly, custom
  billing_cycle TEXT DEFAULT 'monthly', -- daily, weekly, monthly
  credit_balance DECIMAL(10,2) DEFAULT 0,
  advance_balance DECIMAL(10,2) DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Customer product preferences
CREATE TABLE public.customer_products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID REFERENCES public.customers(id) ON DELETE CASCADE NOT NULL,
  product_id UUID REFERENCES public.products(id) ON DELETE CASCADE NOT NULL,
  quantity DECIMAL(6,2) NOT NULL,
  custom_price DECIMAL(10,2), -- null means use base price
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(customer_id, product_id)
);

-- Delivery routes
CREATE TABLE public.routes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  area TEXT,
  assigned_staff UUID REFERENCES auth.users(id),
  sequence_order INTEGER,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add route reference to customers
ALTER TABLE public.customers 
ADD CONSTRAINT fk_customer_route 
FOREIGN KEY (route_id) REFERENCES public.routes(id) ON DELETE SET NULL;

-- Deliveries table
CREATE TABLE public.deliveries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID REFERENCES public.customers(id) ON DELETE CASCADE NOT NULL,
  delivery_date DATE NOT NULL,
  status delivery_status DEFAULT 'pending',
  delivered_by UUID REFERENCES auth.users(id),
  delivery_time TIMESTAMP WITH TIME ZONE,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Delivery items
CREATE TABLE public.delivery_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  delivery_id UUID REFERENCES public.deliveries(id) ON DELETE CASCADE NOT NULL,
  product_id UUID REFERENCES public.products(id) NOT NULL,
  quantity DECIMAL(6,2) NOT NULL,
  unit_price DECIMAL(10,2) NOT NULL,
  total_amount DECIMAL(10,2) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Invoices table
CREATE TABLE public.invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_number TEXT NOT NULL UNIQUE,
  customer_id UUID REFERENCES public.customers(id) ON DELETE CASCADE NOT NULL,
  billing_period_start DATE NOT NULL,
  billing_period_end DATE NOT NULL,
  total_amount DECIMAL(10,2) NOT NULL,
  tax_amount DECIMAL(10,2) DEFAULT 0,
  discount_amount DECIMAL(10,2) DEFAULT 0,
  final_amount DECIMAL(10,2) NOT NULL,
  payment_status payment_status DEFAULT 'pending',
  due_date DATE,
  paid_amount DECIMAL(10,2) DEFAULT 0,
  payment_date DATE,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Payments table
CREATE TABLE public.payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID REFERENCES public.invoices(id) ON DELETE CASCADE,
  customer_id UUID REFERENCES public.customers(id) ON DELETE CASCADE NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  payment_mode TEXT NOT NULL, -- cash, upi, bank_transfer, wallet
  payment_date DATE NOT NULL,
  reference_number TEXT,
  notes TEXT,
  recorded_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Bottle inventory
CREATE TABLE public.bottles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bottle_type bottle_type NOT NULL,
  size bottle_size NOT NULL,
  total_quantity INTEGER NOT NULL DEFAULT 0,
  available_quantity INTEGER NOT NULL DEFAULT 0,
  deposit_amount DECIMAL(6,2) DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(bottle_type, size)
);

-- Customer bottle balance
CREATE TABLE public.customer_bottles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID REFERENCES public.customers(id) ON DELETE CASCADE NOT NULL,
  bottle_id UUID REFERENCES public.bottles(id) ON DELETE CASCADE NOT NULL,
  quantity_pending INTEGER DEFAULT 0,
  last_issued_date DATE,
  last_returned_date DATE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(customer_id, bottle_id)
);

-- Bottle transactions
CREATE TABLE public.bottle_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bottle_id UUID REFERENCES public.bottles(id) ON DELETE CASCADE NOT NULL,
  customer_id UUID REFERENCES public.customers(id) ON DELETE CASCADE,
  staff_id UUID REFERENCES auth.users(id),
  transaction_type TEXT NOT NULL, -- issued, returned, damaged, lost
  quantity INTEGER NOT NULL,
  transaction_date DATE NOT NULL,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Cattle health records
CREATE TABLE public.cattle_health (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cattle_id UUID REFERENCES public.cattle(id) ON DELETE CASCADE NOT NULL,
  record_date DATE NOT NULL,
  record_type TEXT NOT NULL, -- vaccination, treatment, checkup, disease
  title TEXT NOT NULL,
  description TEXT,
  vet_name TEXT,
  cost DECIMAL(10,2),
  next_due_date DATE,
  recorded_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Feed/Fodder inventory
CREATE TABLE public.feed_inventory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  category TEXT NOT NULL, -- green_fodder, dry_fodder, concentrate, supplement, medicine
  unit TEXT NOT NULL DEFAULT 'kg',
  current_stock DECIMAL(10,2) DEFAULT 0,
  min_stock_level DECIMAL(10,2) DEFAULT 0,
  cost_per_unit DECIMAL(10,2),
  supplier TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Feed consumption records
CREATE TABLE public.feed_consumption (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  feed_id UUID REFERENCES public.feed_inventory(id) ON DELETE CASCADE NOT NULL,
  cattle_id UUID REFERENCES public.cattle(id) ON DELETE SET NULL,
  consumption_date DATE NOT NULL,
  quantity DECIMAL(10,2) NOT NULL,
  recorded_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Expenses table
CREATE TABLE public.expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category TEXT NOT NULL, -- feed, medicine, salary, transport, electricity, maintenance, misc
  title TEXT NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  expense_date DATE NOT NULL,
  cattle_id UUID REFERENCES public.cattle(id) ON DELETE SET NULL,
  notes TEXT,
  receipt_url TEXT,
  recorded_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Employees table
CREATE TABLE public.employees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  phone TEXT,
  address TEXT,
  role user_role NOT NULL,
  salary DECIMAL(10,2),
  joining_date DATE,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Employee attendance
CREATE TABLE public.attendance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID REFERENCES public.employees(id) ON DELETE CASCADE NOT NULL,
  attendance_date DATE NOT NULL,
  check_in TIME,
  check_out TIME,
  status TEXT DEFAULT 'present', -- present, absent, half_day, leave
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(employee_id, attendance_date)
);

-- Activity logs for audit
CREATE TABLE public.activity_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id UUID,
  details JSONB,
  ip_address TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Dairy settings
CREATE TABLE public.dairy_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dairy_name TEXT NOT NULL DEFAULT 'My Dairy',
  logo_url TEXT,
  address TEXT,
  phone TEXT,
  email TEXT,
  currency TEXT DEFAULT 'INR',
  financial_year_start INTEGER DEFAULT 4, -- April
  invoice_prefix TEXT DEFAULT 'INV',
  settings JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cattle ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.milk_production ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.routes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deliveries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.delivery_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bottles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_bottles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bottle_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cattle_health ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.feed_inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.feed_consumption ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dairy_settings ENABLE ROW LEVEL SECURITY;

-- Security definer function to check user role
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role user_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- Function to check if user has any authenticated role
CREATE OR REPLACE FUNCTION public.is_authenticated()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT auth.uid() IS NOT NULL
$$;

-- Create RLS policies for profiles
CREATE POLICY "Users can view their own profile" ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update their own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Authenticated users can view all profiles" ON public.profiles FOR SELECT USING (public.is_authenticated());

-- Create RLS policies for user_roles
CREATE POLICY "Users can view their own roles" ON public.user_roles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Admins can manage roles" ON public.user_roles FOR ALL USING (public.has_role(auth.uid(), 'super_admin'));

-- Create permissive policies for authenticated users on operational tables
CREATE POLICY "Authenticated users can access cattle" ON public.cattle FOR ALL USING (public.is_authenticated());
CREATE POLICY "Authenticated users can access milk_production" ON public.milk_production FOR ALL USING (public.is_authenticated());
CREATE POLICY "Authenticated users can access products" ON public.products FOR ALL USING (public.is_authenticated());
CREATE POLICY "Authenticated users can access customers" ON public.customers FOR ALL USING (public.is_authenticated());
CREATE POLICY "Authenticated users can access customer_products" ON public.customer_products FOR ALL USING (public.is_authenticated());
CREATE POLICY "Authenticated users can access routes" ON public.routes FOR ALL USING (public.is_authenticated());
CREATE POLICY "Authenticated users can access deliveries" ON public.deliveries FOR ALL USING (public.is_authenticated());
CREATE POLICY "Authenticated users can access delivery_items" ON public.delivery_items FOR ALL USING (public.is_authenticated());
CREATE POLICY "Authenticated users can access invoices" ON public.invoices FOR ALL USING (public.is_authenticated());
CREATE POLICY "Authenticated users can access payments" ON public.payments FOR ALL USING (public.is_authenticated());
CREATE POLICY "Authenticated users can access bottles" ON public.bottles FOR ALL USING (public.is_authenticated());
CREATE POLICY "Authenticated users can access customer_bottles" ON public.customer_bottles FOR ALL USING (public.is_authenticated());
CREATE POLICY "Authenticated users can access bottle_transactions" ON public.bottle_transactions FOR ALL USING (public.is_authenticated());
CREATE POLICY "Authenticated users can access cattle_health" ON public.cattle_health FOR ALL USING (public.is_authenticated());
CREATE POLICY "Authenticated users can access feed_inventory" ON public.feed_inventory FOR ALL USING (public.is_authenticated());
CREATE POLICY "Authenticated users can access feed_consumption" ON public.feed_consumption FOR ALL USING (public.is_authenticated());
CREATE POLICY "Authenticated users can access expenses" ON public.expenses FOR ALL USING (public.is_authenticated());
CREATE POLICY "Authenticated users can access employees" ON public.employees FOR ALL USING (public.is_authenticated());
CREATE POLICY "Authenticated users can access attendance" ON public.attendance FOR ALL USING (public.is_authenticated());
CREATE POLICY "Authenticated users can view activity_logs" ON public.activity_logs FOR SELECT USING (public.is_authenticated());
CREATE POLICY "Authenticated users can insert activity_logs" ON public.activity_logs FOR INSERT WITH CHECK (public.is_authenticated());
CREATE POLICY "Authenticated users can access dairy_settings" ON public.dairy_settings FOR ALL USING (public.is_authenticated());

-- Function to handle new user registration
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, role)
  VALUES (new.id, COALESCE(new.raw_user_meta_data ->> 'full_name', new.email), 'super_admin');
  
  INSERT INTO public.user_roles (user_id, role)
  VALUES (new.id, 'super_admin');
  
  RETURN new;
END;
$$;

-- Trigger for new user
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Function to update timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for updated_at
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_cattle_updated_at BEFORE UPDATE ON public.cattle FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_products_updated_at BEFORE UPDATE ON public.products FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_customers_updated_at BEFORE UPDATE ON public.customers FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_invoices_updated_at BEFORE UPDATE ON public.invoices FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_bottles_updated_at BEFORE UPDATE ON public.bottles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_customer_bottles_updated_at BEFORE UPDATE ON public.customer_bottles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_feed_inventory_updated_at BEFORE UPDATE ON public.feed_inventory FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_employees_updated_at BEFORE UPDATE ON public.employees FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_dairy_settings_updated_at BEFORE UPDATE ON public.dairy_settings FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Insert default dairy settings
INSERT INTO public.dairy_settings (dairy_name) VALUES ('Doodh Wallah Dairy');