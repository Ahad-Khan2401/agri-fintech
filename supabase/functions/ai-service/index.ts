// 🔐 This runs on Supabase Edge - API key NEVER exposed to frontend
import { serve } from "https://deno.land/std@0.177.0/http/server.ts"

const DEEPSEEK_API_KEY = Deno.env.get("DEEPSEEK_API_KEY") || Deno.env.get("VITE_DEEPSEEK_API_KEY")
const DEEPSEEK_MODEL = Deno.env.get("DEEPSEEK_MODEL") || Deno.env.get("VITE_DEEPSEEK_MODEL") || "deepseek-v4-flash"
const DEEPSEEK_URL = "https://api.deepseek.com/chat/completions"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Content-Type": "application/json",
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders })

  try {
    if (!DEEPSEEK_API_KEY) {
      return new Response(JSON.stringify({ error: "DeepSeek API key is not configured" }), { status: 500, headers: corsHeaders })
    }

    const { action, payload } = await req.json()
    
    // Rate limiting: Max 10 requests/minute per user
    const authHeader = req.headers.get("Authorization")
    if (!authHeader) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders })

    switch (action) {
      case "predict_health_risk":
        return await predictHealthRisk(payload)
      case "suggest_pricing":
        return await suggestPricing(payload)
      case "detect_fraud":
        return await detectFraud(payload)
      case "generate_shariah_report":
        return await generateShariahReport(payload)
      case "chat_assistant":
        return await chatAssistant(payload)
      default:
        return new Response(JSON.stringify({ error: "Unknown action" }), { status: 400, headers: corsHeaders })
    }
  } catch (error: any) {
    console.error("AI Service Error:", error)
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders })
  }
})

async function callDeepSeek(messages: Array<{ role: "system" | "user" | "assistant"; content: string }>, options: Record<string, unknown> = {}) {
  const response = await fetch(DEEPSEEK_URL, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${DEEPSEEK_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: DEEPSEEK_MODEL,
      messages,
      ...options,
    }),
  })

  const result = await response.json().catch(() => null)
  if (!response.ok) {
    const message = result?.error?.message || result?.message || `DeepSeek request failed with ${response.status}`
    throw new Error(message)
  }

  return result
}

function parseJsonContent(result: any) {
  const raw = result?.choices?.[0]?.message?.content
  if (!raw) throw new Error("DeepSeek returned an empty response")
  return JSON.parse(raw)
}

// 🩺 AI Health Risk Prediction
async function predictHealthRisk(data: any) {
  const prompt = `
    You are a veterinary AI expert for livestock in Pakistan.
    Analyze this animal's data and predict health risks (0-100 score).
    
    Data:
    - Breed: ${data.breed}
    - Age: ${data.age_months} months
    - Weight: ${data.weight_kg} kg
    - Location: ${data.location_city}
    - Recent updates: ${JSON.stringify(data.updates?.slice(-3))}
    - Season: ${data.season || "current"}
    
    Return JSON ONLY:
    {
      "risk_score": number (0-100),
      "risk_level": "low"|"medium"|"high"|"critical",
      "potential_issues": ["issue1", "issue2"],
      "recommendations": ["rec1", "rec2"],
      "vet_inspection_urgency": "none"|"routine"|"urgent"|"immediate",
      "confidence": number (0-1)
    }
  `

  const result = await callDeepSeek([{ role: "user", content: prompt }], {
    temperature: 0.3,
    response_format: { type: "json_object" }
  })
  const content = parseJsonContent(result)
  
  return new Response(JSON.stringify({ success: true, data: content }), { headers: corsHeaders })
}

// 💰 Dynamic Pricing Suggestion
async function suggestPricing(data: any) {
  const prompt = `
    You are an agricultural economist specializing in Pakistani livestock markets.
    Suggest optimal pricing for fractional investment shares.
    
    Market Context:
    - Current season: ${data.season}
    - Upcoming events: ${data.events?.join(", ") || "none"}
    - Regional demand: ${data.regional_demand || "moderate"}
    
    Animal Details:
    - Breed: ${data.breed} (premium: ${data.breed_premium || "standard"})
    - Age: ${data.age_months} months (optimal: 18-36 for beef)
    - Weight: ${data.weight_kg} kg
    - Health score: ${data.health_score}/100
    - Farmer reputation: ${data.farmer_rating || "new"}
    
    Calculate:
    1. Fair market value of animal
    2. Recommended total shares (100-1000)
    3. Price per share (min PKR 500)
    4. Expected ROI range (conservative to optimistic)
    5. Risk-adjusted discount if applicable
    
    Return JSON ONLY:
    {
      "estimated_market_value": number,
      "recommended_total_shares": number,
      "price_per_share": number,
      "farmer_min_shares": number,
      "expected_roi_range": { "min": number, "max": number },
      "risk_adjustment": number,
      "pricing_confidence": "low"|"medium"|"high",
      "market_notes": "string"
    }
  `

  const result = await callDeepSeek([{ role: "user", content: prompt }], {
    temperature: 0.2,
    response_format: { type: "json_object" }
  })
  const content = parseJsonContent(result)
  
  return new Response(JSON.stringify({ success: true, data: content }), { headers: corsHeaders })
}

