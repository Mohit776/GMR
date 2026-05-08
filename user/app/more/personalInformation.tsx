import { supabase } from '../../utils/supabase';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Alert, ScrollView, StyleSheet, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Text } from '../../components/Text';

const COLORS = {
  primary: '#16A34A',
  white: '#FFFFFF',
  borderGray: '#d3dbe2',
  darkGray: '#1F2937',
  mediumGray: '#6B7280',
  lightGray: '#F8FAFC',
};

export default function PersonalInformationScreen() {
  const router = useRouter();
  const [authUser, setAuthUser] = useState<any>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setAuthUser(data?.user ?? null));
  }, []);

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (authUser) {
      setFullName(authUser.user_metadata?.full_name ?? '');
      setEmail(authUser.email ?? '');
      setPhone(authUser.user_metadata?.phone ?? '');
    }
  }, [authUser]);

  const onSave = async () => {
    const trimmedName = fullName.trim();
    const trimmedPhone = phone.replace(/[^0-9]/g, '').trim();

    if (!trimmedName) {
      Alert.alert('Name required', 'Please enter your full name.');
      return;
    }

    if (trimmedPhone && trimmedPhone.length < 10) {
      Alert.alert('Invalid phone', 'Please enter a valid 10-digit phone number.');
      return;
    }

    if (!authUser) {
      Alert.alert('Session expired', 'Please log in again and retry.');
      return;
    }

    setSaving(true);
    try {
      // 1. Update Supabase Auth metadata
      const { error: authError } = await supabase.auth.updateUser({
        data: { full_name: trimmedName, phone: trimmedPhone },
      });
      if (authError) throw authError;

      // 2. Sync to public users table
      const { error: dbError } = await supabase
        .from('users')
        .update({
          name: trimmedName,
          phone: trimmedPhone || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', authUser.id);
      if (dbError) throw dbError;

      Alert.alert('Saved', 'Your personal information has been updated.');
      router.back();
    } catch {
      Alert.alert('Update failed', 'Could not save your details. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()} activeOpacity={0.8}>
          <Text style={styles.backBtnText}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Personal Information</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.card}>
          <Text style={styles.label}>Full Name</Text>
          <TextInput
            style={styles.input}
            value={fullName}
            onChangeText={setFullName}
            placeholder="Enter your full name"
            placeholderTextColor={COLORS.mediumGray}
          />

          <Text style={styles.label}>Email</Text>
          <TextInput
            style={[styles.input, styles.disabledInput]}
            value={email}
            editable={false}
            placeholder="Email"
            placeholderTextColor={COLORS.mediumGray}
          />

          <Text style={styles.label}>Phone</Text>
          <TextInput
            style={styles.input}
            value={phone}
            onChangeText={setPhone}
            placeholder="Enter 10-digit phone number"
            placeholderTextColor={COLORS.mediumGray}
            keyboardType="number-pad"
            maxLength={10}
          />

          <Text style={styles.noteText}>
            Your phone number is required to confirm bookings.
          </Text>
        </View>

        <TouchableOpacity
          style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
          onPress={onSave}
          activeOpacity={0.85}
          disabled={saving}
        >
          <Text style={styles.saveBtnText}>{saving ? 'Saving...' : 'Save Changes'}</Text>
        </TouchableOpacity>
      </ScrollView>
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
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderGray,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.borderGray,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backBtnText: {
    fontSize: 26,
    color: COLORS.darkGray,
    lineHeight: 28,
    marginTop: -2,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: COLORS.darkGray,
  },
  headerSpacer: {
    width: 36,
  },
  content: {
    padding: 16,
    gap: 16,
  },
  card: {
    backgroundColor: COLORS.lightGray,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: COLORS.borderGray,
  },
  label: {
    fontSize: 13,
    color: COLORS.darkGray,
    fontWeight: '600',
    marginBottom: 6,
    marginTop: 8,
  },
  input: {
    height: 44,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.borderGray,
    backgroundColor: COLORS.white,
    paddingHorizontal: 12,
    color: COLORS.darkGray,
    fontSize: 14,
  },
  disabledInput: {
    backgroundColor: '#EEF2F7',
    color: COLORS.mediumGray,
  },
  noteText: {
    marginTop: 12,
    fontSize: 12,
    color: COLORS.mediumGray,
  },
  saveBtn: {
    backgroundColor: COLORS.primary,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
  },
  saveBtnDisabled: {
    opacity: 0.65,
  },
  saveBtnText: {
    color: COLORS.white,
    fontSize: 15,
    fontWeight: '700',
  },
});
