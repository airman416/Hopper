import { useEffect, useCallback } from "react";
import { useHotkeys } from "react-hotkeys-hook";
import { useHopperStore } from "@/lib/store";
import { db, seedMockData } from "@/lib/db";
import SourceFeed from "@/components/source-feed";
import Workshop from "@/components/workshop";
import Preview from "@/components/preview";
import SwipeFile from "@/components/swipe-file";
import { playApproveSound, playRejectSound, playExportSound } from "@/lib/sounds";
import { Archive, Volume2, VolumeX, Keyboard } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

export default function Dashboard() {
  const {
    setSourcePosts,
    setDrafts,
    moveSelection,
    sourcePosts,
    selectedPostIndex,
    drafts,
    activeTab,
    soundEnabled,
    toggleSound,
    setShowSwipeFile,
    setAiLoading,
    isAiLoading,
  } = useHopperStore();

  const { toast } = useToast();

  useEffect(() => {
    async function init() {
      await seedMockData();
      const posts = await db.sourcePosts
        .orderBy("timestamp")
        .reverse()
        .toArray();
      setSourcePosts(posts);
      const allDrafts = await db.drafts.toArray();
      setDrafts(allDrafts);
    }
    init();
  }, []);

  const selectedPost = sourcePosts[selectedPostIndex];
  const activeDraft = drafts.find(
    (d) =>
      d.sourcePostId === selectedPost?.id &&
      d.platform === activeTab &&
      (d.status === "draft" || d.status === "approved"),
  );
  const approvedDraft = drafts.find(
    (d) =>
      d.sourcePostId === selectedPost?.id &&
      d.platform === activeTab &&
      d.status === "approved",
  );

  useHotkeys("j", () => moveSelection("down"), { preventDefault: true });
  useHotkeys("k", () => moveSelection("up"), { preventDefault: true });

  useHotkeys(
    "a",
    async () => {
      if (!activeDraft?.id) return;
      await db.drafts.update(activeDraft.id, { status: "approved" });
      if (soundEnabled) playApproveSound();
      toast({ title: "Draft approved" });
      const allDrafts = await db.drafts.toArray();
      setDrafts(allDrafts);
    },
    { preventDefault: true, enabled: !!activeDraft },
    [activeDraft, soundEnabled],
  );

  useHotkeys(
    "r",
    async () => {
      if (!activeDraft?.id) return;
      await db.swipeFile.add({
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
    { preventDefault: true, enabled: !!activeDraft },
    [activeDraft, soundEnabled, sourcePosts],
  );

  useHotkeys(
    "mod+enter",
    async () => {
      const draftToExport = approvedDraft;
      if (!draftToExport) return;
      const content = draftToExport.content;
      if (activeTab === "linkedin") {
        const formatted = content.replace(/\n\n/g, "\n\u200B\n");
        await navigator.clipboard.writeText(formatted);
      } else {
        await navigator.clipboard.writeText(content);
      }
      if (soundEnabled) playExportSound();
      toast({ title: "Exported to clipboard" });
    },
    { preventDefault: true, enabled: !!approvedDraft },
    [approvedDraft, activeTab, soundEnabled],
  );

  useHotkeys(
    "p",
    async () => {
      if (!activeDraft || isAiLoading) return;
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
    { preventDefault: true, enabled: !!activeDraft && !isAiLoading },
    [activeDraft, isAiLoading],
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
    { preventDefault: true, enabled: !!activeDraft && !isAiLoading },
    [activeDraft, isAiLoading],
  );

  useHotkeys(
    "s",
    async () => {
      if (!activeDraft || isAiLoading) return;
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
    { preventDefault: true, enabled: !!activeDraft && !isAiLoading },
    [activeDraft, isAiLoading],
  );

  return (
    <div className="h-screen flex flex-col bg-[#FAFAFA]">
      <header className="flex items-center justify-between h-[49px] px-5 border-b border-[#E5E5E5] bg-white flex-shrink-0">
        <div className="flex items-center gap-3">
          <h1 className="text-[15px] font-bold text-[#111827] tracking-tight">
            The Hopper
          </h1>
          <span className="text-[11px] font-mono text-[#999] bg-[#F5F5F5] px-2 py-0.5 border border-[#E5E5E5]" style={{ borderRadius: "2px" }}>
            v1.0
          </span>
        </div>
        <div className="flex items-center gap-2">
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
            data-testid="button-swipefile"
            onClick={() => setShowSwipeFile(true)}
            className="inline-flex items-center gap-1.5 h-7 px-2.5 text-[11px] font-medium text-[#999] bg-[#FAFAFA] border border-[#E5E5E5] transition-colors hover-elevate"
            style={{ borderRadius: "3px" }}
          >
            <Archive className="w-3 h-3" />
            <span className="hidden sm:inline">Swipe File</span>
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
        </div>
      </header>

      <div className="flex-1 flex min-h-0">
        <div className="w-[280px] border-r border-[#E5E5E5] flex-shrink-0">
          <SourceFeed />
        </div>
        <div className="flex-1 min-w-0">
          <Workshop />
        </div>
        <div className="w-[380px] border-l border-[#E5E5E5] flex-shrink-0">
          <Preview />
        </div>
      </div>

      <SwipeFile />
    </div>
  );
}
