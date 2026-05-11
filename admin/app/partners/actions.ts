'use server';

import { revalidatePath } from 'next/cache';
import { supabaseAdmin } from '@/lib/supabase-server';

export async function approvePartner(id: string) {
  try {
    const { error } = await supabaseAdmin.from('users').update({ is_approved: true }).eq('id', id);
    if (error) throw error;

    // Send push notification
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;
    if (supabaseUrl && serviceKey) {
      await fetch(`${supabaseUrl}/functions/v1/send-push`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${serviceKey}`,
          apikey: serviceKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: id,
          title: 'You are approved! 🎉',
          body: 'Your partner account has been approved. You can now receive booking requests.',
          data: {
            type: 'partner_approved',
          },
        }),
      }).catch(e => console.error('Failed to send push notification:', e));
    }

    revalidatePath('/partners');
    revalidatePath(`/partners/${id}`);
    return { success: true };
  } catch (error) {
    console.error('Error approving partner:', error);
    return { success: false, error: 'Failed to approve partner' };
  }
}

export async function rejectPartner(id: string) {
  try {
    const { error } = await supabaseAdmin.from('users').update({ is_approved: false }).eq('id', id);
    if (error) throw error;
    revalidatePath('/partners');
    revalidatePath(`/partners/${id}`);
    return { success: true };
  } catch (error) {
    console.error('Error rejecting partner:', error);
    return { success: false, error: 'Failed to reject partner' };
  }
}
