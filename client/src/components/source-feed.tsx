import { useHopperStore } from "@/lib/store";
import type { SourcePost } from "@/lib/db";
import { formatDistanceToNow } from "date-fns";
import { ChevronDown, ChevronRight, Loader2, RefreshCw } from "lucide-react";
import { SiLinkedin, SiX, SiInstagram } from "react-icons/si";
import { useState, useMemo, useEffect } from "react";

const platformBrandIcons: Record<string, typeof SiLinkedin> = {
  twitter: SiX,
  linkedin: SiLinkedin,
  instagram: SiInstagram,
};

const platformNames: Record<string, string> = {
  twitter: "Twitter",
  linkedin: "LinkedIn",
  instagram: "Instagram",
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

export default function SourceFeed({ onRefresh }: { onRefresh?: () => void }) {
  const { sourcePosts, selectedPostIndex, setSelectedPostIndex, isFeedLoading, setActiveTab } =
    useHopperStore();
  
  const [expandedPlatforms, setExpandedPlatforms] = useState<Record<string, boolean>>({});

  const groupedPosts = useMemo(() => {
    const groups: Record<string, { post: SourcePost; index: number }[]> = {};
    sourcePosts.forEach((post, index) => {
      if (!groups[post.platform]) {
        groups[post.platform] = [];
      }
      groups[post.platform].push({ post, index });
    });
    return groups;
  }, [sourcePosts]);

  // Auto-expand the platform of the selected post
  useEffect(() => {
    if (sourcePosts[selectedPostIndex]) {
      const platform = sourcePosts[selectedPostIndex].platform;
      setExpandedPlatforms(prev => ({
        ...prev,
        [platform]: true
      }));
    }
  }, [selectedPostIndex, sourcePosts]);

  const togglePlatform = (platform: string) => {
    setExpandedPlatforms((prev) => ({
      ...prev,
      [platform]: !prev[platform],
    }));
  };

  const platforms = ["twitter", "linkedin", "instagram"];

  return (
    <div className="h-full flex flex-col bg-[#FAFAFA]">
      <div className="flex items-center justify-between px-4 h-[49px] border-b border-[#E5E5E5]">
        <div className="flex items-center gap-2">
          <h2 className="text-[13px] font-semibold text-[#111827] tracking-tight">
            Source Feed
          </h2>
          <button
            onClick={onRefresh}
            className="p-1 text-[#999] hover:text-[#111827] transition-colors ml-1"
            title="Refresh feed (Shift+R)"
            disabled={isFeedLoading}
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isFeedLoading ? "animate-spin" : ""}`} />
          </button>
        </div>
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
        {sourcePosts.length === 0 && !isFeedLoading ? (
          <div className="flex items-center justify-center h-32 text-[13px] text-[#999]">
            No posts loaded
          </div>
        ) : sourcePosts.length === 0 && isFeedLoading ? (
          <div className="flex flex-col items-center justify-center h-32 gap-2">
            <Loader2 className="w-5 h-5 animate-spin text-[#999]" />
            <span className="text-[13px] text-[#999]">Loading live feed...</span>
          </div>
        ) : (
          <div className="space-y-2">
            {platforms.map((platform) => {
              const posts = groupedPosts[platform] || [];
              if (posts.length === 0) return null;
              
              const BrandIcon = platformBrandIcons[platform];
              const isExpanded = expandedPlatforms[platform];

              return (
                <div key={platform} className="space-y-2">
                  <button
                    onClick={() => togglePlatform(platform)}
                    className="flex items-center w-full gap-2 px-2 py-1.5 text-[12px] font-medium text-[#666] hover:text-[#111827] transition-colors group"
                  >
                    {isExpanded ? (
                      <ChevronDown className="w-3.5 h-3.5 text-[#999] group-hover:text-[#666]" />
                    ) : (
                      <ChevronRight className="w-3.5 h-3.5 text-[#999] group-hover:text-[#666]" />
                    )}
                    <BrandIcon className="w-3.5 h-3.5" />
                    <span className="capitalize">{platformNames[platform] || platform}</span>
                    <span className="text-[10px] text-[#999] bg-[#F0F0F0] px-1.5 py-0.5 rounded-full ml-auto">
                      {posts.length}
                    </span>
                  </button>
                  
                  {isExpanded && (
                    <div className="space-y-2 pl-2 border-l border-[#E5E5E5] ml-3.5">
                      {posts.map(({ post, index }) => (
                        <PostCard
                          key={post.id || index}
                          post={post}
                          index={index}
                          isActive={index === selectedPostIndex}
                          onClick={() => {
                            setSelectedPostIndex(index);
                            if (post.platform === "twitter") setActiveTab("twitter");
                            else if (post.platform === "linkedin") setActiveTab("linkedin");
                            else if (post.platform === "instagram") setActiveTab("instagram");
                          }}
                        />
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
      <div className="px-4 py-2 border-t border-[#E5E5E5] bg-white">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-mono text-[#999]">
            {sourcePosts.length} posts
          </span>
        </div>
      </div>
    </div>
  );
}
