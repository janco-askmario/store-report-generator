import type { ReactNode } from "react";

/* ---------------------------------------------------------------- utilities */
export function cx(...parts: (string | false | null | undefined)[]): string {
  return parts.filter(Boolean).join(" ");
}

/* ------------------------------------------------------------------- Section */
export function SectionCard({
  title,
  description,
  icon,
  aside,
  children,
  className,
}: {
  title: string;
  description?: string;
  icon?: ReactNode;
  aside?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cx(
        "rounded-2xl border border-black/5 bg-white/90 shadow-sm shadow-brand-900/5 backdrop-blur",
        className,
      )}
    >
      <header className="flex items-start justify-between gap-4 border-b border-black/5 px-5 py-4 sm:px-6">
        <div className="flex items-start gap-3">
          {icon && (
            <div className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-brand-50 text-brand-600">
              {icon}
            </div>
          )}
          <div>
            <h2 className="text-[15px] font-semibold tracking-tight text-ink">
              {title}
            </h2>
            {description && (
              <p className="mt-0.5 text-[13px] leading-snug text-ink-soft">
                {description}
              </p>
            )}
          </div>
        </div>
        {aside}
      </header>
      <div className="px-5 py-5 sm:px-6">{children}</div>
    </section>
  );
}

/* -------------------------------------------------------------------- Fields */
export function Label({
  children,
  htmlFor,
  hint,
}: {
  children: ReactNode;
  htmlFor?: string;
  hint?: string;
}) {
  return (
    <label
      htmlFor={htmlFor}
      className="mb-1.5 flex items-center justify-between text-[13px] font-medium text-ink"
    >
      <span>{children}</span>
      {hint && <span className="text-[12px] font-normal text-ink-soft">{hint}</span>}
    </label>
  );
}

/** Shared by the plain fields here and the collaborative ones in CollabField. */
export const inputBase =
  "w-full rounded-xl border border-black/10 bg-white px-3.5 py-2.5 text-[14px] text-ink outline-none transition placeholder:text-ink-soft/50 focus:border-brand-400 focus:ring-4 focus:ring-brand-100";

export function Field({
  label,
  hint,
  prefix,
  suffix,
  id,
  value,
  onChange,
  placeholder,
  type = "text",
  inputMode,
}: {
  label?: string;
  hint?: string;
  prefix?: string;
  suffix?: string;
  id?: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
  inputMode?: "text" | "numeric" | "decimal";
}) {
  return (
    <div>
      {label && (
        <Label htmlFor={id} hint={hint}>
          {label}
        </Label>
      )}
      <div className="relative flex items-center">
        {prefix && (
          <span className="pointer-events-none absolute left-3.5 text-[14px] text-ink-soft">
            {prefix}
          </span>
        )}
        <input
          id={id}
          type={type}
          inputMode={inputMode}
          value={value}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
          className={cx(inputBase, prefix && "pl-8", suffix && "pr-9")}
        />
        {suffix && (
          <span className="pointer-events-none absolute right-3.5 text-[13px] text-ink-soft">
            {suffix}
          </span>
        )}
      </div>
    </div>
  );
}

export function TextArea({
  label,
  hint,
  id,
  value,
  onChange,
  placeholder,
  rows = 4,
}: {
  label?: string;
  hint?: string;
  id?: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  rows?: number;
}) {
  return (
    <div>
      {label && (
        <Label htmlFor={id} hint={hint}>
          {label}
        </Label>
      )}
      <textarea
        id={id}
        rows={rows}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className={cx(inputBase, "resize-y leading-relaxed")}
      />
    </div>
  );
}

/* -------------------------------------------------------------------- Toggle */
export function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="group inline-flex items-center gap-2.5"
    >
      <span
        className={cx(
          "relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors",
          checked ? "bg-brand-500" : "bg-black/15",
        )}
      >
        <span
          className={cx(
            "inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform",
            checked ? "translate-x-[22px]" : "translate-x-0.5",
          )}
        />
      </span>
      {label && (
        <span className="text-[13px] font-medium text-ink">{label}</span>
      )}
    </button>
  );
}

/* -------------------------------------------------------------------- Metric */
export function MetricPill({
  label,
  value,
  tone = "brand",
  color,
  caption,
}: {
  label: string;
  value: string;
  tone?: "brand" | "leaf" | "neutral";
  color?: string; // hex override (e.g. a benchmark verdict colour)
  caption?: string; // small line under the value (e.g. verdict label)
}) {
  const tones = {
    brand: "border-brand-200 bg-brand-50 text-brand-700",
    leaf: "border-leaf-200 bg-leaf-50 text-leaf-700",
    neutral: "border-black/10 bg-black/[0.03] text-ink-soft",
  } as const;
  return (
    <div
      className={cx(
        "flex flex-col gap-0.5 rounded-xl border px-3.5 py-2.5",
        !color && tones[tone],
      )}
      style={
        color
          ? { borderColor: `${color}55`, backgroundColor: `${color}12`, color }
          : undefined
      }
    >
      <span className="text-[11px] font-medium uppercase tracking-wide opacity-80">
        {label}
      </span>
      <span className="text-[16px] font-semibold tabular-nums text-ink">
        {value}
      </span>
      {caption && (
        <span className="text-[11px] font-semibold" style={color ? { color } : undefined}>
          {caption}
        </span>
      )}
    </div>
  );
}

/* ---------------------------------------------------------------- ScoreRing */
export function ScoreRing({
  score,
  color,
  grade,
  size = 108,
  stroke = 10,
}: {
  score: number | null;
  color: string;
  grade: string;
  size?: number;
  stroke?: number;
}) {
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const pct = score == null ? 0 : Math.max(0, Math.min(100, score)) / 100;
  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#ece6f5" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circ}
          strokeDashoffset={circ * (1 - pct)}
          style={{ transition: "stroke-dashoffset .5s ease, stroke .3s ease" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-[26px] font-bold leading-none tabular-nums text-ink">
          {score == null ? "—" : score}
        </span>
        <span className="text-[11px] font-semibold" style={{ color }}>
          {grade === "—" ? "Unrated" : `Grade ${grade}`}
        </span>
      </div>
    </div>
  );
}
