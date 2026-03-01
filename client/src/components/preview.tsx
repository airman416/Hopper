import { useRef, useCallback, useEffect, useState } from "react";
import { useHopperStore } from "@/lib/store";
import { SiLinkedin, SiX, SiInstagram } from "react-icons/si";
import {
  Mail,
  User,
  Copy,
  Download,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Quote,
  Loader2,
  Eye,
  EyeOff,
} from "lucide-react";
import { toPng } from "html-to-image";
import JSZip from "jszip";
import { saveAs } from "file-saver";
import { useToast } from "@/hooks/use-toast";
import { proxyImageUrl, fetchImageAsDataUrl } from "@/lib/api";

const FONTS = [
  "Inter",
  "Roboto",
  "Playfair Display",
  "Merriweather",
  "JetBrains Mono",
  "Georgia",
  "Lora",
];

const DIMENSIONS: { key: "1080x1080" | "1080x1350" | "1080x1920"; label: string; w: number; h: number }[] = [
  { key: "1080x1080", label: "Square", w: 1080, h: 1080 },
  { key: "1080x1350", label: "Portrait", w: 1080, h: 1350 },
  { key: "1080x1920", label: "Story", w: 1080, h: 1920 },
];

const PADDING_MAP = { sm: 32, md: 64, lg: 128, xl: 256 } as const;
const PADDING_PREVIEW_MAP = { sm: 16, md: 32, lg: 48, xl: 64 } as const;

const SOLID_COLORS = [
  { label: "Hampton Cream", value: "#F5F5F0" },
  { label: "White", value: "#FFFFFF" },
  { label: "Light Gray", value: "#F0F0F0" },
  { label: "Charcoal", value: "#1A1A2E" },
  { label: "Hampton Green", value: "#1B4332" },
  { label: "Deep Navy", value: "#0D1B2A" },
];

const GRADIENTS = [
  { label: "Soft Gray", value: "linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)" },
  { label: "Warm Cream", value: "linear-gradient(135deg, #F5F5F0 0%, #E8E4DA 50%, #D4CFC4 100%)" },
  { label: "Hampton Mist", value: "linear-gradient(135deg, #F5F5F0 0%, #E8F0E8 50%, #D6E5D6 100%)" },
  { label: "Dusk", value: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)" },
  { label: "Midnight", value: "linear-gradient(135deg, #0c0c1d 0%, #1a1a3e 50%, #2d2d5e 100%)" },
];

function getExportFilename(outputType: string, ext: string): string {
  const now = new Date();
  const date = now.toISOString().slice(0, 10); // YYYY-MM-DD
  const time = now.toTimeString().slice(0, 8).replace(/:/g, "-"); // HH-mm-ss
  return `${outputType}-${date}-${time}.${ext}`;
}

