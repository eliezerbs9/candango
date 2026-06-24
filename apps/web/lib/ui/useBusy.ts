import { create } from 'zustand';

/**
 * App-wide "busy" indicator for async actions that block a UI step
 * (e.g. fetching a document from QuickBooks before opening a composer).
 * Use `runBusy(message, fn)` to show the global loader for the duration of `fn`.
 * Counts concurrent users so overlapping calls don't hide it early.
 */
type BusyState = {
  count: number;
  message: string | null;
  begin: (message?: string) => void;
  end: () => void;
};

export const useBusyStore = create<BusyState>((set) => ({
  count: 0,
  message: null,
  begin: (message) => set((s) => ({ count: s.count + 1, message: message ?? s.message })),
  end: () =>
    set((s) => {
      const count = Math.max(0, s.count - 1);
      return { count, message: count === 0 ? null : s.message };
    }),
}));

/** Run an async task while showing the global loader. */
export async function runBusy<T>(message: string, fn: () => Promise<T>): Promise<T> {
  const { begin, end } = useBusyStore.getState();
  begin(message);
  try {
    return await fn();
  } finally {
    end();
  }
}
