"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { Menu, X } from "lucide-react";
import type { Presence } from "@/lib/presence";
import { TeamPanel } from "@/components/TeamPanel";
import { cx } from "@/components/ui";

/**
 * The team roster as a column of the app rather than a sheet over it.
 *
 * Open, it takes real width: the header and the page slide across and the
 * reports re-wrap into what is left, so you can read the roster and keep
 * working. That only holds while there is width to give away — below `lg` the
 * same panel goes back to floating over the page with a backdrop, because
 * pushing a 256px column on a 390px phone would leave the reports unreadable.
 *
 * The shell wraps the whole page (header included, which is what "full height"
 * requires), while the button that opens it lives inside the header. They talk
 * through this context rather than through prop-drilling a callback down every
 * page.
 */

const STORAGE_KEY = "team-panel";
const WIDE = "(min-width: 1024px)";
/**
 * Panel width. 16rem is as narrow as the rows go before a name like "Jacques Du
 * Plessis" starts truncating against its status line — and 2rem less of the page
 * to give away when the panel is open.
 */
const WIDTH = "w-64";

interface TeamSidebarContext {
  open: boolean;
  toggle: () => void;
  othersOnline: number;
  registerToggle: (el: HTMLButtonElement | null) => void;
}

const Ctx = createContext<TeamSidebarContext | null>(null);

/*
 * The stored preference is applied before the browser paints, so a returning
 * user never watches the layout jump from closed to open. On the server there is
 * no layout to measure and React warns about useLayoutEffect, hence the swap.
 */
const useIsomorphicLayoutEffect =
  typeof window !== "undefined" ? useLayoutEffect : useEffect;

