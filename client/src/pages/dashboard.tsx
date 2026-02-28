import { useEffect, useCallback } from "react";
import { useHotkeys } from "react-hotkeys-hook";
import { useHopperStore, type PlatformTab } from "@/lib/store";
import { db, seedMockData, loadLiveFeed, type Draft } from "@/lib/db";
import SourceFeed from "@/components/source-feed";
import Workshop from "@/components/workshop";
import Preview from "@/components/preview";
import Trash from "@/components/trash";
import Settings from "@/components/settings";
import { playApproveSound, playRejectSound } from "@/lib/sounds";
import { Trash2, Volume2, VolumeX, Keyboard, Undo2, Redo2, Settings as SettingsIcon } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from "@/components/ui/resizable";

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
  } = useHopperStore();

  const { toast } = useToast();

  const selectedPost = sourcePosts[selectedPostIndex];
  const activeDraft = drafts.find(
    (d) =>
      d.sourcePostId === selectedPost?.id &&
      d.platform === activeTab &&
      (d.status === "draft" || d.status === "approved"),
  );

  const TABS: PlatformTab[] = ["linkedin", "twitter", "instagram", "newsletter", "quote"];


  const ignoreWhenTyping = (e: KeyboardEvent) => {
    const tag = (e.target as HTMLElement)?.tagName;
    return tag === "TEXTAREA" || tag === "INPUT";
  };

  useHotkeys("l", () => useHopperStore.getState().setActiveTab("linkedin"), { preventDefault: true, ignoreEventWhen: ignoreWhenTyping });
  useHotkeys("x", () => useHopperStore.getState().setActiveTab("twitter"), { preventDefault: true, ignoreEventWhen: ignoreWhenTyping });
  useHotkeys("i", () => useHopperStore.getState().setActiveTab("instagram"), { preventDefault: true, ignoreEventWhen: ignoreWhenTyping });
  useHotkeys("n", () => useHopperStore.getState().setActiveTab("newsletter"), { preventDefault: true, ignoreEventWhen: ignoreWhenTyping });
  useHotkeys("q", () => useHopperStore.getState().setActiveTab("quote"), { preventDefault: true, ignoreEventWhen: ignoreWhenTyping });

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

  useHotkeys(
    "g",
    async () => {
      if (!selectedPost || isAiLoading) return;
      pushHistory();
      setAiLoading(true);

      try {
        const res = await apiRequest("POST", "/api/ai/generate", {
          content: activeDraft?.content || selectedPost.content,
          platform: activeTab,
          sourceContent: selectedPost.content,
        });
        const data = await res.json();

        const newDraft: Draft = {
          sourcePostId: selectedPost.id!,
          platform: activeTab,
          content: data.content,
          status: "draft",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };

        if (activeDraft?.id) {
          await db.drafts.update(activeDraft.id, {
            content: data.content,
            updatedAt: new Date().toISOString(),
          });
          useHopperStore.getState().updateDraft(activeDraft.id, data.content);
        } else {
          const id = await db.drafts.add(newDraft);
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
    { preventDefault: true, enabled: !isAiLoading && !!selectedPost, ignoreEventWhen: ignoreWhenTyping },
    [selectedPost, activeTab, activeDraft, isAiLoading, pushHistory],
  );

  // On mount: load from cache only — no API calls
  const loadFromCache = useCallback(async () => {
    // Seed mock data only for platforms with zero posts (first-run experience)
    await seedMockData();
    const posts = await db.sourcePosts.orderBy("timestamp").reverse().toArray();
    setSourcePosts(posts);
    const allDrafts = await db.drafts.toArray();
    setDrafts(allDrafts);
  }, [setSourcePosts, setDrafts]);

  useEffect(() => {
    loadFromCache();
  }, [loadFromCache]);

  // Explicit refresh: hits the API for the given platform (or all), dedupes, and saves to DB
  const refreshFeed = useCallback(async (platform?: "twitter" | "linkedin" | "instagram") => {
    setPlatformLoading(platform ?? null, true);

    try {
      const { posts: livePosts, profilePhoto } = await loadLiveFeed(platform);

      if (livePosts.length > 0) {
        if (platform) {
          // Replace all posts for this platform so stale posts are evicted
          await db.sourcePosts.where("platform").equals(platform).delete();
          await db.sourcePosts.bulkAdd(livePosts);
        } else {
          const existingPosts = await db.sourcePosts.toArray();
          const existingContentSet = new Set(existingPosts.map((p) => p.content.slice(0, 100)));
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

      // Seed mock data for any platform that still has no posts
      await seedMockData(platform ? [platform] : ["twitter", "linkedin", "instagram"]);
    } catch (e) {
      console.error("Live feed failed, using mock data:", e);
      await seedMockData(platform ? [platform] : ["twitter", "linkedin", "instagram"]);
    }

    const posts = await db.sourcePosts
      .orderBy("timestamp")
      .reverse()
      .toArray();
    setSourcePosts(posts);
    const allDrafts = await db.drafts.toArray();
    setDrafts(allDrafts);
    setPlatformLoading(platform ?? null, false);
  }, [setPlatformLoading, setProfilePhoto, setSourcePosts, setDrafts]);

  useHotkeys("shift+r", refreshFeed, { preventDefault: true, ignoreEventWhen: ignoreWhenTyping });


  useHotkeys(
    "a",
    async () => {
      if (!activeDraft?.id) return;
      pushHistory();
      await db.drafts.update(activeDraft.id, { status: "approved" });
      if (soundEnabled) playApproveSound();
      toast({ title: "Draft approved" });
      const allDrafts = await db.drafts.toArray();
      setDrafts(allDrafts);
    },
    { preventDefault: true, enabled: !!activeDraft, ignoreEventWhen: ignoreWhenTyping },
    [activeDraft, soundEnabled, pushHistory],
  );

  useHotkeys(
    "r",
    async () => {
      if (!activeDraft?.id) return;
      pushHistory();
      await db.trash.add({
        draftId: activeDraft.id,
        sourcePostId: activeDraft.sourcePostId,
        content: activeDraft.content,
        platform: activeDraft.platform,
        rejectedAt: new Date().toISOString(),
        originalContent:
          sourcePosts.find((p) => p.id === activeDraft.sourcePostId)
            ?.content || "",
      });
      await db.drafts.update(activeDraft.id, { status: "rejected" });
      if (soundEnabled) playRejectSound();
      const allDrafts = await db.drafts.toArray();
      setDrafts(allDrafts);
    },
    { preventDefault: true, enabled: !!activeDraft, ignoreEventWhen: ignoreWhenTyping },
    [activeDraft, soundEnabled, sourcePosts, pushHistory],
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
        const res = await apiRequest("POST", "/api/ai/punchier", {
          content: activeDraft.content,
        });
        const data = await res.json();
        if (activeDraft.id) {
          await db.drafts.update(activeDraft.id, {
            content: data.content,
            updatedAt: new Date().toISOString(),
          });
          useHopperStore.getState().updateDraft(activeDraft.id, data.content);
        }
      } catch {
      } finally {
        setAiLoading(false);
      }
    },
    { preventDefault: true, enabled: !!activeDraft && !isAiLoading, ignoreEventWhen: ignoreWhenTyping },
    [activeDraft, isAiLoading, pushHistory],
  );

  useHotkeys(
    "h",
    async () => {
      if (!activeDraft || isAiLoading) return;
      setAiLoading(true);
      try {
        const res = await apiRequest("POST", "/api/ai/hater", {
          content: activeDraft.content,
        });
        const data = await res.json();
        useHopperStore.getState().setHaterTooltip(data.content);
        setTimeout(() => useHopperStore.getState().setHaterTooltip(null), 12000);
      } catch {
      } finally {
        setAiLoading(false);
      }
    },
    { preventDefault: true, enabled: !!activeDraft && !isAiLoading, ignoreEventWhen: ignoreWhenTyping },
    [activeDraft, isAiLoading],
  );

  useHotkeys(
    "s",
    async () => {
      if (!activeDraft || isAiLoading) return;
      pushHistory();
      setAiLoading(true);
      try {
        const res = await apiRequest("POST", "/api/ai/shaan", {
          content: activeDraft.content,
        });
        const data = await res.json();
        if (activeDraft.id) {
          await db.drafts.update(activeDraft.id, {
            content: data.content,
            updatedAt: new Date().toISOString(),
          });
          useHopperStore.getState().updateDraft(activeDraft.id, data.content);
        }
      } catch {
      } finally {
        setAiLoading(false);
      }
    },
    { preventDefault: true, enabled: !!activeDraft && !isAiLoading, ignoreEventWhen: ignoreWhenTyping },
    [activeDraft, isAiLoading, pushHistory],
  );

  return (
    <div className="h-screen flex flex-col bg-[#FAFAFA]">
      <header className="flex items-center justify-between h-[49px] px-5 border-b border-[#E5E5E5] bg-white flex-shrink-0">
        <div className="flex items-center gap-3">
          <h1 className="text-[15px] font-bold text-[#111827] tracking-tight">
            Content Engine
          </h1>
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
