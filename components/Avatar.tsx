"use client";

import { avatarFor, colorFor, initials } from "@/lib/avatars";
import { cx } from "@/components/ui";

/**
 * One person, one circle — their pixel portrait if they have one, their coloured
 * initials if they don't.
 *
 * Shared by the roster and the presence stacks so the same person is never two
 * different things on one screen. The coloured disc stays behind the picture:
 * the sprites are transparent around the head, and the colour is what keeps a
 * portrait legible against the white panel.
 */
export function Avatar({
  email,
  size = 32,
  dimmed = false,
  className,
}: {
  email: string;
  size?: number;
  /** Offline teammates fade back without leaving the list. */
  dimmed?: boolean;
  className?: string;
}) {
  const src = avatarFor(email);

  return (
    <span
      className={cx(
        "grid shrink-0 place-items-center overflow-hidden rounded-full font-semibold text-white transition",
        dimmed && "opacity-40",
        className,
      )}
      style={{
        width: size,
        height: size,
        backgroundColor: colorFor(email),
        fontSize: Math.round(size * 0.4),
      }}
      aria-hidden
    >
      {src ? (
        // Not next/image: these are 16×16 sprites, so there is nothing to
        // optimise and resampling is exactly what must not happen to them.
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="" className="pixel-art h-full w-full object-cover" />
      ) : (
        initials(email)
      )}
    </span>
  );
}
