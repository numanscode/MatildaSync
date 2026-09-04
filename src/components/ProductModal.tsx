import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useCollection } from '../context/CollectionContext';
import { ProductVariant } from '../types';
import { ShoppingBag, X, Check, Zap, ChevronLeft, ChevronRight, Info, Share2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { SocialShareModal } from './SocialShareModal';

export const ProductModal: React.FC = () => {
  const { selectedProduct, closeProductModal, addToCart, setIsCartOpen, triggerCheckoutHandoff } = useCollection();
  const navigate = useNavigate();
  const [selectedVariant, setSelectedVariant] = useState<ProductVariant | null>(null);
  const [activeImageIndex, setActiveImageIndex] = useState<number>(0);
  const [showFullDetails, setShowFullDetails] = useState<boolean>(false);
  const [isZoomed, setIsZoomed] = useState<boolean>(false);
  const [isShareOpen, setIsShareOpen] = useState<boolean>(false);

  useEffect(() => {
    if (selectedProduct) {
      if (selectedProduct.variants.length > 0) {
        setSelectedVariant(selectedProduct.variants[0]);
      }
      setActiveImageIndex(0);
      setShowFullDetails(false);
    }
  }, [selectedProduct]);

  if (!selectedProduct) return null;

  // Build full array of available images for the scroll arrows carousel
  const images = [
    selectedProduct.mainImage,
    selectedProduct.lifestyleImage,
    ...(selectedProduct.galleryImages || []),
  ].filter(Boolean) as string[];

  const nextImage = () => {
    setActiveImageIndex((prev) => (prev + 1) % images.length);
  };

  const prevImage = () => {
    setActiveImageIndex((prev) => (prev - 1 + images.length) % images.length);
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-6 backdrop-blur-md bg-black/50">
        {/* Modal Backdrop overlay click */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={closeProductModal}
          className="absolute inset-0"
        />

        {/* Modal Content Container */}
        <motion.div
          initial={{ scale: 0.96, opacity: 0, y: 10 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.96, opacity: 0, y: 10 }}
          transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
          className="relative z-10 w-full max-w-4xl max-h-[90vh] bg-[var(--bg-primary)] text-[var(--text-primary)] border border-[var(--border-main)]/30 rounded-3xl shadow-2xl flex flex-col md:grid md:grid-cols-2 overflow-hidden"
        >
          {/* Share Button top-right */}
          <button
            onClick={() => setIsShareOpen(true)}
            className="absolute top-3.5 right-14 z-30 w-9 h-9 rounded-full bg-[var(--bg-primary)]/90 backdrop-blur-md flex items-center justify-center text-[var(--text-dominant)] hover:bg-[var(--border-maroon)] hover:text-white transition-all shadow-md"
            title="Share this piece"
          >
            <Share2 className="w-4 h-4" />
          </button>

          {/* Close Button top-right */}
          <button
            onClick={closeProductModal}
            className="absolute top-3.5 right-3.5 z-30 w-9 h-9 rounded-full bg-[var(--bg-primary)]/90 backdrop-blur-md flex items-center justify-center text-[var(--text-dominant)] hover:bg-[var(--border-maroon)] hover:text-white transition-all shadow-md"
            title="Close modal"
          >
            <X className="w-4 h-4" />
          </button>

          {/* Left Pane: Image Gallery with Scroll Navigation Arrows - Strictly 1:1 aspect ratio */}
          <div className="relative aspect-square w-full max-w-full bg-[var(--card-inner)]/50 p-3 sm:p-4 flex flex-col items-center justify-center select-none overflow-hidden mx-auto">
            <div className="relative w-full h-full aspect-square rounded-2xl overflow-hidden shadow-sm border border-[var(--border-main)]/20 group">
              <AnimatePresence mode="wait">
                <motion.img
                  key={activeImageIndex}
                  src={images[activeImageIndex] || selectedProduct.mainImage}
                  alt={`${selectedProduct.title} - Image ${activeImageIndex + 1}`}
                  initial={{ opacity: 0.4, scale: 0.98 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0.4, scale: 1.02 }}
                  transition={{ duration: 0.2 }}
                  className="w-full h-full aspect-square object-cover cursor-zoom-in" onClick={() => setIsZoomed(true)}
                />
              </AnimatePresence>

              {/* Material Badge */}
              <div className="absolute top-3 left-3 bg-[var(--bg-primary)]/85 backdrop-blur-md px-3 py-1 rounded-full text-[10px] font-bold text-[var(--border-maroon)] shadow-xs border border-[var(--border-main)]/20">
                {selectedProduct.material}
              </div>

              {/* Left & Right Scroll Navigation Arrows */}
              {images.length > 1 && (
                <>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      prevImage();
                    }}
                    className="absolute left-2.5 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-[var(--bg-primary)]/80 hover:bg-[var(--border-maroon)] text-[var(--text-dominant)] hover:text-white backdrop-blur-md flex items-center justify-center shadow-md transition-all active:scale-90"
                    title="Previous image"
                  >
                    <ChevronLeft className="w-5 h-5" />
                  </button>

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      nextImage();
                    }}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-[var(--bg-primary)]/80 hover:bg-[var(--border-maroon)] text-[var(--text-dominant)] hover:text-white backdrop-blur-md flex items-center justify-center shadow-md transition-all active:scale-90"
                    title="Next image"
                  >
                    <ChevronRight className="w-5 h-5" />
                  </button>
                </>
              )}

              {/* Thumbnail Dots Indicator */}
              {images.length > 1 && (
                <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-1.5 px-3 py-1 rounded-full bg-black/40 backdrop-blur-md">
                  {images.map((_, idx) => (
                    <button
                      key={idx}
                      onClick={() => setActiveImageIndex(idx)}
                      className={`h-1.5 rounded-full transition-all ${
                        activeImageIndex === idx ? 'w-5 bg-white' : 'w-1.5 bg-white/50 hover:bg-white/80'
                      }`}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>

          

          {/* Right Pane: Streamlined Product Info & Sticky Action Bar */}
          <div className="flex flex-col justify-between max-h-[calc(90vh-16rem)] md:max-h-[90vh] overflow-hidden bg-[var(--bg-primary)]">
            {/* Scrollable Information Section */}
            <div className="p-5 sm:p-6 overflow-y-auto space-y-4 flex-1">
              {/* Product Header: Category, In Stock & Title */}
              <div className="pr-24 sm:pr-28 space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[var(--border-maroon)] font-matilda text-xs font-bold uppercase tracking-wider">
                    {selectedProduct.category}
                  </span>
                  <span className="text-[var(--border-main)]/40 text-xs">•</span>
                  <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold lowercase tracking-tight ${
                    selectedVariant && ((selectedVariant.stock !== undefined ? selectedVariant.stock <= 0 : !selectedVariant.inStock))
                      ? 'bg-rose-500/15 text-rose-700 border border-rose-500/30'
                      : 'bg-emerald-500/15 text-emerald-700 border border-emerald-500/30'
                  }`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${
                      selectedVariant && ((selectedVariant.stock !== undefined ? selectedVariant.stock <= 0 : !selectedVariant.inStock))
                        ? 'bg-rose-500'
                        : 'bg-emerald-500 animate-pulse'
                    }`} />
                    {selectedVariant && ((selectedVariant.stock !== undefined ? selectedVariant.stock <= 0 : !selectedVariant.inStock)) ? 'out of stock' : 'in stock'}
                  </span>
                </div>

                <h2 className="font-display text-lg sm:text-xl md:text-2xl font-bold tracking-tight text-[var(--text-dominant)] lowercase break-words">
                  {selectedProduct.title}
                </h2>

                {/* Prominently displayed price */}
                <div className="flex items-baseline gap-2 pt-1">
                  <span className="text-xl sm:text-2xl font-extrabold text-[var(--border-maroon)]">
                    ₹{selectedProduct.price.toLocaleString('en-IN')}
                  </span>
                  <span className="text-[11px] text-[var(--text-muted)] lowercase">
                    (incl. taxes)
                  </span>
                </div>
              </div>

              {/* Description */}
              <p className="text-xs text-[var(--text-muted)] leading-relaxed border-l-2 border-[var(--border-maroon)]/80 pl-3 lowercase">
                {selectedProduct.description}
              </p>

              {/* Spec Details Accordion / Toggle */}
              <div className="pt-1">
                <button
                  onClick={() => setShowFullDetails(!showFullDetails)}
                  className="flex items-center gap-1.5 text-xs font-bold text-[var(--border-maroon)] hover:underline lowercase"
                >
                  <Info className="w-3.5 h-3.5" />
                  <span>{showFullDetails ? 'hide craft specifications' : 'view craft specifications'}</span>
                </button>

                {showFullDetails && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    className="mt-2.5 p-3 rounded-xl bg-[var(--card-inner)]/60 border border-[var(--border-main)]/20 space-y-1.5 text-xs"
                  >
                    {selectedProduct.details.map((detail, idx) => (
                      <div key={idx} className="flex items-center gap-2 text-[var(--text-primary)] lowercase text-[11px]">
                        <Check className="w-3.5 h-3.5 text-[var(--border-maroon)] shrink-0" />
                        <span>{detail}</span>
                      </div>
                    ))}
                  </motion.div>
                )}
              </div>
            </div>

            {/* ALWAYS VISIBLE / STICKY ACTION BAR AT BOTTOM - Add to Bag & Buy Now Buttons */}
            <div className="p-4 sm:p-5 border-t border-[var(--border-main)]/30 bg-[var(--bg-primary)]/95 backdrop-blur-md shadow-lg space-y-3 shrink-0">
              {/* Variant / Sizing Options */}
              {selectedProduct.variants && selectedProduct.variants.length > 0 && (
                <div className="space-y-1.5">
                  <div className="flex justify-between items-center text-[11px]">
                    <span className="font-bold text-[var(--text-dominant)] lowercase">select option / colour:</span>
                    <span className="text-[var(--text-muted)] lowercase font-medium flex items-center gap-1">
                      {selectedVariant?.name}
                      {selectedVariant && (() => {
                        const stock = typeof selectedVariant.stock === 'number' ? selectedVariant.stock : (selectedVariant.inStock ? 10 : 0);
                        if (stock <= 0) return <span className="text-[10px] text-rose-500 font-semibold">(sold out)</span>;
                        if (stock <= 5) return <span className="text-[10px] text-amber-600 dark:text-amber-400 font-bold animate-pulse">(only {stock} left!)</span>;
                        return <span className="text-[10px] text-gray-500 font-normal">({stock} in stock)</span>;
                      })()}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-1.5 text-xs">
                    {selectedProduct.variants.map((v) => {
                      const vStock = typeof v.stock === 'number' ? v.stock : (v.inStock ? 10 : 0);
                      const vOutOfStock = vStock <= 0;
                      const isSelected = selectedVariant?.id === v.id;
                      return (
                        <motion.button
                          key={v.id}
                          whileHover={!vOutOfStock ? { scale: 1.04 } : undefined}
                          whileTap={!vOutOfStock ? { scale: 0.96 } : undefined}
                          transition={{ type: "spring", stiffness: 400, damping: 25 }}
                          onClick={() => setSelectedVariant(v)}
                          className={`px-3 py-1 rounded-full text-xs lowercase transition-colors duration-200 font-medium flex items-center gap-1 cursor-pointer ${
                            isSelected
                              ? 'bg-[var(--border-maroon)] text-white font-semibold shadow-xs'
                              : vOutOfStock
                                ? 'bg-gray-100/60 dark:bg-neutral-800 text-gray-400 border border-gray-200 dark:border-neutral-700 opacity-60 cursor-not-allowed'
                                : 'bg-[var(--card-bg)] border border-[var(--border-main)] text-[var(--text-primary)] hover:border-[var(--border-maroon)]'
                          }`}
                        >
                          <span className={vOutOfStock ? 'line-through' : ''}>{v.name}</span>
                          {vOutOfStock && <span className="text-[9px] no-underline font-normal text-rose-500">(sold out)</span>}
                        </motion.button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Main Dual Call-to-Action Buttons */}
              {(() => {
                const isSelectedOutOfStock = selectedVariant
                  ? (selectedVariant.stock !== undefined ? selectedVariant.stock <= 0 : !selectedVariant.inStock)
                  : true;

                return (
                  <div className="grid grid-cols-2 gap-2.5 pt-1">
                    <motion.button
                      disabled={isSelectedOutOfStock}
                      whileHover={!isSelectedOutOfStock ? { scale: 1.02 } : undefined}
                      whileTap={!isSelectedOutOfStock ? { scale: 0.98 } : undefined}
                      transition={{ type: "spring", stiffness: 400, damping: 25 }}
                      onClick={() => {
                        if (selectedVariant && !isSelectedOutOfStock) {
                          addToCart(selectedProduct, selectedVariant);
                          closeProductModal();
                          setIsCartOpen(true);
                        }
                      }}
                      className={`w-full py-3 px-4 rounded-full text-xs lowercase font-bold transition-colors flex items-center justify-center gap-2 shadow-xs cursor-pointer ${
                        isSelectedOutOfStock
                          ? 'bg-gray-200 dark:bg-neutral-800 text-gray-400 cursor-not-allowed border border-gray-300 dark:border-neutral-700'
                          : 'bg-[var(--card-bg)] hover:bg-[var(--card-inner)] text-[var(--text-dominant)] border border-[var(--border-main)]/50'
                      }`}
                    >
                      <ShoppingBag className={`w-4 h-4 ${isSelectedOutOfStock ? 'text-gray-400' : 'text-[var(--border-maroon)]'}`} />
                      <span>{isSelectedOutOfStock ? 'out of stock' : 'add to bag'}</span>
                    </motion.button>

                    <motion.button
                      disabled={isSelectedOutOfStock}
                      whileHover={!isSelectedOutOfStock ? { scale: 1.02 } : undefined}
                      whileTap={!isSelectedOutOfStock ? { scale: 0.98 } : undefined}
                      transition={{ type: "spring", stiffness: 400, damping: 25 }}
                      onClick={() => {
                        if (selectedVariant && !isSelectedOutOfStock) {
                          addToCart(selectedProduct, selectedVariant);
                          closeProductModal();
                          setIsCartOpen(false);
                          navigate('/app/checkout');
                        }
                      }}
                      className={`w-full py-3 px-4 rounded-full text-xs lowercase font-bold transition-colors flex items-center justify-center gap-2 shadow-md cursor-pointer ${
                        isSelectedOutOfStock
                          ? 'bg-gray-300 dark:bg-neutral-700 text-gray-500 cursor-not-allowed'
                          : 'bg-[var(--border-maroon)] text-white hover:bg-[var(--text-dominant)]'
                      }`}
                    >
                      <Zap className="w-4 h-4" />
                      <span>{isSelectedOutOfStock ? 'out of stock' : 'buy now'}</span>
                    </motion.button>
                  </div>
                );
              })()}
            </div>
          </div>
        </motion.div>
        {/* Zoom Overlay */}
          <AnimatePresence>
            {isZoomed && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-[60] bg-black/90 backdrop-blur-sm flex items-center justify-center p-4"
                onClick={() => setIsZoomed(false)}
              >
                <button
                  onClick={(e) => { e.stopPropagation(); setIsZoomed(false); }}
                  className="absolute top-6 right-6 w-10 h-10 bg-white/10 hover:bg-white/20 rounded-full flex items-center justify-center text-white transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
                <img
                  src={images[activeImageIndex] || selectedProduct.mainImage}
                  alt="Zoomed"
                  className="max-w-full max-h-full object-contain cursor-zoom-out"
                />
              </motion.div>
            )}
          </AnimatePresence>

          <SocialShareModal
            isOpen={isShareOpen}
            onClose={() => setIsShareOpen(false)}
            title={`matilda. — ${selectedProduct.title}`}
            description={`${selectedProduct.tagline || selectedProduct.description} Crafted in ${selectedProduct.material}. ₹${selectedProduct.price.toLocaleString('en-IN')}`}
            url={typeof window !== 'undefined' ? `${window.location.origin}/?product=${selectedProduct.id}` : ''}
          />
      </div>
    </AnimatePresence>
  );
};

