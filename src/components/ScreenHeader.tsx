import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
// Removed useSafeAreaInsets to avoid automatic top padding (was causing ~36px on some devices)
import * as Haptics from 'expo-haptics';

// Project Imports
import appTheme from '../styles/theme';
import { useTheme } from '../theme/index';

type Props = {
  title: string;
  backgroundColor?: string;
  onBack?: () => void;
  rightAction?: React.ReactNode;
  isModal?: boolean;
  titleAlign?: 'center' | 'left';
  hideBottomBorder?: boolean;
};

const ScreenHeader: React.FC<Props> = ({ 
  title, 
  backgroundColor, 
  onBack, 
  rightAction, 
  isModal = false, 
  titleAlign = 'center',
  hideBottomBorder = false
}) => {
  const navigation = useNavigation();
  const { colors } = useTheme() || { colors: appTheme.colors };

  const bg = backgroundColor || colors.surface;
  const contentColor = colors.text;

  const handleBack = () => {
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (onBack) return onBack();
    if (navigation.canGoBack()) navigation.goBack();
  };

  return (
    <View style={[
      styles.container, 
      { 
        backgroundColor: bg, 
        borderBottomColor: hideBottomBorder ? 'transparent' : colors.border || '#F2F4F7',
        borderBottomWidth: hideBottomBorder ? 0 : 1 
      }
    ]}> 
      {/* PREMIUM TOUCH: Adding a dedicated spacer or extra vertical padding 
        makes the title sit lower, exactly like your reference image.
      */}
      <View style={styles.headerContent}>
        {/* Back Button - Fixed width to prevent title jumping */}
        <View style={styles.sideElement}>
          <TouchableOpacity 
            onPress={handleBack} 
            style={styles.backCircle}
            hitSlop={{ top: 20, bottom: 20, left: 20, right: 20 }}
          > 
            <Ionicons 
              name={isModal ? 'close' : 'chevron-back'} 
              size={isModal ? 28 : 24} 
              color={contentColor} 
            />
          </TouchableOpacity>
        </View>

        {/* Title */}
        <View style={[
          styles.titleWrapper,
          titleAlign === 'left' && { alignItems: 'flex-start' }
        ]}>
          <Text style={[styles.title, { color: contentColor }]} numberOfLines={1}>
            {title}
          </Text>
        </View>

        {/* Right Action */}
        <View style={[styles.sideElement, { alignItems: 'flex-end' }]}>
          {rightAction}
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
    zIndex: 100,
    // Using a subtle border instead of heavy shadows for a modern look
  },
  headerContent: {
    // Increased height from 56 to 64 for that "airy" premium feel
    height: 64, 
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  sideElement: {
    flex: 1, // Takes up equal space on both sides
    justifyContent: 'center',
  },
  backCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'flex-start',
  },
  titleWrapper: {
    flex: 4, // Gives title more room
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    // Increased size and adjusted weight for premium typography
    fontSize: 20, 
    fontWeight: '700',
    letterSpacing: -0.5,
    // Modern apps use a very dark navy/grey rather than pure black
    fontFamily: Platform.OS === 'ios' ? 'System' : 'sans-serif-medium',
  },
});

export default ScreenHeader;