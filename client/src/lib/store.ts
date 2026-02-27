import { create } from "zustand";
import type { SourcePost, Draft } from "./db";

export type PlatformTab = "linkedin" | "twitter" | "instagram" | "newsletter";

interface HopperState {
  sourcePosts: SourcePost[];
  setSourcePosts: (posts: SourcePost[]) => void;

  selectedPostIndex: number;
  setSelectedPostIndex: (index: number) => void;
  moveSelection: (direction: "up" | "down") => void;

  drafts: Draft[];
  setDrafts: (drafts: Draft[]) => void;
  updateDraft: (id: number, content: string) => void;

  activeTab: PlatformTab;
  setActiveTab: (tab: PlatformTab) => void;

  isAiLoading: boolean;
  setAiLoading: (loading: boolean) => void;

  haterTooltip: string | null;
  setHaterTooltip: (text: string | null) => void;

  shaanMode: boolean;
  toggleShaanMode: () => void;

  soundEnabled: boolean;
  toggleSound: () => void;

  showSwipeFile: boolean;
  setShowSwipeFile: (show: boolean) => void;
}

export const useHopperStore = create<HopperState>((set, get) => ({
  sourcePosts: [],
  setSourcePosts: (posts) => set({ sourcePosts: posts }),

  selectedPostIndex: 0,
  setSelectedPostIndex: (index) => set({ selectedPostIndex: index }),
  moveSelection: (direction) => {
    const { selectedPostIndex, sourcePosts } = get();
    if (direction === "up" && selectedPostIndex > 0) {
      set({ selectedPostIndex: selectedPostIndex - 1 });
    } else if (
      direction === "down" &&
      selectedPostIndex < sourcePosts.length - 1
    ) {
      set({ selectedPostIndex: selectedPostIndex + 1 });
    }
  },

  drafts: [],
  setDrafts: (drafts) => set({ drafts }),
  updateDraft: (id, content) => {
    const { drafts } = get();
    set({
      drafts: drafts.map((d) =>
        d.id === id ? { ...d, content, updatedAt: new Date().toISOString() } : d,
      ),
    });
  },

  activeTab: "linkedin",
  setActiveTab: (tab) => set({ activeTab: tab }),

  isAiLoading: false,
  setAiLoading: (loading) => set({ isAiLoading: loading }),

  haterTooltip: null,
  setHaterTooltip: (text) => set({ haterTooltip: text }),

  shaanMode: false,
  toggleShaanMode: () => set((s) => ({ shaanMode: !s.shaanMode })),

  soundEnabled: true,
  toggleSound: () => set((s) => ({ soundEnabled: !s.soundEnabled })),

  showSwipeFile: false,
  setShowSwipeFile: (show) => set({ showSwipeFile: show }),
}));
