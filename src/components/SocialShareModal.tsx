import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Share2, Copy, Check, MessageCircle, Send } from 'lucide-react';

interface SocialShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  url?: string;
  description?: string;
}

export const SocialShareModal: React.FC<SocialShareModalProps> = ({
  isOpen,
  onClose,
  title = "matilda. — The Valley's Finest Accessory Store",
  url = typeof window !== 'undefined' ? window.location.href : 'https://matilda-store.vercel.app/',
  description = "Solid 925 sterling silver jewelry & accessories forged in the valley to rest cold on skin."
}) => {
  const [copied, setCopied] = useState(false);

  const shareText = `${title}\n${description}\n${url}`;

  const handleCopyLink = async () => {
    try {
      if (navigator.clipboard) {
        await navigator.clipboard.writeText(url);
      } else {
        const input = document.createElement('input');
        input.value = url;
        document.body.appendChild(input);
        input.select();
        document.execCommand('copy');
        document.body.removeChild(input);
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch (e) {
      console.warn("Copy link error:", e);
    }
  };

  const handleWhatsAppShare = () => {
    const waUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(shareText)}`;
    window.open(waUrl, '_blank', 'noopener,noreferrer');
  };

  const handleTwitterShare = () => {
    const twUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(title)}&url=${encodeURIComponent(url)}`;
    window.open(twUrl, '_blank', 'noopener,noreferrer');
  };

  const handleNativeShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title,
          text: description,
          url
        });
      } catch (e) {}
    } else {
      handleCopyLink();
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/60 backdrop-blur-xs transition-opacity"
          />

          <motion.div
            initial={{ y: '100%', opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: '100%', opacity: 0 }}
            transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
            className="relative w-full max-w-md bg-[var(--bg-primary)] rounded-t-3xl sm:rounded-3xl border border-[var(--border-main)]/30 p-6 shadow-2xl z-10 overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center justify-between pb-4 border-b border-[var(--border-main)]/20">
              <div className="flex items-center space-x-2.5">
                <div className="w-8 h-8 rounded-full bg-[var(--accent-maroon)]/10 flex items-center justify-center text-[var(--accent-maroon)]">
                  <Share2 className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-serif text-lg text-[var(--text-dominant)]">Share this Piece</h3>
                  <p className="text-xs text-[var(--text-muted)]">Spread the word from the valley</p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="p-1.5 rounded-full hover:bg-[var(--border-main)]/15 text-[var(--text-muted)] hover:text-[var(--text-dominant)] transition-colors"
                aria-label="Close share sheet"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Quick Share Options */}
            <div className="grid grid-cols-3 gap-3 my-6">
              {/* WhatsApp */}
              <button
                onClick={handleWhatsAppShare}
                className="flex flex-col items-center justify-center p-3.5 rounded-2xl bg-[#25D366]/10 hover:bg-[#25D366]/20 border border-[#25D366]/25 transition-all text-[#128C7E] group"
              >
                <div className="w-10 h-10 rounded-xl bg-[#25D366] text-white flex items-center justify-center shadow-sm group-hover:scale-105 transition-transform mb-2">
                  <MessageCircle className="w-5 h-5 fill-current" />
                </div>
                <span className="text-xs font-medium text-[var(--text-dominant)]">WhatsApp</span>
              </button>

              {/* X / Twitter */}
              <button
                onClick={handleTwitterShare}
                className="flex flex-col items-center justify-center p-3.5 rounded-2xl bg-black/5 hover:bg-black/10 border border-black/10 transition-all group"
              >
                <div className="w-10 h-10 rounded-xl bg-black text-white flex items-center justify-center shadow-sm group-hover:scale-105 transition-transform mb-2">
                  <span className="font-bold text-base">𝕏</span>
                </div>
                <span className="text-xs font-medium text-[var(--text-dominant)]">X / Twitter</span>
              </button>

              {/* Native / More */}
              <button
                onClick={handleNativeShare}
                className="flex flex-col items-center justify-center p-3.5 rounded-2xl bg-[var(--accent-maroon)]/10 hover:bg-[var(--accent-maroon)]/15 border border-[var(--accent-maroon)]/20 transition-all group"
              >
                <div className="w-10 h-10 rounded-xl bg-[var(--accent-maroon)] text-white flex items-center justify-center shadow-sm group-hover:scale-105 transition-transform mb-2">
                  <Send className="w-4 h-4" />
                </div>
                <span className="text-xs font-medium text-[var(--text-dominant)]">More...</span>
              </button>
            </div>

            {/* Copy Direct Link */}
            <div className="flex items-center space-x-2 p-2 rounded-xl bg-[var(--card-inner)] border border-[var(--border-main)]/20">
              <input
                type="text"
                readOnly
                value={url}
                className="flex-1 bg-transparent px-2 text-xs text-[var(--text-dominant)] truncate outline-hidden select-all font-mono"
              />
              <button
                onClick={handleCopyLink}
                className="flex items-center space-x-1 px-3 py-1.5 rounded-lg bg-[var(--text-dominant)] text-[var(--bg-primary)] hover:opacity-90 transition-opacity text-xs font-medium shrink-0 shadow-xs"
              >
                {copied ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-300" />
                    <span>Copied</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>Copy Link</span>
                  </>
                )}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
