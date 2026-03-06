import { useEffect, useCallback, useState, useRef } from "react";
import { useHotkeys } from "react-hotkeys-hook";
import { useHopperStore, type PlatformTab } from "@/lib/store";
import { db, loadLiveFeed, type Draft } from "@/lib/db";
import SourceFeed from "@/components/source-feed";
import Workshop from "@/components/workshop";
import Preview from "@/components/preview";
import Trash from "@/components/trash";
import Settings from "@/components/settings";
import { playApproveSound, playRejectSound } from "@/lib/sounds";
import {
  Trash2,
  Volume2,
  VolumeX,
  Keyboard,
  Undo2,
  Redo2,
  Settings as SettingsIcon,
  ChevronDown,
  Cpu,
  Check,
  GraduationCap,
} from "lucide-react";
import { getOnboardingComplete, startOnboarding } from "@/lib/onboarding";
import { aiPunchier, aiHater, aiShaan, runGeneration } from "@/lib/api";
import { approveDraft } from "@/lib/draftActions";
import { fetchOllamaModels } from "@/lib/agenticPipeline";
import type { ModelChoice } from "@/lib/agenticPipeline";
import { AnimatePresence, motion } from "framer-motion";
import { initOramaIndex } from "@/lib/oramaSearch";
import { loadTrainingData } from "@/lib/trainingData";
import { useToast } from "@/hooks/use-toast";
import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from "@/components/ui/resizable";

