import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  RefreshControl,
  Image,
} from 'react-native';
import { router } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { useAuthStore } from '../../store/useAuthStore';
import { Colors } from '../../constants/colors';
import { Spacing, Radius, FontSize } from '../../constants/theme';
import { signOut as signOutUser, updateUserProfile } from '../../services/auth';
import { uploadToSupabase } from '../../services/storage';

import {
  Mail,
  Phone,
  Clipboard,
  Bell,
  Lock,
  HelpCircle,
  FileText,
  LogOut,
  ChevronRight,
  Compass,
  Hotel,
  Bike,
  Edit2,
  Camera,
} from 'lucide-react-native';

export default function ProfileScreen() {
  const { user, profile, setProfile, reset, refreshProfile } = useAuthStore();

  // ── Basic info edit state ──────────────────────────────────────────────────
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [saving, setSaving] = useState(false);

  // ── Business profile edit state ────────────────────────────────────────────
  const [editingBusiness, setEditingBusiness] = useState(false);
  const [businessData, setBusinessData] = useState<Record<string, any>>({});
  const [savingBusiness, setSavingBusiness] = useState(false);

  // ── Photo upload state ─────────────────────────────────────────────────────
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  // ── Other UI state ─────────────────────────────────────────────────────────
  const [signingOut, setSigningOut] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // ── Sync local state whenever the profile changes ──────────────────────────
  useEffect(() => {
    if (profile) {
      setName(profile.name ?? '');
      setPhone(profile.phone ?? '');
      if (!editingBusiness) {
        setBusinessData(profile.profileData ?? {});
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile]);

  // ── Derived values ─────────────────────────────────────────────────────────
  const role = profile?.role ?? 'guide';
  const roleLabel =
    role === 'guide' ? 'Tour Guide' : role === 'hotel' ? 'Hotel Owner' : 'Rental Owner';
  const RoleIcon = role === 'guide' ? Compass : role === 'hotel' ? Hotel : Bike;
  const roleColor =
    role === 'guide'
      ? Colors.roleGuide
      : role === 'hotel'
      ? Colors.roleHotel
      : Colors.roleRental;

  const currentProfileData: Record<string, any> = profile?.profileData ?? {};

  const PRIORITY_KEYS: Record<string, string[]> = {
    guide: ['city', 'location', 'specialisations', 'availability', 'maxGroupSize', 'pricePerDay', 'bio', 'certifications', 'languages'],
    hotel: ['hotelName', 'city', 'location', 'roomTypes', 'pricePerNight', 'totalRooms', 'checkInTime', 'checkOutTime', 'amenities'],
    rental: ['shopName', 'city', 'location', 'vehicleTypes', 'pricePerDay', 'totalVehicles', 'securityDeposit', 'docsRequired'],
  };

  const LABELS: Record<string, string> = {
    city: 'City', location: 'Location', specialisations: 'Specialisations',
    availability: 'Availability', maxGroupSize: 'Max Group Size',
    pricePerDay: 'Price / Day (₹)', bio: 'Bio', certifications: 'Certifications',
    languages: 'Languages', hotelName: 'Hotel Name', roomTypes: 'Room Types',
    pricePerNight: 'Price / Night (₹)', totalRooms: 'Total Rooms',
    checkInTime: 'Check-in Time', checkOutTime: 'Check-out Time', amenities: 'Amenities',
    shopName: 'Shop Name', vehicleTypes: 'Vehicle Types', totalVehicles: 'Total Vehicles',
    securityDeposit: 'Security Deposit (₹)', docsRequired: 'Docs Required from Renter',
  };

  const priorityKeys = PRIORITY_KEYS[role] ?? Object.keys(currentProfileData);

  const profileRows = priorityKeys
    .filter((key) => {
      const v = currentProfileData[key];
      return v !== undefined && v !== null && v !== '' && !(Array.isArray(v) && v.length === 0);
    })
    .map((key) => ({
      key,
      label: LABELS[key] ?? key.replace(/([A-Z])/g, ' $1').replace(/^./, (s) => s.toUpperCase()),
      value: Array.isArray(currentProfileData[key])
        ? currentProfileData[key].join(', ')
        : String(currentProfileData[key]),
    }));

  const hasBusinessData = Object.keys(currentProfileData).length > 0;

  // ── Pull-to-refresh ────────────────────────────────────────────────────────
  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await refreshProfile();
    } catch (error) {
      console.warn('Refresh profile failed:', error);
    } finally {
      setRefreshing(false);
    }
  };

  // ── Photo picker & upload ──────────────────────────────────────────────────
  const handleChangePhoto = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission required', 'Please allow access to your photo library to update your profile photo.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
    });

    if (result.canceled || !result.assets?.length) return;

    const asset = result.assets[0];
    if (!user) return;

    setUploadingPhoto(true);
    try {
      const fileName = `avatar-${user.uid}.jpg`;
      const publicUrl = await uploadToSupabase(asset.uri, asset.mimeType ?? 'image/jpeg', fileName, 'avatars');
      await updateUserProfile(user.uid, { photoUrl: publicUrl });
      setProfile({ ...profile!, photoUrl: publicUrl });
    } catch (err) {
      console.error('Photo upload error:', err);
      Alert.alert('Upload Failed', 'Could not update your profile photo. Please try again.');
    } finally {
      setUploadingPhoto(false);
    }
  };

  // ── Save basic info ────────────────────────────────────────────────────────
  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    try {
      const trimmedName = name.trim();
      const trimmedPhone = phone.trim();
      await updateUserProfile(user.uid, { name: trimmedName, phone: trimmedPhone });
      setProfile({ ...profile!, name: trimmedName, phone: trimmedPhone });
      setEditing(false);
    } catch (err) {
      console.error('handleSave error:', err);
      Alert.alert('Error', 'Could not save changes. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  // ── Save business profile ──────────────────────────────────────────────────
  const handleSaveBusiness = async () => {
    if (!user) return;
    setSavingBusiness(true);
    try {
      await updateUserProfile(user.uid, { profileData: businessData });
      setProfile({ ...profile!, profileData: businessData });
      setEditingBusiness(false);
    } catch (err) {
      console.error('handleSaveBusiness error:', err);
      Alert.alert('Error', 'Could not save business profile. Please try again.');
    } finally {
      setSavingBusiness(false);
    }
  };

  // ── Sign out ───────────────────────────────────────────────────────────────
  const handleSignOut = () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out',
        style: 'destructive',
        onPress: async () => {
          setSigningOut(true);
          try {
            await signOutUser();
            reset();
            router.replace('/auth/login');
          } catch {
            Alert.alert('Error', 'Sign out failed. Please try again.');
          } finally {
            setSigningOut(false);
          }
        },
      },
    ]);
  };

  // ── Cancel helpers ─────────────────────────────────────────────────────────
  const cancelBasicEdit = () => {
    setName(profile?.name ?? '');
    setPhone(profile?.phone ?? '');
    setEditing(false);
  };

  const cancelBusinessEdit = () => {
    setBusinessData(profile?.profileData ?? {});
    setEditingBusiness(false);
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <View style={styles.safe}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={Colors.primary}
            colors={[Colors.primary]}
          />
        }
      >
        {/* Gradient header */}
        <View style={[styles.headerBg, { backgroundColor: roleColor }]}>
          {/* Avatar with camera overlay */}
          <TouchableOpacity
            style={styles.avatarRing}
            onPress={handleChangePhoto}
            activeOpacity={0.85}
            disabled={uploadingPhoto}
          >
            {profile?.photoUrl ? (
              <Image source={{ uri: profile.photoUrl }} style={styles.avatarImage} />
            ) : (
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>
                  {profile?.name?.charAt(0).toUpperCase() ?? '?'}
                </Text>
              </View>
            )}

            {/* Camera badge */}
            <View style={styles.cameraBadge}>
              {uploadingPhoto ? (
                <ActivityIndicator size={12} color={Colors.white} />
              ) : (
                <Camera size={14} color={Colors.white} />
              )}
            </View>
          </TouchableOpacity>

          <Text style={styles.partnerName}>{profile?.name ?? 'Partner'}</Text>

          <View style={styles.roleBadge}>
            <RoleIcon color={Colors.white} size={14} />
            <Text style={styles.roleLabel}>{roleLabel}</Text>
          </View>

          <Text style={styles.email}>{profile?.email}</Text>
        </View>

        <View style={styles.content}>
          {/* ── Edit Basic Info toggle ── */}
          {!editing ? (
            <TouchableOpacity style={styles.editBtn} onPress={() => setEditing(true)}>
              <Edit2 color={Colors.primary} size={16} />
              <Text style={styles.editBtnText}>Edit Profile</Text>
            </TouchableOpacity>
          ) : (
            <View style={styles.editForm}>
              <Text style={styles.editTitle}>Edit Basic Info</Text>

              <Text style={styles.label}>Full Name</Text>
              <TextInput
                style={styles.input}
                value={name}
                onChangeText={setName}
                placeholder="Your name"
                placeholderTextColor={Colors.textLight}
              />

              <Text style={[styles.label, { marginTop: Spacing.md }]}>Phone</Text>
              <TextInput
                style={styles.input}
                value={phone}
                onChangeText={setPhone}
                placeholder="Phone number"
                placeholderTextColor={Colors.textLight}
                keyboardType="phone-pad"
              />

              <View style={styles.editActions}>
                <TouchableOpacity style={styles.cancelBtn} onPress={cancelBasicEdit}>
                  <Text style={styles.cancelText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.saveBtn, saving && { opacity: 0.7 }]}
                  onPress={handleSave}
                  disabled={saving}
                >
                  {saving ? (
                    <ActivityIndicator color={Colors.white} size="small" />
                  ) : (
                    <Text style={styles.saveText}>Save Changes</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* ── Contact Info ── */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Contact Info</Text>
            <ProfileRow label="Email" value={profile?.email ?? ''} Icon={Mail} />
            <ProfileRow label="Phone" value={profile?.phone ?? ''} Icon={Phone} />
          </View>

          {/* ── Business Profile ── */}
          <View style={styles.section}>
            <View
              style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: Spacing.sm,
              }}
            >
              <Text style={[styles.sectionTitle, { marginBottom: 0 }]}>Business Profile</Text>
              {!editingBusiness && (
                <TouchableOpacity
                  onPress={() => {
                    setBusinessData(profile?.profileData ?? {});
                    setEditingBusiness(true);
                  }}
                >
                  <Edit2 color={Colors.primary} size={16} />
                </TouchableOpacity>
              )}
            </View>

            {editingBusiness ? (
              <View style={{ marginTop: Spacing.sm }}>
                {Object.keys(businessData).length === 0 ? (
                  <Text
                    style={{ color: Colors.textMuted, fontSize: FontSize.sm, paddingBottom: Spacing.sm }}
                  >
                    No fields to edit. Your business profile is empty.
                  </Text>
                ) : (
                  Object.entries(businessData).map(([key, value]) => (
                    <View key={key} style={{ marginBottom: Spacing.md }}>
                      <Text style={styles.label}>
                        {key.replace(/([A-Z])/g, ' $1').replace(/^./, (s) => s.toUpperCase())}
                      </Text>
                      <TextInput
                        style={styles.input}
                        value={Array.isArray(value) ? value.join(', ') : String(value ?? '')}
                        onChangeText={(text) => {
                          setBusinessData((prev) => ({
                            ...prev,
                            [key]: Array.isArray(prev[key])
                              ? text.split(',').map((s) => s.trim())
                              : text,
                          }));
                        }}
                        placeholder={`Enter ${key}`}
                        placeholderTextColor={Colors.textLight}
                      />
                    </View>
                  ))
                )}

                <View style={styles.editActions}>
                  <TouchableOpacity style={styles.cancelBtn} onPress={cancelBusinessEdit}>
                    <Text style={styles.cancelText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.saveBtn, savingBusiness && { opacity: 0.7 }]}
                    onPress={handleSaveBusiness}
                    disabled={savingBusiness}
                  >
                    {savingBusiness ? (
                      <ActivityIndicator color={Colors.white} size="small" />
                    ) : (
                      <Text style={styles.saveText}>Save</Text>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            ) : hasBusinessData ? (
              profileRows.map((row) => (
                <ProfileRow key={row.key} label={row.label} value={row.value} Icon={Clipboard} />
              ))
            ) : (
              <Text
                style={{ color: Colors.textMuted, fontSize: FontSize.sm, paddingVertical: Spacing.sm }}
              >
                No business profile data yet. Tap the edit icon to add details.
              </Text>
            )}
          </View>

          {/* ── Account ── */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Account</Text>
            <TouchableOpacity style={styles.menuItem}>
              <Bell color={Colors.text} size={18} />
              <Text style={styles.menuLabel}>Notifications</Text>
              <ChevronRight color={Colors.textLight} size={20} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.menuItem}>
              <Lock color={Colors.text} size={18} />
              <Text style={styles.menuLabel}>Change Password</Text>
              <ChevronRight color={Colors.textLight} size={20} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.menuItem}>
              <HelpCircle color={Colors.text} size={18} />
              <Text style={styles.menuLabel}>Help &amp; Support</Text>
              <ChevronRight color={Colors.textLight} size={20} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.menuItem}>
              <FileText color={Colors.text} size={18} />
              <Text style={styles.menuLabel}>Terms &amp; Privacy</Text>
              <ChevronRight color={Colors.textLight} size={20} />
            </TouchableOpacity>
          </View>

          {/* ── Sign Out ── */}
          <TouchableOpacity
            style={[styles.signOutBtn, signingOut && { opacity: 0.7 }]}
            onPress={handleSignOut}
            disabled={signingOut}
            activeOpacity={0.85}
          >
            {signingOut ? (
              <ActivityIndicator color={Colors.error} />
            ) : (
              <View style={styles.signOutContent}>
                <LogOut color={Colors.error} size={18} />
                <Text style={styles.signOutText}>Sign Out</Text>
              </View>
            )}
          </TouchableOpacity>

          <Text style={styles.version}>Guide My Route Partners v1.0</Text>
          <View style={styles.developerContainer}>
            <Text style={styles.developedBy}>Developed by</Text>
            <Text style={styles.developerName}>Mohit Aggarwal</Text>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

