import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { supabase, SaleApprovalSchema, errorResponse, corsHeaders } from "./_shared.ts";

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const body = await req.json();
  const validation = SaleApprovalSchema.safeParse(body);
  if (!validation.success) return errorResponse("Invalid payload");

  const { saleId, platformFeeRate } = validation.data;

  try {
    const { data: sale } = await supabase.from("sale_requests").select("*, livestock:livestock(*)").eq("id", saleId).single();
    if (!sale) return errorResponse("Sale request not found");

    const profit = sale.proposed_price - sale.livestock.cost_price;
    if (profit <= 0) {
      // Loss distribution
      await supabase.rpc("distribute_loss", { p_sale_id: saleId, p_profit: profit });
    } else {
      const platformFee = Math.round(profit * platformFeeRate * 100) / 100;
      const netProfit = profit - platformFee;
      await supabase.rpc("distribute_profit", { p_sale_id: saleId, p_net_profit: netProfit, p_platform_fee: platformFee });
    }

    await supabase.from("sale_requests").update({ status: "approved", admin_verified_at: new Date() }).eq("id", saleId);
    await supabase.from("livestock").update({ status: "sold" }).eq("id", sale.livestock.id);

    return new Response(JSON.stringify({ success: true, status: "approved" }), { headers: corsHeaders });
  } catch (e) {
    return errorResponse(e.message, 500);
  }
});