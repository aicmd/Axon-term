import React, { useEffect, useRef } from 'react';

interface SparklineProps {
  data: { value: number }[];
  color: string;
  height?: number;
}

export const Sparkline: React.FC<SparklineProps> = ({ data, color, height = 64 }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Handle high DPI displays
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    const width = rect.width;
    const h = rect.height;

    ctx.clearRect(0, 0, width, h);

    if (data.length < 2) return;

    // Resolve CSS variable if needed
    let resolvedColor = color;
    if (color.startsWith('var(')) {
      resolvedColor = getComputedStyle(document.documentElement).getPropertyValue(color.slice(4, -1)).trim();
    }

    // Drawing Logic
    ctx.beginPath();
    ctx.strokeStyle = resolvedColor;
    ctx.lineWidth = 2;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';

    const step = width / (data.length - 1);
    const getX = (i: number) => i * step;
    const getY = (val: number) => h - (val / 100) * h;

    // Draw Area Fill
    ctx.beginPath();
    ctx.moveTo(0, h);
    data.forEach((d, i) => {
      ctx.lineTo(getX(i), getY(d.value));
    });
    ctx.lineTo(width, h);
    ctx.closePath();

    const gradient = ctx.createLinearGradient(0, 0, 0, h);
    // Use the resolved color with alpha
    // We add opacity by using the color as is and letting Canvas handle it or using globalAlpha
    ctx.save();
    gradient.addColorStop(0, resolvedColor);
    gradient.addColorStop(1, 'transparent');
    ctx.fillStyle = gradient;
    ctx.globalAlpha = 0.2; // Add transparency for the fill
    ctx.fill();
    ctx.restore();

    // Draw Path Line
    ctx.beginPath();
    data.forEach((d, i) => {
      if (i === 0) ctx.moveTo(getX(i), getY(d.value));
      else ctx.lineTo(getX(i), getY(d.value));
    });
    ctx.stroke();

  }, [data, color]);

  return (
    <canvas 
      ref={canvasRef} 
      className="w-full h-full" 
      style={{ height: `${height}px` }}
    />
  );
};
