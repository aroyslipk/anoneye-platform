import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { isSupabaseConfigured, getEnv } from "@/lib/env";

/**
 * Refreshes the Supabase session for every matched request and forwards the
 * rotated cookies to both the server render and the browser. Called from
 * `proxy.ts` (Next.js 16's renamed middleware file).
 *
 * A coarse redirect happens here so signed-out visitors get a real HTTP 307
 * instead of a streamed client-side redirect. Page-level guards still verify
 * the session (and ownership) before any personal data is rendered.
 */

const SESSION_COOKIE = "anoneye_session";
const PROTECTED_PREFIXES = ["/dashboard", "/settings"];

function isProtected(pathname: string): boolean {
  return PROTECTED_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

function loginRedirect(request: NextRequest): NextResponse {
  const url = new URL("/login", request.url);
  url.searchParams.set("next", `${request.nextUrl.pathname}${request.nextUrl.search}`);
  return NextResponse.redirect(url);
}

/** Copy rotated auth cookies (and cache headers) onto a custom response. */
function withSessionCookies(target: NextResponse, source: NextResponse): NextResponse {
  for (const cookie of source.cookies.getAll()) target.cookies.set(cookie);
  for (const header of ["cache-control", "expires", "pragma"]) {
    const value = source.headers.get(header);
    if (value) target.headers.set(header, value);
  }
  return target;
}

export async function updateSession(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  if (!isSupabaseConfigured()) {
    // Local backend: the cookie's presence is only a cheap gate. Its validity
    // is checked by requireUser() in the page/layout.
    if (isProtected(pathname) && !request.cookies.get(SESSION_COOKIE)) {
      return loginRedirect(request);
    }
    return NextResponse.next({ request });
  }

  const env = getEnv();
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    env.NEXT_PUBLIC_SUPABASE_URL as string,
    env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY as string,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          for (const { name, value } of cookiesToSet) request.cookies.set(name, value);
          response = NextResponse.next({ request });
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options);
          }
        },
      },
    },
  );

  // getClaims verifies the JWT signature; getSession alone is not trusted.
  let signedIn = false;
  try {
    const { data } = await supabase.auth.getClaims();
    signedIn = Boolean(data?.claims?.sub);
  } catch {
    // An invalid/expired refresh token simply means a signed-out request.
  }

  if (isProtected(pathname) && !signedIn) {
    return withSessionCookies(loginRedirect(request), response);
  }
  if ((pathname === "/login" || pathname === "/signup") && signedIn) {
    return withSessionCookies(NextResponse.redirect(new URL("/dashboard", request.url)), response);
  }

  return response;
}
