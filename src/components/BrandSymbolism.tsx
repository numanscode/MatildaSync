import React from 'react';
import { motion } from 'motion/react';

export const BrandSymbolism: React.FC = () => {
  return (
    <section className="w-full py-16 sm:py-24 bg-[var(--bg-secondary)] transition-colors duration-500">
      <div className="max-w-4xl mx-auto px-6 sm:px-8 text-center space-y-6">
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="space-y-4"
        >
          <span className="text-xs lowercase tracking-wider text-[var(--border-maroon)] font-bold block">
            philosophy
          </span>

          <h2 className="text-xs sm:text-sm font-bold lowercase tracking-wider text-[var(--text-dominant)]">
            quiet objects, honest materials
          </h2>

          <p
            style={{ fontFamily: "'Viaoda Libre', serif", fontStyle: 'italic', fontSize: '19px' }}
            className="text-[var(--text-primary)] leading-relaxed font-normal max-w-2xl mx-auto lowercase"
          >
            "matilda is born from a desire for quiet permanence. we craft pieces that age with you—solid sterling silver forged by hand, raw stoneware clay thrown on the wheel, and heavy woven linens made to withstand season after season."
          </p>
        </motion.div>
      </div>
    </section>
  );
};

