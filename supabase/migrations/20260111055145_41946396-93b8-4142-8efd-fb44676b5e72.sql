-- Function to auto-create daily attendance records for all active employees
CREATE OR REPLACE FUNCTION public.auto_create_daily_attendance()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Insert attendance record for all active employees who don't have one for today
  INSERT INTO public.attendance (employee_id, attendance_date, status, check_in)
  SELECT 
    e.id,
    CURRENT_DATE,
    'present',
    '09:00:00'::time -- Default check-in time
  FROM public.employees e
  WHERE e.is_active = true
    AND NOT EXISTS (
      SELECT 1 FROM public.attendance a 
      WHERE a.employee_id = e.id 
        AND a.attendance_date = CURRENT_DATE
    );
END;
$$;

-- Function to be called by trigger on any attendance table access
CREATE OR REPLACE FUNCTION public.ensure_daily_attendance()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Auto-create attendance for today if not exists
  PERFORM public.auto_create_daily_attendance();
  RETURN NEW;
END;
$$;

-- Create a scheduled function that runs on first access each day
-- This trigger fires on SELECT to attendance table
CREATE OR REPLACE FUNCTION public.attendance_auto_present_on_access()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Create missing attendance records for today
  INSERT INTO public.attendance (employee_id, attendance_date, status, check_in)
  SELECT 
    e.id,
    CURRENT_DATE,
    'present',
    '09:00:00'::time
  FROM public.employees e
  WHERE e.is_active = true
    AND NOT EXISTS (
      SELECT 1 FROM public.attendance a 
      WHERE a.employee_id = e.id 
        AND a.attendance_date = CURRENT_DATE
    )
  ON CONFLICT DO NOTHING;
  
  RETURN NEW;
END;
$$;

-- Create trigger on employees table to auto-create attendance when employees are accessed
DROP TRIGGER IF EXISTS trigger_auto_attendance_on_employee_access ON public.employees;
CREATE TRIGGER trigger_auto_attendance_on_employee_access
  AFTER INSERT ON public.employees
  FOR EACH ROW
  EXECUTE FUNCTION public.attendance_auto_present_on_access();

-- Run the function immediately to create today's attendance for all active employees
SELECT public.auto_create_daily_attendance();