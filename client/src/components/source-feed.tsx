import { useHopperStore } from "@/lib/store";
import type { SourcePost } from "@/lib/db";
import { formatDistanceToNow } from "date-fns";
import { ChevronDown, ChevronUp } from "lucide-react";
import { SiLinkedin, SiX, SiInstagram } from "react-icons/si";

const platformBrandIcons: Record<string, typeof SiLinkedin> = {
  twitter: SiX,
  linkedin: SiLinkedin,
  instagram: SiInstagram,
};

function PostCard({
  post,
  index,
  isActive,
  onClick,
}: {
  post: SourcePost;
  index: number;
  isActive: boolean;
  onClick: () => void;
}) {
  const BrandIcon = platformBrandIcons[post.platform];

  return (
    <button
      data-testid={`source-post-${index}`}
      onClick={onClick}
      className={`w-full text-left p-3 border transition-all duration-100 cursor-pointer ${
        isActive
          ? "border-[#111827] bg-white"
          : "border-[#E5E5E5] bg-white hover-elevate"
      }`}
      style={{ borderRadius: "3px" }}
    >
      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="flex items-center gap-1.5">
          <BrandIcon className="w-3 h-3 text-[#666]" />
          <span className="text-[11px] font-mono text-[#666] uppercase tracking-wider">
            {post.platform}
          </span>
        </div>
        <span className="text-[11px] text-[#999]">
          {formatDistanceToNow(new Date(post.timestamp), { addSuffix: true })}
        </span>
      </div>
      <p className="text-[13px] leading-[1.5] text-[#111827] line-clamp-3">
        {post.content}
      </p>
      {post.metrics && (
        <div className="flex items-center gap-3 mt-2 pt-2 border-t border-[#F0F0F0]">
          <span className="text-[11px] font-mono text-[#999]">
            {post.metrics.likes?.toLocaleString()} likes
          </span>
          <span className="text-[11px] font-mono text-[#999]">
            {post.metrics.comments?.toLocaleString()} replies
          </span>
        </div>
      )}
    </button>
  );
}

export default function SourceFeed() {
  const { sourcePosts, selectedPostIndex, setSelectedPostIndex } =
    useHopperStore();

  return (
    <div className="h-full flex flex-col bg-[#FAFAFA]">
      <div className="flex items-center justify-between px-4 h-[49px] border-b border-[#E5E5E5]">
        <h2 className="text-[13px] font-semibold text-[#111827] tracking-tight">
          Source Feed
        </h2>
        <div className="flex items-center gap-1">
          <kbd className="inline-flex items-center justify-center h-5 min-w-[20px] px-1 text-[10px] font-mono text-[#666] bg-[#F0F0F0] border border-[#E0E0E0] rounded-sm">
            J
          </kbd>
          <kbd className="inline-flex items-center justify-center h-5 min-w-[20px] px-1 text-[10px] font-mono text-[#666] bg-[#F0F0F0] border border-[#E0E0E0] rounded-sm">
            K
          </kbd>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {sourcePosts.length === 0 ? (
          <div className="flex items-center justify-center h-32 text-[13px] text-[#999]">
            No posts loaded
          </div>
        ) : (
          sourcePosts.map((post, index) => (
            <PostCard
              key={post.id}
              post={post}
              index={index}
              isActive={index === selectedPostIndex}
              onClick={() => setSelectedPostIndex(index)}
            />
          ))
        )}
      </div>
      <div className="px-4 py-2 border-t border-[#E5E5E5] bg-white">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-mono text-[#999]">
            {sourcePosts.length} posts
          </span>
          <div className="flex items-center gap-1 text-[#999]">
            <ChevronUp className="w-3 h-3" />
            <ChevronDown className="w-3 h-3" />
          </div>
        </div>
      </div>
    </div>
  );
}
