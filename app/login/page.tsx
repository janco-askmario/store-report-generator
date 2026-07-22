"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Eye, EyeOff, FileText, Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

/** Supabase's raw auth errors leak implementation detail — say it plainly. */
function friendlyError(message: string): string {
  // Reached when sign-in failed *and* the follow-up sign-up was rejected
  // because the account exists — so the password was simply wrong.
  if (/already registered|already exists/i.test(message)) {
    return "Wrong password for this account.";
  }
  if (/signups? not allowed|signup is disabled/i.test(message)) {
    return "New accounts are disabled. Enable sign-ups in Supabase → Authentication → Sign In / Providers.";
  }
  if (/password.*(6|at least)/i.test(message)) {
    return "Password must be at least 6 characters.";
  }
  if (/rate limit|too many/i.test(message)) {
    return "Too many attempts. Wait a minute and try again.";
  }
  return message;
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next") || "/";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(
    searchParams.get("error"),
  );

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    const supabase = createClient();

    // Sign in first; if no such account exists yet, create it on the spot.
    // Keeps email out of the loop entirely — Supabase's built-in sender only
    // allows a couple of messages an hour, which magic links burn instantly.
    const signIn = await supabase.auth.signInWithPassword({ email, password });

    if (signIn.error) {
      if (!/invalid login credentials/i.test(signIn.error.message)) {
        setError(friendlyError(signIn.error.message));
        setSubmitting(false);
        return;
      }

      const signUp = await supabase.auth.signUp({ email, password });
      if (signUp.error) {
        setError(friendlyError(signUp.error.message));
        setSubmitting(false);
        return;
      }
      // No session means Supabase is still set to confirm addresses by email,
      // which defeats the point — the account exists but cannot be used yet.
      if (!signUp.data.session) {
        setError(
          "Account created, but email confirmation is still switched on. " +
            "Turn off “Confirm email” in Supabase → Authentication → Sign In / Providers.",
        );
        setSubmitting(false);
        return;
      }
    }

    // Only ever follow an in-app path, so ?next= can't bounce us off-site.
    router.push(next.startsWith("/") && !next.startsWith("//") ? next : "/");
    router.refresh(); // let the middleware see the new session cookie
  };

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
          Sign in to open the AskMario report library.
        </p>
      </div>

      <form onSubmit={onSubmit} className="space-y-3">
        <div>
          <label
            htmlFor="email"
            className="mb-1.5 block text-[12px] font-semibold uppercase tracking-wide text-ink-soft"
          >
            Email
          </label>
          <input
            id="email"
            type="email"
            required
            autoFocus
            autoComplete="username"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@askmario.com"
            className="w-full rounded-xl border border-black/10 bg-white px-3.5 py-2.5 text-[14px] text-ink outline-none transition placeholder:text-ink-soft/50 focus:border-brand-400 focus:ring-4 focus:ring-brand-500/10"
          />
        </div>

        <div>
          <label
            htmlFor="password"
            className="mb-1.5 block text-[12px] font-semibold uppercase tracking-wide text-ink-soft"
          >
            Password
          </label>
          <div className="relative">
            <input
              id="password"
              type={showPassword ? "text" : "password"}
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-xl border border-black/10 bg-white px-3.5 py-2.5 pr-11 text-[14px] text-ink outline-none transition focus:border-brand-400 focus:ring-4 focus:ring-brand-500/10"
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              aria-label={showPassword ? "Hide password" : "Show password"}
              className="absolute right-1.5 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-lg text-ink-soft transition hover:bg-black/[0.04] hover:text-ink"
            >
              {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
        </div>

        {error && (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-[12px] text-danger">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={submitting}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 px-4 py-2.5 text-[14px] font-semibold text-white shadow-md shadow-brand-500/30 transition hover:brightness-110 disabled:opacity-60"
        >
          {submitting ? (
            <>
              <Loader2 size={16} className="animate-spin" /> Signing in…
            </>
          ) : (
            "Sign in"
          )}
        </button>
      </form>

      <p className="mt-5 text-center text-[12px] text-ink-soft">
        First time? Enter your email and pick a password — your account is
        created automatically.
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
