import { useEffect } from 'react';
import { externalSupabase as supabase } from '@/lib/external-supabase';
import { logger } from '@/lib/logger';

/**
 * Hook that ensures all active employees have attendance records for today.
 * Employees are marked as "present" by default unless manually changed.
 */
export function useAutoAttendance() {
  useEffect(() => {
    const ensureTodayAttendance = async () => {
      try {
        // Call the database function to auto-create today's attendance
        await supabase.rpc('auto_create_daily_attendance');
      } catch (error) {
        // Silent fail - attendance will be created on next access
        logger.error('AutoAttendance', 'Sync failed', error);
      }
    };

    ensureTodayAttendance();
  }, []);
}