/**
 * The store URL as typed in the editor → something a browser can open.
 *
 * People type "peakcycles.co.za" far more often than they type a scheme, so a
 * bare host is assumed to be https. A value that carries a scheme of its own is
 * only trusted when that scheme is http(s): this text is typed into a shared
 * report by any teammate, and `javascript:` in an href runs on click.
 *
 * Returns null when there is nothing safe or sensible to link to — callers show
 * the raw text instead.
 */
export function storeHref(raw: string): string | null {
  const url = raw.trim();
  if (!url) return null;
  if (/^https?:\/\//i.test(url)) return url;
  // mailto:, javascript:, data:… — none of them are a store address.
  if (/^[a-z][a-z0-9+.-]*:/i.test(url)) return null;
  // Needs a dot before the first slash to be a hostname at all; "draft notes"
  // typed into the URL field should stay plain text rather than become a link.
  if (!/^[^\s/]+\.[^\s/]/.test(url)) return null;
  return `https://${url}`;
}
