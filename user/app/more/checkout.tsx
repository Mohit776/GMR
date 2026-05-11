import React, { useState, useMemo } from 'react';
import {
  View, StyleSheet, ScrollView, TouchableOpacity, StatusBar, TextInput,
  Modal, Alert, ActivityIndicator, KeyboardAvoidingView, Platform,
} from 'react-native';
import { Text } from '../../components/Text';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../utils/supabase';

async function invokeFunction<T>(name: string, body: unknown): Promise<T> {
  const result = await supabase.functions.invoke(name, { body: body as any });
  if (result.error) {
    let message = result.error.message || `${name} failed.`;
    const context = (result.error as any).context;
    if (context && typeof context.json === 'function') {
      try { const b = await context.json(); message = b?.error || b?.message || message; } catch {}
    }
    throw new Error(message);
  }
  if (!result.data) throw new Error(`${name} returned empty response.`);
  return result.data as T;
}

// ─── Colors ────────────────────────────────────────────────────────────────────
const C = {
  primary: '#16A34A', white: '#FFFFFF', bg: '#F8FAFC',
  dark: '#111827', gray: '#6B7280', lightGray: '#F1F5F9',
  border: '#E2E8F0', teal: '#14B8A6', blue: '#3B82F6',
  amber: '#F59E0B', danger: '#EF4444',
};

// ─── Helpers ───────────────────────────────────────────────────────────────────
const fmt = (d: Date) => d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
const fmtTime = (d: Date) => d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
const diffDays = (a: Date, b: Date) => Math.max(1, Math.ceil((b.getTime() - a.getTime()) / 864e5));

type PickerState = { visible: boolean; mode: 'date' | 'time'; target: 'start' | 'end' };

