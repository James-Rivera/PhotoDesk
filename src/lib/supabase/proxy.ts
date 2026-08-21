import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getSupabasePublicConfig } from "./config";
import { isBranchLocalMode, LOCAL_AUTH_COOKIE, verifyBranchLocalToken } from "@/lib/auth/local";

export async function updateSession(request: NextRequest) {
  if (isBranchLocalMode()) {
    if (!request.nextUrl.pathname.startsWith("/app")) return NextResponse.next({ request });
    const authenticated = await verifyBranchLocalToken(request.cookies.get(LOCAL_AUTH_COOKIE)?.value);
    if (!authenticated) return redirectToLogin(request, NextResponse.next({ request }), "session");
    if (request.nextUrl.pathname !== "/app/template") {
      const templateUrl = request.nextUrl.clone();
      templateUrl.pathname = "/app/template";
      templateUrl.search = "?mode=branch-local";
      return NextResponse.redirect(templateUrl);
    }
    return NextResponse.next({ request });
  }
  const config = getSupabasePublicConfig();
  if (!config) return protectUnconfiguredRequest(request);

  let response = NextResponse.next({ request });
  const supabase = createServerClient(config.url, config.publishableKey, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(cookiesToSet, headers) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        Object.entries(headers).forEach(([name, value]) => response.headers.set(name, value));
      },
    },
  });

  const { data, error } = await supabase.auth.getClaims();
  const authenticated = !error && Boolean(data?.claims?.sub);
  if (request.nextUrl.pathname.startsWith("/app") && !authenticated) {
    return redirectToLogin(request, response, "session");
  }

  return response;
}

function protectUnconfiguredRequest(request: NextRequest) {
  if (!request.nextUrl.pathname.startsWith("/app")) return NextResponse.next({ request });
  const url = request.nextUrl.clone();
  url.pathname = "/login";
  url.search = "";
  url.searchParams.set("reason", "setup");
  return NextResponse.redirect(url);
}

function redirectToLogin(request: NextRequest, sessionResponse: NextResponse, reason: string) {
  const url = request.nextUrl.clone();
  url.pathname = "/login";
  url.search = "";
  url.searchParams.set("reason", reason);
  url.searchParams.set("next", `${request.nextUrl.pathname}${request.nextUrl.search}`);
  const redirect = NextResponse.redirect(url);
  sessionResponse.cookies.getAll().forEach((cookie) => redirect.cookies.set(cookie));
  for (const header of ["cache-control", "expires", "pragma"]) {
    const value = sessionResponse.headers.get(header);
    if (value) redirect.headers.set(header, value);
  }
  return redirect;
}
