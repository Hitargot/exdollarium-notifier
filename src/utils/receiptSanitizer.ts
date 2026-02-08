// Small sanitizer to ensure receipts passed via navigation are serializable
export function sanitizeReceipt(r: any) {
  if (!r || typeof r !== 'object') return r;
  const isReactElement = (v: any) => v && typeof v === 'object' && v.$$typeof !== undefined;
  const cloned: any = { ...r };
  cloned.fields = (r.fields || []).map((f: any) => {
    let value = f.value;
    if (isReactElement(value)) {
      value = '[attachment]';
    } else if (Array.isArray(value)) {
      value = value
        .map((v2: any) => {
          if (typeof v2 === 'string' || typeof v2 === 'number' || typeof v2 === 'boolean') return v2;
          if (v2 && typeof v2 === 'object') {
            if (v2.uri) return v2.uri;
            if (v2.props && typeof v2.props.children === 'string') return v2.props.children;
            try { return JSON.stringify(v2); } catch { return String(v2); }
          }
          return String(v2);
        })
        .filter(Boolean);
    }
    return { ...f, value };
  });
  if (cloned.transactionRef) cloned.transactionRef = String(cloned.transactionRef);
  // Ensure a consistent header is present so all receipts can show branding/UI header
  if (!cloned.header || typeof cloned.header !== 'object') {
    cloned.header = { brand: 'EXDOLLARIUM', title: cloned.title || 'Receipt' };
  } else {
    // ensure minimal defaults
    if (!cloned.header.brand) cloned.header.brand = 'EXDOLLARIUM';
    if (!cloned.header.title) cloned.header.title = cloned.title || 'Receipt';
  }
  return cloned;
}
