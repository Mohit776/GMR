import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useAuthStore } from '../../store/useAuthStore';
import { Colors } from '../../constants/colors';
import { Spacing, Radius, FontSize } from '../../constants/theme';

import {
  getBookings,
  listenToBookings,
  updateBookingStatus,
  getBookingRequests,
  listenToBookingRequests,
  acceptBookingRequest,
  type Booking,
  type BookingRequest,
  type BookingStatus,
} from '../../services/firestore';
import { useFocusEffect, router } from 'expo-router';
import { 
  Clock, 
  CheckCircle2, 
  XCircle, 
  CheckCheck, 
  Inbox, 
  CalendarDays, 
  FileText, 
  Compass, 
  Hotel, 
  Bike,
  RefreshCw,
} from 'lucide-react-native';
import { Text } from '../../components/Text';

const FILTERS: { key: BookingStatus | 'all'; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'pending', label: 'Pending' },
  { key: 'confirmed', label: 'Confirmed' },
  { key: 'completed', label: 'Done' },
  { key: 'cancelled', label: 'Cancelled' },
];

const statusConfig: Record<BookingStatus, { color: string; label: string; Icon: any }> = {
  pending:   { color: '#F59E0B', label: 'Pending',   Icon: Clock },
  confirmed: { color: '#10B981', label: 'Confirmed', Icon: CheckCircle2 },
  cancelled: { color: '#EF4444', label: 'Cancelled', Icon: XCircle },
  completed: { color: '#3B82F6', label: 'Completed', Icon: CheckCheck },
};

