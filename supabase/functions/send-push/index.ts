import { createClient } from "jsr:@supabase/supabase-js@2"

// Setup type definitions for built-in Supabase Runtime APIs
import "@supabase/functions-js/edge-runtime.d.ts"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
}

// Helper to base64url encode
function base64url(source: Uint8Array): string {
  let encoded = btoa(String.fromCharCode(...source))
  encoded = encoded.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")
  return encoded
}

// Mint Google OAuth2 token using raw crypto API
async function getAccessToken(serviceAccount: any): Promise<string> {
  const header = {
    alg: "RS256",
    typ: "JWT",
  }

  const now = Math.floor(Date.now() / 1000)
  const payload = {
    iss: serviceAccount.client_email,
    scope: "https://www.googleapis.com/auth/firebase.messaging",
    aud: "https://oauth2.googleapis.com/token",
    exp: now + 3600,
    iat: now,
  }

  const encodedHeader = base64url(new TextEncoder().encode(JSON.stringify(header)))
  const encodedPayload = base64url(new TextEncoder().encode(JSON.stringify(payload)))
  const unsignedToken = `${encodedHeader}.${encodedPayload}`

  // Ensure key format is correct
  let privateKey = serviceAccount.private_key
  const pemHeader = "-----BEGIN PRIVATE KEY-----"
  const pemFooter = "-----END PRIVATE KEY-----"
  let pemContents = privateKey.replace(pemHeader, "").replace(pemFooter, "").replace(/\s/g, "")
  const binaryDerString = atob(pemContents)
  const binaryDer = new Uint8Array(binaryDerString.length)
  for (let i = 0; i < binaryDerString.length; i++) {
    binaryDer[i] = binaryDerString.charCodeAt(i)
  }

  const key = await crypto.subtle.importKey(
    "pkcs8",
    binaryDer.buffer,
    {
      name: "RSASSA-PKCS1-v1_5",
      hash: "SHA-256",
    },
    false,
    ["sign"]
  )

  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    key,
    new TextEncoder().encode(unsignedToken)
  )

  const encodedSignature = base64url(new Uint8Array(signature))
  const jwt = `${unsignedToken}.${encodedSignature}`

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: `grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=${jwt}`,
  })

  if (!response.ok) {
    const errText = await response.text()
    throw new Error(`Failed to get access token: ${response.statusText} - ${errText}`)
  }

  const data = await response.json()
  return data.access_token
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders })
  }

  try {
    const payload = await req.json()
    const { userId, token, title, body, data, app } = payload

    if ((!userId && !token) || (!title && !body)) {
      return new Response(
        JSON.stringify({ error: "Missing required fields (userId or token, title/body)" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      )
    }

    // Stringify any non-string values in data payload, as FCM requires string values
    const fcmData: Record<string, string> = {}
    if (data && typeof data === "object") {
      for (const [k, value] of Object.entries(data)) {
        fcmData[k] = typeof value === "string" ? value : JSON.stringify(value)
      }
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")
    if (!supabaseUrl || !serviceRoleKey) {
      throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env var")
    }

    const supabaseClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false },
    })

    let targetTokens: string[] = []

    if (token) {
      targetTokens = [token]
    } else if (userId) {
      // Use partner_fcm_tokens for partner-app notifications, fcm_tokens for user-app
      const tokenColumn = app === 'partner' ? 'partner_fcm_tokens' : 'fcm_tokens'
      const { data: userData, error } = await supabaseClient
        .from("users")
        .select(tokenColumn)
        .eq("id", userId)
        .maybeSingle()

      if (error) {
        throw new Error(`Error fetching user tokens: ${error.message}`)
      }
      targetTokens = (userData as any)?.[tokenColumn] || []
    }

    if (targetTokens.length === 0) {
      return new Response(JSON.stringify({
        success: false,
        message: "No tokens found for user/target",
        attempted: 0,
        sent: 0,
        failed: 0,
        stale: 0,
        failures: [],
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      })
    }

    let serviceAccountStr = Deno.env.get("FIREBASE_SERVICE_ACCOUNT")
    if (!serviceAccountStr) {
      throw new Error("FIREBASE_SERVICE_ACCOUNT env var not set")
    }
    // Strip surrounding quotes that may have been included by .env or shell wrapping
    serviceAccountStr = serviceAccountStr.trim()
    if (
      (serviceAccountStr.startsWith('"') && serviceAccountStr.endsWith('"')) ||
      (serviceAccountStr.startsWith("'") && serviceAccountStr.endsWith("'"))
    ) {
      serviceAccountStr = serviceAccountStr.slice(1, -1)
    }
    const serviceAccount = JSON.parse(serviceAccountStr)
    const projectId = serviceAccount.project_id

    const accessToken = await getAccessToken(serviceAccount)
    
    const attemptedCount = targetTokens.length
    let sentCount = 0
    let staleTokens: string[] = []
    const failures: Array<Record<string, unknown>> = []

    // Send notifications to all target tokens.
    // We use DATA-ONLY messages (no "notification" key) so that:
    //   - Foreground: onMessage always fires → we show via expo-notifications
    //   - Background: setBackgroundMessageHandler fires → we show via expo-notifications
    // Including title/body inside data so the client can read them.
    for (const [tokenIndex, t] of targetTokens.entries()) {
      const fcmMessage = {
        message: {
          token: t,
          // "notification" key: Android shows this in the system tray automatically
          // when the app is backgrounded or killed (no local notification lib needed).
          notification: {
            title: title || "",
            body: body || "",
          },
          // "data" key: available to onMessage (foreground) and the background handler.
          // All values must be strings for FCM.
          data: {
            ...fcmData,
            title: title || "",
            body: body || "",
          },
          android: {
            priority: "high" as const,
            notification: {
              channel_id: "gmr-default",
              sound: "default",
            },
          },
        }
      }

      const res = await fetch(`https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(fcmMessage),
      })

      if (!res.ok) {
        const resultString = await res.text()
        console.error(`Failed to send to token index ${tokenIndex}:`, resultString)
        let errorData
        try {
           errorData = JSON.parse(resultString)
        } catch { }

        const errorCode = errorData?.error?.details?.[0]?.errorCode || errorData?.error?.status
        if (
          errorCode === "UNREGISTERED" || 
          errorCode === "INVALID_ARGUMENT" || 
          resultString.includes("UNREGISTERED") || 
          resultString.includes("INVALID_ARGUMENT")
        ) {
          staleTokens.push(t)
        }
        failures.push({
          tokenIndex,
          status: res.status,
          errorCode: errorCode || "UNKNOWN",
          message: errorData?.error?.message || resultString.slice(0, 240),
        })
      } else {
        sentCount++
      }
    }

    // Clean up stale tokens if we fetched by userId
    if (userId && staleTokens.length > 0) {
      const tokenColumn = app === 'partner' ? 'partner_fcm_tokens' : 'fcm_tokens'
      const { data: dbData } = await supabaseClient.from("users").select(tokenColumn).eq("id", userId).maybeSingle()
      if (dbData && (dbData as any)[tokenColumn]) {
        const remainingTokens = (dbData as any)[tokenColumn].filter((tok: string) => !staleTokens.includes(tok))
        await supabaseClient.from("users").update({ [tokenColumn]: remainingTokens }).eq("id", userId)
      }
    }

    return new Response(
      JSON.stringify({
        success: sentCount > 0,
        attempted: attemptedCount,
        sent: sentCount,
        failed: failures.length,
        stale: staleTokens.length,
        failures,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    )
  } catch (error) {
    console.error("Error sending push:", error)
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    )
  }
})
