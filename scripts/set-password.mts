/**
 * Admin password reset, without a mailer.
 *
 * Supabase's own "forgot password" flow emails a recovery link, and this app has
 * no email service wired up — so when somebody forgets their password an admin
 * sets a new one for them here and hands it over in person/Slack. The user can
 * sign in with it immediately; nothing else about the account changes (approval
 * state, reports, profile row all stay as they are).
 *
 * That is the difference from the in-app "Forgot password?" flow, which anyone
 * can trigger and which therefore revokes approval until an admin vouches for
 * the request (app/api/password-reset/route.ts). Running this script *is* an
 * admin vouching, so it leaves approval alone — and it stays the way back in
 * when an admin locks themselves out.
 *
 *   # Set a specific password:
 *   NEW_PASSWORD='whatever-they-picked' \
 *   npx tsx --tsconfig tsconfig.script.json scripts/set-password.mts someone@askmario.com
 *
 *   # Or let it generate one and print it:
 *   npx tsx --tsconfig tsconfig.script.json scripts/set-password.mts someone@askmario.com
 *
 * Needs the project's secret key (sb_secret_… , or the older service_role JWT)
 * in SUPABASE_SECRET_KEY / SUPABASE_SERVICE_ROLE_KEY — the admin API is the only
 * way to overwrite a password, and it refuses anything less. Keep that key out
 * of NEXT_PUBLIC_* and out of git: read from .env.local, or paste it inline for
 * the one command. Pass --dry-run to check the account exists without writing.
 */
import { readFileSync, existsSync } from "node:fs";
import { randomBytes } from "node:crypto";
import { createAdminClient, findUserIdByEmail } from "../lib/supabase/admin";

/* ------------------------------------------------------------- tiny .env load */

for (const file of [".env.local", ".env"]) {
  if (!existsSync(file)) continue;
  for (const line of readFileSync(file, "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (!m) continue;
    const key = m[1];
    let val = m[2].trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = val;
  }
}

const DRY_RUN = process.argv.includes("--dry-run");
const email = process.argv.slice(2).find((a) => !a.startsWith("--"));

function fail(message: string): never {
  console.error(`\n  ${message}\n`);
  process.exit(1);
}

if (!email) {
  fail(
    "Usage: npx tsx --tsconfig tsconfig.script.json scripts/set-password.mts <email> [--dry-run]",
  );
}

/**
 * Generated passwords avoid look-alike characters (0/O, 1/l/I): these get read
 * out loud or retyped from a chat message, and a transcription slip looks
 * identical to a wrong password.
 */
function generatePassword(): string {
  const alphabet = "abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = randomBytes(20);
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join("");
}

async function main() {
  // Constructed here, not at module scope: the .env loader above only runs after
  // the imports are evaluated, so reading the key any earlier would miss it.
  const supabase = createAdminClient();

  const provided = process.env.NEW_PASSWORD;
  const generated = provided === undefined;
  const password = provided ?? generatePassword();

  // Supabase's own floor — checking here turns a 422 from the API into a sentence.
  if (password.length < 6) {
    throw new Error("NEW_PASSWORD must be at least 6 characters.");
  }

  const userId = await findUserIdByEmail(supabase, email!);

  if (!userId) {
    throw new Error(
      `No account with the email ${email}.\n` +
        "  Check the spelling in Supabase → Authentication → Users. If they never\n" +
        "  finished signing up there is no password to reset — they just create one.",
    );
  }

  if (DRY_RUN) {
    console.log(`Found ${email} (${userId}). --dry-run, so nothing written.`);
    return;
  }

  const { error } = await supabase.auth.admin.updateUserById(userId, {
    password,
  });
  if (error) throw new Error(`Could not update the password: ${error.message}`);

  console.log(`✓ Password updated for ${email}`);
  if (generated) {
    console.log(`  New password: ${password}`);
    console.log("  Hand it over directly — it is not emailed anywhere.");
  }
}

main().catch((err) => {
  console.error("✗", err.message);
  process.exit(1);
});
