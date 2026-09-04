import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useCollection } from '../context/CollectionContext';

export const Preloader: React.FC = () => {
  const { isLoading } = useCollection();

  return (
    <AnimatePresence>
      {isLoading && (
        <motion.div
          initial={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
          className="fixed inset-0 z-50 bg-[var(--bg-primary)]/80 pointer-events-none transform-gpu"
        />
      )}
    </AnimatePresence>
  );
};

