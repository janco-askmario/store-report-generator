"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { FileText, Loader2, MailCheck } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

function LoginForm() {
  const searchParams = useSearchParams();
  const next = searchParams.get("next") || "/";

  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent">("idle");
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus("sending");
    setError(null);

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
      },
    });

    if (error) {
      setError(error.message);
      setStatus("idle");
    } else {
      setStatus("sent");
    }
  };

  if (status === "sent") {
    return (
      <div className="text-center">
        <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-leaf-50 text-leaf-700">
          <MailCheck size={26} />
        </div>
        <h1 className="text-[18px] font-semibold text-ink">Check your inbox</h1>
        <p className="mt-1.5 text-[13px] text-ink-soft">
          We sent a sign-in link to <span className="font-medium text-ink">{email}</span>.
          Open it on this device to continue.
        </p>
        <button
          onClick={() => setStatus("idle")}
          className="mt-5 text-[13px] font-medium text-brand-700 underline-offset-2 hover:underline"
        >
          Use a different email
        </button>
      </div>
    );
  }

  return (
    <>
      <div className="mb-6 text-center">
        <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-br from-brand-500 to-brand-700 text-white shadow-md shadow-brand-500/30">
          <FileText size={26} />
        </div>
        <h1 className="text-[18px] font-semibold tracking-tight text-ink">
          Store Reports
        </h1>
        <p className="mt-1 text-[13px] text-ink-soft">
          Sign in to open your AskMario report library.
        </p>
      </div>

      <form onSubmit={onSubmit} className="space-y-3">
        <div>
          <label
            htmlFor="email"
            className="mb-1.5 block text-[12px] font-semibold uppercase tracking-wide text-ink-soft"
          >
            Work email
          </label>
          <input
            id="email"
            type="email"
            required
            autoFocus
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@askmario.com"
            className="w-full rounded-xl border border-black/10 bg-white px-3.5 py-2.5 text-[14px] text-ink outline-none transition placeholder:text-ink-soft/50 focus:border-brand-400 focus:ring-4 focus:ring-brand-500/10"
          />
        </div>

        {error && (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-[12px] text-danger">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={status === "sending"}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 px-4 py-2.5 text-[14px] font-semibold text-white shadow-md shadow-brand-500/30 transition hover:brightness-110 disabled:opacity-60"
        >
          {status === "sending" ? (
            <>
              <Loader2 size={16} className="animate-spin" /> Sending link…
            </>
          ) : (
            "Email me a sign-in link"
          )}
        </button>
      </form>

      <p className="mt-5 text-center text-[12px] text-ink-soft">
        No password needed — the link signs you in.
      </p>
    </>
  );
}

export default function LoginPage() {
  return (
    <div className="app-bg grid min-h-screen place-items-center px-4">
      <div className="w-full max-w-sm rounded-2xl border border-black/5 bg-white/90 p-7 shadow-sm shadow-brand-900/5 backdrop-blur">
        <Suspense
          fallback={
            <div className="grid place-items-center py-10">
              <Loader2 className="animate-spin text-ink-soft" size={22} />
            </div>
          }
        >
          <LoginForm />
        </Suspense>
      </div>
    </div>
  );
}
