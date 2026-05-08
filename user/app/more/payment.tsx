import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  StyleSheet,
  StatusBar,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  BackHandler,
} from 'react-native';
import RazorpayCheckout from 'react-native-razorpay';
import { Text } from '../../components/Text';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../utils/supabase';

const COLORS = {
  primary: '#16A34A',
  white: '#FFFFFF',
  darkGray: '#1F2937',
  mediumGray: '#6B7280',
  lightGray: '#F1F5F9',
  borderGray: '#E2E8F0',
  danger: '#EF4444',
  success: '#16A34A',
};

type PaymentStatus = 'idle' | 'processing' | 'success' | 'failed';

type BookingPayload = {
  amount: number;
  description: string;
  bookingType: string;
  itemId: string;
  itemName: string;
  days: number;
  partnerId: string;
  coupon?: string;
  discountAmount?: number;
};

type CreateOrderResponse = {
  keyId: string;
  orderId: string;
  amount: number;
  currency: string;
};

type RazorpaySuccessResponse = {
  razorpay_payment_id: string;
  razorpay_order_id: string;
  razorpay_signature: string;
};

type VerifyPaymentResponse = {
  bookingId: string;
  paymentId: string;
};

type FunctionResult<T> = {
  data: T | null;
  error: { message?: string } | null;
};

function getErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  if (error && typeof error === 'object' && 'description' in error) {
    return String((error as { description?: unknown }).description || 'Payment failed.');
  }
  if (error && typeof error === 'object' && 'message' in error) {
    return String((error as { message?: unknown }).message || 'Payment failed.');
  }
  return 'Payment failed. Please try again.';
}

function isUserCancelledPayment(error: unknown) {
  if (!error || typeof error !== 'object') return false;
  const value = `${(error as any).code || ''} ${(error as any).description || ''}`.toLowerCase();
  return value.includes('cancel') || value.includes('dismiss') || value.includes('back');
}

async function invokeFunction<T>(name: string, body: unknown) {
  const result = await supabase.functions.invoke(name, { body: body as any }) as FunctionResult<T>;
  if (result.error) {
    let message = result.error.message || `${name} failed.`;
    const context = (result.error as any).context;
    if (context && typeof context.json === 'function') {
      try {
        const errorBody = await context.json();
        message = errorBody?.error || errorBody?.message || message;
      } catch {}
    }
    throw new Error(message);
  }
  if (!result.data) {
    throw new Error(`${name} returned an empty response.`);
  }
  return result.data;
}

