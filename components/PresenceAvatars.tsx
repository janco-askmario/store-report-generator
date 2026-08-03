"use client";

import type { PresentUser } from "@/lib/presence";
import { Avatar } from "./Avatar";
import { cx } from "./ui";

/**
 * The overlapping stack of who is in a report. One `Avatar` each — the picture,
 * the colour and the initials all live in `lib/avatars.ts`, so a face here and
 * the same face in the team drawer can never drift apart.
 */
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
      {/* -ml-1 is the 4px overlap the stack has always had. */}
      {shown.map((u) => (
        <Avatar
          key={u.key}
          email={u.email}
          size={size}
          className="-ml-1 ring-2 ring-white"
        />
      ))}
      {extra > 0 && (
        <span
          className="-ml-1 grid shrink-0 place-items-center rounded-full bg-black/40 font-semibold text-white ring-2 ring-white"
          style={{
            width: size,
            height: size,
            fontSize: Math.round(size * 0.36),
          }}
        >
          +{extra}
        </span>
      )}
    </div>
  );
}
