import { serve } from "https://deno.land/std@0.177.0/http/server.ts"
import { supabase, errorResponse, corsHeaders } from "./_shared.ts"

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders })
  
  try {
    const { livestockId, investorId, shares, walletId } = await req.json()
    
    const {  client, error } = await supabase.rpc("invest_atomic", {
      p_livestock_id: livestockId,
      p_investor_id: investorId,
      p_shares: shares,
      p_wallet_id: walletId
    })
    
    if (error || !client?.success) return errorResponse(error?.message || client?.error || "Transaction failed")
    return new Response(JSON.stringify(client.data), { headers: corsHeaders })
  } catch (e: any) {
    return errorResponse(e.message, 500)
  }
})