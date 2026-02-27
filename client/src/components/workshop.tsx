import { useState, useEffect, useCallback, useRef } from "react";
import { useHopperStore, type PlatformTab } from "@/lib/store";
import { db, type Draft } from "@/lib/db";
import {
  calculateFleschKincaid,
  calculateHumanScore,
  getReadabilityColor,
  getReadabilityBg,
} from "@/lib/readability";
import { playApproveSound, playRejectSound, playExportSound } from "@/lib/sounds";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { AnimatePresence, motion } from "framer-motion";
import {
  Zap,
  Skull,
  ToggleLeft,
  ToggleRight,
  Check,
  X,
  Copy,
  Loader2,
  Sparkles,
  RefreshCw,
} from "lucide-react";

const TABS: { key: PlatformTab; label: string }[] = [
  { key: "linkedin", label: "LinkedIn" },
  { key: "twitter", label: "Twitter/X" },
  { key: "instagram", label: "IG Carousel" },
  { key: "newsletter", label: "Newsletter" },
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
  } = useHopperStore();

  const { toast } = useToast();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [rejectedId, setRejectedId] = useState<number | null>(null);

  const selectedPost = sourcePosts[selectedPostIndex];
  const activeDraft = drafts.find(
    (d) =>
      d.sourcePostId === selectedPost?.id &&
      d.platform === activeTab &&
      (d.status === "draft" || d.status === "approved"),
  );

  const draftContent = activeDraft?.content || "";
  const fkScore = calculateFleschKincaid(draftContent);
  const vibeCheck = calculateHumanScore(draftContent);
  const wordCount = draftContent.trim()
    ? draftContent.trim().split(/\s+/).length
    : 0;

  const handleGenerateDraft = useCallback(async () => {
    if (!selectedPost || isAiLoading) return;
    setAiLoading(true);

    try {
      const res = await apiRequest("POST", "/api/ai/generate", {
        content: draftContent || selectedPost.content,
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
  }, [selectedPost, activeTab, activeDraft, draftContent, isAiLoading]);

  const handlePunchier = useCallback(async () => {
    if (!draftContent || isAiLoading) return;
    setAiLoading(true);
    try {
      const res = await apiRequest("POST", "/api/ai/punchier", {
        content: draftContent,
      });
      const data = await res.json();
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
  }, [draftContent, activeDraft, isAiLoading]);

  const handleHater = useCallback(async () => {
    if (!draftContent || isAiLoading) return;
    setAiLoading(true);
    try {
      const res = await apiRequest("POST", "/api/ai/hater", {
        content: draftContent,
      });
      const data = await res.json();
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
    toggleShaanMode();
    setAiLoading(true);
    try {
      const res = await apiRequest("POST", "/api/ai/shaan", {
        content: draftContent,
      });
      const data = await res.json();
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
  }, [draftContent, activeDraft, isAiLoading]);

  const handleApprove = useCallback(async () => {
    if (!activeDraft?.id) return;
    await db.drafts.update(activeDraft.id, { status: "approved" });
    if (soundEnabled) playApproveSound();
    toast({ title: "Draft approved", description: "Ready for export." });
    const allDrafts = await db.drafts.toArray();
    setDrafts(allDrafts);
  }, [activeDraft, soundEnabled]);

  const handleReject = useCallback(async () => {
    if (!activeDraft?.id) return;
    setRejectedId(activeDraft.id);

    await db.swipeFile.add({
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
  }, [activeDraft, soundEnabled, sourcePosts]);

  const handlePublish = useCallback(async () => {
    if (!activeDraft) return;
    const content = activeDraft.content;

    if (activeTab === "linkedin") {
      const formatted = content.replace(/\n\n/g, "\n\u200B\n");
      await navigator.clipboard.writeText(formatted);
      if (soundEnabled) playExportSound();
      toast({
        title: "Copied to clipboard",
        description: "LinkedIn-formatted with zero-width spaces for line breaks.",
      });
    } else if (activeTab === "twitter") {
      await navigator.clipboard.writeText(content);
      if (soundEnabled) playExportSound();
      toast({
        title: "Copied to clipboard",
        description: "Ready to paste into Twitter/X.",
      });
    } else if (activeTab === "instagram") {
      await navigator.clipboard.writeText(content);
      if (soundEnabled) playExportSound();
      toast({
        title: "Copied to clipboard",
        description: "Carousel text copied. Use Preview to export images.",
      });
    } else {
      await navigator.clipboard.writeText(content);
      if (soundEnabled) playExportSound();
      toast({
        title: "Copied to clipboard",
        description: "Newsletter section copied.",
      });
    }
  }, [activeDraft, activeTab, soundEnabled]);

  const handleContentChange = useCallback(
    async (value: string) => {
      if (!activeDraft?.id) return;
      await db.drafts.update(activeDraft.id, {
        content: value,
        updatedAt: new Date().toISOString(),
      });
      updateDraft(activeDraft.id, value);
    },
    [activeDraft],
  );

  const isApproved = activeDraft?.status === "approved";

  return (
    <div className="h-full flex flex-col bg-white">
      <div className="flex items-center justify-between h-[49px] border-b border-[#E5E5E5] px-1">
        <div className="flex items-center h-full">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              data-testid={`tab-${tab.key}`}
              onClick={() => setActiveTab(tab.key)}
              className={`h-full px-4 text-[13px] font-medium border-b-2 transition-colors ${
                activeTab === tab.key
                  ? "border-[#111827] text-[#111827]"
                  : "border-transparent text-[#999] hover:text-[#666]"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2 pr-3">
          {!activeDraft && selectedPost && (
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
            </button>
          )}
          {activeDraft && (
            <button
              data-testid="button-regenerate"
              onClick={handleGenerateDraft}
              disabled={isAiLoading}
              className="inline-flex items-center gap-1.5 h-7 px-2 text-[12px] font-medium text-[#666] bg-white border border-[#E5E5E5] transition-colors disabled:opacity-50 hover-elevate"
              style={{ borderRadius: "3px" }}
            >
              <RefreshCw className="w-3 h-3" />
            </button>
          )}
        </div>
      </div>

      {activeDraft && (
        <div className="flex items-center gap-3 px-4 py-2 border-b border-[#E5E5E5] bg-[#FAFAFA]">
          <div
            className={`inline-flex items-center gap-1.5 px-2 py-1 border text-[11px] font-mono ${getReadabilityBg(fkScore)}`}
            style={{ borderRadius: "3px" }}
            data-testid="badge-flesch-kincaid"
          >
            <span className="text-[#999] font-sans text-[10px] uppercase tracking-wider">
              Grade
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

          {isApproved && (
            <div
              className="inline-flex items-center gap-1 px-2 py-1 bg-green-50 border border-green-200 text-green-700 text-[11px] font-medium"
              style={{ borderRadius: "3px" }}
            >
              <Check className="w-3 h-3" />
              Approved
            </div>
          )}
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
              Select a source post to begin
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
        <div className="flex items-center justify-between px-4 py-2.5 border-t border-[#E5E5E5] bg-[#FAFAFA]">
          <div className="flex items-center gap-2">
            <button
              data-testid="button-punchier"
              onClick={handlePunchier}
              disabled={isAiLoading || !draftContent}
              className="inline-flex items-center gap-1.5 h-7 px-3 text-[12px] font-medium text-[#111827] bg-white border border-[#E5E5E5] transition-colors disabled:opacity-40 hover-elevate"
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
                className="inline-flex items-center gap-1.5 h-7 px-3 text-[12px] font-medium text-[#111827] bg-white border border-[#E5E5E5] transition-colors disabled:opacity-40 hover-elevate"
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
              className={`inline-flex items-center gap-1.5 h-7 px-3 text-[12px] font-medium border transition-colors disabled:opacity-40 ${
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
            <button
              data-testid="button-reject"
              onClick={handleReject}
              className="inline-flex items-center gap-1.5 h-7 px-3 text-[12px] font-medium text-[#999] bg-white border border-[#E5E5E5] transition-colors hover-elevate"
              style={{ borderRadius: "3px" }}
            >
              <X className="w-3 h-3" />
              Reject
              <kbd className="ml-1 text-[9px] font-mono text-[#999] bg-[#F5F5F5] px-1 py-0.5 border border-[#E5E5E5] rounded-sm">
                R
              </kbd>
            </button>

            <button
              data-testid="button-approve"
              onClick={handleApprove}
              disabled={isApproved}
              className={`inline-flex items-center gap-1.5 h-7 px-3 text-[12px] font-medium border transition-colors ${
                isApproved
                  ? "text-green-600 bg-green-50 border-green-200"
                  : "text-[#111827] bg-white border-[#E5E5E5] hover-elevate"
              }`}
              style={{ borderRadius: "3px" }}
            >
              <Check className="w-3 h-3" />
              Approve
              <kbd className="ml-1 text-[9px] font-mono text-[#999] bg-[#F5F5F5] px-1 py-0.5 border border-[#E5E5E5] rounded-sm">
                A
              </kbd>
            </button>

            <button
              data-testid="button-publish"
              onClick={handlePublish}
              disabled={!isApproved}
              className="inline-flex items-center gap-1.5 h-7 px-4 text-[12px] font-semibold text-white border transition-colors disabled:opacity-30"
              style={{
                borderRadius: "3px",
                backgroundColor: "#FF4F00",
                borderColor: "#FF4F00",
              }}
            >
              <Copy className="w-3 h-3" />
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
