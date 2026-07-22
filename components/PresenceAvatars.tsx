"use client";

import type { PresentUser } from "@/lib/presence";
import { cx } from "./ui";

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

export function PresenceAvatars({
  users,
  max = 3,
  size = 24,
  className,
}: {
  users: PresentUser[];
  max?: number;
  size?: number;
  className?: string;
}) {
  if (users.length === 0) return null;

  const shown = users.slice(0, max);
  const extra = users.length - shown.length;

  return (
    <div
      className={cx("flex items-center", className)}
      title={users.map((u) => u.email).join("\n")}
    >
      {shown.map((u) => (
        <span
          key={u.key}
          className="grid shrink-0 place-items-center rounded-full font-semibold text-white ring-2 ring-white"
          style={{
            width: size,
            height: size,
            marginLeft: -4,
            backgroundColor: colorFor(u.email),
            fontSize: Math.round(size * 0.4),
          }}
          aria-label={u.email}
        >
          {initials(u.email)}
        </span>
      ))}
      {extra > 0 && (
        <span
          className="grid shrink-0 place-items-center rounded-full bg-black/40 font-semibold text-white ring-2 ring-white"
          style={{
            width: size,
            height: size,
            marginLeft: -4,
            fontSize: Math.round(size * 0.36),
          }}
        >
          +{extra}
        </span>
      )}
    </div>
  );
}
