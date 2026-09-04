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

  return (
    <div className={`relative overflow-hidden bg-[var(--card-inner,#e8e5dc)] ${className}`}>
      {/* Warm Ambient Blur-up Placeholder Skeleton */}
      <div 
        aria-hidden="true"
        className={`absolute inset-0 z-0 bg-neutral-200/70 dark:bg-neutral-800/70 transition-opacity duration-700 pointer-events-none ${
          isMainLoaded ? 'opacity-0' : 'opacity-100'
        }`}
      >
        <div className="w-full h-full animate-pulse bg-gradient-to-r from-transparent via-white/20 dark:via-white/5 to-transparent" />
      </div>

      {/* Main Product Image */}
      <img
        src={src}
        alt={alt}
        loading={priority ? 'eager' : 'lazy'}
        decoding="async"
        fetchPriority={priority ? 'high' : 'auto'}
        onLoad={() => setIsMainLoaded(true)}
        referrerPolicy="no-referrer"
        className={`w-full h-full object-cover transition-all duration-700 ease-out will-change-[filter,opacity,transform] ${
          isMainLoaded 
            ? 'filter-none opacity-100 scale-100' 
            : 'filter blur-md opacity-40 scale-105'
        } ${lifestyleSrc && isHovered ? 'opacity-0 scale-98' : 'opacity-100'}`}
      />

      {/* Optional Lifestyle Secondary Image with matching Blur-Up on Hover */}
      {lifestyleSrc && (
        <img
          src={lifestyleSrc}
          alt={`${alt} on model`}
          loading="lazy"
          decoding="async"
          onLoad={() => setIsLifestyleLoaded(true)}
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
