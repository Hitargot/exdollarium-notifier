import React, { useEffect, useRef, useState, useMemo } from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    StyleSheet,
    ScrollView,
    Image,
    Linking,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { captureRef } from 'react-native-view-shot';
import * as MediaLibrary from 'expo-media-library';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { RouteProp, useRoute, useNavigation } from '@react-navigation/native';
import { RootStackParamList } from './types';
import { Asset } from 'expo-asset';
import Constants from 'expo-constants';
import * as FileSystem from 'expo-file-system/legacy';
import { mapToUiStatus, highlightColor } from '../utils/statusMapper';
import showToast from '../utils/toast';
import ScreenHeader from '../components/ScreenHeader';
import appTheme from '../styles/theme';
import { useTheme } from '../theme/index';

import { getTransactionReceipt, getConfirmationReceipt } from '../api/client';
import { normalizeTransactionRef } from '../utils/receiptHelpers';

type ReceiptRouteProp = RouteProp<RootStackParamList, 'Receipt'>;

const ReceiptScreen = () => {
    const route = useRoute<ReceiptRouteProp>();
    const { receiptData: initialData } = route.params;
    const [receiptData, setReceiptData] = useState(initialData);

    const receiptRef = useRef<View>(null);
    const navigation = useNavigation<any>();
    const themeCtx = (() => { try { return useTheme(); } catch (e) { return undefined as any; } })();
    const theme = themeCtx || appTheme;
    const styles = useMemo(() => createStyles(theme), [theme]);

    const buildReceiptHtml = (data: any, logoDataUri?: string, watermarkDataUri?: string) => {
        const fields: any[] = data?.fields || [];
        const statusVal = (fields.find((f: any) => (f.label || '').toString() === 'Status') || {}).value || data?.status || '';
        const typeVal = (fields.find((f: any) => (f.label || '').toString() === 'Type') || {}).value || data?.type || '';
        const pdfText = theme.colors.text || '#111';
        const pdfMuted = theme.colors.muted || '#777';
        const pdfBorder = theme.colors.border || '#f0f0f3';
        const statusColor = statusVal ? highlightColor(String(statusVal), String(typeVal)) : pdfText;

        const rows = fields.map((f: any) => {
            const isStatus = (f.label || '') === 'Status';
            const displayVal = isStatus ? (mapToUiStatus(String(f.value)).label || String(f.value)) : String(f.value);
            return `
                <tr>
                    <td style="padding:10px 0;color:${pdfMuted};font-size:14px;border-bottom:1px solid ${pdfBorder}">${f.label}</td>
                    <td style="padding:10px 0;text-align:right;font-weight:700;color:${isStatus ? statusColor : pdfText};font-size:14px;border-bottom:1px solid ${pdfBorder}">${displayVal}</td>
                </tr>
            `;
        }).join('');

        return `
            <html>
                <body style="font-family:sans-serif;padding:30px;background:${theme.colors.background}">
                    <div style="position:relative;">
                        ${watermarkDataUri ? `<img src="${watermarkDataUri}" style="position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);width:80%;opacity:0.06;pointer-events:none;z-index:0;"/>` : ''}
                        <div style="position:relative;z-index:1;background:${theme.colors.surface};padding:25px;border-radius:15px;">
                            <div style="text-align:center;margin-bottom:20px;">
                                ${logoDataUri ? `<img src="${logoDataUri}" style="width:50px;height:50px;margin-bottom:10px"/>` : ''}
                                <h2 style="margin:0;color:${theme.colors.primary}">${data?.header?.brand || 'EXDOLLARIUM'}</h2>
                                ${(() => {
                                    const username = (data && (data.username || (data.user && data.user.username) || (data.header && data.header.username))) || '';
                                    return username ? `<div style="margin-top:6px;color:${pdfMuted};font-size:13px">Username: ${username}</div>` : '';
                                })()}
                            </div>
                            <table style="width:100%;border-collapse:collapse;">${rows}</table>
                        </div>
                    </div>
                </body>
            </html>`;
    };

    const handleCopy = async (text: string) => {
        await Clipboard.setStringAsync(text);
        showToast('Copied to clipboard!');
    };

    const handleDownloadReceipt = async () => {
        try {
            const { granted } = await MediaLibrary.requestPermissionsAsync();
            if (!granted) return showToast('Permission needed');
            const uri = await captureRef(receiptRef, { format: 'png', quality: 1 });
            const asset = await MediaLibrary.createAssetAsync(uri);
            await MediaLibrary.createAlbumAsync('EXDOLLARIUM Receipts', asset, false);
            showToast('Receipt saved to gallery.');
        } catch (err) { showToast('Error saving receipt'); }
    };

    const handleSharePdf = async () => {
        try {
        const asset = Asset.fromModule(require('../../assets/t1f18p.jpg'));
        const watermarkAsset = Asset.fromModule(require('../../assets/photo_2026-01-20_04-34-08-removebg-preview.png'));
        await Promise.all([asset.downloadAsync(), watermarkAsset.downloadAsync()]);
        const base64 = await FileSystem.readAsStringAsync(asset.localUri || asset.uri, { encoding: 'base64' });
        const watermarkBase64 = await FileSystem.readAsStringAsync(watermarkAsset.localUri || watermarkAsset.uri, { encoding: 'base64' });
        const html = buildReceiptHtml(receiptData, `data:image/png;base64,${base64}`, `data:image/png;base64,${watermarkBase64}`);
            const { uri } = await Print.printToFileAsync({ html });
            await Sharing.shareAsync(uri);
        } catch (err) { showToast('Could not generate PDF'); }
    };

    // Capture the receipt view as a PNG and return the file URI.
    const generateReceiptPng = async (): Promise<string | null> => {
        try {
            // captureRef will snapshot the receiptRef view (the visible receipt card)
            const uri = await captureRef(receiptRef, { format: 'png', quality: 1 });
            return uri;
        } catch (e) {
            console.warn('generateReceiptPng failed', e);
            return null;
        }
    };

    const handleOpenFile = (url: string) => {
        if (!url) return showToast('No file url');
        navigation.navigate('ImagePreview', { url });
    };

    const fields = receiptData?.fields || [];
    const findFieldValue = (labels: string[]) => {
        for (const lbl of labels) {
            const f = fields.find((x: any) => (x.label || '').toString().toLowerCase() === lbl.toLowerCase());
            if (f && f.value != null) return String(f.value);
        }
        return '';
    };

    const getField = (label: string) => findFieldValue([label, label.toLowerCase(), label.replace(/\s+/g, '')]);
    const topFields = fields.filter((f: any) => !['Amount', 'Service', 'Type'].includes(f.label));
    const otherFields = fields.filter((f: any) => !['Amount', 'Service', 'Type'].includes(f.label));

    useEffect(() => {
        let cancelled = false;
        const enrich = async () => {
            try {
                const receipt: any = { ...(receiptData || {}) };
                let txRef = receipt.transactionRef || receipt.transactionId || receipt.confirmationId;
                if (!txRef) {
                    const f = receipt.fields?.find((x: any) => (x.label || '').toLowerCase().includes('transaction id'));
                    if (f) txRef = f.value;
                }
                if (!txRef) return;
                const normalized = normalizeTransactionRef(txRef) || String(txRef);

                const [confResp, trxResp] = await Promise.all([
                    getConfirmationReceipt(normalized).catch(() => null),
                    getTransactionReceipt(normalized).catch(() => null)
                ]);
                if (cancelled) return;

                // Merge confirmation/transaction payloads into the receipt view so fields like Amount, Username are available.
                const source = confResp || trxResp || {};

                // Ensure receipt.fields exists and is mutable
                const existingFields: any[] = Array.isArray(receipt.fields) ? [...receipt.fields] : [];

                // Helper to upsert a field by label (case-insensitive)
                const upsertField = (label: string, value: any) => {
                    const idx = existingFields.findIndex((f: any) => ((f.label || '').toString().toLowerCase() === label.toLowerCase()));
                    if (idx >= 0) existingFields[idx] = { label, value };
                    else existingFields.push({ label, value });
                };

                // Username: prefer explicit username props from source, then source.user.username, then receipt header
                const username = source?.username || (source.user && source.user.username) || receipt?.header?.username || receipt.username || '';
                if (username) {
                    receipt.username = username;
                    if (!receipt.header) receipt.header = {};
                    receipt.header.username = username;
                }
                
                // Also ensure Service and Type are present from source if missing
                if (!existingFields.find(f => (f.label || '').toLowerCase() === 'service') && source?.service) {
                    upsertField('Service', source.service.name || source.service || '');
                }
                if (!existingFields.find(f => (f.label || '').toLowerCase() === 'type') && source?.type) {
                    upsertField('Type', source.type);
                }

                // Attach any file URLs from source if none exist yet
                if ((!receipt.fileUrls || receipt.fileUrls.length === 0) && Array.isArray(source?.fileUrls) && source.fileUrls.length > 0) {
                    receipt.fileUrls = source.fileUrls;
                }

                receipt.fields = existingFields;
                setReceiptData(receipt);
            } catch (e) { console.warn(e); }
        };
        enrich();
        return () => { cancelled = true; };
    }, []);

    return (
        <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
            <ScreenHeader 
                title={receiptData?.header?.title || 'Receipt'} 
                titleAlign="left" 
            />
            
            <ScrollView contentContainerStyle={styles.container}>
                {/* START CAPTURE AREA */}
                <View ref={receiptRef} collapsable={false} style={styles.receiptCard}>
                    <View style={styles.cardHeader}>
                        <View style={styles.brandRow}>
                            <Image source={require('../../assets/t1f18p.jpg')} style={styles.logo} />
                            <View style={{ marginLeft: 12 }}>
                                <Text style={styles.brandName}>{receiptData?.header?.brand || 'EXDOLLARIUM'}</Text>
                                <Text style={styles.dateText}>{getField('Date')}</Text>
                            </View>
                        </View>
                        <View style={styles.badge}>
                            <Text style={[styles.badgeText, { color: highlightColor(getField('Status') || '', getField('Type')) }]}>
                                {mapToUiStatus(getField('Status') || '').label}
                            </Text>
                        </View>
                    </View>

                    <View style={styles.divider} />

                    {/* HERO SECTION: Dynamic Amount/Service */}
                    <View style={styles.heroSection}>
                        {getField('Amount') ? (
                            <>
                                <Text style={styles.heroAmount}>{getField('Amount')}</Text>
                                <Text style={styles.heroService}>{getField('Service')}</Text>
                            </>
                        ) : (
                            <Text style={styles.heroAmountLarge}>{getField('Service') || 'Transaction'}</Text>
                        )}
                        <Text style={styles.heroType}>{getField('Type')}</Text>
                    </View>

                    {/* DATA ROWS */}
                    <View style={styles.detailsContainer}>
                        {otherFields.map((field: any, index: number) => (
                            <View key={index} style={styles.dataRow}>
                                <Text style={styles.rowLabel}>{field.label}</Text>
                                <View style={styles.rowValueContainer}>
                                    {Array.isArray(field.value) ? (
                                        field.value.map((url: string, i: number) => (
                                            <TouchableOpacity key={i} onPress={() => handleOpenFile(url)} style={styles.fileLink}>
                                                <Ionicons name="document-attach-outline" size={14} color={theme.colors.primary} />
                                                <Text style={styles.fileLinkText}>View File {field.value.length > 1 ? i+1 : ''}</Text>
                                            </TouchableOpacity>
                                        ))
                                    ) : (
                                        <View style={{flexDirection: 'row', alignItems: 'center'}}>
                                            <Text style={[
                                                styles.rowValue,
                                                field.label === 'Status' && { color: highlightColor(field.value, getField('Type')) }
                                            ]}>
                                                {field.label === 'Status' ? mapToUiStatus(field.value).label : field.value}
                                            </Text>
                                            {['Transaction ID', 'Service Tag'].includes(field.label) && (
                                                <TouchableOpacity onPress={() => handleCopy(field.value)} style={{marginLeft: 5}}>
                                                    <Ionicons name="copy-outline" size={14} color={theme.colors.muted} />
                                                </TouchableOpacity>
                                            )}
                                        </View>
                                    )}
                                </View>
                            </View>
                        ))}
                    </View>

                    <Text style={styles.footerBrand}>Thank you for using EXDOLLARIUM.</Text>
                </View>

                {/* ACTION BUTTONS */}
                <View style={styles.buttonGroup}>
                    <TouchableOpacity style={styles.btnPrimary} onPress={handleDownloadReceipt}>
                        <Ionicons name="download-outline" size={18} color="#FFF" />
                        <Text style={styles.btnText}>Save</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.btnSecondary} onPress={handleSharePdf}>
                        <Ionicons name="document-text-outline" size={18} color={theme.colors.text} />
                        <Text style={[styles.btnText, {color: theme.colors.text}]}>PDF</Text>
                    </TouchableOpacity>
                    {/* share button removed per request */}
                </View>

                <TouchableOpacity
                    style={styles.reportContainer}
                    onPress={async () => {
                        // Build a helpful prefilled subject/message containing transaction details
                        const txId = getField('Transaction ID') || getField('transactionId') || getField('TransactionId') || '';
                        const svc = getField('Service') || '';
                        const amt = getField('Amount') || '';
                        const date = getField('Date') || '';
                        const subject = txId ? `Issue with transaction ${txId}` : `Issue with ${svc || 'transaction'}`;
                        const initialMessage = `Hi support,\n\nI have an issue with the following transaction:\nService: ${svc}\nAmount: ${amt}\nTransaction ID: ${txId}\nDate: ${date}\n\nPlease assist.`;
                        // Attempt to auto-generate a PNG screenshot of this receipt and pass it as an attachment to Tickets
                        const pngUri = await generateReceiptPng();
                        const attachments = pngUri ? [{ uri: pngUri, name: 'receipt.png', type: 'image/png' }] : [];
                        navigation.navigate('Tickets', { subject, initialMessage, receipt: receiptData, attachments });
                    }}
                >
                    <Text style={styles.reportText}>Report an issue</Text>
                </TouchableOpacity>
            </ScrollView>
        </View>
    );
};

