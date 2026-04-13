import React, {
  useEffect,
  useState,
  useCallback,
  useRef,
  useMemo,
} from "react";
import {
  View,
  Text,
  ScrollView,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  StyleSheet,
  Linking,
  Alert,
  Dimensions,
} from "react-native";
import { Ionicons, MaterialIcons } from "@expo/vector-icons";
// @ts-ignore: optional dependency in some environments where @react-navigation/native types are not installed
import {
  useNavigation,
  useRoute,
  useFocusEffect,
} from "@react-navigation/native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import authStorage from "../utils/authStorage";

import SkeletonBox from "../components/SkeletonBox";
import ActionButton from "../components/ActionButton";
import ServicePickerModal from "../components/ServicePickerModal";
import TransactionItem from "../components/TransactionItem";
import ConfirmModal from "../components/ConfirmModal";
import {
  getWalletData,
  getConfirmations,
  getTransactions,
  getProfile,
  getPreSubmissionsCount,
  getNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  getTransactionReceipt,
  getConfirmationReceipt,
  createTicket,
} from "../api/client";
import { showToast } from "../utils/toast";
import {
  getLastLoadedAt,
  setLastLoadedAt,
  getCachedTransactions,
  setCachedTransactions,
} from "../utils/transactionCache";
import {
  set as simpleCacheSet,
  setLastLoadedAt as simpleCacheSetLastLoadedAt,
  setFetching as simpleCacheSetFetching,
  isFetching as simpleCacheIsFetching,
  getLastLoadedAt as simpleCacheGetLastLoadedAt,
} from "../utils/simpleCache";
// Modal removed: notifications now live in a dedicated Notifications screen
import staticTheme from "../styles/theme";
import { useTheme } from "../theme/index";
import Flyer from "../components/Flyer";
import RateTicker from "../components/RateTicker";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import NavBar from "../components/NavBar";
import BalanceSparkline from "../components/BalanceSparkline";
import Constants from "expo-constants";

// Prefer an explicit configured API URL. Avoid falling back to a production
// host by default so local/dev builds don't accidentally hammer the remote
// Heroku instance when no apiUrl is provided in expo config.
const API_URL = (Constants.expoConfig?.extra?.apiUrl || "").replace(/\/+$/, "");

