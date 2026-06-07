import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({
    request: { headers: request.headers },
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          request.cookies.set({ name, value, ...options });
          response = NextResponse.next({
            request: { headers: request.headers },
          });
          response.cookies.set({ name, value, ...options });
        },
        remove(name: string, options: CookieOptions) {
          request.cookies.set({ name, value: "", ...options });
          response = NextResponse.next({
            request: { headers: request.headers },
          });
          response.cookies.set({ name, value: "", ...options });
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;
  const isDashboard = pathname.startsWith("/dashboard");

  if (isDashboard && !user) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    return NextResponse.redirect(url);
  }

  if (isDashboard && user) {
    const email = user.email?.toLowerCase() ?? null;
    let authorized = false;
    if (email) {
      const { data: allowed } = await supabase
        .from("cert_allowed_users")
        .select("email")
        .eq("email", email)
        .maybeSingle();
      authorized = Boolean(allowed);
    }
    if (!authorized) {
      await supabase.auth.signOut();
      const url = request.nextUrl.clone();
      url.pathname = "/login";
      url.search = "?error=not_authorized";
      return NextResponse.redirect(url);
    }
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static, _next/image (Next internals)
     * - favicon.ico, public assets
     * - /claim/* (public landing)
     * - /auth/* (oauth callback)
     */
    "/((?!_next/static|_next/image|favicon.ico|claim|auth|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
