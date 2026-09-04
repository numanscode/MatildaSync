import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useCollection } from '../context/CollectionContext';
import { ShoppingBag, ArrowRight, Check } from 'lucide-react';

export const CheckoutHandoff: React.FC = () => {
  const { isCheckoutHandoff, cartTotal } = useCollection();
  const [step, setStep] = useState<'fade' | 'redirect'>('fade');

  useEffect(() => {
    if (isCheckoutHandoff) {
      const timer = setTimeout(() => {
        setStep('redirect');
      }, 400);
      return () => clearTimeout(timer);
    }
  }, [isCheckoutHandoff]);

  if (!isCheckoutHandoff) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.4 }}
        className="fixed inset-0 z-[100] flex flex-col items-center justify-center p-6 sm:p-8 bg-[#2B050B]/60 backdrop-blur-md text-[var(--text-primary)]"
      >
        <div className="text-center space-y-6 max-w-sm w-full bg-[var(--bg-primary)] p-8 sm:p-10 rounded-[20px] border border-[var(--border-main)] shadow-2xl">
          {step === 'fade' ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-xs lowercase text-[var(--border-maroon)] font-semibold animate-pulse flex items-center justify-center gap-2"
            >
              <ShoppingBag className="w-4 h-4" />
              <span>redirecting...</span>
            </motion.div>
          ) : (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-6"
            >
              <div className="w-12 h-12 rounded-full bg-[var(--tag-bg)] border border-[var(--border-maroon)] text-[var(--border-maroon)] mx-auto flex items-center justify-center shadow-xs">
                <Check className="w-5 h-5" />
              </div>
              
              <div>
                <h2 className="text-2xl font-semibold lowercase tracking-tight text-[var(--text-dominant)]">
                  checkout
                </h2>
                <p className="text-sm text-[var(--text-muted)] mt-1 lowercase">
                  redirecting to secure payment
                </p>
              </div>

              <div className="border border-[var(--border-main)]/50 p-4 text-[11px] space-y-2 bg-white/80 rounded-2xl text-left shadow-xs lowercase">
                <div className="flex justify-between border-b border-[var(--border-main)]/30 pb-2">
                  <span className="font-semibold text-[var(--text-muted)]">items subtotal</span>
                  <span className="font-bold text-[var(--text-dominant)]">₹{cartTotal.toLocaleString('en-IN')}</span>
                </div>
                <div className="flex justify-between border-b border-[var(--border-main)]/30 pb-2">
                  <span className="font-semibold text-[var(--text-muted)]">shipping</span>
                  <span className="font-medium text-[var(--text-muted)] italic">to be calculated at next step</span>
                </div>
                <div className="flex justify-between pt-0.5">
                  <span className="font-semibold text-[var(--text-muted)]">bag subtotal</span>
                  <span className="font-extrabold text-[var(--border-maroon)]">₹{cartTotal.toLocaleString('en-IN')}</span>
                </div>
              </div>

              <button
                onClick={() => {
                  window.location.href = '/checkout';
                }}
                className="w-full py-3 rounded-none border border-[var(--border-main)] bg-[var(--border-main)] text-white text-xs font-semibold lowercase shadow-md hover:bg-transparent hover:text-[var(--text-dominant)] transition-all flex items-center justify-center gap-2"
              >
                <span>continue to payment</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </motion.div>
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  );
};
