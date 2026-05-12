import React, { useCallback, useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  Alert,
  Modal,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  RefreshControl,
  Image,
  Switch,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { useAuthStore } from '../../store/useAuthStore';
import { Colors } from '../../constants/colors';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Spacing, Radius, FontSize } from '../../constants/theme';
import {
  getListings,
  createListing,
  deleteListing,
  updateListing,
  type Listing,
} from '../../services/firestore';
import { Compass, Hotel, Bike, Plus, Trash2, X, FileText, Image as ImageIcon, Camera, Edit2, DollarSign, Clock, Play, Upload } from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import { uploadToSupabase } from '../../services/storage';
import { supabase } from '../../services/supabase';
import { useVideoPlayer, VideoView } from 'expo-video';

export default function ListingsScreen() {
  const { user, profile, refreshProfile } = useAuthStore();
  const userUid = user?.uid;
  const [listings, setListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ title: '', description: '', price: '', details: {} as Record<string, string> });
  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [focusedField, setFocusedField] = useState<string | null>(null);
  const [images, setImages] = useState<string[]>([]);
  const [activePicker, setActivePicker] = useState<{ key: string, label: string, options: string[] } | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);

  const rawRole = profile?.role;
  const role = (rawRole === 'guide' || rawRole === 'hotel' || rawRole === 'rental') ? rawRole : 'guide';
  const roleLabel = role === 'guide' ? 'Services' : role === 'hotel' ? 'Rooms' : 'Vehicles';
  const RoleIcon = role === 'guide' ? Compass : role === 'hotel' ? Hotel : Bike;

  const loadListings = useCallback(async () => {
    if (!userUid) return;
    try {
      setListings(await getListings(userUid));
    } catch (error) {
      console.warn('Failed to load listings:', error);
    } finally {
      setLoading(false);
    }
  }, [userUid]);

  const onRefresh = async () => {
    setRefreshing(true);
    await refreshProfile();
    await loadListings();
    setRefreshing(false);
  };

  useFocusEffect(
    useCallback(() => {
      loadListings();
    }, [loadListings])
  );

  const detailRequired = (key: string) => !form.details[key]?.trim();

  const handleAdd = async () => {
    if (!form.title.trim() || !form.price.trim()) {
      Alert.alert('Missing Fields', 'Title and price are required.');
      return;
    }
    if (role === 'guide' && (detailRequired('duration') || detailRequired('meetingPoint'))) {
      Alert.alert('Missing Fields', 'Duration and meeting point are required.');
      return;
    }
    if (role === 'hotel' && (detailRequired('roomType') || detailRequired('maxOccupancy'))) {
      Alert.alert('Missing Fields', 'Room type and max occupancy are required.');
      return;
    }
    if (role === 'rental' && (detailRequired('vehicleType') || detailRequired('fuelType') || detailRequired('helmet') || detailRequired('minDuration') || detailRequired('deposit'))) {
      Alert.alert('Missing Fields', 'All vehicle details are required.');
      return;
    }
    if (!user) return;

    setSubmitting(true);
    try {
      const uploadedImageUrls = [];
      for (const uri of images) {
        if (uri.startsWith('http')) {
          uploadedImageUrls.push(uri);
        } else {
          const mimeType = uri.endsWith('.png') ? 'image/png' : 'image/jpeg';
          const fileName = uri.split('/').pop() || `image_${Date.now()}.jpg`;
          const url = await uploadToSupabase(uri, mimeType, fileName, 'gmr_listings');
          uploadedImageUrls.push(url);
        }
      }

      if (editingId) {
        await updateListing(editingId, {
          title: form.title.trim(),
          description: form.description.trim(),
          price: parseFloat(form.price) || 0,
          images: uploadedImageUrls,
          details: form.details,
        });
      } else {
        await createListing({
          partnerId: user.uid,
          type: role,
          title: form.title.trim(),
          description: form.description.trim(),
          price: parseFloat(form.price) || 0,
          images: uploadedImageUrls,
          isActive: true,
          details: form.details,
        });
      }
      await loadListings();
      setForm({ title: '', description: '', price: '', details: {} });
      setImages([]);
      setEditingId(null);
      setShowModal(false);
    } catch (err: any) {
      console.error('createListing/updateListing error:', err);
      Alert.alert('Error', `Failed to save listing:\n${err?.message ?? String(err)}`);
    } finally {
      setSubmitting(false);
    }
  };

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0].uri) {
      setImages((prev) => [...prev, result.assets[0].uri]);
    }
  };

  const removeImage = (index: number) => {
    setImages((prev) => prev.filter((_, i) => i !== index));
  };

  const setDetail = (key: string, val: string) =>
    setForm((f) => ({ ...f, details: { ...f.details, [key]: val } }));

  const handleDelete = (id: string, title: string) => {
    Alert.alert('Delete Listing', `Remove "${title}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          setDeleting(id);
          try {
            await deleteListing(id);
            await loadListings();
          } catch {
            Alert.alert('Error', 'Could not delete listing.');
          } finally {
            setDeleting(null);
          }
        },
      },
    ]);
  };

  const handleToggle = async (listing: Listing) => {
    try {
      await updateListing(listing.id, { isActive: !listing.isActive });
      await loadListings();
    } catch {
      Alert.alert('Error', 'Could not update listing.');
    }
  };

  const handleEdit = (listing: Listing) => {
    setEditingId(listing.id);
    setForm({
      title: listing.title,
      description: listing.description || '',
      price: listing.price.toString(),
      details: listing.details || {},
    });
    setImages(listing.images || []);
    setShowModal(true);
  };

  if (role === 'guide') {
    return <GuideSettingsView profile={profile} user={user} refreshProfile={refreshProfile} />;
  }

  return (
    <View style={styles.safe}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <View style={styles.titleRow}>
            <RoleIcon color={Colors.text} size={28} />
            <Text style={styles.title}>My {roleLabel}</Text>
          </View>
          <Text style={styles.subtitle}>{listings.length} listing{listings.length !== 1 ? 's' : ''}</Text>
        </View>
        <TouchableOpacity
          style={[styles.addBtn, (!profile?.isApproved || (!profile?.hasUploadedDocs && role !== 'hotel')) && { backgroundColor: Colors.textMuted }]}
          onPress={() => {
            if (!profile?.hasUploadedDocs && role !== 'hotel') {
              router.push('/onboarding/upload-docs');
              return;
            }
            if (!profile?.isApproved) {
              Alert.alert('Pending Approval', 'Your account is pending approval from the admin. You cannot create listings yet.');
              return;
            }
            setEditingId(null);
            setForm({ title: '', description: '', price: '', details: {} });
            setImages([]);
            setShowModal(true);
          }}
          activeOpacity={0.85}
        >
          <Plus color={Colors.white} size={20} />
          <Text style={styles.addBtnText}>Add</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      ) : listings.length === 0 ? (
        (!profile?.hasUploadedDocs && role !== 'hotel') ? (
          <View style={styles.emptyWrap}>
            <View style={styles.emptyIconWrap}>
              <FileText color={Colors.primary} size={48} />
            </View>
            <Text style={styles.emptyTitle}>Upload Documents</Text>
            <Text style={styles.emptySubtext}>
              You must upload compliance documents before you can create any listings.
            </Text>
            <TouchableOpacity
              style={styles.emptyBtn}
              onPress={() => router.push('/onboarding/upload-docs')}
            >
              <Text style={styles.emptyBtnText}>Upload Documents</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.emptyWrap}>
            <View style={styles.emptyIconWrap}>
              <RoleIcon color={Colors.primary} size={48} />
            </View>
            <Text style={styles.emptyTitle}>No listings yet</Text>
            <Text style={styles.emptySubtext}>
              Add your first listing so travellers can discover and book you.
            </Text>
            <TouchableOpacity
              style={[styles.emptyBtn, !profile?.isApproved && { backgroundColor: Colors.textMuted }]}
              onPress={() => {
                if (!profile?.isApproved) {
                  Alert.alert('Pending Approval', 'Your account is pending approval from the admin. You cannot create listings yet.');
                  return;
                }
                setEditingId(null);
                setForm({ title: '', description: '', price: '', details: {} });
                setImages([]);
                setShowModal(true);
              }}
            >
              <Text style={styles.emptyBtnText}>Add First Listing</Text>
            </TouchableOpacity>
          </View>
        )
      ) : (
        <FlatList
          data={listings}
          keyExtractor={(l) => l.id}
          contentContainerStyle={styles.list}
          ItemSeparatorComponent={() => <View style={{ height: Spacing.sm }} />}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={Colors.primary}
            />
          }
          renderItem={({ item }) => (
            <ListingCard
              listing={item}
              deleting={deleting === item.id}
              onDelete={() => handleDelete(item.id, item.title)}
              onToggle={() => handleToggle(item)}
              onEdit={() => handleEdit(item)}
            />
          )}
        />
      )}

      {/* Add listing modal */}
      <Modal visible={showModal} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView style={styles.modal}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{editingId ? 'Edit' : 'Add'} {roleLabel.slice(0, -1)}</Text>
            <TouchableOpacity onPress={() => setShowModal(false)} style={styles.modalClose}>
              <X color={Colors.textMuted} size={24} />
            </TouchableOpacity>
          </View>

          <KeyboardAvoidingView
            style={{ flex: 1 }}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          >
            <ScrollView contentContainerStyle={styles.modalScroll} keyboardShouldPersistTaps="handled">
              {/* ── Shared fields ── */}
              <Text style={styles.sectionHeader}>Basic Info</Text>

              <Text style={styles.label}>Title *</Text>
              <TextInput
                style={[styles.input, focusedField === 'title' && styles.inputFocused]}
                placeholder={role === 'hotel' ? 'e.g. Deluxe Double Room' : 'e.g. Royal Enfield Bullet 350'}
                placeholderTextColor={Colors.textLight}
                value={form.title}
                onChangeText={(v) => setForm({ ...form, title: v })}
                onFocus={() => setFocusedField('title')}
                onBlur={() => setFocusedField(null)}
              />

              <Text style={[styles.label, { marginTop: Spacing.md }]}>Description</Text>
              <TextInput
                style={[styles.input, styles.multiline, focusedField === 'desc' && styles.inputFocused]}
                placeholder="Describe what's included, highlights, etc."
                placeholderTextColor={Colors.textLight}
                value={form.description}
                onChangeText={(v) => setForm({ ...form, description: v })}
                multiline numberOfLines={4} textAlignVertical="top"
                onFocus={() => setFocusedField('desc')}
                onBlur={() => setFocusedField(null)}
              />

              <Text style={[styles.label, { marginTop: Spacing.md }]}>
                Price (₹ per {role === 'hotel' ? 'night' : 'day'}) *
              </Text>
              <TextInput
                style={[styles.input, focusedField === 'price' && styles.inputFocused]}
                placeholder="e.g. 1500"
                placeholderTextColor={Colors.textLight}
                value={form.price}
                onChangeText={(v) => setForm({ ...form, price: v })}
                keyboardType="numeric"
                onFocus={() => setFocusedField('price')}
                onBlur={() => setFocusedField(null)}
              />


              {/* ── Hotel-specific fields ── */}
              {role === 'hotel' && (
                <>
                  <Text style={styles.sectionHeader}>Room Details</Text>

                  <Text style={styles.label}>Room Type *</Text>
                  <TouchableOpacity
                    style={[styles.input, focusedField === 'roomType' && styles.inputFocused]}
                    activeOpacity={0.7}
                    onPress={() => setActivePicker({ key: 'roomType', label: 'Room Type', options: ['Single', 'Double', 'Twin', 'Suite', 'Deluxe', 'Studio', 'Family', 'Villa', 'Dormitory'] })}
                  >
                    <Text style={{ color: form.details.roomType ? Colors.text : Colors.textLight }}>
                      {form.details.roomType || 'Select Room Type'}
                    </Text>
                  </TouchableOpacity>

                  <Text style={[styles.label, { marginTop: Spacing.md }]}>Bed Configuration</Text>
                  <TextInput style={[styles.input, focusedField === 'bedConfig' && styles.inputFocused]}
                    placeholder="e.g. 1 King Bed / 2 Single Beds" placeholderTextColor={Colors.textLight}
                    value={form.details.bedConfig ?? ''} onChangeText={(v) => setDetail('bedConfig', v)}
                    onFocus={() => setFocusedField('bedConfig')} onBlur={() => setFocusedField(null)} />

                  <Text style={[styles.label, { marginTop: Spacing.md }]}>Max Occupancy *</Text>
                  <TextInput style={[styles.input, focusedField === 'maxOccupancy' && styles.inputFocused]}
                    placeholder="e.g. 2" placeholderTextColor={Colors.textLight} keyboardType="numeric"
                    value={form.details.maxOccupancy ?? ''} onChangeText={(v) => setDetail('maxOccupancy', v)}
                    onFocus={() => setFocusedField('maxOccupancy')} onBlur={() => setFocusedField(null)} />

                  <Text style={[styles.label, { marginTop: Spacing.md }]}>Floor / View</Text>
                  <TextInput style={[styles.input, focusedField === 'floorView' && styles.inputFocused]}
                    placeholder="e.g. 3rd Floor, Mountain View" placeholderTextColor={Colors.textLight}
                    value={form.details.floorView ?? ''} onChangeText={(v) => setDetail('floorView', v)}
                    onFocus={() => setFocusedField('floorView')} onBlur={() => setFocusedField(null)} />

                  <Text style={[styles.label, { marginTop: Spacing.md }]}>Cancellation Policy</Text>
                  <TextInput style={[styles.input, focusedField === 'cancellation' && styles.inputFocused]}
                    placeholder="e.g. Free cancellation up to 24 hrs" placeholderTextColor={Colors.textLight}
                    value={form.details.cancellation ?? ''} onChangeText={(v) => setDetail('cancellation', v)}
                    onFocus={() => setFocusedField('cancellation')} onBlur={() => setFocusedField(null)} />

                  <Text style={[styles.label, { marginTop: Spacing.md }]}>Room Amenities</Text>
                  <TextInput style={[styles.input, styles.multiline, focusedField === 'roomAmenities' && styles.inputFocused]}
                    placeholder="e.g. AC, TV, Hot Water, Balcony" placeholderTextColor={Colors.textLight}
                    value={form.details.roomAmenities ?? ''} onChangeText={(v) => setDetail('roomAmenities', v)}
                    multiline numberOfLines={3} textAlignVertical="top"
                    onFocus={() => setFocusedField('roomAmenities')} onBlur={() => setFocusedField(null)} />
                </>
              )}

              {/* ── Rental-specific fields ── */}
              {role === 'rental' && (
                <>
                  <Text style={styles.sectionHeader}>Vehicle Details</Text>

                  <Text style={styles.label}>Vehicle Type *</Text>
                  <TouchableOpacity
                    style={[styles.input, focusedField === 'vehicleType' && styles.inputFocused]}
                    activeOpacity={0.7}
                    onPress={() => setActivePicker({ key: 'vehicleType', label: 'Vehicle Type', options: ['Bike', 'Scooty', 'Car'] })}
                  >
                    <Text style={{ color: form.details.vehicleType ? Colors.text : Colors.textLight }}>
                      {form.details.vehicleType || 'Select Vehicle Type'}
                    </Text>
                  </TouchableOpacity>

                  <Text style={[styles.label, { marginTop: Spacing.md }]}>Fuel Type *</Text>
                  <TouchableOpacity
                    style={[styles.input, focusedField === 'fuelType' && styles.inputFocused]}
                    activeOpacity={0.7}
                    onPress={() => setActivePicker({ key: 'fuelType', label: 'Fuel Type', options: ['Petrol', 'Diesel', 'Electric', 'CNG'] })}
                  >
                    <Text style={{ color: form.details.fuelType ? Colors.text : Colors.textLight }}>
                      {form.details.fuelType || 'Select Fuel Type'}
                    </Text>
                  </TouchableOpacity>

                  <Text style={[styles.label, { marginTop: Spacing.md }]}>Helmet Provided? *</Text>
                  <TouchableOpacity
                    style={[styles.input, focusedField === 'helmet' && styles.inputFocused]}
                    activeOpacity={0.7}
                    onPress={() => setActivePicker({ key: 'helmet', label: 'Helmet Provided', options: ['Yes', 'No'] })}
                  >
                    <Text style={{ color: form.details.helmet ? Colors.text : Colors.textLight }}>
                      {form.details.helmet || 'Select Yes / No'}
                    </Text>
                  </TouchableOpacity>

                  <Text style={[styles.label, { marginTop: Spacing.md }]}>Min Rental Duration *</Text>
                  <TextInput style={[styles.input, focusedField === 'minDuration' && styles.inputFocused]}
                    placeholder="e.g. 1 Day" placeholderTextColor={Colors.textLight}
                    value={form.details.minDuration ?? ''} onChangeText={(v) => setDetail('minDuration', v)}
                    onFocus={() => setFocusedField('minDuration')} onBlur={() => setFocusedField(null)} />

                  <Text style={[styles.label, { marginTop: Spacing.md }]}>Security Deposit (₹) *</Text>
                  <TextInput style={[styles.input, focusedField === 'deposit' && styles.inputFocused]}
                    placeholder="e.g. 2000" placeholderTextColor={Colors.textLight} keyboardType="numeric"
                    value={form.details.deposit ?? ''} onChangeText={(v) => setDetail('deposit', v)}
                    onFocus={() => setFocusedField('deposit')} onBlur={() => setFocusedField(null)} />
                </>
              )}

              {/* Images Section */}
              <Text style={styles.sectionHeader}>Photos</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: Spacing.md }}>
                {images.map((uri, idx) => (
                  <View key={idx} style={{ marginRight: 10, position: 'relative', marginTop: 10 }}>
                    <Image source={{ uri }} style={{ width: 100, height: 100, borderRadius: Radius.md }} />
                    <TouchableOpacity
                      onPress={() => removeImage(idx)}
                      style={{ position: 'absolute', top: -5, right: -5, backgroundColor: Colors.error, borderRadius: 12, padding: 2, zIndex: 10 }}
                      hitSlop={{ top: 10, right: 10, bottom: 10, left: 10 }}
                    >
                      <X color={Colors.white} size={14} />
                    </TouchableOpacity>
                  </View>
                ))}
                <TouchableOpacity
                  onPress={pickImage}
                  style={{ width: 100, height: 100, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.border, borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center', marginTop: 10 }}
                >
                  <Plus color={Colors.primary} size={24} />
                  <Text style={{ color: Colors.primary, fontSize: FontSize.sm, marginTop: 4 }}>Add Photo</Text>
                </TouchableOpacity>
              </ScrollView>

              <TouchableOpacity
                style={[styles.submitBtn, submitting && { opacity: 0.7 }]}
                onPress={handleAdd}
                disabled={submitting}
                activeOpacity={0.85}
              >
                {submitting ? (
                  <ActivityIndicator color={Colors.white} />
                ) : (
                  <Text style={styles.submitBtnText}>{editingId ? 'Save Changes' : 'Create Listing'}</Text>
                )}
              </TouchableOpacity>
            </ScrollView>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Modal>

      <Modal visible={!!activePicker} transparent animationType="slide">
        <TouchableOpacity
          style={styles.pickerOverlay}
          activeOpacity={1}
          onPress={() => setActivePicker(null)}
        >
          <View style={styles.pickerContent}>
            <View style={styles.pickerHeader}>
              <Text style={styles.pickerTitle}>Select {activePicker?.label}</Text>
              <TouchableOpacity onPress={() => setActivePicker(null)}>
                <X size={20} color={Colors.text} />
              </TouchableOpacity>
            </View>
            <ScrollView>
              {activePicker?.options.map(option => (
                <TouchableOpacity
                  key={option}
                  style={styles.pickerOption}
                  onPress={() => {
                    setDetail(activePicker.key, option);
                    setActivePicker(null);
                  }}
                >
                  <Text style={[
                    styles.pickerOptionText,
                    form.details[activePicker.key] === option && styles.pickerOptionSelected
                  ]}>{option}</Text>
                  {form.details[activePicker.key] === option && (
                    <View style={styles.pickerCheck} />
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

function GuideVideoPlayer({ url }: { url: string }) {
  const [playing, setPlaying] = useState(false);
  const player = useVideoPlayer(url, (p) => {
    p.loop = false;
  });

  const toggle = () => {
    if (playing) {
      player.pause();
      setPlaying(false);
    } else {
      player.play();
      setPlaying(true);
    }
  };

  const filename = decodeURIComponent(url.split('/').pop() || 'demo_video.mp4');

  return (
    <View style={gs.videoBox}>
      <VideoView player={player} style={gs.videoPlayer} contentFit="contain" nativeControls={false} />
      <TouchableOpacity style={gs.videoOverlay} onPress={toggle} activeOpacity={0.8}>
        <View style={gs.videoPlayBtn}>
          {playing
            ? <View style={{ flexDirection: 'row', gap: 5 }}>
                <View style={{ width: 4, height: 18, backgroundColor: Colors.white, borderRadius: 2 }} />
                <View style={{ width: 4, height: 18, backgroundColor: Colors.white, borderRadius: 2 }} />
              </View>
            : <Play color={Colors.white} size={22} style={{ marginLeft: 3 }} />
          }
        </View>
      </TouchableOpacity>
      <View style={gs.videoNameBar}>
        <Text style={gs.videoName} numberOfLines={1}>{filename}</Text>
      </View>
    </View>
  );
}

function GuideSettingsView({ profile, user, refreshProfile }: {
  profile: any; user: any; refreshProfile: () => Promise<any>;
}) {
  const pd = profile?.profileData || {};
  const [rate, setRate] = useState(String(pd.per_hour_rate || ''));
  const [avail, setAvail] = useState(pd.is_available !== false);
  const [videoUrl, setVideoUrl] = useState(profile?.kycVideoUrl || '');
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (profile) {
      const p = profile.profileData || {};
      setRate(String(p.per_hour_rate || ''));
      setAvail(p.is_available !== false);
      setVideoUrl(profile.kycVideoUrl || '');
    }
  }, [profile]);

  const onRefresh = async () => {
    setRefreshing(true);
    await refreshProfile();
    setRefreshing(false);
  };

  const saveRate = async () => {
    if (!user) return;
    const n = parseFloat(rate);
    if (!n || n <= 0) { Alert.alert('Invalid', 'Enter a valid hourly rate.'); return; }
    setSaving(true);
    try {
      const updated = { ...(profile?.profileData || {}), per_hour_rate: n };
      await supabase.from('users').update({
        profile_data: updated, updated_at: new Date().toISOString(),
      }).eq('id', user.uid);
      await refreshProfile();
      Alert.alert('Saved', 'Hourly rate updated.');
    } catch (e: any) { Alert.alert('Error', e.message || 'Failed to save.'); }
    finally { setSaving(false); }
  };

  const toggleAvail = async (v: boolean) => {
    if (!user) return;
    setAvail(v);
    try {
      const updated = { ...(profile?.profileData || {}), is_available: v };
      await supabase.from('users').update({
        profile_data: updated, updated_at: new Date().toISOString(),
      }).eq('id', user.uid);
      await refreshProfile();
    } catch (e: any) { setAvail(!v); Alert.alert('Error', e.message || 'Failed.'); }
  };

  const replaceVideo = async () => {
    if (!user) return;
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Videos,
      allowsEditing: true, quality: 0.8,
    });
    if (res.canceled || !res.assets[0]?.uri) return;
    setUploading(true);
    try {
      const uri = res.assets[0].uri;
      const fname = uri.split('/').pop() || `demo_${Date.now()}.mp4`;
      const url = await uploadToSupabase(uri, 'video/mp4', fname, 'demo-videos');
      await supabase.from('users').update({
        kyc_video_url: url, updated_at: new Date().toISOString(),
      }).eq('id', user.uid);
      setVideoUrl(url);
      await refreshProfile();
      Alert.alert('Success', 'Demo video updated.');
    } catch (e: any) { Alert.alert('Error', e.message || 'Upload failed.'); }
    finally { setUploading(false); }
  };

  return (
    <View style={gs.safe}>
      <ScrollView
        contentContainerStyle={gs.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
      >
        <View style={gs.headerSection}>
          <View style={gs.titleRow}>
            <Compass color={Colors.primary} size={28} />
            <Text style={gs.title}>Guide Settings</Text>
          </View>
          <Text style={gs.subtitle}>Manage your rate, availability & demo video</Text>
        </View>

        {!profile?.isApproved && (
          <View style={gs.banner}>
            <Text style={gs.bannerText}>⏳ Your account is pending admin approval</Text>
          </View>
        )}

        {/* Hourly Rate */}
        <View style={gs.card}>
          <View style={gs.cardHead}>
            <View style={gs.iconCircle}><DollarSign color={Colors.primary} size={18} /></View>
            <Text style={gs.cardTitle}>Per Hour Rate</Text>
          </View>
          <Text style={gs.cardDesc}>Set your hourly rate. Users will see this on your profile.</Text>
          <View style={gs.rateRow}>
            <Text style={gs.currency}>₹</Text>
            <TextInput
              style={gs.rateInput}
              placeholder="e.g. 500"
              placeholderTextColor={Colors.textLight}
              value={rate}
              onChangeText={setRate}
              keyboardType="numeric"
            />
            <Text style={gs.rateUnit}>/ hour</Text>
          </View>
          <TouchableOpacity
            style={[gs.saveBtn, saving && { opacity: 0.6 }]}
            onPress={saveRate} disabled={saving} activeOpacity={0.85}
          >
            {saving ? <ActivityIndicator color={Colors.white} size="small" /> :
              <Text style={gs.saveBtnText}>Save Rate</Text>}
          </TouchableOpacity>
        </View>

        {/* Availability */}
        <View style={gs.card}>
          <View style={gs.cardHead}>
            <View style={[gs.iconCircle, { backgroundColor: avail ? '#DCFCE7' : '#FEE2E2' }]}>
              <Clock color={avail ? '#16A34A' : '#EF4444'} size={18} />
            </View>
            <Text style={gs.cardTitle}>Availability</Text>
          </View>
          <Text style={gs.cardDesc}>Toggle whether you're currently available for bookings.</Text>
          <View style={gs.availRow}>
            <View style={[gs.availBadge, { backgroundColor: avail ? '#DCFCE7' : '#FEE2E2' }]}>
              <View style={[gs.availDot, { backgroundColor: avail ? '#16A34A' : '#EF4444' }]} />
              <Text style={{ color: avail ? '#15803D' : '#DC2626', fontWeight: '700', fontSize: 14 }}>
                {avail ? 'Available' : 'Unavailable'}
              </Text>
            </View>
            <Switch
              value={avail}
              onValueChange={toggleAvail}
              trackColor={{ false: '#D1D5DB', true: '#86EFAC' }}
              thumbColor={avail ? '#16A34A' : '#9CA3AF'}
            />
          </View>
        </View>

        {/* Demo Video */}
        <View style={gs.card}>
          <View style={gs.cardHead}>
            <View style={gs.iconCircle}><Camera color={Colors.primary} size={18} /></View>
            <Text style={gs.cardTitle}>Demo Video</Text>
          </View>
          <Text style={gs.cardDesc}>Upload a short video introducing yourself to potential clients.</Text>
          {videoUrl ? (
            <GuideVideoPlayer url={videoUrl} />
          ) : (
            <View style={gs.noVideo}>
              <Camera color={Colors.textMuted} size={32} />
              <Text style={gs.noVideoText}>No demo video uploaded yet</Text>
            </View>
          )}
          <TouchableOpacity
            style={[gs.replaceBtn, uploading && { opacity: 0.6 }]}
            onPress={replaceVideo} disabled={uploading} activeOpacity={0.85}
          >
            {uploading ? <ActivityIndicator color={Colors.primary} size="small" /> : (
              <>
                <Upload color={Colors.primary} size={16} />
                <Text style={gs.replaceBtnText}>{videoUrl ? 'Replace Video' : 'Upload Video'}</Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const gs = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  scroll: { padding: Spacing.md },
  headerSection: { marginBottom: Spacing.lg },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 4 },
  title: { fontSize: FontSize.xl, fontWeight: '800', color: Colors.text },
  subtitle: { fontSize: FontSize.sm, color: Colors.textMuted, marginTop: 2, marginLeft: 38 },
  banner: { backgroundColor: '#FEF3C7', borderRadius: Radius.md, padding: Spacing.md, marginBottom: Spacing.md },
  bannerText: { color: '#92400E', fontWeight: '600', fontSize: FontSize.sm, textAlign: 'center' },
  card: {
    backgroundColor: Colors.white, borderRadius: 16, padding: 20, marginBottom: 16,
    shadowColor: Colors.black, shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.08, shadowRadius: 10, elevation: 3,
  },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 },
  iconCircle: {
    width: 36, height: 36, borderRadius: 10, backgroundColor: '#EFF6FF',
    alignItems: 'center', justifyContent: 'center',
  },
  cardTitle: { fontSize: 16, fontWeight: '700', color: Colors.text },
  cardDesc: { fontSize: 13, color: Colors.textMuted, lineHeight: 19, marginBottom: 16 },
  rateRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.background, borderRadius: Radius.md, borderWidth: 1.5, borderColor: Colors.border, marginBottom: 14 },
  currency: { fontSize: 18, fontWeight: '700', color: Colors.text, paddingLeft: 14 },
  rateInput: { flex: 1, fontSize: 18, fontWeight: '700', color: Colors.text, paddingVertical: 14, paddingHorizontal: 8 },
  rateUnit: { fontSize: 14, color: Colors.textMuted, fontWeight: '600', paddingRight: 14 },
  saveBtn: { backgroundColor: Colors.accent, borderRadius: Radius.full, paddingVertical: 14, alignItems: 'center' },
  saveBtnText: { color: Colors.white, fontSize: FontSize.base, fontWeight: '700' },
  availRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  availBadge: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 100 },
  availDot: { width: 8, height: 8, borderRadius: 4 },
  videoBox: { backgroundColor: '#111827', borderRadius: 12, overflow: 'hidden', marginBottom: 14 },
  videoPlayer: { width: '100%', height: 200 },
  videoOverlay: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    alignItems: 'center', justifyContent: 'center',
  },
  videoPlayBtn: {
    width: 52, height: 52, borderRadius: 26,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center', justifyContent: 'center',
  },
  videoNameBar: {
    backgroundColor: 'rgba(0,0,0,0.6)', paddingHorizontal: 12, paddingVertical: 8,
  },
  videoName: { color: '#9CA3AF', fontSize: 12, fontWeight: '500' },
  noVideo: { alignItems: 'center', paddingVertical: 24, backgroundColor: Colors.background, borderRadius: 12, marginBottom: 14 },
  noVideoText: { color: Colors.textMuted, fontSize: 13, marginTop: 8, fontWeight: '500' },
  replaceBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    borderWidth: 1.5, borderColor: Colors.primary, borderRadius: Radius.full, paddingVertical: 12,
  },
  replaceBtnText: { color: Colors.primary, fontSize: FontSize.base, fontWeight: '700' },
});

function ListingCard({
  listing,
  deleting,
  onDelete,
  onToggle,
  onEdit,
}: {
  listing: Listing;
  deleting: boolean;
  onDelete: () => void;
  onToggle: () => void;
  onEdit: () => void;
}) {
  return (
    <View style={lcStyles.card}>
      <View style={lcStyles.row}>
        {listing.images && listing.images.length > 0 && (
          <Image
            source={{ uri: listing.images[0] }}
            style={{ width: 80, height: 80, borderRadius: 8, marginRight: 12, backgroundColor: Colors.border }}
          />
        )}
        <View style={lcStyles.info}>
          <View style={lcStyles.headerRow}>
            {listing.type === 'guide' && (
              <View style={[lcStyles.typeTag, { backgroundColor: '#DBEAFE' }]}>
                <Compass color="#1E40AF" size={12} />
                <Text style={[lcStyles.typeText, { color: '#1E40AF' }]}>Guide</Text>
              </View>
            )}
            {listing.type === 'hotel' && (
              <View style={[lcStyles.typeTag, { backgroundColor: '#F3E8FF' }]}>
                <Hotel color="#6B21A8" size={12} />
                <Text style={[lcStyles.typeText, { color: '#6B21A8' }]}>Hotel</Text>
              </View>
            )}
            {listing.type === 'rental' && (
              <View style={[lcStyles.typeTag, { backgroundColor: '#CCFBF1' }]}>
                <Bike color="#115E59" size={12} />
                <Text style={[lcStyles.typeText, { color: '#115E59' }]}>Rental</Text>
              </View>
            )}
            <View style={[lcStyles.activeBadge, { backgroundColor: listing.isActive ? Colors.statusConfirmed : Colors.background }]}>
              <Text style={[lcStyles.activeText, { color: listing.isActive ? Colors.statusConfirmedText : Colors.textMuted }]}>
                {listing.isActive ? 'Active' : 'Inactive'}
              </Text>
            </View>
          </View>

          <Text style={lcStyles.title} numberOfLines={1}>{listing.title}</Text>

          {!!listing.description && (
            <Text style={lcStyles.desc} numberOfLines={2}>{listing.description}</Text>
          )}

          {/* Role-specific detail chips */}
          <View style={lcStyles.chips}>
            {listing.type === 'guide' && (
              <>
                {!!listing.details?.duration && <DetailChip label={listing.details.duration} />}
                {!!listing.details?.tourType && <DetailChip label={listing.details.tourType} />}
                {!!listing.details?.difficulty && <DetailChip label={listing.details.difficulty} />}
                {!!listing.details?.groupSize && <DetailChip label={`Max ${listing.details.groupSize} pax`} />}
              </>
            )}
            {listing.type === 'hotel' && (
              <>
                {!!listing.details?.roomType && <DetailChip label={listing.details.roomType} />}
                {!!listing.details?.bedConfig && <DetailChip label={listing.details.bedConfig} />}
                {!!listing.details?.maxOccupancy && <DetailChip label={`Up to ${listing.details.maxOccupancy} guests`} />}
                {!!listing.details?.floorView && <DetailChip label={listing.details.floorView} />}
              </>
            )}
            {listing.type === 'rental' && (
              <>
                {!!listing.details?.fuelType && <DetailChip label={listing.details.fuelType} />}
                {!!listing.details?.helmet && <DetailChip label={`Helmet: ${listing.details.helmet}`} />}
                {!!listing.details?.minDuration && <DetailChip label={`Min: ${listing.details.minDuration}`} />}
                {!!listing.details?.deposit && <DetailChip label={`Dep: ₹${listing.details.deposit}`} />}
              </>
            )}
          </View>

          <Text style={lcStyles.price}>₹{listing.price.toLocaleString('en-IN')} <Text style={lcStyles.priceUnit}>/ {listing.type === 'hotel' ? 'night' : 'day'}</Text></Text>
        </View>
      </View>

      <View style={lcStyles.actions}>
        <TouchableOpacity style={lcStyles.toggleBtn} onPress={onToggle}>
          <Text style={lcStyles.toggleText}>
            {listing.isActive ? 'Deactivate' : 'Activate'}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity style={lcStyles.editBtn} onPress={onEdit}>
          <Edit2 color={Colors.primary} size={16} />
          <Text style={lcStyles.editText}>Edit</Text>
        </TouchableOpacity>
        {deleting ? (
          <View style={lcStyles.deleteBtnLoading}>
            <ActivityIndicator color={Colors.error} size="small" />
          </View>
        ) : (
          <TouchableOpacity style={lcStyles.deleteBtn} onPress={onDelete}>
            <Trash2 color={Colors.error} size={16} />
            <Text style={lcStyles.deleteText}>Delete</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

function DetailChip({ label }: { label: string }) {
  return (
    <View style={lcStyles.chip}>
      <Text style={lcStyles.chipText} numberOfLines={1}>{label}</Text>
    </View>
  );
}

const lcStyles = StyleSheet.create({
  card: {
    backgroundColor: Colors.white,
    borderRadius: 12,
    padding: 16,
    shadowColor: Colors.black,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 3,
  },
  row: { flexDirection: 'row', marginBottom: 16 },
  info: { flex: 1 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  typeTag: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 100 },
  typeText: { fontSize: 11, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
  title: { fontSize: 16, fontWeight: '700', color: Colors.text, marginBottom: 4 },
  activeBadge: { borderRadius: 100, paddingHorizontal: 10, paddingVertical: 4 },
  activeText: { fontSize: 12, fontWeight: '600' },
  desc: { fontSize: 13, color: Colors.textMuted, lineHeight: 18, marginBottom: 6 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 8 },
  chip: { backgroundColor: '#F1F5F9', borderRadius: 100, paddingHorizontal: 10, paddingVertical: 4 },
  chipText: { fontSize: 11, fontWeight: '600', color: Colors.textMuted },
  price: { fontSize: 18, fontWeight: '700', color: Colors.primary },
  priceUnit: { fontSize: 13, fontWeight: '400', color: Colors.textMuted },
  actions: { flexDirection: 'row', gap: 12, borderTopWidth: 1, borderTopColor: Colors.border, paddingTop: 16 },
  toggleBtn: {
    flex: 1,
    borderRadius: 100,
    paddingVertical: 10,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: Colors.border,
    backgroundColor: Colors.white,
  },
  toggleText: { fontSize: 14, fontWeight: '600', color: Colors.text },
  editBtn: {
    borderRadius: 100,
    paddingVertical: 10,
    paddingHorizontal: 20,
    alignItems: 'center',
    flexDirection: 'row',
    gap: 6,
    backgroundColor: '#EFF6FF',
  },
  editText: { fontSize: 14, fontWeight: '600', color: Colors.primary },
  deleteBtn: {
    borderRadius: 100,
    paddingVertical: 10,
    paddingHorizontal: 20,
    alignItems: 'center',
    flexDirection: 'row',
    gap: 6,
    backgroundColor: '#FEF2F2',
  },
  deleteBtnLoading: {
    borderRadius: 100,
    paddingVertical: 10,
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FEF2F2',
  },
  deleteText: { fontSize: 14, fontWeight: '600', color: Colors.error },
});

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.md,
  },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { fontSize: FontSize.xl, fontWeight: '800', color: Colors.text },
  subtitle: { fontSize: FontSize.sm, color: Colors.textMuted, marginTop: 2 },
  addBtn: {
    backgroundColor: Colors.accent,
    borderRadius: Radius.full,
    paddingHorizontal: Spacing.lg,
    paddingVertical: 10,
    shadowColor: Colors.accent,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 4,
  },
  addBtnText: { color: Colors.white, fontSize: FontSize.base, fontWeight: '700' },
  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 },
  emptyIconWrap: { width: 96, height: 96, borderRadius: 100, backgroundColor: 'rgba(26, 115, 232, 0.08)', alignItems: 'center', justifyContent: 'center', marginBottom: 20 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: Colors.text, marginBottom: 8, textAlign: 'center' },
  emptySubtext: { fontSize: 14, color: Colors.textMuted, textAlign: 'center', lineHeight: 22, marginBottom: 24, maxWidth: 280 },
  emptyBtn: {
    backgroundColor: Colors.primary,
    borderRadius: 100,
    paddingHorizontal: 24,
    paddingVertical: 14,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  emptyBtnText: { color: Colors.white, fontWeight: '600', fontSize: 15 },
  list: { paddingHorizontal: 16, paddingBottom: 24 },
  modal: { flex: 1, backgroundColor: Colors.background },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  modalTitle: { fontSize: FontSize.lg, fontWeight: '700', color: Colors.text },
  modalClose: { padding: Spacing.sm },
  modalScroll: { padding: Spacing.md },
  label: { fontSize: FontSize.sm, fontWeight: '600', color: Colors.text, marginBottom: 6 },
  input: {
    backgroundColor: Colors.white,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: 14,
    fontSize: FontSize.base,
    color: Colors.text,
    borderWidth: 1.5,
    borderColor: Colors.border,
  },
  inputFocused: { borderColor: Colors.primary },
  multiline: { height: 100, paddingTop: 14 },
  submitBtn: {
    backgroundColor: Colors.accent,
    borderRadius: Radius.full,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: Spacing.lg,
    shadowColor: Colors.accent,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 5,
  },
  submitBtnText: { color: Colors.white, fontSize: FontSize.md, fontWeight: '700' },
  sectionHeader: {
    fontSize: FontSize.sm,
    fontWeight: '800',
    color: Colors.primary,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginTop: Spacing.lg,
    marginBottom: Spacing.sm,
  },
  pickerOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    padding: 24,
  },
  pickerContent: {
    backgroundColor: Colors.white,
    borderRadius: 24,
    paddingTop: 20,
    paddingBottom: 24,
    maxHeight: '60%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.2,
    shadowRadius: 15,
    elevation: 10,
  },
  pickerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    marginBottom: 16,
  },
  pickerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.text,
  },
  pickerOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  pickerOptionText: {
    fontSize: 16,
    color: Colors.text,
  },
  pickerOptionSelected: {
    color: Colors.primary,
    fontWeight: '600',
  },
  pickerCheck: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: Colors.primary,
  },
});
