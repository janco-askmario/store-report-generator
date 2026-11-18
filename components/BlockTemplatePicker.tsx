'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { LayoutTemplate, Loader2, Trash2, X } from 'lucide-react';
import type { BlockTemplate, BlockTemplateKind } from '@/lib/block-templates';
import { Icon } from './Icon';
import { cx } from './ui';

/**
 * Insert a prewritten Good/Bad block.
 *
 * Templates are copied, not linked — the inserted block is an ordinary block, so
 * tailoring it to the store afterwards affects only that report.
 *
 * The chooser is a portalled modal rather than an inline dropdown, and that is
 * forced rather than stylistic: `SectionCard` uses `backdrop-blur`, and
 * `backdrop-filter` both creates a stacking context and becomes the containing
 * block for fixed-position descendants. Anything rendered inside a section is
 * therefore trapped in it — no z-index escapes it, and even `position: fixed`
 * would anchor to the section rather than the viewport. Rendering into
 * document.body is the only way out.
 */
export function BlockTemplatePicker({
	kind,
	templates,
	disabled,
	loading,
	onOpen,
	onInsert,
	onDelete
}: {
	kind: BlockTemplateKind;
	templates: BlockTemplate[];
	disabled?: boolean;
	loading?: boolean;
	onOpen: () => void;
	onInsert: (template: BlockTemplate) => void;
	onDelete: (template: BlockTemplate) => void;
}) {
	const [open, setOpen] = useState(false);

	useEffect(() => {
		if (!open) return;
		function onEsc(e: KeyboardEvent) {
			if (e.key === 'Escape') setOpen(false);
		}
		document.addEventListener('keydown', onEsc);
		// Stop the page scrolling behind the modal.
		const previous = document.body.style.overflow;
		document.body.style.overflow = 'hidden';
		return () => {
			document.removeEventListener('keydown', onEsc);
			document.body.style.overflow = previous;
		};
	}, [open]);

	const mine = templates.filter((t) => t.kind === kind);
	const builtin = mine.filter((t) => t.builtin);
	const saved = mine.filter((t) => !t.builtin);
	const label = kind === 'good' ? 'Good' : 'Bad';

	return (
		<>
			<button
				type="button"
				disabled={disabled}
				onClick={() => {
					setOpen(true);
					// Refresh on open: a teammate may have saved one since this report
					// was opened.
					onOpen();
				}}
				className={cx(
					'flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-dashed py-3.5 text-[14px] font-semibold transition',
					disabled
						? 'text-ink-soft/50 cursor-not-allowed border-black/10'
						: 'border-brand-200 text-brand-700 hover:bg-brand-50'
				)}
			>
				<LayoutTemplate size={17} />
				Insert from template
			</button>

			{open &&
				createPortal(
					<div
						className="fixed inset-0 z-[100] flex items-start justify-center overflow-y-auto bg-black/40 p-4 backdrop-blur-sm sm:items-center"
						onClick={() => setOpen(false)}
						role="dialog"
						aria-modal="true"
						aria-label={`Insert a ${label} block from a template`}
					>
						<div
							className="animate-pop my-auto w-full max-w-xl overflow-hidden rounded-2xl bg-white shadow-2xl"
							onClick={(e) => e.stopPropagation()}
						>
							<header className="flex items-center justify-between gap-3 border-b border-black/5 px-5 py-3.5">
								<div>
									<h2 className="text-ink text-[15px] font-semibold tracking-tight">
										Insert a {label} block
									</h2>
									<p className="text-ink-soft text-[12px]">
										The text is copied in — edit it freely afterwards.
									</p>
								</div>
								<button
									type="button"
									onClick={() => setOpen(false)}
									className="text-ink-soft hover:text-ink grid h-8 w-8 shrink-0 place-items-center rounded-lg transition hover:bg-black/5"
									aria-label="Close"
								>
									<X size={17} />
								</button>
							</header>

							<div className="max-h-[65vh] overflow-y-auto p-2">
								{loading && mine.length === 0 && (
									<div className="grid place-items-center py-10">
										<Loader2 size={20} className="text-ink-soft animate-spin" />
									</div>
								)}

								{!loading && mine.length === 0 && (
									<p className="text-ink-soft px-3 py-10 text-center text-[13px]">
										No templates for this section yet. Save one with the bookmark button on any
										block.
									</p>
								)}

								{builtin.length > 0 && (
									<Group label="Standard">
										{builtin.map((t) => (
											<Row
												key={t.id}
												template={t}
												onInsert={() => {
													onInsert(t);
													setOpen(false);
												}}
											/>
										))}
									</Group>
								)}

								{saved.length > 0 && (
									<Group label="Saved by your team">
										{saved.map((t) => (
											<Row
												key={t.id}
												template={t}
												onInsert={() => {
													onInsert(t);
													setOpen(false);
												}}
												onDelete={() => onDelete(t)}
											/>
										))}
									</Group>
								)}
							</div>
						</div>
					</div>,
					document.body
				)}
		</>
	);
}

function Group({ label, children }: { label: string; children: React.ReactNode }) {
	return (
		<div className="mb-2">
			<div className="text-ink-soft px-3 pt-2 pb-1 text-[11px] font-semibold tracking-wide uppercase">
				{label}
			</div>
			{children}
		</div>
	);
}

function Row({
	template,
	onInsert,
	onDelete
}: {
	template: BlockTemplate;
	onInsert: () => void;
	onDelete?: () => void;
}) {
	return (
		<div className="group/row flex items-start gap-1">
			<button
				type="button"
				onClick={onInsert}
				className="hover:bg-brand-50 flex min-w-0 flex-1 items-start gap-3 rounded-xl px-3 py-2.5 text-left transition"
			>
				<span className="text-brand-600 mt-0.5 shrink-0">
					<Icon name={template.icon} size={18} />
				</span>
				<span className="min-w-0">
					<span className="text-ink block text-[13.5px] font-semibold">
						{template.title || 'Untitled template'}
					</span>
					{/* whitespace-pre-line so the blank line between the body and the
              closing line reads here the same way it will in the PDF. */}
					<span className="text-ink-soft mt-0.5 block text-[12px] leading-snug whitespace-pre-line">
						{template.paragraph}
					</span>
				</span>
			</button>

			{onDelete && (
				<button
					type="button"
					onClick={onDelete}
					title="Delete this template for everyone"
					aria-label={`Delete template ${template.title}`}
					className="text-ink-soft hover:text-danger mt-2 grid h-8 w-8 shrink-0 place-items-center rounded-lg opacity-0 transition group-hover/row:opacity-100 hover:bg-red-50 focus:opacity-100"
				>
					<Trash2 size={15} />
				</button>
			)}
		</div>
	);
}
