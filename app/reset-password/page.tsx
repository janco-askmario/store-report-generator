"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { CheckCircle2, Eye, EyeOff, Loader2, TriangleAlert } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

/**
 * Where a password-recovery link finishes: pick a new password.
 *
 * Reaching this page *is* the proof of identity — the emailed link has already
 * been redeemed for a session by /auth/confirm, so all that is left is
 * `updateUser`. No current-password field, because the whole point is that they
 * don't have it.
 *
 * Two ways a session can be here by the time this renders:
 *   - the recommended one, cookies set server-side by /auth/confirm; or
 *   - Supabase's stock `{{ .ConfirmationURL }}` template, which bounces through
 *     the Supabase verify endpoint and lands here with tokens in the URL
 *     *fragment*. Those never reach the server, so the middleware sees no user —
 *     which is why /reset-password is a public path. The browser client picks
 *     the fragment up on its own and fires onAuthStateChange, hence the wait
 *     below rather than an immediate "invalid link".
 */

type Status = "checking" | "ready" | "invalid" | "done";

/** Supabase's raw auth errors leak implementation detail — say it plainly. */
function friendlyError(message: string): string {
  if (/should be different|same as the old/i.test(message)) {
    return "That is already your password — pick a different one.";
  }
  if (/session|jwt|token/i.test(message)) {
    return "This reset link has expired. Ask an admin to send a new one.";
  }
  if (/password/i.test(message) && /6|at least|short/i.test(message)) {
    return "Password must be at least 6 characters.";
  }
  if (/rate limit|too many/i.test(message)) {
    return "Too many attempts. Wait a minute and try again.";
  }
  return message;
}

export default function ResetPasswordPage() {
  const router = useRouter();
  const [status, setStatus] = useState<Status>("checking");
  const [email, setEmail] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const settled = useRef(false);

  useEffect(() => {
    const supabase = createClient();

    const ready = (address: string | undefined) => {
      if (settled.current) return;
      settled.current = true;
      setEmail(address ?? null);
      setStatus("ready");
    };

    // Fires when the client finishes reading a #access_token fragment out of
    // the URL, which it does asynchronously after mount.
    const { data: listener } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        if (session) ready(session.user.email);
      },
    );

    // Give that fragment path a moment before calling the link dead: the
    // cookie path resolves on the first check, so this only ever delays the
    // genuinely broken case.
    let timer: ReturnType<typeof setTimeout> | null = null;

    supabase.auth.getSession().then(({ data }) => {
      if (data.session) {
        ready(data.session.user.email);
        return;
      }
      timer = setTimeout(async () => {
        const { data: retry } = await supabase.auth.getSession();
        if (retry.session) ready(retry.session.user.email);
        else if (!settled.current) {
          settled.current = true;
          setStatus("invalid");
        }
      }, 1500);
    });

    return () => {
      listener.subscription.unsubscribe();
      if (timer) clearTimeout(timer);
    };
  }, []);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password !== confirm) {
      setError("The two passwords don't match.");
      return;
    }
    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }

    setSubmitting(true);
    const { error } = await createClient().auth.updateUser({ password });

    if (error) {
      setError(friendlyError(error.message));
      setSubmitting(false);
      return;
    }

    // They are already signed in on the new password. Send them at the app and
    // let the middleware sort out where they belong — the reports if approved,
    // the holding page if an admin hasn't let them in yet.
    setStatus("done");
    router.push("/");
    router.refresh();
  };

  return (
    <div className="app-bg grid min-h-screen place-items-center px-4">
      <div className="w-full max-w-sm rounded-2xl border border-black/5 bg-white/90 p-7 shadow-sm shadow-brand-900/5 backdrop-blur">
        <div className="mb-6 text-center">
          <Image
            src="/AskMario-logo.png"
            alt="AskMario"
            width={1400}
            height={500}
            priority
            className="mx-auto mb-4 h-11 w-auto"
          />
          <h1 className="text-[18px] font-semibold tracking-tight text-ink">
            Choose a new password
          </h1>
          {status === "ready" && (
            <p className="mt-1 text-[13px] text-ink-soft">
              {email ? (
                <>
                  Setting a new password for{" "}
                  <span className="font-semibold text-ink">{email}</span>.
                </>
              ) : (
                "Set a new password and you're back in."
              )}
            </p>
          )}
        </div>

        {status === "checking" && (
          <div className="grid place-items-center py-10">
            <Loader2 className="animate-spin text-ink-soft" size={22} />
          </div>
        )}

        {status === "invalid" && (
          <div className="text-center">
            <TriangleAlert className="mx-auto mb-3 text-danger" size={26} />
            <p className="text-[13px] text-ink-soft">
              This reset link is invalid, already used, or has expired. Ask an
              admin to send a new one from Supabase.
            </p>
            <Link
              href="/login"
              className="mt-5 inline-flex w-full items-center justify-center rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 px-4 py-2.5 text-[14px] font-semibold text-white shadow-md shadow-brand-500/30 transition hover:brightness-110"
            >
              Back to sign in
            </Link>
          </div>
        )}

        {status === "done" && (
          <div className="grid place-items-center gap-3 py-8 text-center">
            <CheckCircle2 className="text-emerald-600" size={26} />
            <p className="text-[13px] text-ink-soft">
              Password updated — opening the report library…
            </p>
          </div>
        )}

        {status === "ready" && (
          <form onSubmit={onSubmit} className="space-y-3">
            {/* Tells a password manager which login it is updating — without a
                username field it offers to save an entry with no account. */}
            <input
              type="text"
              name="email"
              autoComplete="username"
              value={email ?? ""}
              readOnly
              hidden
            />

            <div>
              <label
                htmlFor="password"
                className="mb-1.5 block text-[12px] font-semibold uppercase tracking-wide text-ink-soft"
              >
                New password
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  required
                  autoFocus
                  autoComplete="new-password"
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
              <p className="mt-1.5 text-[11px] text-ink-soft">
                At least 6 characters.
              </p>
            </div>

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
                  Saving…
                </>
              ) : (
                "Save password"
              )}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
