'use client';

import { useEffect, useRef } from 'react';

type Particle = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  baseSize: number;
  glow: number;
  opacity: number;
};

export function Particles() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const hero = canvas?.parentElement;
    const context = canvas?.getContext('2d');
    if (!canvas || !hero || !context) return;
    const element = canvas;
    const ctx = context;
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
    let width = 0;
    let height = 0;
    let particles: Particle[] = [];
    let frame: number | null = null;
    let mouse: { x: number; y: number } | null = null;
    const radius = 150;

    function resize() {
      width = hero!.clientWidth;
      height = hero!.clientHeight;
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      element.width = Math.round(width * ratio);
      element.height = Math.round(height * ratio);
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
      particles = Array.from({ length: width < 768 ? 50 : 100 }, () => {
        const size = Math.random() * 2.5 + 1;
        return {
          x: Math.random() * width,
          y: Math.random() * height,
          vx: (Math.random() - 0.5) * 0.4,
          vy: (Math.random() - 0.5) * 0.4,
          size,
          baseSize: size,
          glow: 0,
          opacity: 0.3 + Math.random() * 0.4,
        };
      });
      if (motion.matches) draw();
    }

    function draw() {
      ctx.clearRect(0, 0, width, height);
      for (const particle of particles) {
        if (!motion.matches) {
          particle.x += particle.vx;
          particle.y += particle.vy;
          if (particle.x < 0 || particle.x > width) particle.vx *= -1;
          if (particle.y < 0 || particle.y > height) particle.vy *= -1;
          const dx = particle.x - (mouse?.x ?? -1000);
          const dy = particle.y - (mouse?.y ?? -1000);
          const distance = Math.hypot(dx, dy);
          if (mouse && distance < radius) {
            const force = (radius - distance) / radius;
            const angle = Math.atan2(dy, dx);
            particle.x += Math.cos(angle) * force * 4;
            particle.y += Math.sin(angle) * force * 4;
            particle.size = particle.baseSize + force * 5;
            particle.glow = force;
          } else {
            particle.size += (particle.baseSize - particle.size) * 0.05;
            particle.glow *= 0.95;
          }
        }
        ctx.save();
        const alpha = particle.opacity + particle.glow * 0.4;
        if (particle.glow > 0.1) {
          ctx.shadowColor = `rgba(255,255,255,${particle.glow * 0.6})`;
          ctx.shadowBlur = 25 * particle.glow;
        }
        ctx.beginPath();
        ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255,255,255,${alpha * 0.6})`;
        ctx.fill();
        ctx.restore();
      }
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const first = particles[i];
          const second = particles[j];
          const distance = Math.hypot(first.x - second.x, first.y - second.y);
          if (distance >= 160) continue;
          let alpha = 1 - distance / 160;
          if (mouse) {
            const near = Math.hypot(
              (first.x + second.x) / 2 - mouse.x,
              (first.y + second.y) / 2 - mouse.y,
            );
            if (near < radius)
              alpha = Math.min(alpha * (1 + (1 - near / radius) * 2), 1);
          }
          ctx.beginPath();
          ctx.moveTo(first.x, first.y);
          ctx.lineTo(second.x, second.y);
          ctx.strokeStyle = `rgba(255,255,255,${alpha * 0.25})`;
          ctx.lineWidth = 0.5 + alpha * 0.5;
          ctx.stroke();
        }
      }
    }

    function animate() {
      draw();
      frame = requestAnimationFrame(animate);
    }
    function restart() {
      if (frame !== null) cancelAnimationFrame(frame);
      frame = null;
      if (document.hidden) return;
      if (motion.matches) draw();
      else animate();
    }
    function move(event: PointerEvent) {
      const rect = element.getBoundingClientRect();
      mouse = { x: event.clientX - rect.left, y: event.clientY - rect.top };
    }
    function leave() {
      mouse = null;
    }
    const observer = new ResizeObserver(resize);
    resize();
    restart();
    observer.observe(hero);
    element.addEventListener('pointermove', move);
    element.addEventListener('pointerleave', leave);
    motion.addEventListener('change', restart);
    document.addEventListener('visibilitychange', restart);
    return () => {
      if (frame !== null) cancelAnimationFrame(frame);
      observer.disconnect();
      element.removeEventListener('pointermove', move);
      element.removeEventListener('pointerleave', leave);
      motion.removeEventListener('change', restart);
      document.removeEventListener('visibilitychange', restart);
    };
  }, []);

  return <canvas ref={canvasRef} id="particles-canvas" aria-hidden="true" />;
}
