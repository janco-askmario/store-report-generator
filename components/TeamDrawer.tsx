"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Menu, X } from "lucide-react";
import type { Presence } from "@/lib/presence";
import { TeamPanel } from "@/components/TeamPanel";
import { cx } from "@/components/ui";

/**
 * The team roster, one hamburger away from anywhere in the app.
 *
 * It used to sit permanently beside the library, which cost a column of report
 * cards to answer a question people only ask now and then. As a drawer it keeps
 * the same live list without spending any layout on it, and the same control can
 * appear in the editor's header too — hence the button and the panel living in
 * one component rather than the pages each wiring up their own.
 *
 * Presence is passed in, never subscribed to here: `usePresence` publishes this
 * tab under a fresh key, so a second call would show the current user twice in
 * everyone else's list. Each page already holds the subscription it needs — the
 * library for badging cards, the editor for "who else is in this report".
 */
export function TeamDrawer({
  presence,
  reportNames,
  className,
}: {
  presence: Presence;
  /** Report id → store name, for showing what an online teammate is editing. */
  reportNames: Map<string, string>;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  /*
   * The panel reads the profiles table and subscribes to it. Nobody should pay
   * for that on a page where the drawer is never opened, so it is mounted on
   * first open — and left mounted, so re-opening is instant.
   */
  const [mounted, setMounted] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  // How many teammates are on the app right now, so the closed drawer still
  // carries the signal the always-visible panel used to.
  const othersOnline = useMemo(() => {
    const me = presence.me?.toLowerCase() ?? null;
    let n = 0;
    for (const key of presence.byEmail.keys()) if (key !== me) n++;
    return n;
  }, [presence.byEmail, presence.me]);

  useEffect(() => {
    if (!open) return;

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);

    // The drawer covers the page; scrolling what is behind it is never what the
    // wheel was meant for.
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    closeRef.current?.focus();

    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
      // Back where the keyboard was, not at the top of the document.
      triggerRef.current?.focus();
    };
  }, [open]);

  const show = () => {
    setMounted(true);
    setOpen(true);
  };

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={show}
        aria-label="Team"
        aria-expanded={open}
        title="Team — who is online"
        className={cx(
          "relative grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-black/10 bg-white text-ink-soft transition hover:bg-black/[0.03] hover:text-ink",
          className,
        )}
      >
        <Menu size={18} />
        {othersOnline > 0 && (
          <span
            className="absolute -right-1 -top-1 grid h-4 min-w-4 place-items-center rounded-full bg-leaf-500 px-1 text-[10px] font-bold leading-none text-white ring-2 ring-white"
            aria-hidden
          >
            {othersOnline}
          </span>
        )}
        <span className="sr-only">
          {othersOnline > 0
            ? `${othersOnline} teammate${othersOnline > 1 ? "s" : ""} online`
            : "No teammates online"}
        </span>
      </button>

      {/* Kept in the DOM while closed so opening animates rather than appears.
          Above the sticky headers (z-20) on both pages. */}
      <div
        className={cx("fixed inset-0 z-50", !open && "pointer-events-none")}
        aria-hidden={!open}
      >
        <div
          onClick={() => setOpen(false)}
          className={cx(
            "absolute inset-0 bg-ink/25 backdrop-blur-[2px] transition-opacity duration-200",
            open ? "opacity-100" : "opacity-0",
          )}
        />
        <aside
          role="dialog"
          aria-modal="true"
          aria-label="Team"
          className={cx(
            "absolute inset-y-0 left-0 flex w-[19rem] max-w-[85vw] flex-col bg-white shadow-2xl transition-transform duration-200 ease-out",
            open ? "translate-x-0" : "-translate-x-full",
          )}
        >
          {mounted && (
            <TeamPanel
              presence={presence}
              reportNames={reportNames}
              variant="drawer"
              className="min-h-0 flex-1"
              action={
                <button
                  ref={closeRef}
                  type="button"
                  onClick={() => setOpen(false)}
                  aria-label="Close team panel"
                  className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-ink-soft transition hover:bg-black/[0.04] hover:text-ink"
                >
                  <X size={16} />
                </button>
              }
            />
          )}
        </aside>
      </div>
    </>
  );
}
