import { useState, useCallback } from 'react';
import { fetchAdminProducts, saveAdminProduct, deleteAdminProduct as apiDeleteAdminProduct, getLocalDeletedProductIds } from '../lib/adminApi';
import { getGoogleFirestore } from '../lib/googleDatabase';
import { collection, getDocs } from 'firebase/firestore';

function withTimeout<T>(promise: Promise<T>, ms = 3000, fallbackVal: T): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((resolve) => setTimeout(() => resolve(fallbackVal), ms))
  ]);
}

export const useAdminProducts = () => {
  const [products, setProducts] = useState<any[]>(() => {
    try {
      const saved = localStorage.getItem('matilda_products');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch {}
    return [];
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastFetched, setLastFetched] = useState<Date | null>(null);

  const fetchProducts = useCallback(async () => {
    setLoading(true);
    setError(null);
    const deletedSet = getLocalDeletedProductIds();
    let loadedProducts: any[] | null = null;

    try {
      // 1. Fetch via Express API with timeout
      try {
        const apiProds = await withTimeout(fetchAdminProducts(), 4000, null);
        if (Array.isArray(apiProds)) {
          loadedProducts = apiProds;
        }
      } catch (e) {
        console.warn("API products fetch notice:", e);
      }

      // 2. Direct Google Cloud Firestore query with timeout if API gave no list
      if (!loadedProducts || loadedProducts.length === 0) {
        try {
          const db = getGoogleFirestore();
          if (db) {
            const snapshot = await withTimeout(getDocs(collection(db, 'products')), 3000, null as any);
            if (snapshot && !snapshot.empty) {
              loadedProducts = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            }
          }
        } catch (fsErr) {
          console.warn('Firestore direct fetch notice:', fsErr);
        }
      }

      // 3. LocalStorage fallback if nothing loaded yet
      if (!loadedProducts) {
        try {
          const saved = localStorage.getItem('matilda_products');
          if (saved) {
            const parsed = JSON.parse(saved);
            if (Array.isArray(parsed)) {
              loadedProducts = parsed;
            }
          }
        } catch {}
      }

      // If still null, empty list (no preset dummy data injected)
      if (!loadedProducts) {
        loadedProducts = [];
      }

      // Filter out deleted products and normalize
      const activeProducts = loadedProducts.filter(p => !deletedSet.has(p.id) && !deletedSet.has(p.slug));

      const normalized = activeProducts.map((p: any) => {
        const rawVariants = Array.isArray(p.variants) && p.variants.length > 0
          ? p.variants
          : [{ id: 'v1', name: 'One Size', inStock: true, stock: Number(p.stock_count) || 0 }];

        const variants = rawVariants.map((v: any, idx: number) => {
          const stock = typeof v.stock === 'number'
            ? v.stock
            : (v.stock !== undefined ? Number(v.stock) || 0 : (v.inStock === false ? 0 : 0));
          return {
            id: v.id || `v_${idx + 1}`,
            name: v.name || 'One Size',
            stock,
            inStock: typeof v.inStock === 'boolean' ? (stock > 0 && v.inStock) : stock > 0
          };
        });

        const totalVariantStock = variants.reduce((sum: number, v: any) => sum + (v.stock || 0), 0);

        return {
          id: p.id,
          slug: p.slug || p.id,
          title: p.title || p.name || 'Product',
          collection: p.collection || 'women',
          category: p.category || 'general',
          price: Number(p.price || 0),
          stock_count: p.stock_count !== undefined && p.stock_count !== null ? Number(p.stock_count) : totalVariantStock,
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
      setLastFetched(new Date());
      try {
        localStorage.setItem('matilda_products', JSON.stringify(normalized));
      } catch {}
    } catch (err: any) {
      console.error("Fetch products fatal error:", err);
      setError(err?.message || "Failed to load products");
    } finally {
      setLoading(false);
    }
  }, []);

  const saveProduct = async (productData: any, id?: string) => {
    const filteredVariants = productData.variants ? productData.variants.filter((v: any) => v.name && v.name.trim() !== '') : [];
    const normalizedVariants = (filteredVariants.length > 0 ? filteredVariants : [{ id: 'v1', name: 'One Size', inStock: true, stock: 10 }]).map((v: any, idx: number) => {
      const stock = typeof v.stock === 'number' ? v.stock : Math.max(0, parseInt(v.stock, 10) || 0);
      return {
        id: v.id || `v_${idx + 1}`,
        name: v.name,
        stock,
        inStock: stock > 0
      };
    });
    const totalStock = normalizedVariants.reduce((a: number, b: any) => a + (b.stock || 0), 0);

    const targetId = id || productData.id || `prod_${Date.now()}`;
    const payload = {
      ...productData,
      id: targetId,
      slug: productData.slug || productData.title?.toLowerCase().replace(/[^a-z0-9]/g, '-') || targetId,
      stock_count: totalStock,
      details: Array.isArray(productData.details) ? productData.details.filter((d: string) => d && d.trim() !== '') : [],
      galleryImages: Array.isArray(productData.galleryImages) ? productData.galleryImages.filter((g: string) => g && g.trim() !== '') : [],
      variants: normalizedVariants
    };

    // 1. Instant optimistic state update
    setProducts((prev) => {
      if (id) {
        return prev.map(p => (p.id === id || p.slug === id) ? { ...p, ...payload } : p);
      } else {
        return [payload, ...prev.filter(p => p.id !== targetId)];
      }
    });

    // 2. Local storage instant sync
    try {
      const existingStr = localStorage.getItem('matilda_products');
      let arr: any[] = existingStr ? JSON.parse(existingStr) : [...products];
      if (id) {
        arr = arr.map(p => (p.id === id || p.slug === id) ? { ...p, ...payload } : p);
      } else {
        arr = [payload, ...arr.filter(p => p.id !== targetId)];
      }
      localStorage.setItem('matilda_products', JSON.stringify(arr));
    } catch (e) {}

    window.dispatchEvent(new Event('matilda-catalogue-updated'));

    // 3. Save via API & Firestore with safety timeout
    try {
      await withTimeout(saveAdminProduct(payload, !!id), 4000, null);
    } catch (err) {
      console.warn("API save product notice (order preserved locally):", err);
    }
  };

  const deleteProduct = async (id: string, slug?: string) => {
    // 1. Instant optimistic update
    setProducts((prev) => prev.filter((p) => p.id !== id && (!slug || p.slug !== slug)));

    try {
      const existingStr = localStorage.getItem('matilda_products');
      let arr: any[] = existingStr ? JSON.parse(existingStr) : [...products];
      arr = arr.filter(p => p.id !== id && (!slug || p.slug !== slug));
      localStorage.setItem('matilda_products', JSON.stringify(arr));
    } catch (e) {}

    window.dispatchEvent(new Event('matilda-catalogue-updated'));

    // 2. API delete with safety timeout
    try {
      await withTimeout(apiDeleteAdminProduct(id, slug), 4000, true);
    } catch (e) {
      console.warn("Delete product notice:", e);
    }
  };

  return {
    products,
    loading,
    error,
    lastFetched,
    fetchProducts,
    saveProduct,
    deleteProduct
  };
};
