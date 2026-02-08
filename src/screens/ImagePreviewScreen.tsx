import React, { useEffect, useState, useRef } from 'react';
import { View, Text, ActivityIndicator, StyleSheet, TouchableOpacity, Dimensions, Animated, TouchableWithoutFeedback } from 'react-native';
import { Image, Linking } from 'react-native';
import Constants from 'expo-constants';
import authStorage from '../utils/authStorage';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons as Icon } from '@expo/vector-icons';
import appTheme from '../styles/theme';
import { useTheme } from '../theme/index';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

const ImagePreviewScreen = ({ route, navigation }: any) => {
  const url: string | undefined = route?.params?.url;
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [imgRatio, setImgRatio] = useState<number | null>(null);
  const [normalizedUrl, setNormalizedUrl] = useState<string | null>(null);
  const [previewKind, setPreviewKind] = useState<'image' | 'video' | 'webview' | null>(null);
  const themeCtx = (() => { try { return useTheme(); } catch (e) { return undefined as any; } })();
  const theme = themeCtx || appTheme;
  const styles = React.useMemo(() => createStyles(theme), [theme]);

  useEffect(() => {
    if (!url) return;
    let cancelled = false;
    const normalizeUrl = (raw?: string | null) => {
      if (!raw) return raw || '';
      let u = String(raw).trim();
      // handle paths that begin with a colon like ':22222/uploads/...'
      if (u.startsWith(':')) {
        const host = (typeof window !== 'undefined' && (window as any).location && (window as any).location.hostname) ? (window as any).location.hostname : 'localhost';
        return `http://${host}${u}`;
      }
      // if already absolute
      if (/^https?:\/\//i.test(u)) {
        // downgrade https://localhost to http:// for local dev
        if (/localhost|127\.0\.0\.1/.test(u) && /^https:\/\//i.test(u)) {
          u = u.replace(/^https:\/\//i, 'http://');
        }
        // If the app is configured with an apiUrl that uses a LAN IP, prefer that host
        try {
          const extras = (Constants.expoConfig && (Constants.expoConfig as any).extra) || {};
          const apiBase = extras.apiUrl || extras.API_URL || '';
          if (apiBase && /localhost|127\.0\.0\.1/.test(u)) {
            try {
              const parsed = new URL(String(apiBase));
              const hostWithPort = parsed.host; // includes port if present
              u = u.replace(/localhost(:\d+)?|127\.0\.0\.1(:\d+)?/i, hostWithPort);
            } catch (e) {
              // ignore URL parsing errors and fall back to original u
            }
          }
        } catch (e) {
          // ignore
        }
        return u;
      }
      // handle leading slash relative paths by joining with configured API base
      const extras = (Constants.expoConfig && (Constants.expoConfig as any).extra) || {};
      const apiBase = extras.apiUrl || '';
      if (u.startsWith('/')) {
        if (apiBase) {
          let base = String(apiBase).replace(/\/$/, '');
          if (/localhost|127\.0\.0\.1/.test(base) && /^https:\/\//i.test(base)) base = base.replace(/^https:\/\//i, 'http://');
          return base + u;
        }
        return u;
      }
      // otherwise return as-is
      return u;
    };

    async function probe() {
      try {
        // compute normalized URL once and persist for Image source
        const u = normalizeUrl(url as string);
        let normalized: string | null = u || null;

        // If this looks like a protected /uploads path, attempt to get a signed URL
        try {
          const extras = (Constants.expoConfig && (Constants.expoConfig as any).extra) || {};
          const apiBase = extras.apiUrl || '';
          const uploadsPrefix = apiBase ? `${String(apiBase).replace(/\/$/, '')}/uploads/` : '/uploads/';
          if (u && (u.startsWith(uploadsPrefix) || u.includes('/uploads/'))) {
            const name = u.startsWith('/') ? u.replace(/^\//, '').replace(/^uploads\//, '') : u.replace(uploadsPrefix, '');
            const token = await authStorage.getToken().catch(() => null);
            const headers: any = {};
            if (token) headers.Authorization = `Bearer ${token}`;
            const apiHost = apiBase ? String(apiBase).replace(/\/$/, '') : `${u.split('/')[0]}//${u.split('/')[2]}`;
            const signedUrl = `${apiHost}/api/uploads/${encodeURIComponent(name)}/signed`;
            try {
              const sres = await fetch(signedUrl, { headers });
              if (sres.ok) {
                const j = await sres.json();
                if (j && (j.url || j.signedUrl || j.data?.url)) {
                  normalized = j.url || j.signedUrl || j.data?.url;
                  if (__DEV__) console.log('[ImagePreview] obtained signed URL ->', normalized);
                }
              } else {
                if (__DEV__) try { const t = await sres.text(); console.log('[ImagePreview] signed endpoint non-ok:', sres.status, t); } catch (e) {}
              }
            } catch (e) {
              if (__DEV__) console.log('[ImagePreview] signed URL fetch failed', e);
            }
          }
        } catch (e) {
          // ignore signed attempt errors and fall back
        }

        setNormalizedUrl(normalized || null);
        console.log('[ImagePreview] normalized url ->', normalized);
        let ok = false;
        try {
          const head = await fetch(normalized || '', { method: 'HEAD' });
          ok = head && head.ok;
        } catch (he) {
          // HEAD may be blocked; try a small GET as fallback
          try {
            const get = await fetch(normalized || '', { method: 'GET' });
            ok = get && get.ok;
          } catch (ge) {
            ok = false;
          }
        }

        if (!ok) {
          // If probe failed (HEAD/GET blocked), still attempt to show a sensible fallback
          // instead of blocking — allow opening in browser or using WebView/video player.
          console.warn('[ImagePreview] probe failed for', normalized, ' — falling back to extension-based preview');
          const ext = String(normalized || u).split('?')[0].split('.').pop() || '';
          const imgExts = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg'];
          const videoExts = ['mp4', 'mov', 'm4v', 'webm', 'ogg', '3gp', 'mkv'];
          const docExts = ['pdf', 'htm', 'html', 'txt'];
          if (imgExts.includes(String(ext).toLowerCase())) {
            setPreviewKind('image');
          } else if (videoExts.includes(String(ext).toLowerCase())) {
            setPreviewKind('video');
          } else if (docExts.includes(String(ext).toLowerCase())) {
            setPreviewKind('webview');
          } else {
            setPreviewKind('webview');
          }
          if (!cancelled) {
            setNormalizedUrl(normalized || u || null);
            setImgRatio(null);
            setLoading(false);
            setError(false);
          }
          return;
        }

        // Decide preview kind by extension and try to read intrinsic size for images
        const ext = String(normalized || u).split('?')[0].split('.').pop() || '';
        const imgExts = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg'];
        const videoExts = ['mp4', 'mov', 'm4v', 'webm', 'ogg', '3gp', 'mkv'];
        const docExts = ['pdf', 'htm', 'html', 'txt'];
        if (imgExts.includes(String(ext).toLowerCase())) {
          setPreviewKind('image');
          Image.getSize(normalized || u, (w, h) => {
            if (!cancelled) setImgRatio(w / h);
          }, (e) => {
            console.warn('[ImagePreview] Image.getSize failed', e);
            if (!cancelled) setImgRatio(null);
          });
        } else if (videoExts.includes(String(ext).toLowerCase())) {
          setPreviewKind('video');
          if (!cancelled) setImgRatio(null);
        } else if (docExts.includes(String(ext).toLowerCase())) {
          setPreviewKind('webview');
          if (!cancelled) setImgRatio(null);
        } else {
          // default to webview for unknown types; WebView may render or user can open externally
          setPreviewKind('webview');
          if (!cancelled) setImgRatio(null);
        }
      } catch (err) {
        console.error('[ImagePreview] probe error', err);
        if (!cancelled) setError(true);
      }
    }
    probe();
    return () => { cancelled = true; };
  }, [url]);

  return (
    <SafeAreaView style={styles.container} edges={['bottom', 'left', 'right']}>
      <SafeAreaView edges={['top']} style={styles.headerSafeArea}>
        <View >
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }} style={{ padding: 6, width: 48, alignItems: 'flex-start' }}>
          <Icon name="arrow-back" size={24} color={theme.colors.icon || theme.colors.primary} />
        </TouchableOpacity>
        <Text style={styles.title}>Image Preview</Text>
        <View style={{ width: 48 }} />
        </View>
      </SafeAreaView>

      <View style={styles.content}>
        {!url && (
          <View style={styles.empty}><Text>No image URL provided</Text></View>
        )}
        {url && (
          <View style={styles.imageContainer}>
            {loading && <ActivityIndicator size="large" color={theme.colors.primary} style={StyleSheet.absoluteFill} />}
            {error && <View style={styles.empty}><Text>Unable to load image</Text></View>}
              {!error && (
                (() => {
                  const src = normalizedUrl || String(url || '');
                    if (previewKind === 'video') {
                    // Prefer the newer `expo-video` package when available (expo-av is deprecated).
                    // Try requiring `expo-video` first, then fall back to `expo-av` for older projects.
                    let VideoComp: any = null;
                    try {
                      // eslint-disable-next-line @typescript-eslint/no-var-requires
                      const vmod = require('expo-video');
                      VideoComp = vmod && (vmod.Video || vmod.default || vmod);
                      if (VideoComp) console.log('[ImagePreview] using expo-video');
                    } catch (e1) {
                      try {
                        // eslint-disable-next-line @typescript-eslint/no-var-requires
                        const vmod2 = require('expo-av');
                        VideoComp = vmod2 && (vmod2.Video || vmod2.default || vmod2);
                        if (VideoComp) console.log('[ImagePreview] using expo-av as fallback');
                      } catch (e2) {
                        VideoComp = null;
                      }
                    }
                    if (VideoComp) {
                      return (
                        <VideoComp
                          source={{ uri: src }}
                          useNativeControls
                          resizeMode="contain"
                          style={[styles.image, { width: screenWidth, height: screenHeight * 0.6 }]}
                          onLoadStart={() => { setLoading(true); setError(false); }}
                          onLoad={() => setLoading(false)}
                          onError={(e: any) => { console.warn('[ImagePreview] Video error', e); setLoading(false); setError(true); }}
                        />
                      );
                    }
                      return (
                        <View style={{ alignItems: 'center', padding: 20 }}>
                        <Text style={{ marginBottom: 12, color: theme.colors.muted || '#666' }}>Video preview not available in this build.</Text>
                        <TouchableOpacity style={styles.primaryAction} onPress={() => { try { Linking.openURL(src); } catch (e) { console.warn('Open URL failed', e); } }}>
                          <Text style={{ color: theme.colors.white || '#fff', fontWeight: '700' }}>Open in browser</Text>
                        </TouchableOpacity>
                      </View>
                    );
                  }
                  if (previewKind === 'webview') {
                    let WebView: any = null;
                    try { WebView = require('react-native-webview').WebView; } catch (e) { WebView = null; }
                    if (WebView) {
                      return (
                        <View style={{ width: '100%', height: screenHeight * 0.75 }}>
                          <WebView source={{ uri: src }} onLoadStart={() => { setLoading(true); }} onLoadEnd={() => setLoading(false)} onError={(e: any) => { console.warn('[ImagePreview] WebView error', e); setLoading(false); setError(true); }} />
                        </View>
                      );
                    }
                    return (
                      <View style={{ alignItems: 'center', padding: 20 }}>
                        <Text style={{ marginBottom: 12, color: theme.colors.muted || '#666' }}>Preview not available in-app.</Text>
                        <TouchableOpacity style={styles.primaryAction} onPress={() => {
                          try { Linking.openURL(src); } catch (e) { console.warn('Open in browser failed', e); }
                        }}>
                          <Text style={{ color: theme.colors.white || '#fff', fontWeight: '700' }}>Open in browser</Text>
                        </TouchableOpacity>
                      </View>
                    );
                  }
                  // default: image — render ZoomableImage when possible
                  const ZoomableImage = ({ uri, style }: { uri: string; style?: any }) => {
                    // dynamic require so the app still runs if gesture-handler isn't installed
                    let PinchGestureHandler: any = null;
                    let State: any = null;
                    let GestureHandlerRootView: any = null;
                    try {
                      // eslint-disable-next-line @typescript-eslint/no-var-requires
                      const gh = require('react-native-gesture-handler');
                      PinchGestureHandler = gh.PinchGestureHandler;
                      State = gh.State;
                      GestureHandlerRootView = gh.GestureHandlerRootView;
                    } catch (e) {
                      PinchGestureHandler = null;
                      State = null;
                      GestureHandlerRootView = null;
                    }

                    const baseScale = useRef(new Animated.Value(1)).current;
                    const pinchScale = useRef(new Animated.Value(1)).current;
                    const scale = useRef(Animated.multiply(baseScale, pinchScale)).current;
                    const lastScale = useRef(1);

                    const onPinchEvent = PinchGestureHandler ? Animated.event(
                      [{ nativeEvent: { scale: pinchScale } }],
                      { useNativeDriver: true }
                    ) : null;

                    const onPinchStateChange = (event: any) => {
                      if (!PinchGestureHandler || !State) return;
                      if (event.nativeEvent.oldState === State.ACTIVE) {
                        lastScale.current = lastScale.current * event.nativeEvent.scale;
                        // clamp zoom between 1 and 4
                        lastScale.current = Math.max(1, Math.min(lastScale.current, 4));
                        baseScale.setValue(lastScale.current);
                        pinchScale.setValue(1);
                      }
                    };

                    // double-tap to toggle zoom
                    const lastTap = useRef<number | null>(null);
                    const handleTap = () => {
                      const now = Date.now();
                      if (lastTap.current && (now - lastTap.current) < 300) {
                        // double tap
                        const to = lastScale.current > 1.2 ? 1 : 2;
                        lastScale.current = to;
                        Animated.spring(baseScale, { toValue: to, useNativeDriver: true }).start();
                        pinchScale.setValue(1);
                      }
                      lastTap.current = now;
                    };

                    if (!PinchGestureHandler) {
                      return (
                        <TouchableWithoutFeedback onPress={handleTap}>
                          <Image
                            source={{ uri }}
                            style={style}
                            resizeMode="contain"
                            onLoadStart={() => { setLoading(true); setError(false); }}
                            onLoadEnd={() => setLoading(false)}
                            onError={() => { setLoading(false); setError(true); }}
                          />
                        </TouchableWithoutFeedback>
                      );
                    }

                    const pinchContent = (
                      <PinchGestureHandler onGestureEvent={onPinchEvent} onHandlerStateChange={onPinchStateChange}>
                        <Animated.View style={{ transform: [{ scale }] }}>
                          <TouchableWithoutFeedback onPress={handleTap}>
                            <Animated.Image
                              source={{ uri }}
                              style={style}
                              resizeMode="contain"
                              onLoadStart={() => { setLoading(true); setError(false); }}
                              onLoadEnd={() => setLoading(false)}
                              onError={() => { setLoading(false); setError(true); }}
                            />
                          </TouchableWithoutFeedback>
                        </Animated.View>
                      </PinchGestureHandler>
                    );

                    // GestureHandlerRootView must be an ancestor of gesture handlers. If available, wrap the
                    // pinch handler in a GestureHandlerRootView to ensure gestures are recognized.
                    if (GestureHandlerRootView) {
                      return (
                        <GestureHandlerRootView style={{ flex: 0 }}>
                          {pinchContent}
                        </GestureHandlerRootView>
                      );
                    }

                    return pinchContent;
                  };

                  return (
                    <ZoomableImage uri={src} style={[styles.image, imgRatio ? { aspectRatio: imgRatio } : { width: screenWidth, height: screenHeight * 0.6 }]} />
                  );
                })()
              )}
          </View>
        )}
      </View>
    </SafeAreaView>
  );
};

const createStyles = (t: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: t.colors.surface || '#fff' },
  headerSafeArea: { paddingTop: 0, backgroundColor: (t.name === 'dark' ? t.colors.background : t.colors.surface) || '#fff' },
  // header: { paddingHorizontal: 12, paddingVertical: 6, flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-start', borderBottomWidth: 1, borderColor: t.colors.border || '#f1f3f6', position: 'relative' },
  title: { fontWeight: '800', color: t.colors.text, position: 'absolute', left: 0, right: 0, textAlign: 'center' },
  content: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  imageContainer: { width: '100%', alignItems: 'center', justifyContent: 'center', padding: 12 },
  image: { width: '100%' },
  empty: { alignItems: 'center', justifyContent: 'center', padding: 20, color: t.colors.muted },
  primaryAction: { backgroundColor: t.colors.primary, padding: 12, borderRadius: 8 },
});

export default ImagePreviewScreen;
