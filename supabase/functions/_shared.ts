import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4"
import { z } from "https://esm.sh/zod@3.23.8"

export const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
)

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Content-Type": "application/json"
}

export function errorResponse(msg: string, status = 400) {
  return new Response(JSON.stringify({ error: msg }), { status, headers: corsHeaders })
}