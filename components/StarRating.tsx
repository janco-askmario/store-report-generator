"use client";

import { useState } from "react";
import { type RatingShape, ratingGlyph } from "@/lib/rating-glyphs";
import { cx } from "./ui";

function Glyph({
  shape,
  filled,
  color,
  size,
}: {
  shape: RatingShape;
  filled: boolean;
  color: string;
  size: number;
}) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <path
        d={ratingGlyph(shape)}
        fill={filled ? color : "#e6e1f0"}
        stroke={filled ? color : "#d7d0e6"}
        strokeWidth={filled ? 0 : 1}
        strokeLinejoin="round"
      />
    </svg>
  );
}

/**
 * The 0–5 rating control on a block. Quality is rated in stars; severity on a
 * bad block is rated in thumbs-down, because five stars on a problem reads as
 * praise. Same glyphs the PDF uses — see lib/rating-glyphs.ts.
 */
export function StarRating({
  value,
  onChange,
  color = "#f5a524",
  size = 20,
  label,
  shape = "star",
}: {
  value: number;
  onChange: (n: number) => void;
  color?: string;
  size?: number;
  label?: string;
  shape?: RatingShape;
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
            aria-label={`${i} out of 5`}
            onMouseEnter={() => setHover(i)}
            onClick={() => onChange(value === i ? 0 : i)}
            className="rounded transition-transform hover:scale-110"
          >
            <Glyph shape={shape} filled={i <= active} color={color} size={size} />
          </button>
        ))}
      </div>
      <span className="w-9 text-[12px] tabular-nums text-ink-soft">
        {value > 0 ? `${value}/5` : "—"}
      </span>
    </div>
  );
}