export default function BookingsScreen() {
  const { user, refreshProfile, profile } = useAuthStore();
  const userUid = user?.uid;
  const showRequestsTab = true;
  const [activeTab, setActiveTab] = useState<'requests' | 'bookings'>(showRequestsTab ? 'requests' : 'bookings');

  useEffect(() => {
    if (!showRequestsTab && activeTab === 'requests') {
      setActiveTab('bookings');
    }
  }, [showRequestsTab, activeTab]);
  const [requests, setRequests] = useState<BookingRequest[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<BookingStatus | 'all'>('all');
  const [updating, setUpdating] = useState<string | null>(null);
  const { setPendingRequestCount } = useAuthStore();

  const loadData = useCallback(async () => {
    if (!userUid) return;
    try {
      const [b, r] = await Promise.all([
        getBookings(userUid),
        getBookingRequests(userUid)
      ]);
      setBookings(b);
      setRequests(r);
      setPendingRequestCount(r.filter((req) => req.status === 'pending').length);
    } catch (error) {
      console.warn('Failed to load data:', error);
    } finally {
      setLoading(false);
    }
  }, [userUid, setPendingRequestCount]);

  const onRefresh = async () => {
    setRefreshing(true);
    await refreshProfile();
    await loadData();
    setRefreshing(false);
  };

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  useEffect(() => {
    if (!userUid) return undefined;

    const unsubscribeRequests = listenToBookingRequests(userUid, (rows) => {
      setRequests(rows);
      setPendingRequestCount(rows.filter((r) => r.status === 'pending').length);
    });
    const unsubscribeBookings = listenToBookings(userUid, setBookings);

    return () => {
      unsubscribeRequests();
      unsubscribeBookings();
    };
  }, [userUid, setPendingRequestCount]);

  const handleAcceptRequest = async (bookingId: string) => {
    Alert.alert(
      'Accept Request',
      'Are you sure you want to accept this booking request? If you are the first, it will be assigned to you.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Accept',
          onPress: async () => {
            setUpdating(bookingId);
            try {
              const res = await acceptBookingRequest(bookingId);
              if (res.success) {
                if (res.alreadyAccepted) {
                   Alert.alert('Info', 'You have already accepted this request. Waiting for user payment.');
                } else {
                   Alert.alert('Success', 'You accepted the request! The user has been notified to make the payment.');
                }
              } else if (res.reason === 'already_taken') {
                Alert.alert('Too late', 'Another guide has already taken this booking.');
              }
              await loadData();
            } catch {
              Alert.alert('Error', 'Failed to accept request.');
            } finally {
              setUpdating(null);
            }
          },
        },
      ]
    );
  };

  const filtered =
    filter === 'all' ? bookings : bookings.filter((b) => b.status === filter);

  const handleStatusChange = async (bookingId: string, status: BookingStatus) => {
    const actionLabel = status === 'confirmed' ? 'accept' : status === 'cancelled' ? 'cancel' : 'mark as ' + status;
    Alert.alert(
      `${status.charAt(0).toUpperCase() + status.slice(1)} Booking`,
      `Are you sure you want to ${actionLabel} this booking?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Proceed',
          onPress: async () => {
            setUpdating(bookingId);
            try {
              await updateBookingStatus(bookingId, status);
              await loadData();
            } catch {
              Alert.alert('Error', 'Failed to update booking status.');
            } finally {
              setUpdating(null);
            }
          },
        },
      ]
    );
  };

  return (
    <View style={styles.safe}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Bookings</Text>
          <Text style={styles.subtitle}>Manage your incoming requests</Text>
        </View>
        <View style={styles.headerActions}>
          <TouchableOpacity
            style={styles.refreshButton}
            onPress={onRefresh}
            disabled={refreshing}
          >
            {refreshing ? (
              <ActivityIndicator size="small" color={Colors.primary} />
            ) : (
              <RefreshCw size={18} color={Colors.primary} />
            )}
          </TouchableOpacity>
          <View style={styles.countBadge}>
            <Text style={styles.countText}>{requests.length + bookings.length}</Text>
          </View>
        </View>
      </View>

      {showRequestsTab ? (
        <View style={styles.tabContainer}>
          <TouchableOpacity
            style={[styles.tabButton, activeTab === 'requests' && styles.tabButtonActive]}
            onPress={() => setActiveTab('requests')}
          >
            <Text style={[styles.tabText, activeTab === 'requests' && styles.tabTextActive]}>Requests ({requests.length})</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tabButton, activeTab === 'bookings' && styles.tabButtonActive]}
            onPress={() => setActiveTab('bookings')}
          >
            <Text style={[styles.tabText, activeTab === 'bookings' && styles.tabTextActive]}>My Bookings ({bookings.length})</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={{ marginBottom: Spacing.sm }} />
      )}

      {/* Filters */}
      {activeTab === 'bookings' && (
      <View style={styles.filtersContainer}>
        <FlatList
          data={FILTERS}
          horizontal
          keyExtractor={(f) => f.key}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filters}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[styles.filterChip, filter === item.key && styles.filterChipActive]}
              onPress={() => setFilter(item.key)}
            >
              <Text style={[styles.filterText, filter === item.key && styles.filterTextActive]}>
                {item.label}
              </Text>
            </TouchableOpacity>
          )}
        />
      </View>
      )}

      {loading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      ) : activeTab === 'requests' ? (
        requests.length === 0 ? (
          <View style={styles.emptyWrap}>
            <View style={styles.emptyIconWrap}>
              <Inbox color={Colors.primary} size={40} />
            </View>
            <Text style={styles.emptyTitle}>No requests found</Text>
            <Text style={styles.emptySubtext}>New booking requests will appear here.</Text>
          </View>
        ) : (
          <FlatList
            data={requests}
            keyExtractor={(r) => r.id}
            contentContainerStyle={styles.list}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                tintColor={Colors.primary}
                colors={[Colors.primary]}
              />
            }
            renderItem={({ item }) => (
              <RequestItem
                request={item}
                updating={updating === item.bookingId}
                onAccept={() => handleAcceptRequest(item.bookingId)}
              />
            )}
          />
        )
      ) : filtered.length === 0 ? (
        <View style={styles.emptyWrap}>
          <View style={styles.emptyIconWrap}>
            <Inbox color={Colors.primary} size={40} />
          </View>
          <Text style={styles.emptyTitle}>No bookings found</Text>
          <Text style={styles.emptySubtext}>
            {filter === 'all'
              ? 'Incoming bookings will appear here.'
              : `No ${filter} bookings at the moment.`}
          </Text>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(b) => b.id}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={Colors.primary}
              colors={[Colors.primary]}
            />
          }
          renderItem={({ item }) => (
            <BookingItem
              booking={item}
              updating={updating === item.id}
              onAccept={() => handleStatusChange(item.id, 'confirmed')}
              onReject={() => handleStatusChange(item.id, 'cancelled')}
              onComplete={() => handleStatusChange(item.id, 'completed')}
            />
          )}
        />
      )}
    </View>
  );
}

function RequestItem({
  request,
  updating,
  onAccept,
}: {
  request: BookingRequest;
  updating: boolean;
  onAccept: () => void;
}) {
  const formattedPrice = request.amount.toLocaleString('en-IN', {
    maximumFractionDigits: 0,
    style: 'currency',
    currency: 'INR',
  });

  return (
    <View style={biStyles.card}>
      <View style={biStyles.cardHeader}>
        <View style={biStyles.typeInfo}>
          <Compass size={14} color={Colors.textMuted} />
          <Text style={biStyles.typeText}>{request.itemName.toUpperCase()}</Text>
        </View>
        <View style={[biStyles.statusIndicator, { backgroundColor: '#F59E0B15' }]}>
          <View style={[biStyles.statusDot, { backgroundColor: '#F59E0B' }]} />
          <Text style={[biStyles.statusText, { color: '#F59E0B' }]}>NEW REQUEST</Text>
        </View>
      </View>

      <View style={biStyles.cardBody}>
        <View style={biStyles.mainInfo}>
          <Text style={biStyles.guestName}>{request.guestName}</Text>
          <Text style={biStyles.priceText}>{formattedPrice}</Text>
        </View>

        <View style={biStyles.detailRow}>
          <View style={biStyles.detailItem}>
            <CalendarDays size={14} color={Colors.textMuted} />
            <Text style={biStyles.detailText}>{request.date}</Text>
          </View>
          <View style={biStyles.detailItem}>
             <Compass size={14} color={Colors.textMuted} />
             <Text style={biStyles.detailText}>{request.city}</Text>
          </View>
        </View>

        {request.note ? (
           <View style={{...biStyles.detailRow, marginTop: -8}}>
            <View style={biStyles.detailItem}>
              <FileText size={14} color={Colors.textMuted} />
              <Text style={biStyles.detailText} numberOfLines={1}>{request.note}</Text>
            </View>
          </View>
        ) : null}

        {updating ? (
          <View style={biStyles.updatingWrap}>
            <ActivityIndicator size="small" color={Colors.primary} />
          </View>
        ) : (
          <View style={biStyles.actionsContainer}>
             <TouchableOpacity
               style={biStyles.primaryAction}
               onPress={onAccept}
               activeOpacity={0.7}
             >
               <Text style={biStyles.primaryActionText}>Accept Request</Text>
             </TouchableOpacity>
          </View>
        )}
      </View>
    </View>
  );
}

function BookingItem({
  booking,
  updating,
  onAccept,
  onReject,
  onComplete,
}: {
  booking: Booking;
  updating: boolean;
  onAccept: () => void;
  onReject: () => void;
  onComplete: () => void;
}) {
  const s = statusConfig[booking.status] || statusConfig.pending;
  const isPending = booking.status === 'pending';
  const isConfirmed = booking.status === 'confirmed';

  const formattedPrice = booking.price.toLocaleString('en-IN', {
    maximumFractionDigits: 0,
    style: 'currency',
    currency: 'INR',
  });

  return (
    <TouchableOpacity 
      style={biStyles.card}
      activeOpacity={0.7}
      onPress={() => {
        router.push({
          pathname: '/more/costumerDetails',
          params: { 
            bookingId: booking.id, 
            guestName: booking.guestName, 
            date: booking.date, 
            note: booking.note, 
            type: booking.type, 
            status: booking.status, 
            price: booking.price 
          }
        });
      }}
    >
      <View style={biStyles.cardHeader}>
        <View style={biStyles.typeInfo}>
          {booking.type === 'guide' && <Compass size={14} color={Colors.textMuted} />}
          {booking.type === 'hotel' && <Hotel size={14} color={Colors.textMuted} />}
          {booking.type === 'rental' && <Bike size={14} color={Colors.textMuted} />}
          <Text style={biStyles.typeText}>{booking.type.toUpperCase()}</Text>
        </View>
        <View style={[biStyles.statusIndicator, { backgroundColor: s.color + '15' }]}>
          <View style={[biStyles.statusDot, { backgroundColor: s.color }]} />
          <Text style={[biStyles.statusText, { color: s.color }]}>{s.label}</Text>
        </View>
      </View>

      <View style={biStyles.cardBody}>
        <View style={biStyles.mainInfo}>
          <Text style={biStyles.guestName}>{booking.guestName || 'Guest Traveler'}</Text>
          <Text style={biStyles.priceText}>{formattedPrice}</Text>
        </View>

        <View style={biStyles.detailRow}>
          <View style={biStyles.detailItem}>
            <CalendarDays size={14} color={Colors.textMuted} />
            <Text style={biStyles.detailText}>{booking.date}</Text>
          </View>
          {booking.note && (
            <View style={biStyles.detailItem}>
              <FileText size={14} color={Colors.textMuted} />
              <Text style={biStyles.detailText} numberOfLines={1}>{booking.note}</Text>
            </View>
          )}
        </View>

        {updating ? (
          <View style={biStyles.updatingWrap}>
            <ActivityIndicator size="small" color={Colors.primary} />
          </View>
        ) : (
          <View style={biStyles.actionsContainer}>
            {isPending && (
              <View style={biStyles.pendingActions}>
                <TouchableOpacity 
                  style={biStyles.primaryAction} 
                  onPress={onAccept}
                  activeOpacity={0.7}
                >
                  <Text style={biStyles.primaryActionText}>Accept</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={biStyles.secondaryAction} 
                  onPress={onReject}
                  activeOpacity={0.7}
                >
                  <Text style={biStyles.secondaryActionText}>Decline</Text>
                </TouchableOpacity>
              </View>
            )}
            {isConfirmed && (
              <TouchableOpacity 
                style={biStyles.completeAction} 
                onPress={onComplete}
                activeOpacity={0.7}
              >
                <CheckCheck size={18} color={Colors.white} />
                <Text style={biStyles.completeActionText}>Mark as Completed</Text>
              </TouchableOpacity>
            )}
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
}

const biStyles = StyleSheet.create({
  card: {
    backgroundColor: Colors.white,
    borderRadius: Radius.lg,
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    backgroundColor: '#FAFAFA',
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  typeInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  typeText: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.textMuted,
    letterSpacing: 0.5,
  },
  statusIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: Radius.full,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '600',
  },
  cardBody: {
    padding: Spacing.md,
  },
  mainInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  guestName: {
    fontSize: FontSize.lg,
    fontWeight: '700',
    color: Colors.text,
    flex: 1,
  },
  priceText: {
    fontSize: FontSize.lg,
    fontWeight: '700',
    color: Colors.primary,
  },
  detailRow: {
    flexDirection: 'row',
    gap: Spacing.md,
    marginBottom: Spacing.md,
  },
  detailItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  detailText: {
    fontSize: FontSize.sm,
    color: Colors.textMuted,
  },
  actionsContainer: {
    marginTop: 4,
  },
  pendingActions: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  primaryAction: {
    flex: 2,
    backgroundColor: Colors.primary,
    paddingVertical: 12,
    borderRadius: Radius.md,
    alignItems: 'center',
  },
  primaryActionText: {
    color: Colors.white,
    fontWeight: '600',
    fontSize: FontSize.sm,
  },
  secondaryAction: {
    flex: 1,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingVertical: 12,
    borderRadius: Radius.md,
    alignItems: 'center',
  },
  secondaryActionText: {
    color: Colors.text,
    fontWeight: '600',
    fontSize: FontSize.sm,
  },
  completeAction: {
    backgroundColor: '#10B981',
    flexDirection: 'row',
    paddingVertical: 12,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  completeActionText: {
    color: Colors.white,
    fontWeight: '600',
    fontSize: FontSize.sm,
  },
  updatingWrap: {
    paddingVertical: 12,
    alignItems: 'center',
  },
});

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: Colors.white,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.md,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: Colors.text,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: FontSize.sm,
    color: Colors.textMuted,
    marginTop: 2,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  refreshButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.white,
  },
  countBadge: {
    backgroundColor: Colors.primary,
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  countText: {
    color: Colors.white,
    fontSize: FontSize.sm,
    fontWeight: '700',
  },
  tabContainer: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.lg,
    marginBottom: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  tabButton: {
    flex: 1,
    paddingVertical: Spacing.md,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabButtonActive: {
    borderBottomColor: Colors.primary,
  },
  tabText: {
    fontSize: FontSize.md,
    fontWeight: '600',
    color: Colors.textMuted,
  },
  tabTextActive: {
    color: Colors.primary,
  },
  filtersContainer: {
    paddingVertical: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  filters: {
    paddingHorizontal: Spacing.lg,
    gap: Spacing.xs,
  },
  filterChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: Radius.full,
    backgroundColor: '#F3F4F6',
  },
  filterChipActive: {
    backgroundColor: Colors.primary,
  },
  filterText: {
    fontSize: FontSize.sm,
    fontWeight: '600',
    color: Colors.textMuted,
  },
  filterTextActive: {
    color: Colors.white,
  },
  list: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: 40,
  },
  loadingWrap: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyWrap: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  emptyIconWrap: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(26, 115, 232, 0.05)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.lg,
  },
  emptyTitle: {
    fontSize: FontSize.lg,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: FontSize.sm,
    color: Colors.textMuted,
    textAlign: 'center',
    lineHeight: 20,
  },
});
