import { useHopperStore } from "@/lib/store";
import { proxyImageUrl } from "@/lib/api";
import type { SourcePost } from "@/lib/db";
import { formatDistanceToNow } from "date-fns";
import { ChevronDown, ChevronRight, Loader2, RefreshCw } from "lucide-react";
import { SiLinkedin, SiX, SiInstagram } from "react-icons/si";
import { useState, useMemo, useRef, useEffect } from "react";
import { useHotkeys } from "react-hotkeys-hook";

const platformBrandIcons: Record<string, typeof SiLinkedin> = {
  twitter: SiX,
  linkedin: SiLinkedin,
  instagram: SiInstagram,
};

const platformNames: Record<string, string> = {
  twitter: "X",
  linkedin: "LinkedIn",
  instagram: "Instagram",
};

const platformDefaultPhotos: Record<string, string> = {
  twitter: "/x-profile.jpg",
  linkedin: "/linkedin-profile.jpeg",
  instagram: "/ig-profile.jpg",
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
          {(() => {
            const photo = post.profilePhoto || platformDefaultPhotos[post.platform] || null;
            return photo ? (
              <img
                src={proxyImageUrl(photo) ?? photo}
                alt={post.author}
                className="w-4 h-4 rounded-full object-cover flex-shrink-0"
              />
            ) : (
              <BrandIcon className="w-3 h-3 text-[#666]" />
            );
          })()}
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

export default function SourceFeed({ onRefresh }: { onRefresh?: (platform?: "twitter" | "linkedin" | "instagram") => void }) {
  const { sourcePosts, selectedPostIndex, setSelectedPostIndex, feedLoadingPlatforms, setActiveTab, setOnboardingPlatformExpanded } =
    useHopperStore();
  
  const [expandedPlatforms, setExpandedPlatforms] = useState<Record<string, boolean>>({});
  // null = cursor is on a post (selectedPostIndex), string = cursor is on that platform header
  const [focusedPlatform, setFocusedPlatform] = useState<string | null>(null);

  // Refs so hotkey callbacks always see latest values
  const expandedRef = useRef(expandedPlatforms);
  const postsRef = useRef(sourcePosts);
  const indexRef = useRef(selectedPostIndex);
  const focusedPlatformRef = useRef(focusedPlatform);
  useEffect(() => { expandedRef.current = expandedPlatforms; }, [expandedPlatforms]);
  useEffect(() => { postsRef.current = sourcePosts; }, [sourcePosts]);
  useEffect(() => { indexRef.current = selectedPostIndex; }, [selectedPostIndex]);
  useEffect(() => { focusedPlatformRef.current = focusedPlatform; }, [focusedPlatform]);

  // Scroll focused platform header into view
  useEffect(() => {
    if (focusedPlatform === null) return;
    const el = document.querySelector<HTMLElement>(`[data-platform-header="${focusedPlatform}"]`);
    el?.scrollIntoView({ block: "nearest" });
  }, [focusedPlatform]);

  // Scroll selected post into view
  useEffect(() => {
    const el = document.querySelector<HTMLElement>(`[data-testid="source-post-${selectedPostIndex}"]`);
    el?.scrollIntoView({ block: "nearest" });
  }, [selectedPostIndex]);

  const PLATFORMS = ["twitter", "linkedin", "instagram"];

  const getGroup = (platform: string, allPosts: SourcePost[]) =>
    allPosts.reduce<{ post: SourcePost; idx: number }[]>((acc, post, idx) => {
      if (post.platform === platform) acc.push({ post, idx });
      return acc;
    }, []);

  const ignoreWhenTyping = (e: KeyboardEvent) => {
    const tag = (e.target as HTMLElement)?.tagName;
    return tag === "TEXTAREA" || tag === "INPUT";
  };

  const hotkeyOpts = { preventDefault: true, enableOnFormTags: true, ignoreEventWhen: ignoreWhenTyping } as const;

  useHotkeys("down", () => {
    const fp = focusedPlatformRef.current;
    const posts = postsRef.current;
    const currentIndex = indexRef.current;

    if (fp !== null) {
      // On a header — go to next platform header
      const idx = PLATFORMS.indexOf(fp);
      const next = PLATFORMS[idx + 1];
      if (next) setFocusedPlatform(next);
    } else {
      const currentPost = posts[currentIndex];
      if (!currentPost) {
        // Nothing selected — land on first platform header
        setFocusedPlatform(PLATFORMS[0]);
        return;
      }
      // On a post — go to next post in same group, or next platform header
      const group = getGroup(currentPost.platform, posts);
      const posInGroup = group.findIndex(({ idx }) => idx === currentIndex);
      if (posInGroup < group.length - 1) {
        setSelectedPostIndex(group[posInGroup + 1].idx);
      } else {
        const pIdx = PLATFORMS.indexOf(currentPost.platform);
        const next = PLATFORMS[pIdx + 1];
        if (next) setFocusedPlatform(next);
      }
    }
  }, hotkeyOpts);

  useHotkeys("up", () => {
    const fp = focusedPlatformRef.current;
    const posts = postsRef.current;
    const expanded = expandedRef.current;
    const currentIndex = indexRef.current;

    if (fp !== null) {
      // On a header — go to previous platform header (or its last post if expanded)
      const idx = PLATFORMS.indexOf(fp);
      if (idx === 0) return;
      const prev = PLATFORMS[idx - 1];
      if (expanded[prev]) {
        const group = getGroup(prev, posts);
        if (group.length > 0) {
          setFocusedPlatform(null);
          setSelectedPostIndex(group[group.length - 1].idx);
          return;
        }
      }
      setFocusedPlatform(prev);
    } else {
      const currentPost = posts[currentIndex];
      if (!currentPost) return;
      // On a post — go to previous post in same group, or back to platform header
      const group = getGroup(currentPost.platform, posts);
      const posInGroup = group.findIndex(({ idx }) => idx === currentIndex);
      if (posInGroup > 0) {
        setSelectedPostIndex(group[posInGroup - 1].idx);
      } else {
        setFocusedPlatform(currentPost.platform);
      }
    }
  }, hotkeyOpts);

  useHotkeys("right", () => {
    const fp = focusedPlatformRef.current;
    if (fp === null) return;
    // Expand and enter the group
    setExpandedPlatforms((prev) => ({ ...prev, [fp]: true }));
    const group = getGroup(fp, postsRef.current);
    if (group.length > 0) {
      setFocusedPlatform(null);
      setSelectedPostIndex(group[0].idx);
    }
  }, hotkeyOpts);

  useHotkeys("left", () => {
    const fp = focusedPlatformRef.current;
    const posts = postsRef.current;
    const currentIndex = indexRef.current;
    if (fp !== null) {
      // On a header — collapse it
      setExpandedPlatforms((prev) => ({ ...prev, [fp]: false }));
    } else {
      // On a post — go back to its platform header
      const currentPlatform = posts[currentIndex]?.platform;
      if (currentPlatform) setFocusedPlatform(currentPlatform);
    }
  }, hotkeyOpts);

  const groupedPosts = useMemo(() => {
    const groups: Record<string, { post: SourcePost; index: number }[]> = {};
    sourcePosts.forEach((post, index) => {
      if (!groups[post.platform]) {
        groups[post.platform] = [];
      }
      groups[post.platform].push({ post, index });
    });
    for (const platform of Object.keys(groups)) {
      groups[platform].sort(
        (a, b) =>
          new Date(b.post.timestamp).getTime() - new Date(a.post.timestamp).getTime()
      );
    }
    return groups;
  }, [sourcePosts]);

  const togglePlatform = (platform: string) => {
    setFocusedPlatform(null);
    setExpandedPlatforms((prev) => {
      const next = { ...prev, [platform]: !prev[platform] };
      if (next[platform]) setOnboardingPlatformExpanded(true);
      return next;
    });
  };

  return (
    <div className="h-full flex flex-col bg-[#FAFAFA]">
      <div className="flex items-center justify-between px-4 h-[49px] border-b border-[#E5E5E5]">
        <div className="flex items-center gap-2">
          <h2 className="text-[13px] font-semibold text-[#111827] tracking-tight">
            Source Feed
          </h2>
        </div>
        <div className="flex items-center gap-1">
          <kbd className="inline-flex items-center justify-center h-5 min-w-[20px] px-1 text-[10px] font-mono text-[#666] bg-[#F0F0F0] border border-[#E0E0E0] rounded-sm" title="Navigate up">
            ↑
          </kbd>
          <kbd className="inline-flex items-center justify-center h-5 min-w-[20px] px-1 text-[10px] font-mono text-[#666] bg-[#F0F0F0] border border-[#E0E0E0] rounded-sm" title="Navigate down">
            ↓
          </kbd>
          <kbd className="inline-flex items-center justify-center h-5 min-w-[20px] px-1 text-[10px] font-mono text-[#666] bg-[#F0F0F0] border border-[#E0E0E0] rounded-sm" title="Expand group">
            →
          </kbd>
          <kbd className="inline-flex items-center justify-center h-5 min-w-[20px] px-1 text-[10px] font-mono text-[#666] bg-[#F0F0F0] border border-[#E0E0E0] rounded-sm" title="Collapse group">
            ←
          </kbd>
          <kbd className="inline-flex items-center justify-center h-5 min-w-[20px] px-1 text-[10px] font-mono text-[#666] bg-[#F0F0F0] border border-[#E0E0E0] rounded-sm" title="Refresh feed">
            ⇧R
          </kbd>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-3 space-y-2" data-onboarding-posts>
        {sourcePosts.length === 0 && !Object.values(feedLoadingPlatforms).some(Boolean) && (
          <p className="text-[12px] text-[#999] mb-2 px-2">
            No posts loaded. Use the refresh button next to each platform to fetch posts.
          </p>
        )}
        <div className="space-y-2">
          {PLATFORMS.map((platform) => {
              const posts = groupedPosts[platform] || [];
              const isLoading = (feedLoadingPlatforms[platform] ?? false) && posts.length === 0;
              
              const BrandIcon = platformBrandIcons[platform];
              const isExpanded = expandedPlatforms[platform];
              const isHeaderFocused = focusedPlatform === platform;

              return (
                <div key={platform} className="space-y-2">
                  <div className="flex items-center justify-between group/header">
                    <button
                      data-platform-header={platform}
                      onClick={() => togglePlatform(platform)}
                      className={`flex items-center gap-2 px-2 py-1.5 text-[12px] font-medium transition-colors flex-1 rounded-sm ${
                        isHeaderFocused
                          ? "bg-[#111827] text-white"
                          : "text-[#666] hover:text-[#111827]"
                      }`}
                      disabled={isLoading}
                    >
                      {isLoading ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : isExpanded ? (
                        <ChevronDown className="w-3.5 h-3.5" />
                      ) : (
                        <ChevronRight className="w-3.5 h-3.5" />
                      )}
                      <BrandIcon className="w-3.5 h-3.5" />
                      <span className="capitalize">{platformNames[platform] || platform}</span>
                      {isLoading ? (
                        <span className="text-[10px] ml-auto opacity-70">Loading…</span>
                      ) : (
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full ml-auto ${
                          isHeaderFocused ? "bg-white/20 text-white" : "bg-[#F0F0F0] text-[#999]"
                        }`}>
                          {posts.length}
                        </span>
                      )}
                    </button>
                    <button
                      data-onboarding-refresh={platform === "twitter" ? "" : undefined}
                      onClick={(e) => {
                        e.stopPropagation();
                        onRefresh?.(platform as "twitter" | "linkedin" | "instagram");
                      }}
                      className="p-1.5 text-[#999] hover:text-[#111827] transition-colors mr-1"
                      title={`Refresh ${platformNames[platform]}`}
                      disabled={feedLoadingPlatforms[platform] ?? false}
                    >
                      <RefreshCw className={`w-3 h-3 ${feedLoadingPlatforms[platform] ? "animate-spin" : ""}`} />
                    </button>
                  </div>
                  
                  {isExpanded && !isLoading && (
                    <div className="space-y-2 pl-2 border-l border-[#E5E5E5] ml-3.5">
                      {posts.length === 0 ? (
                        <p className="text-[11px] text-[#999] px-2 py-1">No posts loaded</p>
                      ) : (
                        posts.map(({ post, index }) => (
                          <PostCard
                            key={post.id || index}
                            post={post}
                            index={index}
                            isActive={index === selectedPostIndex}
                            onClick={() => {
                              setFocusedPlatform(null);
                              setSelectedPostIndex(index);
                              if (post.platform === "twitter") setActiveTab("twitter");
                              else if (post.platform === "linkedin") setActiveTab("linkedin");
                              else if (post.platform === "instagram") setActiveTab("instagram");
                            }}
                          />
                        ))
                      )}
                    </div>
                  )}
                </div>
              );
            })}
        </div>
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
