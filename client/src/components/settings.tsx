import { useState, useEffect } from "react";
import { useHopperStore } from "@/lib/store";
import { setClaudeApiKey, deleteClaudeApiKey, hasClaudeApiKey } from "@/lib/apiKey";
import { X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";

export default function Settings() {
  const { showSettings, setShowSettings } = useHopperStore();
  const [apiKeyInput, setApiKeyInput] = useState("");
  const [hasKey, setHasKey] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (showSettings) {
      setHasKey(hasClaudeApiKey());
      setApiKeyInput("");
    }
  }, [showSettings]);

  const handleAdd = () => {
    const trimmed = apiKeyInput.trim();
    if (!trimmed) {
      toast({ title: "Enter an API key", variant: "destructive" });
      return;
    }
    setClaudeApiKey(trimmed);
    setHasKey(true);
    setApiKeyInput("");
    toast({ title: "API key saved" });
  };

  const handleDelete = () => {
    deleteClaudeApiKey();
    setHasKey(false);
    setApiKeyInput("");
    toast({ title: "API key removed" });
  };

  if (!showSettings) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/20 z-50 flex items-center justify-center"
        onClick={() => setShowSettings(false)}
      >
        <motion.div
          initial={{ opacity: 0, y: 16, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 16, scale: 0.98 }}
          transition={{ duration: 0.15 }}
          className="bg-white border border-[#E5E5E5] w-full max-w-md flex flex-col"
          style={{
            borderRadius: "3px",
            boxShadow: "0 4px 24px rgba(0,0,0,0.12)",
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between px-5 py-4 border-b border-[#E5E5E5]">
            <h2 className="text-[15px] font-semibold text-[#111827]">Settings</h2>
            <button
              data-testid="button-close-settings"
              onClick={() => setShowSettings(false)}
              className="text-[#999] hover:text-[#666] transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="px-5 py-4 space-y-4">
            <div>
              <label className="text-[12px] font-medium text-[#666] block mb-1.5">
                Claude API Key
              </label>
              <p className="text-[11px] text-[#999] mb-2">
                Used for AI generation. Stored locally, never sent except to Anthropic.
              </p>
              {hasKey ? (
                <div className="flex items-center gap-2">
                  <span className="text-[13px] text-[#666] font-mono">
                    sk-ant-•••••••••••••••••••••••••••••••
                  </span>
                  <button
                    data-testid="button-delete-api-key"
                    onClick={handleDelete}
                    className="text-[11px] font-medium text-red-600 hover:text-red-700"
                  >
                    Delete
                  </button>
                </div>
              ) : (
                <div className="flex gap-2">
                  <Input
                    type="password"
                    placeholder="sk-ant-..."
                    value={apiKeyInput}
                    onChange={(e) => setApiKeyInput(e.target.value)}
                    className="flex-1 font-mono text-[13px]"
                    data-testid="input-api-key"
                  />
                  <button
                    data-testid="button-add-api-key"
                    onClick={handleAdd}
                    className="h-9 px-3 text-[11px] font-medium text-white bg-[#111827] hover:bg-[#1f2937] border border-[#111827]"
                    style={{ borderRadius: "3px" }}
                  >
                    Add
                  </button>
                </div>
              )}
            </div>
            {hasKey && (
              <div className="flex gap-2">
                <Input
                  type="password"
                  placeholder="Enter new key to replace"
                  value={apiKeyInput}
                  onChange={(e) => setApiKeyInput(e.target.value)}
                  className="flex-1 font-mono text-[13px]"
                  data-testid="input-api-key-replace"
                />
                <button
                  data-testid="button-update-api-key"
                  onClick={handleAdd}
                  disabled={!apiKeyInput.trim()}
                  className="h-9 px-3 text-[11px] font-medium text-[#111827] bg-[#FAFAFA] border border-[#E5E5E5] hover:bg-[#F0F0F0] disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{ borderRadius: "3px" }}
                >
                  Update
                </button>
              </div>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
