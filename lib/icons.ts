/**
 * Shared icon definitions.
 *
 * Each icon is described as a list of primitive SVG elements on a 24x24
 * viewBox. The SAME data drives both the dashboard picker (inline <svg>) and
 * the generated PDF (@react-pdf/renderer <Svg>), so an icon always looks the
 * same in the editor and in the exported report.
 *
 * Paths are stroke-based (Lucide-style): fill="none", stroke="currentColor".
 */

export type IconElement =
  | { type: "path"; d: string }
  | { type: "circle"; cx: number; cy: number; r: number }
  | { type: "line"; x1: number; y1: number; x2: number; y2: number }
  | { type: "polyline"; points: string }
  | { type: "polygon"; points: string };

export interface IconDef {
  key: string;
  label: string;
  group: "good" | "bad" | "neutral";
  elements: IconElement[];
}

export const ICONS: IconDef[] = [
  // ---- Positive / "Good" leaning -------------------------------------------
  {
    key: "diamond",
    label: "Diamond",
    group: "good",
    elements: [
      {
        type: "path",
        d: "M2.7 10.3a2.41 2.41 0 0 0 0 3.41l7.59 7.59a2.41 2.41 0 0 0 3.41 0l7.59-7.59a2.41 2.41 0 0 0 0-3.41L13.7 2.71a2.41 2.41 0 0 0-3.41 0Z",
      },
    ],
  },
  {
    key: "star",
    label: "Star",
    group: "good",
    elements: [
      {
        type: "path",
        d: "M11.48 3.499a.562.562 0 0 1 1.04 0l2.125 5.111a.563.563 0 0 0 .475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 0 0-.182.557l1.285 5.385a.562.562 0 0 1-.84.61l-4.725-2.885a.562.562 0 0 0-.586 0L6.982 20.54a.562.562 0 0 1-.84-.61l1.285-5.386a.563.563 0 0 0-.182-.557l-4.204-3.602a.562.562 0 0 1 .321-.988l5.518-.442a.563.563 0 0 0 .475-.345L11.48 3.5Z",
      },
    ],
  },
  {
    key: "heart",
    label: "Heart",
    group: "good",
    elements: [
      {
        type: "path",
        d: "M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.29 1.49 4.04 3 5.5l7 7Z",
      },
    ],
  },
  {
    key: "trophy",
    label: "Trophy",
    group: "good",
    elements: [
      { type: "path", d: "M6 9H4.5a2.5 2.5 0 0 1 0-5H6" },
      { type: "path", d: "M18 9h1.5a2.5 2.5 0 0 0 0-5H18" },
      { type: "path", d: "M4 22h16" },
      {
        type: "path",
        d: "M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22",
      },
      {
        type: "path",
        d: "M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22",
      },
      { type: "path", d: "M18 2H6v7a6 6 0 0 0 12 0V2Z" },
    ],
  },
  {
    key: "thumbs-up",
    label: "Thumbs up",
    group: "good",
    elements: [
      { type: "path", d: "M7 10v12" },
      {
        type: "path",
        d: "M15 5.88 14 10h5.83a2 2 0 0 1 1.92 2.56l-2.33 8A2 2 0 0 1 17.5 22H4a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2h2.76a2 2 0 0 0 1.79-1.11L12 2a3.13 3.13 0 0 1 3 3.88Z",
      },
    ],
  },
  {
    key: "sparkles",
    label: "Sparkles",
    group: "good",
    elements: [
      {
        type: "path",
        d: "M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .962 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.962 0z",
      },
    ],
  },
  {
    key: "shield-check",
    label: "Shield check",
    group: "good",
    elements: [
      {
        type: "path",
        d: "M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z",
      },
      { type: "path", d: "m9 12 2 2 4-4" },
    ],
  },
  {
    key: "badge-check",
    label: "Badge check",
    group: "good",
    elements: [
      {
        type: "path",
        d: "M3.85 8.62a4 4 0 0 1 4.78-4.77 4 4 0 0 1 6.74 0 4 4 0 0 1 4.78 4.78 4 4 0 0 1 0 6.74 4 4 0 0 1-4.77 4.78 4 4 0 0 1-6.75 0 4 4 0 0 1-4.78-4.77 4 4 0 0 1 0-6.76Z",
      },
      { type: "path", d: "m9 12 2 2 4-4" },
    ],
  },
  {
    key: "gem",
    label: "Gem",
    group: "good",
    elements: [
      { type: "path", d: "M6 3h12l4 6-10 13L2 9Z" },
      { type: "path", d: "M11 3 8 9l4 13 4-13-3-6" },
      { type: "path", d: "M2 9h20" },
    ],
  },
  {
    key: "rocket",
    label: "Rocket",
    group: "good",
    elements: [
      {
        type: "path",
        d: "M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z",
      },
      {
        type: "path",
        d: "M12 15l-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z",
      },
      { type: "path", d: "M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0" },
      { type: "path", d: "M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5" },
    ],
  },
  {
    key: "trending-up",
    label: "Trending up",
    group: "good",
    elements: [
      { type: "polyline", points: "22 7 13.5 15.5 8.5 10.5 2 17" },
      { type: "polyline", points: "16 7 22 7 22 13" },
    ],
  },
  {
    key: "eye",
    label: "Eye",
    group: "good",
    elements: [
      {
        type: "path",
        d: "M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0Z",
      },
      { type: "circle", cx: 12, cy: 12, r: 3 },
    ],
  },
  {
    key: "smile",
    label: "Smile",
    group: "good",
    elements: [
      { type: "circle", cx: 12, cy: 12, r: 10 },
      { type: "path", d: "M8 14s1.5 2 4 2 4-2 4-2" },
      { type: "line", x1: 9, y1: 9, x2: 9.01, y2: 9 },
      { type: "line", x1: 15, y1: 9, x2: 15.01, y2: 9 },
    ],
  },
  {
    key: "zap",
    label: "Lightning",
    group: "neutral",
    elements: [
      { type: "polygon", points: "13 2 3 14 12 14 11 22 21 10 12 10 13 2" },
    ],
  },
  {
    key: "target",
    label: "Target",
    group: "neutral",
    elements: [
      { type: "circle", cx: 12, cy: 12, r: 10 },
      { type: "circle", cx: 12, cy: 12, r: 6 },
      { type: "circle", cx: 12, cy: 12, r: 2 },
    ],
  },
  {
    key: "dollar",
    label: "Money",
    group: "neutral",
    elements: [
      { type: "line", x1: 12, y1: 2, x2: 12, y2: 22 },
      { type: "path", d: "M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" },
    ],
  },
  {
    key: "percent",
    label: "Percent",
    group: "neutral",
    elements: [
      { type: "line", x1: 19, y1: 5, x2: 5, y2: 19 },
      { type: "circle", cx: 6.5, cy: 6.5, r: 2.5 },
      { type: "circle", cx: 17.5, cy: 17.5, r: 2.5 },
    ],
  },
  {
    key: "cart",
    label: "Shopping cart",
    group: "neutral",
    elements: [
      { type: "circle", cx: 8, cy: 21, r: 1 },
      { type: "circle", cx: 19, cy: 21, r: 1 },
      {
        type: "path",
        d: "M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12",
      },
    ],
  },
  // ---- Negative / "Bad" leaning --------------------------------------------
  {
    key: "alert-triangle",
    label: "Warning triangle",
    group: "bad",
    elements: [
      {
        type: "path",
        d: "M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z",
      },
      { type: "line", x1: 12, y1: 9, x2: 12, y2: 13 },
      { type: "line", x1: 12, y1: 17, x2: 12.01, y2: 17 },
    ],
  },
  {
    key: "x-circle",
    label: "Error",
    group: "bad",
    elements: [
      { type: "circle", cx: 12, cy: 12, r: 10 },
      { type: "line", x1: 15, y1: 9, x2: 9, y2: 15 },
      { type: "line", x1: 9, y1: 9, x2: 15, y2: 15 },
    ],
  },
  {
    key: "octagon-alert",
    label: "Stop",
    group: "bad",
    elements: [
      {
        type: "polygon",
        points: "7.86 2 16.14 2 22 7.86 22 16.14 16.14 22 7.86 22 2 16.14 2 7.86",
      },
      { type: "line", x1: 12, y1: 8, x2: 12, y2: 12 },
      { type: "line", x1: 12, y1: 16, x2: 12.01, y2: 16 },
    ],
  },
  {
    key: "thumbs-down",
    label: "Thumbs down",
    group: "bad",
    elements: [
      { type: "path", d: "M17 14V2" },
      {
        type: "path",
        d: "M9 18.12 10 14H4.17a2 2 0 0 1-1.92-2.56l2.33-8A2 2 0 0 1 6.5 2H20a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-2.76a2 2 0 0 0-1.79 1.11L12 22a3.13 3.13 0 0 1-3-3.88Z",
      },
    ],
  },
  {
    key: "trending-down",
    label: "Trending down",
    group: "bad",
    elements: [
      { type: "polyline", points: "22 17 13.5 8.5 8.5 13.5 2 7" },
      { type: "polyline", points: "16 17 22 17 22 11" },
    ],
  },
  {
    key: "clock",
    label: "Clock / slow",
    group: "bad",
    elements: [
      { type: "circle", cx: 12, cy: 12, r: 10 },
      { type: "polyline", points: "12 6 12 12 16 14" },
    ],
  },
  {
    key: "ban",
    label: "Ban",
    group: "bad",
    elements: [
      { type: "circle", cx: 12, cy: 12, r: 10 },
      { type: "line", x1: 4.93, y1: 4.93, x2: 19.07, y2: 19.07 },
    ],
  },
  {
    key: "wrench",
    label: "Needs fixing",
    group: "bad",
    elements: [
      {
        type: "path",
        d: "M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z",
      },
    ],
  },
  {
    key: "frown",
    label: "Frown",
    group: "bad",
    elements: [
      { type: "circle", cx: 12, cy: 12, r: 10 },
      { type: "path", d: "M16 16s-1.5-2-4-2-4 2-4 2" },
      { type: "line", x1: 9, y1: 9, x2: 9.01, y2: 9 },
      { type: "line", x1: 15, y1: 9, x2: 15.01, y2: 9 },
    ],
  },
  {
    key: "flame",
    label: "Flame",
    group: "bad",
    elements: [
      {
        type: "path",
        d: "M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z",
      },
    ],
  },
  {
    key: "bulb",
    label: "Idea",
    group: "neutral",
    elements: [
      {
        type: "path",
        d: "M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5",
      },
      { type: "path", d: "M9 18h6" },
      { type: "path", d: "M10 22h4" },
    ],
  },
];

export const ICON_MAP: Record<string, IconDef> = Object.fromEntries(
  ICONS.map((i) => [i.key, i]),
);

export function getIcon(key: string | undefined | null): IconDef {
  return (key && ICON_MAP[key]) || ICONS[0];
}
