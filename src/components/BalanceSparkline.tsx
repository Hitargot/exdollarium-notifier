import React, { useState, useMemo, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated, Easing, Pressable, Modal } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import ImpactFeedbackStyle, { impactAsync, selectionAsync } from 'expo-haptics';

// Project Imports
import { usePreferences } from '../contexts/PreferencesContext';
import { useTheme } from '../theme/index';
import appTheme from '../styles/theme';

type Props = {
  walletBalance?: number | null;
  transactions?: any[];
  collapsible?: boolean;
  defaultExpanded?: boolean;
  metric?: string;
  showValue?: boolean;
  isBalanceVisible?: boolean;
};

// We'll compute bucket count based on selected timeframe (7, 30, or 90 days aggregated)
const DEFAULT_TIMEFRAME = '7d';

const BalanceSparkline: React.FC<Props> = ({ 
  walletBalance, 
  transactions = [], 
  collapsible = false, 
  defaultExpanded = true,
  showValue = false,
  isBalanceVisible = true,
}) => {
  const [selected, setSelected] = useState<number | null>(null);
  const [expanded, setExpanded] = useState<boolean>(defaultExpanded);
  const [timeframe, setTimeframe] = useState<'7d'|'30d'|'3m'|'this'>(DEFAULT_TIMEFRAME as any);
  const [tfMenuVisible, setTfMenuVisible] = useState(false);
  const tfBtnRef = useRef<any>(null);
  const [tfModalPos, setTfModalPos] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  
  const { colors: tColors } = useTheme() || { colors: appTheme.colors };
  const prefCtx = usePreferences();
  const visiblePref = prefCtx?.preferences?.showBalanceSparkline ?? true;

  const expandAnim = useRef(new Animated.Value(defaultExpanded ? 1 : 0)).current;

  const buckets = useMemo(() => {
    const now = new Date();
    now.setHours(23, 59, 59, 999);

    // special-case: 'this' refers to current week (from Monday to today)
    let cfg;
    if (timeframe === 'this') {
      // calculate number of days from this week's Monday to today
      const today = new Date();
      const day = today.getDay(); // 0 (Sun) .. 6 (Sat)
      const diffToMonday = (day + 6) % 7; // 0 for Monday, 6 for Sunday
      const startOfWeek = new Date(today);
      startOfWeek.setDate(today.getDate() - diffToMonday);
      startOfWeek.setHours(0, 0, 0, 0);
      const daysCount = Math.max(1, Math.floor((now.getTime() - startOfWeek.getTime()) / (24 * 60 * 60 * 1000)) + 1);
      cfg = { days: daysCount, aggregate: 1 };
    } else {
      cfg = timeframe === '7d' ? { days: 7, aggregate: 1 } : timeframe === '30d' ? { days: 30, aggregate: 1 } : { days: 90, aggregate: 7 };
    }
    const days = cfg.days;
    const agg = cfg.aggregate;

    // build day buckets or aggregated buckets
    const rawDays = Array.from({ length: days }).map((_, idx) => {
      const dayDate = new Date(now.getTime() - (days - 1 - idx) * 24 * 60 * 60 * 1000);
      const startOfDay = new Date(dayDate).setHours(0, 0, 0, 0);
      const endOfDay = new Date(dayDate).setHours(23, 59, 59, 999);
      const items = transactions.filter(t => {
        const time = new Date(t.createdAt || t.date).getTime();
        return time >= startOfDay && time <= endOfDay;
      });

      // Compute inflows and outflows more robustly so received transfers show as "In"
      const net = items.reduce((s, t) => {
        const type = (t.type || '').toLowerCase();
        const amt = Math.abs(Number(t.amount || 0));
        const isOut = type.includes('sent') || type.includes('withdrawal');
        return s + (isOut ? -amt : amt);
      }, 0);

      const inflow = items
        .filter((t) => {
          const type = (t.type || '').toLowerCase();
          return type.includes('fund') || type.includes('received') || type.includes('inbound') || type.includes('credit');
        })
        .reduce((s, t) => s + Math.abs(Number(t.amount || 0)), 0);

      const outflow = items
        .filter((t) => {
          const type = (t.type || '').toLowerCase();
          return type.includes('withdrawal') || type.includes('sent') || type.includes('debit');
        })
        .reduce((s, t) => s + Math.abs(Number(t.amount || 0)), 0);

      return { date: dayDate, in: inflow, out: outflow, net };
    });

    if (agg <= 1) {
      return rawDays.map((d) => ({ label: d.date.toLocaleDateString(undefined, { weekday: 'short' }), in: d.in, out: d.out, net: d.net }));
    }

    // aggregate into groups of `agg` days (for 90 days aggregated weekly)
    const groups: any[] = [];
    for (let i = 0; i < rawDays.length; i += agg) {
      const slice = rawDays.slice(i, i + agg);
      const label = `W${Math.floor(i / agg) + 1}`;
      const inflow = slice.reduce((s, x) => s + (x.in || 0), 0);
      const outflow = slice.reduce((s, x) => s + (x.out || 0), 0);
      const net = slice.reduce((s, x) => s + (x.net || 0), 0);
      groups.push({ label, in: inflow, out: outflow, net });
    }
    return groups;
  }, [transactions, timeframe]);

  const maxActivity = useMemo(() => {
    const vals = buckets.map((b) => Math.max(Math.abs(b.net), b.in || 0, b.out || 0));
    return Math.max(...vals, 1);
  }, [buckets]);

  // Weekly totals: total inflows and total outflows across the buckets
  const weeklyTotals = useMemo(() => {
    const totalIn = buckets.reduce((s, b) => s + (Number(b.in || 0)), 0);
    const totalOut = buckets.reduce((s, b) => s + (Number(b.out || 0)), 0);
    return { totalIn, totalOut };
  }, [buckets]);

  useEffect(() => {
    Animated.timing(expandAnim, {
      toValue: expanded ? 1 : 0,
      duration: 300,
      easing: Easing.bezier(0.4, 0, 0.2, 1),
      useNativeDriver: false,
    }).start();
  }, [expanded]);

  if (!visiblePref) return null;

  const handleToggle = () => {
    impactAsync(ImpactFeedbackStyle.Light);
    setExpanded(!expanded);
  };

  const currentSelection = selected !== null ? buckets[selected] : null;

  return (
    <View style={[styles.card, { backgroundColor: tColors.surface }]}>
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.title, { color: tColors.muted }]}> 
            {currentSelection ? `${currentSelection.label} Net` : (timeframe === 'this' ? 'This week' : timeframe === '7d' ? 'Last 7 days' : timeframe === '30d' ? 'Last 30 days' : 'Last 3 months')}
          </Text>

          {currentSelection ? (
            <Text style={[styles.mainValue, { color: tColors.text }]}>
              {isBalanceVisible ? `₦${Math.abs(currentSelection.net).toLocaleString()}` : '₦ ••••••'}
              <Text style={{ color: (currentSelection?.net ?? 0) >= 0 ? tColors.success : tColors.error, fontSize: 16 }}>
                {(currentSelection?.net ?? 0) >= 0 ? ' ↑' : ' ↓'}
              </Text>
            </Text>
          ) : (
            <View style={styles.totalsRow}>
              <View style={styles.totalItem}>
                <Text style={[styles.totalLabel, { color: tColors.muted }]}>In</Text>
                <Text style={[styles.totalAmount, { color: tColors.success }]}>{isBalanceVisible ? `₦${weeklyTotals.totalIn.toLocaleString()}` : '₦ ••••••'}</Text>
              </View>
              <View style={styles.totalItem}>
                <Text style={[styles.totalLabel, { color: tColors.muted }]}>Out</Text>
                <Text style={[styles.totalAmount, { color: tColors.error }]}>{isBalanceVisible ? `₦${weeklyTotals.totalOut.toLocaleString()}` : '₦ ••••••'}</Text>
              </View>
            </View>
          )}
        </View>

        <View style={styles.headerRight}>
          {collapsible && (
            <TouchableOpacity onPress={handleToggle} style={[styles.iconBtn, { marginRight: 8 }]}>
              <Ionicons name={expanded ? "chevron-up" : "stats-chart"} size={20} color={tColors.primary} />
            </TouchableOpacity>
          )}
          <TouchableOpacity ref={tfBtnRef} onPress={() => {
            try {
              if (tfBtnRef.current && tfBtnRef.current.measureInWindow) {
                tfBtnRef.current.measureInWindow((x: number, y: number, w: number, h: number) => {
                  setTfModalPos({ x, y, w, h });
                  setTfMenuVisible(true);
                });
              } else {
                setTfMenuVisible(true);
              }
            } catch (e) { setTfMenuVisible(true); }
          }} style={[styles.timeframeBtn, styles.timeframeEdge]}>
            <Text style={{ color: tColors.primary, fontWeight: '800' }}>{timeframe === '7d' ? '7d' : timeframe === '30d' ? '30d' : timeframe === '3m' ? '3m' : 'This wk'}</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Timeframe selection modal */}
      <Modal visible={tfMenuVisible} transparent animationType="none" onRequestClose={() => setTfMenuVisible(false)}>
        <Pressable style={{ flex: 1 }} onPress={() => setTfMenuVisible(false)} />
        <View style={[styles.tfModal, { backgroundColor: tColors.surface, left: tfModalPos ? tfModalPos.x : undefined, top: tfModalPos ? (tfModalPos.y + (tfModalPos.h || 0) + 8) : undefined, right: tfModalPos ? undefined : 16 }]}> 
          {[
            { key: 'this', label: 'This week' },
            { key: '7d', label: 'Last 7 days' },
            { key: '30d', label: 'Last 30 days' },
            { key: '3m', label: 'Last 3 months' }
          ].map(opt => (
            <TouchableOpacity key={opt.key} onPress={() => { setTimeframe(opt.key as any); setTfMenuVisible(false); }} style={styles.tfOption}>
              <Text style={{ color: tColors.text, fontWeight: timeframe === opt.key ? '800' : '600' }}>{opt.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </Modal>

      <Animated.View style={[
        styles.chartContainer, 
        { 
          height: expandAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 90] }),
          opacity: expandAnim,
          marginTop: expandAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 15] })
        }
      ]}>
        <View style={styles.barWrapper}>
          {buckets.map((b, i) => {
            const isSelected = selected === i;
            // Always determine color based on data, not selection
            const barBaseColor = b.net > 0 ? tColors.success : b.net < 0 ? tColors.error : tColors.border;
            const barHeight = Math.max((Math.abs(b.net) / maxActivity) * 60, 6);

            return (
              <Pressable
                key={i}
                onPressIn={() => {
                  selectionAsync();
                  setSelected(i);
                }}
                onPressOut={() => setSelected(null)}
                style={styles.barTouchArea}
              >
                <View style={[
                  styles.bar, 
                  { 
                    height: barHeight, 
                    backgroundColor: barBaseColor,
                    // Highlight selected bar by making it slightly wider and brighter
                    width: isSelected ? 14 : 10,
                    opacity: selected !== null && !isSelected ? 0.3 : 1 
                  }
                ]} />
                <Text style={[
                    styles.barLabel, 
                    { color: isSelected ? tColors.primary : tColors.muted, fontWeight: isSelected ? '800' : '600' }
                ]}>
                  {b.label[0]}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </Animated.View>

      {/* Breakdown: ONLY shows when clicking/holding a bar */}
      {currentSelection && (
        <Animated.View style={styles.detailsRow}>
          <View style={styles.detailItem}>
            <View style={[styles.dot, { backgroundColor: tColors.success }]} />
            <Text style={[styles.detailText, { color: tColors.success }]}>In: ₦{Number(currentSelection.in || 0).toLocaleString()}</Text>
          </View>
          <View style={styles.detailItem}>
            <View style={[styles.dot, { backgroundColor: tColors.error }]} />
            <Text style={[styles.detailText, { color: tColors.error }]}>Out: ₦{Number(currentSelection.out || 0).toLocaleString()}</Text>
          </View>
        </Animated.View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  card: { padding: 18, borderRadius: 24, marginVertical: 8, elevation: 4, shadowColor: '#000', shadowOpacity: 0.06, shadowOffset: { width: 0, height: 4 }, shadowRadius: 16 },
  header: { flexDirection: 'row', justifyContent: 'space-between' },
  title: { fontSize: 11, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 1 },
  mainValue: { fontSize: 24, fontWeight: '900', marginTop: 4 },
  iconBtn: { padding: 8, backgroundColor: '#f0f0f0', borderRadius: 12 },
  chartContainer: { overflow: 'hidden' },
  barWrapper: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', height: 70 },
  barTouchArea: { alignItems: 'center', justifyContent: 'flex-end', flex: 1 },
  bar: { borderRadius: 6 },
  barLabel: { fontSize: 10, marginTop: 10 },
  detailsRow: { flexDirection: 'row', justifyContent: 'center', gap: 20, marginTop: 16, paddingTop: 16, borderTopWidth: 1, borderTopColor: '#f0f0f0' },
  detailItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot: { width: 6, height: 6, borderRadius: 3 },
  detailText: { fontSize: 13, fontWeight: '700' },
  totalsRow: { flexDirection: 'row', marginTop: 8, gap: 20 },
  totalItem: { alignItems: 'flex-start' },
  totalLabel: { fontSize: 12, fontWeight: '800' },
  totalAmount: { fontSize: 16, fontWeight: '900', marginTop: 4 },
  timeframeBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, borderWidth: 1, borderColor: '#E6EDF7' },
  tfModal: { position: 'absolute', width: 150, borderRadius: 12, padding: 8, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 8, elevation: 6 },
  tfOption: { paddingVertical: 12, paddingHorizontal: 10 }
  ,
  timeframeEdge: { marginRight: 100 }
  ,
  headerRight: { flexDirection: 'row', alignItems: 'center' }
});

export default BalanceSparkline;