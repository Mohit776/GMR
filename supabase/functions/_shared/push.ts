export type SendPushPayload = {
  userId?: string;
  token?: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
  app?: 'user' | 'partner'; // which app's FCM token column to target
};

export type PushDispatchResult = {
  success: boolean;
  attempted: number;
  sent: number;
  failed: number;
  stale: number;
  reason?: string;
  failures?: Array<Record<string, unknown>>;
};

export async function sendPush(
  supabaseUrl: string,
  serviceKey: string,
  payload: SendPushPayload
): Promise<PushDispatchResult> {
  try {
    const response = await fetch(`${supabaseUrl}/functions/v1/send-push`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${serviceKey}`,
        apikey: serviceKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const responseText = await response.text().catch(() => '');
    let result: Record<string, unknown> = {};
    try {
      result = JSON.parse(responseText);
    } catch {
      result = {};
    }

    const dispatchResult: PushDispatchResult = {
      success: response.ok && result?.success !== false,
      attempted: Number(result?.attempted ?? result?.sent ?? 0),
      sent: Number(result?.sent ?? 0),
      failed: Number(result?.failed ?? 0),
      stale: Number(result?.stale ?? 0),
      reason: String(result?.error || '') || String(result?.message || '') || (responseText && !response.ok ? responseText.slice(0, 240) : undefined),
      failures: Array.isArray(result?.failures) ? result.failures : undefined,
    };

    if (!response.ok || dispatchResult.failed > 0 || dispatchResult.sent === 0) {
      console.warn('send-push returned diagnostics:', {
        status: response.status,
        statusText: response.statusText,
        target: payload.userId ? { userId: payload.userId } : { token: payload.token ? 'direct-token' : 'none' },
        ...dispatchResult,
      });
    }

    return dispatchResult;
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    console.warn('send-push request failed:', {
      target: payload.userId ? { userId: payload.userId } : { token: payload.token ? 'direct-token' : 'none' },
      reason,
    });

    return {
      success: false,
      attempted: 0,
      sent: 0,
      failed: 1,
      stale: 0,
      reason,
    };
  }
}
