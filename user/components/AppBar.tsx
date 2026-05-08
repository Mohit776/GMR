import React from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Text } from './Text';

import { useRouter } from 'expo-router';

export default function AppBar() {
  const router = useRouter();
  
  return (
    <SafeAreaView edges={['top']} style={styles.safe}>
      <View style={styles.bar}>
           <TouchableOpacity 
           onPress={() => router.push('/(tabs)/Home')}>
        <View style={styles.brandRow}>
          <View style={styles.logo}>
            <Ionicons name="navigate" size={18} color="#fff" />
          </View>
          <View>
            <Text style={styles.eyebrow}>Explore with confidence</Text>
            <Text style={styles.title}>Guide My Route</Text>
          </View>
        </View>
</TouchableOpacity>
        <View style={styles.rightActions}>
          <TouchableOpacity 
            style={[styles.iconButton, { marginRight: 8 }]} 
            activeOpacity={0.75}
            onPress={() => router.push('/more/MyBookings')}
          >
            <Ionicons name="calendar-outline" size={20} color="#1F2937" />
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.iconButton} activeOpacity={0.75}>
            <Ionicons name="notifications-outline" size={20} color="#1F2937" />
            <View style={styles.dot} />
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { backgroundColor: '#ffffff' },
  bar: {
    height: 64,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E2E8F0',
    backgroundColor: '#ffffff',
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  rightActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  logo: {
    width: 40,
    height: 40,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#16A34A',
    marginRight: 12,
    shadowColor: '#16A34A',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.16,
    shadowRadius: 10,
    elevation: 4,
  },
  eyebrow: {
    fontSize: 11,
    fontWeight: '700',
    color: '#14B8A6',
    marginBottom: 2,
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
    color: '#111827',
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  dot: {
    position: 'absolute',
    top: 10,
    right: 11,
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: '#F97316',
    borderWidth: 1,
    borderColor: '#FFFFFF',
  },
});
