'use client';

import { useEffect, useRef, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { ICONS } from '@/lib/icons';
import { Icon } from './Icon';
import { cx } from './ui';

export function IconPicker({
	value,
	onChange,
	accent = '#7948bf'
}: {
	value: string;
	onChange: (key: string) => void;
	accent?: string;
}) {
	const [open, setOpen] = useState(false);
	const ref = useRef<HTMLDivElement>(null);

	useEffect(() => {
		if (!open) return;
		function onDown(e: MouseEvent) {
			if (ref.current && !ref.current.contains(e.target as Node)) {
				setOpen(false);
			}
		}
		function onEsc(e: KeyboardEvent) {
			if (e.key === 'Escape') setOpen(false);
		}
		document.addEventListener('mousedown', onDown);
		document.addEventListener('keydown', onEsc);
		return () => {
			document.removeEventListener('mousedown', onDown);
			document.removeEventListener('keydown', onEsc);
		};
	}, [open]);

	return (
		<div ref={ref} className="relative">
			<button
				type="button"
				onClick={() => setOpen((o) => !o)}
				className="grid h-11 w-11 place-items-center rounded-xl border-2 text-white shadow-sm transition hover:brightness-105"
				style={{ backgroundColor: accent, borderColor: accent }}
				title="Change icon"
				aria-label="Change block icon"
			>
				<Icon name={value} size={22} strokeWidth={2.2} />
				<ChevronDown
					className="text-ink absolute -right-0.5 -bottom-0.5 rounded-full bg-white shadow"
					size={13}
					strokeWidth={3}
				/>
			</button>

			{open && (
				<div className="animate-pop absolute top-[52px] left-0 z-30 w-64 rounded-2xl border border-black/10 bg-white p-2 shadow-xl shadow-black/10">
					<div className="grid max-h-64 grid-cols-6 gap-1 overflow-y-auto p-1">
						{ICONS.map((ic) => (
							<button
								key={ic.key}
								type="button"
								title={ic.label}
								onClick={() => {
									onChange(ic.key);
									setOpen(false);
								}}
								className={cx(
									'text-ink-soft hover:bg-brand-50 hover:text-brand-600 grid aspect-square place-items-center rounded-lg transition',
									value === ic.key && 'bg-brand-100 text-brand-700 ring-brand-300 ring-1'
								)}
							>
								<Icon name={ic.key} size={20} />
							</button>
						))}
					</div>
				</div>
			)}
		</div>
	);
}
