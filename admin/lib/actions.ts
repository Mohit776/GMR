'use server';

import { revalidatePath } from 'next/cache';
import { supabaseAdmin } from './supabase-server';


export async function deleteUser(uid: string) {
  try {
    // Delete from auth (Supabase Auth admin API)
    const { error: authError } = await supabaseAdmin.auth.admin.deleteUser(uid);
    if (authError) throw authError;

    // Delete from users table
    const { error: dbError } = await supabaseAdmin
      .from('users')
      .delete()
      .eq('id', uid);
    if (dbError) throw dbError;

    revalidatePath('/users');
    revalidatePath('/partners');
    return { success: true };
  } catch (error: any) {
    console.error('Error deleting user:', error);
    return { error: error.message };
  }
}

export async function approvePartner(uid: string) {
  try {
    const { error } = await supabaseAdmin
      .from('users')
      .update({ is_approved: true })
      .eq('id', uid);
    if (error) throw error;



    revalidatePath('/partners');
    return { success: true };
  } catch (error: any) {
    console.error('Error approving partner:', error);
    return { error: error.message };
  }
}

export async function deleteListing(id: string) {
  try {
    const { error } = await supabaseAdmin
      .from('listings')
      .delete()
      .eq('id', id);
    if (error) throw error;

    revalidatePath('/listings');
    return { success: true };
  } catch (error: any) {
    console.error('Error deleting listing:', error);
    return { error: error.message };
  }
}

export async function updateListing(
  id: string,
  data: {
    name: string;
    partner: string;
    category: string;
    location: string;
    price: string;
    status: string;
    details?: Record<string, any>;
  }
) {
  try {
    const priceNum = parseFloat(data.price.replace(/[^0-9.]/g, ''));
    const { error } = await supabaseAdmin
      .from('listings')
      .update({
        title: data.name,
        partner_id: data.partner,
        type: data.category.toLowerCase(),
        location: data.location,
        price: isNaN(priceNum) ? null : priceNum,
        is_active: data.status === 'active',
        details: data.details ?? {},
        updated_at: new Date().toISOString(),
      })
      .eq('id', id);
    if (error) throw error;

    revalidatePath('/listings');
    return { success: true };
  } catch (error: any) {
    console.error('Error updating listing:', error);
    return { error: error.message };
  }
}

export async function cancelBooking(id: string) {
  try {
    // Fetch booking details before cancelling for notification
    const { data: bookingData, error: fetchError } = await supabaseAdmin
      .from('bookings')
      .select('*')
      .eq('id', id)
      .single();
    if (fetchError) throw fetchError;

    const { error } = await supabaseAdmin
      .from('bookings')
      .update({
        status: 'cancelled',
        updated_at: new Date().toISOString(),
      })
      .eq('id', id);
    if (error) throw error;



    revalidatePath('/bookings');
    return { success: true };
  } catch (error: any) {
    console.error('Error canceling booking:', error);
    return { error: error.message };
  }
}
