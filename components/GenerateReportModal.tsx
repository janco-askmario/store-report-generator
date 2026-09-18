"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import {
  Check,
  ChevronLeft,
  FilePlus2,
  Loader2,
  Sparkles,
  X,
} from "lucide-react";
import type { ReportData } from "@/lib/types";
import {
  QUESTIONNAIRE,
  TOTAL_STEPS,
  visibleQuestions,
  type Answers,
  type Question,
} from "@/lib/questionnaire";
import { buildReportFromAnswers } from "@/lib/questionnaire-rules";
import { cx, Field } from "./ui";

/**
 * "New report" now opens here first: start from a blank report, same as
 * before, or answer a fixed questionnaire and have it populate the report's
 * blocks and analytics fields for you. See `lib/questionnaire-rules.ts` for
 * how answers become blocks — deterministic rules, not AI.
 *
 * A portalled modal for the same reason as `BlockTemplatePicker`: the header
 * it's triggered from sits under `backdrop-blur`, which traps fixed-position
 * descendants inside it.
 */
export function GenerateReportModal({
  open,
  onClose,
  onScratch,
  onGenerate,
}: {
  open: boolean;
  onClose: () => void;
  onScratch: () => Promise<void>;
  onGenerate: (data: ReportData) => Promise<void>;
}) {
  const [mode, setMode] = useState<"choice" | "wizard">("choice");
  const [stepIndex, setStepIndex] = useState(0);
  const [answers, setAnswers] = useState<Answers>({});
  const [creating, setCreating] = useState(false);

  // Fresh start every time the modal is opened.
  useEffect(() => {
    if (open) {
      setMode("choice");
      setStepIndex(0);
      setAnswers({});
      setCreating(false);
    }
  }, [open]);

  const hasAnswers = Object.keys(answers).length > 0;
  function requestClose() {
    if (creating) return;
    if (mode === "wizard" && hasAnswers) {
      if (!confirm("Discard your answers and close?")) return;
    }
    onClose();
  }

  // Body-scroll lock only needs to toggle with `open`; the listener is
  // rebound on every relevant state change so it never closes over a stale
  // `creating` and lets Escape slip past the in-flight-request guard above.
  useEffect(() => {
    if (!open) return;
    function onEsc(e: KeyboardEvent) {
      if (e.key === "Escape") requestClose();
    }
    document.addEventListener("keydown", onEsc);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onEsc);
      document.body.style.overflow = previous;
    };
  }, [open, mode, answers, creating]);

  if (!open) return null;

  const step = QUESTIONNAIRE[stepIndex];
  const questions = step ? visibleQuestions(step, answers) : [];
  const isLastStep = stepIndex === TOTAL_STEPS - 1;

  function setAnswer(id: string, value: string | boolean | undefined) {
    setAnswers((a) => ({ ...a, [id]: value }));
  }

  async function handleScratch() {
    setCreating(true);
    try {
      await onScratch();
    } finally {
      setCreating(false);
    }
  }

  async function handleGenerate() {
    setCreating(true);
    try {
      await onGenerate(buildReportFromAnswers(answers));
    } finally {
      setCreating(false);
    }
  }

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-start justify-center overflow-y-auto bg-black/40 p-4 backdrop-blur-sm sm:items-center"
      onClick={requestClose}
      role="dialog"
      aria-modal="true"
      aria-label="New report"
    >
      <div
        className="animate-pop my-auto w-full max-w-xl overflow-hidden rounded-2xl bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {mode === "choice" ? (
          <ChoiceScreen
            creating={creating}
            onClose={requestClose}
            onScratch={handleScratch}
            onGenerate={() => setMode("wizard")}
          />
        ) : (
          <Wizard
            stepIndex={stepIndex}
            step={step}
            questions={questions}
            answers={answers}
            creating={creating}
            isLastStep={isLastStep}
            onAnswer={setAnswer}
            onClose={requestClose}
            onBack={() =>
              stepIndex === 0 ? setMode("choice") : setStepIndex((i) => i - 1)
            }
            onNext={() => setStepIndex((i) => i + 1)}
            onFinish={handleGenerate}
          />
        )}
      </div>
    </div>,
    document.body,
  );
}

