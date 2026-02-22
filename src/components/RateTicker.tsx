import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  Animated,
  StyleSheet,
  Dimensions,
} from 'react-native';
import { getServices } from '../api/client';

interface RateItem {
  label: string;
  usd?: number;
  eur?: number;
  gbp?: number;
}

const SCROLL_SPEED = 60; // pixels per second
const { width: SCREEN_WIDTH } = Dimensions.get('window');

/**
 * Horizontally scrolling FX rate ticker shown on the Dashboard.
 * Fetches exchange rates from /api/services and auto-scrolls them.
 */
export default function RateTicker() {
  const [rates, setRates] = useState<RateItem[]>([]);
  const [contentWidth, setContentWidth] = useState(0);
  const scrollX = useRef(new Animated.Value(0)).current;
  const animRef = useRef<Animated.CompositeAnimation | null>(null);

  useEffect(() => {
    let mounted = true;
    getServices()
      .then((data: any[]) => {
        if (!mounted) return;
        const items: RateItem[] = (data || [])
          .filter((s: any) => s?.status === 'active' && s?.exchangeRates)
          .map((s: any) => ({
            label: s.name || s.tag || 'Service',
            usd: s.exchangeRates?.usd,
            eur: s.exchangeRates?.eur,
            gbp: s.exchangeRates?.gbp,
          }));
        setRates(items);
      })
      .catch(() => {/* silently ignore if rates fail */});
    return () => { mounted = false; };
  }, []);

  // Start/restart animation whenever content width changes
  useEffect(() => {
    if (contentWidth <= SCREEN_WIDTH) return;
    if (animRef.current) animRef.current.stop();

    const duration = (contentWidth / SCROLL_SPEED) * 1000;
    scrollX.setValue(0);

    animRef.current = Animated.loop(
      Animated.timing(scrollX, {
        toValue: -contentWidth,
        duration,
        useNativeDriver: true,
        // linear easing
        easing: (t) => t,
      }),
    );
    animRef.current.start();

    return () => { if (animRef.current) animRef.current.stop(); };
  }, [contentWidth]);

  if (rates.length === 0) return null;

  const formatRate = (n?: number) =>
    n !== undefined ? `₦${n.toLocaleString()}` : '—';

  // Duplicate items so the scroll loops seamlessly
  const items = [...rates, ...rates];

  return (
    <View style={styles.wrapper}>
      <View style={styles.labelBox}>
        <Text style={styles.labelText}>RATES</Text>
      </View>
      <View style={styles.track}>
        <Animated.View
          style={[styles.row, { transform: [{ translateX: scrollX }] }]}
          onLayout={(e) => setContentWidth(e.nativeEvent.layout.width / 2)}
        >
          {items.map((item, i) => (
            <View key={i} style={styles.rateItem}>
              <Text style={styles.serviceName}>{item.label}</Text>
              <Text style={styles.rateText}>
                {`USD ${formatRate(item.usd)}`}
              </Text>
              {item.eur !== undefined && (
                <Text style={styles.rateText}>{`EUR ${formatRate(item.eur)}`}</Text>
              )}
              {item.gbp !== undefined && (
                <Text style={styles.rateText}>{`GBP ${formatRate(item.gbp)}`}</Text>
              )}
              <Text style={styles.separator}>•</Text>
            </View>
          ))}
        </Animated.View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0f1a3a',
    borderRadius: 8,
    marginHorizontal: 16,
    marginTop: 10,
    marginBottom: 2,
    overflow: 'hidden',
    height: 36,
  },
  labelBox: {
    backgroundColor: '#162660',
    paddingHorizontal: 10,
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  labelText: {
    color: '#a0b4ff',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1,
  },
  track: {
    flex: 1,
    overflow: 'hidden',
    height: '100%',
    justifyContent: 'center',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 10,
  },
  rateItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 4,
  },
  serviceName: {
    color: '#a0b4ff',
    fontSize: 11,
    fontWeight: '700',
    marginRight: 5,
  },
  rateText: {
    color: '#e2e8f0',
    fontSize: 11,
    marginRight: 5,
  },
  separator: {
    color: '#4a5568',
    fontSize: 14,
    marginRight: 10,
  },
});
