"use client";

import { useState } from "react";
import { cx } from "./ui";

const STAR_D =
  "M11.48 3.499a.562.562 0 0 1 1.04 0l2.125 5.111a.563.563 0 0 0 .475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 0 0-.182.557l1.285 5.385a.562.562 0 0 1-.84.61l-4.725-2.885a.562.562 0 0 0-.586 0L6.982 20.54a.562.562 0 0 1-.84-.61l1.285-5.386a.563.563 0 0 0-.182-.557l-4.204-3.602a.562.562 0 0 1 .321-.988l5.518-.442a.563.563 0 0 0 .475-.345L11.48 3.5Z";

function Star({ filled, color, size }: { filled: boolean; color: string; size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <path
        d={STAR_D}
        fill={filled ? color : "#e6e1f0"}
        stroke={filled ? color : "#d7d0e6"}
        strokeWidth={filled ? 0 : 1}
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function StarRating({
  value,
  onChange,
  color = "#f5a524",
  size = 20,
  label,
}: {
  value: number;
  onChange: (n: number) => void;
  color?: string;
  size?: number;
  label?: string;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const active = hover ?? value;

  return (
    <div className="flex items-center gap-2">
      {label && (
        <span className="text-[12px] font-medium text-ink-soft">{label}</span>
      )}
      <div
        className="flex items-center gap-0.5"
        onMouseLeave={() => setHover(null)}
        role="radiogroup"
        aria-label={label || "Rating"}
      >
        {[1, 2, 3, 4, 5].map((i) => (
          <button
            key={i}
            type="button"
            role="radio"
            aria-checked={value === i}
            aria-label={`${i} star${i > 1 ? "s" : ""}`}
            onMouseEnter={() => setHover(i)}
            onClick={() => onChange(value === i ? 0 : i)}
            className="rounded transition-transform hover:scale-110"
          >
            <Star filled={i <= active} color={color} size={size} />
          </button>
        ))}
      </div>
      <span className="w-9 text-[12px] tabular-nums text-ink-soft">
        {value > 0 ? `${value}/5` : "—"}
      </span>
    </div>
  );
}
