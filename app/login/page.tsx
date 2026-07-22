"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Eye, EyeOff, FileText, Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { cx } from "@/components/ui";

type Mode = "signin" | "signup";

/** Supabase's raw auth errors leak implementation detail — say it plainly. */
function friendlyError(message: string, mode: Mode): string {
  if (/invalid login credentials/i.test(message)) {
    return mode === "signin"
      ? "No account matches that email and password. If you're new, create an account first."
      : "Those details were rejected.";
  }
  if (/already registered|already exists/i.test(message)) {
    return "An account with this email already exists — switch to Sign in.";
  }
  if (/signups? not allowed|signup is disabled/i.test(message)) {
    return "New accounts are disabled in Supabase → Authentication → Sign In / Providers.";
  }
  if (/password/i.test(message) && /6|at least|short/i.test(message)) {
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

  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(searchParams.get("error"));

  const switchMode = (m: Mode) => {
    setMode(m);
    setError(null);
    setConfirm("");
  };

  const goToApp = () => {
    // Only ever follow an in-app path, so ?next= can't bounce us off-site.
    router.push(next.startsWith("/") && !next.startsWith("//") ? next : "/");
    router.refresh(); // let the middleware see the new session cookie
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (mode === "signup") {
      if (password !== confirm) {
        setError("The two passwords don't match.");
        return;
      }
      if (password.length < 6) {
        setError("Password must be at least 6 characters.");
        return;
      }
    }

    setSubmitting(true);
    const supabase = createClient();

    if (mode === "signin") {
      // Strictly a sign-in: an unknown email is an error, never a new account.
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) {
        setError(friendlyError(error.message, "signin"));
        setSubmitting(false);
        return;
      }
    } else {
      const { data, error } = await supabase.auth.signUp({ email, password });
      if (error) {
        setError(friendlyError(error.message, "signup"));
        setSubmitting(false);
        return;
      }
      // No session means Supabase is still set to confirm addresses by email,
      // which defeats the point — the account exists but cannot be used yet.
      if (!data.session) {
        setError(
          "Account created, but email confirmation is switched on. Turn off " +
            "“Confirm email” in Supabase → Authentication → Sign In / Providers.",
        );
        setSubmitting(false);
        return;
      }
    }

    goToApp();
  };

  const isSignup = mode === "signup";

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
          {isSignup
            ? "Create an account to join the AskMario report library."
            : "Sign in to open the AskMario report library."}
        </p>
      </div>

      {/* Mode switch */}
      <div
        role="tablist"
        aria-label="Sign in or create account"
        className="mb-5 grid grid-cols-2 gap-1 rounded-xl bg-black/[0.04] p-1"
      >
        {(
          [
            ["signin", "Sign in"],
            ["signup", "Create account"],
          ] as const
        ).map(([value, label]) => (
          <button
            key={value}
            role="tab"
            type="button"
            aria-selected={mode === value}
            onClick={() => switchMode(value)}
            className={cx(
              "rounded-lg px-3 py-2 text-[13px] font-semibold transition",
              mode === value
                ? "bg-white text-brand-700 shadow-sm"
                : "text-ink-soft hover:text-ink",
            )}
          >
            {label}
          </button>
        ))}
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
              autoComplete={isSignup ? "new-password" : "current-password"}
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
          {isSignup && (
            <p className="mt-1.5 text-[11px] text-ink-soft">
              At least 6 characters.
            </p>
          )}
        </div>

        {/* Typos are unrecoverable without email resets, so confirm on signup. */}
        {isSignup && (
          <div>
            <label
              htmlFor="confirm"
              className="mb-1.5 block text-[12px] font-semibold uppercase tracking-wide text-ink-soft"
            >
              Confirm password
            </label>
            <input
              id="confirm"
              type={showPassword ? "text" : "password"}
              required
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              className="w-full rounded-xl border border-black/10 bg-white px-3.5 py-2.5 text-[14px] text-ink outline-none transition focus:border-brand-400 focus:ring-4 focus:ring-brand-500/10"
            />
          </div>
        )}

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
              <Loader2 size={16} className="animate-spin" />
              {isSignup ? "Creating account…" : "Signing in…"}
            </>
          ) : isSignup ? (
            "Create account"
          ) : (
            "Sign in"
          )}
        </button>
      </form>

      <p className="mt-5 text-center text-[12px] text-ink-soft">
        {isSignup ? (
          <>
            Already have an account?{" "}
            <button
              type="button"
              onClick={() => switchMode("signin")}
              className="font-semibold text-brand-700 underline-offset-2 hover:underline"
            >
              Sign in
            </button>
          </>
        ) : (
          <>
            First time here?{" "}
            <button
              type="button"
              onClick={() => switchMode("signup")}
              className="font-semibold text-brand-700 underline-offset-2 hover:underline"
            >
              Create an account
            </button>
          </>
        )}
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
