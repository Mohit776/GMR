import React from 'react';
import { StyleSheet, Text as RNText, TextProps, TextStyle } from 'react-native';

function getInterFamily(style?: TextStyle) {
  if (style?.fontFamily) return style.fontFamily;

  const weight = String(style?.fontWeight || '400');
  if (weight === '900' || weight === 'black') return 'Inter-Black';
  if (weight === '800' || weight === 'extrabold') return 'Inter-ExtraBold';
  if (weight === '700' || weight === 'bold') return 'Inter-Bold';
  if (weight === '600' || weight === 'semibold') return 'Inter-SemiBold';
  if (weight === '500' || weight === 'medium') return 'Inter-Medium';
  return 'Inter-Regular';
}

export function Text(props: TextProps) {
  const flatStyle = StyleSheet.flatten(props.style) as TextStyle | undefined;

  return (
    <RNText
      {...props}
      style={[styles.defaultText, props.style, { fontFamily: getInterFamily(flatStyle) }]}
    />
  );
}

export default Text;

const styles = StyleSheet.create({
  defaultText: {
    fontFamily: 'Inter-Regular',
    includeFontPadding: false,
  },
});
