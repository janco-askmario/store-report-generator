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
  | { type: "polygon"; points: string }
  /* `rx` is the corner radius; Lucide also emits `ry`, but it always equals
     `rx` for these icons and react-pdf's <Rect> takes them separately, so one
     value is carried and applied to both. */
  | {
      type: "rect";
      x: number;
      y: number;
      width: number;
      height: number;
      rx?: number;
    };

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

  /* ---- E-commerce set, generated by scripts/gen-icons.mts from lucide-react.
     Add to WANTED in that script and re-run rather than editing paths here. -- */
  {
    key: "award",
    label: "Award",
    group: "good",
    elements: [
      { type: "path", d: "m15.477 12.89 1.515 8.526a.5.5 0 0 1-.81.47l-3.58-2.687a1 1 0 0 0-1.197 0l-3.586 2.686a.5.5 0 0 1-.81-.469l1.514-8.526" },
      { type: "circle", cx: 12, cy: 8, r: 6 },
    ],
  },
  {
    key: "medal",
    label: "Medal",
    group: "good",
    elements: [
      { type: "path", d: "M7.21 15 2.66 7.14a2 2 0 0 1 .13-2.2L4.4 2.8A2 2 0 0 1 6 2h12a2 2 0 0 1 1.6.8l1.6 2.14a2 2 0 0 1 .14 2.2L16.79 15" },
      { type: "path", d: "M11 12 5.12 2.2" },
      { type: "path", d: "m13 12 5.88-9.8" },
      { type: "path", d: "M8 7h8" },
      { type: "circle", cx: 12, cy: 17, r: 5 },
      { type: "path", d: "M12 18v-2h-.5" },
    ],
  },
  {
    key: "crown",
    label: "Premium",
    group: "good",
    elements: [
      { type: "path", d: "M11.562 3.266a.5.5 0 0 1 .876 0L15.39 8.87a1 1 0 0 0 1.516.294L21.183 5.5a.5.5 0 0 1 .798.519l-2.834 10.246a1 1 0 0 1-.956.734H5.81a1 1 0 0 1-.957-.734L2.02 6.02a.5.5 0 0 1 .798-.519l4.276 3.664a1 1 0 0 0 1.516-.294z" },
      { type: "path", d: "M5 21h14" },
    ],
  },
  {
    key: "check-circle",
    label: "Verified",
    group: "good",
    elements: [
      { type: "path", d: "M21.801 10A10 10 0 1 1 17 3.335" },
      { type: "path", d: "m9 11 3 3L22 4" },
    ],
  },
  {
    key: "handshake",
    label: "Trust",
    group: "good",
    elements: [
      { type: "path", d: "m11 17 2 2a1 1 0 1 0 3-3" },
      { type: "path", d: "m14 14 2.5 2.5a1 1 0 1 0 3-3l-3.88-3.88a3 3 0 0 0-4.24 0l-.88.88a1 1 0 1 1-3-3l2.81-2.81a5.79 5.79 0 0 1 7.06-.87l.47.28a2 2 0 0 0 1.42.25L21 4" },
      { type: "path", d: "m21 3 1 11h-2" },
      { type: "path", d: "M3 3 2 14l6.5 6.5a1 1 0 1 0 3-3" },
      { type: "path", d: "M3 4h8" },
    ],
  },
  {
    key: "quote",
    label: "Testimonial",
    group: "good",
    elements: [
      { type: "path", d: "M16 3a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2 1 1 0 0 1 1 1v1a2 2 0 0 1-2 2 1 1 0 0 0-1 1v2a1 1 0 0 0 1 1 6 6 0 0 0 6-6V5a2 2 0 0 0-2-2z" },
      { type: "path", d: "M5 3a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2 1 1 0 0 1 1 1v1a2 2 0 0 1-2 2 1 1 0 0 0-1 1v2a1 1 0 0 0 1 1 6 6 0 0 0 6-6V5a2 2 0 0 0-2-2z" },
    ],
  },
  {
    key: "star-half",
    label: "Reviews",
    group: "good",
    elements: [
      { type: "path", d: "M12 18.338a2.1 2.1 0 0 0-.987.244L6.396 21.01a.53.53 0 0 1-.77-.56l.881-5.139a2.12 2.12 0 0 0-.611-1.879L2.16 9.795a.53.53 0 0 1 .294-.906l5.165-.755a2.12 2.12 0 0 0 1.597-1.16l2.309-4.679A.53.53 0 0 1 12 2" },
    ],
  },
  {
    key: "shopping-bag",
    label: "Shopping bag",
    group: "neutral",
    elements: [
      { type: "path", d: "M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z" },
      { type: "path", d: "M3 6h18" },
      { type: "path", d: "M16 10a4 4 0 0 1-8 0" },
    ],
  },
  {
    key: "credit-card",
    label: "Checkout",
    group: "neutral",
    elements: [
      { type: "rect", x: 2, y: 5, width: 20, height: 14, rx: 2 },
      { type: "line", x1: 2, y1: 10, x2: 22, y2: 10 },
    ],
  },
  {
    key: "truck",
    label: "Shipping",
    group: "neutral",
    elements: [
      { type: "path", d: "M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2" },
      { type: "path", d: "M15 18H9" },
      { type: "path", d: "M19 18h2a1 1 0 0 0 1-1v-3.65a1 1 0 0 0-.22-.624l-3.48-4.35A1 1 0 0 0 17.52 8H14" },
      { type: "circle", cx: 17, cy: 18, r: 2 },
      { type: "circle", cx: 7, cy: 18, r: 2 },
    ],
  },
  {
    key: "package",
    label: "Product",
    group: "neutral",
    elements: [
      { type: "path", d: "M11 21.73a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73z" },
      { type: "path", d: "M12 22V12" },
      { type: "path", d: "m3.3 7 7.703 4.734a2 2 0 0 0 1.994 0L20.7 7" },
      { type: "path", d: "m7.5 4.27 9 5.15" },
    ],
  },
  {
    key: "receipt",
    label: "Orders",
    group: "neutral",
    elements: [
      { type: "path", d: "M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1Z" },
      { type: "path", d: "M16 8h-6a2 2 0 1 0 0 4h4a2 2 0 1 1 0 4H8" },
      { type: "path", d: "M12 17.5v-11" },
    ],
  },
  {
    key: "tag",
    label: "Pricing",
    group: "neutral",
    elements: [
      { type: "path", d: "M12.586 2.586A2 2 0 0 0 11.172 2H4a2 2 0 0 0-2 2v7.172a2 2 0 0 0 .586 1.414l8.704 8.704a2.426 2.426 0 0 0 3.42 0l6.58-6.58a2.426 2.426 0 0 0 0-3.42z" },
      { type: "circle", cx: 7.5, cy: 7.5, r: 0.5 },
    ],
  },
  {
    key: "search",
    label: "SEO / Search",
    group: "neutral",
    elements: [
      { type: "circle", cx: 11, cy: 11, r: 8 },
      { type: "path", d: "m21 21-4.3-4.3" },
    ],
  },
  {
    key: "smartphone",
    label: "Mobile",
    group: "neutral",
    elements: [
      { type: "rect", x: 5, y: 2, width: 14, height: 20, rx: 2 },
      { type: "path", d: "M12 18h.01" },
    ],
  },
  {
    key: "monitor",
    label: "Desktop",
    group: "neutral",
    elements: [
      { type: "rect", x: 2, y: 3, width: 20, height: 14, rx: 2 },
      { type: "line", x1: 8, y1: 21, x2: 16, y2: 21 },
      { type: "line", x1: 12, y1: 17, x2: 12, y2: 21 },
    ],
  },
  {
    key: "gauge",
    label: "Page speed",
    group: "neutral",
    elements: [
      { type: "path", d: "m12 14 4-4" },
      { type: "path", d: "M3.34 19a10 10 0 1 1 17.32 0" },
    ],
  },
  {
    key: "image",
    label: "Imagery",
    group: "neutral",
    elements: [
      { type: "rect", x: 3, y: 3, width: 18, height: 18, rx: 2 },
      { type: "circle", cx: 9, cy: 9, r: 2 },
      { type: "path", d: "m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" },
    ],
  },
  {
    key: "mail",
    label: "Email",
    group: "neutral",
    elements: [
      { type: "rect", x: 2, y: 4, width: 20, height: 16, rx: 2 },
      { type: "path", d: "m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" },
    ],
  },
  {
    key: "megaphone",
    label: "Ads",
    group: "neutral",
    elements: [
      { type: "path", d: "m3 11 18-5v12L3 14v-3z" },
      { type: "path", d: "M11.6 16.8a3 3 0 1 1-5.8-1.6" },
    ],
  },
  {
    key: "users",
    label: "Audience",
    group: "neutral",
    elements: [
      { type: "path", d: "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" },
      { type: "circle", cx: 9, cy: 7, r: 4 },
      { type: "path", d: "M22 21v-2a4 4 0 0 0-3-3.87" },
      { type: "path", d: "M16 3.13a4 4 0 0 1 0 7.75" },
    ],
  },
  {
    key: "globe",
    label: "Traffic",
    group: "neutral",
    elements: [
      { type: "circle", cx: 12, cy: 12, r: 10 },
      { type: "path", d: "M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20" },
      { type: "path", d: "M2 12h20" },
    ],
  },
  {
    key: "chart-column",
    label: "Analytics",
    group: "neutral",
    elements: [
      { type: "path", d: "M3 3v16a2 2 0 0 0 2 2h16" },
      { type: "path", d: "M18 17V9" },
      { type: "path", d: "M13 17V5" },
      { type: "path", d: "M8 17v-3" },
    ],
  },
  {
    key: "palette",
    label: "Branding",
    group: "neutral",
    elements: [
      { type: "circle", cx: 13.5, cy: 6.5, r: 0.5 },
      { type: "circle", cx: 17.5, cy: 10.5, r: 0.5 },
      { type: "circle", cx: 8.5, cy: 7.5, r: 0.5 },
      { type: "circle", cx: 6.5, cy: 12.5, r: 0.5 },
      { type: "path", d: "M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z" },
    ],
  },
  {
    key: "hourglass",
    label: "Slow",
    group: "bad",
    elements: [
      { type: "path", d: "M5 22h14" },
      { type: "path", d: "M5 2h14" },
      { type: "path", d: "M17 22v-4.172a2 2 0 0 0-.586-1.414L12 12l-4.414 4.414A2 2 0 0 0 7 17.828V22" },
      { type: "path", d: "M7 2v4.172a2 2 0 0 0 .586 1.414L12 12l4.414-4.414A2 2 0 0 0 17 6.172V2" },
    ],
  },
  {
    key: "snail",
    label: "Very slow",
    group: "bad",
    elements: [
      { type: "path", d: "M2 13a6 6 0 1 0 12 0 4 4 0 1 0-8 0 2 2 0 0 0 4 0" },
      { type: "circle", cx: 10, cy: 13, r: 8 },
      { type: "path", d: "M2 21h12c4.4 0 8-3.6 8-8V7a2 2 0 1 0-4 0v6" },
      { type: "path", d: "M18 3 19.1 5.2" },
      { type: "path", d: "M22 3 20.9 5.2" },
    ],
  },
  {
    key: "image-off",
    label: "Missing images",
    group: "bad",
    elements: [
      { type: "line", x1: 2, y1: 2, x2: 22, y2: 22 },
      { type: "path", d: "M10.41 10.41a2 2 0 1 1-2.83-2.83" },
      { type: "line", x1: 13.5, y1: 13.5, x2: 6, y2: 21 },
      { type: "line", x1: 18, y1: 12, x2: 21, y2: 15 },
      { type: "path", d: "M3.59 3.59A1.99 1.99 0 0 0 3 5v14a2 2 0 0 0 2 2h14c.55 0 1.052-.22 1.41-.59" },
      { type: "path", d: "M21 15V5a2 2 0 0 0-2-2H9" },
    ],
  },
  {
    key: "unlink",
    label: "Broken link",
    group: "bad",
    elements: [
      { type: "path", d: "m18.84 12.25 1.72-1.71h-.02a5.004 5.004 0 0 0-.12-7.07 5.006 5.006 0 0 0-6.95 0l-1.72 1.71" },
      { type: "path", d: "m5.17 11.75-1.71 1.71a5.004 5.004 0 0 0 .12 7.07 5.006 5.006 0 0 0 6.95 0l1.71-1.71" },
      { type: "line", x1: 8, y1: 2, x2: 8, y2: 5 },
      { type: "line", x1: 2, y1: 8, x2: 5, y2: 8 },
      { type: "line", x1: 16, y1: 19, x2: 16, y2: 22 },
      { type: "line", x1: 19, y1: 16, x2: 22, y2: 16 },
    ],
  },
  {
    key: "eye-off",
    label: "Hard to find",
    group: "bad",
    elements: [
      { type: "path", d: "M10.733 5.076a10.744 10.744 0 0 1 11.205 6.575 1 1 0 0 1 0 .696 10.747 10.747 0 0 1-1.444 2.49" },
      { type: "path", d: "M14.084 14.158a3 3 0 0 1-4.242-4.242" },
      { type: "path", d: "M17.479 17.499a10.75 10.75 0 0 1-15.417-5.151 1 1 0 0 1 0-.696 10.75 10.75 0 0 1 4.446-5.143" },
      { type: "path", d: "m2 2 20 20" },
    ],
  },
  {
    key: "circle-help",
    label: "Confusing",
    group: "bad",
    elements: [
      { type: "circle", cx: 12, cy: 12, r: 10 },
      { type: "path", d: "M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" },
      { type: "path", d: "M12 17h.01" },
    ],
  },
  {
    key: "shield-off",
    label: "Not secure",
    group: "bad",
    elements: [
      { type: "path", d: "m2 2 20 20" },
      { type: "path", d: "M5 5a1 1 0 0 0-1 1v7c0 5 3.5 7.5 7.67 8.94a1 1 0 0 0 .67.01c2.35-.82 4.48-1.97 5.9-3.71" },
      { type: "path", d: "M9.309 3.652A12.252 12.252 0 0 0 11.24 2.28a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1v7a9.784 9.784 0 0 1-.08 1.264" },
    ],
  },
  {
    key: "bug",
    label: "Bug",
    group: "bad",
    elements: [
      { type: "path", d: "m8 2 1.88 1.88" },
      { type: "path", d: "M14.12 3.88 16 2" },
      { type: "path", d: "M9 7.13v-1a3.003 3.003 0 1 1 6 0v1" },
      { type: "path", d: "M12 20c-3.3 0-6-2.7-6-6v-3a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v3c0 3.3-2.7 6-6 6" },
      { type: "path", d: "M12 20v-9" },
      { type: "path", d: "M6.53 9C4.6 8.8 3 7.1 3 5" },
      { type: "path", d: "M6 13H2" },
      { type: "path", d: "M3 21c0-2.1 1.7-3.9 3.8-4" },
      { type: "path", d: "M20.97 5c0 2.1-1.6 3.8-3.5 4" },
      { type: "path", d: "M22 13h-4" },
      { type: "path", d: "M17.2 17c2.1.1 3.8 1.9 3.8 4" },
    ],
  },
];

export const ICON_MAP: Record<string, IconDef> = Object.fromEntries(
  ICONS.map((i) => [i.key, i]),
);

export function getIcon(key: string | undefined | null): IconDef {
  return (key && ICON_MAP[key]) || ICONS[0];
}