const createStyles = (t: any) => StyleSheet.create({
    container: { padding: 16, paddingBottom: 40 },
    receiptCard: {
        backgroundColor: t.colors.surface,
        borderRadius: 20,
        padding: 20,
        width: '100%',
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 10,
        elevation: 2,
    },
    cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    brandRow: { flexDirection: 'row', alignItems: 'center' },
    logo: { width: 40, height: 40, borderRadius: 8 },
    brandName: { fontSize: 16, fontWeight: 'bold', color: t.colors.text },
    dateText: { fontSize: 12, color: t.colors.muted },
    badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6, backgroundColor: t.colors.background },
    badgeText: { fontSize: 11, fontWeight: 'bold' },
    divider: { height: 1, backgroundColor: t.colors.border, marginVertical: 20, borderStyle: 'dashed' },
    heroSection: { alignItems: 'center', marginBottom: 25 },
    heroAmount: { fontSize: 32, fontWeight: '800', color: t.colors.primary },
    heroAmountLarge: { fontSize: 22, fontWeight: '700', color: t.colors.text, textAlign: 'center' },
    heroService: { fontSize: 16, color: t.colors.text, marginTop: 4, fontWeight: '500' },
    heroType: { fontSize: 12, color: t.colors.muted, marginTop: 4, textTransform: 'uppercase', letterSpacing: 1 },
    detailsContainer: { marginTop: 10 },
    dataRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 12, borderBottomWidth: 0.5, borderBottomColor: t.colors.border },
    rowLabel: { fontSize: 13, color: t.colors.muted, flex: 1 },
    rowValueContainer: { flex: 2, alignItems: 'flex-end' },
    rowValue: { fontSize: 13, fontWeight: '600', color: t.colors.text, textAlign: 'right' },
    fileLink: { flexDirection: 'row', alignItems: 'center', backgroundColor: t.colors.background, padding: 6, borderRadius: 6, marginBottom: 4 },
    fileLinkText: { fontSize: 12, color: t.colors.primary, marginLeft: 4, fontWeight: '600' },
    footerBrand: { textAlign: 'center', fontSize: 11, color: t.colors.muted, marginTop: 30 },
    buttonGroup: { flexDirection: 'row', marginTop: 25, gap: 10 },
    btnPrimary: { flex: 2, backgroundColor: t.colors.primary, height: 50, borderRadius: 12, flexDirection: 'row', justifyContent: 'center', alignItems: 'center' },
    btnSecondary: { flex: 1, backgroundColor: t.colors.surface, height: 50, borderRadius: 12, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: t.colors.border },
    btnText: { color: '#FFF', fontWeight: 'bold', marginLeft: 8 },
    reportContainer: { marginTop: 25, alignSelf: 'center' },
    reportText: { color: t.colors.muted, textDecorationLine: 'underline', fontSize: 13 }
});

export default ReceiptScreen;