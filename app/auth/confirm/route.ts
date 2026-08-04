import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

/**
 * Where the emailed password-recovery link lands.
 *
 * Sibling of ../callback/route.ts, which handles the `?code=` a magic link
 * carries. Recovery mail sent from the Supabase dashboard has no browser behind
 * it — nobody generated a PKCE verifier — so it cannot use that exchange.
 * Instead the email template hands over `{{ .TokenHash }}`, and verifyOtp turns
 * it into a session cookie here, on the server, in one hop.
 *
 * The Supabase → Authentication → Emails → Reset Password template has to point
 * at this route for any of that to happen:
 *
 *   {{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery&next=/reset-password
 *
 * The link is single-use and expires (1 hour by default), so a second click
 * fails — that is the invalid-or-expired redirect below, not a bug.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const next = searchParams.get("next") ?? "/";

  // Same rule as the callback route: only ever redirect to a path on this
  // origin, or the link becomes an open redirect.
  const safeNext = next.startsWith("/") && !next.startsWith("//") ? next : "/";

  if (tokenHash && type) {
    const supabase = await createClient();
    const { error } = await supabase.auth.verifyOtp({
      type,
      token_hash: tokenHash,
    });
    if (!error) {
      return NextResponse.redirect(`${origin}${safeNext}`);
    }
  }

  return NextResponse.redirect(
    `${origin}/login?error=${encodeURIComponent(
      "That password reset link is invalid or has expired. Ask an admin to send a new one.",
    )}`,
  );
}
