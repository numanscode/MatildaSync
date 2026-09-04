import React from 'react';
import { motion, useScroll, useTransform } from 'motion/react';
import { useCollection } from '../context/CollectionContext';
import { GradientShader } from './GradientShader';

export const GlobalBackground: React.FC = () => {
  const { viewMode } = useCollection();
  const { scrollY } = useScroll();
  
  // Smooth, gradual scroll fade into content without any abrupt cutoffs
  const homeOpacity = useTransform(scrollY, [150, 950], [1, 0.45]);

  return (
    <motion.div 
      style={{ opacity: viewMode === 'brand' ? homeOpacity : 0.85 }}
      className="fixed inset-0 pointer-events-none overflow-hidden select-none z-0 bg-[var(--bg-primary)] transition-colors duration-700"
    >
      {/* High-Performance WebGL Gradient Shader */}
      <GradientShader />

      {/* Subtle Ambient Tints and Delicate Film Grain */}
      <div className="absolute inset-0 bg-[var(--bg-primary)]/25 pointer-events-none" />
      <div className="absolute inset-0 film-grain opacity-15 pointer-events-none" />
    </motion.div>
  );
};

