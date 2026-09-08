import React, { useState } from 'react';

interface ProductImageProps {
  src: string;
  alt: string;
  className?: string;
  priority?: boolean;
  lifestyleSrc?: string;
  isHovered?: boolean;
}

/**
 * High-performance, lazy-loaded product image with smooth blur-up placeholder effect
 * Optimizes Largest Contentful Paint (LCP) by honoring priority and eager loading for above-the-fold assets.
 */
export const ProductImage: React.FC<ProductImageProps> = ({
  src,
  alt,
  className = '',
  priority = false,
  lifestyleSrc,
  isHovered = false,
}) => {
  const [isMainLoaded, setIsMainLoaded] = useState(false);
  const [isLifestyleLoaded, setIsLifestyleLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);

  return (
    <div className={`relative overflow-hidden bg-[var(--card-inner,#e8e5dc)] ${className}`}>
      {/* Warm Ambient Blur-up Placeholder Skeleton */}
      <div 
        aria-hidden="true"
        className={`absolute inset-0 z-0 bg-neutral-200/70 dark:bg-neutral-800/70 transition-opacity duration-700 pointer-events-none ${
          isMainLoaded || hasError ? 'opacity-0' : 'opacity-100'
        }`}
      >
        <div className="w-full h-full animate-pulse bg-gradient-to-r from-transparent via-white/20 dark:via-white/5 to-transparent" />
      </div>

      {/* Main Product Image or Graceful Fallback */}
      {!hasError && src ? (
        <img
          src={src}
          alt={alt}
          loading={priority ? 'eager' : 'lazy'}
          decoding="async"
          fetchPriority={priority ? 'high' : 'auto'}
          onLoad={() => setIsMainLoaded(true)}
          onError={() => setHasError(true)}
          referrerPolicy="no-referrer"
          className={`w-full h-full object-cover transition-all duration-700 ease-out will-change-[filter,opacity,transform] ${
            isMainLoaded 
              ? 'filter-none opacity-100 scale-100' 
              : 'filter blur-md opacity-40 scale-105'
          } ${lifestyleSrc && isHovered ? 'opacity-0 scale-98' : 'opacity-100'}`}
        />
      ) : (
        <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-[var(--card-bg)] to-[var(--bg-primary)] p-4 text-center">
          <div className="w-12 h-12 rounded-full border border-[var(--border-main)]/20 flex items-center justify-center text-[var(--border-maroon)] mb-2">
            <svg className="w-6 h-6 opacity-60" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
            </svg>
          </div>
          <span className="text-[11px] font-display uppercase tracking-widest text-[var(--text-muted)] line-clamp-1">
            {alt || 'Studio Piece'}
          </span>
        </div>
      )}

      {/* Optional Lifestyle Secondary Image with matching Blur-Up on Hover */}
      {!hasError && lifestyleSrc && (
        <img
          src={lifestyleSrc}
          alt={`${alt} on model`}
          loading="lazy"
          decoding="async"
          onLoad={() => setIsLifestyleLoaded(true)}
          onError={() => {}}
          referrerPolicy="no-referrer"
          className={`absolute inset-0 w-full h-full object-cover transition-all duration-700 ease-out pointer-events-none will-change-[filter,opacity,transform] ${
            isHovered ? 'opacity-100' : 'opacity-0'
          } ${
            isLifestyleLoaded 
              ? 'filter-none scale-100' 
              : 'filter blur-md opacity-30 scale-105'
          }`}
        />
      )}
    </div>
  );
};
