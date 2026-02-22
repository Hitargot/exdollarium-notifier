import React, { useEffect, useState, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Linking, Image, ActivityIndicator, Dimensions, ViewStyle, StyleProp, FlatList, ViewToken, Animated } from 'react-native';
// downloadAsync from the default expo-file-system package is the standard API.
import * as FileSystem from 'expo-file-system';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import staticTheme from '../styles/theme';
import authStorage from '../utils/authStorage';

type FlyerProps = {
  requireSparkline?: boolean;
  title?: string;
  body?: string;
  ctaLabel?: string;
  onPress?: () => void;
};

// Do not default to the public Heroku host when running locally. Use the
// configured expo extra.apiUrl or empty string so relative paths resolve
// to the current origin in development.
const API_URL = (Constants.expoConfig?.extra?.apiUrl || '').replace(/\/+$/, '');

const Flyer: React.FC<FlyerProps> = ({ requireSparkline = true, title, body, ctaLabel, onPress }) => {
  const theme = staticTheme as any || { colors: { surface: '#fff', text: '#222', primary: '#1DBF73' } };
  const styles = createStyles(theme);
  const prefsCtx = { preferences: { showBalanceSparkline: true }, ready: true } as any;

  const [serverFlyer, setServerFlyer] = useState<any | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [mediaLoading, setMediaLoading] = useState(false);
  // support multiple media items (carousel)
  const [resolvedMediaUris, setResolvedMediaUris] = useState<Array<string | null>>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [mediaError, setMediaError] = useState<string | null>(null);
  // refs used by the compact carousel rendering. MUST be top-level so hooks
  // are called in the same order on every render (avoid Rules of Hooks errors).
  const listRef = useRef<FlatList<any> | null>(null);
  // keep a ref to the latest computed finalUris so viewability callback
  // (which is created once) can access the current length without closing
  // over a stale variable. This avoids creating hooks conditionally.
  const latestFinalUrisRef = useRef<Array<string | undefined>>([]);
  const [thumbErrorIds, setThumbErrorIds] = useState<Record<string, boolean>>({});
  const [providerThumbs, setProviderThumbs] = useState<Record<string, string>>({});
  // Force showing thumbnail debug overlay and logs on-screen. Set to `true`
  // to always display the computed thumbnail URL (helpful during debugging).
  const FORCE_THUMB_OVERLAY = true;
  const onViewableItemsChanged = useRef(({ viewableItems }: { viewableItems: ViewToken[] }) => {
    if (viewableItems && viewableItems.length) {
      const raw = viewableItems[0].index ?? 0;
      const finalUrisLocal = latestFinalUrisRef.current || [];
      const n = finalUrisLocal.length;
      if (n <= 1) {
        setActiveIndex(0);
        return;
      }
      // duplicated data shape: [last, ...items, first] -> indices 0..n+1
      if (raw === 0) setActiveIndex(n - 1);
      else if (raw === n + 1) setActiveIndex(0);
      else setActiveIndex((raw - 1 + n) % n);
    }
  }).current;
  // animated opacity for the pill indicator
  const badgeOpacity = useRef(new Animated.Value(0.6)).current;
  

  // 1. Fetch effect must be at the top
  useEffect(() => {
    let mounted = true;
    const CACHE_KEY = 'cachedFlyer_v1';
    (async () => {
      try {
        // Try to load cached flyer first so returning to the dashboard is instant
        try {
          const raw = await AsyncStorage.getItem(CACHE_KEY);
          if (raw) {
            const cached = JSON.parse(raw);
            if (mounted && cached) {
              setServerFlyer(cached);
              setLoaded(true);
            }
          }
        } catch (e) { /* ignore cache parse errors */ }

        // Fetch latest in background and update cache if changed
        const res = await fetch(`${API_URL}/api/flyer`);
        if (!mounted) return;
        if (res.ok) {
          const j = await res.json();
          if (j && j.flyer) {
            setServerFlyer(j.flyer);
            try {
              await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(j.flyer));
            } catch (e) { /* ignore storage failures */ }
          }
        }
      } catch (e) {
        // ignore network errors; keep cached version if present
      } finally {
        if (mounted) setLoaded(true);
      }
    })();
    return () => { mounted = false; };
  }, []);

  // Helper for URI
  const getMediaUri = (mediaUrl?: string) => {
    if (!mediaUrl) return null;
    try {
      if (mediaUrl.startsWith('http://') || mediaUrl.startsWith('https://')) return mediaUrl;
      if (mediaUrl.startsWith('/')) return `${API_URL.replace(/\/$/, '')}${mediaUrl}`;
      return mediaUrl;
    } catch (e) { return mediaUrl; }
  };

  // 2. Build media list (array) and compute media URIs
  const mediaList: string[] = (() => {
    if (!serverFlyer) return title ? [] : [];
    if (Array.isArray(serverFlyer.mediaUrls) && serverFlyer.mediaUrls.length) return serverFlyer.mediaUrls;
    if (Array.isArray(serverFlyer.media) && serverFlyer.media.length) return serverFlyer.media;
    if (serverFlyer.mediaUrl) return [serverFlyer.mediaUrl];
    return [];
  })();
  const mediaUris = mediaList.map((m) => getMediaUri(m));

  // Layout constants (used by hooks below) — compute early so hooks can run
  // unconditionally before any early returns. These are independent of the
  // serverFlyer render branch.
  const screenWidth = Dimensions.get('window').width;
  const bannerHeight = Math.min(160, Math.round(screenWidth * 0.28));
  const containerHorizontalPadding = 32; // 16px left + 16px right
  const containerWidth = Math.max(0, screenWidth - containerHorizontalPadding);
  const itemSeparator = 8;
  const itemWidth = containerWidth;

  // compute the final URIs now (resolved overrides mediaUris) and store a
  // ref to them so callbacks created above can read the current list.
  const finalUris: Array<string | undefined> = mediaUris.map((u, i) => (resolvedMediaUris[i] || u) as string | undefined);
  // Avoid logging finalUris (may contain large data URIs). No-op in all builds.

  // helper: determine likely media type from URI filename extension. We prefer
  // per-item detection because server `f.type` may be coarse or incorrect,
  // which previously caused the video player to try playing non-streamable links
  // (for example a YouTube page URL). Also detect common hosted/embed URLs
  // (youtube, vimeo, tiktok, etc.) and treat them as external links rather
  // than a raw video stream.
  const isVideoUri = (u?: string) => !!(u && u.match(/\.(mp4|mov|m4v|webm|m3u8|ts|mpeg|mpg|3gp)(\?.*)?$/i));
  const isImageUri = (u?: string) => !!(u && u.match(/\.(jpe?g|png|gif|webp|bmp|heic|heif)(\?.*)?$/i));
  const isHostedEmbedUri = (u?: string) => {
    if (!u) return false;
    try {
      const host = (u || '').toLowerCase();
      // common sites that serve pages/embeds rather than direct video files
      const providers = ['youtube.com', 'youtu.be', 'vimeo.com', 'tiktok.com', 'instagram.com', 'facebook.com', 'dailymotion.com', 'twitter.com', 'x.com'];
      return providers.some(p => host.includes(p));
    } catch (e) {
      return false;
    }
  };
  // Extract a YouTube video id from common URL forms (youtu.be, watch, shorts)
  const extractYouTubeId = (u?: string) => {
    if (!u) return null;
    try {
      const s = String(u);
      // youtu.be/<id>
      const b = s.match(/youtu\.be\/([-_A-Za-z0-9]+)/i);
      if (b && b[1]) return b[1];
      // youtube.com/watch?v=<id>
      const w = s.match(/[?&]v=([-_A-Za-z0-9]+)/i);
      if (w && w[1]) return w[1];
      // youtube.com/shorts/<id>
      const sh = s.match(/youtube\.com\/shorts\/([-_A-Za-z0-9]+)/i);
      if (sh && sh[1]) return sh[1];
      // embed/<id>
      const em = s.match(/embed\/([-_A-Za-z0-9]+)/i);
      if (em && em[1]) return em[1];
      return null;
    } catch (e) { return null; }
  };
  const youTubeThumbnailForId = (id: string) => `https://img.youtube.com/vi/${id}/hqdefault.jpg`;

  // keep latestFinalUrisRef in sync and position the list when finalUris change
  useEffect(() => {
    latestFinalUrisRef.current = finalUris;
    const n = finalUris.length;
    if (!listRef.current) return;
    if (n > 1) {
      // Try to position the list on the first real item (index 1 in duplicated data)
      // Use a tiny timeout as a fallback when the list hasn't measured yet.
      try { (listRef.current as any).scrollToOffset({ offset: itemWidth, animated: false }); } catch (e) {
        try { setTimeout(() => { try { (listRef.current as any).scrollToOffset({ offset: itemWidth, animated: false }); } catch (_) {} }, 60); } catch (_) {}
      }
    }
  }, [finalUris.join?.(',')]);

  // (initial scroll effect will be run later after finalUris is computed)

  useEffect(() => {
    if (__DEV__ && mediaUris && mediaUris.length) {
      try { console.log('Flyer.mediaUris ->', mediaUris); } catch (e) {}
    }
  }, [mediaUris.join?.(',')]);

  // Fetch provider thumbnails (oEmbed) for providers like Vimeo and TikTok.
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        if (!finalUris || finalUris.length === 0) return;
        const toFetch = finalUris.filter(u => u && isHostedEmbedUri(u) && !providerThumbs[u!]);
        for (const u of toFetch) {
          if (!u) continue;
          try {
            const proxyUrl = `${API_URL.replace(/\/$/, '')}/api/oembed?url=${encodeURIComponent(u)}`;
            const res = await fetch(proxyUrl).catch(() => null);
            if (res && res.ok) {
              const j = await res.json().catch(() => null);
              const data = j && j.data ? j.data : j;
              const thumb = data?.thumbnail_url || data?.thumbnail || data?.thumbnail_url_https || null;
              if (thumb && mounted) setProviderThumbs(prev => ({ ...prev, [u]: thumb }));
            }
          } catch (e) {
            // ignore per-item failures
          }
        }
      } catch (e) {
        // ignore
      }
    })();
    return () => { mounted = false; };
  }, [finalUris.join?.(','), providerThumbs]);

  // Resolve signed URL for protected /uploads paths. If the backend requires
  // signed URLs, request one from `/api/uploads/:filename/signed` using the
  // stored auth token; otherwise fall back to the computed mediaUri.
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        if (!mediaUris || mediaUris.length === 0) { if (mounted) setResolvedMediaUris([]); return; }

        const apiBase = API_URL.replace(/\/$/, '');
        const uploadsPrefix = apiBase + '/uploads/';

        const token = await authStorage.getToken().catch(() => null);
        if (__DEV__) try { console.log('Flyer.signed: token present=', !!token); } catch (e) {}

        const resolveOne = async (mediaUriLocal: string | null) => {
          if (!mediaUriLocal) return null;
          try {
            // If not an uploads path, return as-is
            if (!(mediaUriLocal.startsWith(uploadsPrefix) || mediaUriLocal.startsWith('/uploads/'))) return mediaUriLocal;
            const name = mediaUriLocal.startsWith('/') ? mediaUriLocal.replace(/^\//, '').replace(/^uploads\//, '') : mediaUriLocal.replace(uploadsPrefix, '');
            const headers: any = {};
            if (token) headers.Authorization = `Bearer ${token}`;
            const url = `${apiBase}/api/uploads/${encodeURIComponent(name)}/signed`;
            const res = await fetch(url, { headers }).catch(() => null);
            if (res && res.ok) {
              const j = await res.json().catch(() => null);
              const signed = j?.url || j?.signedUrl || j?.data?.url || null;
              if (signed) return signed;
            }
            // If signing failed, try to download into cache with auth header
            if (token) {
              try {
                const filenameOnly = (mediaUriLocal || '').split('/').pop() || `flyer-${Date.now()}.bin`;
                const dest = ((FileSystem as any).cacheDirectory || '') + filenameOnly;
                const dl = await FileSystem.downloadAsync(mediaUriLocal, dest, { headers }).catch(() => null);
                if (dl && dl.uri) return dl.uri;
              } catch (e) {
                if (__DEV__) try { console.log('Flyer.fallbackFile failed', e); } catch (e2) {}
              }
              // try fetch -> base64 as last resort (image only)
              try {
                const fileRes = await fetch(mediaUriLocal, { headers }).catch(() => null);
                if (fileRes && fileRes.ok) {
                  const contentType = fileRes.headers.get('content-type') || 'image/jpeg';
                  const arrayBuffer = await fileRes.arrayBuffer();
                  const bytes = new Uint8Array(arrayBuffer);
                  const chunkSize = 0x8000;
                  let binary = '';
                  for (let i = 0; i < bytes.length; i += chunkSize) {
                    const chunk = bytes.subarray(i, i + chunkSize);
                    binary += String.fromCharCode.apply(null, Array.from(chunk));
                  }
                  let base64: string | null = null;
                  try { if (typeof btoa === 'function') base64 = btoa(binary); } catch (e) { /* ignore */ }
                  try { if (!base64 && typeof Buffer !== 'undefined') base64 = (Buffer as any).from(binary, 'binary').toString('base64'); } catch (e) { /* ignore */ }
                  if (base64) return `data:${contentType};base64,${base64}`;
                }
              } catch (e) { if (__DEV__) try { console.log('Flyer.fallback fetch failed', e); } catch (e2) {} }
            }
          } catch (e) {
            // ignore and fall back
          }
          return mediaUriLocal;
        };

        const resolved = await Promise.all(mediaUris.map((m) => resolveOne(m)));
        if (mounted) setResolvedMediaUris(resolved.map((r) => r || null));
      } catch (e) {
        if (mounted) setResolvedMediaUris(mediaUris.map((m) => m || null));
      }
    })();
    return () => { mounted = false; };
  }, [mediaUris.join?.(',')]);

  const resolveVisible = () => {
    const f = serverFlyer;
    if (!f && !title) return false;
    if (f) {
      if (!f.enabled) return false;
      const now = new Date();
      if (f.startAt && new Date(f.startAt) > now) return false;
      if (f.endAt && new Date(f.endAt) < now) return false;
    }
    if (requireSparkline) {
      if (!prefsCtx || !prefsCtx.ready) return false;
      if (!prefsCtx.preferences || !prefsCtx.preferences.showBalanceSparkline) return false;
    }
    return true;
  };

  // 3. EARLY RETURNS (Safe now because all hooks are above this point)
  if (!loaded && !title) return null;
  if (!resolveVisible()) return null;

  // 4. Component Logic / Render
  const f = serverFlyer || { title, body, type: 'text', mediaUrl: '', ctaLabel };

  // Helper: map render index (on duplicated data array) to real media index
  const mapRenderIndexToReal = (renderIndex: number) => {
    const n = finalUris.length;
    if (n <= 1) return renderIndex;
    // duplicated array shape: [last, ...items, first] => length = n + 2
    if (renderIndex === 0) return n - 1;
    if (renderIndex === n + 1) return 0;
    return (renderIndex - 1 + n) % n;
  };

  // Open the best URL for a media item: prefer server-provided mediaLinks[index]
  // falling back to the resolved finalUris entry. Normalize relative paths.
  const openMediaForIndex = async (realIndex: number) => {
    try {
      if (realIndex == null) return;
      const n = finalUris.length;
      if (realIndex < 0 || realIndex >= n) return;
      const serverLink = serverFlyer && Array.isArray(serverFlyer.mediaLinks) ? (serverFlyer.mediaLinks[realIndex] || '') : '';
      let target = serverLink && String(serverLink).trim() ? String(serverLink).trim() : (finalUris[realIndex] || '');
      if (!target) return;
      // If link is a relative uploads path, resolve with API_URL
      if (target.startsWith('/')) target = `${API_URL.replace(/\/$/, '')}${target}`;
      // If no protocol, assume https
      if (!/^https?:\/\//i.test(target)) target = `https://${target}`;
      await Linking.openURL(target);
    } catch (e) {
      try { console.warn('Flyer.openMediaForIndex failed', e); } catch (_) {}
    }
  };

  const handlePress = () => {
    if (onPress) return onPress();
    try {
      if (f.type === 'html' && f.mediaUrl) {
        Linking.openURL(f.mediaUrl);
      }
    } catch (e) {}
  };
  // small centered variant for compact display (depends on screen width)
  const smallWidth = Math.min(320, Math.round(Dimensions.get('window').width * 0.6));
  const smallHeight = Math.min(120, Math.round(smallWidth * 0.28));
  const isMedia = f.type === 'image' || f.type === 'video';
  // Compact rendering for dashboard slot: when requireSparkline is true and the
  // flyer contains media, render the media only so it fills the card and no
  // extra title/body/CTA cause spacing or overlap.
  if (requireSparkline && isMedia && finalUris.length > 0 && finalUris[0]) {
  // Carousel compact rendering
  const renderMediaItem = ({ item, index }: { item: string | undefined; index: number }) => {
      const uri = item as string | undefined;
      if (!uri) return <View style={{ width: '100%', height: bannerHeight, justifyContent: 'center', alignItems: 'center' }} />;
      // Prefer per-item detection, fallback to server-provided flyer type.
      // However, if this URI points to a hosted provider (YouTube, TikTok,
      // etc.) we should NOT feed it to the native video player — it's a
      // page/embed link rather than a raw stream. Treat those as external links.
      const hosted = isHostedEmbedUri(uri);
      const treatAsImage = isImageUri(uri) || f.type === 'image';
      const treatAsVideo = !hosted && (isVideoUri(uri) || f.type === 'video');
      if (treatAsImage && !treatAsVideo) {
        return (
          <View key={index} style={{ width: containerWidth, height: bannerHeight, alignItems: 'center', justifyContent: 'center' }}>
            <TouchableOpacity onPress={() => { const ridx = mapRenderIndexToReal(index); openMediaForIndex(ridx); }} activeOpacity={0.95} style={{ width: itemWidth, height: bannerHeight }}>
              <Image
                source={{ uri }}
                style={{ width: '100%', height: '100%' }}
                resizeMode="cover"
                onLoadStart={() => { setMediaLoading(true); setMediaError(null); }}
                onLoadEnd={() => setMediaLoading(false)}
                onError={(e) => {
                  try { console.warn('Flyer.image onError', e.nativeEvent || e); } catch (err) {}
                  setMediaLoading(false);
                  setMediaError(String((e && (((e as any).nativeEvent?.error) || (e as any).message)) || 'Image load error'));
                }}
              />
            </TouchableOpacity>
          </View>
        );
      }

    // video compact path
    let VideoComp: any = null;
    try {
      const vmod = require('expo-video');
      VideoComp = vmod && (vmod.Video || vmod.default || vmod);
    } catch (e1) {
      try {
        const vmod2 = require('expo-av');
        VideoComp = vmod2 && (vmod2.Video || vmod2.default || vmod2);
      } catch (e2) { VideoComp = null; }
    }
      if (hosted) {
        // For hosted/provider links (YouTube, TikTok, etc.) try to show a
        // thumbnail (YouTube has a known thumbnail URL). Keep thumbnails
        // non-clickable in the compact carousel.
        const providerThumb = providerThumbs[uri as string];
        const ytId = extractYouTubeId(uri as string);
        const thumbToUse = providerThumb || (ytId ? youTubeThumbnailForId(ytId) : null);
        if (thumbToUse) {
          return (
            <View key={index} style={{ width: containerWidth, height: bannerHeight, alignItems: 'center', justifyContent: 'center' }}>
              <View style={{ width: itemWidth, height: bannerHeight }}>
                <Image
                    source={{ uri: thumbToUse }}
                    style={{ width: '100%', height: '100%' }}
                    resizeMode="cover"
                    onError={() => setThumbErrorIds(prev => ({ ...prev, [thumbToUse]: true }))}
                  />
                  <View style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' }} pointerEvents="none">
                    <View style={{ backgroundColor: 'rgba(0,0,0,0.45)', padding: 10, borderRadius: 40 }}>
                      <Text style={{ color: '#fff', fontWeight: '800', fontSize: 16 }}>▶</Text>
                    </View>
                  </View>
                </View>
              </View>
            );
        }
        // fallback: neutral placeholder for other hosted providers
        return (
          <View key={index} style={{ width: containerWidth, height: bannerHeight, alignItems: 'center', justifyContent: 'center' }}>
            <View style={{ width: itemWidth, height: bannerHeight, alignItems: 'center', justifyContent: 'center', backgroundColor: '#efefef' }}>
              <View style={{ alignItems: 'center' }} pointerEvents="none">
                <View style={{ backgroundColor: 'rgba(0,0,0,0.45)', padding: 10, borderRadius: 40, marginBottom: 8 }}>
                  <Text style={{ color: '#fff', fontWeight: '800', fontSize: 16 }}>▶</Text>
                </View>
                <Text style={{ color: '#333' }}>Hosted content</Text>
              </View>
            </View>
          </View>
        );
      }
            return (
              <View key={index} style={{ width: containerWidth, height: bannerHeight, alignItems: 'center', justifyContent: 'center' }}>
                <VideoComp
                  source={{ uri }}
                  useNativeControls
                  resizeMode="cover"
                  style={{ width: itemWidth, height: bannerHeight }}
                  onLoadStart={() => { setMediaLoading(true); setMediaError(null); }}
                  onLoad={() => setMediaLoading(false)}
                  onError={(e: any) => { try { console.warn('Flyer.video onError', e); } catch (err) {} setMediaLoading(false); setMediaError('Video load error'); }}
                />
              </View>
            );
    };

    /* onViewableItemsChanged ref is declared at top-level to maintain hook order */

    // badge animation helpers: show while user is actively scrolling
    const showIndicators = () => {
      Animated.timing(badgeOpacity, { toValue: 1, duration: 160, useNativeDriver: true }).start();
    };

    const hideIndicators = (delay = 700) => {
      Animated.sequence([
        Animated.delay(delay),
        Animated.timing(badgeOpacity, { toValue: 0.55, duration: 300, useNativeDriver: true }),
      ]).start();
    };

    return (
      // Outer wrapper is the visible card area; we center it and clip children
      // so media reaches the card edge and has rounded corners.
      <View style={{ alignItems: 'center' }}>
        <View style={{ width: containerWidth, height: bannerHeight, borderRadius: 12, overflow: 'hidden', backgroundColor: theme.colors.surface }}>
          {mediaLoading && <ActivityIndicator style={{ position: 'absolute', alignSelf: 'center', zIndex: 2 }} />}
          <FlatList
            ref={listRef}
            // For continuous looping, duplicate ends: [last, ...items, first]
            data={finalUris.length > 1 ? [finalUris[finalUris.length - 1], ...finalUris, finalUris[0]] : finalUris}
            horizontal
            pagingEnabled={true}
            // Ensure FlatList initially renders centered on the first real item
            initialScrollIndex={finalUris.length > 1 ? 1 : 0}
            // Provide getItemLayout so scrollToIndex/initialScrollIndex works reliably
            getItemLayout={(_, index) => ({ length: itemWidth, offset: itemWidth * index, index })}
            // snap to full slide + separator so slides and gaps align
            snapToInterval={itemWidth}
            snapToAlignment="center"
            decelerationRate="fast"
            showsHorizontalScrollIndicator={false}
            keyExtractor={(_, i) => String(i)}
            renderItem={({ item, index }) => renderMediaItem({ item, index })}
            onViewableItemsChanged={onViewableItemsChanged}
            viewabilityConfig={{ itemVisiblePercentThreshold: 50 }}
            // no lateral padding: pages are full-width; we simulate loop via duplicated ends
            contentContainerStyle={{ paddingHorizontal: 0 }}
            style={{ width: containerWidth, height: bannerHeight }}
            onScrollBeginDrag={() => { showIndicators(); }}
            onScrollEndDrag={() => { hideIndicators(600); }}
            onMomentumScrollEnd={(e) => {
              try {
                const offset = e.nativeEvent.contentOffset.x || 0;
                const page = Math.round(offset / itemWidth);
                const n = finalUris.length;
                // data array length when duplicated = n + 2
                if (n > 1) {
                  if (page === 0) {
                    // jumped to duplicate last -> reset to real last
                    const target = n;
                    listRef.current && (listRef.current as any).scrollToOffset({ offset: target * itemWidth, animated: false });
                    setActiveIndex(n - 1);
                    return;
                  }
                  if (page === n + 1) {
                    // jumped to duplicate first -> reset to real first
                    const target = 1;
                    listRef.current && (listRef.current as any).scrollToOffset({ offset: target * itemWidth, animated: false });
                    setActiveIndex(0);
                    return;
                  }
                  // normal case: page corresponds to index in duplicated array
                  setActiveIndex((page - 1 + n) % n);
                }
              } catch (err) {
                if (__DEV__) console.warn('Flyer momentum handler error', err);
              } finally {
                hideIndicators(600);
              }
            }}
          />

          {/* pill indicator (three dots) animated on swipe */}
          {finalUris.length > 1 && (
            <Animated.View style={{ position: 'absolute', top: 8, right: 10, backgroundColor: 'rgba(0,0,0,0.45)', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 14, opacity: badgeOpacity }}>
              <Text style={{ color: '#fff', fontSize: 12, fontWeight: '700' }}>{`${(activeIndex || 0) + 1} / ${finalUris.length}`}</Text>
            </Animated.View>
          )}
        </View>

        {/* pagination dots below the card */}
        {finalUris.length > 1 && (
          <View style={{ flexDirection: 'row', justifyContent: 'center', marginTop: 6 }}>
            {finalUris.map((_, i) => (
              <View key={i} style={{ width: 8, height: 8, borderRadius: 4, marginHorizontal: 4, backgroundColor: i === activeIndex ? '#333' : '#ccc' }} />
            ))}
          </View>
        )}
      </View>
    );
  }

  // If not in compact media mode, fall through to full content rendering.

  return (
    <View style={[styles.container, isMedia ? { flexDirection: 'column', alignItems: 'stretch' } : undefined]}>
      <View style={styles.content}>
        <Text style={styles.title}>{f.title || 'Announcement'}</Text>
        {f.body ? <Text style={styles.body}>{f.body}</Text> : null}

  {/* Hosted/provider links (YouTube, etc.) - show a neutral placeholder (no provider thumbnail) in full view */}
  {finalUris[0] && isHostedEmbedUri(finalUris[0]) ? (
    (() => {
      const uri0 = finalUris[0]!;
      const providerThumb0 = providerThumbs[uri0];
      const ytId0 = extractYouTubeId(uri0);
      const thumb0 = providerThumb0 || (ytId0 ? youTubeThumbnailForId(ytId0) : null);
      if (thumb0) {
        return (
          <View style={{ marginTop: 8, alignItems: 'center', justifyContent: 'center', width: '100%' }}>
            <View style={{ width: '100%', height: bannerHeight, alignItems: 'center', justifyContent: 'center', borderRadius: 8, overflow: 'hidden' }}>
              <Image
                source={{ uri: thumb0 }}
                style={{ width: '100%', height: bannerHeight }}
                resizeMode="cover"
                onError={() => setThumbErrorIds(prev => ({ ...prev, [thumb0]: true }))}
              />
              <View style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' }} pointerEvents="none">
                <View style={{ backgroundColor: 'rgba(0,0,0,0.45)', padding: 10, borderRadius: 40 }}>
                  <Text style={{ color: '#fff', fontWeight: '800', fontSize: 16 }}>▶</Text>
                </View>
              </View>
            </View>
          </View>
        );
      }
      return (
        <View style={{ marginTop: 8, alignItems: 'center', justifyContent: 'center', width: '100%' }}>
          <View style={{ width: '100%', height: bannerHeight, alignItems: 'center', justifyContent: 'center', backgroundColor: '#efefef', borderRadius: 8 }}>
            <View style={{ alignItems: 'center' }} pointerEvents="none">
              <View style={{ backgroundColor: 'rgba(0,0,0,0.45)', padding: 10, borderRadius: 40, marginBottom: 8 }}>
                <Text style={{ color: '#fff', fontWeight: '800', fontSize: 16 }}>▶</Text>
              </View>
              <Text style={{ color: '#333' }}>Hosted content</Text>
            </View>
          </View>
        </View>
      );
    })()
  ) : finalUris[0] && (isImageUri(finalUris[0]) || f.type === 'image') ? (
          <View style={{ marginTop: 8, alignItems: 'center', justifyContent: 'center', width: '100%' }}>
            {mediaLoading && <ActivityIndicator style={{ position: 'absolute', alignSelf: 'center', zIndex: 2 }} />}
            <Image
              source={{ uri: finalUris[0]! }}
              style={{ width: '100%', height: bannerHeight, borderRadius: 8 }}
              resizeMode="cover"
              onLoadStart={() => { setMediaLoading(true); setMediaError(null); }}
              onLoadEnd={() => setMediaLoading(false)}
              onError={(e) => {
                try { console.warn('Flyer.image onError', e.nativeEvent || e); } catch (err) {}
                setMediaLoading(false);
                setMediaError(String((e && (((e as any).nativeEvent?.error) || (e as any).message)) || 'Image load error'));
              }}
            />
            {__DEV__ && mediaError ? (
              <TouchableOpacity onPress={() => openMediaForIndex(0)} style={{ marginTop: 6 }}>
                <Text style={{ fontSize: 12, color: '#c00' }}>Failed to load image — open URL</Text>
              </TouchableOpacity>
            ) : null}
          </View>
  ) : null}

        {/* If the primary URL is from a hosted/embed provider (YouTube, TikTok, etc.)
            don't try to play it with the native video player — open externally. */}
        {finalUris[0] && ( !isHostedEmbedUri(finalUris[0]) && (isVideoUri(finalUris[0]) || f.type === 'video')) ? (
          <View style={{ marginTop: 8, alignItems: 'center', justifyContent: 'center' }}>
            {mediaLoading && <ActivityIndicator style={{ position: 'absolute', alignSelf: 'center', zIndex: 2 }} />}
            {(() => {
              let VideoComp: any = null;
              try {
                const vmod = require('expo-video');
                VideoComp = vmod && (vmod.Video || vmod.default || vmod);
              } catch (e1) {
                try {
                  const vmod2 = require('expo-av');
                  VideoComp = vmod2 && (vmod2.Video || vmod2.default || vmod2);
                } catch (e2) { VideoComp = null; }
              }
              if (!VideoComp) {
                return (
                  <TouchableOpacity onPress={() => openMediaForIndex(0)} style={[styles.cta, { marginTop: 8 }]}> 
                    <Text style={styles.ctaText}>Open Video</Text>
                  </TouchableOpacity>
                );
              }
              return (
                <VideoComp
                  source={{ uri: finalUris[0]! }}
                  useNativeControls
                  resizeMode="cover"
                  style={{ width: '100%', height: bannerHeight, borderRadius: 8 }}
                  onLoadStart={() => { setMediaLoading(true); setMediaError(null); }}
                  onLoad={() => setMediaLoading(false)}
                  onError={(e: any) => { try { console.warn('Flyer.video onError', e); } catch (err) {} setMediaLoading(false); setMediaError('Video load error'); }}
                />
              );
            })()}
          </View>
        ) : null}
      </View>

      {f.type !== 'image' && f.type !== 'video' ? (
        <TouchableOpacity onPress={handlePress} style={styles.cta} activeOpacity={0.8}>
          <Text style={styles.ctaText}>{f.ctaLabel || 'Learn more'}</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
};

const createStyles = (t: any) => StyleSheet.create({
  container: { backgroundColor: t.colors.surface, padding: 12, borderRadius: 12, marginTop: 12, marginBottom: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderWidth: 1, borderColor: t.colors.border || '#eee' },
  content: { flex: 1, paddingRight: 8 },
  title: { fontSize: 14, fontWeight: '800', color: t.colors.text, marginBottom: 4 },
  body: { fontSize: 12, color: t.colors.muted || '#666' },
  cta: { backgroundColor: t.colors.primary, paddingVertical: 8, paddingHorizontal: 12, borderRadius: 8 },
  ctaText: { color: t.colors.white || '#fff', fontWeight: '700' },
});

export default Flyer;