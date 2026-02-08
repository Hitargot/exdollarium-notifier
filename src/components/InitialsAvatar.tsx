import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../theme/index'; // Assuming you have a theme provider

interface Props {
  firstName?: string;
  lastName?: string;
  size?: number;
}

const InitialsAvatar = ({ firstName = '', lastName = '', size = 48 }: Props) => {
  const { colors } = useTheme();

  // Generate a consistent color based on the name so it doesn't change on refresh
  const getBackgroundColor = () => {
    const charSum = (firstName.charCodeAt(0) || 0) + (lastName.charCodeAt(0) || 0);
    const premiumPalette = [
      '#162660', // Your primary deep blue
      '#1E3A8A', // Royal Blue
      '#4338CA', // Indigo
      '#6D28D9', // Violet
      '#0369A1', // Sky Deep
    ];
    return premiumPalette[charSum % premiumPalette.length];
  };

  const initials = `${firstName?.[0]?.toUpperCase() || ''}${lastName?.[0]?.toUpperCase() || ''}`;

  return (
    <View 
      style={[
        styles.container, 
        { 
          width: size, 
          height: size, 
          borderRadius: size * 0.35, // Premium Squircle-ish radius
          backgroundColor: getBackgroundColor() 
        }
      ]}
    >
      {/* Subtle Inner Glow for depth */}
      <View style={[styles.innerGlow, { borderRadius: size * 0.35 }]} />
      
      <Text style={[styles.initials, { fontSize: size * 0.38 }]}>
        {initials}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    justifyContent: 'center',
    alignItems: 'center',
    // Premium shadow
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 8,
    elevation: 3,
    overflow: 'hidden',
  },
  innerGlow: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255,255,255,0.05)', // Very subtle highlight
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  initials: {
    color: '#fff',
    fontWeight: '800',
    letterSpacing: -0.5,
  },
});

export default InitialsAvatar;