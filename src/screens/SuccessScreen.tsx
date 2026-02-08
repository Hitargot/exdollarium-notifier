import React, { useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, SafeAreaView, StatusBar } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { StackScreenProps } from '@react-navigation/stack';

// Project Imports
import { RootStackParamList } from './types';
import { sanitizeReceipt } from '../utils/receiptSanitizer';
import { useTheme } from '../theme/index';
import appTheme from '../styles/theme';
import UIButton from '../components/UIButton'; // Assuming you have a reusable button component

type Props = StackScreenProps<RootStackParamList, 'SuccessScreen'>;

const SuccessScreen: React.FC<Props> = ({ navigation, route }) => {
  const { receiptData, message, title = "Transaction Successful" } = route.params as any;
  
  const { colors: tColors } = useTheme() || { colors: appTheme.colors };
  const styles = useMemo(() => createStyles(tColors), [tColors]);

  const handleFinish = () => {
    // Usually, we want to reset the stack to Dashboard so they can't "Go Back" 
    // to the payment form they just submitted.
    navigation.reset({
      index: 0,
      routes: [{ name: 'Dashboard' as any }],
    });
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle={tColors.mode === 'dark' ? 'light-content' : 'dark-content'} />
      
      <View style={styles.content}>
        {/* Success Visual */}
        <View style={styles.iconContainer}>
          <View style={styles.pulseCircle} />
          <Ionicons name="checkmark-sharp" size={60} color={tColors.primary} />
        </View>

        {/* Text Details */}
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.message}>
          {message || "Your transaction has been processed and is now being completed."}
        </Text>

        {/* Info Box (Optional touch of detail) */}
        {receiptData?.amount && (
          <View style={styles.amountBox}>
            <Text style={styles.amountLabel}>Amount Processed</Text>
            <Text style={styles.amountText}>{receiptData.currency || '$'}{receiptData.amount}</Text>
          </View>
        )}
      </View>

      {/* Action Footer */}
      <View style={styles.footer}>
        {receiptData && (
          <UIButton
            title="View Receipt"
            onPress={() => {
              const sanitized = sanitizeReceipt(receiptData);
              navigation.navigate('Receipt', { receiptData: sanitized });
            }}
            style={styles.receiptBtn}
          />
        )}

        <TouchableOpacity 
          style={styles.doneBtn} 
          onPress={handleFinish}
          activeOpacity={0.7}
        >
          <Text style={styles.doneBtnText}>Return to Home</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

const createStyles = (t: any) => StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: t.background 
  },
  content: { 
    flex: 1, 
    justifyContent: 'center', 
    alignItems: 'center', 
    paddingHorizontal: 32 
  },
  iconContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: t.primary + '15', // 15% opacity primary
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 32,
  },
  pulseCircle: {
    position: 'absolute',
    width: 140,
    height: 140,
    borderRadius: 70,
    borderWidth: 2,
    borderColor: t.primary + '10',
  },
  title: { 
    fontSize: 26, 
    fontWeight: '800', 
    color: t.text, 
    textAlign: 'center',
    marginBottom: 12 
  },
  message: { 
    fontSize: 16, 
    color: t.muted, 
    textAlign: 'center', 
    lineHeight: 24,
    marginBottom: 32
  },
  amountBox: {
    backgroundColor: t.surface,
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: t.border,
    alignItems: 'center',
    width: '100%'
  },
  amountLabel: { fontSize: 12, color: t.muted, textTransform: 'uppercase', fontWeight: '700', marginBottom: 4 },
  amountText: { fontSize: 24, fontWeight: '800', color: t.primary },
  
  footer: { 
    padding: 24, 
    gap: 12 
  },
  receiptBtn: { 
    height: 56, 
    borderRadius: 16 
  },
  doneBtn: { 
    height: 56, 
    justifyContent: 'center', 
    alignItems: 'center' 
  },
  doneBtnText: { 
    color: t.primary, 
    fontWeight: '700', 
    fontSize: 16 
  },
});

export default SuccessScreen;