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
    const { userId, token, title, body, data } = payload

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

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    )

    let targetTokens: string[] = []

    if (token) {
      targetTokens = [token]
    } else if (userId) {
      // Fetch user FCM tokens
      const { data: userData, error } = await supabaseClient
        .from("users")
        .select("fcm_tokens")
        .eq("id", userId)
        .single()

      if (error) {
        throw new Error(`Error fetching user tokens: ${error.message}`)
      }
      targetTokens = userData?.fcm_tokens || []
    }

    if (targetTokens.length === 0) {
      return new Response(JSON.stringify({ message: "No tokens found for user/target", sent: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      })
    }

    const serviceAccountStr = Deno.env.get("FIREBASE_SERVICE_ACCOUNT")
    if (!serviceAccountStr) {
      throw new Error("FIREBASE_SERVICE_ACCOUNT env var not set")
    }
    const serviceAccount = JSON.parse(serviceAccountStr)
    const projectId = serviceAccount.project_id

    const accessToken = await getAccessToken(serviceAccount)
    
    let sentCount = 0
    let staleTokens: string[] = []

    // Send notifications to all target tokens.
    // We use DATA-ONLY messages (no "notification" key) so that:
    //   - Foreground: onMessage always fires → we show via expo-notifications
    //   - Background: setBackgroundMessageHandler fires → we show via expo-notifications
    // Including title/body inside data so the client can read them.
    for (const t of targetTokens) {
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
        console.error(`Failed to send to token ${t}:`, resultString)
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
      } else {
        sentCount++
      }
    }

    // Clean up stale tokens if we fetched by userId
    if (userId && staleTokens.length > 0) {
      // Remove stale tokens from users array using array_remove logic we can do directly or via RPC.
      // Calling unregister won't work easily here since it uses auth.uid() based security context.
      // Alternatively, we update manually via service role.
      const { data: dbData } = await supabaseClient.from("users").select("fcm_tokens").eq("id", userId).single()
      if (dbData && dbData.fcm_tokens) {
        const remainingTokens = dbData.fcm_tokens.filter((tok: string) => !staleTokens.includes(tok))
        await supabaseClient.from("users").update({ fcm_tokens: remainingTokens }).eq("id", userId)
      }
    }

    return new Response(
      JSON.stringify({ success: true, sent: sentCount }),
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
