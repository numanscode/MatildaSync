import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { CollectionType, Product, ProductVariant, CartItem, CategoryOption } from '../types';
import { 
  fetchPublicProducts, 
  fetchPublicCategories, 
  saveAdminProduct, 
  deleteAdminProduct, 
  saveAdminCategory, 
  deleteAdminCategory, 
  resetAdminCategories,
  getLocalDeletedProductIds
} from '../lib/adminApi';
import { subscribeToSync } from '../lib/syncChannel';

interface CollectionContextType {
  collection: CollectionType;
  setCollection: (c: CollectionType) => void;
  toggleCollection: () => void;
  isLoading: boolean;
  
  // Page View Mode (Brand Home vs Dedicated Shop Page)
  viewMode: 'brand' | 'shop';
  setViewMode: (mode: 'brand' | 'shop') => void;
  openShop: (col?: CollectionType) => void;
  openBrand: () => void;
  
  // Catalogue Management
  products: Product[];
  addProduct: (newProduct: Omit<Product, 'id'> & { id?: string }) => void;
  updateProduct: (updatedProduct: Product) => void;
  removeProduct: (productId: string) => void;
  resetProductsToDefault: () => void;
  isManagementOpen: boolean;
  setIsManagementOpen: (open: boolean) => void;
  toggleManagement: () => void;

  // Category / Type Management
  categories: CategoryOption[];
  addCategory: (cat: CategoryOption) => void;
  updateCategory: (cat: CategoryOption) => void;
  removeCategory: (catId: string) => void;
  resetCategoriesToDefault: () => void;

  // Cart
  cart: CartItem[];
  addToCart: (product: Product, variant: ProductVariant) => void;
  removeFromCart: (productId: string, variantId: string) => void;
  updateQuantity: (productId: string, variantId: string, delta: number) => void;
  clearCart: () => void;
  cartTotal: number;
  cartCount: number;
  isCartOpen: boolean;
  setIsCartOpen: (open: boolean) => void;

  // Modals
  selectedProduct: Product | null;
  openProductModal: (product: Product) => void;
  closeProductModal: () => void;
  
  isSayHelloOpen: boolean;
  setIsSayHelloOpen: (open: boolean) => void;

  // Dynamic Search
  isSearchOpen: boolean;
  setIsSearchOpen: (open: boolean) => void;

  // Checkout Handoff
  isCheckoutHandoff: boolean;
  triggerCheckoutHandoff: () => void;
}

const DEFAULT_CATEGORIES: CategoryOption[] = [
  { id: 'cat-studs', name: 'Studs', slug: 'studs', description: 'Handcrafted golden and silver studs.' },
  { id: 'cat-hoops', name: 'Hoops', slug: 'hoops', description: 'Chic classic and statement hoops.' },
  { id: 'cat-waist-chains', name: 'Waist Chains', slug: 'waist-chains', description: 'Adjustable statement waist and belly chains.' },
  { id: 'cat-pendants', name: 'Pendants', slug: 'pendants', description: 'Detachable gothic, celestial, and keepsake pendants.' },
  { id: 'cat-bracelets', name: 'Bracelets', slug: 'bracelets', description: 'Sterling silver and steel chainlink & floral bracelets.' },
  { id: 'cat-nose-rings', name: 'Nose Rings', slug: 'nose-rings', description: 'No-piercing clip-on and traditional Marathi nose rings.' },
  { id: 'cat-bangles', name: 'Bangles', slug: 'bangles', description: 'Hand-painted broad and slim glossy enamel bangles.' },
  { id: 'cat-cuffs', name: 'Cuffs', slug: 'cuffs', description: 'Sculptural spiral, arm, and snail-inspired cuffs.' },
  { id: 'cat-anklets', name: 'Anklets', slug: 'anklets', description: 'Delicate shimmering silver anklets.' },
  { id: 'cat-jewelry', name: 'Jewelry', slug: 'jewelry', description: 'Solid 925 sterling silver jewelry forged in the valley.' },
  { id: 'cat-ceramics', name: 'Ceramics', slug: 'ceramics', description: 'Handcrafted ceramic vessels and studio wares.' },
  { id: 'cat-apparel', name: 'Apparel', slug: 'apparel', description: 'Curated studio garments and everyday textiles.' },
  { id: 'cat-editorial', name: 'Editorial', slug: 'editorial', description: 'Artisanal publications, zines, and valley prints.' }
];

const CollectionContext = createContext<CollectionContextType | undefined>(undefined);

