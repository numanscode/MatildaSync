import React, { useState, useMemo, memo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useCollection } from '../context/CollectionContext';
import { Product } from '../types';
import { ShoppingBag, ArrowLeft, SlidersHorizontal } from 'lucide-react';
import { ProductImage } from './ProductImage';

export const ProductGrid: React.FC = () => {
  const { collection, openProductModal, products, categories, openBrand } = useCollection();
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [inStockOnly, setInStockOnly] = useState<boolean>(false);
  
  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      const pCol = (p.collection || 'women').toLowerCase();
      const targetCol = (collection || 'women').toLowerCase();
      const matchesCollection = pCol === targetCol || pCol === 'both' || pCol === 'all' || targetCol === 'all';

      const pCat = (p.category || '').toLowerCase().trim();
      const actCat = (activeCategory || 'all').toLowerCase().trim();
      const selectedCatObj = categories.find(c => c.slug?.toLowerCase() === actCat || c.id?.toLowerCase() === actCat || c.name?.toLowerCase() === actCat);
      
      const matchesCategory = actCat === 'all' || pCat === actCat || (
        selectedCatObj && (
          pCat === selectedCatObj.slug?.toLowerCase() || 
          pCat === selectedCatObj.name?.toLowerCase() || 
          pCat === selectedCatObj.id?.toLowerCase()
        )
      );

      if (inStockOnly) {
        const totalStock = (p.variants && p.variants.length > 0)
          ? p.variants.reduce((sum, v) => sum + (typeof v.stock === 'number' ? v.stock : (v.inStock ? 5 : 0)), 0)
          : (typeof p.stock_count === 'number' ? p.stock_count : 10);
        if (totalStock <= 0) return false;
      }

      return matchesCollection && matchesCategory;
    });
  }, [products, collection, activeCategory, categories, inStockOnly]);

  // Dynamic filter tabs based on categories list + 'all'
  const filterTabs = useMemo(() => [
    { id: 'all', name: 'All Items', slug: 'all' },
    ...categories.map((c) => ({ id: c.id, name: c.name, slug: c.slug })),
  ], [categories]);

  return (
    <div className="relative w-full min-h-screen">
      {/* Refined Collection Header */}
      <div className="w-full bg-[var(--card-bg)]/80 backdrop-blur-md border-b border-[var(--border-main)]/10 pt-24 sm:pt-32 pb-8 sm:pb-12 px-4 sm:px-8 relative overflow-hidden">
        {/* Subtle Background Accent */}
        <div className="absolute inset-0 bg-gradient-to-b from-[var(--border-maroon)]/5 to-transparent pointer-events-none"></div>
        
        <div className="max-w-7xl mx-auto relative z-10">
          <motion.button
            whileHover={{ x: -3 }}
            whileTap={{ scale: 0.96 }}
            transition={{ type: "spring", stiffness: 400, damping: 25 }}
            onClick={openBrand}
            className="group flex items-center gap-2 text-[var(--text-muted)] hover:text-[var(--border-maroon)] transition-colors mb-6 text-xs uppercase tracking-widest font-semibold cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
            <span>back</span>
          </motion.button>
          
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
            <div>
              <h1 className="text-4xl sm:text-6xl font-display font-bold lowercase tracking-tighter text-[var(--text-dominant)]">
                {collection === 'women' ? "women's edit" : "men's edit"}
              </h1>
              <p className="mt-3 text-[15px] font-normal not-italic text-[var(--text-muted)] max-w-md">
                {collection === 'women' 
                  ? 'something for the girlies ;)' 
                  : 'something for the guys ;)'}
              </p>
            </div>
            
            <div className="flex items-center gap-2 text-xs text-[var(--text-muted)] font-semibold lowercase">
              <span>{filteredProducts.length} items</span>
            </div>
          </div>
        </div>
      </div>

      {/* Sticky Filter Bar */}
      <div className="sticky top-0 z-40 w-full bg-[var(--bg-primary)]/60 backdrop-blur-md border-b border-[var(--border-main)]/10 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-8 py-3 sm:py-4 flex items-center justify-between gap-4">
          {/* Mobile Filter Controls */}
          <div className="flex sm:hidden items-center justify-between w-full gap-2">
            <div className="flex-1 max-w-[170px] relative">
              <select
                value={activeCategory}
                onChange={(e) => setActiveCategory(e.target.value)}
                className="w-full bg-[var(--card-bg)]/80 backdrop-blur-md border border-[var(--border-main)]/20 rounded-md px-3 py-2 text-xs font-semibold lowercase text-[var(--text-dominant)] focus:outline-none appearance-none cursor-pointer"
              >
                {filterTabs.map((cat) => (
                  <option key={cat.slug} value={cat.slug}>{cat.name.toLowerCase()}</option>
                ))}
              </select>
              <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none opacity-50">
                <svg width="10" height="6" viewBox="0 0 10 6" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M1 1L5 5L9 1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
            </div>

            {/* Mobile In-Stock Toggle Button */}
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.95 }}
              transition={{ type: "spring", stiffness: 400, damping: 25 }}
              onClick={() => setInStockOnly(prev => !prev)}
              aria-pressed={inStockOnly}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-md text-xs font-semibold lowercase transition-all cursor-pointer border shrink-0 ${
                inStockOnly
                  ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                  : 'bg-[var(--card-bg)]/80 text-[var(--text-dominant)] border-[var(--border-main)]/20 hover:border-emerald-500/40'
              }`}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${inStockOnly ? 'bg-white' : 'bg-emerald-500 animate-pulse'}`} />
              <span>in stock</span>
            </motion.button>
          </div>

          {/* Desktop Filter Tabs */}
          <div className="hidden sm:flex items-center gap-6 overflow-x-auto no-scrollbar">
            {filterTabs.map((cat) => (
              <motion.button
                key={cat.slug}
                whileHover={{ y: -1 }}
                whileTap={{ scale: 0.97 }}
                transition={{ type: "spring", stiffness: 400, damping: 25 }}
                onClick={() => setActiveCategory(cat.slug)}
                className={`relative pb-1 text-sm transition-all duration-300 whitespace-nowrap cursor-pointer ${
                  activeCategory === cat.slug
                    ? 'text-[var(--border-maroon)] font-bold'
                    : 'text-[var(--text-muted)] hover:text-[var(--text-primary)] font-medium'
                }`}
              >
                <span className="lowercase">{cat.name.toLowerCase()}</span>
                {activeCategory === cat.slug && (
                  <motion.div 
                    layoutId="activeFilter"
                    className="absolute bottom-0 left-0 right-0 h-0.5 bg-[var(--border-maroon)]"
                  />
                )}
              </motion.button>
            ))}
          </div>

          {/* Desktop In-Stock Toggle Button */}
          <div className="hidden sm:flex items-center gap-3">
            <motion.button
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.96 }}
              transition={{ type: "spring", stiffness: 400, damping: 25 }}
              onClick={() => setInStockOnly(prev => !prev)}
              aria-pressed={inStockOnly}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-semibold lowercase transition-all cursor-pointer border ${
                inStockOnly
                  ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                  : 'bg-[var(--card-bg)]/80 text-[var(--text-dominant)] border-[var(--border-main)]/25 hover:border-emerald-500/50 hover:bg-[var(--card-bg)]'
              }`}
            >
              <span className={`w-2 h-2 rounded-full ${inStockOnly ? 'bg-white' : 'bg-emerald-500 animate-pulse'}`} />
              <span>in stock only</span>
            </motion.button>
          </div>
        </div>
      </div>

      <section id="shop" className="relative z-10 w-full max-w-7xl mx-auto px-4 sm:px-8 py-8 sm:py-16">
        <AnimatePresence mode="wait">
          <motion.div
            key={`${collection}-${activeCategory}`}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6 lg:gap-8"
          >
            {filteredProducts.map((product, idx) => (
              <ProductCard
                key={product.id}
                product={product}
                index={idx}
                onOpenModal={() => openProductModal(product)}
              />
            ))}
          </motion.div>
        </AnimatePresence>

        {filteredProducts.length === 0 && (
          <div className="flex flex-col items-center justify-center py-32 px-4 text-center">
            <div className="w-16 h-16 rounded-full bg-[var(--card-bg)] border border-[var(--border-main)]/10 flex items-center justify-center mb-4 text-[var(--border-maroon)]/50">
              <ShoppingBag className="w-6 h-6" />
            </div>
            <p className="text-lg font-display font-bold lowercase text-[var(--text-dominant)] mb-2">no pieces found</p>
            <p className="text-sm text-[var(--text-muted)] max-w-md mx-auto mb-6">
              Our curated collection in this category is currently empty. Explore our other selections.
            </p>
            <motion.button
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              transition={{ type: "spring", stiffness: 400, damping: 25 }}
              onClick={() => setActiveCategory('all')}
              className="bg-[var(--border-maroon)] text-white px-8 py-3 rounded-full lowercase text-sm font-semibold hover:bg-[var(--text-dominant)] transition-colors shadow-sm cursor-pointer"
            >
              explore all
            </motion.button>
          </div>
        )}
      </section>
    </div>
  );
};

interface ProductCardProps {
  product: Product;
  index: number;
  onOpenModal: () => void;
}

const ProductCard: React.FC<ProductCardProps> = memo(({
  product,
  index,
  onOpenModal,
}) => {
  const { addToCart, setIsCartOpen } = useCollection();
  const [isHovered, setIsHovered] = useState(false);

  // Compute total available inventory across variants or base stock
  const totalStock = useMemo(() => {
    if (product.variants && product.variants.length > 0) {
      return product.variants.reduce((sum, v) => sum + (typeof v.stock === 'number' ? v.stock : (v.inStock ? 5 : 0)), 0);
    }
    return typeof product.stock_count === 'number' ? product.stock_count : 10;
  }, [product]);

  const isOutOfStock = totalStock <= 0;
  const isLowStock = !isOutOfStock && totalStock <= 5;

  const handleQuickAdd = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isOutOfStock) {
      onOpenModal();
      return;
    }
    const inStockVariant = product.variants?.find(v => (typeof v.stock === 'number' ? v.stock > 0 : v.inStock)) || product.variants?.[0];
    if (inStockVariant) {
      addToCart(product, inStockVariant);
      setIsCartOpen(true);
    } else {
      onOpenModal();
    }
  };

  return (
    <motion.div
      onClick={onOpenModal}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      whileHover={{ y: -4 }}
      transition={{ type: "spring", stiffness: 350, damping: 25 }}
      className="group cursor-pointer flex flex-col h-full p-2.5 sm:p-4 rounded-[20px] sm:rounded-3xl bg-[var(--bg-primary)]/50 backdrop-blur-xs border border-[var(--border-main)]/15 hover:border-[var(--border-maroon)]/40 hover:bg-[var(--bg-primary)]/80 transition-colors duration-300 transform-gpu shadow-xs hover:shadow-md"
      style={{ contentVisibility: 'auto', containIntrinsicSize: '320px' }}
    >
      {/* Image Container with precise aspect ratio and blur-up placeholder */}
      <div
        className="relative aspect-[3/4] w-full overflow-hidden rounded-[14px] sm:rounded-2xl bg-[var(--card-inner)] mb-3 sm:mb-4 shadow-xs group-hover:shadow-md transition-shadow duration-300 transform-gpu"
      >
        <ProductImage
          src={product.mainImage}
          alt={product.title}
          lifestyleSrc={product.lifestyleImage}
          isHovered={isHovered}
          priority={index < 4}
          className="w-full h-full"
        />

        {/* Badges: Out of stock vs. Only X Left urgency vs. Featured */}
        {isOutOfStock ? (
          <div className="absolute top-2.5 right-2.5 sm:top-3 sm:right-3 bg-red-950/85 backdrop-blur-sm text-white px-2 sm:px-2.5 py-1 text-[9px] sm:text-[10px] font-bold uppercase tracking-wider rounded-md border border-red-500/25 z-10 pointer-events-none shadow-xs">
            out of stock
          </div>
        ) : isLowStock ? (
          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ type: "spring", stiffness: 500, damping: 30 }}
            className="absolute top-2.5 right-2.5 sm:top-3 sm:right-3 bg-neutral-900/90 dark:bg-black/90 backdrop-blur-md text-amber-300 px-2 sm:px-2.5 py-1 text-[9px] sm:text-[10px] font-semibold lowercase tracking-wide rounded-full border border-amber-400/35 shadow-xs z-10 flex items-center gap-1.5 pointer-events-none"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
            <span>only {totalStock} left</span>
          </motion.div>
        ) : product.isFeatured ? (
          <div className="absolute top-2.5 left-2.5 sm:top-3 sm:left-3 bg-white/90 dark:bg-neutral-900/90 backdrop-blur-sm px-2 sm:px-2.5 py-1 text-[9px] sm:text-[10px] font-bold uppercase tracking-widest text-black dark:text-white rounded-md border border-black/5 dark:border-white/10 z-10 pointer-events-none shadow-xs">
            featured
          </div>
        ) : null}

        {/* Quick Add Action Overlay with Spring tactile feedback */}
        <div
          className={`absolute bottom-0 left-0 right-0 p-3 sm:p-4 transition-all duration-300 ease-out transform z-10 ${
            isHovered ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4 pointer-events-none'
          }`}
        >
          <motion.button
            whileHover={!isOutOfStock ? { scale: 1.02 } : undefined}
            whileTap={!isOutOfStock ? { scale: 0.97 } : undefined}
            transition={{ type: "spring", stiffness: 400, damping: 25 }}
            onClick={handleQuickAdd}
            disabled={isOutOfStock}
            className={`w-full py-2.5 sm:py-3 px-4 rounded-xl text-xs font-bold uppercase tracking-widest transition-colors flex items-center justify-center gap-2 shadow-lg cursor-pointer ${
              isOutOfStock
                ? 'bg-neutral-800/90 text-neutral-400 cursor-not-allowed border border-neutral-700'
                : 'bg-white/95 dark:bg-neutral-900/95 backdrop-blur-md text-black dark:text-white hover:bg-[var(--border-maroon)] hover:text-white dark:hover:bg-[var(--border-maroon)]'
            }`}
          >
            <span>{isOutOfStock ? 'Out of Stock' : 'Quick Add'}</span>
          </motion.button>
        </div>
      </div>

      {/* Meta Information */}
      <div className="flex flex-col flex-1 px-1">
        <div className="flex justify-between items-start gap-3 mb-1">
          <h3 className="text-[var(--text-dominant)] font-display font-medium text-xs sm:text-sm md:text-base leading-snug break-words">
            {product.title}
          </h3>
          <span className="text-[var(--text-dominant)] font-medium text-sm sm:text-base shrink-0">
            ₹{product.price.toLocaleString('en-IN')}
          </span>
        </div>
        <div className="flex items-center justify-between mt-auto pt-1">
          <p className="text-xs text-[var(--text-muted)] uppercase tracking-widest font-micro">
            {product.category}
          </p>
          <span className={`inline-flex items-center gap-1.5 text-[11px] font-medium lowercase ${
            isOutOfStock 
              ? 'text-rose-500 font-semibold' 
              : isLowStock 
                ? 'text-amber-500 font-semibold' 
                : 'text-emerald-600 dark:text-emerald-400'
          }`}>
            <span className={`w-1.5 h-1.5 rounded-full ${
              isOutOfStock 
                ? 'bg-rose-500' 
                : isLowStock 
                  ? 'bg-amber-400 animate-pulse' 
                  : 'bg-emerald-500'
            }`} />
            {isOutOfStock ? 'out of stock' : isLowStock ? `${totalStock} left` : 'in stock'}
          </span>
        </div>
      </div>
    </motion.div>
  );
});


