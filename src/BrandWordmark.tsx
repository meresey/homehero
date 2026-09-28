import { Image, StyleSheet, Text, View } from 'react-native';
import { colors } from './theme';

const symbol = require('../assets/brand/starry-habits-app-icon-reference.png');

export function BrandWordmark({ compact = false, reversed = false }: { compact?: boolean; reversed?: boolean }) {
  return <View accessibilityLabel="Starry Habits" style={styles.row}>
    <Image source={symbol} resizeMode="contain" style={[styles.symbol, compact && styles.symbolCompact]} />
    {!compact && <Text style={[styles.wordmark, reversed && styles.wordmarkReversed]}>STARRY <Text style={styles.accent}>HABITS</Text></Text>}
  </View>;
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  symbol: { width: 38, height: 38, borderRadius: 11 },
  symbolCompact: { width: 32, height: 32, borderRadius: 9 },
  wordmark: { color: colors.navy, fontSize: 18, fontWeight: '900', letterSpacing: .8 },
  wordmarkReversed: { color: colors.white },
  accent: { color: '#77AF3F' },
});
