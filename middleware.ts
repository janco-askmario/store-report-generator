import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/** Paths reachable without a session. */
const PUBLIC_PATHS = ["/login", "/auth"];

export async function middleware(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // Without these the Supabase client constructor throws, which surfaces as an
  // opaque MIDDLEWARE_INVOCATION_FAILED 500 on every route. Fail closed, but
  // say why: we cannot verify a session, so nobody gets through to the reports.
  if (!url || !key) {
    return new NextResponse(
      "Server misconfigured: NEXT_PUBLIC_SUPABASE_URL and " +
        "NEXT_PUBLIC_SUPABASE_ANON_KEY are missing. Set them in the hosting " +
        "environment and redeploy — NEXT_PUBLIC_ values are baked in at build " +
        "time, so a redeploy is required.",
      { status: 500, headers: { "content-type": "text/plain" } },
    );
  }

  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value),
        );
        supabaseResponse = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          supabaseResponse.cookies.set(name, value, options),
        );
      },
    },
  });

  // Refreshes the auth token. Do not run any code between creating the client
  // and this call — a stale token here logs users out at random.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;
  const isPublic = PUBLIC_PATHS.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  );

  // Not signed in: only the login and auth-callback pages are reachable.
  if (!user) {
    if (isPublic) return supabaseResponse;
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    // Send them back where they were headed once they're in.
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  // Signed in, but access is gated on admin approval (see the account_approval
  // migration). One extra round trip per request, which is fine for an internal
  // tool — and this is only UX: the RLS policies are the real gate, so an
  // unapproved account that reached the app anyway would still see nothing.
  const { data: approved } = await supabase.rpc("is_approved");

  if (!approved) {
    // Let the auth callback finish its own redirect; funnel everything else to
    // the holding page. `/pending` itself is reachable so it can render.
    if (pathname === "/pending" || pathname.startsWith("/auth")) {
      return supabaseResponse;
    }
    const url = request.nextUrl.clone();
    url.pathname = "/pending";
    url.search = "";
    return NextResponse.redirect(url);
  }

  // Approved: keep them out of the login and holding pages.
  if (pathname === "/login" || pathname === "/pending") {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    url.search = "";
    return NextResponse.redirect(url);
  }

  // Must return supabaseResponse itself so refreshed auth cookies survive.
  return supabaseResponse;
}

export const config = {
  matcher: [
    /*
     * Everything except Next internals and static assets. Keeping images and
     * fonts out of the matcher avoids a needless auth round-trip per asset.
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|woff2?|ttf)$).*)",
  ],
};
