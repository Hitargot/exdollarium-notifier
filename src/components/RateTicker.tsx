import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  Animated,
  StyleSheet,
} from 'react-native';
import { getServices } from '../api/client';

interface RateItem {
  label: string;
  usd?: number;
  eur?: number;
  gbp?: number;
}

const SCROLL_SPEED = 45; // pixels per second — lower = slower

export default function RateTicker() {
  const [rates, setRates] = useState<RateItem[]>([]);
  const [singleWidth, setSingleWidth] = useState(0);
  const scrollX = useRef(new Animated.Value(0)).current;
  const animRef = useRef<Animated.CompositeAnimation | null>(null);

  useEffect(() => {
    let mounted = true;
    getServices()
      .then((data: any[]) => {
        if (!mounted) return;
        // Show ALL services that have exchange rate data, regardless of status
        const items: RateItem[] = (data || [])
          .filter((s: any) => s?.exchangeRates)
          .map((s: any) => ({
            label: s.name || s.tag || 'Service',
            usd: s.exchangeRates?.usd,
            eur: s.exchangeRates?.eur,
            gbp: s.exchangeRates?.gbp,
          }));
        setRates(items);
      })
      .catch(() => {});
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    if (singleWidth <= 0) return;
    if (animRef.current) {
      animRef.current.stop();
      animRef.current = null;
    }
    scrollX.setValue(0);

    const duration = (singleWidth / SCROLL_SPEED) * 1000;

    // Seamless loop: scroll 0 → -singleWidth then reset to 0.
    // Because we render items twice (doubled), at -singleWidth the view looks
    // identical to 0, so the jump is invisible.
    animRef.current = Animated.loop(
      Animated.timing(scrollX, {
        toValue: -singleWidth,
        duration,
        useNativeDriver: true,
        easing: (t) => t,
      }),
    );
    animRef.current.start();

    return () => {
      if (animRef.current) {
        animRef.current.stop();
        animRef.current = null;
      }
    };
  }, [singleWidth]);

  if (rates.length === 0) return null;

  const formatRate = (n?: number) =>
    n !== undefined ? `\u20A6${n.toLocaleString()}` : '-';

  // Render the list twice so the loop is seamless
  const doubled = [...rates, ...rates];

  return (
    <View style={styles.wrapper}>
      <View style={styles.labelBox}>
        <Text style={styles.labelText}>RATES</Text>
      </View>
      <View style={styles.track}>
        <Animated.View
          style={[styles.row, { transform: [{ translateX: scrollX }] }]}
          onLayout={(e) => {
            const full = e.nativeEvent.layout.width;
            const half = Math.round(full / 2);
            if (half > 0 && half !== singleWidth) {
              setSingleWidth(half);
            }
          }}
        >
          {doubled.map((item, i) => (
            <View key={i} style={styles.rateItem}>
              <Text style={styles.serviceName}>{item.label}</Text>
              <Text style={styles.rateText}>{`  USD ${formatRate(item.usd)}`}</Text>
              {item.eur !== undefined && (
                <Text style={styles.rateText}>{`  EUR ${formatRate(item.eur)}`}</Text>
              )}
              {item.gbp !== undefined && (
                <Text style={styles.rateText}>{`  GBP ${formatRate(item.gbp)}`}</Text>
              )}
              <Text style={styles.separator}> {'  |  '} </Text>
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
