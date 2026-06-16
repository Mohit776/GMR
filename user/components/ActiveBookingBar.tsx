import React, { useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Text } from './Text';
import { supabase } from '../utils/supabase';
import { useAuth } from '../contexts/AuthContext';

interface ActiveBooking {
  id: string;
  name: string;
  status: string;
  pickup: string;
  amount: number;
  prePaymentStatus: string | null;
  bookingType: string | null;
}

export default function ActiveBookingBar() {
  const { user } = useAuth();
  const router = useRouter();
  const [booking, setBooking] = useState<ActiveBooking | null>(null);
  const [visible, setVisible] = useState(false);
  const lastBookingRef = useRef<ActiveBooking | null>(null);
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const slideAnim = useRef(new Animated.Value(60)).current;

  const fetchActiveBooking = async () => {
    if (!user) return;
    const { data, error } = await supabase
      .from('bookings')
      .select('id, item_name, status, pickup_location, city, amount, price, pre_payment_status, booking_type')
      .eq('user_id', user.id)
      .in('status', ['confirmed', 'pending'])
      .order('created_at', { ascending: false })
      .limit(1);

    if (!error && data && data.length > 0) {
      const row = data[0];
      setBooking({
        id: row.id,
        name: row.item_name || 'Active Booking',
        status: row.status,
        pickup: row.pickup_location || row.city || 'Location',
        amount: row.amount || row.price || 0,
        prePaymentStatus: row.pre_payment_status || null,
        bookingType: row.booking_type || null,
      });
    } else {
      setBooking(null);
    }
  };

  useEffect(() => {
    fetchActiveBooking();
  }, [user]);

  // Real-time subscription to booking changes
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel(`active-booking-bar-${user.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'bookings', filter: `user_id=eq.${user.id}` },
        () => { fetchActiveBooking(); }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user]);

  // Pulse animation for the live dot
  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 0.3, duration: 800, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
      ])
    );
    if (booking) {
      lastBookingRef.current = booking; // cache before animating in
      if (!visible) setVisible(true);
      pulse.start();
      Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true, tension: 80, friction: 12 }).start();
    } else {
      pulse.stop();
      // Slide out first, THEN unmount
      Animated.timing(slideAnim, { toValue: 60, duration: 220, useNativeDriver: true }).start(() => {
        setVisible(false);
      });
    }
    return () => pulse.stop();
  }, [booking]);

  if (!visible) return null;

  // Use cached ref so render always has data even while sliding out (booking may be null)
  const display = booking ?? lastBookingRef.current;
  if (!display) return null;

  const isGuideBooking = display.bookingType === 'guide';
  const isAwaitingGuide = isGuideBooking && display.prePaymentStatus === 'awaiting_guide';
  const isAwaitingPayment = display.prePaymentStatus === 'awaiting_payment';

  let label = 'Active Booking';
  let sub = `${display.name} · ${display.pickup}`;
  let barColor = '#16A34A';
  let dotColor = '#86EFAC';

  if (isAwaitingGuide) {
    label = 'Finding Guide…';
    barColor = '#D97706';
    dotColor = '#FCD34D';
  } else if (isAwaitingPayment) {
    label = 'Pay Now to Confirm';
    barColor = '#0D9488';
    dotColor = '#5EEAD4';
  } else if (display.status === 'pending') {
    label = 'Booking Pending';
    barColor = '#D97706';
    dotColor = '#FCD34D';
  }

  return (
    <Animated.View style={[styles.wrapper, { transform: [{ translateY: slideAnim }] }]}>
      <TouchableOpacity
        style={[styles.bar, { backgroundColor: barColor }]}
        activeOpacity={0.82}
        onPress={() => router.push('/more/MyBookings')}
      >
        {/* Left: dot + text */}
        <View style={styles.left}>
          <Animated.View style={[styles.dotOuter, { backgroundColor: `${dotColor}40`, opacity: pulseAnim }]}>
            <View style={[styles.dotInner, { backgroundColor: dotColor }]} />
          </Animated.View>
          <View style={styles.textBox}>
            <Text style={styles.label}>{label}</Text>
            <Text style={styles.sub} numberOfLines={1}>{sub}</Text>
          </View>
        </View>

        {/* Right: amount + chevron */}
        <View style={styles.right}>
          {display.amount > 0 && (
            <View style={styles.amountPill}>
              <Text style={styles.amount}>₹{display.amount.toLocaleString()}</Text>
            </View>
          )}
          <Ionicons name="chevron-forward" size={16} color="rgba(255,255,255,0.75)" />
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    overflow: 'hidden',
  },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderTopLeftRadius: 14,
    borderTopRightRadius: 14,
    marginHorizontal: 8,
    marginBottom: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 10,
  },
  left: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  dotOuter: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  dotInner: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  textBox: {
    flex: 1,
  },
  label: {
    fontSize: 12,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.1,
  },
  sub: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.75)',
    fontWeight: '500',
    marginTop: 1,
  },
  right: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexShrink: 0,
  },
  amountPill: {
    backgroundColor: 'rgba(0,0,0,0.2)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  amount: {
    fontSize: 12,
    fontWeight: '800',
    color: '#FFFFFF',
  },
});
