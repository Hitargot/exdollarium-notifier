import React, { memo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { mapToUiStatus, highlightColor } from '../utils/statusMapper';
import appTheme from '../styles/theme';
import { useTheme } from '../theme/index';
import { pickContrastText } from '../theme/colorUtils';
import { showInAppConfirm } from '../contexts/ConfirmContext';

type Props = {
  txn: any;
  onPress?: (t: any) => void;
  isBalanceVisible?: boolean;
  countdown?: string;
  onAlert?: (t: any) => void;
  alerted?: boolean;
};

// Use centralized status mapper so colors/labels match the rest of the app
const getStatusColor = (status?: string, type?: string) => highlightColor(status, type);

const getIcon = (type: string, themeColors: any) => {
  const normalizedType = (type || '').toLowerCase();
  switch (normalizedType) {
    case 'funding':
      return <Ionicons name="arrow-down-circle-outline" size={22} color={themeColors.success || '#1DBF73'} />;
    case 'withdrawal':
      return <Ionicons name="arrow-up-circle-outline" size={22} color={themeColors.error || '#dc3545'} />;
    case 'sent transfer':
      return <Ionicons name="arrow-redo-outline" size={22} color={themeColors.accent || '#ff9800'} />;
    case 'received transfer':
      return <Ionicons name="arrow-undo-outline" size={22} color={themeColors.link || '#2196f3'} />;
    case 'transfer':
      return <Ionicons name="swap-horizontal-outline" size={22} color={themeColors.primary || '#9c27b0'} />;
    case 'trade confirmation':
      return <MaterialIcons name="handshake" size={22} color={themeColors.link || '#007bff'} />;
    default:
      return <Ionicons name="help-circle-outline" size={22} color={themeColors.muted || '#888'} />;
  }
};

const TransactionItem = ({ txn, onPress, isBalanceVisible, countdown, onAlert, alerted }: Props) => {
  const theme = useTheme();
  const styles = React.useMemo(() => createStyles(theme), [theme]);
  const fg = theme.colors.text;
  const date = new Date(txn.createdAt || txn.date || Date.now());
  const now = new Date();
  const isToday = date.toDateString() === now.toDateString();
  const yesterday = new Date(); yesterday.setDate(yesterday.getDate() - 1);
  const isYesterday = date.toDateString() === yesterday.toDateString();

  const displayDate = isToday ? 'Today' : isYesterday ? 'Yesterday' : date.toLocaleDateString('en-GB');

  return (
    <TouchableOpacity
      onPress={() => onPress && onPress(txn)}
      style={styles.row}
      accessibilityRole="button"
      accessibilityLabel={`Transaction ${txn.type} ${txn.amount || ''}`}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
  {getIcon(txn.type, theme.colors)}
        <View style={{ maxWidth: 160 }}>
          {(() => {
            const isTrade = (txn.type || '').toString().toLowerCase().includes('trade confirmation');
            const amountPresent = txn.amount !== undefined && txn.amount !== null;
            // Determine sign for amount display: withdrawals & sent transfers negative; funded & received positive
            const ttype = (txn.type || '').toString().toLowerCase();
            const isNegative = ttype.includes('withdrawal') || ttype.includes('sent transfer') || ttype.includes('sent');
            const isPositive = ttype.includes('fund') || ttype.includes('received transfer') || ttype.includes('received');
            const sign = amountPresent ? (isNegative ? '-' : isPositive ? '+' : '') : '';
            const amountText = amountPresent ? (isBalanceVisible ? `${sign}${Math.abs(Number(txn.amount || 0)).toLocaleString()}` : '***') : null;
            const serviceText = txn.serviceName && txn.serviceName !== 'N/A' ? txn.serviceName : null;

            // Main title
            let title = '';
            if (isTrade) {
              if (amountText) title = `${txn.type} ${amountText}`;
              else if (serviceText) title = serviceText;
              else title = txn.type || 'Trade Confirmation';
            } else {
              title = `${txn.type} ${isBalanceVisible ? `${sign}${Math.abs(Number(txn.amount || 0)).toLocaleString() ?? 0}` : '***'}`;
            }

            return (
              <>
                <Text style={{ fontWeight: '600', color: fg }} numberOfLines={1} ellipsizeMode='tail'>{title}</Text>
                <Text style={{ fontSize: 12, color: theme.colors.muted || '#555' }} numberOfLines={1} ellipsizeMode='tail'>
                  {/* Show service as secondary line when amount is present and service is available */}
                  {amountText && serviceText ? serviceText : displayDate}
                </Text>
              </>
            );
          })()}
        </View>
      </View>

  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <View style={{ alignItems: 'flex-end' }}>
          {txn.type === 'Trade Confirmation' && txn.status?.toLowerCase() === 'pending' && countdown && (
            <Text style={{ fontSize: 10, color: theme.colors.accent || '#ff9900', marginBottom: 2 }}>{countdown}</Text>
          )}

          <Text style={{ fontSize: 12, fontWeight: '600', color: getStatusColor(txn.status, txn.type), textTransform: 'capitalize' }}>{mapToUiStatus(txn.status).label || (txn.status || '')}</Text>
        </View>

        {/* Bell alert for expired confirmations */}
        {txn.type === 'Trade Confirmation' && txn.status?.toLowerCase() === 'pending' && countdown === 'expired' && (
          <>
            <TouchableOpacity
              onPress={async () => {
                try {
                  // confirm with user before alerting admin
                  const confirmed = await showInAppConfirm({
                    title: 'Alert support?',
                    message: 'Notify support now about this pending confirmation?',
                    confirmText: 'Notify',
                    cancelText: 'Cancel',
                  });
                  if (confirmed) {
                    onAlert && onAlert(txn);
                  }
                } catch (e) {
                  // ignore
                }
              }}
              disabled={!onAlert}
              accessibilityRole="button"
              accessibilityLabel={alerted ? 'Admin alerted' : 'Alert admin'}
              style={{ padding: 6 }}
            >
              <Ionicons
                name={alerted ? 'notifications' : 'notifications-outline'}
                size={18}
                color={alerted ? (theme.colors.success || '#1DBF73') : (theme.colors.primary || '#007bff')}
              />
            </TouchableOpacity>
            {alerted && (
              <Text style={{ fontSize: 10, color: theme.colors.success, marginLeft: 4 }}>Notified</Text>
            )}
          </>
        )}
      </View>
    </TouchableOpacity>
  );
};

export default memo(TransactionItem);

const createStyles = (t: any) => StyleSheet.create({
  row: {
    marginBottom: 10,
    padding: 12,
    backgroundColor: t.colors.surface || '#fff',
    borderRadius: 10,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
    elevation: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  }
});
