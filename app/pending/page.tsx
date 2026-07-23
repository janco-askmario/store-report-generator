"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Clock, Loader2, LogOut, RefreshCw } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { cx } from "@/components/ui";

/**
 * Holding page for signed-in accounts that an admin has not approved yet. The
 * middleware sends every unapproved user here and keeps approved users out, so
 * "Check again" just navigates to the app and lets the middleware decide: it
 * lands on the reports if approval has come through, or bounces straight back.
 */
export default function PendingPage() {
  const router = useRouter();
  const [email, setEmail] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    createClient()
      .auth.getUser()
      .then(({ data }) => setEmail(data.user?.email ?? null));
  }, []);

  const onCheck = () => {
    setChecking(true);
    router.push("/");
    router.refresh();
  };

  const onSignOut = async () => {
    await createClient().auth.signOut();
    router.push("/login");
    router.refresh();
  };

  return (
    <div className="app-bg grid min-h-screen place-items-center px-4">
      <div className="w-full max-w-md rounded-2xl border border-black/5 bg-white/90 p-8 text-center shadow-sm shadow-brand-900/5 backdrop-blur">
        <Image
          src="/AskMario-logo.png"
          alt="AskMario"
          width={1400}
          height={500}
          priority
          className="mx-auto mb-5 h-10 w-auto"
        />
        <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-brand-50 text-brand-600">
          <Clock size={26} />
        </div>
        <h1 className="text-[18px] font-semibold tracking-tight text-ink">
          Waiting for approval
        </h1>
        <p className="mx-auto mt-2 max-w-xs text-[13px] leading-relaxed text-ink-soft">
          Your account
          {email ? (
            <>
              {" "}
              (<span className="font-medium text-ink">{email}</span>)
            </>
          ) : null}{" "}
          has been created and is waiting for an administrator to approve access.
          You&apos;ll be able to sign in as soon as it&apos;s approved.
        </p>

        <div className="mt-6 flex flex-col gap-2">
          <button
            onClick={onCheck}
            disabled={checking}
            className={cx(
              "flex items-center justify-center gap-2 rounded-xl bg-gradient-to-br from-brand-500 to-brand-700",
              "px-4 py-2.5 text-[14px] font-semibold text-white shadow-md shadow-brand-500/30 transition hover:brightness-110 disabled:opacity-60",
            )}
          >
            {checking ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <RefreshCw size={16} />
            )}
            Check again
          </button>
          <button
            onClick={onSignOut}
            className="flex items-center justify-center gap-1.5 rounded-xl px-4 py-2.5 text-[13px] font-medium text-ink-soft transition hover:bg-black/[0.04] hover:text-ink"
          >
            <LogOut size={15} /> Sign out
          </button>
        </div>
      </div>
    </div>
  );
}
