import Constants from 'expo-constants';
import { formatSignedAmount } from './formatAmount';

export const buildTransactionReceipt = (trx: any) => {
  const fields: any[] = [];

  // Fallback logic for sender/recipient names
  const senderName = (trx.senderId?.fullName?.trim() && trx.senderId.fullName.trim() !== 'undefined undefined')
    ? trx.senderId.fullName
    : (trx.senderId?.username || trx.senderId?.payId || null);
  
  const recipientName = (trx.recipientId?.fullName?.trim() && trx.recipientId.fullName.trim() !== 'undefined undefined')
    ? trx.recipientId.fullName
    : (trx.recipientId?.username || trx.recipientId?.payId || null);

  fields.push({ label: 'Type', value: trx.type || 'N/A' });

  if (trx.amount !== undefined && trx.amount !== null) {
    fields.push({ label: 'Amount', value: formatSignedAmount(trx.amount, trx.type) });
  }

  if (senderName) fields.push({ label: 'Sender', value: senderName });
  if (recipientName) fields.push({ label: 'Recipient', value: recipientName });

  const feeCandidates = ['fee', 'fees', 'charge', 'transactionFee', 'withdrawFee', 'withdrawalFee'];
  let feeVal: any = null;
  for (const k of feeCandidates) {
    if (trx[k] !== undefined && trx[k] !== null) { feeVal = trx[k]; break; }
  }
  if (feeVal !== undefined && feeVal !== null && Number(feeVal) !== 0) {
    fields.push({ label: 'Fee', value: `₦${Number(feeVal).toLocaleString()}` });
  }

  const txId = trx.transactionId || trx._id || trx.id || null;
  fields.push({ label: 'Transaction ID', value: txId, copyable: true });

  const dateRaw = trx.date || trx.createdAt || trx.updatedAt || null;
  const isoDate = dateRaw ? (new Date(dateRaw)).toISOString() : '';
  fields.push({ label: 'Date', value: isoDate });

  fields.push({ label: 'Status', value: trx.status || 'N/A' });

  if (trx.bankMeta) fields.push({ label: 'Bank', value: trx.bankMeta });
  
  const acctName = trx.accountName || trx.accountHolderName || (trx.bank && (trx.bank.accountName || trx.bank.accountHolderName));
  if (acctName) fields.push({ label: 'Account Name', value: acctName });
  
  if (trx.note) fields.push({ label: 'Note', value: trx.note });

  const receipt: any = { 
    title: 'Transaction Receipt', 
    date: isoDate, 
    fields, 
    header: { brand: 'EXDOLLARIUM', title: 'Official Transaction Receipt' } 
  };

  const username = trx.username || (trx.user && trx.user.username) || trx.initiator?.username || null;
  if (username) receipt.header.username = username;

  const email = trx.email || (trx.user && trx.user.email) || trx.initiator?.email || null;
  if (email) receipt.header.email = email;

  if (txId) receipt.transactionRef = txId;

  return receipt;
};

export const buildConfirmationReceipt = (conf: any) => {
  const fields: any[] = [];
  fields.push({ label: 'Type', value: conf.type || 'Trade Confirmation' });
  if (conf.amount !== undefined && conf.amount !== null) {
    const { formatSignedAmount } = require('./formatAmount');
    fields.push({ label: 'Amount', value: formatSignedAmount(conf.amount, conf.type) });
  }
  fields.push({ label: 'Service', value: conf.serviceName || conf.serviceId?.name || 'N/A' });
  fields.push({ label: 'Service Tag', value: conf.serviceTag || conf.tag || 'N/A' });
  const txId = conf.transactionId || conf._id || conf.id || null;
  fields.push({ label: 'Transaction ID', value: txId, copyable: true });
  const dateRaw = conf.date || conf.createdAt || conf.updatedAt || null;
  const isoDate = dateRaw ? (new Date(dateRaw)).toISOString() : '';
  fields.push({ label: 'Date', value: isoDate });
  fields.push({ label: 'Status', value: conf.status || 'N/A' });
  if (Array.isArray(conf.fileUrls) && conf.fileUrls.length > 0) {
    fields.push({ label: 'Files', value: conf.fileUrls });
  } else if (conf.fileUrl) {
    fields.push({ label: 'Files', value: [conf.fileUrl] });
  }
  // Show user-submitted and admin-provided foreign amounts separately when available
  // userAmountInForeignCurrency: amount provided by the user when creating the confirmation
  // adminForeignAmount / amountInForeignCurrency: amount set by admin when funding (legacy amountInForeignCurrency may be present)
  try {
    const userAmount = conf.userAmountInForeignCurrency ?? null;
    const userCurrency = (conf.userSelectedCurrency || conf.userCurrency || conf.selectedCurrency || '').toUpperCase();
    const adminAmount = conf.adminForeignAmount ?? conf.amountInForeignCurrency ?? null;
    const adminCurrency = (conf.adminSelectedCurrency || conf.adminCurrency || conf.selectedCurrency || '').toUpperCase();

    const pushIfPresent = (label: string, val: any) => {
      if (val === null || val === undefined) return;
      const n = typeof val === 'number' ? val : parseFloat(val);
      if (Number.isNaN(n)) return;
      fields.push({ label, value: `${n.toLocaleString()} ${label.includes('in') ? (label.split('in ')[1] || '') : ''}`.trim() });
    };

  if (userAmount) pushIfPresent(`Amount input in ${userCurrency || 'selected currency'}`, userAmount);
  if (adminAmount) pushIfPresent(`Amount funded in ${adminCurrency || 'selected currency'}`, adminAmount);

    // Always include NGN amount and exchange rate if present
    if (conf.amountInNaira !== undefined && conf.amountInNaira !== null) {
      const n = Number(conf.amountInNaira);
      if (!Number.isNaN(n)) fields.push({ label: 'Amount in Naira', value: `₦${n.toLocaleString()}` });
    }
    if (conf.exchangeRateUsed !== undefined && conf.exchangeRateUsed !== null) {
      const r = Number(conf.exchangeRateUsed);
      if (!Number.isNaN(r)) {
        const rateCurrency = adminCurrency || userCurrency || (conf.selectedCurrency || '').toUpperCase() || 'unit';
        fields.push({ label: 'Exchange Rate', value: `₦${r.toLocaleString()} per ${rateCurrency}` });
      }
    }
  } catch (e) {
    // avoid throwing from optional formatting
  }
  // Include account name / recipient name when present on confirmation objects
  const confAcct = conf.accountName || conf.recipientName || conf.accountHolder;
  if (confAcct) fields.push({ label: 'Account Name', value: confAcct });
  if (conf.note) fields.push({ label: 'Note', value: conf.note });
  const receipt: any = { title: 'Confirmation Receipt', date: isoDate, fields, header: { brand: 'EXDOLLARIUM', title: 'Official Confirmation Receipt' } };
  // include username when available on confirmation objects
  const confUser = conf.username || (conf.user && conf.user.username) || conf.initiator?.username || null;
  if (confUser) receipt.header.username = confUser;
  // include email when available on confirmation objects
  const confEmail = conf.email || (conf.user && conf.user.email) || conf.initiator?.email || null;
  if (confEmail) receipt.header.email = confEmail;
  if (txId) receipt.transactionRef = txId;
  return receipt;
};
