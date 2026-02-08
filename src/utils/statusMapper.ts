export const mapToUiStatus = (s?: string) => {
  if (!s) return { key: 'processing', label: 'Processing' };
  const st = String(s).toLowerCase();
  const processing = ['queued', 'pending', 'processing', 'inprogress', 'initiated'];
  // Status groups
  const success = ['success', 'successful', 'succeeded', 'completed', 'ok'];
  const fundedStatuses = ['funded', 'funding'];
  const failed = ['failed', 'error', 'declined', 'rejected', 'cancelled'];
  if (processing.includes(st)) return { key: 'processing', label: 'Processing' };
  if (fundedStatuses.includes(st)) return { key: 'funded', label: 'Funded' };
  if (success.includes(st)) return { key: 'success', label: 'Success' };
  if (failed.includes(st)) return { key: 'failed', label: 'Failed' };
  return { key: 'unknown', label: String(s) };
};

export const highlightColor = (status?: string, type?: string) => {
  const mapped = mapToUiStatus(status);
  // Withdrawals use a slightly warmer orange for processing
  if (type && String(type).toLowerCase() === 'withdrawal' && mapped.key === 'processing') return '#FF8C42';
  if (mapped.key === 'success') return '#1DBF73';
  if (mapped.key === 'funded') return '#1DBF73';
  if (mapped.key === 'processing') return '#FFA500';
  if (mapped.key === 'failed') return '#FF3B30';
  return '#444';
};

export default { mapToUiStatus, highlightColor };
