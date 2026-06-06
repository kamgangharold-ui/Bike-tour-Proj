import { create } from 'zustand';

// Transient in-app banner for foreground real-time events (Drop 2). The dispatcher
// (src/utils/notify.ts) sets it; <EventBanner> renders + auto-clears it.
export type BannerKind = 'navigation' | 'alert' | 'info';

export interface BannerData {
  id: number;
  kind: BannerKind;
  title: string;
  body: string;
}

interface EventBannerState {
  banner: BannerData | null;
  show: (b: Omit<BannerData, 'id'>) => void;
  clear: (id?: number) => void;
}

let seq = 0;

export const useEventBanner = create<EventBannerState>((set, get) => ({
  banner: null,
  show: (b) => set({ banner: { ...b, id: ++seq } }),
  // Clear only if the visible banner is still the one we scheduled (avoids a
  // stale timer wiping a newer banner).
  clear: (id) => {
    if (id == null || get().banner?.id === id) set({ banner: null });
  },
}));
