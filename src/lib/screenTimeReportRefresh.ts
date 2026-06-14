type RefreshListener = () => void;

const listeners = new Set<RefreshListener>();

/** Ask the app shell to remount Apple's DeviceActivityReport (fresh Screen Time pull). */
export function requestScreenTimeReportRefresh(): void {
  for (const listener of listeners) {
    try {
      listener();
    } catch {
      /* ignore */
    }
  }
}

export function subscribeScreenTimeReportRefresh(listener: RefreshListener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
