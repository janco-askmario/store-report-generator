import { Font } from "@react-pdf/renderer";

/**
 * Font registration for the PDF. In the browser the TTFs are served from
 * `/fonts/*`. The Node sample renderer can't fetch those URLs, so it injects
 * data-URI sources via {@link setFontOverrides} before rendering.
 */
const FILES = [
  { file: "Montserrat-Regular.ttf", weight: 400 },
  { file: "Montserrat-Medium.ttf", weight: 500 },
  { file: "Montserrat-SemiBold.ttf", weight: 600 },
  { file: "Montserrat-Bold.ttf", weight: 700 },
  { file: "Montserrat-ExtraBold.ttf", weight: 800 },
] as const;

let overrides: Record<string, string> | null = null;
let done = false;

export function setFontOverrides(map: Record<string, string>) {
  overrides = map;
  done = false;
}

export function registerFonts() {
  if (done) return;
  done = true;
  const src = (file: string) => (overrides && overrides[file]) || `/fonts/${file}`;
  Font.register({
    family: "Montserrat",
    fonts: FILES.map((f) => ({ src: src(f.file), fontWeight: f.weight })),
  });
  Font.registerHyphenationCallback((word) => [word]);
}

export const FONT_FILES = FILES.map((f) => f.file);
