const AI_BANNED_WORDS = [
  "delve",
  "tapestry",
  "robust",
  "dynamic",
  "synergy",
  "leverage",
  "paradigm",
  "holistic",
  "ecosystem",
  "innovative",
  "transformative",
  "groundbreaking",
  "cutting-edge",
  "game-changer",
  "disruptive",
  "unlock",
  "empower",
  "elevate",
  "amplify",
  "harness",
  "pivotal",
  "seamless",
  "streamline",
  "spearhead",
  "foster",
  "nuanced",
  "multifaceted",
  "comprehensive",
  "utilize",
  "facilitate",
  "underscore",
  "landscape",
  "navigate",
  "realm",
  "testament",
];

function countSyllables(word: string): number {
  word = word.toLowerCase().replace(/[^a-z]/g, "");
  if (word.length <= 3) return 1;

  word = word.replace(/(?:[^laeiouy]es|ed|[^laeiouy]e)$/, "");
  word = word.replace(/^y/, "");

  const matches = word.match(/[aeiouy]{1,2}/g);
  return matches ? matches.length : 1;
}

function countSentences(text: string): number {
  const sentences = text
    .split(/[.!?]+/)
    .filter((s) => s.trim().length > 0);
  return Math.max(sentences.length, 1);
}

function getWords(text: string): string[] {
  return text
    .split(/\s+/)
    .filter((w) => w.replace(/[^a-zA-Z]/g, "").length > 0);
}

export function calculateFleschKincaid(text: string): number {
  if (!text.trim()) return 0;

  const words = getWords(text);
  const wordCount = words.length;
  if (wordCount === 0) return 0;

  const sentenceCount = countSentences(text);
  const syllableCount = words.reduce(
    (sum, word) => sum + countSyllables(word),
    0,
  );

  const grade =
    0.39 * (wordCount / sentenceCount) +
    11.8 * (syllableCount / wordCount) -
    15.59;

  return Math.max(0, Math.round(grade * 10) / 10);
}

export function getReadabilityColor(grade: number): string {
  if (grade === 0) return "text-muted-foreground";
  if (grade <= 7) return "text-green-700";
  if (grade <= 8) return "text-amber-600";
  return "text-red-600";
}

export function getReadabilityBg(grade: number): string {
  if (grade === 0) return "bg-muted";
  if (grade <= 7) return "bg-green-50 border-green-200";
  if (grade <= 8) return "bg-amber-50 border-amber-200";
  return "bg-red-50 border-red-200";
}

export interface VibeCheckResult {
  score: number;
  flaggedWords: { word: string; index: number }[];
}

export function calculateHumanScore(text: string): VibeCheckResult {
  if (!text.trim()) return { score: 100, flaggedWords: [] };

  const lowerText = text.toLowerCase();
  const flaggedWords: { word: string; index: number }[] = [];

  for (const banned of AI_BANNED_WORDS) {
    let searchIndex = 0;
    while (true) {
      const found = lowerText.indexOf(banned, searchIndex);
      if (found === -1) break;
      flaggedWords.push({ word: banned, index: found });
      searchIndex = found + banned.length;
    }
  }

  const penalty = flaggedWords.length * 8;
  const score = Math.max(0, 100 - penalty);

  return { score, flaggedWords };
}

export function highlightBannedWords(
  text: string,
  flaggedWords: { word: string; index: number }[],
): string {
  if (flaggedWords.length === 0) return text;

  const sorted = [...flaggedWords].sort((a, b) => b.index - a.index);
  let result = text;

  for (const { word, index } of sorted) {
    const original = result.substring(index, index + word.length);
    result =
      result.substring(0, index) +
      `{{AI_FLAG:${original}}}` +
      result.substring(index + word.length);
  }

  return result;
}

export { AI_BANNED_WORDS };
