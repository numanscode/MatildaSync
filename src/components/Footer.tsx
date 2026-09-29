import React from 'react';
import { Link } from 'react-router-dom';
import { useCollection } from '../context/CollectionContext';
import { Truck } from 'lucide-react';

export const Footer: React.FC = () => {
  const { viewMode } = useCollection();

  return (
    <footer className="relative z-10 w-full bg-transparent text-[var(--text-primary)] transition-colors duration-500 pt-10 sm:pt-16 pb-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 space-y-10">
        {/* Top Section: Manifesto - Shown on brand story view */}
        {viewMode === 'brand' && (
          <div className="max-w-3xl mx-auto text-center pb-8 border-b border-[var(--border-main)]/20 space-y-3">
            <span className="text-xs text-[var(--border-maroon)] lowercase tracking-wider block font-bold">
              manifesto
            </span>
            <p className="font-serif-italic italic text-xl sm:text-2xl text-[var(--text-dominant)] leading-snug font-normal lowercase">
              "home should feel warm and real. we don't make anything we wouldn't keep in our own rooms."
            </p>
          </div>
        )}

        {/* Watermark Title Footer */}
        <div className="text-center pt-2">
          <h2 className="font-matilda text-3xl sm:text-5xl font-normal lowercase tracking-normal text-[var(--border-maroon)] opacity-30 select-none">
            matilda
          </h2>
          <div className="flex flex-col sm:flex-row justify-between items-center text-xs text-[var(--text-muted)] mt-4 gap-3 lowercase font-medium">
            <span>© 2026 Duha Ajaz Pandith. all rights reserved</span>
            <div className="flex items-center gap-3">
              <Link 
                to="/track" 
                className="hover:text-[var(--border-maroon)] transition-colors inline-flex items-center gap-1 font-semibold text-[var(--text-dominant)]"
              >
                <Truck className="w-3.5 h-3.5 text-[var(--border-maroon)]" />
                <span>track order</span>
              </Link>
              <span>•</span>
              <span>the valley's finest accessory store</span>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
};


