import { serve } from "https://deno.land/std@0.177.0/http/server.ts"
import { supabase, corsHeaders, errorResponse } from "./_shared.ts"

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders })

  try {
    const { livestockId, amount, releaseType, notes, adminId } = await req.json()
    if (!livestockId || !amount || amount <= 0 || !adminId) return errorResponse("Invalid payload")

    const { data: adminProfile } = await supabase
      .from("profiles")
      .select("id, role")
      .eq("id", adminId)
      .single()
    if (!adminProfile || adminProfile.role !== "admin") return errorResponse("Only admin can release escrow", 403)

    const { data: livestock } = await supabase
      .from("livestock")
      .select("id, farmer_id, status, farmer:profiles(status)")
      .eq("id", livestockId)
      .single()
    if (!livestock) return errorResponse("Livestock not found")
    if (!["funded", "in_progress", "active"].includes(livestock.status)) return errorResponse("Project is not eligible for release")
    if (livestock.farmer?.status !== "approved") return errorResponse("Farmer KYC must be approved before release")

    const [{ data: investments }, { data: existingReleases }] = await Promise.all([
      supabase.from("investments").select("investor_id, amount").eq("livestock_id", livestockId),
      supabase.from("escrow_releases").select("amount").eq("livestock_id", livestockId),
    ])

    const investorPool = (investments || []).reduce((sum, i) => sum + Number(i.amount || 0), 0)
    const released = (existingReleases || []).reduce((sum, r) => sum + Number(r.amount || 0), 0)
    const remaining = investorPool - released
    if (Number(amount) > remaining) return errorResponse("Release exceeds available escrow")

    const grouped = new Map<string, number>()
    for (const inv of investments || []) {
      grouped.set(inv.investor_id, (grouped.get(inv.investor_id) || 0) + Number(inv.amount || 0))
    }

    for (const [investorId, invested] of grouped.entries()) {
      const deduction = Number((Number(amount) * (investorPool > 0 ? invested / investorPool : 0)).toFixed(2))
      const { data: investorWallet } = await supabase.from("wallets").select("user_id, escrow_locked").eq("user_id", investorId).single()
      if (!investorWallet) continue

      await supabase
        .from("wallets")
        .update({ escrow_locked: Math.max(0, Number(investorWallet.escrow_locked || 0) - deduction), updated_at: new Date().toISOString() })
        .eq("user_id", investorId)

      await supabase.from("transactions").insert({
        user_id: investorId,
        type: "maintenance_release",
        amount: deduction,
        status: "completed",
        metadata: { livestock_id: livestockId, release_type: releaseType || "ops_expense" },
      })
    }

    const { data: farmerWallet } = await supabase.from("wallets").select("user_id, main_balance").eq("user_id", livestock.farmer_id).single()
    if (!farmerWallet) return errorResponse("Farmer wallet not found")

    await supabase
      .from("wallets")
      .update({ main_balance: Number(farmerWallet.main_balance || 0) + Number(amount), updated_at: new Date().toISOString() })
      .eq("user_id", livestock.farmer_id)

    const insertPayout = await supabase.from("transactions").insert({
      user_id: livestock.farmer_id,
      type: "farmer_payout",
      amount: Number(amount),
      status: "completed",
      metadata: { livestock_id: livestockId, release_type: releaseType || "ops_expense", notes: notes || null },
    })
    if (insertPayout.error) {
      await supabase.from("transactions").insert({
        user_id: livestock.farmer_id,
        type: "maintenance_release",
        amount: Number(amount),
        status: "completed",
        metadata: { livestock_id: livestockId, release_type: releaseType || "ops_expense", notes: notes || null },
      })
    }

    const { error: releaseError } = await supabase.from("escrow_releases").insert({
      livestock_id: livestockId,
      farmer_id: livestock.farmer_id,
      approved_by: adminId,
      amount: Number(amount),
      release_type: releaseType || "ops_expense",
      notes: notes || null,
      status: "completed",
    })
    if (releaseError) return errorResponse(releaseError.message)

    return new Response(
      JSON.stringify({ success: true, released: Number(amount), remaining: Math.max(0, remaining - Number(amount)) }),
      { headers: corsHeaders }
    )
  } catch (e: any) {
    return errorResponse(e.message || "Unexpected error", 500)
  }
})