export default function Dashboard() {
  const {
    setSourcePosts,
    setDrafts,
    sourcePosts,
    selectedPostIndex,
    drafts,
    activeTab,
    soundEnabled,
    toggleSound,
    setShowTrash,
    setShowSettings,
    setAiLoading,
    isAiLoading,
    setProfilePhoto,
    setPlatformLoading,
    pushHistory,
    undo,
    redo,
    canUndo,
    canRedo,
    triggerExport,
    selectedModel,
    setSelectedModel,
    lastContextPostIds,
    openRejectPopover,
  } = useHopperStore();

  const { toast } = useToast();

  // ── Onboarding: show on first load, persist completion ──
  const [onboardingChecked, setOnboardingChecked] = useState(false);
  useEffect(() => {
    if (onboardingChecked) return;
    getOnboardingComplete().then((complete) => {
      setOnboardingChecked(true);
      if (!complete) {
        setTimeout(() => startOnboarding(), 500);
      }
    });
  }, [onboardingChecked]);

  // ── Ollama model discovery ──
  const [ollamaModels, setOllamaModels] = useState<string[]>([]);
  const [modelMenuOpen, setModelMenuOpen] = useState(false);
  const modelMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchOllamaModels().then(setOllamaModels);
  }, []);

  useEffect(() => {
    if (!modelMenuOpen) return;
    function handleClick(e: MouseEvent) {
      if (modelMenuRef.current && !modelMenuRef.current.contains(e.target as Node)) {
        setModelMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [modelMenuOpen]);

  function getModelLabel(m: ModelChoice, short = false): string {
    if (m === "claude") return "Claude";
    if (m.startsWith("ollama:")) {
      const modelName = m.slice("ollama:".length);
      return short ? `Haiku + ${modelName}` : `Haiku + ${modelName}`;
    }
    return m;
  }

  const selectedPost = sourcePosts[selectedPostIndex];
  const activeDraft = drafts.find(
    (d) =>
      d.sourcePostId === selectedPost?.id &&
      d.platform === activeTab &&
      (d.status === "draft" || d.status === "approved"),
  );

  const TABS: PlatformTab[] = [
    "linkedin",
    "twitter",
    "instagram",
    "newsletter",
    "quote",
  ];

  const ignoreWhenTyping = (e: KeyboardEvent) => {
    const tag = (e.target as HTMLElement)?.tagName;
    return tag === "TEXTAREA" || tag === "INPUT";
  };

  useHotkeys(
    "l",
    () => useHopperStore.getState().setActiveTab("linkedin"),
    { preventDefault: true, ignoreEventWhen: ignoreWhenTyping },
  );
  useHotkeys(
    "x",
    () => useHopperStore.getState().setActiveTab("twitter"),
    { preventDefault: true, ignoreEventWhen: ignoreWhenTyping },
  );
  useHotkeys(
    "i",
    () => useHopperStore.getState().setActiveTab("instagram"),
    { preventDefault: true, ignoreEventWhen: ignoreWhenTyping },
  );
  useHotkeys(
    "n",
    () => useHopperStore.getState().setActiveTab("newsletter"),
    { preventDefault: true, ignoreEventWhen: ignoreWhenTyping },
  );
  useHotkeys(
    "q",
    () => useHopperStore.getState().setActiveTab("quote"),
    { preventDefault: true, ignoreEventWhen: ignoreWhenTyping },
  );

  useHotkeys(
    "mod+z",
    () => {
      if (!canUndo) return;
      undo();
    },
    { preventDefault: true, enableOnFormTags: true },
    [canUndo, undo],
  );

  useHotkeys(
    "mod+shift+z",
    () => {
      if (!canRedo) return;
      redo();
    },
    { preventDefault: true, enableOnFormTags: true },
    [canRedo, redo],
  );

  // ── G: Generate (single-step, model-routed) ──
  useHotkeys(
    "g",
    async () => {
      if (!selectedPost || isAiLoading) return;
      pushHistory();
      setAiLoading(true);

      try {
        const currentModel = useHopperStore.getState().selectedModel;
        const result = await runGeneration(
          selectedPost.content,
          activeTab,
          currentModel,
        );

        useHopperStore
          .getState()
          .setLastContextPostIds(result.contextPostIds);

        const newDraft: Draft = {
          sourcePostId: selectedPost.id!,
          platform: activeTab,
          content: result.content,
          status: "draft",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };

        if (activeDraft?.id) {
          await db.drafts.update(activeDraft.id, {
            content: result.content,
            updatedAt: new Date().toISOString(),
          });
          useHopperStore
            .getState()
            .updateDraft(activeDraft.id, result.content);
        } else {
          await db.drafts.add(newDraft);
          const allDrafts = await db.drafts.toArray();
          setDrafts(allDrafts);
        }
      } catch (error: any) {
        toast({
          title: "Generation failed",
          description: error.message,
          variant: "destructive",
        });
      } finally {
        setAiLoading(false);
      }
    },
    {
      preventDefault: true,
      enabled: !isAiLoading && !!selectedPost,
      ignoreEventWhen: ignoreWhenTyping,
    },
    [selectedPost, activeTab, activeDraft, isAiLoading, pushHistory],
  );

  // On mount: load from cache only — no API calls
  const loadFromCache = useCallback(async () => {
    const posts = await db.sourcePosts
      .orderBy("timestamp")
      .reverse()
      .toArray();
    setSourcePosts(posts);
    const allDrafts = await db.drafts.toArray();
    setDrafts(allDrafts);
  }, [setSourcePosts, setDrafts]);

  useEffect(() => {
    loadFromCache().then(async () => {
      // Load training_data.jsonl into Historical_Posts, then init RAG index
      await loadTrainingData();
      initOramaIndex().catch(console.error);
    });
  }, [loadFromCache]);

  // Explicit refresh: hits the API for the given platform (or all), dedupes, and saves to DB
  const refreshFeed = useCallback(
    async (platform?: "twitter" | "linkedin" | "instagram") => {
      useHopperStore.getState().setOnboardingDidRefresh(true);
      setPlatformLoading(platform ?? null, true);

      try {
        const { posts: livePosts, profilePhoto } = await loadLiveFeed(
          platform,
          true,
        );

        if (livePosts.length > 0) {
          if (platform) {
            await db.sourcePosts
              .where("platform")
              .equals(platform)
              .delete();
            await db.sourcePosts.bulkAdd(livePosts);
          } else {
            const existingPosts = await db.sourcePosts.toArray();
            const existingContentSet = new Set(
              existingPosts.map((p) => p.content.slice(0, 100)),
            );
            const newPosts = livePosts.filter(
              (p) => !existingContentSet.has(p.content.slice(0, 100)),
            );
            if (newPosts.length > 0) {
              await db.sourcePosts.bulkAdd(newPosts);
            }
          }

          if (profilePhoto) {
            setProfilePhoto(profilePhoto);
          }
        }
      } catch (e) {
        console.error("Live feed failed:", e);
        toast({
          title: "Feed refresh failed",
          description:
            e instanceof Error
              ? e.message
              : "Could not load posts. Check Settings for API keys.",
          variant: "destructive",
        });
      }

      const posts = await db.sourcePosts
        .orderBy("timestamp")
        .reverse()
        .toArray();
      setSourcePosts(posts);
      const allDrafts = await db.drafts.toArray();
      setDrafts(allDrafts);
      setPlatformLoading(platform ?? null, false);
    },
    [setPlatformLoading, setProfilePhoto, setSourcePosts, setDrafts],
  );

  useHotkeys(
    "shift+r",
    () => refreshFeed(),
    { preventDefault: true, ignoreEventWhen: ignoreWhenTyping },
  );

  // ── A: Approve — save to vault, increment weight_score on RAG context posts ──
  useHotkeys(
    "a",
    async () => {
      if (!activeDraft?.id) return;
      pushHistory();

      await approveDraft({
        draftId: activeDraft.id,
        sourcePostId: activeDraft.sourcePostId,
        platform: activeTab,
        finalText: activeDraft.content,
        contextPostIds: lastContextPostIds,
      });

      if (soundEnabled) playApproveSound();
      toast({ title: "Draft approved & saved to vault" });
      const allDrafts = await db.drafts.toArray();
      setDrafts(allDrafts);
    },
    {
      preventDefault: true,
      enabled: !!activeDraft,
      ignoreEventWhen: ignoreWhenTyping,
    },
    [activeDraft, activeTab, lastContextPostIds, soundEnabled, pushHistory],
  );

  // ── R: Reject — show reason popover (handled by Workshop) ──
  useHotkeys(
    "r",
    () => {
      if (!activeDraft?.id) return;
      pushHistory();
      openRejectPopover({
        id: activeDraft.id,
        sourcePostId: activeDraft.sourcePostId,
        content: activeDraft.content,
        platform: activeDraft.platform,
      });
    },
    {
      preventDefault: true,
      enabled: !!activeDraft,
      ignoreEventWhen: ignoreWhenTyping,
    },
    [activeDraft, pushHistory, openRejectPopover],
  );

  useHotkeys(
    "mod+enter",
    () => {
      useHopperStore.getState().triggerExport?.();
    },
    { preventDefault: true, enableOnFormTags: true },
  );

  useHotkeys(
    "p",
    async () => {
      if (!activeDraft || isAiLoading) return;
      pushHistory();
      setAiLoading(true);
      try {
        const data = await aiPunchier(activeDraft.content);
        if (activeDraft.id) {
          await db.drafts.update(activeDraft.id, {
            content: data.content,
            updatedAt: new Date().toISOString(),
          });
          useHopperStore
            .getState()
            .updateDraft(activeDraft.id, data.content);
        }
      } catch {
      } finally {
        setAiLoading(false);
      }
    },
    {
      preventDefault: true,
      enabled: !!activeDraft && !isAiLoading,
      ignoreEventWhen: ignoreWhenTyping,
    },
    [activeDraft, isAiLoading, pushHistory],
  );

  useHotkeys(
    "h",
    async () => {
      if (!activeDraft || isAiLoading) return;
      setAiLoading(true);
      try {
        const data = await aiHater(activeDraft.content);
        useHopperStore.getState().setHaterTooltip(data.content);
        setTimeout(
          () => useHopperStore.getState().setHaterTooltip(null),
          12000,
        );
      } catch {
      } finally {
        setAiLoading(false);
      }
    },
    {
      preventDefault: true,
      enabled: !!activeDraft && !isAiLoading,
      ignoreEventWhen: ignoreWhenTyping,
    },
    [activeDraft, isAiLoading],
  );

  useHotkeys(
    "s",
    async () => {
      if (!activeDraft || isAiLoading) return;
      pushHistory();
      setAiLoading(true);
      try {
        const data = await aiShaan(activeDraft.content);
        if (activeDraft.id) {
          await db.drafts.update(activeDraft.id, {
            content: data.content,
            updatedAt: new Date().toISOString(),
          });
          useHopperStore
            .getState()
            .updateDraft(activeDraft.id, data.content);
        }
      } catch {
      } finally {
        setAiLoading(false);
      }
    },
    {
      preventDefault: true,
      enabled: !!activeDraft && !isAiLoading,
      ignoreEventWhen: ignoreWhenTyping,
    },
    [activeDraft, isAiLoading, pushHistory],
  );

  return (
    <div className="h-screen flex flex-col bg-[#FAFAFA]">
      <header className="flex items-center justify-between h-[49px] px-5 border-b border-[#E5E5E5] bg-white flex-shrink-0">
        <div className="flex items-center gap-3">
          <h1 className="text-[15px] font-bold text-[#111827] tracking-tight" data-onboarding-welcome>
            Content Engine
          </h1>

          {/* ── Model Selector ── */}
          <div className="relative" ref={modelMenuRef}>
            <button
              data-testid="button-model-selector"
              onClick={() => setModelMenuOpen((o) => !o)}
              className="inline-flex items-center gap-1.5 h-7 px-2.5 text-[11px] font-medium text-[#555] bg-[#FAFAFA] border border-[#E5E5E5] hover:bg-[#F0F0F0] transition-colors"
              style={{ borderRadius: "3px" }}
              title="Select AI model"
            >
              <Cpu className="w-3 h-3" />
              <span className="max-w-[90px] truncate">{getModelLabel(selectedModel)}</span>
              <ChevronDown className="w-2.5 h-2.5 opacity-50" />
            </button>

            <AnimatePresence>
              {modelMenuOpen && (
                <motion.div
                  initial={{ opacity: 0, y: 4, scale: 0.97 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 4, scale: 0.97 }}
                  transition={{ duration: 0.1 }}
                  className="absolute left-0 top-8 z-50 bg-white border border-[#E5E5E5] min-w-[190px] py-1"
                  style={{ borderRadius: "4px", boxShadow: "0 4px 16px rgba(0,0,0,0.1)" }}
                >
                  <p className="px-3 pt-1.5 pb-1 text-[9px] font-semibold uppercase tracking-wider text-[#BBB]">Cloud</p>
                  <button
                    onClick={() => { setSelectedModel("claude"); setModelMenuOpen(false); }}
                    className={`w-full text-left px-3 py-1.5 text-[12px] flex items-center gap-2 transition-colors ${selectedModel === "claude"
                      ? "bg-[#F5F5F5] text-[#111827] font-medium"
                      : "text-[#444] hover:bg-[#FAFAFA]"
                      }`}
                  >
                    {selectedModel === "claude" ? <Check className="w-3 h-3 text-[#111827]" /> : <span className="w-3" />}
                    Claude
                  </button>

                  <div className="border-t border-[#F0F0F0] my-1" />
                  <p className="px-3 pb-1 text-[9px] font-semibold uppercase tracking-wider text-[#BBB]">Haiku + Ollama (local)</p>
                  {ollamaModels.length > 0 ? ollamaModels.map((m) => {
                    const choice: ModelChoice = `ollama:${m}`;
                    return (
                      <button
                        key={m}
                        onClick={() => { setSelectedModel(choice); setModelMenuOpen(false); }}
                        className={`w-full text-left px-3 py-1.5 text-[12px] flex items-center gap-2 transition-colors ${selectedModel === choice
                          ? "bg-[#F5F5F5] text-[#111827] font-medium"
                          : "text-[#444] hover:bg-[#FAFAFA]"
                          }`}
                      >
                        {selectedModel === choice ? <Check className="w-3 h-3 text-[#111827]" /> : <span className="w-3" />}
                        <span className="truncate flex-1">{m}</span>
                        <span className="text-[9px] text-[#BBB] font-normal shrink-0">via Haiku</span>
                      </button>
                    );
                  }) : (
                    <p className="px-3 pb-2 text-[10px] text-[#BBB] italic">No models found — is Ollama running?</p>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center">
            <button
              data-testid="button-undo"
              onClick={() => undo()}
              disabled={!canUndo}
              className="inline-flex items-center justify-center h-7 w-7 text-[#999] bg-[#FAFAFA] border border-[#E5E5E5] border-r-0 transition-colors hover-elevate disabled:opacity-30 disabled:cursor-not-allowed disabled:shadow-none"
              style={{ borderRadius: "3px 0 0 3px" }}
              title="Undo (⌘Z)"
            >
              <Undo2 className="w-3.5 h-3.5" />
            </button>
            <button
              data-testid="button-redo"
              onClick={() => redo()}
              disabled={!canRedo}
              className="inline-flex items-center justify-center h-7 w-7 text-[#999] bg-[#FAFAFA] border border-[#E5E5E5] transition-colors hover-elevate disabled:opacity-30 disabled:cursor-not-allowed disabled:shadow-none"
              style={{ borderRadius: "0 3px 3px 0" }}
              title="Redo (⌘⇧Z)"
            >
              <Redo2 className="w-3.5 h-3.5" />
            </button>
          </div>
          <button
            data-testid="button-shortcuts-help"
            className="inline-flex items-center gap-1.5 h-7 px-2.5 text-[11px] font-medium text-[#999] bg-[#FAFAFA] border border-[#E5E5E5] transition-colors hover-elevate"
            style={{ borderRadius: "3px" }}
            title="Keyboard shortcuts"
          >
            <Keyboard className="w-3 h-3" />
            <span className="hidden sm:inline">Shortcuts</span>
          </button>
          <button
            data-testid="button-trash"
            onClick={() => setShowTrash(true)}
            className="inline-flex items-center gap-1.5 h-7 px-2.5 text-[11px] font-medium text-[#999] bg-[#FAFAFA] border border-[#E5E5E5] transition-colors hover-elevate"
            style={{ borderRadius: "3px" }}
          >
            <Trash2 className="w-3 h-3" />
            <span className="hidden sm:inline">Trash</span>
          </button>
          <button
            data-testid="button-sound-toggle"
            onClick={toggleSound}
            className="inline-flex items-center justify-center h-7 w-7 text-[#999] bg-[#FAFAFA] border border-[#E5E5E5] transition-colors hover-elevate"
            style={{ borderRadius: "3px" }}
          >
            {soundEnabled ? (
              <Volume2 className="w-3.5 h-3.5" />
            ) : (
              <VolumeX className="w-3.5 h-3.5" />
            )}
          </button>
          <button
            data-testid="button-onboarding"
            onClick={() => startOnboarding()}
            className="inline-flex items-center justify-center h-7 w-7 text-[#999] bg-[#FAFAFA] border border-[#E5E5E5] transition-colors hover-elevate"
            style={{ borderRadius: "3px" }}
            title="Product tour"
          >
            <GraduationCap className="w-3.5 h-3.5" />
          </button>
          <button
            data-testid="button-settings"
            onClick={() => setShowSettings(true)}
            className="inline-flex items-center justify-center h-7 w-7 text-[#999] bg-[#FAFAFA] border border-[#E5E5E5] transition-colors hover-elevate"
            style={{ borderRadius: "3px" }}
            title="Settings"
          >
            <SettingsIcon className="w-3.5 h-3.5" />
          </button>
        </div>
      </header>

      <ResizablePanelGroup direction="horizontal" className="flex-1 min-h-0">
        <ResizablePanel defaultSize={22} minSize={15} maxSize={40}>
          <SourceFeed onRefresh={refreshFeed} />
        </ResizablePanel>
        <ResizableHandle className="w-px bg-[#E5E5E5] hover:bg-[#111827] transition-colors duration-150" />
        <ResizablePanel defaultSize={38} minSize={25}>
          <Workshop />
        </ResizablePanel>
        <ResizableHandle className="w-px bg-[#E5E5E5] hover:bg-[#111827] transition-colors duration-150" />
        <ResizablePanel defaultSize={40} minSize={25} maxSize={55}>
          <Preview />
        </ResizablePanel>
      </ResizablePanelGroup>

      <Trash />
      <Settings />
    </div>
  );
}
