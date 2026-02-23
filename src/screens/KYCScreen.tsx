/**
 * KYCScreen.tsx
 * Multi-step Know Your Customer (KYC) verification flow.
 *
 * Step 1 — Select ID type
 * Step 2 — Enter ID number
 * Step 3 — Upload government ID document (photo or PDF)
 * Step 4 — Upload a selfie / face photo
 * Step 5 — Review & Submit → shows pending / approved / rejected state
 */

import React, { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  ActivityIndicator,
  Alert,
  Image,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as DocumentPicker from "expo-document-picker";
import { useTheme } from "../theme/index";
import { getKYCStatus, submitKYC } from "../api/client";

// ─── Types ────────────────────────────────────────────────────────────────────

type IdType = "nin" | "bvn" | "passport" | "drivers_license";

interface PickedFile {
  uri: string;
  name: string;
  mimeType?: string;
  size?: number;
}

interface KycState {
  status: "none" | "pending" | "approved" | "rejected";
  idType?: string;
  idNumber?: string;
  submittedAt?: string;
  reviewedAt?: string;
  rejectionReason?: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const ID_TYPES: { value: IdType; label: string; hint: string }[] = [
  {
    value: "nin",
    label: "NIN",
    hint: "11-digit National Identification Number",
  },
  {
    value: "bvn",
    label: "BVN",
    hint: "11-digit Bank Verification Number",
  },
  {
    value: "passport",
    label: "International Passport",
    hint: "Passport number (e.g. A12345678)",
  },
  {
    value: "drivers_license",
    label: "Driver's License",
    hint: "Driver's license number",
  },
];

const TOTAL_STEPS = 4;

// ─── Component ───────────────────────────────────────────────────────────────

const KYCScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  const themeCtx = useTheme();
  const t = themeCtx;

  // Existing KYC state fetched from backend
  const [kycData, setKycData] = useState<KycState | null>(null);
  const [loadingStatus, setLoadingStatus] = useState(true);

  // Form state
  const [step, setStep] = useState(1);
  const [selectedIdType, setSelectedIdType] = useState<IdType | null>(null);
  const [idNumber, setIdNumber] = useState("");
  const [documentFile, setDocumentFile] = useState<PickedFile | null>(null);
  const [selfieFile, setSelfieFile] = useState<PickedFile | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // ── Fetch existing KYC status on mount ──────────────────────────────────────
  useEffect(() => {
    (async () => {
      try {
        const data = await getKYCStatus();
        setKycData(data?.kyc || { status: "none" });
      } catch {
        setKycData({ status: "none" });
      } finally {
        setLoadingStatus(false);
      }
    })();
  }, []);

  // ── File pickers ────────────────────────────────────────────────────────────
  const pickDocument = useCallback(async (field: "document" | "selfie") => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ["image/*", "application/pdf"],
        copyToCacheDirectory: true,
      });

      if (result.canceled) return;

      const asset = result.assets && result.assets[0];
      if (!asset) return;

      const picked: PickedFile = {
        uri: asset.uri,
        name: asset.name || (field === "document" ? "document.jpg" : "selfie.jpg"),
        mimeType: asset.mimeType || "image/jpeg",
        size: asset.size,
      };

      if (field === "document") {
        setDocumentFile(picked);
      } else {
        setSelfieFile(picked);
      }
    } catch (err) {
      console.warn("[KYC] picker error:", err);
      Alert.alert("Error", "Could not open file picker. Please try again.");
    }
  }, []);

  // ── Submit handler ───────────────────────────────────────────────────────────
  const handleSubmit = useCallback(async () => {
    if (!selectedIdType || !idNumber.trim() || !documentFile || !selfieFile) {
      Alert.alert("Incomplete", "Please complete all steps before submitting.");
      return;
    }

    setSubmitting(true);
    try {
      const formData = new FormData();
      formData.append("idType", selectedIdType);
      formData.append("idNumber", idNumber.trim());
      formData.append("document", {
        uri: documentFile.uri,
        name: documentFile.name,
        type: documentFile.mimeType || "image/jpeg",
      } as any);
      formData.append("selfie", {
        uri: selfieFile.uri,
        name: selfieFile.name,
        type: selfieFile.mimeType || "image/jpeg",
      } as any);

      const res = await submitKYC(formData);
      setKycData(res?.kyc || { status: "pending" });
    } catch (err: any) {
      const msg =
        err?.response?.data?.message || "Submission failed. Please try again.";
      Alert.alert("Error", msg);
    } finally {
      setSubmitting(false);
    }
  }, [selectedIdType, idNumber, documentFile, selfieFile]);

  // ─── Render loading ──────────────────────────────────────────────────────────
  if (loadingStatus) {
    return (
      <View style={[styles.center, { backgroundColor: t.colors.background }]}>
        <ActivityIndicator size="large" color={t.colors.primary} />
      </View>
    );
  }

  // ─── Render status screens (already submitted / approved / rejected) ─────────
  if (kycData && kycData.status !== "none") {
    return (
      <View style={[styles.container, { backgroundColor: t.colors.background }]}>
        {/* Header */}
        <View style={[styles.header, { borderBottomColor: t.colors.border }]}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={24} color={t.colors.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: t.colors.text }]}>
            KYC Verification
          </Text>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView contentContainerStyle={styles.statusContainer}>
          {/* Approved */}
          {kycData.status === "approved" && (
            <>
              <View style={[styles.statusBadge, { backgroundColor: "#16a34a22" }]}>
                <Ionicons name="shield-checkmark" size={64} color="#16a34a" />
              </View>
              <Text style={[styles.statusTitle, { color: "#16a34a" }]}>
                Verified ✓
              </Text>
              <Text style={[styles.statusSub, { color: t.colors.muted }]}>
                Your identity has been successfully verified. You now have full
                access to all platform features.
              </Text>
            </>
          )}

          {/* Pending */}
          {kycData.status === "pending" && (
            <>
              <View style={[styles.statusBadge, { backgroundColor: "#d9770622" }]}>
                <Ionicons name="time" size={64} color="#d97706" />
              </View>
              <Text style={[styles.statusTitle, { color: "#d97706" }]}>
                Under Review
              </Text>
              <Text style={[styles.statusSub, { color: t.colors.muted }]}>
                Your documents have been submitted and are being reviewed. This
                usually takes 24–48 hours.
              </Text>
              {kycData.submittedAt && (
                <Text style={[styles.statusMeta, { color: t.colors.muted }]}>
                  Submitted:{" "}
                  {new Date(kycData.submittedAt).toLocaleDateString(undefined, {
                    year: "numeric",
                    month: "short",
                    day: "numeric",
                  })}
                </Text>
              )}
            </>
          )}

          {/* Rejected */}
          {kycData.status === "rejected" && (
            <>
              <View style={[styles.statusBadge, { backgroundColor: "#dc262622" }]}>
                <Ionicons name="close-circle" size={64} color="#dc2626" />
              </View>
              <Text style={[styles.statusTitle, { color: "#dc2626" }]}>
                Verification Failed
              </Text>
              <Text style={[styles.statusSub, { color: t.colors.muted }]}>
                Your KYC submission was rejected. Please review the reason below
                and resubmit with correct documents.
              </Text>
              {kycData.rejectionReason && (
                <View
                  style={[
                    styles.rejectionBox,
                    { backgroundColor: t.colors.surface, borderColor: "#dc2626" },
                  ]}
                >
                  <Text style={[styles.rejectionLabel, { color: "#dc2626" }]}>
                    Rejection Reason:
                  </Text>
                  <Text style={[styles.rejectionText, { color: t.colors.text }]}>
                    {kycData.rejectionReason}
                  </Text>
                </View>
              )}
              {/* Allow resubmission after rejection */}
              <TouchableOpacity
                style={[styles.resubmitBtn, { backgroundColor: t.colors.primary }]}
                onPress={() => setKycData({ status: "none" })}
              >
                <Text style={styles.resubmitBtnText}>Resubmit Documents</Text>
              </TouchableOpacity>
            </>
          )}

          <TouchableOpacity
            style={[styles.backToDash, { borderColor: t.colors.border }]}
            onPress={() => navigation.goBack()}
          >
            <Text style={[styles.backToDashText, { color: t.colors.primary }]}>
              Back to Dashboard
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </View>
    );
  }

  // ─── Render multi-step form ───────────────────────────────────────────────────

  const currentIdTypeMeta = ID_TYPES.find((x) => x.value === selectedIdType);

  return (
    <View style={[styles.container, { backgroundColor: t.colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: t.colors.border }]}>
        <TouchableOpacity
          onPress={() => (step > 1 ? setStep((s) => s - 1) : navigation.goBack())}
          style={styles.backBtn}
        >
          <Ionicons name="arrow-back" size={24} color={t.colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: t.colors.text }]}>
          KYC Verification
        </Text>
        <Text style={[styles.stepCount, { color: t.colors.muted }]}>
          {step}/{TOTAL_STEPS}
        </Text>
      </View>

      {/* Progress bar */}
      <View style={[styles.progressTrack, { backgroundColor: t.colors.border }]}>
        <View
          style={[
            styles.progressFill,
            {
              backgroundColor: t.colors.primary,
              width: `${(step / TOTAL_STEPS) * 100}%`,
            },
          ]}
        />
      </View>

      <ScrollView
        contentContainerStyle={styles.formContainer}
        keyboardShouldPersistTaps="handled"
      >
        {/* ── STEP 1: Select ID type ─────────────────────────────────────────── */}
        {step === 1 && (
          <>
            <Text style={[styles.stepTitle, { color: t.colors.text }]}>
              Select ID Type
            </Text>
            <Text style={[styles.stepSub, { color: t.colors.muted }]}>
              Choose the type of government-issued ID you want to use for
              verification.
            </Text>
            <View style={styles.idTypeGrid}>
              {ID_TYPES.map((item) => {
                const selected = selectedIdType === item.value;
                return (
                  <TouchableOpacity
                    key={item.value}
                    style={[
                      styles.idTypeCard,
                      {
                        backgroundColor: selected
                          ? t.colors.primary + "22"
                          : t.colors.surface,
                        borderColor: selected ? t.colors.primary : t.colors.border,
                      },
                    ]}
                    onPress={() => setSelectedIdType(item.value)}
                  >
                    <Ionicons
                      name={
                        item.value === "passport"
                          ? "id-card-outline"
                          : item.value === "drivers_license"
                          ? "car-outline"
                          : "person-outline"
                      }
                      size={28}
                      color={selected ? t.colors.primary : t.colors.muted}
                    />
                    <Text
                      style={[
                        styles.idTypeLabel,
                        {
                          color: selected ? t.colors.primary : t.colors.text,
                          fontWeight: selected ? "700" : "400",
                        },
                      ]}
                    >
                      {item.label}
                    </Text>
                    <Text
                      style={[styles.idTypeHint, { color: t.colors.muted }]}
                      numberOfLines={2}
                    >
                      {item.hint}
                    </Text>
                    {selected && (
                      <Ionicons
                        name="checkmark-circle"
                        size={20}
                        color={t.colors.primary}
                        style={styles.idTypeCheck}
                      />
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>

            <TouchableOpacity
              style={[
                styles.nextBtn,
                {
                  backgroundColor: selectedIdType
                    ? t.colors.primary
                    : t.colors.border,
                },
              ]}
              onPress={() => selectedIdType && setStep(2)}
              disabled={!selectedIdType}
            >
              <Text style={styles.nextBtnText}>Continue</Text>
              <Ionicons name="arrow-forward" size={18} color="#fff" />
            </TouchableOpacity>
          </>
        )}

        {/* ── STEP 2: Enter ID number ────────────────────────────────────────── */}
        {step === 2 && (
          <>
            <Text style={[styles.stepTitle, { color: t.colors.text }]}>
              Enter Your ID Number
            </Text>
            <Text style={[styles.stepSub, { color: t.colors.muted }]}>
              {currentIdTypeMeta?.hint ||
                "Enter the identification number from your document."}
            </Text>

            <View
              style={[
                styles.inputWrapper,
                { backgroundColor: t.colors.surface, borderColor: t.colors.border },
              ]}
            >
              <Ionicons
                name="keypad-outline"
                size={20}
                color={t.colors.muted}
                style={{ marginRight: 8 }}
              />
              <TextInput
                style={[styles.textInput, { color: t.colors.text }]}
                placeholder={currentIdTypeMeta?.hint || "ID Number"}
                placeholderTextColor={t.colors.muted}
                value={idNumber}
                onChangeText={setIdNumber}
                autoCapitalize="characters"
                keyboardType={
                  selectedIdType === "nin" || selectedIdType === "bvn"
                    ? "number-pad"
                    : "default"
                }
                maxLength={20}
              />
            </View>

            <TouchableOpacity
              style={[
                styles.nextBtn,
                {
                  backgroundColor:
                    idNumber.trim().length >= 8
                      ? t.colors.primary
                      : t.colors.border,
                },
              ]}
              onPress={() => idNumber.trim().length >= 8 && setStep(3)}
              disabled={idNumber.trim().length < 8}
            >
              <Text style={styles.nextBtnText}>Continue</Text>
              <Ionicons name="arrow-forward" size={18} color="#fff" />
            </TouchableOpacity>
          </>
        )}

        {/* ── STEP 3: Upload ID document ─────────────────────────────────────── */}
        {step === 3 && (
          <>
            <Text style={[styles.stepTitle, { color: t.colors.text }]}>
              Upload ID Document
            </Text>
            <Text style={[styles.stepSub, { color: t.colors.muted }]}>
              Upload a clear photo or scan of your{" "}
              {currentIdTypeMeta?.label || "government-issued ID"}. Make sure all
              text is legible.
            </Text>

            <TouchableOpacity
              style={[
                styles.uploadBox,
                {
                  backgroundColor: documentFile
                    ? t.colors.primary + "11"
                    : t.colors.surface,
                  borderColor: documentFile ? t.colors.primary : t.colors.border,
                },
              ]}
              onPress={() => pickDocument("document")}
            >
              {documentFile ? (
                <>
                  {documentFile.mimeType?.startsWith("image/") ? (
                    <Image
                      source={{ uri: documentFile.uri }}
                      style={styles.uploadPreview}
                      resizeMode="cover"
                    />
                  ) : (
                    <Ionicons
                      name="document-text"
                      size={48}
                      color={t.colors.primary}
                    />
                  )}
                  <Text
                    style={[styles.uploadFileName, { color: t.colors.text }]}
                    numberOfLines={1}
                  >
                    {documentFile.name}
                  </Text>
                  <Text style={[styles.uploadChange, { color: t.colors.primary }]}>
                    Tap to change
                  </Text>
                </>
              ) : (
                <>
                  <Ionicons
                    name="cloud-upload-outline"
                    size={48}
                    color={t.colors.muted}
                  />
                  <Text style={[styles.uploadLabel, { color: t.colors.text }]}>
                    Choose a file
                  </Text>
                  <Text style={[styles.uploadHint, { color: t.colors.muted }]}>
                    JPG, PNG or PDF • Max 10 MB
                  </Text>
                </>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.nextBtn,
                {
                  backgroundColor: documentFile
                    ? t.colors.primary
                    : t.colors.border,
                },
              ]}
              onPress={() => documentFile && setStep(4)}
              disabled={!documentFile}
            >
              <Text style={styles.nextBtnText}>Continue</Text>
              <Ionicons name="arrow-forward" size={18} color="#fff" />
            </TouchableOpacity>
          </>
        )}

        {/* ── STEP 4: Upload selfie ──────────────────────────────────────────── */}
        {step === 4 && (
          <>
            <Text style={[styles.stepTitle, { color: t.colors.text }]}>
              Upload a Selfie
            </Text>
            <Text style={[styles.stepSub, { color: t.colors.muted }]}>
              Take or upload a recent photo of your face. Make sure it is well-lit
              and your face is clearly visible.
            </Text>

            <TouchableOpacity
              style={[
                styles.uploadBox,
                styles.selfieBox,
                {
                  backgroundColor: selfieFile
                    ? t.colors.primary + "11"
                    : t.colors.surface,
                  borderColor: selfieFile ? t.colors.primary : t.colors.border,
                },
              ]}
              onPress={() => pickDocument("selfie")}
            >
              {selfieFile ? (
                <>
                  {selfieFile.mimeType?.startsWith("image/") ? (
                    <Image
                      source={{ uri: selfieFile.uri }}
                      style={styles.selfiePreview}
                      resizeMode="cover"
                    />
                  ) : (
                    <Ionicons name="person" size={48} color={t.colors.primary} />
                  )}
                  <Text
                    style={[styles.uploadFileName, { color: t.colors.text }]}
                    numberOfLines={1}
                  >
                    {selfieFile.name}
                  </Text>
                  <Text style={[styles.uploadChange, { color: t.colors.primary }]}>
                    Tap to change
                  </Text>
                </>
              ) : (
                <>
                  <Ionicons
                    name="camera-outline"
                    size={48}
                    color={t.colors.muted}
                  />
                  <Text style={[styles.uploadLabel, { color: t.colors.text }]}>
                    Choose a selfie
                  </Text>
                  <Text style={[styles.uploadHint, { color: t.colors.muted }]}>
                    JPG or PNG • Face clearly visible
                  </Text>
                </>
              )}
            </TouchableOpacity>

            {/* Review summary */}
            {selfieFile && (
              <View
                style={[
                  styles.summaryBox,
                  {
                    backgroundColor: t.colors.surface,
                    borderColor: t.colors.border,
                  },
                ]}
              >
                <Text style={[styles.summaryTitle, { color: t.colors.text }]}>
                  Review Before Submitting
                </Text>
                <SummaryRow
                  label="ID Type"
                  value={currentIdTypeMeta?.label || selectedIdType || ""}
                  textColor={t.colors.text}
                  mutedColor={t.colors.muted}
                />
                <SummaryRow
                  label="ID Number"
                  value={idNumber}
                  textColor={t.colors.text}
                  mutedColor={t.colors.muted}
                />
                <SummaryRow
                  label="Document"
                  value={documentFile?.name || ""}
                  textColor={t.colors.text}
                  mutedColor={t.colors.muted}
                />
                <SummaryRow
                  label="Selfie"
                  value={selfieFile?.name || ""}
                  textColor={t.colors.text}
                  mutedColor={t.colors.muted}
                />
              </View>
            )}

            <TouchableOpacity
              style={[
                styles.submitBtn,
                {
                  backgroundColor: selfieFile ? t.colors.primary : t.colors.border,
                  opacity: submitting ? 0.7 : 1,
                },
              ]}
              onPress={handleSubmit}
              disabled={!selfieFile || submitting}
            >
              {submitting ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <>
                  <Ionicons name="shield-checkmark-outline" size={20} color="#fff" />
                  <Text style={styles.submitBtnText}>Submit for Verification</Text>
                </>
              )}
            </TouchableOpacity>

            <Text style={[styles.disclaimer, { color: t.colors.muted }]}>
              By submitting, you consent to the processing of your personal data
              for identity verification purposes in accordance with our Privacy
              Policy. Your documents are stored securely and never shared with
              third parties.
            </Text>
          </>
        )}
      </ScrollView>
    </View>
  );
};

// ─── Summary Row Helper ───────────────────────────────────────────────────────

const SummaryRow: React.FC<{
  label: string;
  value: string;
  textColor: string;
  mutedColor: string;
}> = ({ label, value, textColor, mutedColor }) => (
  <View style={styles.summaryRow}>
    <Text style={[styles.summaryLabel, { color: mutedColor }]}>{label}</Text>
    <Text style={[styles.summaryValue, { color: textColor }]} numberOfLines={1}>
      {value}
    </Text>
  </View>
);

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },

  // Header
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  backBtn: { padding: 4, width: 40 },
  headerTitle: { flex: 1, textAlign: "center", fontSize: 17, fontWeight: "700" },
  stepCount: { width: 40, textAlign: "right", fontSize: 13 },

  // Progress bar
  progressTrack: { height: 3 },
  progressFill: { height: 3, borderRadius: 2 },

  // Form
  formContainer: { padding: 20, paddingBottom: 48 },
  stepTitle: { fontSize: 22, fontWeight: "800", marginBottom: 8, marginTop: 8 },
  stepSub: { fontSize: 14, lineHeight: 20, marginBottom: 24 },

  // ID type grid
  idTypeGrid: { gap: 12, marginBottom: 28 },
  idTypeCard: {
    borderWidth: 2,
    borderRadius: 14,
    padding: 16,
    alignItems: "center",
    position: "relative",
  },
  idTypeLabel: { fontSize: 15, marginTop: 8, textAlign: "center" },
  idTypeHint: { fontSize: 12, marginTop: 4, textAlign: "center", lineHeight: 16 },
  idTypeCheck: { position: "absolute", top: 10, right: 10 },

  // Input
  inputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1.5,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
    marginBottom: 28,
  },
  textInput: { flex: 1, fontSize: 16, letterSpacing: 1 },

  // Upload
  uploadBox: {
    borderWidth: 2,
    borderStyle: "dashed",
    borderRadius: 14,
    padding: 24,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 160,
    marginBottom: 24,
  },
  selfieBox: { minHeight: 200 },
  uploadLabel: { fontSize: 15, fontWeight: "600", marginTop: 12 },
  uploadHint: { fontSize: 12, marginTop: 4 },
  uploadPreview: {
    width: "100%",
    height: 140,
    borderRadius: 8,
    marginBottom: 8,
  },
  selfiePreview: { width: 140, height: 160, borderRadius: 70, marginBottom: 8 },
  uploadFileName: { fontSize: 13, marginTop: 4, fontWeight: "500" },
  uploadChange: { fontSize: 12, marginTop: 2 },

  // Summary
  summaryBox: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
  },
  summaryTitle: { fontSize: 14, fontWeight: "700", marginBottom: 12 },
  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  summaryLabel: { fontSize: 13 },
  summaryValue: { fontSize: 13, fontWeight: "600", maxWidth: "65%", textAlign: "right" },

  // Buttons
  nextBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderRadius: 14,
    paddingVertical: 16,
    marginTop: 4,
  },
  nextBtnText: { color: "#fff", fontSize: 16, fontWeight: "700" },
  submitBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderRadius: 14,
    paddingVertical: 16,
    marginBottom: 16,
  },
  submitBtnText: { color: "#fff", fontSize: 16, fontWeight: "700" },

  disclaimer: { fontSize: 11, lineHeight: 16, textAlign: "center", marginTop: 4 },

  // Status screens
  statusContainer: { alignItems: "center", padding: 28 },
  statusBadge: {
    width: 120,
    height: 120,
    borderRadius: 60,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
    marginTop: 20,
  },
  statusTitle: { fontSize: 24, fontWeight: "800", marginBottom: 12 },
  statusSub: {
    fontSize: 14,
    lineHeight: 22,
    textAlign: "center",
    marginBottom: 16,
    maxWidth: 300,
  },
  statusMeta: { fontSize: 13, marginBottom: 24 },
  rejectionBox: { borderWidth: 1, borderRadius: 12, padding: 16, marginBottom: 20, width: "100%" },
  rejectionLabel: { fontSize: 12, fontWeight: "700", marginBottom: 6 },
  rejectionText: { fontSize: 14, lineHeight: 20 },
  resubmitBtn: {
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 32,
    marginTop: 4,
    marginBottom: 16,
  },
  resubmitBtnText: { color: "#fff", fontSize: 16, fontWeight: "700" },
  backToDash: {
    borderWidth: 1,
    borderRadius: 14,
    paddingVertical: 13,
    paddingHorizontal: 32,
    marginTop: 8,
  },
  backToDashText: { fontSize: 15, fontWeight: "600" },
});

export default KYCScreen;
