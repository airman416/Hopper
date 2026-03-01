import { useState, useCallback, useRef, useEffect } from "react";
import { useHopperStore, type PlatformTab } from "@/lib/store";
import { db, type Draft } from "@/lib/db";
import {
  calculateFleschKincaid,
  calculateHumanScore,
  getReadabilityColor,
  getReadabilityBg,
} from "@/lib/readability";
import { playRejectSound } from "@/lib/sounds";
import { aiGenerate, aiPunchier, aiHater, aiShaan } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { AnimatePresence, motion } from "framer-motion";
import {
  Zap,
  Skull,
  ToggleLeft,
  ToggleRight,
  X,
  Download,
  Loader2,
  Sparkles,
  RefreshCw,
} from "lucide-react";

const TABS: { key: PlatformTab; label: string; shortcut: string }[] = [
  { key: "linkedin", label: "LinkedIn", shortcut: "L" },
  { key: "twitter", label: "X", shortcut: "X" },
  { key: "instagram", label: "IG Carousel", shortcut: "I" },
  { key: "newsletter", label: "Newsletter", shortcut: "N" },
  { key: "quote", label: "Quote", shortcut: "Q" },
];

export default function Workshop() {
  const {
    sourcePosts,
    selectedPostIndex,
    drafts,
    setDrafts,
    updateDraft,
    activeTab,
    setActiveTab,
    isAiLoading,
    setAiLoading,
    haterTooltip,
    setHaterTooltip,
    shaanMode,
    toggleShaanMode,
    soundEnabled,
    pushHistory,
    triggerExport,
  } = useHopperStore();

  const { toast } = useToast();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const shouldPushHistoryRef = useRef(false);
  const [rejectedId, setRejectedId] = useState<number | null>(null);

  const selectedPost = sourcePosts[selectedPostIndex];
  const activeDraft = drafts.find(
    (d) =>
      d.sourcePostId === selectedPost?.id &&
      d.platform === activeTab &&
      (d.status === "draft" || d.status === "approved"),
  );

  const isSameToSame = !!(
    selectedPost &&
    activeDraft &&
    selectedPost.platform === activeTab
  );

  const draftContent = activeDraft?.content || "";
  const fkScore = calculateFleschKincaid(draftContent);
  const vibeCheck = calculateHumanScore(draftContent);
  const wordCount = draftContent.trim()
    ? draftContent.trim().split(/\s+/).length
    : 0;

  // When the source post's platform matches the active tab, auto-populate a draft
  // with the raw content — no AI needed, just display it immediately.
  useEffect(() => {
    if (!selectedPost || activeDraft || isAiLoading) return;

    const platformMatch =
      (selectedPost.platform === "twitter" && activeTab === "twitter") ||
      (selectedPost.platform === "linkedin" && activeTab === "linkedin") ||
      (selectedPost.platform === "instagram" && activeTab === "instagram");

    if (!platformMatch) return;

    const newDraft: Draft = {
      sourcePostId: selectedPost.id!,
      platform: activeTab,
      content: selectedPost.content,
      status: "draft",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    db.drafts.add(newDraft).then(async () => {
      const allDrafts = await db.drafts.toArray();
      setDrafts(allDrafts);
    });
  }, [selectedPost?.id, activeTab, !!activeDraft]);

  const handleGenerateDraft = useCallback(async () => {
    if (!selectedPost || isAiLoading) return;
    pushHistory();
    setAiLoading(true);

    try {
      const data = await aiGenerate(
        draftContent || selectedPost.content,
        activeTab,
        selectedPost.content
      );

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
        updateDraft(activeDraft.id, data.content);
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
  }, [selectedPost, activeTab, activeDraft, draftContent, isAiLoading, pushHistory]);

  const handlePunchier = useCallback(async () => {
    if (!draftContent || isAiLoading) return;
    pushHistory();
    setAiLoading(true);
    try {
      const data = await aiPunchier(draftContent);
      if (activeDraft?.id) {
        await db.drafts.update(activeDraft.id, {
          content: data.content,
          updatedAt: new Date().toISOString(),
        });
        updateDraft(activeDraft.id, data.content);
      }
    } catch (error: any) {
      toast({
        title: "Failed",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setAiLoading(false);
    }
  }, [draftContent, activeDraft, isAiLoading, pushHistory]);

  const handleHater = useCallback(async () => {
    if (!draftContent || isAiLoading) return;
    setAiLoading(true);
    try {
      const data = await aiHater(draftContent);
      setHaterTooltip(data.content);
      setTimeout(() => setHaterTooltip(null), 12000);
    } catch (error: any) {
      toast({
        title: "Failed",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setAiLoading(false);
    }
  }, [draftContent, isAiLoading]);

  const handleShaanRewrite = useCallback(async () => {
    if (!draftContent || isAiLoading) return;
    pushHistory();
    toggleShaanMode();
    setAiLoading(true);
    try {
      const data = await aiShaan(draftContent);
      if (activeDraft?.id) {
        await db.drafts.update(activeDraft.id, {
          content: data.content,
          updatedAt: new Date().toISOString(),
        });
        updateDraft(activeDraft.id, data.content);
      }
    } catch (error: any) {
      toast({
        title: "Failed",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setAiLoading(false);
    }
  }, [draftContent, activeDraft, isAiLoading, pushHistory]);

  const handleReject = useCallback(async () => {
    if (!activeDraft?.id) return;
    pushHistory();
    setRejectedId(activeDraft.id);

    await db.trash.add({
      draftId: activeDraft.id,
      sourcePostId: activeDraft.sourcePostId,
      content: activeDraft.content,
      platform: activeDraft.platform,
      rejectedAt: new Date().toISOString(),
      originalContent:
        sourcePosts.find((p) => p.id === activeDraft.sourcePostId)?.content ||
        "",
    });

    await db.drafts.update(activeDraft.id, { status: "rejected" });
    if (soundEnabled) playRejectSound();

    setTimeout(async () => {
      setRejectedId(null);
      const allDrafts = await db.drafts.toArray();
      setDrafts(allDrafts);
    }, 300);
  }, [activeDraft, soundEnabled, sourcePosts, pushHistory]);

  const handleContentChange = useCallback(
    (value: string) => {
      if (!activeDraft?.id) return;
      if (shouldPushHistoryRef.current) {
        pushHistory();
        shouldPushHistoryRef.current = false;
      }
      // Update store synchronously so the textarea re-renders immediately.
      // Delaying until after DB persist caused cursor to jump and duplicate typing.
      updateDraft(activeDraft.id, value);
      db.drafts.update(activeDraft.id, {
        content: value,
        updatedAt: new Date().toISOString(),
      });
    },
    [activeDraft, pushHistory],
  );

  return (
    <div className="h-full flex flex-col bg-white">
      {selectedPost && (
      <div className="flex items-center justify-between h-[49px] border-b border-[#E5E5E5] px-1">
        <div className="flex items-center h-full overflow-x-auto no-scrollbar flex-1 min-w-0 mr-2 group">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              data-testid={`tab-${tab.key}`}
              onClick={() => setActiveTab(tab.key)}
              className={`h-full px-4 text-[13px] font-medium border-b-2 transition-colors whitespace-nowrap flex-shrink-0 inline-flex items-center gap-1.5 ${
                activeTab === tab.key
                  ? "border-[#111827] text-[#111827]"
                  : "border-transparent text-[#999] hover:text-[#666]"
              }`}
            >
              {tab.label}
              <kbd className={`text-[9px] font-mono px-1 py-0.5 border rounded-sm transition-colors ${
                activeTab === tab.key
                  ? "text-[#111827] bg-[#F5F5F5] border-[#E5E5E5]"
                  : "text-[#CCC] bg-[#FAFAFA] border-[#EBEBEB]"
              }`}>
                {tab.shortcut}
              </kbd>
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2 pr-3">
          {!activeDraft && (
            <button
              data-testid="button-generate"
              onClick={handleGenerateDraft}
              disabled={isAiLoading}
              className="inline-flex items-center gap-1.5 h-7 px-3 text-[12px] font-medium text-white bg-[#111827] border border-[#111827] hover:bg-[#1f2937] transition-colors disabled:opacity-50"
              style={{ borderRadius: "3px" }}
            >
              {isAiLoading ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : (
                <Sparkles className="w-3 h-3" />
              )}
              Generate
              <kbd className="ml-1 text-[9px] font-mono text-white/70 bg-white/20 px-1 py-0.5 border border-white/20 rounded-sm">
                G
              </kbd>
            </button>
          )}
          {activeDraft && (
            <button
              data-testid="button-regenerate"
              onClick={handleGenerateDraft}
              disabled={isAiLoading}
              className="inline-flex items-center gap-1.5 h-7 px-2 text-[12px] font-medium text-[#666] bg-white border border-[#E5E5E5] transition-colors disabled:opacity-50 hover-elevate"
              style={{ borderRadius: "3px" }}
              title="Regenerate (G)"
            >
              <RefreshCw className="w-3 h-3" />
            </button>
          )}
        </div>
      </div>
      )}

      {activeDraft && (
        <div className="flex items-center gap-3 px-4 py-2 border-b border-[#E5E5E5] bg-[#FAFAFA]">
          <div
            className={`inline-flex items-center gap-1.5 px-2 py-1 border text-[11px] font-mono ${getReadabilityBg(fkScore)}`}
            style={{ borderRadius: "3px" }}
            data-testid="badge-flesch-kincaid"
          >
            <span className="text-[#999] font-sans text-[10px] uppercase tracking-wider">
              F-K Score
            </span>
            <span className={`font-bold ${getReadabilityColor(fkScore)}`}>
              {fkScore.toFixed(1)}
            </span>
          </div>

          <div
            className={`inline-flex items-center gap-1.5 px-2 py-1 border text-[11px] font-mono ${
              vibeCheck.score >= 80
                ? "bg-green-50 border-green-200"
                : vibeCheck.score >= 50
                  ? "bg-amber-50 border-amber-200"
                  : "bg-red-50 border-red-200"
            }`}
            style={{ borderRadius: "3px" }}
            data-testid="badge-human-score"
          >
            <span className="text-[#999] font-sans text-[10px] uppercase tracking-wider">
              Human
            </span>
            <span
              className={`font-bold ${
                vibeCheck.score >= 80
                  ? "text-green-700"
                  : vibeCheck.score >= 50
                    ? "text-amber-600"
                    : "text-red-600"
              }`}
            >
              {vibeCheck.score}%
            </span>
          </div>

          <div className="inline-flex items-center gap-1.5 px-2 py-1 border border-[#E5E5E5] bg-white text-[11px] font-mono" style={{ borderRadius: "3px" }}>
            <span className="text-[#999] font-sans text-[10px] uppercase tracking-wider">
              Words
            </span>
            <span className="font-bold text-[#111827]">{wordCount}</span>
          </div>

        </div>
      )}

      <div className="flex-1 overflow-hidden relative">
        <AnimatePresence mode="wait">
          {!selectedPost ? (
            <motion.div
              key="no-post"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex items-center justify-center h-full text-[#999] text-[14px]"
            >
              Select a source post
            </motion.div>
          ) : !activeDraft ? (
            <motion.div
              key="no-draft"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex flex-col items-center justify-center h-full gap-4"
            >
              <p className="text-[14px] text-[#999]">
                No {activeTab} draft yet for this post
              </p>
              <button
                data-testid="button-generate-center"
                onClick={handleGenerateDraft}
                disabled={isAiLoading}
                className="inline-flex items-center gap-2 h-9 px-5 text-[13px] font-medium text-white bg-[#111827] hover:bg-[#1f2937] transition-colors disabled:opacity-50"
                style={{ borderRadius: "3px" }}
              >
                {isAiLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Sparkles className="w-4 h-4" />
                )}
                Generate {activeTab.charAt(0).toUpperCase() + activeTab.slice(1)} Draft
              </button>
            </motion.div>
          ) : rejectedId === activeDraft.id ? (
            <motion.div
              key="rejecting"
              initial={{ opacity: 1, x: 0 }}
              animate={{ opacity: 0, x: -100 }}
              transition={{ duration: 0.25, ease: "easeIn" }}
              className="p-4 h-full"
            >
              <textarea
                readOnly
                value={draftContent}
                className="w-full h-full resize-none bg-transparent text-[14px] leading-[1.7] text-[#111827] focus:outline-none font-sans"
              />
            </motion.div>
          ) : (
            <motion.div
              key={`draft-${activeDraft.id}`}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.15 }}
              className="p-4 h-full flex flex-col"
            >
              <textarea
                ref={textareaRef}
                data-testid="textarea-draft"
                value={draftContent}
                onFocus={() => { shouldPushHistoryRef.current = true; }}
                onChange={(e) => handleContentChange(e.target.value)}
                className="w-full flex-1 resize-none bg-transparent text-[14px] leading-[1.7] text-[#111827] focus:outline-none font-sans placeholder:text-[#CCC]"
                placeholder="Start writing..."
                disabled={isAiLoading}
              />
            </motion.div>
          )}
        </AnimatePresence>

        {haterTooltip && (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8 }}
            className="absolute bottom-4 right-4 left-4 p-4 bg-white border border-[#E5E5E5] text-[13px] text-[#111827] leading-[1.6] z-10"
            style={{
              borderRadius: "3px",
              boxShadow: "0 2px 8px rgba(0,0,0,0.12)",
            }}
            data-testid="hater-tooltip"
          >
            <div className="flex items-start gap-2">
              <Skull className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" />
              <div className="flex-1">
                <p className="text-[11px] font-semibold text-red-500 uppercase tracking-wider mb-1">
                  Hater says...
                </p>
                <p>{haterTooltip}</p>
              </div>
              <button
                onClick={() => setHaterTooltip(null)}
                className="text-[#999] hover:text-[#666]"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </motion.div>
        )}
      </div>

      {activeDraft && (
        <div className="flex flex-wrap items-center justify-between gap-y-2 px-4 py-2.5 border-t border-[#E5E5E5] bg-[#FAFAFA]">
          <div className="flex flex-wrap items-center gap-2">
            <button
              data-testid="button-punchier"
              onClick={handlePunchier}
              disabled={isAiLoading || !draftContent}
              className="inline-flex items-center justify-center gap-1.5 w-24 h-7 px-3 text-[12px] font-medium text-[#111827] bg-white border border-[#E5E5E5] transition-colors disabled:opacity-40 hover-elevate"
              style={{ borderRadius: "3px" }}
            >
              <Zap className="w-3 h-3" />
              Punchier
              <kbd className="ml-1 text-[9px] font-mono text-[#999] bg-[#F5F5F5] px-1 py-0.5 border border-[#E5E5E5] rounded-sm">
                P
              </kbd>
            </button>

            <div className="relative">
              <button
                data-testid="button-hater"
                onClick={handleHater}
                disabled={isAiLoading || !draftContent}
                className="inline-flex items-center justify-center gap-1.5 w-24 h-7 px-3 text-[12px] font-medium text-[#111827] bg-white border border-[#E5E5E5] transition-colors disabled:opacity-40 hover-elevate"
                style={{ borderRadius: "3px" }}
              >
                <Skull className="w-3 h-3" />
                Hater
                <kbd className="ml-1 text-[9px] font-mono text-[#999] bg-[#F5F5F5] px-1 py-0.5 border border-[#E5E5E5] rounded-sm">
                  H
                </kbd>
              </button>
            </div>

            <button
              data-testid="button-shaan"
              onClick={handleShaanRewrite}
              disabled={isAiLoading || !draftContent}
              className={`inline-flex items-center justify-center gap-1.5 w-24 h-7 px-3 text-[12px] font-medium border transition-colors disabled:opacity-40 ${
                shaanMode
                  ? "text-[#FF4F00] bg-orange-50 border-orange-200"
                  : "text-[#111827] bg-white border-[#E5E5E5] hover-elevate"
              }`}
              style={{ borderRadius: "3px" }}
            >
              {shaanMode ? (
                <ToggleRight className="w-3 h-3" />
              ) : (
                <ToggleLeft className="w-3 h-3" />
              )}
              Shaan
              <kbd className="ml-1 text-[9px] font-mono text-[#999] bg-[#F5F5F5] px-1 py-0.5 border border-[#E5E5E5] rounded-sm">
                S
              </kbd>
            </button>

            {isAiLoading && (
              <div className="flex items-center gap-1.5 text-[11px] text-[#999]">
                <Loader2 className="w-3 h-3 animate-spin" />
                Processing...
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            {!isSameToSame && (
              <button
                data-testid="button-reject"
                onClick={handleReject}
                className="inline-flex items-center justify-center gap-1.5 w-24 h-7 px-3 text-[12px] font-medium text-[#999] bg-white border border-[#E5E5E5] transition-colors hover-elevate"
                style={{ borderRadius: "3px" }}
              >
                <X className="w-3 h-3" />
                Reject
                <kbd className="ml-1 text-[9px] font-mono text-[#999] bg-[#F5F5F5] px-1 py-0.5 border border-[#E5E5E5] rounded-sm">
                  R
                </kbd>
              </button>
            )}

            <button
              data-testid="button-publish"
              onClick={() => triggerExport?.()}
              className="inline-flex items-center gap-1.5 h-7 px-4 text-[12px] font-semibold text-white border transition-colors"
              style={{
                borderRadius: "3px",
                backgroundColor: "#FF4F00",
                borderColor: "#FF4F00",
              }}
            >
              <Download className="w-3 h-3" />
              Export
              <kbd className="ml-1 text-[9px] font-mono text-white/70 bg-white/20 px-1 py-0.5 border border-white/20 rounded-sm">
                ⌘↵
              </kbd>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export { Workshop };
