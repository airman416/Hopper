/**
 * RejectReasonPopover — Framer Motion popover that appears when the user
 * rejects a draft. Asks for the reason: "Too AI-sounding", "Too long",
 * or "Wrong tone". Saves to Rejected_Vault and decrements weight_scores.
 */

import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";

const REJECT_REASONS = [
    "Too AI-sounding",
    "Too long",
    "Wrong tone",
] as const;

export type RejectReason = (typeof REJECT_REASONS)[number];

interface RejectReasonPopoverProps {
    isOpen: boolean;
    onSelect: (reason: RejectReason) => void;
    onClose: () => void;
}

export default function RejectReasonPopover({
    isOpen,
    onSelect,
    onClose,
}: RejectReasonPopoverProps) {
    return (
        <AnimatePresence>
            {isOpen && (
                <motion.div
                    initial={{ opacity: 0, scale: 0.9, y: 8 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.9, y: 8 }}
                    transition={{ duration: 0.15, ease: "easeOut" }}
                    className="absolute bottom-14 right-4 z-50 bg-white border border-[#E5E5E5] p-3 min-w-[220px]"
                    style={{
                        borderRadius: "6px",
                        boxShadow: "0 4px 16px rgba(0,0,0,0.12), 0 1px 4px rgba(0,0,0,0.08)",
                    }}
                >
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-[11px] font-semibold text-[#999] uppercase tracking-wider">
                            Why reject?
                        </span>
                        <button
                            onClick={onClose}
                            className="text-[#CCC] hover:text-[#999] transition-colors"
                        >
                            <X className="w-3.5 h-3.5" />
                        </button>
                    </div>

                    <div className="flex flex-col gap-1.5">
                        {REJECT_REASONS.map((reason) => (
                            <button
                                key={reason}
                                onClick={() => onSelect(reason)}
                                className="w-full text-left px-3 py-2 text-[12px] font-medium text-[#111827] bg-[#FAFAFA] border border-[#E5E5E5] hover:bg-[#F0F0F0] hover:border-[#CCC] transition-all"
                                style={{ borderRadius: "4px" }}
                            >
                                {reason}
                            </button>
                        ))}
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}

export { REJECT_REASONS };
