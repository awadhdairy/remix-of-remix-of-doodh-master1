import { useCallback } from 'react';
import { useSoundFeedback } from './useSoundFeedback';
import { fireSuccessConfetti, fireConfetti, fireSideConfetti } from '@/lib/confetti';

export function useInteractions() {
  const { playClick, playSuccess, playError } = useSoundFeedback();

  const handleButtonClick = useCallback(() => {
    playClick();
  }, [playClick]);

  const handleSuccess = useCallback((options?: { confetti?: boolean; sound?: boolean }) => {
    const { confetti = true, sound = true } = options || {};
    if (sound) playSuccess();
    if (confetti) fireSuccessConfetti();
  }, [playSuccess]);

  const handleError = useCallback(() => {
    playError();
  }, [playError]);

  const celebrateAction = useCallback(() => {
    playSuccess();
    fireSideConfetti();
  }, [playSuccess]);

  const bigCelebration = useCallback(() => {
    playSuccess();
    fireConfetti();
  }, [playSuccess]);

  return {
    handleButtonClick,
    handleSuccess,
    handleError,
    celebrateAction,
    bigCelebration,
  };
}
