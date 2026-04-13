import React from 'react';
import { 
  Modal, 
  View, 
  Text, 
  TouchableOpacity, 
  StyleSheet, 
  GestureResponderEvent, 
  ActivityIndicator,
  Platform 
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

import appTheme from '../styles/theme';
import { useTheme } from '../theme/index';
import { pickContrastText } from '../theme/colorUtils';

type Props = {
  visible: boolean;
  title?: string;
  message?: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm: (e?: GestureResponderEvent) => void;
  onCancel: (e?: GestureResponderEvent) => void;
  confirmLoading?: boolean;
  confirmDisabled?: boolean;
  children?: React.ReactNode;
  showActions?: boolean;
  fullScreen?: boolean;
  isDestructive?: boolean;
};

const ConfirmModal: React.FC<Props> = ({ 
  visible, title, message, confirmText = 'Confirm', cancelText = 'Cancel', 
  onConfirm, onCancel, children, showActions = true, fullScreen, 
  confirmLoading, confirmDisabled, isDestructive 
}) => {
  const runtimeTheme = useTheme();
  const { colors: tColors, radius: tRadius } = runtimeTheme;
  
  const styles = createStyles(tColors, tRadius);

  const confirmBgColor = isDestructive ? '#ef4444' : tColors.primary;
  const confirmTextColor = pickContrastText(confirmBgColor, '#ffffff', tColors.text);
  const closeIconColor = tColors.muted;

  const handleConfirm = (e?: GestureResponderEvent) => {
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onConfirm(e);
  };

  const renderContent = () => (
    <>
      {/* HEADER SECTION */}
      {(!!title || !fullScreen) && (
        <View style={styles.header}>
          <View style={{ width: 40 }} />
          <Text style={styles.headerTitle}>{title || ''}</Text>
          <TouchableOpacity onPress={onCancel} style={styles.headerClose}>
            <Ionicons name="close" size={24} color={closeIconColor} />
          </TouchableOpacity>
        </View>
      )}

      {/* BODY SECTION */}
      <View style={fullScreen ? styles.fullContent : styles.bodyContent}>
        {children ? children : (
          !!message ? <Text style={styles.message}>{message}</Text> : null
        )}
      </View>

      {/* ACTIONS SECTION */}
      {showActions && (
        <View style={[styles.actionsRow, fullScreen && styles.actionsRowFull]}>
          {!!cancelText && !confirmLoading && (
            <TouchableOpacity 
              style={[styles.button, styles.cancelButton]} 
              onPress={onCancel}
            >
              <Text style={styles.cancelText}>{cancelText}</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={[
              styles.button, 
              { backgroundColor: confirmBgColor },
              (confirmDisabled || confirmLoading) && { opacity: 0.5 }
            ]}
            onPress={handleConfirm}
            disabled={confirmLoading || confirmDisabled}
          >
            {confirmLoading ? (
              <ActivityIndicator size="small" color={confirmTextColor} />
            ) : (
              <Text style={[styles.confirmText, { color: confirmTextColor }]}>{confirmText}</Text>
            )}
          </TouchableOpacity>
        </View>
      )}
    </>
  );

  return (
    <Modal 
      visible={visible} 
      transparent 
      animationType={fullScreen ? "slide" : "fade"} 
      onRequestClose={onCancel}
    >
      <View style={[styles.overlay, fullScreen && styles.overlayFull]}>
        {fullScreen ? (
          <SafeAreaView style={styles.cardFull} edges={['top', 'bottom']}>
            {renderContent()}
          </SafeAreaView>
        ) : (
          <View style={styles.card}>
            {renderContent()}
          </View>
        )}
      </View>
    </Modal>
  );
};

const createStyles = (t: any, radius: any) => StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  overlayFull: {
    padding: 0,
    backgroundColor: t.surface,
  },
  card: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: t.surface,
    borderRadius: radius?.lg ?? 20,
    padding: 24,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.2,
    shadowRadius: 20,
    elevation: 10,
  },
  cardFull: {
    flex: 1,
    width: '100%',
    backgroundColor: t.surface,
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: t.text,
    textAlign: 'center',
    flex: 1,
  },
  headerClose: {
    padding: 4,
    width: 40,
    alignItems: 'flex-end',
  },
  bodyContent: {
    marginBottom: 24,
  },
  fullContent: {
    flex: 1,
  },
  message: {
    fontSize: 16,
    color: t.muted || '#64748b',
    lineHeight: 24,
    textAlign: 'center',
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  actionsRowFull: {
    marginTop: 'auto',
    paddingBottom: Platform.OS === 'ios' ? 10 : 20,
    paddingTop: 10,
  },
  button: {
    flex: 1,
    height: 54,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderColor: t.border || '#e2e8f0',
  },
  cancelText: {
    fontWeight: '700',
    fontSize: 16,
    color: t.text,
  },
  confirmText: {
    fontWeight: '800',
    fontSize: 16,
  },
});

export default ConfirmModal;