export default function PaymentScreen() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const hasStarted = useRef(false);
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus>('idle');
  const [statusMessage, setStatusMessage] = useState('Preparing secure payment...');
  const [isRetrying, setIsRetrying] = useState(false);

  const {
    amount,
    description,
    bookingType,
    itemId,
    itemName,
    days,
    partnerId,
    coupon,
    discountAmount,
  } = useLocalSearchParams<{
    amount: string;
    description: string;
    bookingType: string;
    itemId: string;
    itemName: string;
    days: string;
    partnerId: string;
    coupon?: string;
    discountAmount?: string;
  }>();

  const amountInRupees = Number.parseFloat(amount || '0') || 0;

  const bookingPayload = useMemo<BookingPayload>(() => ({
    amount: amountInRupees,
    description: description || 'Booking Payment',
    bookingType: bookingType || 'unknown',
    itemId: itemId || '',
    itemName: itemName || '',
    days: Math.max(1, Number.parseInt(days || '1', 10) || 1),
    partnerId: partnerId || '',
    coupon: coupon || undefined,
    discountAmount: Math.max(0, Number.parseFloat(discountAmount || '0') || 0),
  }), [amountInRupees, bookingType, coupon, days, description, discountAmount, itemId, itemName, partnerId]);

  const safeNavigate = useCallback((fn: () => void) => {
    setTimeout(fn, 0);
  }, []);

  useFocusEffect(
    useCallback(() => {
      const onBackPress = () => {
        if (paymentStatus === 'success') {
          safeNavigate(() => router.replace('/more/MyBookings'));
          return true;
        }

        if (paymentStatus === 'processing') {
          Alert.alert('Payment in Progress', 'Please wait while we finish your payment securely.');
          return true;
        }

        Alert.alert(
          'Cancel Payment?',
          'Are you sure you want to leave this payment?',
          [
            { text: 'Stay', style: 'cancel' },
            {
              text: 'Leave',
              style: 'destructive',
              onPress: () => safeNavigate(() => router.back()),
            },
          ]
        );
        return true;
      };

      const subscription = BackHandler.addEventListener('hardwareBackPress', onBackPress);
      return () => subscription.remove();
    }, [paymentStatus, router, safeNavigate])
  );

  const startPayment = useCallback(async () => {
    if (!user) {
      setPaymentStatus('failed');
      setStatusMessage('Please sign in before making a payment.');
      return;
    }

    if (bookingPayload.amount <= 0) {
      setPaymentStatus('failed');
      setStatusMessage('Invalid payment amount. Please go back and try again.');
      return;
    }

    try {
      setPaymentStatus('processing');
      setStatusMessage('Creating your Razorpay order...');

      const order = await invokeFunction<CreateOrderResponse>('razorpay-create-order', bookingPayload);

      setStatusMessage('Opening Razorpay checkout...');
      const checkoutResult = await RazorpayCheckout.open({
        key: order.keyId,
        amount: String(order.amount),
        currency: order.currency,
        name: 'Guide My Route',
        description: bookingPayload.description,
        order_id: order.orderId,
        prefill: {
          name: user.displayName || user.user_metadata?.full_name || '',
          email: user.email || '',
          contact: user.phoneNumber || user.phone || '',
        },
        theme: { color: COLORS.primary },
        retry: { enabled: true, max_count: 3 },
      }) as RazorpaySuccessResponse;

      if (!checkoutResult.razorpay_payment_id || !checkoutResult.razorpay_order_id || !checkoutResult.razorpay_signature) {
        throw new Error('Razorpay did not return complete payment details.');
      }

      setStatusMessage('Verifying payment securely...');
      const verified = await invokeFunction<VerifyPaymentResponse>('razorpay-verify-payment', {
        booking: bookingPayload,
        razorpay_payment_id: checkoutResult.razorpay_payment_id,
        razorpay_order_id: checkoutResult.razorpay_order_id,
        razorpay_signature: checkoutResult.razorpay_signature,
      });

      setPaymentStatus('success');
      setStatusMessage(`Payment verified. Booking ${verified.bookingId} is confirmed.`);

      setTimeout(() => {
        safeNavigate(() => router.replace('/more/MyBookings'));
      }, 1800);
    } catch (error) {
      const message = isUserCancelledPayment(error)
        ? 'Payment was cancelled. No booking was created.'
        : getErrorMessage(error);

      console.error('Razorpay payment error:', error);
      setPaymentStatus('failed');
      setStatusMessage(message);

      if (!isUserCancelledPayment(error)) {
        Alert.alert('Payment Failed', message);
      }
    } finally {
      setIsRetrying(false);
    }
  }, [bookingPayload, router, safeNavigate, user]);

  useEffect(() => {
    if (hasStarted.current || authLoading) return;
    hasStarted.current = true;
    startPayment();
  }, [authLoading, startPayment]);

  const handleRetry = () => {
    setIsRetrying(true);
    startPayment();
  };

  const handleClose = () => {
    if (paymentStatus === 'success') {
      safeNavigate(() => router.replace('/more/MyBookings'));
      return;
    }

    if (paymentStatus === 'processing') {
      Alert.alert('Payment in Progress', 'Please wait while we finish your payment securely.');
      return;
    }

    Alert.alert(
      'Cancel Payment?',
      'Are you sure you want to leave this payment?',
      [
        { text: 'Stay', style: 'cancel' },
        {
          text: 'Leave',
          style: 'destructive',
          onPress: () => safeNavigate(() => router.back()),
        },
      ]
    );
  };

  const isBusy = paymentStatus === 'idle' || paymentStatus === 'processing' || isRetrying;
  const iconName = paymentStatus === 'success'
    ? 'checkmark-circle'
    : paymentStatus === 'failed'
      ? 'alert-circle'
      : 'lock-closed';
  const iconColor = paymentStatus === 'failed' ? COLORS.danger : COLORS.success;

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.white} />

      <View style={styles.header}>
        <TouchableOpacity
          style={styles.headerBtn}
          onPress={handleClose}
          activeOpacity={0.7}
        >
          <Ionicons
            name={paymentStatus === 'success' ? 'checkmark-circle' : 'close'}
            size={24}
            color={paymentStatus === 'success' ? COLORS.success : COLORS.darkGray}
          />
        </TouchableOpacity>

        <View style={styles.headerCenter}>
          <View style={styles.secureIndicator}>
            <Ionicons name="lock-closed" size={12} color={COLORS.success} />
            <Text style={styles.secureText}>Secure Payment</Text>
          </View>
          <Text style={styles.headerTitle}>
            {paymentStatus === 'success'
              ? 'Payment Complete'
              : `INR ${amountInRupees.toLocaleString('en-IN')}`}
          </Text>
        </View>

        <View style={styles.headerBtn} />
      </View>

      <View style={styles.content}>
        <View style={styles.statusIcon}>
          {isBusy ? (
            <ActivityIndicator size="large" color={COLORS.primary} />
          ) : (
            <Ionicons name={iconName} size={44} color={iconColor} />
          )}
        </View>

        <Text style={styles.statusTitle}>
          {paymentStatus === 'success'
            ? 'Booking confirmed'
            : paymentStatus === 'failed'
              ? 'Payment not completed'
              : 'Processing payment'}
        </Text>
        <Text style={styles.statusText}>{statusMessage}</Text>

        {paymentStatus === 'failed' && (
          <TouchableOpacity
            style={[styles.retryBtn, isRetrying && styles.retryBtnDisabled]}
            activeOpacity={0.85}
            disabled={isRetrying}
            onPress={handleRetry}
          >
            {isRetrying ? (
              <ActivityIndicator size="small" color={COLORS.white} />
            ) : (
              <Ionicons name="refresh" size={16} color={COLORS.white} />
            )}
            <Text style={styles.retryBtnText}>Try Again</Text>
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.bottomInfo}>
        <View style={styles.bottomInfoRow}>
          <Ionicons name="shield-checkmark-outline" size={16} color={COLORS.mediumGray} />
          <Text style={styles.bottomInfoText}>
            100% secure payment - Powered by Razorpay
          </Text>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.white,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: COLORS.white,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderGray,
  },
  headerBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: COLORS.lightGray,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerCenter: {
    alignItems: 'center',
    gap: 2,
  },
  secureIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  secureText: {
    fontSize: 11,
    color: COLORS.success,
    fontWeight: '600',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: COLORS.darkGray,
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
    backgroundColor: '#F8FAFC',
  },
  statusIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: COLORS.white,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
    borderWidth: 1,
    borderColor: COLORS.borderGray,
  },
  statusTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: COLORS.darkGray,
    textAlign: 'center',
    marginBottom: 8,
  },
  statusText: {
    fontSize: 14,
    color: COLORS.mediumGray,
    textAlign: 'center',
    lineHeight: 21,
  },
  retryBtn: {
    marginTop: 24,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: COLORS.primary,
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderRadius: 14,
  },
  retryBtnDisabled: {
    opacity: 0.7,
  },
  retryBtnText: {
    color: COLORS.white,
    fontSize: 15,
    fontWeight: '800',
  },
  bottomInfo: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: COLORS.white,
    borderTopWidth: 1,
    borderTopColor: COLORS.borderGray,
  },
  bottomInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  bottomInfoText: {
    fontSize: 12,
    color: COLORS.mediumGray,
    fontWeight: '500',
  },
});
