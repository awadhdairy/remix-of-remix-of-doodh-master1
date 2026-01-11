import confetti from 'canvas-confetti';

export const fireConfetti = () => {
  // Center burst
  confetti({
    particleCount: 100,
    spread: 70,
    origin: { y: 0.6 },
    colors: ['#22c55e', '#3b82f6', '#f59e0b', '#ec4899', '#8b5cf6'],
  });
};

export const fireSuccessConfetti = () => {
  const duration = 800;
  const end = Date.now() + duration;

  const frame = () => {
    confetti({
      particleCount: 3,
      angle: 60,
      spread: 55,
      origin: { x: 0, y: 0.6 },
      colors: ['#22c55e', '#16a34a', '#4ade80'],
    });
    confetti({
      particleCount: 3,
      angle: 120,
      spread: 55,
      origin: { x: 1, y: 0.6 },
      colors: ['#22c55e', '#16a34a', '#4ade80'],
    });

    if (Date.now() < end) {
      requestAnimationFrame(frame);
    }
  };

  frame();
};

export const fireStarConfetti = () => {
  confetti({
    particleCount: 50,
    spread: 360,
    startVelocity: 30,
    gravity: 0.8,
    shapes: ['star'],
    colors: ['#ffd700', '#ffb700', '#ff8c00'],
  });
};

export const fireSideConfetti = () => {
  confetti({
    particleCount: 80,
    angle: 60,
    spread: 45,
    origin: { x: 0, y: 0.5 },
    colors: ['#22c55e', '#3b82f6', '#f59e0b'],
  });
  
  setTimeout(() => {
    confetti({
      particleCount: 80,
      angle: 120,
      spread: 45,
      origin: { x: 1, y: 0.5 },
      colors: ['#22c55e', '#3b82f6', '#f59e0b'],
    });
  }, 100);
};
