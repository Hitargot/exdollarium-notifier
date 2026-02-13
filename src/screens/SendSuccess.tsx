import React, { useRef, useEffect, useMemo, useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet, SafeAreaView, ActivityIndicator } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { StackScreenProps } from "@react-navigation/stack";
import ConfettiCannon from "react-native-confetti-cannon";

// Project Imports
import { sanitizeReceipt } from "../utils/receiptSanitizer";
import { useTheme } from "../theme/index";
import appTheme from "../styles/theme";

type RootStackParamList = {
  Dashboard: undefined;
  Receipt: { receiptData: any };
  SendSuccess: { receiptData?: any; message?: string; status?: string; isPeer?: boolean };
};

type Props = StackScreenProps<RootStackParamList, "SendSuccess">;

export default function SendSuccess({ navigation, route }: Props) {
  const { receiptData, message, status = "pending", isPeer: isPeerParam } = route.params || {};
  const confettiRef = useRef<ConfettiCannon | null>(null);
  const [isNavigating, setIsNavigating] = useState(false);

  const { colors: tColors } = useTheme() || { colors: appTheme.colors };
  const styles = useMemo(() => createStyles(tColors), [tColors]);

  // Effect to trigger confetti on success
  useEffect(() => {
    if (status.toLowerCase() === "completed") {
      const interval = setInterval(() => {
        confettiRef.current?.start();
      }, 5000);
      return () => clearInterval(interval);
    }
  }, [status]);

  // UI Configuration based on status
  const config = useMemo(() => {
    const s = status.toLowerCase();
    switch (s) {
      case "completed":
        return {
          icon: "checkmark-circle",
          color: tColors.primary,
          title: "Success!",
          defaultMessage: isPeerParam ? "Transfer completed — funds are now available." : "Transfer done successfully!"
        };
      case "pending":
        return {
          icon: "time",
          color: "#ffbf00", // Gold/Warning
          title: "Pending...",
          defaultMessage: "Your transfer is being processed by the network."
        };
      case "failed":
        return {
          icon: "close-circle",
          color: tColors.error || "#d9534f",
          title: "Failed",
          defaultMessage: "Your transfer could not be completed at this time."
        };
      default:
        return {
          icon: "alert-circle",
          color: tColors.muted,
          title: "Notice",
          defaultMessage: "Transaction state unknown."
        };
    }
  }, [status, tColors, isPeerParam]);

  const handleDone = () => {
    if (isNavigating) return;
    setIsNavigating(true);
    navigation.reset({
      index: 0,
      routes: [{ name: "Dashboard" }],
    });
  };

  return (
    <SafeAreaView style={styles.container}>
      {status.toLowerCase() === "completed" && (
        <ConfettiCannon
          count={80}
          origin={{ x: -10, y: 0 }}
          autoStart
          fadeOut
          ref={confettiRef}
        />
      )}

      <View style={styles.content}>
        <Ionicons name={config.icon as any} size={100} color={config.color} />

        <Text style={styles.title}>{config.title}</Text>
        <Text style={styles.message}>{message || config.defaultMessage}</Text>

        {receiptData?.amount && (
            <View style={styles.amountBadge}>
                <Text style={styles.amountText}>{receiptData.currency || '$'}{receiptData.amount}</Text>
            </View>
        )}
      </View>

      <View style={styles.footer}>
        {receiptData && (
          <TouchableOpacity
            style={styles.primaryBtn}
            disabled={isNavigating}
            onPress={() => {
              if (isNavigating) return;
              setIsNavigating(true);
              const sanitized = sanitizeReceipt(receiptData);
              navigation.navigate("Receipt", { receiptData: sanitized });
            }}
          >
            {isNavigating ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.btnText}>View Receipt</Text>
            )}
          </TouchableOpacity>
        )}

        <TouchableOpacity 
          style={styles.secondaryBtn} 
          onPress={handleDone}
          disabled={isNavigating}
        >
          {isNavigating ? (
            <ActivityIndicator color={tColors.primary} />
          ) : (
            <Text style={styles.secondaryBtnText}>Okay</Text>
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const createStyles = (t: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: t.background,
  },
  content: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 32,
  },
  title: {
    fontSize: 28,
    fontWeight: "800",
    marginTop: 20,
    color: t.text,
  },
  message: {
    fontSize: 16,
    textAlign: "center",
    marginTop: 12,
    lineHeight: 22,
    color: t.muted,
  },
  amountBadge: {
    marginTop: 24,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: t.surface,
    borderWidth: 1,
    borderColor: t.border
  },
  amountText: {
    fontSize: 20,
    fontWeight: '700',
    color: t.primary
  },
  footer: {
    padding: 24,
    gap: 12,
  },
  primaryBtn: {
    backgroundColor: t.primary,
    height: 56,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  secondaryBtn: {
    height: 56,
    alignItems: "center",
    justifyContent: "center",
  },
  btnText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
  },
  secondaryBtnText: {
    color: t.primary,
    fontSize: 16,
    fontWeight: "700",
  },
});