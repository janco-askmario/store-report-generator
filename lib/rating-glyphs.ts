/**
 * The glyphs behind a block's rating, shared by the editor control and the PDF
 * so a 4-out-of-5 looks the same in both places.
 *
 * Good blocks rate quality and use stars. Bad blocks rate severity, where a row
 * of stars reads like praise — they use thumbs-down instead.
 *
 * Both are drawn filled on a 24×24 grid: a rating has to be countable at a
 * glance at 11pt, and outlines lose that at small sizes.
 */

export const STAR_D =
  "M11.48 3.499a.562.562 0 0 1 1.04 0l2.125 5.111a.563.563 0 0 0 .475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 0 0-.182.557l1.285 5.385a.562.562 0 0 1-.84.61l-4.725-2.885a.562.562 0 0 0-.586 0L6.982 20.54a.562.562 0 0 1-.84-.61l1.285-5.386a.563.563 0 0 0-.182-.557l-4.204-3.602a.562.562 0 0 1 .321-.988l5.518-.442a.563.563 0 0 0 .475-.345L11.48 3.5Z";

/**
 * Thumb and cuff as one closed silhouette. Lucide draws this as an outline plus
 * a divider line at x=17; filled, the divider would sit invisibly inside the
 * shape, so the cuff is inset slightly instead to keep the joint readable.
 */
export const THUMBS_DOWN_D =
  "M9 18.12 10 14H4.17a2 2 0 0 1-1.92-2.56l2.33-8A2 2 0 0 1 6.5 2h9.1v12h-.36a2 2 0 0 0-1.79 1.11L12 22a3.13 3.13 0 0 1-3-3.88Z M17.6 2H20a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-2.4V2Z";

export type RatingShape = "star" | "thumbs-down";

export function ratingGlyph(shape: RatingShape): string {
  return shape === "thumbs-down" ? THUMBS_DOWN_D : STAR_D;
}

/** Which glyph a block kind rates with. */
export function shapeForKind(kind: "good" | "bad"): RatingShape {
  return kind === "bad" ? "thumbs-down" : "star";
}
