const STORAGE_KEY = "claude_api_key";

export function getClaudeApiKey(): string | null {
  return localStorage.getItem(STORAGE_KEY) || import.meta.env.VITE_CLAUDE_API_KEY || null;
}

export function setClaudeApiKey(key: string): void {
  localStorage.setItem(STORAGE_KEY, key.trim());
}

export function deleteClaudeApiKey(): void {
  localStorage.removeItem(STORAGE_KEY);
}

export function hasClaudeApiKey(): boolean {
  return !!getClaudeApiKey();
}
