import { serve } from "https://deno.land/std@0.177.0/http/server.ts"
import { supabase, SaleApprovalSchema, errorResponse, corsHeaders } from "../_shared.ts"

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders })
  const body = await req.json()
  const validation = SaleApprovalSchema.safeParse(body)
  if (!validation.success) return errorResponse("Invalid payload")

  const { saleId, platformFeeRate } = validation.data

  try {
    const { data: sale, error: saleError } = await supabase
      .from("sale_requests")
      .select("*, livestock:livestock(*)")
      .eq("id", saleId)
      .single()
    if (saleError) throw saleError
    if (!sale) return errorResponse("Sale request not found")

    const profit = sale.proposed_price - sale.livestock.cost_price
    if (profit <= 0) {
      const { data, error } = await supabase.rpc("distribute_loss", { p_sale_id: saleId, p_profit: profit })
      if (error || !data?.success) throw error || new Error(data?.error || "Loss distribution failed")
    } else {
      const platformFee = Math.round(profit * platformFeeRate * 100) / 100
      const netProfit = profit - platformFee
      const { data, error } = await supabase.rpc("distribute_profit", {
        p_sale_id: saleId,
        p_net_profit: netProfit,
        p_platform_fee: platformFee
      })
      if (error || !data?.success) throw error || new Error(data?.error || "Profit distribution failed")
    }

    const { error: saleUpdateError } = await supabase
      .from("sale_requests")
      .update({ status: "approved", admin_verified_at: new Date().toISOString() })
      .eq("id", saleId)
    if (saleUpdateError) throw saleUpdateError

    const { error: livestockUpdateError } = await supabase
      .from("livestock")
      .update({ status: "sold" })
      .eq("id", sale.livestock.id)
    if (livestockUpdateError) throw livestockUpdateError

    return new Response(JSON.stringify({ success: true, status: "approved" }), { headers: corsHeaders })
  } catch (e: any) {
    return errorResponse(e.message, 500)
  }
})
