import React, { useRef, useEffect, useMemo } from "react";
import { View, Text, TouchableOpacity, StyleSheet, Dimensions } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { StackScreenProps } from "@react-navigation/stack";
import ConfettiCannon from "react-native-confetti-cannon";
import { RootStackParamList } from "./types";
import { sanitizeReceipt } from "../utils/receiptSanitizer";
import { useTheme } from "../theme/index";
import appTheme from '../styles/theme';
import ScreenHeader from '../components/ScreenHeader';

type Props = StackScreenProps<RootStackParamList, "WithdrawalSuccess">;

const { width } = Dimensions.get("window");

export default function WithdrawalSuccess({ navigation, route }: Props) {
  const { receiptData, message, status = "pending", providerReference } = route.params as any;
  const confettiRef = useRef<ConfettiCannon | null>(null);

  const themeCtx = useTheme();
  const t = themeCtx;
  const styles = useMemo(() => createStyles(t), [t]);

  const mapToUiStatus = (s: string | undefined) => {
    if (!s) return 'pending';
    const st = String(s).toLowerCase();
    if (['successful', 'success', 'completed'].includes(st)) return 'success';
    if (['processing', 'pending', 'queued', 'inprogress', 'initiated', 'reserved', 'pending_admin', 'processing_admin', 'processing_provider'].includes(st)) return 'pending';
    if (['failed', 'error', 'rejected', 'declined'].includes(st)) return 'rejected';
    return st;
  };

  const uiStatus = mapToUiStatus(status);

  useEffect(() => {
    if (uiStatus === "success") {
      const interval = setInterval(() => {
        confettiRef.current?.start();
      }, 5000);
      return () => clearInterval(interval);
    }
  }, [uiStatus]);

  const getStatusConfig = () => {
    switch (uiStatus) {
      case "success":
        return {
          icon: "checkmark-circle",
          color: t.colors.primary,
          title: "Success!",
          msg: "Your withdrawal request was submitted successfully. It may take a few moments to reflect in your bank account."
        };
      case "rejected":
        return {
          icon: "close-circle",
          color: t.colors.error,
          title: "Transaction Failed",
          msg: "Your withdrawal request failed or was rejected. Please check the receipt for details."
        };
      default:
        return {
          icon: "time",
          color: "#f0ad4e",
          title: "Processing...",
          msg: "Your withdrawal request is being processed. You will be notified once it completes."
        };
    }
  };

  const config = getStatusConfig();

  return (
    <View style={styles.page}>
      <ScreenHeader title="Status" />
      
      {uiStatus === "success" && (
        <ConfettiCannon
          count={80}
          origin={{ x: width / 2, y: -20 }}
          autoStart
          fadeOut
          ref={confettiRef}
        />
      )}

      <View style={styles.container}>
        <View style={styles.contentCard}>
          <View style={[styles.iconContainer, { backgroundColor: `${config.color}15` }]}>
            <Ionicons name={config.icon as any} size={80} color={config.color} />
          </View>

          <Text style={styles.title}>{config.title}</Text>
          <Text style={styles.message}>{message || config.msg}</Text>

          {providerReference && (
            <View style={styles.refBadge}>
              <Text style={styles.refText}>Ref: {providerReference}</Text>
            </View>
          )}
        </View>

        <View style={styles.buttonGroup}>
          {receiptData && (
            <TouchableOpacity
              style={styles.primaryBtn}
              onPress={() => {
                const sanitized = sanitizeReceipt(receiptData);
                navigation.navigate("Receipt", { receiptData: sanitized });
              }}
            >
              <Ionicons name="receipt-outline" size={20} color="#FFF" style={{ marginRight: 8 }} />
              <Text style={styles.primaryBtnText}>View Receipt</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity
              style={[styles.secondaryBtn, { backgroundColor: 'transparent', borderColor: t.colors?.border || '#E2E8F0' }]}
              onPress={() => navigation.navigate("Dashboard")}
            >
              <Text style={[styles.secondaryBtnText, { color: t.colors?.text || t.colors?.primary }]}>Back to Home</Text>
            </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

function createStyles(t: any) {
  return StyleSheet.create({
    page: { flex: 1, backgroundColor: t.colors.background || '#F8F9FC' },
    container: {
      flex: 1,
      padding: 24,
      justifyContent: 'center',
    },
    contentCard: {
      alignItems: 'center',
      marginBottom: 40,
    },
    iconContainer: {
      width: 140,
      height: 140,
      borderRadius: 70,
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: 24,
    },
    title: { 
      fontSize: 28, 
      fontWeight: '900', 
      color: t.colors.text,
      textAlign: 'center',
      marginBottom: 12
    },
    message: { 
      fontSize: 16, 
      textAlign: 'center', 
      lineHeight: 24,
      color: t.colors.muted,
      paddingHorizontal: 10
    },
    refBadge: {
      marginTop: 20,
      backgroundColor: '#F1F5F9',
      paddingVertical: 6,
      paddingHorizontal: 12,
      borderRadius: 20,
    },
    refText: {
      fontSize: 12,
      color: '#64748B',
      fontWeight: '600',
    },
    buttonGroup: {
      width: '100%',
      gap: 12,
    },
    primaryBtn: {
      backgroundColor: t.colors.primary,
      height: 56,
      borderRadius: 16,
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center',
      shadowColor: t.colors.primary,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3,
      shadowRadius: 8,
      elevation: 4,
    },
    primaryBtnText: { 
      color: '#FFF', 
      fontSize: 16, 
      fontWeight: '800' 
    },
    secondaryBtn: {
      backgroundColor: '#FFF',
      height: 56,
      borderRadius: 16,
      justifyContent: 'center',
      alignItems: 'center',
      borderWidth: 1,
      borderColor: '#E2E8F0',
    },
    secondaryBtnText: { 
      color: t.colors.text, 
      fontSize: 16, 
      fontWeight: '700' 
    },
  });
}