export const CollectionProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [collection, setCollectionState] = useState<CollectionType>('women');
  const [viewMode, setViewMode] = useState<'brand' | 'shop'>('brand');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [isCartOpen, setIsCartOpen] = useState<boolean>(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [isSayHelloOpen, setIsSayHelloOpen] = useState<boolean>(false);
  const [isSearchOpen, setIsSearchOpen] = useState<boolean>(false);
  const [isCheckoutHandoff, setIsCheckoutHandoff] = useState<boolean>(false);

  const openShop = (col?: CollectionType) => {
    if (col) {
      setCollectionState(col);
    }
    setViewMode('shop');
    window.scrollTo({ top: 0, behavior: 'smooth' });
    const url = new URL(window.location.href);
    url.searchParams.set('view', 'shop');
    if (col) url.searchParams.set('collection', col);
    window.history.pushState({}, '', url.toString());
  };

  const openBrand = () => {
    setCollectionState('women');
    setViewMode('brand');
    window.scrollTo({ top: 0, behavior: 'smooth' });
    const url = new URL(window.location.href);
    url.searchParams.set('view', 'brand');
    url.searchParams.set('collection', 'women');
    window.history.pushState({}, '', url.toString());
  };
  
  // DAPMAT Catalogue & Categories Management State
  const [products, setProducts] = useState<Product[]>(() => {
    try {
      const saved = localStorage.getItem('matilda_products');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch {}
    return [];
  });
  const [categories, setCategories] = useState<CategoryOption[]>(() => DEFAULT_CATEGORIES);
  const [isManagementOpen, setIsManagementOpen] = useState<boolean>(false);

  // Sync load products and categories from backend API / Firestore
  const refreshCatalogue = useCallback(async () => {
    const deletedSet = getLocalDeletedProductIds();

    // 1. Fetch Products from backend
    try {
      const fetchedProds = await fetchPublicProducts();
      if (Array.isArray(fetchedProds)) {
        const activeProds = fetchedProds.filter((p: any) => !deletedSet.has(p.id) && !deletedSet.has(p.slug));
        const normalized = activeProds.map((p: any) => {
          const variants = Array.isArray(p.variants) && p.variants.length > 0 ? p.variants.map((v: any, idx: number) => {
            const stock = typeof v.stock === 'number'
              ? v.stock
              : (v.stock !== undefined ? Number(v.stock) || 0 : (v.inStock === false ? 0 : 10));
            return {
              id: v.id || `v${idx + 1}`,
              name: v.name || v.size || 'One Size',
              stock,
              inStock: typeof v.inStock !== 'undefined' ? (stock > 0 && v.inStock) : stock > 0
            };
          }) : [{ id: 'v1', name: 'One Size', inStock: true, stock: 10 }];

          const totalVariantStock = variants.reduce((sum: number, v: any) => sum + (v.stock || 0), 0);
          const stock_count = (p.stock_count !== undefined && p.stock_count !== null && Number(p.stock_count) > 0)
            ? Number(p.stock_count)
            : totalVariantStock;

          return {
            id: p.id,
            slug: p.slug || p.id,
            title: p.title || p.name,
            collection: p.collection || (p.category === 'men' ? 'men' : 'women'),
            category: p.category || 'general',
            price: Number(p.price || 0),
            stock_count,
            description: p.description || '',
            details: Array.isArray(p.details) ? p.details : [],
            mainImage: p.mainImage || p.image || p.image_url || '',
            lifestyleImage: p.lifestyleImage || p.hover_image || p.hover_image_url || p.mainImage || '',
            galleryImages: Array.isArray(p.galleryImages) ? p.galleryImages : [],
            imageFit: p.imageFit || 'cover',
            isFeatured: !!p.isFeatured,
            hasVictorianFrame: !!p.hasVictorianFrame,
            variants,
            material: p.material || ''
          };
        });
        setProducts(normalized);
        try {
          localStorage.setItem('matilda_products', JSON.stringify(normalized));
        } catch {}
      }
    } catch (e) {
      console.warn("Failed to fetch public products:", e);
    }

    // 2. Fetch Categories from backend
    try {
      const fetchedCats = await fetchPublicCategories();
      if (Array.isArray(fetchedCats) && fetchedCats.length > 0) {
        setCategories(fetchedCats);
      }
    } catch (e) {
      console.warn("Failed to fetch public categories:", e);
    }
  }, []);

  useEffect(() => {
    refreshCatalogue();
    
    const handleCatalogueUpdate = () => {
      refreshCatalogue();
    };
    window.addEventListener('matilda-catalogue-updated', handleCatalogueUpdate);

    const unsubscribe = subscribeToSync((msg) => {
      if (msg.type === 'CATALOGUE_UPDATED' || msg.type === 'CATEGORIES_UPDATED') {
        refreshCatalogue();
      }
    });

    return () => {
      window.removeEventListener('matilda-catalogue-updated', handleCatalogueUpdate);
      unsubscribe();
    };
  }, [refreshCatalogue]);

  // Sync products and categories to local storage (Fallback)
  useEffect(() => {
    try {
      localStorage.setItem('matilda_products', JSON.stringify(products));
    } catch (err) {}
  }, [products]);

  useEffect(() => {
    try {
      localStorage.setItem('matilda_categories', JSON.stringify(categories));
    } catch (err) {}
  }, [categories]);

  const addCategory = async (newCat: CategoryOption) => {
    const slug = (newCat.slug || newCat.name).toLowerCase().trim().replace(/\s+/g, '-');
    const formatted = { ...newCat, slug };
    setCategories((prev) => {
      if (prev.some((c) => c.slug === formatted.slug || c.id === formatted.id)) return prev;
      return [...prev, formatted];
    });
    await saveAdminCategory(formatted, false);
  };

  const updateCategory = async (updatedCat: CategoryOption) => {
    const oldSlug = (updatedCat.oldSlug || updatedCat.slug || '').toLowerCase().trim();
    const newSlug = (updatedCat.slug || updatedCat.name).toLowerCase().trim().replace(/\s+/g, '-');
    const formatted = { ...updatedCat, slug: newSlug };

    setCategories((prev) => prev.map((c) => (c.id === updatedCat.id || c.id === formatted.id || c.slug === oldSlug || c.slug === newSlug ? formatted : c)));

    if (oldSlug && oldSlug !== newSlug) {
      setProducts((prev) => prev.map((p) => {
        const pCat = (p.category || '').toLowerCase().trim();
        if (pCat === oldSlug || pCat === formatted.id.toLowerCase()) {
          return { ...p, category: newSlug };
        }
        return p;
      }));
    }

    await saveAdminCategory(formatted, true);
  };

  const removeCategory = async (catId: string, catSlug?: string) => {
    const targetCat = categories.find((c) => c.id === catId || c.slug === catId || (catSlug && c.slug === catSlug));
    const targetSlug = catSlug || targetCat?.slug || catId.replace(/^cat-/, '').toLowerCase().trim();
    const targetId = targetCat?.id || catId;

    setCategories((prev) => prev.filter((c) => c.id !== targetId && c.id !== catId && c.slug !== targetSlug && c.slug !== targetId.toLowerCase()));
    setProducts((prev) => prev.map((p) => {
      const pCat = (p.category || '').toLowerCase().trim();
      if (pCat === targetSlug || pCat === targetId.toLowerCase() || pCat === `cat-${targetSlug}`) {
        return { ...p, category: 'general' };
      }
      return p;
    }));

    await deleteAdminCategory(targetId, targetSlug);
    window.dispatchEvent(new Event('matilda-catalogue-updated'));
  };

  const resetCategoriesToDefault = async () => {
    setCategories([]);
    await resetAdminCategories();
  };

  // Global Keypress listener for secret sequence "dapmat"
  useEffect(() => {
    let keySequence = '';
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
        return;
      }
      if (e.key.length > 1) return;

      keySequence = (keySequence + e.key.toLowerCase()).slice(-10);
      if (keySequence.endsWith('dapmat')) {
        setIsManagementOpen((prev) => !prev);
        keySequence = '';
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const addProduct = async (newProductData: Omit<Product, 'id'> & { id?: string }) => {
    const id = newProductData.id || `matilda-${Date.now().toString(36)}`;
    const product: Product = { ...newProductData, id };
    setProducts((prev) => [product, ...prev]);

    await saveAdminProduct(product, false);
  };

  const updateProduct = async (updatedProduct: Product) => {
    setProducts((prev) => prev.map((p) => (p.id === updatedProduct.id ? updatedProduct : p)));
    if (selectedProduct?.id === updatedProduct.id) {
      setSelectedProduct(updatedProduct);
    }

    await saveAdminProduct(updatedProduct, true);
  };

  const removeProduct = async (productId: string) => {
    const matched = products.find(p => p.id === productId);
    setProducts((prev) => prev.filter((p) => p.id !== productId && (!matched?.slug || p.slug !== matched.slug)));
    if (selectedProduct?.id === productId) {
      setSelectedProduct(null);
    }

    await deleteAdminProduct(productId, matched?.slug);
    window.dispatchEvent(new Event('matilda-catalogue-updated'));
  };

  const resetProductsToDefault = () => {
    try {
      localStorage.removeItem('matilda_products');
    } catch {
      // ignore
    }
    refreshCatalogue();
  };

  const toggleManagement = () => setIsManagementOpen((prev) => !prev);

  // Set html data-collection attribute on mount, viewMode change and collection change
  useEffect(() => {
    const activeTheme = (viewMode === 'shop' && collection === 'men') ? 'men' : 'women';
    document.documentElement.setAttribute('data-collection', activeTheme);
  }, [collection, viewMode]);

  // Preloader timeout and font load detection
  useEffect(() => {
    const timer = setTimeout(() => {
      setIsLoading(false);
    }, 900);
    return () => clearTimeout(timer);
  }, []);

  // Listen to URL search params for product shallow routing & view mode
  useEffect(() => {
    const handleUrlSync = () => {
      const params = new URLSearchParams(window.location.search);
      const productSlug = params.get('product');
      const colParam = params.get('collection');
      const viewParam = params.get('view');

      if (viewParam === 'shop' || productSlug) {
        setViewMode('shop');
      } else if (viewParam === 'brand') {
        setViewMode('brand');
        if (!colParam) {
          setCollectionState('women');
        }
      }

      if (colParam === 'women' || colParam === 'men') {
        setCollectionState(colParam);
      }

      if (productSlug) {
        const found = products.find((p) => p.slug === productSlug || p.id === productSlug);
        if (found) {
          setSelectedProduct(found);
        }
      } else {
        setSelectedProduct(null);
      }
    };

    handleUrlSync();
    window.addEventListener('popstate', handleUrlSync);
    return () => window.removeEventListener('popstate', handleUrlSync);
  }, [products]);

  const setCollection = (newCollection: CollectionType) => {
    setCollectionState(newCollection);
    const url = new URL(window.location.href);
    url.searchParams.set('collection', newCollection);
    window.history.pushState({}, '', url.toString());
  };

  const toggleCollection = () => {
    const next = collection === 'women' ? 'men' : 'women';
    setCollection(next);
  };

  // Shallow routing modal triggers
  const openProductModal = (product: Product) => {
    setSelectedProduct(product);
    const url = new URL(window.location.href);
    url.searchParams.set('product', product.slug);
    window.history.pushState({}, '', url.toString());
  };

  const closeProductModal = () => {
    setSelectedProduct(null);
    const url = new URL(window.location.href);
    url.searchParams.delete('product');
    window.history.pushState({}, '', url.toString());
  };

  // Cart operations
  const addToCart = (product: Product, variant: ProductVariant) => {
    if (!product || !variant) return;
    setCart((prevCart) => {
      const existingIndex = prevCart.findIndex(
        (item) => item.product.id === product.id && item.selectedVariant.id === variant.id
      );
      if (existingIndex > -1) {
        const updated = [...prevCart];
        const newQty = updated[existingIndex].quantity + 1;
        updated[existingIndex].quantity = Math.min(2000, newQty);
        return updated;
      }
      return [...prevCart, { product, selectedVariant: variant, quantity: 1 }];
    });
    setIsCartOpen(true);
  };

  const removeFromCart = (productId: string, variantId: string) => {
    setCart((prev) => prev.filter((item) => !(item.product.id === productId && item.selectedVariant.id === variantId)));
  };

  const updateQuantity = (productId: string, variantId: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((item) => {
          if (item.product.id === productId && item.selectedVariant.id === variantId) {
            const newQty = item.quantity + delta;
            return newQty > 0 ? { ...item, quantity: Math.min(2000, newQty) } : null;
          }
          return item;
        })
        .filter(Boolean) as CartItem[]
    );
  };

  const clearCart = () => {
    setCart([]);
  };

  const cartTotal = cart.reduce((sum, item) => sum + item.product.price * item.quantity, 0);
  const cartCount = cart.reduce((sum, item) => sum + item.quantity, 0);

  const triggerCheckoutHandoff = () => {
    setIsCheckoutHandoff(true);
    setTimeout(() => {
      // Complete handoff view
    }, 400);
  };

  const contextValue = useMemo(
    () => ({
      collection,
      setCollection,
      toggleCollection,
      isLoading,
      viewMode,
      setViewMode,
      openShop,
      openBrand,
      products,
      addProduct,
      updateProduct,
      removeProduct,
      resetProductsToDefault,
      isManagementOpen,
      setIsManagementOpen,
      toggleManagement,
      categories,
      addCategory,
      updateCategory,
      removeCategory,
      resetCategoriesToDefault,
      cart,
      addToCart,
      removeFromCart,
      updateQuantity,
      clearCart,
      cartTotal,
      cartCount,
      isCartOpen,
      setIsCartOpen,
      selectedProduct,
      openProductModal,
      closeProductModal,
      isSayHelloOpen,
      setIsSayHelloOpen,
      isSearchOpen,
      setIsSearchOpen,
      isCheckoutHandoff,
      triggerCheckoutHandoff,
    }),
    [
      collection,
      isLoading,
      viewMode,
      products,
      isManagementOpen,
      categories,
      cart,
      cartTotal,
      cartCount,
      isCartOpen,
      selectedProduct,
      isSayHelloOpen,
      isSearchOpen,
      isCheckoutHandoff,
    ]
  );

  return (
    <CollectionContext.Provider value={contextValue}>
      {children}
    </CollectionContext.Provider>
  );
};

export const useCollection = () => {
  const context = useContext(CollectionContext);
  if (!context) {
    throw new Error('useCollection must be used within CollectionProvider');
  }
  return context;
};
