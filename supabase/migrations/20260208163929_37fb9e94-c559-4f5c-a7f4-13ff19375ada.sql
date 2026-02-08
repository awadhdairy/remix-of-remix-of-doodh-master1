-- Create telegram_config table for storing Telegram notification settings
CREATE TABLE public.telegram_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_id TEXT NOT NULL,
  chat_name TEXT,
  is_active BOOLEAN DEFAULT true,
  notify_production BOOLEAN DEFAULT true,
  notify_procurement BOOLEAN DEFAULT true,
  notify_deliveries BOOLEAN DEFAULT true,
  notify_health_alerts BOOLEAN DEFAULT true,
  notify_inventory_alerts BOOLEAN DEFAULT true,
  notify_payments BOOLEAN DEFAULT true,
  notify_daily_summary BOOLEAN DEFAULT true,
  large_payment_threshold NUMERIC DEFAULT 10000,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.telegram_config ENABLE ROW LEVEL SECURITY;

-- Only super_admin can manage telegram config
CREATE POLICY "Super admins can manage telegram config" 
  ON public.telegram_config
  FOR ALL
  USING (public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

-- Update trigger for updated_at
CREATE TRIGGER update_telegram_config_updated_at
  BEFORE UPDATE ON public.telegram_config
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();