/* -------------------------------------------------------------- Choice */

function ChoiceScreen({
  creating,
  onClose,
  onScratch,
  onGenerate,
}: {
  creating: boolean;
  onClose: () => void;
  onScratch: () => void;
  onGenerate: () => void;
}) {
  return (
    <div>
      <header className="flex items-center justify-between gap-3 border-b border-black/5 px-5 py-3.5">
        <h2 className="text-[15px] font-semibold tracking-tight text-ink">
          New report
        </h2>
        <button
          type="button"
          onClick={onClose}
          disabled={creating}
          className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-ink-soft transition hover:bg-black/5 hover:text-ink disabled:opacity-40"
          aria-label="Close"
        >
          <X size={17} />
        </button>
      </header>

      <div className="grid gap-3 p-5 sm:grid-cols-2">
        <button
          type="button"
          disabled={creating}
          onClick={onScratch}
          className="flex flex-col items-start gap-3 rounded-2xl border-2 border-black/10 p-5 text-left transition hover:border-brand-300 hover:bg-brand-50/50 disabled:pointer-events-none disabled:opacity-60"
        >
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-black/[0.04] text-ink-soft">
            {creating ? (
              <Loader2 size={18} className="animate-spin" />
            ) : (
              <FilePlus2 size={18} />
            )}
          </span>
          <span>
            <span className="block text-[14px] font-semibold text-ink">
              Start from scratch
            </span>
            <span className="mt-1 block text-[12.5px] leading-snug text-ink-soft">
              A blank report. Fill in the store's details and blocks by hand.
            </span>
          </span>
        </button>

        <button
          type="button"
          disabled={creating}
          onClick={onGenerate}
          className="flex flex-col items-start gap-3 rounded-2xl border-2 border-brand-200 bg-brand-50/40 p-5 text-left transition hover:border-brand-400 hover:bg-brand-50 disabled:pointer-events-none disabled:opacity-60"
        >
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-brand-100 text-brand-700">
            <Sparkles size={18} />
          </span>
          <span>
            <span className="block text-[14px] font-semibold text-ink">
              Generate report
            </span>
            <span className="mt-1 block text-[12.5px] leading-snug text-ink-soft">
              Answer a short audit questionnaire and we'll pick the matching
              Good/Bad blocks and fill in the numbers for you.
            </span>
          </span>
        </button>
      </div>
    </div>
  );
}

/* --------------------------------------------------------------- Wizard */

