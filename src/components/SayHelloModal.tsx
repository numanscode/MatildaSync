import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useCollection } from '../context/CollectionContext';
import { X, Send } from 'lucide-react';

export const SayHelloModal: React.FC = () => {
  const { isSayHelloOpen, setIsSayHelloOpen } = useCollection();
  const [submitted, setSubmitted] = useState<boolean>(false);
  const [form, setForm] = useState({ name: '', email: '', message: '' });

  if (!isSayHelloOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.email || !form.message) return;
    setSubmitted(true);
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={() => setIsSayHelloOpen(false)}
          className="absolute inset-0"
        />

        <motion.div
          initial={{ scale: 0.95, opacity: 0, y: 10 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.95, opacity: 0, y: 10 }}
          className="relative z-10 w-full max-w-lg bg-[var(--bg-primary)] text-[var(--text-primary)] border border-[var(--border-main)] rounded-3xl p-6 sm:p-8 shadow-2xl"
        >
          <div className="flex justify-between items-start border-b border-[var(--border-main)] pb-4 mb-6 text-xs">
            <div>
              <span className="text-[var(--accent-script)] uppercase tracking-widest block font-serif-italic text-base font-semibold">
                Contact & Inquiries
              </span>
              <h3 className="font-display text-3xl uppercase font-extrabold text-[var(--text-dominant)] mt-1">Say Hello</h3>
            </div>
            <button
              onClick={() => {
                setIsSayHelloOpen(false);
                setSubmitted(false);
              }}
              className="w-9 h-9 rounded-full border border-[var(--border-main)] bg-white/80 flex items-center justify-center text-[var(--text-dominant)] hover:bg-[var(--border-maroon)] hover:text-white transition-all shadow-xs"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {submitted ? (
            <div className="text-center py-8 space-y-5 text-xs">
              <p className="font-serif-italic italic text-3xl text-[var(--accent-script)]">
                We got your message.
              </p>
              <p className="border-y border-[var(--border-main)] py-4 text-sm text-[var(--text-muted)]">
                We'll reply directly to <strong className="text-[var(--text-dominant)]">{form.email}</strong> within 24 hours. Thanks for reaching out.
              </p>
              <button
                onClick={() => {
                  setIsSayHelloOpen(false);
                  setSubmitted(false);
                }}
                className="bg-[var(--border-maroon)] text-white px-8 py-3 rounded-full uppercase hover:bg-[var(--text-dominant)] transition-all font-bold text-xs shadow-sm"
              >
                Return to store
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4 text-xs">
              <div>
                <label className="block mb-1.5 font-bold uppercase tracking-wider text-[var(--text-dominant)]">
                  Your Name
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Matilda"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full bg-white border border-[var(--border-main)] rounded-2xl px-4 py-3 text-sm text-[var(--text-primary)] focus:outline-none focus:border-[var(--border-maroon)] shadow-xs"
                />
              </div>

              <div>
                <label className="block mb-1.5 font-bold uppercase tracking-wider text-[var(--text-dominant)]">
                  Your Email
                </label>
                <input
                  type="email"
                  required
                  placeholder="you@domain.com"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  className="w-full bg-white border border-[var(--border-main)] rounded-2xl px-4 py-3 text-sm text-[var(--text-primary)] focus:outline-none focus:border-[var(--border-maroon)] shadow-xs"
                />
              </div>

              <div>
                <label className="block mb-1.5 font-bold uppercase tracking-wider text-[var(--text-dominant)]">
                  Message or Inquiry
                </label>
                <textarea
                  rows={4}
                  required
                  placeholder="Ask about sizing, custom orders, or just say hello."
                  value={form.message}
                  onChange={(e) => setForm({ ...form, message: e.target.value })}
                  className="w-full bg-white border border-[var(--border-main)] rounded-2xl px-4 py-3 text-sm text-[var(--text-primary)] focus:outline-none focus:border-[var(--border-maroon)] shadow-xs"
                />
              </div>

              <button
                type="submit"
                className="w-full py-4 rounded-full bg-[var(--border-maroon)] text-white font-bold uppercase hover:bg-[var(--text-dominant)] transition-all text-xs tracking-wider flex items-center justify-center gap-2 shadow-md"
              >
                <Send className="w-4 h-4" />
                <span>Send Note</span>
              </button>
            </form>
          )}
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

