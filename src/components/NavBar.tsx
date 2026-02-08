import React, { useMemo } from 'react';
import { View, TouchableOpacity, Text, StyleSheet, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useNavigationState } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';

// Project Imports
import staticTheme from '../styles/theme';
import { useTheme } from '../theme/index';

type TabName = 'Home' | 'History' | 'Profile' | 'Help';

type Props = {
  active?: TabName | string;
  onPress: (tab: TabName) => void;
  style?: any;
};

const NavBar = ({ active, onPress, style }: Props) => {
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  
  const { colors: tColors } = useTheme() || { colors: staticTheme.colors };
  const styles = useMemo(() => createStyles(tColors), [tColors]);

  // Derive active tab from actual navigation state automatically
  const navigationState = useNavigationState((state) => state);
  const derivedActive = useMemo(() => {
    if (!navigationState) return active;
    const route = navigationState.routes[navigationState.index];
    const name = route?.name?.toLowerCase() || '';
    
    if (name.includes('dashboard') || name.includes('home')) return 'Home';
    if (name.includes('history') || name.includes('transaction')) return 'History';
    if (name.includes('profile') || name.includes('settings')) return 'Profile';
    if (name.includes('help') || name.includes('support')) return 'Help';
    return active;
  }, [navigationState, active]);

  const isActive = (tab: TabName) => derivedActive === tab;

  const renderTab = (tab: TabName, icon: string) => {
    const activeStatus = isActive(tab);
    const iconName = activeStatus ? icon : `${icon}-outline`;
    
    return (
      <TouchableOpacity 
        style={styles.item} 
        onPress={() => onPress(tab)}
        activeOpacity={0.7}
      >
        <View style={styles.iconContainer}>
          <Ionicons 
            name={iconName as any} 
            size={24} 
            color={activeStatus ? tColors.primary : tColors.muted} 
          />
          {activeStatus && <View style={styles.activeIndicator} />}
        </View>
        <Text style={[styles.label, activeStatus && styles.activeLabel]}>
          {tab}
        </Text>
      </TouchableOpacity>
    );
  };

  return (
    <View style={[
      styles.container, 
      { 
        paddingBottom: Math.max(insets.bottom, 12),
        height: 65 + Math.max(insets.bottom, 12)
      }, 
      style
    ]}>
      {renderTab('Home', 'home')}
      {renderTab('History', 'time')}
      {renderTab('Profile', 'person-circle')}
      {renderTab('Help', 'help-circle')}
    </View>
  );
};

const createStyles = (t: any) => StyleSheet.create({
  container: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    backgroundColor: t.surface,
    borderTopWidth: 1,
    borderTopColor: t.border,
    justifyContent: 'space-around',
    alignItems: 'center',
    // Premium Shadow
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -4 },
        shadowOpacity: 0.05,
        shadowRadius: 10,
      },
      android: {
        elevation: 20,
      },
    }),
  },
  item: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 12,
  },
  iconContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    height: 30,
  },
  activeIndicator: {
    position: 'absolute',
    top: -12,
    width: 24,
    height: 3,
    backgroundColor: t.primary,
    borderBottomLeftRadius: 4,
    borderBottomRightRadius: 4,
  },
  label: {
    fontSize: 11,
    fontWeight: '500',
    color: t.muted,
    marginTop: 4,
  },
  activeLabel: {
    color: t.primary,
    fontWeight: '700',
  },
});

export default NavBar;