const DashboardScreen = () => {
  // useTheme must be called at the top level (Rules of Hooks — not inside callbacks/try-catch).
  const themeCtx = useTheme();
  // New ThemeProvider exposes the merged theme at top-level, fall back to staticTheme
  const theme = (themeCtx as any) || staticTheme;
  // runtime styles bound to theme
  const styles = useStyles(theme);
  const navigation: any = useNavigation();
  const route = useRoute();

  const [refreshing, setRefreshing] = useState(false);
  const [kycModalVisible, setKycModalVisible] = useState(false);
  const [walletBalance, setWalletBalance] = useState<number | null>(null);
  const [balanceVisible, setBalanceVisible] = useState<boolean>(true);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [countdowns, setCountdowns] = useState<Record<string, string>>({});
  const [alerting, setAlerting] = useState<Record<string, boolean>>({});
  const [alerted, setAlerted] = useState<Record<string, boolean>>({});
  const [alertedMap, setAlertedMap] = useState<Record<string, number>>({});

  // hydrate alerted txns from AsyncStorage so alert state is shared across screens
  useEffect(() => {
    (async () => {
      try {
        // Support both legacy array key and the newer map with timestamps
        const rawMap = await AsyncStorage.getItem('alertedTxnsMap');
        if (rawMap) {
          const map = JSON.parse(rawMap || '{}') || {};
          const keys = Object.keys(map || {});
          if (keys.length) {
            setAlerted(Object.fromEntries(keys.map((id: string) => [id, true])));
            setAlertedMap(map as Record<string, number>);
          }
        } else {
          const raw = await AsyncStorage.getItem('alertedTxns');
          if (raw) {
            const arr = JSON.parse(raw);
            if (Array.isArray(arr)) setAlerted(Object.fromEntries(arr.map((id: string) => [id, true])));
          }
        }
      } catch (e) {
        // ignore
      }
    })();
  }, []);
  const [selectedService, setSelectedService] = useState<string>("");
  const [selectedServiceLabel, setSelectedServiceLabel] = useState<string>("");
  const [showModal, setShowModal] = useState(false);
  // track current user profile so UI can reference profile?.username safely
  const [profile, setProfile] = useState<any | null>(null);
  const [loadingProfile, setLoadingProfile] = useState<boolean>(true);
  const [loadingWallet, setLoadingWallet] = useState<boolean>(true);
  const [loadingTxns, setLoadingTxns] = useState<boolean>(() => {
    try {
      const cached = getCachedTransactions();
      return !(cached && cached.length);
    } catch (e) {
      return true;
    }
  });

  const countdownInterval = useRef<number | null>(null);
  const [activeTab, setActiveTab] = useState<
    "Home" | "History" | "Profile" | "Help"
  >("Home");
  const [preCount, setPreCount] = useState<number>(0);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [unreadCount, setUnreadCount] = useState<number>(0);
  // undoVisible removed; use in-app toast with action for Undo

  const insets = useSafeAreaInsets();

  // Format badge count for display
  const formatBadgeCount = (n: number) => {
    if (!n || n <= 0) return "";
    return String(n);
  };

  const handleAlertAdmin = async (txn: any) => {
    try {
      if (!txn || !txn._id) return;
      // rate-limit: one notify per 10 minutes per transaction
      try {
        const rawMap = await AsyncStorage.getItem('alertedTxnsMap');
        const map = rawMap ? JSON.parse(rawMap) : {};
        const lastTs = map && map[txn._id] ? Number(map[txn._id]) : 0;
        const now = Date.now();
        const cooldown = 10 * 60 * 1000; // 10 minutes
        if (lastTs && (now - lastTs) < cooldown) {
          const remaining = Math.ceil((cooldown - (now - lastTs)) / 60000);
          showToast(`You can alert again in ${remaining} minute(s)`);
          return;
        }
      } catch (e) {
        // ignore storage read errors and continue
      }

      // allow re-alerting after cooldown; the per-transaction timestamp enforces rate-limiting

      setAlerting((s) => ({ ...(s || {}), [txn._id]: true }));

      const transactionId = txn.transactionId || txn._id || 'N/A';
      const amount = txn.amount !== undefined && txn.amount !== null ? `₦${Number(txn.amount).toLocaleString()}` : 'N/A';
      const service = txn.serviceName || txn.serviceTag || 'N/A';
      const created = new Date(txn.createdAt || txn.date || Date.now()).toLocaleString();

      const subject = `Urgent: Attention required for transaction ${transactionId}`;
      const message = `User: ${profile?.username || profile?.email || 'Unknown'}\nTransaction: ${transactionId}\nType: ${txn.type || 'N/A'}\nService: ${service}\nAmount: ${amount}\nStatus: ${txn.status || 'N/A'}\nDate: ${created}\n\nPlease attend to this confirmation; user has requested a reminder via the app.`;

      // createTicket will POST to /api/tickets - backend should route to admin/telegram if configured
      await createTicket({ subject, message, type: 'admin-alert' } as any);
      setAlerted((s) => ({ ...(s || {}), [txn._id]: true }));
      // persist alerted id/timestamp so other screens (History) can show notified state
      try {
        // update map with timestamp
        const rawMap = await AsyncStorage.getItem('alertedTxnsMap');
        const map = rawMap ? JSON.parse(rawMap) : {};
        map[txn._id] = Date.now();
        await AsyncStorage.setItem('alertedTxnsMap', JSON.stringify(map));
        setAlertedMap((m) => ({ ...(m || {}), [txn._id]: map[txn._id] }));
        // also maintain legacy array for backwards compatibility
        try {
          const raw = await AsyncStorage.getItem('alertedTxns');
          const arr = raw ? JSON.parse(raw) : [];
          if (!Array.isArray(arr)) (arr as any[]).length = 0;
          if (!arr.includes(txn._id)) {
            arr.push(txn._id);
            await AsyncStorage.setItem('alertedTxns', JSON.stringify(arr));
          }
        } catch (_) {}
      } catch (e) {
        // ignore storage errors
      }
      showToast('Admin alerted. Support team notified.');
    } catch (e) {
      console.warn('Alert admin failed', e);
      showToast('Failed to alert admin. Please try again later.');
    } finally {
      setAlerting((s) => ({ ...(s || {}), [txn._id]: false }));
    }
  };

  const normalizeTxns = (
    walletTxns: any[] = [],
    txnApi: any[] = [],
    confirmations: any[] = [],
    userId?: string,
  ) => {
    const normalize = (t: any, fallbackType?: string) => ({
      ...t,
      rawType: t.type,
      type: t.type || fallbackType || "Unknown",
      time: new Date(t.createdAt || t.date || Date.now()).getTime(),
    });

    const fundings = (walletTxns || [])
      .filter((t: any) => t.type === "Funding")
      .map((t: any) => normalize(t, "Funding"));

    const withdrawals = (txnApi || [])
      .filter(
        (t: any) =>
          (t.type || "").toString().toLowerCase().includes("withdrawal") ||
          t.type === "Withdrawal",
      )
      .map((t: any) => normalize(t, "Withdrawal"));

    const transfers = (txnApi || [])
      .filter((t: any) =>
        (t.type || "").toString().toLowerCase().includes("transfer"),
      )
      .map((t: any) => {
        const senderIdStr =
          typeof t.senderId === "object"
            ? t.senderId?._id?.toString()
            : t.senderId?.toString?.();
        const isSender = !!(userId && senderIdStr === userId?.toString());
        return {
          ...normalize(t, "Transfer"),
          type: isSender ? "Sent Transfer" : "Received Transfer",
        };
      });

    const confs = (confirmations || []).map((c: any) => ({
      ...normalize(c, "Trade Confirmation"),
      type: "Trade Confirmation",
      serviceName: c.serviceId?.name || c.serviceName || "N/A",
      serviceTag: c.tag || c.serviceTag || undefined,
    }));

    return [...fundings, ...withdrawals, ...transfers, ...confs].sort(
      (a, b) => b.time - a.time,
    );
  };

  const loadData = async () => {
    // Mark load start so focus checks won't trigger a duplicate fetch while this one runs.
    try {
      setLastLoadedAt(Date.now());
    } catch (e) {
      /* ignore */
    }
    try {
      simpleCacheSetLastLoadedAt("transactions", Date.now());
    } catch (e) {
      /* ignore */
    }
    try {
      /* mark in-flight on simpleCache to prevent concurrent loads */ simpleCacheSetFetching(
        "transactions",
        true,
      );
    } catch (e) {
      /* ignore */
    }
    // In-flight guard to prevent overlapping loads
    const isFetchingRef: any = (loadData as any).__isFetchingRef || {
      current: false,
    };
    if (isFetchingRef && isFetchingRef.current) return;
    if (!(loadData as any).__isFetchingRef)
      (loadData as any).__isFetchingRef = isFetchingRef;
    isFetchingRef.current = true;

    // If we already have cached transactions (in-memory), populate them immediately
    const cachedBefore = getCachedTransactions();
    if (cachedBefore && cachedBefore.length) {
      setTransactions(cachedBefore);
      setLoadingTxns(false);
    }
    console.debug(
      "[Dashboard] loadData start - cachedBefore length =",
      cachedBefore ? cachedBefore.length : 0,
    );

    try {
      const token = await authStorage.getToken();

      // 1) Profile, then 2) Transactions/Confirmations (dependent on profile)
      getProfile()
        .then((profileRes) => {
          try {
            setProfile(profileRes || null);
            console.log("[Dashboard] Profile loaded, id =", profileRes?._id);

            // Now fetch transactions since we have the user ID
            Promise.all([
              getTransactions().catch(() => ({ transactions: [] })),
              getConfirmations().catch(() => ({ confirmations: [] })),
            ])
              .then(([txRes, confRes]) => {
                try {
                  const walletTxns: any[] = [];
                  const apiTxns =
                    txRes?.transactions || txRes?.data?.transactions || [];
                  const confs =
                    confRes?.confirmations ||
                    confRes?.data?.confirmations ||
                    [];
                  const userId = profileRes?._id;
                  console.log(
                    "[Dashboard] Normalizing transactions with userId =",
                    userId,
                  );
                  const combined = normalizeTxns(
                    walletTxns,
                    apiTxns,
                    confs,
                    userId,
                  ).slice(0, 20);
                  setTransactions(combined);
                  try {
                    setCachedTransactions(combined);
                    setLastLoadedAt(Date.now());
                    simpleCacheSet("transactions", combined);
                    simpleCacheSetLastLoadedAt("transactions", Date.now());
                  } catch (_) {}
                  console.log(
                    "[Dashboard] txns+confs loaded, count =",
                    combined.length,
                  );
                } catch (e) {
                  console.warn("Error processing txns/conf", e);
                }
              })
              .catch((e) => {
                console.warn("Transactions/Confirmations load failed", e);
              })
              .finally(() => {
                setLoadingTxns(false);
                try {
                  simpleCacheSetFetching("transactions", false);
                } catch (_) {}
              });
          } catch (e) {
            /* ignore */
          }
        })
        .catch(() => {
          /* ignore profile fetch failures */
        })
        .finally(() => {
          setLoadingProfile(false);
        });

      // 3) Wallet (balance can load independently)
      getWalletData()
        .then((walletRes) => {
          try {
            const walletBalanceVal =
              walletRes?.balance ?? walletRes?.data?.balance ?? 0;
            setWalletBalance(walletBalanceVal);
          } catch (e) {
            /* ignore */
          }
        })
        .catch(() => {
          /* ignore wallet fetch */
        })
        .finally(() => {
          setLoadingWallet(false);
        });
    } catch (err) {
      console.warn("Dashboard load error", err);
      setLoadingProfile(false);
      setLoadingWallet(false);
      setLoadingTxns(false);
    } finally {
      setRefreshing(false);
      try {
        isFetchingRef.current = false;
      } catch (e) {
        /* ignore */
      }
    }
  };

  useEffect(() => {
    if (countdownInterval.current)
      clearInterval(countdownInterval.current as any);
    countdownInterval.current = setInterval(() => {
      setCountdowns((prev) => {
        const next: Record<string, string> = {};
        transactions.forEach((txn) => {
          if (
            txn.type === "Trade Confirmation" &&
            txn.status?.toLowerCase() === "pending" &&
            txn.createdAt
          ) {
            const created = new Date(txn.createdAt);
            const now = new Date();
            // 30 minutes deadline for admin to attend to confirmations
            const totalMinutes = 30;
            const elapsed = Math.floor(
              (now.getTime() - created.getTime()) / 60000,
            );
            const remaining = totalMinutes - elapsed;
            if (remaining > 0) {
              const hrs = Math.floor(remaining / 60);
              const mins = remaining % 60;
              next[txn._id] = `${hrs > 0 ? `${hrs}h ` : ""}${mins}m left`;
            } else {
              // confirmation expired — if user alerted, show 10-minute cooldown remaining
              const alertedTs = alertedMap && alertedMap[txn._id] ? Number(alertedMap[txn._id]) : 0;
              const cooldownMs = 10 * 60 * 1000;
              if (alertedTs) {
                const nowTs = Date.now();
                const diff = cooldownMs - (nowTs - alertedTs);
                if (diff > 0) {
                  next[txn._id] = `${Math.ceil(diff / 60000)}m left`;
                } else {
                  next[txn._id] = 'expired';
                }
              } else {
                next[txn._id] = 'expired';
              }
            }
          }
        });
        return next;
      });
  }, 1000) as unknown as number;

    return () => {
      if (countdownInterval.current)
        clearInterval(countdownInterval.current as any);
    };
  }, [transactions, alertedMap]);

  useEffect(() => {
    (async () => {
      // read saved defaultService in hydrateSaved below (avoid setting id immediately so we can resolve label first)

      try {
        const savedVis = await AsyncStorage.getItem("balanceVisible");
        if (savedVis !== null) {
          setBalanceVisible(savedVis === "true");
        }
      } catch (e) {
        // ignore
      }

      // Pre-populate from cache so returning users see previous transactions instantly
      try {
        const cached = getCachedTransactions();
        if (cached && cached.length) setTransactions(cached);
      } catch (e) {
        // ignore cache read errors
      }

      // If a saved default service id exists, try to fetch its human-friendly name/label
      const hydrateSaved = async () => {
        try {
          const saved = await AsyncStorage.getItem("defaultService");
          if (!saved) {
            loadData();
            return;
          }
          // attempt to fetch by id first
          try {
            const res = await fetch(
              `${API_URL}/api/services/${encodeURIComponent(saved)}`,
            );
            if (res.ok) {
              const s = await res.json();
              setSelectedServiceLabel(
                (s.label || s.name || "") + (s.isNew ? " (NEW)" : ""),
              );
              // persist internal service identifier so other actions can use it
              setSelectedService(saved);
            } else {
              // fallback: list and search
              const listRes = await fetch(`${API_URL}/api/services`);
              if (listRes.ok) {
                const arr = await listRes.json();
                const found = arr.find(
                  (x: any) => x._id === saved || x.name === saved,
                );
                if (found)
                  setSelectedServiceLabel(
                    (found.label || found.name || "") +
                      (found.isNew ? " (NEW)" : ""),
                  );
                if (found) setSelectedService(found.name || found._id || saved);
              }
            }
          } catch (e) {
            // ignore lookup errors
          }
        } finally {
          loadData();
        }
      };

      hydrateSaved();
    })();
  }, []);

  useFocusEffect(
    useCallback(() => {
      // Only reload if we haven't loaded recently (TTL = 5 minutes)
      const TTL = 5 * 60 * 1000;
      const lastTxnCache = getLastLoadedAt();
      const lastSimple = simpleCacheGetLastLoadedAt("transactions");
      const last =
        Math.max(Number(lastTxnCache || 0), Number(lastSimple || 0)) || null;
      const inflight = simpleCacheIsFetching("transactions");
      console.debug(
        "[Dashboard] onFocus - lastLoadedAt(transactionCache) =",
        lastTxnCache,
        "lastLoadedAt(simpleCache) =",
        lastSimple,
        "combined =",
        last,
        "now - last =",
        last ? Date.now() - last : "n/a",
        "inflight =",
        inflight,
      );
      // If another screen is already fetching transactions, skip triggering another load.
      if (inflight) {
        console.debug(
          "[Dashboard] onFocus -> skipping loadData() (fetch in-flight)",
        );
      } else if (!last || Date.now() - last > TTL) {
        console.debug("[Dashboard] onFocus -> calling loadData()");
        loadData();
      } else {
        console.debug(
          "[Dashboard] onFocus -> skipping loadData() (within TTL)",
        );
      }
      // update pre-submissions count when screen focused
      // Fetch pre-submission count first so header shows tag badge ASAP
      (async () => {
        try {
          const c = await getPreSubmissionsCount();
          setPreCount(c);
          // immediately update header to show preCount without waiting for notifications
          try {
            navigation.setOptions({
              headerRight: () => (
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    marginRight: 8,
                  }}
                >
                  <TouchableOpacity
                    onPress={() => navigation.navigate("Notifications" as any)}
                    style={{ marginRight: 12 }}
                  >
                    <View style={{ position: "relative" }}>
                      <Ionicons
                        name="notifications-outline"
                        size={24}
                        color={theme.colors.primary}
                      />
                      {unreadCount > 0 && (
                        <View
                          style={[
                            styles.badge,
                            { backgroundColor: theme.colors.error },
                          ]}
                        >
                          <Text style={styles.badgeText}>
                            {formatBadgeCount(unreadCount)}
                          </Text>
                        </View>
                      )}
                    </View>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() =>
                      navigation.navigate("MyPreSubmissions" as any)
                    }
                  >
                    <View style={{ position: "relative" }}>
                      <Ionicons
                        name="pricetag-outline"
                        size={24}
                        color={theme.colors.primary}
                      />
                      {c > 0 && (
                        <View
                          style={[
                            styles.badge,
                            { backgroundColor: theme.colors.error },
                          ]}
                        >
                          <Text style={styles.badgeText}>
                            {formatBadgeCount(c)}
                          </Text>
                        </View>
                      )}
                    </View>
                  </TouchableOpacity>
                </View>
              ),
            });
          } catch (e) {
            // ignore
          }
        } catch (err) {
          // ignore header update errors
        }
      })();

      // fetch notifications and unread count
      (async () => {
        try {
          const res = await getNotifications();
          const list = res.notifications || res.data || [];
          setNotifications(list || []);
          const ucount = Array.isArray(list)
            ? list.filter((n: any) => !n.read).length
            : 0;
          setUnreadCount(ucount);
          // Immediately update header so badge shows without waiting for effect
          try {
            navigation.setOptions({
              headerRight: () => (
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    marginRight: 8,
                  }}
                >
                  <TouchableOpacity
                    onPress={() => navigation.navigate("Notifications" as any)}
                    style={{ marginRight: 12 }}
                  >
                    <View style={{ position: "relative" }}>
                      <Ionicons
                        name="notifications-outline"
                        size={24}
                        color={theme.colors.primary}
                      />
                      {ucount > 0 && (
                        <View style={styles.badge}>
                          <Text style={styles.badgeText}>
                            {ucount > 20 ? "20+" : ucount}
                          </Text>
                        </View>
                      )}
                    </View>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() =>
                      navigation.navigate("MyPreSubmissions" as any)
                    }
                  >
                    <View style={{ position: "relative" }}>
                      <Ionicons
                        name="pricetag-outline"
                        size={24}
                        color={theme.colors.primary}
                      />
                      {preCount > 0 && (
                        <View
                          style={[
                            styles.badge,
                            { backgroundColor: theme.colors.error },
                          ]}
                        >
                          <Text style={styles.badgeText}>
                            {formatBadgeCount(preCount)}
                          </Text>
                        </View>
                      )}
                    </View>
                  </TouchableOpacity>
                </View>
              ),
            });
          } catch (e) {
            // ignore navigation setOptions errors
          }
        } catch (e) {
          // ignore
        }
      })();
    }, []),
  );

  // keep headerRight in sync with unreadCount and preCount (avoid stale closure capture)
  useEffect(() => {
    navigation.setOptions({
      // Keep the Dashboard title in the native header and remove any back arrow
      headerTitle: "Dashboard",
      headerLeft: () => null,
      headerRight: () => (
        <View
          style={{ flexDirection: "row", alignItems: "center", marginRight: 8 }}
        >
          <TouchableOpacity
            onPress={() => navigation.navigate("Notifications" as any)}
            style={{ marginRight: 12 }}
          >
            <View style={{ position: "relative" }}>
              <Ionicons
                name="notifications-outline"
                size={24}
                color={theme.colors.primary}
              />
              {unreadCount > 0 && (
                <View style={[styles.badge, { backgroundColor: "#FF3B30" }]}>
                  <Text style={styles.badgeText}>
                    {formatBadgeCount(unreadCount)}
                  </Text>
                </View>
              )}
            </View>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => navigation.navigate("MyPreSubmissions" as any)}
          >
            <View style={{ position: "relative" }}>
              <Ionicons
                name="pricetag-outline"
                size={24}
                color={theme.colors.primary}
              />
              {preCount > 0 && (
                <View style={[styles.badge, { backgroundColor: "#FF3B30" }]}>
                  <Text style={styles.badgeText}>
                    {formatBadgeCount(preCount)}
                  </Text>
                </View>
              )}
            </View>
          </TouchableOpacity>
        </View>
      ),
    });
  }, [navigation, unreadCount, preCount]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    return loadData();
  }, []);

  const handleViewReceipt = async (txn: any) => {
    // Copy of HistoryScreen's sanitize/build logic to ensure Dashboard produces the same
    // serializable receipt shape (no React elements/functions) and includes a transactionRef
    const sanitizeReceipt = (r: any) => {
      const isReactElement = (v: any) =>
        v && typeof v === "object" && v.$$typeof !== undefined;
      const cloned: any = { ...r };
      cloned.fields = (r.fields || []).map((f: any) => {
        let value = f.value;
        if (isReactElement(value)) {
          value = "[attachment]";
        } else if (Array.isArray(value)) {
          value = value
            .map((v2: any) => {
              if (
                typeof v2 === "string" ||
                typeof v2 === "number" ||
                typeof v2 === "boolean"
              )
                return v2;
              if (v2 && typeof v2 === "object") {
                if (v2.uri) return v2.uri;
                if (v2.props && typeof v2.props.children === "string")
                  return v2.props.children;
                try {
                  return JSON.stringify(v2);
                } catch {
                  return String(v2);
                }
              }
              return String(v2);
            })
            .filter(Boolean);
        }
        return { ...f, value };
      });
      if (cloned.transactionRef)
        cloned.transactionRef = String(cloned.transactionRef);
      return cloned;
    };

    // Fetch current user profile so we can attach username/email to receipts built client-side
    const profile = await getProfile().catch(() => null);

    // If a pre-built receipt exists on the txn, use it (sanitized)
    if (txn.receipt) {
      const sanitized = sanitizeReceipt(txn.receipt);
      sanitized.header = sanitized.header || {};
      if (profile?.username) sanitized.header.username = profile.username;
      if (profile?.email) sanitized.header.email = profile.email;
      return navigation.navigate(
        "Receipt" as any,
        { receiptData: sanitized } as any,
      );
    }

    const receiptData: any = { title: "Transaction Receipt", fields: [] };
    // Ensure top-level type is present so ReceiptScreen can use it when fields omit 'Type'
    receiptData.type = txn.type || receiptData.type;
    const transactionId = txn.transactionId || txn._id || "N/A";
    const typeNorm = (txn.type || "").toString().toLowerCase();

    // Attach transactionRef so ReceiptScreen can async-enrich for parity with History
    if (txn.transactionRef)
      receiptData.transactionRef = String(txn.transactionRef);
    else if (txn._id) receiptData.transactionRef = String(txn._id);
    else if (txn.transactionId)
      receiptData.transactionRef = String(txn.transactionId);
    if (txn.createdAt || txn.date) receiptData.date = txn.createdAt || txn.date;

    if (typeNorm === "withdrawal" || typeNorm.includes("withdrawal")) {
      const { formatSignedAmount } = require("../utils/formatAmount");
      receiptData.fields.push(
        { label: "Type", value: txn.type },
        { label: "Amount", value: formatSignedAmount(txn.amount, txn.type) },
        { label: "Transaction ID", value: transactionId, copyable: true },
        {
          label: "Date",
          value:
            new Date(
              txn.createdAt || txn.date || Date.now(),
            ).toLocaleString() || "N/A",
        },
        { label: "Status", value: txn.status || "N/A" },
      );
      // include fee and total debited if available on txn
      if (txn.fee !== undefined && txn.fee !== null && Number(txn.fee) !== 0) {
        receiptData.fields.push({
          label: "Fee",
          value: `₦${Number(txn.fee).toLocaleString()}`,
        });
        try {
          const total = Number(txn.amount || 0) + Number(txn.fee || 0);
          receiptData.fields.push({
            label: "Total Debited",
            value: `₦${total.toLocaleString()}`,
          });
        } catch (e) {
          /* ignore */
        }
      }
      const bankLabel =
        txn.bankMeta ||
        (txn.bank &&
          (txn.bank.bankName
            ? `${txn.bank.bankName} - ${txn.bank.accountNumber}`
            : JSON.stringify(txn.bank))) ||
        txn.bankId ||
        null;
      if (bankLabel)
        receiptData.fields.push({ label: "Bank", value: bankLabel });
      const acctName =
        txn.accountName ||
        txn.accountHolderName ||
        (txn.bank && (txn.bank.accountName || txn.bank.accountHolderName));
      if (acctName)
        receiptData.fields.push({ label: "Account Name", value: acctName });
      if (txn.note) receiptData.fields.push({ label: "Note", value: txn.note });
      // include provider info if available
      if (txn.provider && txn.provider.reference)
        receiptData.fields.push({
          label: "Reference",
          value: txn.provider.reference,
        });
      // include any admin-uploaded receipt files
      if (
        txn.adminReceipts &&
        Array.isArray(txn.adminReceipts) &&
        txn.adminReceipts.length
      ) {
        try {
          const extras: any =
            (Constants.expoConfig && (Constants.expoConfig as any).extra) || {};
          const configured =
            extras.apiUrl || extras.API_URL || extras.apiUrl || "";
          const base = String(configured).replace(/\/$/, "");
          const mapped = txn.adminReceipts
            .map((p: string) => {
              if (!p) return p;
              if (/^https?:\/\//i.test(p)) return p;
              if (p.startsWith("/")) return `${base}${p}`;
              return `${base}/${p}`;
            })
            .filter(Boolean);
          if (mapped.length)
            receiptData.fields.push({ label: "Receipt File", value: mapped });
        } catch (e) {
          receiptData.fields.push({
            label: "Receipt File",
            value: txn.adminReceipts,
          });
        }
      }
      if (txn.status && txn.status.toLowerCase() === "rejected")
        receiptData.fields.push({
          label: "Rejection Reason",
          value: txn.rejectionReason || "No reason provided",
        });
      // attach profile header
      receiptData.header = receiptData.header || {};
      if (profile?.username) receiptData.header.username = profile.username;
      if (profile?.email) receiptData.header.email = profile.email;
      return navigation.navigate("Receipt" as any, { receiptData } as any);
    }

    if (txn.type === "Sent Transfer" || txn.type === "Received Transfer") {
      const isSent = txn.type === "Sent Transfer";
      receiptData.fields.push(
        { label: "Type", value: txn.type },
        {
          label: "Amount",
          value: require("../utils/formatAmount").formatSignedAmount(
            txn.amount,
            txn.type,
          ),
        },
        { label: "Transaction ID", value: transactionId, copyable: true },
        {
          label: "Date",
          value:
            new Date(
              txn.createdAt || txn.date || Date.now(),
            ).toLocaleString() || "N/A",
        },
        { label: "Status", value: txn.status || "N/A" },
        {
          label: isSent ? "Sent To" : "Received From",
          value:
            txn.payId ||
            txn.recipientId?.payId ||
            txn.counterparty?.payId ||
            "N/A",
        },
        { label: "Note", value: txn.note || "No additional notes." },
      );
      if (txn.status === "Rejected")
        receiptData.fields.push({
          label: "Rejection Reason",
          value: txn.rejectionReason || "No reason provided",
        });
      // attach profile header
      receiptData.header = receiptData.header || {};
      if (profile?.username) receiptData.header.username = profile.username;
      if (profile?.email) receiptData.header.email = profile.email;
      return navigation.navigate("Receipt" as any, { receiptData } as any);
    }

    if (txn.type === "Funding") {
      receiptData.fields.push(
        { label: "Type", value: txn.type },
        {
          label: "Amount",
          value: require("../utils/formatAmount").formatSignedAmount(
            txn.amount,
            txn.type,
          ),
        },
        { label: "Transaction ID", value: transactionId, copyable: true },
        {
          label: "Date",
          value:
            new Date(
              txn.createdAt || txn.date || Date.now(),
            ).toLocaleString() || "N/A",
        },
        { label: "Status", value: txn.status || "N/A" },
        { label: "Note", value: txn.note || "No additional notes." },
      );
      // attach profile header
      receiptData.header = receiptData.header || {};
      if (profile?.username) receiptData.header.username = profile.username;
      if (profile?.email) receiptData.header.email = profile.email;
      return navigation.navigate("Receipt" as any, { receiptData } as any);
    }

    if (
      txn.type?.trim().toLowerCase() === "trade confirmation" ||
      txn.type?.trim().toLowerCase() === "confirmation"
    ) {
      try {
        const {
          buildConfirmationReceipt,
        } = require("../utils/receiptBuilders");
        const built = buildConfirmationReceipt(txn);
        // attach profile header when available
        const profile = await getProfile().catch(() => null);
        built.header = built.header || {};
        if (profile?.username) built.header.username = profile.username;
        if (profile?.email) built.header.email = profile.email;
        return navigation.navigate(
          "Receipt" as any,
          { receiptData: built } as any,
        );
      } catch (e) {
        // fallback to previous inline behavior if builder fails - but prefer explicit labels
        const fileUrls =
          Array.isArray(txn.fileUrls) && txn.fileUrls.length > 0
            ? txn.fileUrls
            : txn.fileUrl
              ? [txn.fileUrl]
              : [];
        receiptData.fields.push(
          { label: "Type", value: txn.type },
          ...(txn.amount !== undefined && txn.amount !== null
            ? [
                {
                  label: "Amount",
                  value: require("../utils/formatAmount").formatSignedAmount(
                    txn.amount,
                    txn.type,
                  ),
                },
              ]
            : []),
          { label: "Service", value: txn.serviceName || "N/A" },
          { label: "Service Tag", value: txn.serviceTag || "N/A" },
          { label: "Transaction ID", value: transactionId, copyable: true },
          {
            label: "Date",
            value:
              new Date(
                txn.createdAt || txn.date || Date.now(),
              ).toLocaleString() || "N/A",
          },
          { label: "Status", value: txn.status || "N/A" },
          { label: "Note", value: txn.note || "No additional notes." },
          { label: "Files", value: fileUrls.length > 0 ? fileUrls : [] },
        );
        if (txn.status === "Funded") {
          try {
            const userAmt = txn.userAmountInForeignCurrency ?? null;
            const userCurr = (
              txn.userSelectedCurrency ||
              txn.selectedCurrency ||
              ""
            ).toUpperCase();
            const adminAmt =
              txn.adminForeignAmount ?? txn.amountInForeignCurrency ?? null;
            const adminCurr = (
              txn.adminSelectedCurrency ||
              txn.selectedCurrency ||
              ""
            ).toUpperCase();
            if (userAmt)
              receiptData.fields.push({
                label: `Amount input in ${userCurr || "Foreign Currency"}`,
                value: `${userAmt.toLocaleString()} ${userCurr}`,
              });
            if (adminAmt)
              receiptData.fields.push({
                label: `Amount funded in ${adminCurr || "Foreign Currency"}`,
                value: `${adminAmt.toLocaleString()} ${adminCurr}`,
              });
            if (txn.amountInNaira)
              receiptData.fields.push({
                label: "Amount in Naira",
                value: `₦${txn.amountInNaira.toLocaleString()}`,
              });
            if (txn.exchangeRateUsed)
              receiptData.fields.push({
                label: "Exchange Rate",
                value: txn.exchangeRateUsed.toLocaleString(),
              });
          } catch (ee) {
            receiptData.fields.push(
              {
                label: `Amount in ${txn.selectedCurrency?.toUpperCase() ?? "Foreign Currency"}`,
                value: txn.amountInForeignCurrency
                  ? `${txn.amountInForeignCurrency.toLocaleString()} ${txn.selectedCurrency?.toUpperCase()}`
                  : "N/A",
              },
              {
                label: "Exchange Rate",
                value: txn.exchangeRateUsed
                  ? txn.exchangeRateUsed.toLocaleString()
                  : "N/A",
              },
              {
                label: "Amount in Naira",
                value: txn.amountInNaira
                  ? `₦${txn.amountInNaira.toLocaleString()}`
                  : "N/A",
              },
            );
          }
        }
        if (txn.status === "Rejected")
          receiptData.fields.push({
            label: "Rejection Reason",
            value: txn.rejectionReason || "No reason provided",
          });
        return navigation.navigate("Receipt" as any, { receiptData } as any);
      }
    }
  };

  const renderItem = ({ item }: { item: any }) => (
    <TransactionItem
      txn={item}
      onPress={handleViewReceipt}
      isBalanceVisible={!loadingWallet && walletBalance !== null}
      countdown={countdowns[item._id]}
      onAlert={handleAlertAdmin}
      alerted={!!alerted[item._id]}
    />
  );

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      {/* Wrapper ScrollView to allow pull-to-refresh on the whole screen */}
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: 16, paddingBottom: 120 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={theme.colors.primary}
          />
        }
      >
        {/* TOP BAR: Dashboard Branding & Quick Utilities */}
        <View style={styles.topBar}>
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            {loadingProfile ? (
              // Left skeleton only; keep action icons visible on the right
              <>
                <SkeletonBox width={44} height={44} radius={44} />
                <View style={{ marginLeft: 12 }}>
                  <SkeletonBox width={160} height={18} radius={6} />
                  <View style={{ height: 8 }} />
                  <SkeletonBox width={100} height={14} radius={6} />
                </View>
              </>
            ) : (
              // Profile Circle with Initials and welcome text
              <>
                <TouchableOpacity
                  onPress={() => navigation.navigate("Profile")}
                  style={styles.profileCircle}
                >
                  <Text style={styles.profileInitials}>
                    {(() => {
                      const name =
                        profile?.name ||
                        profile?.fullName ||
                        profile?.username ||
                        "";
                      if (!name) return "U";
                      const parts = name.trim().split(/\s+/);
                      if (parts.length >= 2)
                        return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
                      return name.substring(0, 2).toUpperCase();
                    })()}
                  </Text>
                </TouchableOpacity>

                <View style={{ marginLeft: 12 }}>
                  <Text style={styles.welcomeSub}>Welcome back,</Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Text style={styles.welcome}>
                      {profile?.username || "User"}
                    </Text>
                    {profile?.kyc?.status === 'approved' && (
                      <TouchableOpacity
                        onPress={() => setKycModalVisible(true)}
                        activeOpacity={0.8}
                        style={styles.kycBadge}
                        accessibilityLabel="KYC Verified — tap for details"
                      >
                        <Ionicons name="shield-checkmark" size={12} color="#fff" />
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              </>
            )}
          </View>

          {/* Right-side controls should always render (notifications bell + Earn pill) */}
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            <TouchableOpacity
              onPress={() => navigation.navigate("Notifications" as any)}
              style={{ marginRight: 15 }}
            >
              <View style={{ position: "relative" }}>
                <Ionicons
                  name="notifications-outline"
                  size={24}
                  color={theme.colors.text}
                />
                {unreadCount > 0 && (
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>
                      {formatBadgeCount(unreadCount)}
                    </Text>
                  </View>
                )}
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => navigation.navigate("Earn" as any)}
              style={styles.earnPill}
            >
              <Text style={styles.earnText}>Earn ₦2k</Text>
            </TouchableOpacity>
          </View>
        </View>
        {/* STEP 1: SERVICE SELECTION & BALANCE */}
        <View style={styles.servicesBox}>
          <TouchableOpacity
            style={styles.selectorButton}
            onPress={() => setShowModal(true)}
            activeOpacity={0.8}
          >
            {/* Left: icon + label (label allowed to shrink) */}
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                flex: 1,
                marginRight: 8,
              }}
            >
              <Ionicons
                name="apps-outline"
                size={18}
                color={theme.colors.primary}
                style={{ marginRight: 10 }}
              />
              <Text
                style={[styles.selectorText, { flex: 1 }]}
                numberOfLines={1}
                ellipsizeMode="tail"
              >
                {selectedServiceLabel || "Select a Service to Start"}
              </Text>
            </View>
            {/* Right: fixed chevron */}
            <Ionicons
              name="chevron-down-outline"
              size={18}
              color={theme.colors.muted}
            />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.balanceCard}
            activeOpacity={0.9}
            onPress={async () => {
              const next = !balanceVisible;
              setBalanceVisible(next);
              await AsyncStorage.setItem(
                "balanceVisible",
                next ? "true" : "false",
              );
            }}
          >
            <Text style={styles.balanceLabel}>Total Wallet Balance</Text>
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <Text style={styles.balanceValue}>
                {loadingWallet ? (
                  <SkeletonBox width={120} height={24} radius={8} />
                ) : walletBalance !== null ? (
                  balanceVisible ? (
                    `₦${walletBalance.toLocaleString()}`
                  ) : (
                    "₦ ••••••"
                  )
                ) : (
                  "₦ ---"
                )}
              </Text>
              <Ionicons
                name={balanceVisible ? "eye-outline" : "eye-off-outline"}
                size={22}
                color={theme.colors.primary}
              />
            </View>
          </TouchableOpacity>
        </View>

        {/* Live FX Rate Ticker */}
        <RateTicker />

        {/* KYC Verification Banner — shown until user is approved */}
        {profile && profile?.kyc?.status !== "approved" && (
          <TouchableOpacity
            style={[
              styles.kycBanner,
              {
                backgroundColor:
                  profile?.kyc?.status === "pending"
                    ? "#d97706"
                    : profile?.kyc?.status === "rejected"
                    ? "#dc2626"
                    : theme.colors.primary,
              },
            ]}
            onPress={() => navigation.navigate("KYC" as any)}
            activeOpacity={0.85}
          >
            <Ionicons
              name={
                profile?.kyc?.status === "pending"
                  ? "time-outline"
                  : profile?.kyc?.status === "rejected"
                  ? "close-circle-outline"
                  : "shield-outline"
              }
              size={18}
              color="#fff"
            />
            <View style={{ flex: 1, marginLeft: 10 }}>
              <Text style={styles.kycBannerTitle}>
                {profile?.kyc?.status === "pending"
                  ? "KYC Under Review"
                  : profile?.kyc?.status === "rejected"
                  ? "KYC Rejected — Resubmit"
                  : "Complete KYC Verification"}
              </Text>
              <Text style={styles.kycBannerSub}>
                {profile?.kyc?.status === "pending"
                  ? "Your documents are being reviewed (24–48 hrs)"
                  : profile?.kyc?.status === "rejected"
                  ? "Tap to see rejection reason and resubmit"
                  : "Verify your identity to unlock all features"}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color="#fff" />
          </TouchableOpacity>
        )}

        {/* STEP 2: MAIN ACTIONS (Joined Pre-submissions here) */}
        <View style={styles.actionsRow}>
          <ActionButton
            onPress={() => {
              if (!selectedService)
                return showToast("Please select a service first.");
              navigation.navigate("GetTag" as any, {
                serviceName: selectedService,
              });
            }}
            icon={<Ionicons name="qr-code-outline" size={22} color="#FFF" />}
            label="Get Tag"
          />

          <ActionButton
            onPress={() => navigation.navigate("MyPreSubmissions" as any)}
            icon={<Ionicons name="pricetags-outline" size={22} color="#FFF" />}
            label="My Pre-subs"
          />

          <ActionButton
            onPress={() => {
              if (!selectedService)
                return showToast("Please select a service first.");
              navigation.navigate("TradeConfirmation" as any, {
                serviceName: selectedService,
              });
            }}
            icon={
              <Ionicons
                name="shield-checkmark-outline"
                size={22}
                color="#FFF"
              />
            }
            label="Confirm"
          />

          <ActionButton
            onPress={() => navigation.navigate("Withdrawal" as any)}
            icon={
              <Ionicons name="paper-plane-outline" size={22} color="#FFF" />
            }
            label="Withdraw"
          />
        </View>

        {/* STEP 3: ANALYTICS & ADS */}
        <BalanceSparkline
          walletBalance={walletBalance}
          transactions={transactions}
          metric={"weeklyNet"}
          isBalanceVisible={!loadingWallet && walletBalance !== null}
        />
        <Flyer requireSparkline={true} />

        {/* STEP 4: RECENT TRANSACTIONS */}
        <View style={{ marginTop: 20 }}>
          <View style={styles.txnHeader}>
            <Text style={styles.sectionTitle}>Recent Transactions</Text>
            <TouchableOpacity
              onPress={() => navigation.navigate("History" as any)}
            >
              <Text style={styles.seeAll}>View All</Text>
            </TouchableOpacity>
          </View>

          {loadingTxns ? (
            <View style={{ marginTop: 10 }}>
              {[1, 2, 3].map((i) => (
                <View key={i} style={{ marginBottom: 10 }}>
                  <SkeletonBox height={70} width={"100%"} radius={12} />
                </View>
              ))}
            </View>
          ) : transactions.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons
                name="receipt-outline"
                size={40}
                color={theme.colors.mutedLight}
              />
              <Text style={styles.emptyText}>
                No transactions yet. Start your trading journey — select a
                service and make your first transaction.
              </Text>
            </View>
          ) : (
            // Note: Inside ScrollView, FlatList needs scrollEnabled={false} or use .map()
            transactions
              .slice(0, 5)
              .map((item) => (
                <TransactionItem
                  key={item._id || item.time}
                  txn={item}
                  onPress={() => handleViewReceipt(item)}
                  countdown={countdowns[item._id]}
                  onAlert={handleAlertAdmin}
                  alerted={!!alerted[item._id]}
                />
              ))
          )}
        </View>
      </ScrollView>

      {/* FLOATING CALCULATOR */}
      <TouchableOpacity
        style={[styles.fabCalculator, { bottom: 100 }]}
        onPress={() => {
          if (!selectedService)
            return showToast("Please select a service first.");
          navigation.navigate("Calculator", { serviceName: selectedService });
        }}
      >
        <Ionicons name="calculator" size={26} color="#FFF" />
      </TouchableOpacity>

      <ServicePickerModal
        visible={showModal}
        onClose={() => setShowModal(false)}
        onSelect={(s: any) => {
          const name = typeof s === "string" ? s : s.name || s._id || "";
          const label =
            typeof s === "string"
              ? ""
              : (s.label || s.name || "") + (s.isNew ? " (NEW)" : "");
          setSelectedService(name);
          setSelectedServiceLabel(label);
          AsyncStorage.setItem("defaultService", name);
          setShowModal(false);
        }}
      />

      <NavBar
        active={activeTab}
        onPress={(tab) => {
          try {
            setActiveTab(tab as any);
            // map the tab names to actual route names used in the app
            const routeMap: Record<string, string> = {
              Home: "Dashboard",
              History: "History",
              Profile: "Profile",
              Help: "Help",
            };
            const routeName = routeMap[tab as string] || (tab as string);
            navigation.navigate(routeName as any);
          } catch (e) {
            console.warn("NavBar navigation error", e);
          }
        }}
      />

      {/* KYC Verified Info Modal */}
      <ConfirmModal
        visible={kycModalVisible}
        title="Identity Verified ✅"
        message={`Your identity has been verified${profile?.kyc?.autoVerified ? ' automatically' : ' by our team'}.\n\nID Type: ${(profile?.kyc?.idType || '').toUpperCase() || 'N/A'}\nVerified on: ${profile?.kyc?.reviewedAt ? new Date(profile.kyc.reviewedAt).toLocaleDateString() : 'N/A'}`}
        confirmText="OK"
        onConfirm={() => setKycModalVisible(false)}
        onCancel={() => setKycModalVisible(false)}
        showActions={true}
      />
    </View>
  );
};
const createStyles = (t: any) =>
  StyleSheet.create({
    topBar: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 12,
    },
    profileCircle: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: t.colors.primary,
      justifyContent: "center",
      alignItems: "center",
      borderWidth: 2,
      borderColor: t.colors.surface,
      elevation: 4,
      shadowColor: "#000",
      shadowOpacity: 0.1,
      shadowOffset: { width: 0, height: 2 },
      shadowRadius: 4,
    },
    profileInitials: {
      color: "#FFFFFF",
      fontSize: 16,
      fontWeight: "800",
      letterSpacing: 1,
    },
    welcomeSub: {
      fontSize: 12,
      color: t.colors.muted,
      marginBottom: -2,
    },
    welcome: {
      fontSize: 18,
      fontWeight: "800",
      color: t.colors.text,
    },
    kycBadge: {
      width: 18,
      height: 18,
      borderRadius: 9,
      backgroundColor: '#1d9bf0',
      alignItems: 'center',
      justifyContent: 'center',
      shadowColor: '#000',
      shadowOpacity: 0.2,
      shadowRadius: 3,
      shadowOffset: { width: 0, height: 1 },
      elevation: 2,
    },
    earnPill: {
      paddingHorizontal: 12,
      paddingVertical: 6,
      backgroundColor: "#1DBF73", // Using the success green
      borderRadius: 20,
    },
    earnText: {
      color: "#FFFFFF",
      fontWeight: "800",
      fontSize: 12,
    },
    balanceCard: {
      backgroundColor: t.colors.surface,
      padding: 18,
      borderRadius: 14,
      marginBottom: 14,
      shadowColor: "#000",
      shadowOpacity: 0.04,
      shadowOffset: { width: 0, height: 3 },
      shadowRadius: 8,
      elevation: 3,
    },
    balanceLabel: { color: t.colors.muted, fontSize: 14, fontWeight: "600" },
    balanceValue: {
      fontSize: 28,
      fontWeight: "900",
      color: t.colors.primary,
      marginTop: 8,
    },
    actionsRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      marginVertical: 8,
    },
    kycBanner: {
      flexDirection: "row",
      alignItems: "center",
      borderRadius: 12,
      paddingVertical: 12,
      paddingHorizontal: 14,
      marginHorizontal: 0,
      marginTop: 10,
      marginBottom: 2,
    },
    kycBannerTitle: {
      color: "#fff",
      fontSize: 13,
      fontWeight: "700",
    },
    kycBannerSub: {
      color: "rgba(255,255,255,0.82)",
      fontSize: 11,
      marginTop: 1,
    },
    actionBtn: {
      width: 64,
      height: 64,
      borderRadius: 32,
      alignItems: "center",
      justifyContent: "center",
      marginHorizontal: 10,
    },
    actionWrap: { alignItems: "center", width: 90 },
    actionLabel: {
      fontSize: 12,
      color: t.colors.text,
      marginTop: 6,
      textAlign: "center",
    },
    actionText: { color: t.colors.white, marginLeft: 8, fontWeight: "700" },
    txnHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 8,
    },
    txnListContainer: {
      /* allow list to grow, avoid artificially clipping */ flex: 1,
    },
    sectionTitle: { fontSize: 16, fontWeight: "700", color: t.colors.text },
    seeAll: { color: t.colors.primary },
    fabCalculator: {
      position: "absolute",
      right: 20,
      bottom: 88,
      backgroundColor: t.colors.primary,
      width: 56,
      height: 56,
      borderRadius: 28,
      justifyContent: "center",
      alignItems: "center",
      elevation: 8,
    },
    servicesBox: { marginBottom: 12, marginTop: 12 },
    selectorButton: {
      width: "100%",
      backgroundColor: t.colors.surface,
      paddingVertical: 12,
      paddingHorizontal: 16,
      borderRadius: 10,
      marginBottom: 14,
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      borderWidth: 1,
      borderColor: t.colors.border,
    },
    selectorText: { color: t.colors.text, fontWeight: "700", flexShrink: 1 },
    secondaryActions: {
      flexDirection: "row",
      justifyContent: "space-between",
      marginBottom: 12,
    },
    earnBtn: {
      flex: 1,
      marginRight: 8,
      paddingVertical: 10,
      borderRadius: 10,
      alignItems: "center",
      flexDirection: "row",
      justifyContent: "center",
      backgroundColor: "#1DBF73",
    },
    contactBtn: {
      flex: 1,
      paddingVertical: 10,
      borderRadius: 10,
      alignItems: "center",
      flexDirection: "row",
      justifyContent: "center",
      backgroundColor: "#25D366",
    },
    tradeBtn: { flexGrow: 1.6, minWidth: 110 },
    getTagBtn: { minWidth: 84 },
    withdrawBtn: { minWidth: 84 },
    bottomBar: {
      position: "absolute",
      left: 0,
      right: 0,
      bottom: 0,
      height: 64,
      borderTopWidth: 1,
      borderTopColor: t.colors.border,
      backgroundColor: t.colors.surface,
      flexDirection: "row",
      justifyContent: "space-around",
      alignItems: "center",
      elevation: 10,
      shadowColor: "#000",
      shadowOpacity: 0.06,
      shadowOffset: { width: 0, height: -2 },
      shadowRadius: 8,
      paddingBottom: 8,
    },
    bottomBarItem: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      paddingVertical: 6,
    },
    bottomBarLabel: { fontSize: 12, color: "#333", marginTop: 4 },
    activeBarItem: {
      backgroundColor: t.colors.surface,
      borderRadius: 8,
      marginHorizontal: 8,
      paddingVertical: 6,
    },
    activeLabel: { color: t.colors.primary, fontWeight: "700" },
    badge: {
      position: "absolute",
      right: -8,
      top: -8,
      backgroundColor: t.colors.primary,
      borderRadius: 12,
      width: 24,
      height: 24,
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 2,
      borderColor: t.colors.background,
    },
    badgeText: {
      color: t.colors.white,
      fontSize: 12,
      fontWeight: "700",
      textAlign: "center",
    },
    // screenHeader and screenHeaderText removed — header intentionally disabled
    modalContainer: { flex: 1, backgroundColor: t.colors.surface },
    modalList: { flex: 1, padding: 16 },
    modalEmpty: { flex: 1, justifyContent: "center", alignItems: "center" },
    notifItem: {
      padding: 12,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: t.colors.border,
    },
    notifRow: { flexDirection: "row", alignItems: "flex-start" },
    notifMessage: { color: t.colors.text, fontSize: 14 },
    notifTime: { color: t.colors.mutedLight, marginTop: 6, fontSize: 12 },
    modalHeaderRightButton: {
      backgroundColor: t.colors.primary,
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 8,
    },
    markBtn: {
      backgroundColor: t.colors.primary,
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 8,
    },
    markBtnText: { color: t.colors.white, fontWeight: "700", fontSize: 12 },
    flyerSlot: { paddingHorizontal: 16, marginTop: 12, marginBottom: 12 },
    flyerCard: {
      backgroundColor: t.colors.surface,
      borderRadius: 12,
      overflow: "hidden",
      borderWidth: 1,
      borderColor: t.colors.border || "#eee",
    },
    emptyState: {
      marginTop: 20,
      alignItems: "center",
      justifyContent: "center",
    },
    emptyText: { color: t.colors.muted || "#666", fontSize: 15 },
  });

// generate styles from runtime theme
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const useStyles = (theme: any) => useMemo(() => createStyles(theme), [theme]);

// export default at EOF (below)
export default DashboardScreen;
