import { create } from 'zustand';

interface LandmarkData {
  activeSlug: string;
  activeName: string;
  activeDescription: string;
  activeCategory: string;
  activeIsRegulatory: boolean;
  activeRegulatoryMessage: string;
  activeRegulatoryFineEur: number;
  activeAffiliateUrl: string;
  activeAudioUrl: string;
}

interface AppState extends LandmarkData {
  isSubscribed: boolean;
  biciboxJson: string;
  biciparkJson: string;
  enterLandmark: (data: LandmarkData) => void;
  exitLandmark: (slug: string) => void;
  setSubscribed: (val: boolean) => void;
  setBiciboxJson: (json: string) => void;
  setBiciparkJson: (json: string) => void;
}

const CLEARED: LandmarkData = {
  activeSlug: '',
  activeName: '',
  activeDescription: '',
  activeCategory: '',
  activeIsRegulatory: false,
  activeRegulatoryMessage: '',
  activeRegulatoryFineEur: 0,
  activeAffiliateUrl: '',
  activeAudioUrl: '',
};

export const useAppStore = create<AppState>((set, get) => ({
  ...CLEARED,
  isSubscribed: false,
  biciboxJson: '',
  biciparkJson: '',
  enterLandmark: (data) => set(data),
  exitLandmark: (slug) => {
    if (get().activeSlug === slug) set(CLEARED);
  },
  setSubscribed: (val) => set({ isSubscribed: val }),
  setBiciboxJson: (json) => set({ biciboxJson: json }),
  setBiciparkJson: (json) => set({ biciparkJson: json }),
}));
