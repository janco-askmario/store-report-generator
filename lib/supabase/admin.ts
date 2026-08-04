import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Supabase client holding the project's secret key.
 *
 * SERVER ONLY — never import this from a Client Component. The key bypasses RLS
 * completely, so anything it touches is unguarded by the approval gate; shipping
 * it to a browser would hand every visitor the whole database. It is read from
 * SUPABASE_SECRET_KEY, deliberately *not* a NEXT_PUBLIC_ name, because Next
 * inlines those into the client bundle at build time.
 *
 * The sibling client.ts / server.ts clients use the publishable key and stay
 * subject to RLS. Reach for this one only where an operation genuinely has no
 * user behind it — setting a password for someone who cannot sign in.
 */
export function createAdminClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  // SUPABASE_SERVICE_ROLE_KEY is the older name for the same slot, and what
  // Vercel's Supabase integration injects.
  const secretKey =
    process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL is not set.");
  }
  if (!secretKey) {
    throw new Error(
      "SUPABASE_SECRET_KEY is not set — find it in Supabase → Project Settings → " +
        "API keys, and add it to the hosting environment as a plain (not " +
        "NEXT_PUBLIC_) variable.",
    );
  }

  // No session to persist or refresh: this client is a one-shot per request, and
  // letting it write to any shared store would be a cross-request leak.
  return createClient(url, secretKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

/**
 * Resolve an email address to a user id, case-insensitively.
 *
 * The admin API has no "get user by email", only a paged list, so this walks the
 * pages until the address turns up. Fine for an internal tool — one request in
 * practice — and the cap keeps a runaway loop off the table if the API ever
 * stops shrinking the last page.
 */
export async function findUserIdByEmail(
  admin: SupabaseClient,
  email: string,
): Promise<string | null> {
  const wanted = email.trim().toLowerCase();
  const perPage = 200;

  for (let page = 1; page <= 20; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage });
    if (error) throw new Error(`Could not list users: ${error.message}`);

    const hit = data.users.find((u) => u.email?.toLowerCase() === wanted);
    if (hit) return hit.id;
    if (data.users.length < perPage) return null; // last page
  }
  return null;
}
