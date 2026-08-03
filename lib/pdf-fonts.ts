import { Font } from "@react-pdf/renderer";

/**
 * Font registration for the PDF. In the browser the TTFs are served from
 * `/fonts/*`. The Node sample renderer can't fetch those URLs, so it injects
 * data-URI sources via {@link setFontOverrides} before rendering.
 */
/**
 * The italics are instanced from Google's variable `Montserrat-Italic[wght]`
 * at 400 and 700. Both weights are registered because react-pdf throws when a
 * style it is asked for has no font behind it — a paragraph marked bold *and*
 * italic would otherwise take the whole PDF down.
 */
const FILES = [
  { file: "Montserrat-Regular.ttf", weight: 400 },
  { file: "Montserrat-Medium.ttf", weight: 500 },
  { file: "Montserrat-SemiBold.ttf", weight: 600 },
  { file: "Montserrat-Bold.ttf", weight: 700 },
  { file: "Montserrat-ExtraBold.ttf", weight: 800 },
  { file: "Montserrat-Italic.ttf", weight: 400, style: "italic" },
  { file: "Montserrat-BoldItalic.ttf", weight: 700, style: "italic" },
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
    fonts: FILES.map((f) => ({
      src: src(f.file),
      fontWeight: f.weight,
      ...("style" in f ? { fontStyle: f.style } : {}),
    })),
  });
  Font.registerHyphenationCallback((word) => [word]);
}

/** File → weight/style, so other renderers register exactly what this does. */
export const FONT_DESCRIPTORS = FILES.map((f) => ({
  file: f.file,
  weight: f.weight,
  style: "style" in f ? f.style : undefined,
}));

export const FONT_FILES = FILES.map((f) => f.file);
