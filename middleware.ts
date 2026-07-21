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

  if (!user && !isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    // Send them back where they were headed once they're in.
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  if (user && pathname === "/login") {
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
