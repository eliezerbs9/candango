/**
 * Tiny toast store (zero deps). `showToast(message, type)` from anywhere; the
 * <ToastHost/> mounted in the root layout renders + auto-dismisses it.
 */
import { create } from 'zustand';

export type ToastType = 'success' | 'error';
export type Toast = { id: number; message: string; type: ToastType };

type ToastState = {
  toast: Toast | null;
  show: (message: string, type?: ToastType) => void;
  clear: () => void;
};

let counter = 0;

export const useToastStore = create<ToastState>((set) => ({
  toast: null,
  show: (message, type = 'success') => set({ toast: { id: (counter += 1), message, type } }),
  clear: () => set({ toast: null }),
}));

/** Imperative helper usable outside React (e.g. the query client). */
export const showToast = (message: string, type: ToastType = 'success') =>
  useToastStore.getState().show(message, type);
