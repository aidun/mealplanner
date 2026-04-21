import { useEffect, useRef } from 'react';

export function PlanBackdrop() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    if (typeof navigator !== 'undefined' && /jsdom/i.test(navigator.userAgent)) return;
    let context: CanvasRenderingContext2D | null = null;
    try {
      if (typeof canvas.getContext !== 'function') return;
      context = canvas.getContext('2d');
    } catch {
      return;
    }
    if (!context) return;

    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    let frame = 0;
    let animation = 0;

    const draw = () => {
      const ratio = window.devicePixelRatio || 1;
      const width = canvas.clientWidth;
      const height = canvas.clientHeight;
      canvas.width = Math.max(1, Math.floor(width * ratio));
      canvas.height = Math.max(1, Math.floor(height * ratio));
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
      context.clearRect(0, 0, width, height);

      const pulse = media.matches ? 0 : Math.sin(frame / 90) * 18;
      const drift = media.matches ? 0 : Math.cos(frame / 120) * 12;
      const gradient = context.createLinearGradient(0, 0, width, height);
      gradient.addColorStop(0, 'rgba(255,255,255,0.92)');
      gradient.addColorStop(0.58, 'rgba(244,248,244,0.88)');
      gradient.addColorStop(1, 'rgba(231,239,233,0.82)');
      context.fillStyle = gradient;
      context.fillRect(0, 0, width, height);

      context.fillStyle = 'rgba(13,138,99,0.09)';
      context.beginPath();
      context.ellipse(width * 0.2, height * 0.28, width * 0.18, height * 0.38, 0.58, 0, Math.PI * 2);
      context.fill();

      context.fillStyle = 'rgba(223,106,70,0.08)';
      context.beginPath();
      context.ellipse(width * 0.8, height * 0.24, width * 0.15, height * 0.24, -0.42, 0, Math.PI * 2);
      context.fill();

      const glaze = context.createRadialGradient(width * 0.74, height * 0.72, 8, width * 0.74, height * 0.72, width * 0.26);
      glaze.addColorStop(0, 'rgba(255,255,255,0.34)');
      glaze.addColorStop(1, 'rgba(255,255,255,0)');
      context.fillStyle = glaze;
      context.beginPath();
      context.ellipse(width * 0.74, height * 0.72, width * 0.26, height * 0.18, -0.22, 0, Math.PI * 2);
      context.fill();

      context.strokeStyle = 'rgba(13,138,99,0.16)';
      context.lineWidth = 1.1;
      context.beginPath();
      context.moveTo(width * 0.08, height * 0.7);
      context.bezierCurveTo(
        width * 0.28,
        height * 0.5 + pulse,
        width * 0.58,
        height * 0.86 - pulse,
        width * 0.9,
        height * 0.58 + drift
      );
      context.stroke();

      context.fillStyle = 'rgba(255,255,255,0.9)';
      for (const [x, y, radius] of [
        [0.16, 0.6, 22],
        [0.48, 0.46, 14],
        [0.82, 0.7, 20],
      ] as const) {
        context.beginPath();
        context.arc(width * x, height * y, radius + pulse * 0.08, 0, Math.PI * 2);
        context.fill();
      }
    };

    const tick = () => {
      frame += 1;
      draw();
      if (!media.matches) {
        animation = window.requestAnimationFrame(tick);
      }
    };

    draw();
    if (!media.matches) {
      animation = window.requestAnimationFrame(tick);
    }

    const handleResize = () => draw();
    window.addEventListener('resize', handleResize);
    media.addEventListener('change', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      media.removeEventListener('change', handleResize);
      if (animation) window.cancelAnimationFrame(animation);
    };
  }, []);

  return <canvas ref={canvasRef} className="plan-backdrop-canvas" aria-hidden="true" />;
}
