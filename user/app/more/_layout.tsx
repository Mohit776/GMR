import { Stack } from 'expo-router';

export default function MoreLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="guideDetail" />
      <Stack.Screen name="vehicle" />
      <Stack.Screen name="personalInformation" />
      <Stack.Screen name="checkout" />
      <Stack.Screen
        name="payment"
        options={{
          animation: 'slide_from_bottom',
          gestureEnabled: false, // Prevent accidental swipe-to-dismiss during payment
        }}
      />
      <Stack.Screen name="MyBookings" />
      <Stack.Screen name="bookingDetail" />
    </Stack>
  );
}