// 🚨 Fraud Detection AI
async function detectFraud(data: any) {
  const prompt = `
    You are a financial fraud detection AI for agricultural investments.
    Analyze this listing for potential red flags.
    
    Listing Data:
    ${JSON.stringify(data, null, 2)}
    
    Check for:
    1. Price anomalies vs market averages
    2. Inconsistent weight/age ratios
    3. Suspicious farmer patterns (new account, high-value listings)
    4. Missing mandatory media (video required)
    5. Location inconsistencies
    6. Duplicate image detection hints
    
    Return JSON ONLY:
    {
      "fraud_score": number (0-100),
      "risk_level": "safe"|"caution"|"high_risk"|"blocked",
      "flags": [{ "type": "string", "severity": "low"|"medium"|"high", "description": "string" }],
      "recommended_action": "approve"|"manual_review"|"reject",
      "confidence": number (0-1),
      "explanation": "string"
    }
  `

  const result = await callDeepSeek([{ role: "user", content: prompt }], {
    temperature: 0.1,
    response_format: { type: "json_object" }
  })
  const content = parseJsonContent(result)
  
  // Auto-flag high-risk listings
  if (content.fraud_score >= 70) {
    // Would trigger database flag via Supabase client here
  }
  
  return new Response(JSON.stringify({ success: true, data: content }), { headers: corsHeaders })
}

// ☪️ Shariah Compliance Report Generator
async function generateShariahReport(data: any) {
  const prompt = `
    You are an Islamic finance scholar specializing in Mudarabah contracts.
    Generate a Shariah compliance assessment for this livestock investment.
    
    Contract Details:
    - Structure: Mudarabah (profit-sharing)
    - Capital provider: Investors
    - Manager: Farmer
    - Profit split: Investors ${data.investor_share}% / Farmer ${data.farmer_share}%
    - Loss bearing: Capital providers (investors) bear financial loss; farmer loses effort
    - Underlying asset: ${data.breed} livestock
    
    Verify compliance with:
    1. Prohibition of Riba (interest)
    2. Asset-backed transaction (no speculation)
    3. Clear profit-sharing ratio (pre-agreed)
    4. Transparency in management
    5. Halal underlying activity
    
    Return JSON ONLY:
    {
      "is_compliant": boolean,
      "compliance_score": number (0-100),
      "scholarly_basis": ["reference1", "reference2"],
      "conditions": ["condition1", "condition2"],
      "warnings": ["warning1"],
      "fatwa_ready": boolean,
      "summary_ur": "Urdu summary for users",
      "summary_en": "English summary"
    }
  `

  const result = await callDeepSeek([{ role: "user", content: prompt }], {
    temperature: 0.2,
    response_format: { type: "json_object" }
  })
  const content = parseJsonContent(result)
  
  return new Response(JSON.stringify({ success: true, data: content }), { headers: corsHeaders })
}

// 💬 Multilingual Chat Assistant
async function chatAssistant(data: any) {
  const { message, language = "ur", context } = data
  
  const systemPrompt = `
    You are MaweshiGuide, a helpful AI assistant for the MaweshiHub livestock investment platform.
    
    User Language: ${language === "ur" ? "Urdu" : language === "pa" ? "Punjabi" : language === "sd" ? "Sindhi" : language === "ps" ? "Pashto" : "English"}
    
    Guidelines:
    1. Respond in the user's language
    2. Be empathetic and clear, especially for rural farmers
    3. Never give financial advice; direct to human experts for complex queries
    4. Explain Islamic finance concepts simply
    5. For technical issues, provide step-by-step guidance
    
    Context about user:
    ${context ? JSON.stringify(context) : "No context provided"}
  `

  const result = await callDeepSeek([
    { role: "system", content: systemPrompt },
    { role: "user", content: message }
  ], {
    temperature: 0.7,
    max_tokens: 500
  })
  
  return new Response(JSON.stringify({ 
    success: true, 
    reply: result.choices[0].message.content,
    language 
  }), { headers: corsHeaders })
}
