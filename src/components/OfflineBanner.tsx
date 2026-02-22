import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Network from 'expo-network';

/**
 * Displays a sticky banner at the top of the screen when the device has no
 * internet connection, and a brief "Back online" confirmation when it
 * reconnects.
 */
export default function OfflineBanner() {
  const [isOffline, setIsOffline] = useState(false);
  const [showOnline, setShowOnline] = useState(false);
  const slideAnim = React.useRef(new Animated.Value(-60)).current;

  const showBanner = (offline: boolean) => {
    Animated.spring(slideAnim, {
      toValue: offline ? 0 : -60,
      useNativeDriver: true,
      tension: 80,
      friction: 10,
    }).start();
  };

  useEffect(() => {
    let onlineTimer: ReturnType<typeof setTimeout> | null = null;

    // Initial check
    Network.getNetworkStateAsync().then((state) => {
      const offline = !state.isConnected || !state.isInternetReachable;
      setIsOffline(offline);
      if (offline) showBanner(true);
    });

    // Poll every 5 seconds — expo-network doesn't have a push-based listener
    const interval = setInterval(async () => {
      try {
        const state = await Network.getNetworkStateAsync();
        const offline = !state.isConnected || !state.isInternetReachable;

        setIsOffline((prev) => {
          if (prev && !offline) {
            // Was offline, now online — show brief green confirmation
            setShowOnline(true);
            showBanner(false);
            if (onlineTimer) clearTimeout(onlineTimer);
            onlineTimer = setTimeout(() => setShowOnline(false), 3000);
          } else if (!prev && offline) {
            showBanner(true);
          }
          return offline;
        });
      } catch {
        // ignore network check errors
      }
    }, 5000);

    return () => {
      clearInterval(interval);
      if (onlineTimer) clearTimeout(onlineTimer);
    };
  }, []);

  if (!isOffline && !showOnline) return null;

  return (
    <Animated.View
      style={[
        styles.banner,
        isOffline ? styles.offline : styles.online,
        { transform: [{ translateY: slideAnim }] },
      ]}
      pointerEvents="none"
    >
      <Ionicons
        name={isOffline ? 'cloud-offline-outline' : 'checkmark-circle-outline'}
        size={16}
        color="#fff"
        style={{ marginRight: 6 }}
      />
      <Text style={styles.text}>
        {isOffline ? 'No internet connection' : 'Back online'}
      </Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  banner: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 9999,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  offline: {
    backgroundColor: '#c0392b',
  },
  online: {
    backgroundColor: '#27ae60',
  },
  text: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  },
});
