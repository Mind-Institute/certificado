import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/dashboard/templates";

  if (!code) {
    return NextResponse.redirect(`${origin}/login`);
  }

  const supabase = createClient();
  const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(
    code,
  );
  if (exchangeError) {
    return NextResponse.redirect(`${origin}/login`);
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const email = user?.email?.toLowerCase() ?? null;
  if (!email) {
    await supabase.auth.signOut();
    return NextResponse.redirect(`${origin}/login?error=not_authorized`);
  }

  const { data: allowed, error: allowedError } = await supabase
    .from("cert_allowed_users")
    .select("email")
    .eq("email", email)
    .maybeSingle();

  if (allowedError || !allowed) {
    await supabase.auth.signOut();
    return NextResponse.redirect(`${origin}/login?error=not_authorized`);
  }

  // Fire-and-forget last_signed_in_at update. Doesn't block the redirect.
  await supabase
    .from("cert_allowed_users")
    .update({ last_signed_in_at: new Date().toISOString() })
    .eq("email", email);

  return NextResponse.redirect(`${origin}${next}`);
}
