/**
 * Pixel-art profile pictures for the team.
 *
 * The app never learns anyone's name — presence and `public.profiles` both deal
 * in email addresses — so the join has to happen on the address. `james.png` is
 * claimed by whichever address carries "james" in its local part, which covers
 * `james@askmario.co.za`, `james.smith@…` and `jamesb@…` alike.
 *
 * Anyone with no matching picture keeps the coloured initials, so adding a
 * teammate never requires adding an image first.
 *
 * The files live in `public/avatars/`, copied from the `pixilart-frames/` source
 * folder in lower case. They are 16×16, and drawn at 32px on screen — see the
 * `.pixel-art` rule in globals.css, without which the browser would smooth them
 * into mush.
 */

/** File name (without extension) for every picture in `public/avatars`. */
const NAMES = ["jacques", "james", "janco", "mario", "mika", "trisha"] as const;

/**
 * Addresses whose local part is not the person's name — the exception list.
 *
 * Add a line here rather than renaming a file: the file name is what the picture
 * is *of*, and one person can have two addresses.
 */
const BY_ADDRESS: Record<string, string> = {
  "janxuse@protonmail.com": "janco",
};

/* ------------------------------------------------------------- the fallback */

/** Initials from the local part of an email: "jan.couys@…" → "JC". */
export function initials(email: string): string {
  const local = email.split("@")[0] ?? email;
  const parts = local.split(/[._\-+]/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return local.slice(0, 2).toUpperCase();
}

/**
 * Stable per-person colour. Hashing the email rather than assigning by index
 * keeps someone the same colour as people come and go.
 */
const COLORS = [
  "#7948bf",
  "#94c147",
  "#e5484d",
  "#f5a524",
  "#3b82f6",
  "#0ea5a4",
  "#d946ef",
];

export function colorFor(email: string): string {
  let hash = 0;
  for (let i = 0; i < email.length; i++) {
    hash = (hash * 31 + email.charCodeAt(i)) | 0;
  }
  return COLORS[Math.abs(hash) % COLORS.length];
}

/* -------------------------------------------------------------- the picture */

/** `/avatars/james.png` for anyone recognisable, null for everyone else. */
export function avatarFor(email: string): string | null {
  const address = email.trim().toLowerCase();
  if (!address) return null;

  const override = BY_ADDRESS[address];
  if (override) return `/avatars/${override}.png`;

  const local = address.split("@")[0] ?? "";
  // "jan.couys" / "jan_couys" / "jan+reports" all split into their words; the
  // prefix test then catches the run-together "jamesb" case.
  const words = local.split(/[^a-z]+/).filter(Boolean);
  const name = NAMES.find((n) => words.includes(n) || local.startsWith(n));

  return name ? `/avatars/${name}.png` : null;
}