function ProfileRow({ label, value, Icon }: { label: string; value: string; Icon: any }) {
  if (!value) return null;
  return (
    <View style={prStyles.row}>
      <Icon color={Colors.textMuted} size={16} style={{ marginTop: 2 }} />
      <View style={prStyles.info}>
        <Text style={prStyles.label}>{label}</Text>
        <Text style={prStyles.value}>{value}</Text>
      </View>
    </View>
  );
}

const prStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    gap: Spacing.sm,
  },
  info: { flex: 1 },
  label: { fontSize: FontSize.xs, color: Colors.textMuted, fontWeight: '600', marginBottom: 2 },
  value: { fontSize: FontSize.base, color: Colors.text, fontWeight: '500' },
});

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  headerBg: {
    alignItems: 'center',
    paddingTop: 24,
    paddingBottom: 36,
    paddingHorizontal: Spacing.lg,
  },
  avatarRing: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: 'rgba(255,255,255,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  avatarImage: {
    width: 88,
    height: 88,
    borderRadius: 44,
  },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: Colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: FontSize.xxl,
    fontWeight: '800',
    color: Colors.primary,
  },
  cameraBadge: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: Colors.white,
  },
  partnerName: {
    fontSize: FontSize.xl,
    fontWeight: '800',
    color: Colors.white,
    marginBottom: 8,
  },
  roleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: Radius.full,
    paddingHorizontal: 12,
    paddingVertical: 5,
    gap: 5,
    marginBottom: 8,
  },
  roleLabel: { fontSize: FontSize.sm, color: Colors.white, fontWeight: '700' },
  email: { fontSize: FontSize.sm, color: 'rgba(255,255,255,0.75)' },
  content: { padding: Spacing.md, marginTop: -20 },
  editBtn: {
    backgroundColor: Colors.white,
    borderRadius: Radius.full,
    paddingVertical: 12,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: Colors.border,
    marginBottom: Spacing.md,
    shadowColor: Colors.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 3,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
  },
  editBtnText: { fontSize: FontSize.base, fontWeight: '700', color: Colors.primary },
  editForm: {
    backgroundColor: Colors.white,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    marginBottom: Spacing.md,
    shadowColor: Colors.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  editTitle: {
    fontSize: FontSize.md,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: Spacing.md,
  },
  label: { fontSize: FontSize.sm, fontWeight: '600', color: Colors.text, marginBottom: 6 },
  input: {
    backgroundColor: Colors.background,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: 12,
    fontSize: FontSize.base,
    color: Colors.text,
    borderWidth: 1.5,
    borderColor: Colors.border,
  },
  editActions: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.md },
  cancelBtn: {
    flex: 1,
    borderRadius: Radius.full,
    paddingVertical: 12,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: Colors.border,
  },
  cancelText: { color: Colors.textMuted, fontWeight: '600', fontSize: FontSize.base },
  saveBtn: {
    flex: 1,
    backgroundColor: Colors.accent,
    borderRadius: Radius.full,
    paddingVertical: 12,
    alignItems: 'center',
  },
  saveText: { color: Colors.white, fontWeight: '700', fontSize: FontSize.base },
  section: {
    backgroundColor: Colors.white,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    marginBottom: Spacing.md,
    shadowColor: Colors.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  sectionTitle: {
    fontSize: FontSize.md,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: Spacing.sm,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 13,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    gap: Spacing.sm,
  },
  menuLabel: { flex: 1, fontSize: FontSize.base, color: Colors.text, fontWeight: '500' },
  signOutBtn: {
    backgroundColor: Colors.statusRejected,
    borderRadius: Radius.lg,
    paddingVertical: 15,
    alignItems: 'center',
    marginBottom: Spacing.md,
    borderWidth: 1.5,
    borderColor: Colors.error,
  },
  signOutContent: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  signOutText: { color: Colors.error, fontSize: FontSize.md, fontWeight: '700' },
  version: {
    textAlign: 'center',
    fontSize: FontSize.xs,
    color: Colors.textLight,
    marginBottom: 8,
  },
  developerContainer: {
    alignItems: 'center',
    marginBottom: 40,
  },
  developedBy: {
    fontSize: FontSize.xs || 10,
    color: Colors.textLight,
    fontWeight: '500',
    marginBottom: 2,
  },
  developerName: {
    fontSize: FontSize.xs,
    color: Colors.textMuted,
    fontWeight: '700',
  },
});
