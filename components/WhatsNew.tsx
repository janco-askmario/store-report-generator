'use client';

import { useEffect, useRef, useState } from 'react';
import { Info, Sparkles, X } from 'lucide-react';
import { CHANGELOG, LATEST_CHANGE, formatChangeDate } from '@/lib/changelog';
import { cx } from '@/components/ui';

/**
 * The ⓘ in the top-right corner: what has changed in the app lately.
 *
 * The dot on the icon is the whole point of it being a header control rather
 * than a page — people find out that undo exists without anyone having to send
 * a message about it. "Read" is the id of the newest entry, kept per browser in
 * localStorage; a new entry in `lib/changelog.ts` brings the dot back.
 *
 * A plain absolutely-positioned dropdown, not a portal: it is anchored to its
 * own button, and the header it sits in already paints above the page.
 */

const READ_KEY = 'askmario:whats-new-read';

export function WhatsNew({ className }: { className?: string }) {
	const [open, setOpen] = useState(false);
	// Starts false so the server's markup and the first client render agree; the
	// effect below is what turns it on.
	const [unread, setUnread] = useState(false);
	const rootRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		try {
			setUnread(localStorage.getItem(READ_KEY) !== LATEST_CHANGE.id);
		} catch {
			// Private mode, blocked storage — the panel still works, it just cannot
			// remember that it has been read.
		}
	}, []);

	useEffect(() => {
		if (!open) return;

		const onKey = (e: KeyboardEvent) => {
			if (e.key === 'Escape') setOpen(false);
		};
		// pointerdown rather than click: closing on the way down feels immediate,
		// and a click that started inside the panel never counts as "outside".
		const onPointerDown = (e: PointerEvent) => {
			if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
		};

		window.addEventListener('keydown', onKey);
		document.addEventListener('pointerdown', onPointerDown);
		return () => {
			window.removeEventListener('keydown', onKey);
			document.removeEventListener('pointerdown', onPointerDown);
		};
	}, [open]);

	const toggle = () => {
		setOpen((was) => !was);
		if (unread) {
			setUnread(false);
			try {
				localStorage.setItem(READ_KEY, LATEST_CHANGE.id);
			} catch {
				/* see above */
			}
		}
	};

	return (
		<div ref={rootRef} className={cx('relative', className)}>
			<button
				type="button"
				onClick={toggle}
				aria-expanded={open}
				aria-label="What's new"
				title="What's new"
				className={cx(
					'relative grid h-10 w-10 place-items-center rounded-xl transition',
					open ? 'bg-brand-50 text-brand-600' : 'text-ink-soft hover:text-ink hover:bg-black/[0.04]'
				)}
			>
				<Info size={18} />
				{unread && (
					<span
						aria-hidden
						className="bg-brand-500 absolute top-1.5 right-1.5 h-2 w-2 rounded-full ring-2 ring-white"
					/>
				)}
				{unread && <span className="sr-only">— unread updates</span>}
			</button>

			{open && (
				<div
					role="dialog"
					aria-label="What's new"
					/* The width is capped against the viewport, not just the panel's own
             taste: right-aligned to a button that already sits ~60px in from the
             screen edge, a full 23rem would hang off the left on a phone. */
					className="animate-pop shadow-brand-900/10 absolute top-full right-0 z-30 mt-2 w-[min(23rem,calc(100vw-4.5rem))] overflow-hidden rounded-2xl border border-black/5 bg-white shadow-xl"
				>
					<header className="flex items-center justify-between gap-2 border-b border-black/5 px-4 py-3">
						<div className="flex items-center gap-2">
							<span className="bg-brand-50 text-brand-600 grid h-7 w-7 place-items-center rounded-lg">
								<Sparkles size={15} />
							</span>
							<h2 className="text-ink-soft text-[13px] font-semibold tracking-wide uppercase">
								What&rsquo;s new
							</h2>
						</div>
						<button
							type="button"
							onClick={() => setOpen(false)}
							aria-label="Close what's new"
							className="text-ink-soft hover:text-ink grid h-8 w-8 shrink-0 place-items-center rounded-lg transition hover:bg-black/[0.04]"
						>
							<X size={16} />
						</button>
					</header>

					<div className="max-h-[min(28rem,70vh)] overflow-y-auto px-4 py-3">
						{CHANGELOG.map((entry, i) => (
							<section
								key={entry.id}
								className={cx('py-3', i > 0 && 'border-t border-black/5', i === 0 && 'pt-1')}
							>
								<div className="mb-1.5 flex items-baseline gap-2">
									<h3 className="text-ink text-[13px] leading-snug font-semibold">{entry.title}</h3>
									{i === 0 && (
										<span className="bg-leaf-100 text-leaf-700 shrink-0 rounded-md px-1.5 py-px text-[10px] font-semibold tracking-wide uppercase">
											Latest
										</span>
									)}
								</div>
								<p className="text-ink-soft/70 mb-2 text-[11px] font-medium tracking-wide uppercase">
									{formatChangeDate(entry.date)}
								</p>
								<ul className="space-y-1.5">
									{entry.items.map((item, j) => (
										<li key={j} className="text-ink-soft flex gap-2 text-[12.5px] leading-relaxed">
											<span
												aria-hidden
												className="bg-brand-300 mt-[7px] h-1 w-1 shrink-0 rounded-full"
											/>
											<span className="min-w-0">{item}</span>
										</li>
									))}
								</ul>
							</section>
						))}
					</div>
				</div>
			)}
		</div>
	);
}
