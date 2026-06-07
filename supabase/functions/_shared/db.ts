// Cliente Supabase (service role) para uso interno das edge functions.
import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

export function getServiceClient(): SupabaseClient {
  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) {
    throw new Error("SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY ausentes");
  }
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export function getAppUrl(): string {
  return Deno.env.get("APP_URL") ?? "https://mind-certificados.vercel.app";
}

export function corsHeaders(): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  };
}

export function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(), "Content-Type": "application/json" },
  });
}

export function htmlResponse(html: string, status = 200): Response {
  return new Response(html, {
    status,
    headers: { ...corsHeaders(), "Content-Type": "text/html; charset=utf-8" },
  });
}
