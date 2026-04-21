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
      const gradient = context.createLinearGradient(0, 0, width, height);
      gradient.addColorStop(0, 'rgba(255,255,255,0.92)');
      gradient.addColorStop(1, 'rgba(232,246,239,0.86)');
      context.fillStyle = gradient;
      context.fillRect(0, 0, width, height);

      context.fillStyle = 'rgba(15,118,110,0.10)';
      context.beginPath();
      context.ellipse(width * 0.22, height * 0.32, width * 0.16, height * 0.36, 0.6, 0, Math.PI * 2);
      context.fill();

      context.fillStyle = 'rgba(228,87,61,0.08)';
      context.beginPath();
      context.ellipse(width * 0.78, height * 0.22, width * 0.14, height * 0.24, -0.4, 0, Math.PI * 2);
      context.fill();

      context.strokeStyle = 'rgba(15,118,110,0.14)';
      context.lineWidth = 1.2;
      context.beginPath();
      context.moveTo(width * 0.12, height * 0.68);
      context.bezierCurveTo(width * 0.32, height * 0.52 + pulse, width * 0.58, height * 0.84 - pulse, width * 0.86, height * 0.62);
      context.stroke();

      context.fillStyle = 'rgba(255,255,255,0.82)';
      for (const [x, y, radius] of [
        [0.18, 0.62, 20],
        [0.52, 0.48, 14],
        [0.82, 0.68, 18],
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
