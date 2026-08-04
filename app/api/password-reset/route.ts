import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient, findUserIdByEmail } from "@/lib/supabase/admin";

/**
 * Self-serve password reset, without a mailer.
 *
 * The caller proves nothing — they type an address and a new password, and this
 * sets it. What makes that safe is the second half: the account is dropped back
 * to `approved = false` at the same time, so a reset *locks* an account rather
 * than opening it. An outsider who resets a colleague's password gets a nuisance
 * lockout and nothing else; the admin re-approving the row is the identity check
 * that an emailed link would normally be. See 20260804000000_password_reset_requests.sql.
 *
 * Consequences worth keeping in mind when changing this file:
 *   - Revoking approval is not optional. Without it, this endpoint is an
 *     account-takeover API: reset a password, sign in, read everything.
 *   - Revoke *before* setting the password, so a failure part-way through leaves
 *     the account locked rather than open with an attacker-chosen password.
 */

/** Rate-limit window, and the caps inside it. */
const WINDOW_MINUTES = 15;
const MAX_PER_EMAIL = 3;
const MAX_PER_IP = 10;

function bad(error: string, status = 400) {
  return NextResponse.json({ error }, { status });
}

export async function POST(request: NextRequest) {
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return bad("Malformed request.");
  }

  const { email, password } = (payload ?? {}) as {
    email?: unknown;
    password?: unknown;
  };

  if (typeof email !== "string" || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim())) {
    return bad("Enter a valid email address.");
  }
  if (typeof password !== "string" || password.length < 6) {
    return bad("Password must be at least 6 characters.");
  }

  const address = email.trim().toLowerCase();
  // x-forwarded-for is a list, client first, and is only as trustworthy as the
  // proxy in front of us — good enough to slow a flood down, not an identity.
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || null;

  let admin;
  try {
    admin = createAdminClient();
  } catch (err) {
    // Say why, like the middleware does: a silent 500 here looks identical to a
    // wrong password and would send someone hunting in the wrong place.
    console.error("password-reset misconfigured:", err);
    return bad(
      "Password resets are not configured on the server. An admin needs to set " +
        "SUPABASE_SECRET_KEY in the hosting environment.",
      500,
    );
  }

  try {
    const since = new Date(
      Date.now() - WINDOW_MINUTES * 60_000,
    ).toISOString();

    const { count: perEmail } = await admin
      .from("password_reset_requests")
      .select("id", { count: "exact", head: true })
      .eq("email", address)
      .gte("requested_at", since);

    if ((perEmail ?? 0) >= MAX_PER_EMAIL) {
      return bad(
        `Too many reset attempts for that address. Wait ${WINDOW_MINUTES} minutes and try again.`,
        429,
      );
    }

    if (ip) {
      const { count: perIp } = await admin
        .from("password_reset_requests")
        .select("id", { count: "exact", head: true })
        .eq("ip", ip)
        .gte("requested_at", since);

      if ((perIp ?? 0) >= MAX_PER_IP) {
        return bad(
          `Too many reset attempts. Wait ${WINDOW_MINUTES} minutes and try again.`,
          429,
        );
      }
    }

    const userId = await findUserIdByEmail(admin, address);

    // Logged before the mutation, and for unknown addresses too: an attempt that
    // fails half-way still has to count against the rate limit, and a run of
    // unmatched rows is how an admin spots someone guessing at staff addresses.
    await admin.from("password_reset_requests").insert({
      email: address,
      user_id: userId,
      matched: userId !== null,
      ip,
    });

    if (userId) {
      // Lock first — see the header note. A failure after this point leaves the
      // account unusable, which is the direction we want to fail in.
      const { error: lockError } = await admin
        .from("profiles")
        .update({ approved: false })
        .eq("id", userId);

      if (lockError) {
        console.error("password-reset could not revoke approval:", lockError);
        return bad("Could not complete the reset. Try again shortly.", 500);
      }

      const { error: passwordError } = await admin.auth.admin.updateUserById(
        userId,
        { password },
      );

      if (passwordError) {
        console.error("password-reset could not set password:", passwordError);
        return bad("Could not complete the reset. Try again shortly.", 500);
      }
    }
  } catch (err) {
    console.error("password-reset failed:", err);
    return bad("Could not complete the reset. Try again shortly.", 500);
  }

  // Deliberately identical whether or not the address had an account — otherwise
  // this endpoint doubles as a way to find out who works here. A teammate who
  // mistypes their address finds out when the admin sees no request from them.
  return NextResponse.json({ ok: true });
}
