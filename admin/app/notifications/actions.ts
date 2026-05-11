'use server';

import { supabaseAdmin } from '@/lib/supabase-server';

export async function sendCustomNotification(formData: FormData) {
  try {
    const title = formData.get('title') as string;
    const body = formData.get('body') as string;
    const targetType = formData.get('targetType') as string; // 'all', 'users', 'partners', 'specific'
    const targetId = formData.get('targetId') as string;

    if (!title || !body) {
      return { success: false, error: 'Title and body are required' };
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;

    if (!supabaseUrl || !serviceKey) {
      return { success: false, error: 'Missing Supabase credentials' };
    }

    let tokens: string[] = [];

    if (targetType === 'specific' && targetId) {
      const { data, error } = await supabaseAdmin
        .from('users')
        .select('fcm_tokens')
        .eq('id', targetId)
        .single();
      
      if (error) throw error;
      tokens = data?.fcm_tokens || [];
    } else {
      let query = supabaseAdmin.from('users').select('fcm_tokens').not('fcm_tokens', 'is', null);
      if (targetType === 'users') {
        query = query.eq('role', 'user');
      } else if (targetType === 'partners') {
        query = query.eq('role', 'guide');
      }

      const { data, error } = await query;
      if (error) throw error;

      data?.forEach(user => {
        if (Array.isArray(user.fcm_tokens)) {
          tokens.push(...(user.fcm_tokens as string[]));
        }
      });
    }

    if (tokens.length === 0) {
      return { success: false, error: 'No valid FCM tokens found for the selected target' };
    }

    // Deduplicate tokens
    tokens = Array.from(new Set(tokens));

    // Send notifications in batches if there are many, but for simplicity we send individually or batch them in edge function.
    // However, our `send-push` edge function can take a `token` (single string) or `userId`. 
    // To send to multiple tokens, we can either update `send-push` to take `tokens: string[]` or call it in a loop.
    // Let's call it in a loop or we can just update `send-push` to accept an array.
    // It's safer to just do a loop here for simplicity.
    
    let sentCount = 0;
    
    // We can run these in parallel
    const sendPromises = tokens.map(token => 
      fetch(`${supabaseUrl}/functions/v1/send-push`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${serviceKey}`,
          apikey: serviceKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          token,
          title,
          body,
          data: { type: 'admin_broadcast' }
        }),
      }).then(res => res.json()).catch(() => null)
    );

    const results = await Promise.all(sendPromises);
    results.forEach(res => {
      if (res && res.success) sentCount += (res.sent || 0);
    });

    return { success: true, sentCount };
  } catch (error: any) {
    console.error('Error sending custom notification:', error);
    return { success: false, error: error.message || 'An error occurred' };
  }
}
