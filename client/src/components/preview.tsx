import { useHopperStore } from "@/lib/store";
import { SiLinkedin, SiX, SiInstagram } from "react-icons/si";
import { Mail, User } from "lucide-react";

function LinkedInPreview({ content }: { content: string }) {
  const paragraphs = content.split("\n").filter((l) => l.trim());

  return (
    <div className="bg-white border border-[#E5E5E5] p-0" style={{ borderRadius: "3px" }}>
      <div className="flex items-center gap-3 p-4 pb-3">
        <div className="w-10 h-10 bg-[#111827] rounded-full flex items-center justify-center">
          <User className="w-5 h-5 text-white" />
        </div>
        <div>
          <p className="text-[14px] font-semibold text-[#111827]">You</p>
          <p className="text-[12px] text-[#666]">Building in public</p>
        </div>
      </div>
      <div className="px-4 pb-4">
        {paragraphs.map((p, i) => (
          <p
            key={i}
            className="text-[14px] leading-[1.6] text-[#111827] mb-2 last:mb-0"
          >
            {p}
          </p>
        ))}
      </div>
      <div className="flex items-center gap-6 px-4 py-3 border-t border-[#F0F0F0]">
        <span className="text-[12px] text-[#666]">Like</span>
        <span className="text-[12px] text-[#666]">Comment</span>
        <span className="text-[12px] text-[#666]">Repost</span>
        <span className="text-[12px] text-[#666]">Send</span>
      </div>
    </div>
  );
}

function TwitterPreview({ content }: { content: string }) {
  const charCount = content.length;
  const isOverLimit = charCount > 280;

  return (
    <div className="bg-white border border-[#E5E5E5] p-0" style={{ borderRadius: "3px" }}>
      <div className="flex items-start gap-3 p-4">
        <div className="w-10 h-10 bg-[#111827] rounded-full flex items-center justify-center flex-shrink-0">
          <User className="w-5 h-5 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[14px] font-bold text-[#111827]">You</span>
            <span className="text-[14px] text-[#666]">@you</span>
            <span className="text-[14px] text-[#666]">· now</span>
          </div>
          <p className="text-[15px] leading-[1.5] text-[#111827] whitespace-pre-wrap">
            {content}
          </p>
          <div className="flex items-center gap-10 mt-3 text-[#666]">
            <span className="text-[13px]">Reply</span>
            <span className="text-[13px]">Repost</span>
            <span className="text-[13px]">Like</span>
            <span className="text-[13px]">Share</span>
          </div>
        </div>
      </div>
      <div className="px-4 py-2 border-t border-[#F0F0F0] flex items-center justify-end">
        <span
          className={`text-[12px] font-mono ${isOverLimit ? "text-red-500" : "text-[#999]"}`}
        >
          {charCount}/280
        </span>
      </div>
    </div>
  );
}

function InstagramPreview({ content }: { content: string }) {
  const slides = content.split("---").map((s) => s.trim()).filter(Boolean);

  return (
    <div className="space-y-3">
      {slides.map((slide, i) => (
        <div
          key={i}
          className="bg-white border border-[#E5E5E5] p-6 relative"
          style={{ borderRadius: "3px", aspectRatio: "1/1", maxHeight: "280px" }}
        >
          <div className="absolute top-3 right-3 text-[10px] font-mono text-[#999] bg-[#F5F5F5] px-2 py-0.5 border border-[#E5E5E5]" style={{ borderRadius: "2px" }}>
            {i + 1}/{slides.length}
          </div>
          <div className="flex items-center justify-center h-full">
            <p className="text-[16px] leading-[1.6] text-[#111827] text-center font-medium">
              {slide}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}

function NewsletterPreview({ content }: { content: string }) {
  const lines = content.split("\n");
  let subject = "";
  let body = content;

  if (lines[0]?.startsWith("Subject:")) {
    subject = lines[0].replace("Subject:", "").trim();
    body = lines.slice(1).join("\n").trim();
  }

  const paragraphs = body.split("\n").filter((l) => l.trim());

  return (
    <div className="bg-white border border-[#E5E5E5]" style={{ borderRadius: "3px" }}>
      {subject && (
        <div className="px-6 py-4 border-b border-[#E5E5E5] bg-[#FAFAFA]">
          <p className="text-[11px] text-[#999] uppercase tracking-wider mb-1">
            Subject Line
          </p>
          <p className="text-[15px] font-semibold text-[#111827]">{subject}</p>
        </div>
      )}
      <div className="px-6 py-5">
        {paragraphs.map((p, i) => (
          <p
            key={i}
            className="text-[14px] leading-[1.8] text-[#333] mb-3 last:mb-0"
          >
            {p}
          </p>
        ))}
      </div>
    </div>
  );
}

export default function Preview() {
  const { sourcePosts, selectedPostIndex, drafts, activeTab } =
    useHopperStore();

  const selectedPost = sourcePosts[selectedPostIndex];
  const activeDraft = drafts.find(
    (d) =>
      d.sourcePostId === selectedPost?.id &&
      d.platform === activeTab &&
      d.status !== "rejected",
  );

  const content = activeDraft?.content || "";

  const platformLabels: Record<string, { icon: any; label: string }> = {
    linkedin: { icon: SiLinkedin, label: "LinkedIn" },
    twitter: { icon: SiX, label: "Twitter/X" },
    instagram: { icon: SiInstagram, label: "Instagram" },
    newsletter: { icon: Mail, label: "Newsletter" },
  };

  const { icon: PlatformIcon, label } = platformLabels[activeTab] || platformLabels.linkedin;

  return (
    <div className="h-full flex flex-col bg-[#FAFAFA]">
      <div className="flex items-center gap-2 px-4 h-[49px] border-b border-[#E5E5E5]">
        <PlatformIcon className="w-3.5 h-3.5 text-[#666]" />
        <h2 className="text-[13px] font-semibold text-[#111827] tracking-tight">
          {label} Preview
        </h2>
      </div>
      <div className="flex-1 overflow-y-auto p-4">
        {!content ? (
          <div className="flex items-center justify-center h-32 text-[13px] text-[#999]">
            Generate a draft to see the preview
          </div>
        ) : activeTab === "linkedin" ? (
          <LinkedInPreview content={content} />
        ) : activeTab === "twitter" ? (
          <TwitterPreview content={content} />
        ) : activeTab === "instagram" ? (
          <InstagramPreview content={content} />
        ) : (
          <NewsletterPreview content={content} />
        )}
      </div>
    </div>
  );
}
