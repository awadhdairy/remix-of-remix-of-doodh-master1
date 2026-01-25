-- Add UPI handle column to dairy_settings for admin configuration
ALTER TABLE public.dairy_settings 
ADD COLUMN IF NOT EXISTS upi_handle text;

COMMENT ON COLUMN public.dairy_settings.upi_handle IS 
  'UPI payment handle (e.g., dairyname@upi) displayed on invoices';

-- Add UPI handle column to invoices to capture snapshot at generation time
ALTER TABLE public.invoices 
ADD COLUMN IF NOT EXISTS upi_handle text;

COMMENT ON COLUMN public.invoices.upi_handle IS 
  'UPI handle captured at invoice generation time for historical accuracy';