export function TeamSidebar({
  presence,
  reportNames,
  children,
}: {
  presence: Presence;
  /** Report id → store name, for showing what an online teammate is editing. */
  reportNames: Map<string, string>;
  children: ReactNode;
}) {
  const [wide, setWide] = useState(false);
  const [open, setOpen] = useState(false);
  /** The roster fetches and subscribes, so it waits until first opened. */
  const [mounted, setMounted] = useState(false);
  /** Suppresses the slide animation while the initial state is applied. */
  const [ready, setReady] = useState(false);

  const toggleRef = useRef<HTMLButtonElement | null>(null);
  const closeRef = useRef<HTMLButtonElement | null>(null);
  const wideRef = useRef(false);
  wideRef.current = wide;

  useIsomorphicLayoutEffect(() => {
    const mq = window.matchMedia(WIDE);
    setWide(mq.matches);

    let stored: string | null = null;
    try {
      stored = localStorage.getItem(STORAGE_KEY);
    } catch {
      // Private browsing with storage blocked: fall through to the default.
    }

    // Nobody has said otherwise yet, so start open — the panel is the point of
    // the feature and an empty left edge does not advertise it. Never on a
    // narrow screen, where "open" means "covering the reports".
    const start = mq.matches && stored !== "closed";
    setOpen(start);
    setMounted(start);

    const onChange = (e: MediaQueryListEvent) => {
      setWide(e.matches);
      // Crossing down from a pushing panel to an overlay would turn a layout
      // element into a sheet over the reports. Close it; reopening is one click.
      if (!e.matches) setOpen(false);
    };
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  useEffect(() => {
    const frame = requestAnimationFrame(() => setReady(true));
    return () => cancelAnimationFrame(frame);
  }, []);

  const registerToggle = useCallback((el: HTMLButtonElement | null) => {
    toggleRef.current = el;
  }, []);

  const apply = useCallback((next: boolean) => {
    setOpen(next);
    if (next) setMounted(true);
    // Closing takes the panel out of the tab order (`inert` below), so anything
    // focused inside it — the close button that was just clicked — would take
    // the keyboard nowhere. Hand it back to the control that reopens it.
    if (!next) toggleRef.current?.focus();
    /*
     * Only the pushing layout is a preference worth remembering. Dismissing the
     * overlay on a phone is a one-off gesture, and letting it stick would greet
     * the same person with a closed panel on their desktop tomorrow.
     */
    if (wideRef.current) {
      try {
        localStorage.setItem(STORAGE_KEY, next ? "open" : "closed");
      } catch {
        // Nothing to do — the panel still works, it just won't be remembered.
      }
    }
  }, []);

  const overlay = open && !wide;

  // Modal manners, but only while it is actually behaving like a modal.
  useEffect(() => {
    if (!overlay) return;

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") apply(false);
    };
    window.addEventListener("keydown", onKey);

    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();

    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
      toggleRef.current?.focus();
    };
  }, [overlay, apply]);

  const othersOnline = useMemo(() => {
    const me = presence.me?.toLowerCase() ?? null;
    let n = 0;
    for (const key of presence.byEmail.keys()) if (key !== me) n++;
    return n;
  }, [presence.byEmail, presence.me]);

  const context = useMemo<TeamSidebarContext>(
    () => ({
      open,
      toggle: () => apply(!open),
      othersOnline,
      registerToggle,
    }),
    [open, apply, othersOnline, registerToggle],
  );

  return (
    <Ctx.Provider value={context}>
      <div className="flex min-h-screen w-full">
        {overlay && (
          <div
            onClick={() => apply(false)}
            className="fixed inset-0 z-40 bg-ink/25 backdrop-blur-[2px]"
            aria-hidden
          />
        )}

        <aside
          aria-label="Team"
          // Only a sheet over the page is a dialog. As a column of the layout it
          // is just a region, and calling it a dialog would tell a screen reader
          // the rest of the page is inert when it is not.
          role={overlay ? "dialog" : "complementary"}
          aria-modal={overlay || undefined}
          /* A closed panel is 0px wide with its content clipped, which hides it
             from eyes but not from a screen reader or the Tab key. `inert` is
             what actually takes it out of the page while it is shut. */
          inert={!open}
          className={cx(
            "shrink-0 overflow-hidden bg-white",
            ready && "transition-[width,transform] duration-200 ease-out",
            wide
              ? cx(
                  "sticky top-0 h-screen border-r border-black/5",
                  open ? WIDTH : "w-0",
                )
              : cx(
                  "fixed inset-y-0 left-0 z-50 shadow-2xl",
                  WIDTH,
                  open ? "translate-x-0" : "-translate-x-full",
                ),
          )}
        >
          {/* Fixed inner width: without it the roster would re-wrap on every
              frame of the slide, which reads as a shudder rather than a slide. */}
          <div className={cx("flex h-full flex-col", WIDTH)}>
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
                    onClick={() => apply(false)}
                    aria-label="Close team panel"
                    className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-ink-soft transition hover:bg-black/[0.04] hover:text-ink"
                  >
                    <X size={16} />
                  </button>
                }
              />
            )}
          </div>
        </aside>

        {/* min-w-0 is what lets this column actually shrink — without it the
            grid inside sets a floor and the panel would push the page sideways
            into a horizontal scrollbar instead of re-wrapping the cards. */}
        <div className="min-w-0 flex-1">{children}</div>
      </div>
    </Ctx.Provider>
  );
}

/** The hamburger. Lives in each page's header; drives the panel above. */
export function TeamSidebarToggle({ className }: { className?: string }) {
  const ctx = useContext(Ctx);
  if (!ctx) return null;

  const { open, toggle, othersOnline, registerToggle } = ctx;

  return (
    <button
      ref={registerToggle}
      type="button"
      onClick={toggle}
      aria-label="Team"
      aria-expanded={open}
      title={open ? "Hide the team panel" : "Team — who is online"}
      className={cx(
        "relative grid h-10 w-10 shrink-0 place-items-center rounded-xl border transition",
        open
          ? "border-brand-200 bg-brand-50 text-brand-700"
          : "border-black/10 bg-white text-ink-soft hover:bg-black/[0.03] hover:text-ink",
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
  );
}
