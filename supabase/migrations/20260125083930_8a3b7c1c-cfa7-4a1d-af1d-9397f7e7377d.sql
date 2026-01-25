-- Create table for external milk procurement/vendors
CREATE TABLE public.milk_vendors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  phone TEXT,
  address TEXT,
  area TEXT,
  is_active BOOLEAN DEFAULT true,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create table for milk procurement records
CREATE TABLE public.milk_procurement (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id UUID REFERENCES public.milk_vendors(id) ON DELETE SET NULL,
  vendor_name TEXT, -- Store name for quick reference even if vendor deleted
  procurement_date DATE NOT NULL,
  session TEXT NOT NULL CHECK (session IN ('morning', 'evening')),
  quantity_liters DECIMAL(10,2) NOT NULL,
  fat_percentage DECIMAL(4,2),
  snf_percentage DECIMAL(4,2),
  rate_per_liter DECIMAL(10,2),
  total_amount DECIMAL(12,2),
  payment_status TEXT DEFAULT 'pending' CHECK (payment_status IN ('pending', 'partial', 'paid')),
  notes TEXT,
  recorded_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(vendor_id, procurement_date, session)
);

-- Create index for faster lookups
CREATE INDEX idx_milk_procurement_date ON public.milk_procurement(procurement_date);
CREATE INDEX idx_milk_procurement_vendor ON public.milk_procurement(vendor_id);

-- Enable RLS
ALTER TABLE public.milk_vendors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.milk_procurement ENABLE ROW LEVEL SECURITY;

-- RLS Policies for milk_vendors
CREATE POLICY "Managers and admins have full access to milk_vendors"
ON public.milk_vendors FOR ALL
USING (public.is_manager_or_admin(auth.uid()));

CREATE POLICY "Farm workers can manage milk_vendors"
ON public.milk_vendors FOR ALL
USING (public.has_role(auth.uid(), 'farm_worker'));

CREATE POLICY "Auditors can read milk_vendors"
ON public.milk_vendors FOR SELECT
USING (public.has_role(auth.uid(), 'auditor'));

CREATE POLICY "Accountants can read milk_vendors"
ON public.milk_vendors FOR SELECT
USING (public.has_role(auth.uid(), 'accountant'));

-- RLS Policies for milk_procurement
CREATE POLICY "Managers and admins have full access to milk_procurement"
ON public.milk_procurement FOR ALL
USING (public.is_manager_or_admin(auth.uid()));

CREATE POLICY "Farm workers can manage milk_procurement"
ON public.milk_procurement FOR ALL
USING (public.has_role(auth.uid(), 'farm_worker'));

CREATE POLICY "Auditors can read milk_procurement"
ON public.milk_procurement FOR SELECT
USING (public.has_role(auth.uid(), 'auditor'));

CREATE POLICY "Accountants can read milk_procurement"
ON public.milk_procurement FOR SELECT
USING (public.has_role(auth.uid(), 'accountant'));

-- Trigger for updated_at
CREATE TRIGGER update_milk_vendors_updated_at
  BEFORE UPDATE ON public.milk_vendors
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_milk_procurement_updated_at
  BEFORE UPDATE ON public.milk_procurement
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();