export default function CheckoutScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const params = useLocalSearchParams<{
    bookingType: string; itemId: string; itemName: string;
    pricePerUnit: string; partnerId: string; unitLabel: string;
    guideCity: string; // city where the guide operates (for dispatch)
  }>();

  const unitPrice = parseFloat(params.pricePerUnit || '0');
  const unitLabel = params.unitLabel || 'day';
  const isHourly = unitLabel === 'hour';

  // ── Date / Time state ────────────────────────────────────────────────────────
  const [startDate, setStartDate] = useState(() => {
    const d = new Date(); d.setMinutes(0, 0, 0); d.setHours(d.getHours() + 1); return d;
  });
  const [endDate, setEndDate] = useState(() => {
    const d = new Date(); d.setMinutes(0, 0, 0);
    d.setDate(d.getDate() + 1); d.setHours(10); return d;
  });
  const [picker, setPicker] = useState<PickerState>({ visible: false, mode: 'date', target: 'start' });
  const [coupon, setCoupon] = useState('');
  const [discountApplied, setDiscountApplied] = useState(false);

  // ── Phone modal state ─────────────────────────────────────────────────────────
  const [showPhoneModal, setShowPhoneModal] = useState(false);
  const [phoneInput, setPhoneInput] = useState('');
  const [phoneSaving, setPhoneSaving] = useState(false);

  // ── Request state ─────────────────────────────────────────────────────────────
  const [requesting, setRequesting] = useState(false);

  // ── Pricing ──────────────────────────────────────────────────────────────────
  const quantity = useMemo(() => {
    if (isHourly) {
      const hrs = Math.max(1, Math.round((endDate.getTime() - startDate.getTime()) / 36e5));
      return hrs;
    }
    return diffDays(startDate, endDate);
  }, [startDate, endDate, isHourly]);

  const subtotal = unitPrice * quantity;
  const serviceFee = Math.round(subtotal * 0.05);
  const discountAmount = discountApplied ? Math.round(subtotal * 0.1) : 0; // 10% off for demo
  const total = subtotal + serviceFee - discountAmount;

  // ── Picker handler ───────────────────────────────────────────────────────────
  const onPickerChange = (_: any, selected?: Date) => {
    setPicker(p => ({ ...p, visible: false }));
    if (!selected) return;
    const update = (prev: Date) => {
      const d = new Date(prev);
      if (picker.mode === 'date') { d.setFullYear(selected.getFullYear(), selected.getMonth(), selected.getDate()); }
      else { d.setHours(selected.getHours(), selected.getMinutes()); }
      return d;
    };
    if (picker.target === 'start') {
      const ns = update(startDate);
      setStartDate(ns);
      if (ns >= endDate) { const ne = new Date(ns); ne.setDate(ne.getDate() + 1); setEndDate(ne); }
    } else {
      const ne = update(endDate);
      if (ne > startDate) setEndDate(ne);
    }
  };

  const openPicker = (target: 'start' | 'end', mode: 'date' | 'time') =>
    setPicker({ visible: true, mode, target });

  // ── Send booking request (guide-first flow) ───────────────────────────────────
  const sendBookingRequest = async () => {
    if (!user) { Alert.alert('Sign in required', 'Please sign in first.'); return; }

    // guideCity is explicitly passed from guideDetail screen
    // Fall back to itemName only as last resort (e.g. hotel/rental city flows)
    const city = (params.guideCity || params.itemName || '').trim();
    if (!city) { Alert.alert('Missing city', 'Could not determine city for this booking. Please go back and try again.'); return; }

    setRequesting(true);
    try {
      await invokeFunction<{ success: boolean; bookingId: string; notifiedCount: number }>(
        'send-booking-request',
        {
          city,
          bookingType: params.bookingType || 'guide',
          itemId: params.itemId || '',
          itemName: params.itemName || '',
          days: quantity,
          amount: total,
          description: `${params.itemName} – ${quantity} ${unitLabel}${quantity > 1 ? 's' : ''}`,
          coupon: discountApplied ? coupon.trim().toUpperCase() : undefined,
          discountAmount: discountApplied ? discountAmount : undefined,
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
        }
      );

      Alert.alert(
        'Request Sent!',
        `Guides in ${city} have been notified. We'll alert you as soon as one accepts your booking.`,
        [{ text: 'View Bookings', onPress: () => router.replace('/more/MyBookings') }]
      );
    } catch (e: any) {
      Alert.alert('Request Failed', e.message || 'Could not send booking request. Please try again.');
    } finally {
      setRequesting(false);
    }
  };

  const handleProceed = () => {
    const phone = user?.phoneNumber || user?.user_metadata?.phone || '';
    if (!phone || phone.trim().length < 10) {
      setPhoneInput(phone || '');
      setShowPhoneModal(true);
    } else {
      sendBookingRequest();
    }
  };

  const handleSavePhone = async () => {
    const trimmed = phoneInput.trim();
    if (trimmed.length < 10) {
      Alert.alert('Invalid Number', 'Please enter a valid 10-digit phone number.');
      return;
    }
    if (!user) return;

    setPhoneSaving(true);
    try {
      // 1. Update Supabase Auth metadata
      const { error: authError } = await supabase.auth.updateUser({
        data: { phone: trimmed },
      });
      if (authError) throw authError;

      // 2. Sync to public users table
      const { error: dbError } = await supabase
        .from('users')
        .update({ phone: trimmed, updated_at: new Date().toISOString() })
        .eq('id', user.id);
      if (dbError) throw dbError;

      setShowPhoneModal(false);
      setTimeout(() => sendBookingRequest(), 300);
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Could not save phone number. Please try again.');
    } finally {
      setPhoneSaving(false);
    }
  };

  // ── UI ───────────────────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <StatusBar barStyle="dark-content" backgroundColor={C.white} />

      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn} activeOpacity={0.7}>
          <Ionicons name="chevron-back" size={24} color={C.dark} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Checkout</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={s.scroll} contentContainerStyle={s.scrollContent} showsVerticalScrollIndicator={false}>

        {/* Item summary */}
        <View style={s.card}>
          <View style={s.itemRow}>
            <View style={s.itemIconBox}>
              <Ionicons
                name={params.bookingType === 'vehicle' ? 'car-sport' : params.bookingType === 'hotel' ? 'bed' : 'person'}
                size={24} color={C.primary}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.itemName}>{params.itemName || 'Booking'}</Text>
              <Text style={s.itemType}>{(params.bookingType || '').charAt(0).toUpperCase() + (params.bookingType || '').slice(1)} Booking</Text>
            </View>
          </View>
        </View>

        {/* Date selection */}
        <Text style={s.sectionLabel}>Select Date & Time</Text>
        <View style={s.card}>
          {/* Start */}
          <Text style={s.dateLabel}>Start</Text>
          <View style={s.dateRow}>
            <TouchableOpacity style={s.dateChip} onPress={() => openPicker('start', 'date')} activeOpacity={0.7}>
              <Ionicons name="calendar-outline" size={16} color={C.primary} />
              <Text style={s.dateChipText}>{fmt(startDate)}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.dateChip} onPress={() => openPicker('start', 'time')} activeOpacity={0.7}>
              <Ionicons name="time-outline" size={16} color={C.blue} />
              <Text style={s.dateChipText}>{fmtTime(startDate)}</Text>
            </TouchableOpacity>
          </View>

          <View style={s.separator} />

          {/* End */}
          <Text style={s.dateLabel}>End</Text>
          <View style={s.dateRow}>
            <TouchableOpacity style={s.dateChip} onPress={() => openPicker('end', 'date')} activeOpacity={0.7}>
              <Ionicons name="calendar-outline" size={16} color={C.primary} />
              <Text style={s.dateChipText}>{fmt(endDate)}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.dateChip} onPress={() => openPicker('end', 'time')} activeOpacity={0.7}>
              <Ionicons name="time-outline" size={16} color={C.blue} />
              <Text style={s.dateChipText}>{fmtTime(endDate)}</Text>
            </TouchableOpacity>
          </View>

          {/* Duration badge */}
          <View style={s.durationBadge}>
            <Ionicons name="timer-outline" size={16} color={C.teal} />
            <Text style={s.durationText}>
              Duration: <Text style={{ fontWeight: '700', color: C.teal }}>{quantity} {unitLabel}{quantity > 1 ? 's' : ''}</Text>
            </Text>
          </View>
        </View>

        {/* Offers & Promos */}
        <Text style={s.sectionLabel}>Offers & Promos</Text>
        <View style={s.card}>
          <View style={s.couponRow}>
            <Ionicons name="pricetag-outline" size={20} color={C.gray} style={s.couponIcon} />
            <TextInput
              style={s.couponInput}
              placeholder="Enter coupon code"
              placeholderTextColor={C.gray}
              value={coupon}
              onChangeText={setCoupon}
              autoCapitalize="characters"
            />
            <TouchableOpacity 
              style={[s.applyBtn, !coupon.trim() && { opacity: 0.5 }]} 
              disabled={!coupon.trim()}
              onPress={() => setDiscountApplied(true)}
            >
              <Text style={s.applyBtnText}>{discountApplied ? 'Applied' : 'Apply'}</Text>
            </TouchableOpacity>
          </View>
          {discountApplied && (
            <View style={s.discountMsg}>
              <Ionicons name="checkmark-circle" size={16} color={C.primary} />
              <Text style={s.discountText}>Coupon applied! You saved ₹{discountAmount.toLocaleString('en-IN')}</Text>
            </View>
          )}
        </View>

        {/* Price breakdown */}
        <Text style={s.sectionLabel}>Price Details</Text>
        <View style={s.card}>
          <Row label={`₹${unitPrice.toLocaleString('en-IN')} × ${quantity} ${unitLabel}${quantity > 1 ? 's' : ''}`} value={`₹${subtotal.toLocaleString('en-IN')}`} />
          <Row label="Service fee (5%)" value={`₹${serviceFee.toLocaleString('en-IN')}`} />
          {discountApplied && (
            <Row label="Discount" value={`-₹${discountAmount.toLocaleString('en-IN')}`} isDiscount />
          )}
          <View style={s.priceDivider} />
          <Row label="Total" value={`₹${total.toLocaleString('en-IN')}`} bold />
        </View>

        {/* Trust badges */}
        <View style={s.trustRow}>
          <TrustBadge icon="shield-checkmark" text="Secure Payment" />
          <TrustBadge icon="refresh-circle" text="Free Cancel 24h" />
          <TrustBadge icon="call" text="24/7 Support" />
        </View>

        <View style={{ height: 120 }} />
      </ScrollView>

      {/* ── Phone Number Modal ── */}
      <Modal
        visible={showPhoneModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowPhoneModal(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={s.modalOverlay}
        >
          <View style={s.modalSheet}>
            {/* Handle bar */}
            <View style={s.modalHandle} />

            {/* Icon */}
            <View style={s.modalIconBox}>
              <Ionicons name="call" size={28} color={C.primary} />
            </View>

            <Text style={s.modalTitle}>Phone Number Required</Text>
            <Text style={s.modalSubtitle}>
              We need your phone number to confirm your booking and keep you updated.
            </Text>

            {/* Input */}
            <View style={s.phoneInputWrapper}>
              <View style={s.phonePrefix}>
                <Text style={s.phonePrefixText}>🇮🇳 +91</Text>
              </View>
              <TextInput
                style={s.phoneInput}
                placeholder="Enter 10-digit number"
                placeholderTextColor={C.gray}
                keyboardType="number-pad"
                maxLength={10}
                value={phoneInput}
                onChangeText={(t) => setPhoneInput(t.replace(/[^0-9]/g, ''))}
                autoFocus
              />
            </View>

            {/* Actions */}
            <TouchableOpacity
              style={[s.phoneSaveBtn, (phoneSaving || phoneInput.length < 10) && s.phoneSaveBtnDisabled]}
              onPress={handleSavePhone}
              activeOpacity={0.85}
              disabled={phoneSaving || phoneInput.length < 10}
            >
              {phoneSaving ? (
                <ActivityIndicator color={C.white} size="small" />
              ) : (
                <>
                  <Ionicons name="checkmark-circle" size={18} color={C.white} />
                  <Text style={s.phoneSaveBtnText}>Save & Continue</Text>
                </>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={s.phoneCancelBtn}
              onPress={() => setShowPhoneModal(false)}
              activeOpacity={0.7}
            >
              <Text style={s.phoneCancelBtnText}>Not now</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Picker */}
      {picker.visible && (
        <DateTimePicker
          value={picker.target === 'start' ? startDate : endDate}
          mode={picker.mode}
          display="default"
          onChange={onPickerChange}
          minimumDate={picker.target === 'end' ? startDate : new Date()}
        />
      )}

      {/* Bottom CTA */}
      <View style={[s.bottomCTA, { paddingBottom: Math.max(insets.bottom, 16) }]}>
        <View>
          <Text style={s.ctaPrice}>₹{total.toLocaleString('en-IN')}</Text>
          <Text style={s.ctaSub}>{quantity} {unitLabel}{quantity > 1 ? 's' : ''} · incl. fees</Text>
        </View>
        <TouchableOpacity
          style={[s.ctaBtn, requesting && { opacity: 0.7 }]}
          activeOpacity={0.85}
          onPress={handleProceed}
          disabled={requesting}
        >
          {requesting ? (
            <ActivityIndicator size="small" color={C.white} />
          ) : (
            <Ionicons name="paper-plane" size={16} color={C.white} />
          )}
          <Text style={s.ctaBtnText}>{requesting ? 'Sending Request…' : 'Request a Guide'}</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

// ── Tiny components ────────────────────────────────────────────────────────────
const Row = ({ label, value, bold, isDiscount }: { label: string; value: string; bold?: boolean; isDiscount?: boolean }) => (
  <View style={s.priceRow}>
    <Text style={[s.priceLabel, bold && s.priceBold, isDiscount && { color: C.primary }]}>{label}</Text>
    <Text style={[s.priceValue, bold && s.priceBold, isDiscount && { color: C.primary }]}>{value}</Text>
  </View>
);

const TrustBadge = ({ icon, text }: { icon: string; text: string }) => (
  <View style={s.trustBadge}>
    <Ionicons name={icon as any} size={18} color={C.primary} />
    <Text style={s.trustText}>{text}</Text>
  </View>
);

// ── Styles ─────────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12, backgroundColor: C.white,
    borderBottomWidth: 1, borderBottomColor: C.border,
  },
  backBtn: { width: 40, height: 40, borderRadius: 12, backgroundColor: C.lightGray, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '700', color: C.dark },
  scroll: { flex: 1 },
  scrollContent: { padding: 16 },

  card: {
    backgroundColor: C.white, borderRadius: 16, padding: 16, marginBottom: 16,
    borderWidth: 1, borderColor: C.border,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 8, elevation: 2,
  },
  sectionLabel: { fontSize: 16, fontWeight: '700', color: C.dark, marginBottom: 10, marginTop: 4, marginLeft: 4 },

  // Item
  itemRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  itemIconBox: {
    width: 48, height: 48, borderRadius: 14, backgroundColor: '#ECFDF5',
    alignItems: 'center', justifyContent: 'center',
  },
  itemName: { fontSize: 17, fontWeight: '700', color: C.dark },
  itemType: { fontSize: 13, color: C.gray, fontWeight: '500', marginTop: 2 },

  // Dates
  dateLabel: { fontSize: 13, fontWeight: '600', color: C.gray, marginBottom: 8 },
  dateRow: { flexDirection: 'row', gap: 10, marginBottom: 8 },
  dateChip: {
    flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: C.lightGray, paddingHorizontal: 14, paddingVertical: 12, borderRadius: 12,
  },
  dateChipText: { fontSize: 14, fontWeight: '600', color: C.dark },
  separator: { height: 1, backgroundColor: C.border, marginVertical: 12 },
  durationBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 8, alignSelf: 'flex-start',
    backgroundColor: '#F0FDFA', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, marginTop: 8,
  },
  durationText: { fontSize: 13, color: C.gray, fontWeight: '500' },

  // Price
  priceRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 10 },
  priceLabel: { fontSize: 14, color: C.gray, fontWeight: '500' },
  priceValue: { fontSize: 14, color: C.dark, fontWeight: '600' },
  priceBold: { fontWeight: '800', fontSize: 16, color: C.dark },
  priceDivider: { height: 1, backgroundColor: C.border, marginVertical: 4 },

  // Coupon
  couponRow: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: C.lightGray,
    borderRadius: 12, paddingHorizontal: 12, paddingVertical: 4,
  },
  couponIcon: { marginRight: 8 },
  couponInput: {
    flex: 1, fontSize: 14, color: C.dark, fontWeight: '600',
    paddingVertical: 10,
  },
  applyBtn: { paddingHorizontal: 12, paddingVertical: 8 },
  applyBtnText: { color: C.primary, fontWeight: '700', fontSize: 14 },
  discountMsg: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: '#F0FDFA', padding: 10, borderRadius: 8, marginTop: 12,
  },
  discountText: { color: C.primary, fontSize: 13, fontWeight: '600' },

  // Trust
  trustRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16, marginTop: 4 },
  trustBadge: { alignItems: 'center', gap: 6, flex: 1 },
  trustText: { fontSize: 11, color: C.gray, fontWeight: '600', textAlign: 'center' },

  // Phone Modal
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  modalSheet: {
    backgroundColor: C.white,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 24,
    paddingBottom: 36,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 20,
  },
  modalHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#D1D5DB',
    marginBottom: 20,
  },
  modalIconBox: {
    width: 64,
    height: 64,
    borderRadius: 20,
    backgroundColor: '#ECFDF5',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: C.dark,
    marginBottom: 8,
    textAlign: 'center',
  },
  modalSubtitle: {
    fontSize: 14,
    color: C.gray,
    fontWeight: '500',
    textAlign: 'center',
    lineHeight: 21,
    marginBottom: 24,
    paddingHorizontal: 8,
  },
  phoneInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    borderWidth: 1.5,
    borderColor: C.border,
    borderRadius: 14,
    backgroundColor: C.lightGray,
    marginBottom: 16,
    overflow: 'hidden',
  },
  phonePrefix: {
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderRightWidth: 1,
    borderRightColor: C.border,
    backgroundColor: '#F1F5F9',
  },
  phonePrefixText: {
    fontSize: 15,
    fontWeight: '600',
    color: C.dark,
  },
  phoneInput: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    color: C.dark,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  phoneSaveBtn: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: C.primary,
    paddingVertical: 16,
    borderRadius: 14,
    marginBottom: 10,
    shadowColor: C.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  phoneSaveBtnDisabled: {
    opacity: 0.5,
  },
  phoneSaveBtnText: {
    color: C.white,
    fontSize: 16,
    fontWeight: '800',
  },
  phoneCancelBtn: {
    paddingVertical: 10,
  },
  phoneCancelBtnText: {
    color: C.gray,
    fontSize: 14,
    fontWeight: '600',
  },

  // Bottom CTA
  bottomCTA: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: C.white, paddingHorizontal: 20, paddingTop: 16,
    borderTopWidth: 1, borderTopColor: C.border,
    shadowColor: '#000', shadowOffset: { width: 0, height: -4 }, shadowOpacity: 0.06, shadowRadius: 10, elevation: 10,
  },
  ctaPrice: { fontSize: 22, fontWeight: '800', color: C.dark },
  ctaSub: { fontSize: 12, color: C.gray, fontWeight: '500', marginTop: 2 },
  ctaBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: C.primary, paddingHorizontal: 24, paddingVertical: 16, borderRadius: 14,
    shadowColor: C.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 4,
  },
  ctaBtnText: { color: C.white, fontSize: 15, fontWeight: '800' },
});
