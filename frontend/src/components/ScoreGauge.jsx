import { useEffect, useState } from "react";

const colorFor = (score) => {
  if (score >= 75) return "hsl(160 84% 28%)";
  if (score >= 50) return "hsl(34 92% 45%)";
  return "hsl(0 72% 52%)";
};

export const ScoreGauge = ({ score = 0, size = 200 }) => {
  const [animated, setAnimated] = useState(0);

  useEffect(() => {
    const target = Math.max(0, Math.min(100, score));
    let frame;
    const start = performance.now();
    const duration = 900;
    const step = (t) => {
      const p = Math.min((t - start) / duration, 1);
      const eased = 1 - Math.pow(1 - p, 3);
      setAnimated(target * eased);
      if (p < 1) frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [score]);

  const r = 80;
  const circumference = Math.PI * r; // semicircle
  const filled = (animated / 100) * circumference;
  const color = colorFor(score);

  return (
    <div className="relative inline-flex flex-col items-center" data-testid="results-score-gauge" style={{ width: size }}>
      <svg viewBox="0 0 200 110" width={size} height={size * 0.55}>
        <path d="M 20 100 A 80 80 0 0 1 180 100" fill="none" stroke="hsl(210 25% 92%)" strokeWidth="14" strokeLinecap="round" />
        <path
          d="M 20 100 A 80 80 0 0 1 180 100"
          fill="none"
          stroke={color}
          strokeWidth="14"
          strokeLinecap="round"
          strokeDasharray={`${filled} ${circumference}`}
          style={{ transition: "stroke 0.3s" }}
        />
      </svg>
      <div className="absolute inset-x-0 top-[42%] text-center">
        <span className="font-heading text-4xl font-semibold tabular-nums" style={{ color }}>
          {Math.round(animated)}
        </span>
        <span className="text-lg text-muted-foreground">%</span>
      </div>
    </div>
  );
};