function Wizard({
  stepIndex,
  step,
  questions,
  answers,
  creating,
  isLastStep,
  onAnswer,
  onClose,
  onBack,
  onNext,
  onFinish,
}: {
  stepIndex: number;
  step: (typeof QUESTIONNAIRE)[number];
  questions: Question[];
  answers: Answers;
  creating: boolean;
  isLastStep: boolean;
  onAnswer: (id: string, value: string | boolean | undefined) => void;
  onClose: () => void;
  onBack: () => void;
  onNext: () => void;
  onFinish: () => void;
}) {
  const progress = useMemo(
    () => ((stepIndex + 1) / TOTAL_STEPS) * 100,
    [stepIndex],
  );

  return (
    <div>
      <header className="border-b border-black/5 px-5 py-4">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onBack}
              disabled={creating}
              className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-ink-soft transition hover:bg-black/5 hover:text-ink disabled:opacity-40"
              aria-label="Back"
            >
              <ChevronLeft size={17} />
            </button>
            <span className="text-[12px] font-semibold uppercase tracking-wide text-ink-soft">
              Step {stepIndex + 1} of {TOTAL_STEPS}
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={creating}
            className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-ink-soft transition hover:bg-black/5 hover:text-ink disabled:opacity-40"
            aria-label="Close"
          >
            <X size={17} />
          </button>
        </div>
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-black/[0.06]">
          <div
            className="h-full rounded-full bg-gradient-to-r from-brand-500 to-leaf-500 transition-[width] duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
        <h2 className="mt-3 text-[16px] font-semibold tracking-tight text-ink">
          {step.title}
        </h2>
        <p className="mt-0.5 text-[12.5px] text-ink-soft">{step.description}</p>
      </header>

      <div className="max-h-[55vh] space-y-5 overflow-y-auto p-5">
        {questions.map((q) => (
          <QuestionField
            key={q.id}
            question={q}
            value={answers[q.id]}
            onChange={(v) => onAnswer(q.id, v)}
          />
        ))}
      </div>

      <footer className="flex items-center justify-between gap-3 border-t border-black/5 px-5 py-3.5">
        <button
          type="button"
          onClick={onBack}
          disabled={creating}
          className="rounded-xl px-3.5 py-2.5 text-[13px] font-semibold text-ink-soft transition hover:bg-black/[0.04] hover:text-ink disabled:opacity-40"
        >
          Back
        </button>
        {isLastStep ? (
          <button
            type="button"
            onClick={onFinish}
            disabled={creating}
            className="flex items-center gap-2 rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 px-4 py-2.5 text-[13px] font-semibold text-white shadow-md shadow-brand-500/30 transition hover:brightness-110 disabled:pointer-events-none disabled:opacity-70"
          >
            {creating ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <Check size={16} />
            )}
            Generate report
          </button>
        ) : (
          <button
            type="button"
            onClick={onNext}
            disabled={creating}
            className="rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 px-4 py-2.5 text-[13px] font-semibold text-white shadow-md shadow-brand-500/30 transition hover:brightness-110 disabled:opacity-40"
          >
            Next
          </button>
        )}
      </footer>
    </div>
  );
}

function QuestionField({
  question,
  value,
  onChange,
}: {
  question: Question;
  value: string | boolean | undefined;
  onChange: (value: string | boolean | undefined) => void;
}) {
  if (question.type === "boolean") {
    return (
      <div>
        <span className="mb-2 block text-[13.5px] font-medium leading-snug text-ink">
          {question.label}
        </span>
        {question.hint && (
          <span className="mb-2 block text-[12px] text-ink-soft">
            {question.hint}
          </span>
        )}
        <div className="flex gap-2">
          <YesNoButton
            active={value === true}
            tone="yes"
            onClick={() => onChange(value === true ? undefined : true)}
          >
            {question.yesLabel || "Yes"}
          </YesNoButton>
          <YesNoButton
            active={value === false}
            tone="no"
            onClick={() => onChange(value === false ? undefined : false)}
          >
            {question.noLabel || "No"}
          </YesNoButton>
        </div>
      </div>
    );
  }

  const strValue = typeof value === "string" ? value : "";

  return (
    <Field
      label={question.label}
      hint={question.hint}
      value={strValue}
      onChange={onChange}
      placeholder={question.placeholder}
      prefix={question.prefix}
      suffix={question.suffix}
      type={question.type === "date" ? "date" : "text"}
      inputMode={question.type === "number" ? "decimal" : "text"}
    />
  );
}

function YesNoButton({
  active,
  tone,
  onClick,
  children,
}: {
  active: boolean;
  tone: "yes" | "no";
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cx(
        "flex-1 rounded-xl border-2 px-4 py-2.5 text-[13.5px] font-semibold transition",
        active && tone === "yes" && "border-leaf-400 bg-leaf-50 text-leaf-700",
        active && tone === "no" && "border-orange-300 bg-orange-50 text-orange-700",
        !active &&
          "border-black/10 text-ink-soft hover:border-black/20 hover:bg-black/[0.02]",
      )}
    >
      {children}
    </button>
  );
}