function loadGoogleFont(font: string) {
  const id = `gfont-${font.replace(/\s/g, "-")}`;
  if (document.getElementById(id)) return;
  const link = document.createElement("link");
  link.id = id;
  link.rel = "stylesheet";
  link.href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(font)}:wght@400;600;700&display=swap`;
  document.head.appendChild(link);
}

/** Draw a carousel slide to canvas and return PNG blob. Uses Canvas API directly to avoid html-to-image font rendering issues. */
async function drawSlideToBlob(
  slide: string,
  index: number,
  total: number,
  opts: {
    width: number;
    height: number;
    bgColor: string;
    textColor: string;
    font: string;
    align: "left" | "center" | "right";
  }
): Promise<Blob> {
  const { width, height, bgColor, textColor, font, align } = opts;
  const padding = Math.round(40 * (width / 340));
  const contentWidth = width - padding * 2;
  const contentHeight = height - padding * 2;

  const slideLength = slide.length;
  let fontSize = 22;
  if (slideLength > 200) fontSize = 16;
  else if (slideLength > 100) fontSize = 18;
  fontSize = Math.round(fontSize * (width / 340));
  const lineHeight = 1.6;

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d")!;

  ctx.fillStyle = bgColor;
  ctx.fillRect(0, 0, width, height);

  ctx.fillStyle = textColor;
  ctx.font = `${fontSize}px "${font}", sans-serif`;
  ctx.textBaseline = "top";

  const words = slide.split(/\s+/);
  const lines: string[] = [];
  let currentLine = "";

  for (const word of words) {
    const testLine = currentLine ? `${currentLine} ${word}` : word;
    const metrics = ctx.measureText(testLine);
    if (metrics.width > contentWidth && currentLine) {
      lines.push(currentLine);
      currentLine = word;
    } else {
      currentLine = testLine;
    }
  }
  if (currentLine) lines.push(currentLine);

  const totalTextHeight = lines.length * fontSize * lineHeight;
  let y = padding + (contentHeight - totalTextHeight) / 2;

  for (const line of lines) {
    let x = padding;
    if (align === "center") {
      x = padding + (contentWidth - ctx.measureText(line).width) / 2;
    } else if (align === "right") {
      x = width - padding - ctx.measureText(line).width;
    }
    ctx.fillText(line, x, y);
    y += fontSize * lineHeight;
  }

  ctx.font = `${Math.round(11 * (width / 340))}px monospace`;
  ctx.fillStyle = textColor;
  ctx.globalAlpha = 0.5;
  const badge = `${index + 1}/${total}`;
  ctx.fillText(badge, width - padding - ctx.measureText(badge).width, padding);
  ctx.globalAlpha = 1;

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Canvas toBlob failed"))),
      "image/png",
      1
    );
  });
}

function proxyPhotoUrl(url: string | null): string | null {
  return proxyImageUrl(url);
}

async function imageUrlToBase64(url: string): Promise<string | null> {
  return fetchImageAsDataUrl(url);
}

function formatContentWithLinks(text: string, linkColor: string) {
  const parts = text.split(/(https?:\/\/[^\s]+|#\w+|@\w+)/g);
  return parts.map((part, i) => {
    if (part.match(/^https?:\/\//) || part.match(/^#\w+/) || part.match(/^@\w+/)) {
      return <span key={i} style={{ color: linkColor }}>{part}</span>;
    }
    return <span key={i}>{part}</span>;
  });
}

function VerifiedBadge() {
  return (
    <svg viewBox="0 0 22 22" width="18" height="18" style={{ flexShrink: 0 }}>
      <path
        d="M20.396 11c-.018-.646-.215-1.275-.57-1.816-.354-.54-.852-.972-1.438-1.246.223-.607.27-1.264.14-1.897-.131-.634-.437-1.218-.882-1.687-.47-.445-1.053-.75-1.687-.882-.633-.13-1.29-.083-1.897.14-.273-.587-.704-1.086-1.245-1.44S11.647 1.62 11 1.604c-.646.017-1.273.213-1.813.568s-.969.855-1.24 1.44c-.608-.223-1.267-.272-1.902-.14-.635.13-1.22.436-1.69.882-.445.47-.749 1.055-.878 1.69-.13.633-.08 1.29.144 1.896-.587.274-1.087.705-1.443 1.245-.356.54-.555 1.17-.574 1.817.02.647.218 1.276.574 1.817.356.54.856.972 1.443 1.245-.224.606-.274 1.263-.144 1.896.13.636.433 1.221.878 1.69.47.446 1.055.752 1.69.883.635.13 1.294.083 1.902-.143.271.586.702 1.084 1.24 1.438.54.354 1.167.551 1.813.568.647-.016 1.276-.213 1.817-.567s.972-.854 1.245-1.44c.604.225 1.261.276 1.894.147.634-.13 1.219-.435 1.69-.88.445-.47.75-1.055.88-1.69.13-.634.08-1.292-.148-1.898.584-.274 1.083-.705 1.439-1.246.354-.54.551-1.17.569-1.816zM9.662 14.85l-3.429-3.428 1.293-1.302 2.072 2.072 4.4-4.794 1.347 1.246z"
        fill="#1D9BF0"
      />
    </svg>
  );
}

function MockTwitterCard({
  content,
  profileBase64,
  showMetrics,
  metrics,
  mediaUrls,
}: {
  content: string;
  profileBase64: string | null;
  showMetrics: boolean;
  metrics?: { likes?: number; comments?: number; shares?: number; bookmarks?: number; views?: number };
  mediaUrls?: string[];
}) {
  const now = new Date();
  const timeStr = now.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
  const dateStr = now.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

  const displayReposts = metrics?.shares ?? 0;
  const displayLikes = metrics?.likes ?? 0;
  const displayBookmarks = metrics?.bookmarks ?? 0;
  const displayViews = metrics?.views != null
    ? metrics.views >= 1000 ? `${(metrics.views / 1000).toFixed(1)}K` : String(metrics.views)
    : null;

  return (
    <div
      style={{
        backgroundColor: "#FFFFFF",
        borderRadius: 0,
        boxShadow: "0 20px 40px -10px rgba(0,0,0,0.1)",
        overflow: "hidden",
        width: "100%",
        fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
      }}
    >
      <div style={{ padding: "16px 16px 0 16px" }}>
        <div style={{ display: "flex", alignItems: "flex-start", gap: "12px" }}>
          {profileBase64 ? (
            <img
              src={profileBase64}
              alt=""
              style={{ width: "48px", height: "48px", borderRadius: "50%", objectFit: "cover", flexShrink: 0 }}
            />
          ) : (
            <div
              style={{
                width: "48px",
                height: "48px",
                borderRadius: "50%",
                backgroundColor: "#111827",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              <User style={{ width: "24px", height: "24px", color: "white" }} />
            </div>
          )}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
              <span style={{ fontSize: "15px", fontWeight: 700, color: "#0F1419" }}>Sam Parr</span>
              <VerifiedBadge />
            </div>
            <span style={{ fontSize: "15px", color: "#536471" }}>@thesamparr</span>
          </div>
          <svg viewBox="0 0 24 24" width="20" height="20" style={{ color: "#0F1419", flexShrink: 0 }}>
            <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" fill="currentColor" />
          </svg>
        </div>
        <div
          style={{
            marginTop: "12px",
            fontSize: "15px",
            lineHeight: "1.5",
            color: "#0F1419",
            whiteSpace: "pre-wrap",
          }}
        >
          {formatContentWithLinks(content, "#1DA1F2")}
        </div>
        {mediaUrls && mediaUrls.length > 0 && (
          <div style={{ marginTop: "12px" }}>
            {mediaUrls.length === 1 ? (
              <img
                src={proxyImageUrl(mediaUrls[0]) ?? ""}
                alt=""
                style={{
                  width: "100%",
                  borderRadius: "12px",
                  display: "block",
                  objectFit: "cover",
                  maxHeight: "400px",
                }}
              />
            ) : (
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: mediaUrls.length === 2 ? "1fr 1fr" : mediaUrls.length === 3 ? "2fr 1fr" : "1fr 1fr",
                  gridTemplateRows: mediaUrls.length >= 3 ? "1fr 1fr" : "1fr",
                  gap: "2px",
                  borderRadius: "12px",
                  overflow: "hidden",
                  height: "280px",
                }}
              >
                {mediaUrls.slice(0, 4).map((url, i) => (
                  <img
                    key={i}
                    src={proxyImageUrl(url) ?? ""}
                    alt=""
                    style={{
                      width: "100%",
                      height: "100%",
                      objectFit: "cover",
                      display: "block",
                      gridColumn: mediaUrls.length === 3 && i === 0 ? "1" : "auto",
                      gridRow: mediaUrls.length === 3 && i === 0 ? "1 / 3" : "auto",
                    }}
                  />
                ))}
              </div>
            )}
          </div>
        )}
        <div style={{ marginTop: "16px", fontSize: "15px", color: "#536471" }}>
          {timeStr} · {dateStr}
        </div>
      </div>

      {showMetrics && (
        <>
          <div
            style={{
              margin: "12px 16px 0",
              padding: "12px 0",
              borderTop: "1px solid #EFF3F4",
              display: "flex",
              gap: "20px",
              fontSize: "14px",
            }}
          >
            <span><strong style={{ color: "#0F1419" }}>{displayReposts.toLocaleString()}</strong> <span style={{ color: "#536471" }}>Reposts</span></span>
            <span><strong style={{ color: "#0F1419" }}>{displayLikes.toLocaleString()}</strong> <span style={{ color: "#536471" }}>Likes</span></span>
            {displayBookmarks > 0 && <span><strong style={{ color: "#0F1419" }}>{displayBookmarks.toLocaleString()}</strong> <span style={{ color: "#536471" }}>Bookmarks</span></span>}
            {displayViews != null && <span><strong style={{ color: "#0F1419" }}>{displayViews}</strong> <span style={{ color: "#536471" }}>Views</span></span>}
          </div>
          <div
            style={{
              padding: "12px 16px",
              borderTop: "1px solid #EFF3F4",
              display: "flex",
              justifyContent: "space-around",
            }}
          >
            <svg viewBox="0 0 24 24" width="20" height="20" fill="#536471"><path d="M1.751 10c0-4.42 3.584-8 8.005-8h4.366c4.49 0 8.129 3.64 8.129 8.13 0 2.96-1.607 5.68-4.196 7.11l-8.054 4.46v-3.69h-.067c-4.49.1-8.183-3.51-8.183-8.01zm8.005-6c-3.317 0-6.005 2.69-6.005 6 0 3.37 2.77 6.08 6.138 6.01l.351-.01h1.761v2.3l5.087-2.81c1.951-1.08 3.163-3.13 3.163-5.36 0-3.39-2.744-6.13-6.129-6.13H9.756z" /></svg>
            <svg viewBox="0 0 24 24" width="20" height="20" fill="#536471"><path d="M4.5 3.88l4.432 4.14-1.364 1.46L5.5 7.55V16c0 1.1.896 2 2 2H13v2H7.5c-2.209 0-4-1.79-4-4V7.55L1.432 9.48.068 8.02 4.5 3.88zM16.5 6H11V4h5.5c2.209 0 4 1.79 4 4v8.45l2.068-1.93 1.364 1.46-4.432 4.14-4.432-4.14 1.364-1.46 2.068 1.93V8c0-1.1-.896-2-2-2z" /></svg>
            <svg viewBox="0 0 24 24" width="20" height="20" fill="#536471"><path d="M16.697 5.5c-1.222-.06-2.679.51-3.89 2.16l-.805 1.09-.806-1.09C9.984 6.01 8.526 5.44 7.304 5.5c-1.243.07-2.349.78-2.91 1.91-.552 1.12-.633 2.78.479 4.82 1.074 1.97 3.257 4.27 7.129 6.61 3.87-2.34 6.052-4.64 7.126-6.61 1.111-2.04 1.03-3.7.477-4.82-.56-1.13-1.666-1.84-2.908-1.91zm4.187 7.69c-1.351 2.48-4.001 5.12-8.379 7.67l-.503.3-.504-.3c-4.379-2.55-7.029-5.19-8.382-7.67-1.36-2.5-1.41-4.86-.514-6.67.887-1.79 2.647-2.91 4.601-3.01 1.651-.09 3.368.56 4.798 2.01 1.429-1.45 3.146-2.1 4.796-2.01 1.954.1 3.714 1.22 4.601 3.01.896 1.81.846 4.17-.514 6.67z" /></svg>
            <svg viewBox="0 0 24 24" width="20" height="20" fill="#536471"><path d="M4 4.5C4 3.12 5.119 2 6.5 2h11C18.881 2 20 3.12 20 4.5v18.44l-8-5.71-8 5.71V4.5zM6.5 4c-.276 0-.5.22-.5.5v14.56l6-4.29 6 4.29V4.5c0-.28-.224-.5-.5-.5h-11z" /></svg>
            <svg viewBox="0 0 24 24" width="20" height="20" fill="#536471"><path d="M12 2.59l5.7 5.7-1.41 1.42L13 6.41V16h-2V6.41l-3.3 3.3-1.41-1.42L12 2.59zM21 15l-.02 3.51c0 1.38-1.12 2.49-2.5 2.49H5.5C4.11 21 3 19.88 3 18.5V15h2v3.5c0 .28.22.5.5.5h12.98c.28 0 .5-.22.5-.5L19 15h2z" /></svg>
          </div>
        </>
      )}
      {!showMetrics && <div style={{ height: "16px" }} />}
    </div>
  );
}

function MockLinkedInCard({
  content,
  profileBase64,
  showMetrics,
  metrics,
  mediaUrls,
}: {
  content: string;
  profileBase64: string | null;
  showMetrics: boolean;
  metrics?: { likes?: number; comments?: number; shares?: number };
  mediaUrls?: string[];
}) {
  const paragraphs = content.split("\n");

  const displayLikes = metrics?.likes ?? 0;
  const displayComments = metrics?.comments ?? 0;
  const displayReposts = metrics?.shares ?? 0;

  return (
    <div
      style={{
        backgroundColor: "#FFFFFF",
        borderRadius: 0,
        boxShadow: "0 20px 40px -10px rgba(0,0,0,0.1)",
        overflow: "hidden",
        width: "100%",
        fontFamily: "system-ui, 'Segoe UI', sans-serif",
      }}
    >
      <div style={{ padding: "16px 16px 0 16px" }}>
        <div style={{ display: "flex", alignItems: "flex-start", gap: "8px" }}>
          {profileBase64 ? (
            <img
              src={profileBase64}
              alt=""
              style={{ width: "48px", height: "48px", borderRadius: "50%", objectFit: "cover", flexShrink: 0 }}
            />
          ) : (
            <div
              style={{
                width: "48px",
                height: "48px",
                borderRadius: "50%",
                backgroundColor: "#0A66C2",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              <User style={{ width: "24px", height: "24px", color: "white" }} />
            </div>
          )}
          <div style={{ flex: 1 }}>
            <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
              <span style={{ fontSize: "14px", fontWeight: 600, color: "#000000" }}>Sam Parr</span>
              <span style={{ fontSize: "14px", color: "#00000099" }}>• 1st</span>
            </div>
            <p style={{ fontSize: "12px", color: "#00000099", margin: "2px 0" }}>Founder of Hampton</p>
            <p style={{ fontSize: "12px", color: "#00000099", display: "flex", alignItems: "center", gap: "4px" }}>
              {new Date().toLocaleDateString("en-US", { month: "short", day: "numeric" })} •{" "}
              <svg viewBox="0 0 16 16" width="12" height="12" fill="#00000099">
                <path d="M8 1a7 7 0 107 7 7 7 0 00-7-7zM3 8a5 5 0 011.17-3.24l.3.35a1 1 0 01-.06 1.37l-.32.32A1 1 0 004 7.31v.38a1 1 0 00.29.7l.28.29a1 1 0 010 1.41l-.71.71A5 5 0 013 8zm5 5a4.98 4.98 0 01-2.57-.71l.5-.5A1 1 0 006 11.5h.5A1.5 1.5 0 008 10v-.5a.5.5 0 01.5-.5h.59a1 1 0 00.7-.29l.5-.5a1 1 0 000-1.42l-.5-.5A1 1 0 009.09 6H8a2 2 0 01-2-2v-.07A5 5 0 0113 8a5 5 0 01-5 5z" />
              </svg>
            </p>
          </div>
          <svg viewBox="0 0 24 24" width="24" height="24" fill="#666">
            <circle cx="12" cy="5" r="2" />
            <circle cx="12" cy="12" r="2" />
            <circle cx="12" cy="19" r="2" />
          </svg>
        </div>
      </div>

      <div style={{ padding: "12px 16px", fontSize: "14px", lineHeight: "1.5", color: "#000000", whiteSpace: "pre-wrap" }}>
        {paragraphs.map((p, i) => (
          <span key={i}>
            {i > 0 && "\n"}
            {formatContentWithLinks(p, "#0A66C2")}
          </span>
        ))}
      </div>
      {mediaUrls && mediaUrls.length > 0 && (
        <div style={{ padding: "0 16px 12px" }}>
          {mediaUrls.length === 1 ? (
            <img
              src={proxyImageUrl(mediaUrls[0]) ?? ""}
              alt=""
              style={{
                width: "100%",
                borderRadius: "8px",
                display: "block",
                objectFit: "cover",
                maxHeight: "400px",
              }}
            />
          ) : (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: mediaUrls.length === 2 ? "1fr 1fr" : mediaUrls.length === 3 ? "2fr 1fr" : "1fr 1fr",
                gridTemplateRows: mediaUrls.length >= 3 ? "1fr 1fr" : "1fr",
                gap: "2px",
                borderRadius: "8px",
                overflow: "hidden",
                height: "280px",
              }}
            >
              {mediaUrls.slice(0, 4).map((url, i) => (
                <img
                  key={i}
                  src={proxyImageUrl(url) ?? ""}
                  alt=""
                  style={{
                    width: "100%",
                    height: "100%",
                    objectFit: "cover",
                    display: "block",
                    gridColumn: mediaUrls.length === 3 && i === 0 ? "1" : "auto",
                    gridRow: mediaUrls.length === 3 && i === 0 ? "1 / 3" : "auto",
                  }}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {showMetrics && (
        <>
          <div
            style={{
              padding: "0 16px 8px",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              fontSize: "12px",
              color: "#00000099",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
              <span style={{ display: "inline-flex", alignItems: "center" }}>
                <svg viewBox="0 0 16 16" width="16" height="16"><circle cx="8" cy="8" r="8" fill="#378FE9" /><path d="M11.2 5.6L7.2 10 5 8" stroke="white" strokeWidth="1.5" fill="none" /></svg>
              </span>
              <span style={{ display: "inline-flex", alignItems: "center", marginLeft: "-4px" }}>
                <svg viewBox="0 0 16 16" width="16" height="16"><circle cx="8" cy="8" r="8" fill="#E7483D" /><path d="M5 6.5C5 5.67 5.67 5 6.5 5S8 5.67 8 6.5C8 5.67 8.67 5 9.5 5S11 5.67 11 6.5C11 8.5 8 11 8 11S5 8.5 5 6.5Z" fill="white" /></svg>
              </span>
              <span style={{ marginLeft: "4px" }}>{displayLikes.toLocaleString()}</span>
            </div>
            <span>{displayComments} comments · {displayReposts} reposts</span>
          </div>
          <div
            style={{
              margin: "0 16px",
              padding: "4px 0",
              borderTop: "1px solid #E0E0E0",
              display: "flex",
              justifyContent: "space-around",
            }}
          >
            {[
              { label: "Like", icon: "M11.4 2.4C10.2 2 8.7 2.5 8 3.7 7.3 2.5 5.8 2 4.6 2.4 3 3 2.3 4.8 2.6 6.3c.5 2.3 3.6 5.1 5.4 6.2 1.8-1.1 4.9-3.9 5.4-6.2.3-1.5-.4-3.3-2-3.9z" },
              { label: "Comment", icon: "M7 9h10l-1.7 5H8.7L7 9zm1-7v5h12V2H8z" },
              { label: "Repost", icon: "M13.6 2L16 4.4 13.6 6.8V5H5v3H3V4c0-.6.4-1 1-1h9.6V2zM2.4 10L0 12.4 2.4 14.8V13.4h8.6v-3h2v4c0 .6-.4 1-1 1H2.4v1.4z" },
              { label: "Send", icon: "M21 3L0 10l7.66 4.26L21 3zm-7.44 14.32L21 3 7.66 14.26l5.9 3.06z" },
            ].map((action) => (
              <button
                key={action.label}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                  padding: "12px 8px",
                  fontSize: "12px",
                  fontWeight: 600,
                  color: "#00000099",
                  background: "none",
                  border: "none",
                  cursor: "default",
                }}
              >
                <svg viewBox="0 0 24 24" width="16" height="16" fill="#00000099"><path d={action.icon} /></svg>
                <span>{action.label}</span>
              </button>
            ))}
          </div>
        </>
      )}
      {!showMetrics && <div style={{ height: "16px" }} />}
    </div>
  );
}

function AssetCard({
  content,
  nodeRef,
  bgColor,
  textColor,
  font,
  align,
  dimension,
}: {
  content: string;
  nodeRef: React.RefObject<HTMLDivElement | null>;
  bgColor: string;
  textColor: string;
  font: string;
  align: "left" | "center" | "right";
  dimension: "1080x1080" | "1080x1350" | "1080x1920";
}) {
  const dimConfig = DIMENSIONS.find((d) => d.key === dimension)!;
  const aspect = dimConfig.h / dimConfig.w;
  const previewWidth = 340;
  const previewHeight = previewWidth * aspect;

  const contentLength = content.length;
  let fontSize = 24;
  if (contentLength > 400) fontSize = 16;
  else if (contentLength > 200) fontSize = 18;
  else if (contentLength > 100) fontSize = 20;

  const renderContent = (text: string) => {
    const parts = text.split(/(\*\*.*?\*\*)/g);
    return parts.map((part, i) => {
      if (part.startsWith("**") && part.endsWith("**")) {
        return <strong key={i} style={{ fontWeight: 700 }}>{part.slice(2, -2)}</strong>;
      }
      return <span key={i}>{part}</span>;
    });
  };

  return (
    <div
      ref={nodeRef}
      data-testid="asset-preview-node"
      style={{
        width: `${previewWidth}px`,
        height: `${previewHeight}px`,
        backgroundColor: bgColor,
        color: textColor,
        fontFamily: `'${font}', sans-serif`,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "40px",
        textAlign: align,
        overflow: "hidden",
        position: "relative",
      }}
    >
      <p
        style={{
          fontSize: `${fontSize}px`,
          lineHeight: 1.6,
          maxWidth: "100%",
          wordWrap: "break-word",
          overflowWrap: "break-word",
        }}
      >
        {renderContent(content)}
      </p>
    </div>
  );
}

function CarouselSlideCard({
  slide,
  index,
  total,
  nodeRef,
  bgColor,
  textColor,
  font,
  align,
  dimension,
}: {
  slide: string;
  index: number;
  total: number;
  nodeRef: React.RefObject<HTMLDivElement | null>;
  bgColor: string;
  textColor: string;
  font: string;
  align: "left" | "center" | "right";
  dimension: "1080x1080" | "1080x1350" | "1080x1920";
}) {
  const dimConfig = DIMENSIONS.find((d) => d.key === dimension)!;
  const aspect = dimConfig.h / dimConfig.w;
  const previewWidth = 340;
  const previewHeight = previewWidth * aspect;

  const slideLength = slide.length;
  let fontSize = 22;
  if (slideLength > 200) fontSize = 16;
  else if (slideLength > 100) fontSize = 18;

  return (
    <div
      ref={nodeRef}
      style={{
        width: `${previewWidth}px`,
        height: `${previewHeight}px`,
        backgroundColor: bgColor,
        color: textColor,
        fontFamily: `'${font}', sans-serif`,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "40px",
        textAlign: align,
        overflow: "hidden",
        position: "relative",
      }}
    >
      <div
        style={{
          position: "absolute",
          top: "12px",
          right: "16px",
          fontSize: "11px",
          opacity: 0.5,
          fontFamily: "monospace",
        }}
      >
        {index + 1}/{total}
      </div>
      <p style={{ fontSize: `${fontSize}px`, lineHeight: 1.6, maxWidth: "100%", wordWrap: "break-word" }}>
        {slide}
      </p>
    </div>
  );
}

export default function Preview() {
  const {
    sourcePosts,
    selectedPostIndex,
    drafts,
    activeTab,
    profilePhoto,
    assetBgColor,
    setAssetBgColor,
    assetTextColor,
    setAssetTextColor,
    assetFont,
    setAssetFont,
    assetDimension,
    setAssetDimension,
    assetAlign,
    setAssetAlign,
    mockupBgColor,
    setMockupBgColor,
    mockupBgType,
    setMockupBgType,
    mockupGradient,
    setMockupGradient,
    mockupPadding,
    setMockupPadding,
    mockupAspectRatio,
    setMockupAspectRatio,
    mockupShowMetrics,
    setMockupShowMetrics,
    mockupProfileBase64,
    setMockupProfileBase64,
    setTriggerExport,
  } = useHopperStore();

  const { toast } = useToast();
  const previewRef = useRef<HTMLDivElement>(null);
  const slideRefs = useRef<(HTMLDivElement | null)[]>([]);
  const [isExporting, setIsExporting] = useState(false);
  const [lastConvertedPhoto, setLastConvertedPhoto] = useState<string | null>(null);

  useEffect(() => {
    loadGoogleFont(assetFont);
  }, [assetFont]);

  const selectedPost = sourcePosts[selectedPostIndex];
  const activeDraft = drafts.find(
    (d) =>
      d.sourcePostId === selectedPost?.id &&
      d.platform === activeTab &&
      d.status !== "rejected",
  );

  const content = activeDraft?.content || "";

  // Show platform mockup whenever exporting to LinkedIn or X, regardless of source (consistency)
  const showMockup = (activeTab === "linkedin" || activeTab === "twitter") && !!content;

  const isAssetMode = activeTab === "quote" || activeTab === "instagram";

  // For mockups: prefer source post photo, fall back to profile photo.
  // LinkedIn: always use locally saved profile picture (no external API fetch).
  const LINKEDIN_LOCAL_PROFILE = "/linkedin-profile.jpeg";
  const effectivePhoto = showMockup
    ? (activeTab === "linkedin"
        ? LINKEDIN_LOCAL_PROFILE
        : (selectedPost?.profilePhoto || profilePhoto || null))
    : (selectedPost?.profilePhoto || profilePhoto || null);

  useEffect(() => {
    if (showMockup && effectivePhoto && effectivePhoto !== lastConvertedPhoto) {
      setLastConvertedPhoto(effectivePhoto);
      // Local paths (e.g. /linkedin-profile.jpeg) can be used directly as img src — no fetch
      if (effectivePhoto.startsWith("/") || effectivePhoto.startsWith("data:")) {
        setMockupProfileBase64(effectivePhoto);
      } else {
        imageUrlToBase64(effectivePhoto).then((base64) => {
          setMockupProfileBase64(base64);
        });
      }
    } else if (!showMockup || !effectivePhoto) {
      if (mockupProfileBase64) {
        setMockupProfileBase64(null);
      }
    }
  }, [showMockup, effectivePhoto, lastConvertedPhoto]);

  const platformLabels: Record<string, { icon: any; label: string }> = {
    linkedin: { icon: SiLinkedin, label: "LinkedIn" },
    twitter: { icon: SiX, label: "X" },
    instagram: { icon: SiInstagram, label: "Instagram" },
    newsletter: { icon: Mail, label: "Newsletter" },
    quote: { icon: Quote, label: "Quote" },
  };

  const { icon: PlatformIcon, label } =
    platformLabels[activeTab] || platformLabels.linkedin;

  const handleCopyText = useCallback(async () => {
    if (!content) return;
    let textToCopy = content
      .replace(/\r\n/g, "\n")
      .replace(/\r/g, "\n");
    // LinkedIn, Twitter/X, and Instagram collapse line breaks when pasting.
    // Insert zero-width space (U+200B) before each newline so formatting is preserved.
    const needsFormatting = ["linkedin", "twitter", "instagram", "newsletter", "quote"].includes(activeTab);
    if (needsFormatting) {
      textToCopy = textToCopy.replace(/\n/g, "\u200B\n");
    }
    await navigator.clipboard.writeText(textToCopy);
    toast({
      title: "Copied to clipboard",
      description: needsFormatting ? "Formatted for paste (line breaks preserved)." : "Text copied.",
    });
  }, [content, activeTab]);

  const handleDownloadImage = useCallback(async () => {
    if (isExporting) return;
    setIsExporting(true);

    try {
      const hasSourceImages = (selectedPost?.mediaUrls ?? []).length > 0;
      if (activeTab === "instagram" && content.includes("---") && !hasSourceImages) {
        const slides = content.split("---").map((s) => s.trim()).filter(Boolean);
        const zip = new JSZip();
        const dimConfig = DIMENSIONS.find((d) => d.key === assetDimension)!;
        const fontFamily = assetFont || "Inter";

        if ("fonts" in document) {
          await document.fonts.ready;
          await document.fonts.load(`16px "${fontFamily}"`);
        }

        for (let i = 0; i < slides.length; i++) {
          const blob = await drawSlideToBlob(slides[i], i, slides.length, {
            width: dimConfig.w,
            height: dimConfig.h,
            bgColor: assetBgColor,
            textColor: assetTextColor,
            font: fontFamily,
            align: assetAlign,
          });
          zip.file(`slide-${i + 1}.png`, blob);
        }

        const zipBlob = await zip.generateAsync({ type: "blob" });
        saveAs(zipBlob, getExportFilename("instagram-carousel", "zip"));
        toast({ title: "Downloaded", description: `${slides.length} slides saved as ZIP.` });
      } else {
        const node = previewRef.current;
        if (!node) return;

        if (activeTab === "instagram" && hasSourceImages) {
          const dataUrl = await toPng(node, { pixelRatio: 2 });
          const link = document.createElement("a");
          link.download = getExportFilename("instagram-preview", "png");
          link.href = dataUrl;
          link.click();
        } else if (showMockup) {
          // Canvas has a fixed pixel width (CANVAS_W), so pixelRatio: 3 always
          // produces a consistent 1560px-wide output regardless of screen size.
          const exportOpts: Parameters<typeof toPng>[1] = { pixelRatio: 3, quality: 1.0 };
          if (mockupAspectRatio === "1:1") {
            exportOpts.width = CANVAS_W * 3;
            exportOpts.height = CANVAS_W * 3;
          } else if (mockupAspectRatio === "9:16") {
            exportOpts.width = CANVAS_W * 3;
            exportOpts.height = Math.round(CANVAS_W * 16 / 9) * 3;
          }
          const dataUrl = await toPng(node, exportOpts);
          const link = document.createElement("a");
          link.download = getExportFilename(`${activeTab}-mockup`, "png");
          link.href = dataUrl;
          link.click();
        } else if (isAssetMode) {
          const dimConfig = DIMENSIONS.find((d) => d.key === assetDimension)!;
          const dataUrl = await toPng(node, {
            width: dimConfig.w,
            height: dimConfig.h,
            style: {
              transform: `scale(${dimConfig.w / 340})`,
              transformOrigin: "top left",
            },
            pixelRatio: 1,
          });
          const link = document.createElement("a");
          link.download = getExportFilename(`${activeTab}-asset`, "png");
          link.href = dataUrl;
          link.click();
        } else {
          const dataUrl = await toPng(node, { pixelRatio: 2 });
          const link = document.createElement("a");
          link.download = getExportFilename(`${activeTab}-preview`, "png");
          link.href = dataUrl;
          link.click();
        }

        toast({ title: "Downloaded", description: "Image saved." });
      }
    } catch (err) {
      console.error("Export error:", err);
      toast({ title: "Export failed", description: "Could not generate image.", variant: "destructive" });
    } finally {
      setIsExporting(false);
    }
  }, [content, activeTab, showMockup, isAssetMode, assetDimension, assetFont, assetBgColor, assetTextColor, assetAlign, isExporting, selectedPost?.mediaUrls]);

  useEffect(() => {
    setTriggerExport(handleDownloadImage);
    return () => setTriggerExport(null);
  }, [handleDownloadImage, setTriggerExport]);

  const showControls = isAssetMode || showMockup;

  const canvasBg = mockupBgType === "gradient" ? mockupGradient : mockupBgColor;
  const canvasPadding = PADDING_PREVIEW_MAP[mockupPadding];

  // Fixed canvas width so layout never depends on panel width.
  // Height is fixed for square/portrait modes, auto for content-fit.
  const CANVAS_W = 520;
  const getCanvasStyle = (): Record<string, string | number> => {
    const base: Record<string, string | number> = { width: `${CANVAS_W}px`, flexShrink: 0 };
    if (mockupAspectRatio === "1:1") return { ...base, height: `${CANVAS_W}px`, overflow: "hidden" };
    if (mockupAspectRatio === "9:16") return { ...base, height: `${Math.round(CANVAS_W * 16 / 9)}px`, overflow: "hidden" };
    return base;
  };

  const renderMockupControls = () => (
    <div className="space-y-3">
      <div className="flex items-center gap-2 flex-wrap">
        <label className="text-[10px] font-mono text-[#999] uppercase tracking-wider w-[50px]" data-testid="label-padding">Pad</label>
        <div className="flex gap-1">
          {(["sm", "md", "lg", "xl"] as const).map((p) => (
            <button
              key={p}
              data-testid={`button-padding-${p}`}
              onClick={() => setMockupPadding(p)}
              className={`h-7 px-2.5 text-[11px] font-mono border transition-colors ${
                mockupPadding === p
                  ? "bg-[#111827] text-white border-[#111827]"
                  : "bg-white text-[#666] border-[#E5E5E5] hover:border-[#999]"
              }`}
              style={{ borderRadius: "3px" }}
            >
              {p.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <label className="text-[10px] font-mono text-[#999] uppercase tracking-wider w-[50px]">BG</label>
        <div className="flex gap-1">
          <button
            data-testid="button-bg-solid"
            onClick={() => setMockupBgType("solid")}
            className={`h-7 px-2.5 text-[11px] font-mono border transition-colors ${
              mockupBgType === "solid"
                ? "bg-[#111827] text-white border-[#111827]"
                : "bg-white text-[#666] border-[#E5E5E5] hover:border-[#999]"
            }`}
            style={{ borderRadius: "3px" }}
          >
            Solid
          </button>
          <button
            data-testid="button-bg-gradient"
            onClick={() => setMockupBgType("gradient")}
            className={`h-7 px-2.5 text-[11px] font-mono border transition-colors ${
              mockupBgType === "gradient"
                ? "bg-[#111827] text-white border-[#111827]"
                : "bg-white text-[#666] border-[#E5E5E5] hover:border-[#999]"
            }`}
            style={{ borderRadius: "3px" }}
          >
            Gradient
          </button>
        </div>
      </div>

      {mockupBgType === "solid" && (
        <div className="flex items-center gap-1.5 flex-wrap pl-[58px]">
          {SOLID_COLORS.map((c) => (
            <button
              key={c.value}
              data-testid={`button-solid-${c.value}`}
              onClick={() => setMockupBgColor(c.value)}
              title={c.label}
              className={`w-7 h-7 border-2 transition-all ${
                mockupBgColor === c.value ? "border-[#111827] scale-110" : "border-[#E5E5E5] hover:border-[#999]"
              }`}
              style={{ backgroundColor: c.value, borderRadius: "4px" }}
            />
          ))}
          <input
            data-testid="input-mockup-bg-custom"
            type="color"
            value={mockupBgColor}
            onChange={(e) => setMockupBgColor(e.target.value)}
            className="w-7 h-7 border border-[#E5E5E5] cursor-pointer bg-transparent"
            style={{ borderRadius: "3px" }}
          />
        </div>
      )}

      {mockupBgType === "gradient" && (
        <div className="flex items-center gap-1.5 flex-wrap pl-[58px]">
          {GRADIENTS.map((g) => (
            <button
              key={g.label}
              data-testid={`button-gradient-${g.label}`}
              onClick={() => setMockupGradient(g.value)}
              title={g.label}
              className={`w-7 h-7 border-2 transition-all ${
                mockupGradient === g.value ? "border-[#111827] scale-110" : "border-[#E5E5E5] hover:border-[#999]"
              }`}
              style={{ background: g.value, borderRadius: "4px" }}
            />
          ))}
        </div>
      )}

      <div className="flex items-center gap-2 flex-wrap">
        <label className="text-[10px] font-mono text-[#999] uppercase tracking-wider w-[50px]">Ratio</label>
        <div className="flex gap-1">
          {(["auto", "1:1", "9:16"] as const).map((r) => (
            <button
              key={r}
              data-testid={`button-ratio-${r}`}
              onClick={() => setMockupAspectRatio(r)}
              className={`h-7 px-2.5 text-[11px] font-mono border transition-colors ${
                mockupAspectRatio === r
                  ? "bg-[#111827] text-white border-[#111827]"
                  : "bg-white text-[#666] border-[#E5E5E5] hover:border-[#999]"
              }`}
              style={{ borderRadius: "3px" }}
            >
              {r === "auto" ? "Auto" : r}
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-2">
        <label className="text-[10px] font-mono text-[#999] uppercase tracking-wider w-[50px]">Stats</label>
        <button
          data-testid="button-toggle-metrics"
          onClick={() => setMockupShowMetrics(!mockupShowMetrics)}
          className={`h-7 px-2.5 text-[11px] font-mono border transition-colors inline-flex items-center gap-1.5 ${
            mockupShowMetrics
              ? "bg-[#111827] text-white border-[#111827]"
              : "bg-white text-[#666] border-[#E5E5E5] hover:border-[#999]"
          }`}
          style={{ borderRadius: "3px" }}
        >
          {mockupShowMetrics ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
          {mockupShowMetrics ? "Showing" : "Hidden"}
        </button>
      </div>
    </div>
  );

  const renderPreview = () => {
    if (!selectedPost) {
      return (
        <div className="flex items-center justify-center flex-1 text-[14px] text-[#999]" data-testid="text-no-source">
          Select a source post
        </div>
      );
    }
    if (!content) {
      return (
        <div className="flex items-center justify-center h-32 text-[13px] text-[#999]" data-testid="text-empty-preview">
          Generate a draft to see the preview
        </div>
      );
    }

    if (showMockup) {
      return (
        <div style={{ display: "flex", justifyContent: "center" }}>
        <div
          ref={previewRef}
          data-testid="mockup-canvas"
          style={{
            background: canvasBg,
            padding: `${canvasPadding}px`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            ...getCanvasStyle(),
          }}
        >
          {activeTab === "twitter" && (
            <MockTwitterCard
              content={content}
              profileBase64={mockupProfileBase64}
              showMetrics={mockupShowMetrics}
              metrics={selectedPost?.metrics}
              mediaUrls={selectedPost?.mediaUrls}
            />
          )}
          {activeTab === "linkedin" && (
            <MockLinkedInCard
              content={content}
              profileBase64={mockupProfileBase64}
              showMetrics={mockupShowMetrics}
              metrics={selectedPost?.metrics}
              mediaUrls={selectedPost?.mediaUrls}
            />
          )}
        </div>
        </div>
      );
    }

    if (activeTab === "quote") {
      return (
        <AssetCard
          content={content}
          nodeRef={previewRef}
          bgColor={assetBgColor}
          textColor={assetTextColor}
          font={assetFont}
          align={assetAlign}
          dimension={assetDimension}
        />
      );
    }

    if (activeTab === "instagram") {
      const mediaUrls = selectedPost?.mediaUrls ?? [];
      const hasSourceImages = mediaUrls.length > 0;
      const slides = content.split("---").map((s) => s.trim()).filter(Boolean);
      slideRefs.current = [];
      // Use source profile picture, fall back to store profilePhoto, then saved default (same as LinkedIn/X)
      const instagramPhoto = selectedPost?.profilePhoto || profilePhoto || "/ig-profile.jpg";
      const instagramPhotoUrl = proxyPhotoUrl(instagramPhoto);
      const authorName = selectedPost?.author ?? "Sam Parr";
      const authorHandle = selectedPost?.authorHandle ?? "thesamparr";
      return (
        <div ref={previewRef} className="bg-white border border-[#E5E5E5] p-4 space-y-3" style={{ borderRadius: "3px" }}>
          <div className="flex items-center gap-3 pb-2">
            {instagramPhotoUrl ? (
              <img
                src={instagramPhotoUrl}
                alt=""
                className="w-8 h-8 rounded-full object-cover flex-shrink-0"
              />
            ) : (
              <div className="w-8 h-8 bg-[#111827] rounded-full flex items-center justify-center flex-shrink-0">
                <User className="w-4 h-4 text-white" />
              </div>
            )}
            <div>
              <p className="text-[13px] font-semibold text-[#111827]">{authorName}</p>
              <p className="text-[11px] text-[#666]">@{authorHandle}</p>
            </div>
          </div>
          {hasSourceImages ? (
            <>
              <div className="rounded-lg overflow-hidden border border-[#E5E5E5]">
                {mediaUrls.length === 1 ? (
                  <img
                    src={proxyImageUrl(mediaUrls[0]) ?? ""}
                    alt=""
                    className="w-full block object-cover max-h-[400px]"
                  />
                ) : (
                  <div
                    className="grid gap-0.5"
                    style={{
                      gridTemplateColumns: mediaUrls.length === 2 ? "1fr 1fr" : mediaUrls.length === 3 ? "2fr 1fr" : "1fr 1fr",
                      gridTemplateRows: mediaUrls.length >= 3 ? "1fr 1fr" : "1fr",
                      height: "280px",
                    }}
                  >
                    {mediaUrls.slice(0, 4).map((url, i) => (
                      <img
                        key={i}
                        src={proxyImageUrl(url) ?? ""}
                        alt=""
                        className="w-full h-full object-cover block"
                        style={{
                          gridColumn: mediaUrls.length === 3 && i === 0 ? "1" : "auto",
                          gridRow: mediaUrls.length === 3 && i === 0 ? "1 / 3" : "auto",
                        }}
                      />
                    ))}
                  </div>
                )}
              </div>
              {content && (
                <p className="text-[13px] leading-[1.5] text-[#111827] whitespace-pre-wrap">{content}</p>
              )}
            </>
          ) : (
            <>
              {slides.map((slide, i) => (
                <CarouselSlideCard
                  key={i}
                  slide={slide}
                  index={i}
                  total={slides.length}
                  nodeRef={(el: HTMLDivElement | null) => { slideRefs.current[i] = el; }}
                  bgColor={assetBgColor}
                  textColor={assetTextColor}
                  font={assetFont}
                  align={assetAlign}
                  dimension={assetDimension}
                />
              ))}
            </>
          )}
        </div>
      );
    }

    if (activeTab === "newsletter") {
      const lines = content.split("\n");
      let subject = "";
      let body = content;
      if (lines[0]?.startsWith("Subject:")) {
        subject = lines[0].replace("Subject:", "").trim();
        body = lines.slice(1).join("\n").trim();
      }
      const paragraphs = body.split("\n").filter((l) => l.trim());
      return (
        <div ref={previewRef} className="bg-white border border-[#E5E5E5]" style={{ borderRadius: "3px" }}>
          {subject && (
            <div className="px-6 py-4 border-b border-[#E5E5E5] bg-[#FAFAFA]">
              <p className="text-[11px] text-[#999] uppercase tracking-wider mb-1">Subject Line</p>
              <p className="text-[15px] font-semibold text-[#111827]">{subject}</p>
            </div>
          )}
          <div className="px-6 py-5">
            {paragraphs.map((p, i) => (
              <p key={i} className="text-[14px] leading-[1.8] text-[#333] mb-3 last:mb-0">{p}</p>
            ))}
          </div>
        </div>
      );
    }

    return null;
  };

  return (
    <div className="h-full flex flex-col bg-[#FAFAFA]">
      {selectedPost && (
      <div className="flex items-center justify-between px-4 h-[49px] border-b border-[#E5E5E5]">
        <div className="flex items-center gap-2">
          <PlatformIcon className="w-3.5 h-3.5 text-[#666]" />
          <h2 className="text-[13px] font-semibold text-[#111827] tracking-tight" data-testid="text-preview-title">
            {showMockup ? `${label} Mockup` : `${label} Preview`}
          </h2>
        </div>
        {content && (
          <div className="flex items-center gap-1.5">
            <button
              data-testid="button-copy-text"
              onClick={handleCopyText}
              className="inline-flex items-center gap-1.5 h-7 px-2.5 text-[11px] font-medium text-[#111827] bg-white border border-[#E5E5E5] transition-colors hover-elevate"
              style={{ borderRadius: "3px" }}
              title="Copy text"
            >
              <Copy className="w-3 h-3" />
              Copy
            </button>
            <button
              data-testid="button-download-image"
              onClick={handleDownloadImage}
              disabled={isExporting}
              className="inline-flex items-center gap-1.5 h-7 px-2.5 text-[11px] font-medium text-white border transition-colors disabled:opacity-50"
              style={{ borderRadius: "3px", backgroundColor: "#FF4F00", borderColor: "#FF4F00" }}
            >
              {isExporting ? <Loader2 className="w-3 h-3 animate-spin" /> : <Download className="w-3 h-3" />}
              Export
              <kbd className="ml-1 text-[9px] font-mono text-white/70 bg-white/20 px-1 py-0.5 border border-white/20 rounded-sm">
                ⌘↵
              </kbd>
            </button>
          </div>
        )}
      </div>
      )}

      {showControls && content && (
        <div className="px-4 py-3 border-b border-[#E5E5E5] bg-white">
          {showMockup && renderMockupControls()}

          {isAssetMode && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <label className="text-[10px] font-mono text-[#999] uppercase tracking-wider w-[60px]">BG</label>
                <input
                  data-testid="input-asset-bg"
                  type="color"
                  value={assetBgColor}
                  onChange={(e) => setAssetBgColor(e.target.value)}
                  className="w-7 h-7 border border-[#E5E5E5] cursor-pointer bg-transparent"
                  style={{ borderRadius: "3px" }}
                />
                <span className="text-[11px] font-mono text-[#999]">{assetBgColor}</span>
                <div className="w-px h-4 bg-[#E5E5E5] mx-1" />
                <label className="text-[10px] font-mono text-[#999] uppercase tracking-wider w-[40px]">Text</label>
                <input
                  data-testid="input-asset-text"
                  type="color"
                  value={assetTextColor}
                  onChange={(e) => setAssetTextColor(e.target.value)}
                  className="w-7 h-7 border border-[#E5E5E5] cursor-pointer bg-transparent"
                  style={{ borderRadius: "3px" }}
                />
                <span className="text-[11px] font-mono text-[#999]">{assetTextColor}</span>
              </div>

              <div className="flex items-center gap-2">
                <label className="text-[10px] font-mono text-[#999] uppercase tracking-wider w-[60px]">Font</label>
                <select
                  data-testid="select-font"
                  value={assetFont}
                  onChange={(e) => setAssetFont(e.target.value)}
                  className="h-7 px-2 text-[12px] text-[#111827] bg-white border border-[#E5E5E5] font-mono"
                  style={{ borderRadius: "3px" }}
                >
                  {FONTS.map((f) => (
                    <option key={f} value={f}>{f}</option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-2">
                <label className="text-[10px] font-mono text-[#999] uppercase tracking-wider w-[60px]">Size</label>
                <div className="flex gap-1">
                  {DIMENSIONS.map((dim) => (
                    <button
                      key={dim.key}
                      data-testid={`button-dim-${dim.key}`}
                      onClick={() => setAssetDimension(dim.key)}
                      className={`h-7 px-2.5 text-[11px] font-mono border transition-colors ${
                        assetDimension === dim.key
                          ? "bg-[#111827] text-white border-[#111827]"
                          : "bg-white text-[#666] border-[#E5E5E5] hover:border-[#999]"
                      }`}
                      style={{ borderRadius: "3px" }}
                    >
                      {dim.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-center gap-2">
                <label className="text-[10px] font-mono text-[#999] uppercase tracking-wider w-[60px]">Align</label>
                <div className="flex gap-1">
                  {(["left", "center", "right"] as const).map((a) => (
                    <button
                      key={a}
                      data-testid={`button-align-${a}`}
                      onClick={() => setAssetAlign(a)}
                      className={`h-7 w-8 flex items-center justify-center border transition-colors ${
                        assetAlign === a
                          ? "bg-[#111827] text-white border-[#111827]"
                          : "bg-white text-[#666] border-[#E5E5E5] hover:border-[#999]"
                      }`}
                      style={{ borderRadius: "3px" }}
                    >
                      {a === "left" ? <AlignLeft className="w-3 h-3" /> : a === "center" ? <AlignCenter className="w-3 h-3" /> : <AlignRight className="w-3 h-3" />}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      <div className="flex-1 overflow-auto p-4">
        {renderPreview()}
      </div>
    </div>
  );
}
