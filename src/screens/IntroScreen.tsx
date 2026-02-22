import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Easing,
  Dimensions,
  BackHandler,
  PanResponder,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation } from '@react-navigation/native';

const { width, height } = Dimensions.get('window');
const IMAGE_SIZE = Math.round(width * 0.55);

const SLIDES = [
  {
    key: 'one',
    title: 'Instant Exchange,\nZero Stress',
    subtitle: 'Convert PayPal, Payoneer and crypto to Naira seamlessly — with fast processing and instant payouts.',
    icon: 'swap-horizontal' as const,
    iconBg: '#1E3A8A',
    iconColor: '#60A5FA',
  },
  {
    key: 'two',
    title: 'Fast. Secure.\nReliable.',
    subtitle: 'Every transaction is protected with secure verification and handled with care from start to finish.',
    icon: 'shield-checkmark' as const,
    iconBg: '#1E3A8A',
    iconColor: '#34D399',
  },
  {
    key: 'three',
    title: 'Stay Updated,\nAlways',
    subtitle: 'Get real-time notifications for transaction status, confirmations, and payouts — no guesswork.',
    icon: 'notifications' as const,
    iconBg: '#1E3A8A',
    iconColor: '#FBBF24',
    final: true,
  },
];

export default function IntroScreen() {
  const navigation: any = useNavigation();
  const [index, setIndex] = React.useState(0);
  const anim = React.useRef(new Animated.Value(0)).current;
  const imageAnim = React.useRef(new Animated.Value(0)).current;
  const indexRef = React.useRef(index);

  React.useEffect(() => {
    Animated.timing(anim, {
      toValue: index,
      duration: 400,
      easing: Easing.out(Easing.back(1)), // Added a slight "bounce" effect for premium feel
      useNativeDriver: true,
    }).start();
    
    imageAnim.setValue(0);
    Animated.spring(imageAnim, {
      toValue: 1,
      tension: 20,
      friction: 7,
      useNativeDriver: true,
    }).start();
    
    indexRef.current = index;
  }, [index]);

  React.useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (indexRef.current > 0) {
        setIndex(i => i - 1);
        return true;
      }
      return false;
    });
    return () => sub.remove();
  }, []);

  const panResponder = React.useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) > 10,
      onPanResponderRelease: (_, g) => {
        if (g.dx < -50 && indexRef.current < SLIDES.length - 1) setIndex(i => i + 1);
        else if (g.dx > 50 && indexRef.current > 0) setIndex(i => i - 1);
      },
    })
  ).current;

  const setSeenAndNavigate = async (route: string) => {
    await AsyncStorage.setItem('hasSeenIntro', '1');
    navigation.navigate(route);
  };

  const translateX = anim.interpolate({
    inputRange: SLIDES.map((_, i) => i),
    outputRange: SLIDES.map((_, i) => i * -width),
  });

  const slide = SLIDES[index];

  return (
    <View style={styles.container}>
      <StatusBar style="light" />

      <View style={styles.pager} {...panResponder.panHandlers}>
        <Animated.View style={[styles.slidesRow, { transform: [{ translateX }] }]}>
          {SLIDES.map(s => (
            <View key={s.key} style={styles.slide}>
              <View style={styles.imageContainer}>
                <Animated.View
                  style={[
                    styles.iconCircle,
                    { backgroundColor: s.iconBg },
                    {
                      opacity: imageAnim,
                      transform: [{ scale: imageAnim.interpolate({ inputRange: [0, 1], outputRange: [0.8, 1] }) }],
                    },
                  ]}
                >
                  <Ionicons name={s.icon} size={IMAGE_SIZE * 0.45} color={s.iconColor} />
                </Animated.View>
              </View>
              <View style={styles.textContainer}>
                <Text style={styles.title}>{s.title}</Text>
                <Text style={styles.subtitle}>{s.subtitle}</Text>
              </View>
            </View>
          ))}
        </Animated.View>
      </View>

      <View style={styles.footer}>
        <View style={styles.pagination}>
          {SLIDES.map((_, i) => (
            <View key={i} style={[styles.dot, i === index && styles.dotActive]} />
          ))}
        </View>

        <View style={styles.buttonArea}>
          {slide.final ? (
            <View style={styles.finalActions}>
              <TouchableOpacity style={styles.primaryBtn} onPress={() => setSeenAndNavigate('Signup')}>
                <Text style={styles.primaryBtnText}>Get Started</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.outlineBtn} onPress={() => setSeenAndNavigate('Login')}>
                <Text style={styles.outlineBtnText}>Sign In</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.navRow}>
              <TouchableOpacity onPress={() => setSeenAndNavigate('Login')}>
                <Text style={styles.skipText}>Skip</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.nextBtn} onPress={() => setIndex(i => i + 1)}>
                <Text style={styles.nextBtnText}>Next</Text>
                <Ionicons name="arrow-forward" size={18} color="#162660" />
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#162660' },
  pager: { flex: 1 },
  slidesRow: { flexDirection: 'row', width: width * SLIDES.length },
  slide: { width, alignItems: 'center', justifyContent: 'center', padding: 20 },
  imageContainer: { 
    height: height * 0.45, 
    justifyContent: 'center', 
    alignItems: 'center' 
  },
  iconCircle: {
    width: IMAGE_SIZE,
    height: IMAGE_SIZE,
    borderRadius: IMAGE_SIZE / 2,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10,
  },
  textContainer: { alignItems: 'center', marginTop: 20 },
  title: { fontSize: 32, fontWeight: '900', color: '#fff', textAlign: 'center', lineHeight: 38 },
  subtitle: { fontSize: 16, color: '#A9B5DF', textAlign: 'center', marginTop: 15, lineHeight: 24, paddingHorizontal: 20 },
  
  footer: { padding: 30, paddingBottom: 50 },
  pagination: { flexDirection: 'row', justifyContent: 'center', marginBottom: 30 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.2)', marginHorizontal: 4 },
  dotActive: { width: 20, backgroundColor: '#fff' },
  
  buttonArea: { minHeight: 60 },
  navRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  skipText: { color: '#A9B5DF', fontSize: 16, fontWeight: '600' },
  nextBtn: { 
    backgroundColor: '#fff', 
    flexDirection: 'row', 
    alignItems: 'center', 
    paddingVertical: 12, 
    paddingHorizontal: 24, 
    borderRadius: 30 
  },
  nextBtnText: { color: '#162660', fontWeight: '800', fontSize: 16, marginRight: 8 },
  
  finalActions: { gap: 12 },
  primaryBtn: { backgroundColor: '#fff', paddingVertical: 16, borderRadius: 16, alignItems: 'center' },
  primaryBtnText: { color: '#162660', fontWeight: '800', fontSize: 16 },
  outlineBtn: { borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)', paddingVertical: 16, borderRadius: 16, alignItems: 'center' },
  outlineBtnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
});