import type { ReportData } from "./types";

export interface HealthScore {
  score: number | null; // 0..100, null if nothing rated
  grade: string; // A / B / C / D / F
  label: string; // Excellent / Good / ...
  color: string; // hex for the ring / badge
  goodStars: number; // Σ good ratings
  goodMax: number; // 5 * rated good blocks
  badStars: number; // Σ bad severities
  badMax: number; // 5 * rated bad blocks
  strengths: number; // count of rated good blocks
  issues: number; // count of rated bad blocks
}

const COLORS = {
  leafDk: "#5b7a2c",
  leaf: "#94c147",
  orange: "#f5a524",
  red: "#e5484d",
};

function band(score: number): Pick<HealthScore, "grade" | "label" | "color"> {
  if (score >= 85) return { grade: "A", label: "Excellent", color: COLORS.leafDk };
  if (score >= 70) return { grade: "B", label: "Strong", color: COLORS.leaf };
  if (score >= 55) return { grade: "C", label: "Fair", color: COLORS.orange };
  if (score >= 40) return { grade: "D", label: "Needs Work", color: COLORS.orange };
  return { grade: "F", label: "Critical", color: COLORS.red };
}

/**
 * Overall store Health Score from the block star ratings.
 * - Good blocks push the score up (quality of the positives).
 * - Bad blocks pull it down (severity of the issues). "Improvable" (orange /
 *   highlighted) issues count at half severity.
 * When only one side is rated, the score is based on that side alone.
 */
export function computeHealth(data: ReportData): HealthScore {
  const goodRated = data.goodBlocks.filter((b) => b.rating > 0);
  const badRated = data.badBlocks.filter((b) => b.rating > 0);

  const goodStars = goodRated.reduce((sum, b) => sum + b.rating, 0);
  const goodMax = goodRated.length * 5;

  const badStars = badRated.reduce(
    (sum, b) => sum + (b.highlighted ? b.rating * 0.5 : b.rating),
    0,
  );
  const badMax = badRated.length * 5;

  const goodRatio = goodMax ? goodStars / goodMax : null; // 0..1
  const badRatio = badMax ? badStars / badMax : null; // 0..1

  let score: number | null = null;
  if (goodRatio != null && badRatio != null) {
    score = Math.round(100 * (0.5 * goodRatio + 0.5 * (1 - badRatio)));
  } else if (goodRatio != null) {
    score = Math.round(100 * goodRatio);
  } else if (badRatio != null) {
    score = Math.round(100 * (1 - badRatio));
  }

  const meta = score == null ? { grade: "—", label: "Unrated", color: "#9b93ad" } : band(score);

  return {
    score,
    ...meta,
    goodStars,
    goodMax,
    badStars: Math.round(badStars * 10) / 10,
    badMax,
    strengths: goodRated.length,
    issues: badRated.length,
  };
}
