import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useCollection } from '../context/CollectionContext';
import { Search, X, ShoppingBag, ArrowRight } from 'lucide-react';

export const SearchModal: React.FC = () => {
  const { isSearchOpen, setIsSearchOpen, openProductModal, addToCart, products } = useCollection();
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isSearchOpen) {
      setTimeout(() => inputRef.current?.focus(), 100);
    } else {
      setQuery('');
    }
  }, [isSearchOpen]);

  if (!isSearchOpen) return null;

  const results = query.trim() === '' 
    ? [] 
    : products.filter((p) => {
        const q = query.toLowerCase();
        return (
          p.title.toLowerCase().includes(q) ||
          p.description.toLowerCase().includes(q) ||
          p.category.toLowerCase().includes(q) ||
          p.material.toLowerCase().includes(q) ||
          p.collection.toLowerCase().includes(q)
        );
      });

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[100] flex items-start justify-center pt-12 sm:pt-20 px-4 bg-black/60 backdrop-blur-sm">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={() => setIsSearchOpen(false)}
          className="absolute inset-0"
        />

        <motion.div
          initial={{ scale: 0.96, opacity: 0, y: -10 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.96, opacity: 0, y: -10 }}
          transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
          className="relative z-10 w-full max-w-2xl bg-[var(--bg-primary)] text-[var(--text-primary)] border border-[var(--border-main)] rounded-2xl shadow-2xl overflow-hidden p-5 sm:p-6"
        >
          {/* Header */}
          <div className="flex items-center justify-between pb-3 border-b border-[var(--border-main)]">
            <span className="font-display text-xs lowercase font-bold text-[var(--text-dominant)]">
              search catalogue
            </span>
            <button
              onClick={() => setIsSearchOpen(false)}
              className="w-8 h-8 rounded-full border border-[var(--border-main)] bg-white/10 flex items-center justify-center text-[var(--text-dominant)] hover:bg-[var(--border-maroon)] hover:text-white transition-all text-xs"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Search Input */}
          <div className="relative mt-4">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--border-maroon)]" />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="type to search products..."
              className="w-full bg-[var(--card-bg)] border border-[var(--border-main)] rounded-xl pl-11 pr-10 py-3 text-xs text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:border-[var(--border-maroon)] transition-all lowercase"
            />
            {query && (
              <button
                onClick={() => setQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)] lowercase"
              >
                clear
              </button>
            )}
          </div>

          {/* Search Results */}
          {query.trim() !== '' && (
            <div className="max-h-[50vh] overflow-y-auto space-y-3 pt-2 pr-1">
              {results.length > 0 ? (
                results.map((product) => (
                  <div
                    key={product.id}
                    onClick={() => {
                      openProductModal(product);
                      setIsSearchOpen(false);
                    }}
                    className="group flex items-center justify-between gap-3 p-3 rounded-xl border border-[var(--border-main)] bg-[var(--card-bg)] hover:border-[var(--border-maroon)] cursor-pointer transition-all"
                  >
                    <div className="flex items-center gap-3">
                      <img
                        src={product.mainImage}
                        alt={product.title}
                        className="w-12 h-14 object-cover rounded-lg border border-[var(--border-main)]"
                      />
                      <div>
                        <h4 className="font-display text-xs font-bold lowercase text-[var(--text-dominant)] group-hover:text-[var(--border-maroon)] transition-colors">
                          {product.title}
                        </h4>
                        <p className="text-xs text-[var(--text-muted)] break-words lowercase">
                          {product.description}
                        </p>
                        <span className="text-[var(--border-maroon)] font-matilda text-base font-bold not-italic lowercase block">
                          {product.category} • ₹ {product.price.toLocaleString('en-IN')}
                        </span>
                      </div>
                    </div>

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        addToCart(product, product.variants[0]);
                      }}
                      className="px-3 py-1.5 rounded-full bg-[var(--border-maroon)] text-white text-xs font-semibold hover:bg-[var(--text-dominant)] transition-all shrink-0 flex items-center gap-1"
                    >
                      <ShoppingBag className="w-3 h-3" />
                      <span>add</span>
                    </button>
                  </div>
                ))
              ) : (
                <div className="py-10 text-center text-xs text-[var(--text-muted)]">
                  nothing found for "{query}". try searching silver, wool, or ceramics.
                </div>
              )}
            </div>
          )}
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
