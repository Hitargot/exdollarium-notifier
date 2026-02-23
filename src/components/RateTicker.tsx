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

const SCROLL_SPEED = 45; // pixels per second

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

  const renderItems = (items: RateItem[]) =>
    items.map((item, i) => (
      <View key={i} style={styles.rateItem}>
        <Text style={styles.serviceName}>{item.label}{'  '}</Text>
        <Text style={styles.rateText}>{`USD ${formatRate(item.usd)}`}</Text>
        {item.eur !== undefined && (
          <Text style={styles.rateText}>{`  EUR ${formatRate(item.eur)}`}</Text>
        )}
        {item.gbp !== undefined && (
          <Text style={styles.rateText}>{`  GBP ${formatRate(item.gbp)}`}</Text>
        )}
        <Text style={styles.separator}>{'     |     '}</Text>
      </View>
    ));

  return (
    <View style={styles.wrapper}>
      <View style={styles.labelBox}>
        <Text style={styles.labelText}>RATES</Text>
      </View>

      {/* Invisible row used ONLY to measure single-copy width accurately.
          It lives outside the clipped track so it can expand freely. */}
      <View style={styles.measureContainer} pointerEvents="none">
        <View
          style={styles.measureRow}
          onLayout={(e) => {
            const w = Math.ceil(e.nativeEvent.layout.width);
            if (w > 0 && w !== singleWidth) setSingleWidth(w);
          }}
        >
          {renderItems(rates)}
        </View>
      </View>

      <View style={styles.track}>
        {singleWidth > 0 && (
          <Animated.View
            style={[styles.row, { transform: [{ translateX: scrollX }] }]}
          >
            {/* Render twice: when first copy scrolls off, second copy is already
                in view 鈥?at -singleWidth it looks identical to position 0 */}
            {renderItems(rates)}
            {renderItems(rates)}
          </Animated.View>
        )}
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
  // Sits on top of the ticker (absolute), invisible, unconstrained width
  measureContainer: {
    position: 'absolute',
    opacity: 0,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    overflow: 'visible',
  },
  measureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    position: 'absolute',
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
  },
  serviceName: {
    color: '#a0b4ff',
    fontSize: 11,
    fontWeight: '700',
  },
  rateText: {
    color: '#e2e8f0',
    fontSize: 11,
  },
  separator: {
    color: '#4a5568',
    fontSize: 12,
  },
});
