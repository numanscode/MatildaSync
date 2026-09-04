import React, { useEffect, useState, useMemo } from 'react';
import { Pencil, Trash2, Plus, Loader2, Image as ImageIcon, Check, Filter, Layers, RefreshCw } from 'lucide-react';
import { useAdminProducts } from '../../../hooks/useAdminProducts';
import { useCollection } from '../../../context/CollectionContext';
import { getAdminAuthHeaders } from '../../../lib/adminApi';
import { AdminModal } from '../shared/AdminModal';
import { AdminConfirmModal } from '../shared/AdminConfirmModal';
import { AdminSearch } from '../shared/AdminSearch';
import { AdminStatCard } from '../shared/AdminStatCard';
import { AdminBadge } from '../shared/AdminBadge';

export const AdminProducts: React.FC = () => {
  const { products, loading, error, lastFetched, fetchProducts, saveProduct, deleteProduct } = useAdminProducts();
  const { categories } = useCollection();
  const [isUploading, setIsUploading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [stockFilter, setStockFilter] = useState<'all' | 'in_stock' | 'out_of_stock'>('all');
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<any>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [deletingProduct, setDeletingProduct] = useState<any>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const [formData, setFormData] = useState({
    title: '',
    slug: '',
    collection: 'women',
    category: '',
    price: 0,
    stock_count: 0,
    description: '',
    material: '',
    mainImage: '',
    lifestyleImage: '',
    imageFit: 'cover',
    isFeatured: false,
    hasVictorianFrame: false,
    details: [''],
    galleryImages: [] as string[],
    variants: [{ id: 'v1', name: 'One Size', inStock: true, stock: 0 }]
  });

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  const handleOpenModal = (product: any = null) => {
    if (product) {
      setEditingProduct(product);
      const normalizedVars = Array.isArray(product.variants) && product.variants.length > 0
        ? product.variants.map((v: any, idx: number) => ({
            id: v.id || `v_${idx + 1}`,
            name: v.name || '',
            stock: typeof v.stock === 'number' ? v.stock : (v.inStock ? 10 : 0),
            inStock: typeof v.inStock === 'boolean' ? v.inStock : (v.stock > 0)
          }))
        : [{ id: 'v1', name: 'One Size', inStock: true, stock: product.stock_count || 0 }];

      const totalStock = normalizedVars.reduce((sum: number, v: any) => sum + (v.stock || 0), 0);

      setFormData({
        title: product.title || '',
        slug: product.slug || '',
        collection: product.collection || 'women',
        category: product.category || '',
        price: product.price || 0,
        stock_count: product.stock_count !== undefined ? product.stock_count : totalStock,
        description: product.description || '',
        material: product.material || '',
        mainImage: product.mainImage || '',
        lifestyleImage: product.lifestyleImage || '',
        imageFit: product.imageFit || 'cover',
        isFeatured: !!product.isFeatured,
        hasVictorianFrame: !!product.hasVictorianFrame,
        details: Array.isArray(product.details) && product.details.length > 0 ? product.details : [''],
        galleryImages: Array.isArray(product.galleryImages) ? product.galleryImages : [],
        variants: normalizedVars
      });
    } else {
      setEditingProduct(null);
      setFormData({
        title: '',
        slug: '',
        collection: 'women',
        category: categories[0]?.slug || '',
        price: 0,
        stock_count: 0,
        description: '',
        material: '',
        mainImage: '',
        lifestyleImage: '',
        imageFit: 'cover',
        isFeatured: false,
        hasVictorianFrame: false,
        details: [''],
        galleryImages: [],
        variants: [{ id: 'v1', name: 'One Size', inStock: true, stock: 0 }]
      });
    }
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      await saveProduct(formData, editingProduct?.id);
      setIsModalOpen(false);
    } catch (err) {
      console.error('Failed to save product:', err);
    } finally {
      setIsSaving(false);
    }
  };

  const confirmAndExecuteDelete = async () => {
    if (!deletingProduct) return;
    setIsDeleting(true);
    try {
      await deleteProduct(deletingProduct.id, deletingProduct.slug);
      setDeletingProduct(null);
    } catch (err) {
      console.error('Failed to delete product:', err);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleArrayChange = (index: number, value: string, field: 'details' | 'galleryImages') => {
    const newArr = [...formData[field]];
    newArr[index] = value;
    setFormData({ ...formData, [field]: newArr });
  };

  const addArrayItem = (field: 'details' | 'galleryImages') => {
    setFormData({ ...formData, [field]: [...formData[field], ''] });
  };

  const removeArrayItem = (index: number, field: 'details' | 'galleryImages') => {
    const updated = formData[field].filter((_, i) => i !== index);
    setFormData({ ...formData, [field]: updated.length > 0 ? updated : [''] });
  };

  const handleVariantChange = (index: number, key: string, value: any) => {
    const newVariants = [...formData.variants];
    newVariants[index] = { ...newVariants[index], [key]: value };

    const newTotalStock = newVariants.reduce((sum: number, v: any) => sum + (v.stock || 0), 0);
    setFormData({ ...formData, variants: newVariants, stock_count: newTotalStock });
  };

  const addVariant = () => {
    const newVars = [...formData.variants, { id: `v${Date.now()}`, name: '', inStock: true, stock: 10 }];
    const newTotalStock = newVars.reduce((sum: number, v: any) => sum + (v.stock || 0), 0);
    setFormData({ ...formData, variants: newVars, stock_count: newTotalStock });
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, field: 'mainImage' | 'lifestyleImage' | 'galleryImages', index?: number) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    try {
      let uploadedUrl = '';
      try {
        const uploadData = new FormData();
        uploadData.append('file', file);
        const res = await fetch('/api/admin/upload', {
          method: 'POST',
          headers: getAdminAuthHeaders(),
          credentials: 'include',
          body: uploadData
        });
        if (res.ok) {
          const data = await res.json();
          if (data.url) uploadedUrl = data.url;
        }
      } catch (e) {
        console.warn("Backend upload notice:", e);
      }

      if (!uploadedUrl) {
        uploadedUrl = await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onload = (ev) => resolve(ev.target?.result as string || '');
          reader.readAsDataURL(file);
        });
      }

      if (field === 'galleryImages' && index !== undefined) {
        handleArrayChange(index, uploadedUrl, 'galleryImages');
      } else {
        setFormData({ ...formData, [field]: uploadedUrl });
      }
    } catch (err: any) {
      alert(`Upload failed: ${err.message}`);
    } finally {
      setIsUploading(false);
    }
  };

  const filteredProducts = useMemo(() => {
    return products.filter(p => {
      const matchesSearch = 
        p.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
        (p.collection && p.collection.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (p.category && p.category.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (p.material && p.material.toLowerCase().includes(searchQuery.toLowerCase()));

      const matchesCategory = categoryFilter === 'all' || p.category?.toLowerCase() === categoryFilter.toLowerCase();
      
      const isAvailable = (p.stock_count || 0) > 0;
      const matchesStock = 
        stockFilter === 'all' ? true : 
        stockFilter === 'in_stock' ? isAvailable : !isAvailable;

      return matchesSearch && matchesCategory && matchesStock;
    });
  }, [products, searchQuery, categoryFilter, stockFilter]);

  const stats = useMemo(() => {
    const totalCount = products.length;
    const inStock = products.filter(p => (p.stock_count || 0) > 0).length;
    const outOfStock = totalCount - inStock;
    const totalInventoryValue = products.reduce((acc, p) => acc + (p.price || 0) * (p.stock_count || 0), 0);

    return { totalCount, inStock, outOfStock, totalInventoryValue };
  }, [products]);

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="font-display text-2xl font-bold lowercase tracking-tighter">product catalogue.</h2>
            {lastFetched && (
              <span className="hidden md:inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-micro uppercase tracking-wider bg-emerald-50 text-emerald-700 border border-emerald-200">
                live
              </span>
            )}
          </div>
          <p className="font-micro uppercase tracking-widest text-[10px] text-gray-500 mt-0.5">
            manage studio inventory, pricing, variants, and product photography
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {/* Refresh / Fetch Products button */}
          <button
            onClick={() => fetchProducts()}
            disabled={loading}
            className="bg-white hover:bg-gray-50 text-gray-700 border border-gray-200 hover:border-[var(--border-admin)] font-micro uppercase tracking-widest text-[10px] px-4 py-2.5 rounded-full shadow-xs transition-all flex items-center gap-1.5 disabled:opacity-50"
            title="Fetch products from backend server and cloud database"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-[var(--border-admin)] ${loading ? 'animate-spin' : ''}`} />
            <span>{loading ? 'fetching...' : 'fetch products'}</span>
          </button>

          <div className="flex bg-white/80 p-1 border border-gray-200 rounded-full">
            <button
              onClick={() => setViewMode('grid')}
              className={`px-3 py-1 text-[10px] font-micro uppercase tracking-wider rounded-full transition-all ${viewMode === 'grid' ? 'bg-[var(--border-admin)] text-white shadow-xs' : 'text-gray-500 hover:text-black'}`}
            >
              Grid
            </button>
            <button
              onClick={() => setViewMode('table')}
              className={`px-3 py-1 text-[10px] font-micro uppercase tracking-wider rounded-full transition-all ${viewMode === 'table' ? 'bg-[var(--border-admin)] text-white shadow-xs' : 'text-gray-500 hover:text-black'}`}
            >
              Table
            </button>
          </div>

          <button 
            onClick={() => handleOpenModal()}
            className="bg-[var(--border-admin)] text-white font-micro uppercase tracking-widest text-[10px] px-5 py-2.5 rounded-full shadow-md hover:opacity-90 transition-all flex items-center gap-1.5"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>new product</span>
          </button>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <AdminStatCard label="Total Products" value={stats.totalCount} subValue="Studio items live" />
        <AdminStatCard label="In Stock" value={stats.inStock} subValue="Available to buy" />
        <AdminStatCard label="Out of Stock" value={stats.outOfStock} subValue="Needs restock" />
        <AdminStatCard label="Inventory Value" value={`₹${stats.totalInventoryValue.toLocaleString('en-IN')}`} subValue="Retail valuation" />
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white/80 backdrop-blur-md border border-[var(--border-admin-subtle)] rounded-2xl p-4 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 shadow-xs">
        <div className="flex-1 max-w-md">
          <AdminSearch
            value={searchQuery}
            onChange={setSearchQuery}
            placeholder="Search by title, category, material..."
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Category Filter */}
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="bg-white border border-gray-200 rounded-full px-3 py-1.5 text-xs font-micro uppercase tracking-wider text-gray-700 outline-none focus:border-[var(--border-admin)]"
          >
            <option value="all">All Categories</option>
            {categories.map((c) => (
              <option key={c.id} value={c.slug || c.name.toLowerCase()}>{c.name}</option>
            ))}
          </select>

          {/* Stock Filter */}
          <select
            value={stockFilter}
            onChange={(e) => setStockFilter(e.target.value as any)}
            className="bg-white border border-gray-200 rounded-full px-3 py-1.5 text-xs font-micro uppercase tracking-wider text-gray-700 outline-none focus:border-[var(--border-admin)]"
          >
            <option value="all">All Stock Status</option>
            <option value="in_stock">In Stock Only</option>
            <option value="out_of_stock">Out of Stock</option>
          </select>

          {(searchQuery || categoryFilter !== 'all' || stockFilter !== 'all') && (
            <button
              onClick={() => {
                setSearchQuery('');
                setCategoryFilter('all');
                setStockFilter('all');
              }}
              className="text-[10px] font-micro uppercase tracking-widest text-[var(--border-admin)] hover:underline px-2"
            >
              Reset Filters
            </button>
          )}
        </div>
      </div>

      {/* Content Rendering: Grid vs Table */}
      {loading && products.length === 0 ? (
        <div className="py-16 text-center">
          <Loader2 className="w-6 h-6 animate-spin text-[var(--border-admin)] mx-auto mb-2" />
          <p className="font-micro uppercase tracking-widest text-xs text-gray-400">Loading products catalogue...</p>
        </div>
      ) : filteredProducts.length === 0 ? (
        <div className="bg-white/60 border border-dashed border-gray-300 rounded-3xl p-12 text-center flex flex-col items-center justify-center gap-3">
          <p className="font-micro uppercase tracking-widest text-xs text-gray-600 font-semibold">
            {products.length === 0 ? 'No products in catalogue.' : 'No products found matching your search or filters.'}
          </p>
          <p className="font-micro text-[11px] text-gray-400 max-w-sm">
            {products.length === 0 
              ? 'Click "Fetch Products" to sync from the database, or create your first product below.'
              : 'Try resetting your filter parameters or search keywords.'}
          </p>
          <div className="flex flex-wrap items-center justify-center gap-2 mt-2">
            <button
              onClick={() => fetchProducts()}
              disabled={loading}
              className="px-4 py-2 bg-white border border-gray-200 text-gray-700 text-xs font-mono uppercase tracking-widest rounded-xl hover:border-[var(--border-admin)] transition-all flex items-center gap-1.5 shadow-xs disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-[var(--border-admin)] ${loading ? 'animate-spin' : ''}`} />
              <span>{loading ? 'Fetching...' : 'Fetch Products'}</span>
            </button>
            <button
              onClick={() => handleOpenModal()}
              className="px-4 py-2 bg-[var(--border-admin)] text-white text-xs font-mono uppercase tracking-widest rounded-xl hover:opacity-90 transition-opacity flex items-center gap-1.5 shadow-xs"
            >
              <Plus className="w-3.5 h-3.5" /> Add New Product
            </button>
          </div>
        </div>
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {filteredProducts.map(p => (
            <div key={p.id} className="bg-white/80 backdrop-blur-md border border-[var(--border-admin-subtle)] rounded-2xl p-4 flex flex-col gap-3 shadow-xs hover:shadow-md hover:border-[var(--border-admin)] transition-all relative group">
              <div className="absolute top-3 right-3 flex gap-1.5 z-10 bg-white/95 backdrop-blur-sm p-1 rounded-lg border border-gray-100 shadow-xs">
                <button 
                  onClick={() => handleOpenModal(p)} 
                  className="p-1.5 text-gray-500 hover:text-[var(--border-admin)] hover:bg-gray-100 rounded-md transition-colors"
                  title="Edit Product"
                >
                  <Pencil className="w-3.5 h-3.5" />
                </button>
                <button 
                  onClick={() => setDeletingProduct(p)} 
                  className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-md transition-colors"
                  title="Delete Product"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
              
              <div className="w-full aspect-square rounded-xl overflow-hidden bg-gray-50 border border-gray-100 relative">
                 {p.mainImage ? (
                   <img src={p.mainImage} alt={p.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                 ) : (
                   <div className="w-full h-full flex items-center justify-center text-gray-300 text-xs uppercase tracking-widest">
                     No Image
                   </div>
                 )}
                 {p.isFeatured && (
                   <span className="absolute bottom-2 left-2 px-2 py-0.5 bg-amber-500 text-white text-[8px] font-bold uppercase tracking-widest rounded-md shadow-xs">
                     Featured
                   </span>
                 )}
                 {p.hasVictorianFrame && (
                   <span className="absolute top-2 left-2 px-2 py-0.5 bg-[var(--border-admin)] text-white text-[8px] font-bold uppercase tracking-widest rounded-md shadow-xs">
                     Victorian Frame
                   </span>
                 )}
              </div>
              
              <div className="flex flex-col flex-1">
                <div className="flex items-start justify-between gap-1 mb-1">
                  <h3 className="font-body text-sm font-bold text-gray-900 line-clamp-1">{p.title}</h3>
                  <span className="font-display font-bold text-sm text-[var(--border-admin)] shrink-0">₹{p.price}</span>
                </div>
                <p className="font-micro text-[10px] uppercase tracking-widest text-gray-500 mb-2">{p.collection} &middot; {p.category}</p>
                
                <div className="mt-auto pt-2.5 border-t border-gray-100 flex items-center justify-between text-xs">
                  <AdminBadge variant={p.stock_count > 0 ? 'active' : 'inactive'}>
                    {p.stock_count > 0 ? `${p.stock_count} in stock` : 'out of stock'}
                  </AdminBadge>
                  <span className="font-micro text-[9px] uppercase tracking-wider text-gray-400">
                    {Array.isArray(p.variants) ? `${p.variants.length} variant${p.variants.length > 1 ? 's' : ''}` : '1 variant'}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        /* Table View */
        <div className="bg-white/80 backdrop-blur-md border border-[var(--border-admin-subtle)] rounded-3xl overflow-hidden shadow-xs">
          <div className="overflow-x-auto custom-scrollbar">
            <table className="w-full text-left font-body text-xs min-w-[700px]">
              <thead className="bg-[var(--border-admin-subtle)]/40 border-b border-[var(--border-admin-subtle)] font-micro uppercase tracking-widest text-[9px] text-gray-600">
                <tr>
                  <th className="p-4">Product</th>
                  <th className="p-4">Category</th>
                  <th className="p-4">Price</th>
                  <th className="p-4">Stock</th>
                  <th className="p-4">Status</th>
                  <th className="p-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredProducts.map(p => (
                  <tr key={p.id} className="hover:bg-white transition-colors">
                    <td className="p-4 flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl overflow-hidden bg-gray-100 border border-gray-200 shrink-0">
                        {p.mainImage ? (
                          <img src={p.mainImage} alt={p.title} className="w-full h-full object-cover" />
                        ) : (
                          <ImageIcon className="w-4 h-4 text-gray-400 m-auto mt-3" />
                        )}
                      </div>
                      <div>
                        <p className="font-bold text-sm text-gray-900">{p.title}</p>
                        <p className="font-micro uppercase tracking-widest text-[9px] text-gray-400">{p.slug || p.id}</p>
                      </div>
                    </td>
                    <td className="p-4 font-micro uppercase tracking-wider text-gray-600">
                      {p.collection} / {p.category}
                    </td>
                    <td className="p-4 font-bold font-display text-sm text-gray-900">
                      ₹{p.price}
                    </td>
                    <td className="p-4 font-mono text-xs">
                      {p.stock_count || 0}
                    </td>
                    <td className="p-4">
                      <AdminBadge variant={p.stock_count > 0 ? 'active' : 'inactive'}>
                        {p.stock_count > 0 ? 'In Stock' : 'Out of Stock'}
                      </AdminBadge>
                    </td>
                    <td className="p-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button 
                          onClick={() => handleOpenModal(p)}
                          className="p-1.5 text-gray-500 hover:text-[var(--border-admin)] hover:bg-gray-100 rounded-lg transition-colors"
                          title="Edit"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button 
                          onClick={() => setDeletingProduct(p)}
                          className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          title="Delete"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Edit / New Product Modal */}
      <AdminModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingProduct ? 'edit product' : 'new product'}
        subtitle={editingProduct ? `id: ${editingProduct.id}` : 'add a new item to matilda studio'}
        maxWidth="2xl"
      >
        <form onSubmit={handleSave} className="space-y-6 font-body text-xs">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block font-micro uppercase tracking-widest text-[9px] text-gray-600 mb-1">Title</label>
              <input 
                required 
                type="text" 
                value={formData.title} 
                onChange={e => setFormData({...formData, title: e.target.value})} 
                className="w-full border border-gray-200 rounded-xl p-3 outline-none focus:border-[var(--border-admin)] text-xs text-gray-900 bg-gray-50/50" 
              />
            </div>
            <div>
              <label className="block font-micro uppercase tracking-widest text-[9px] text-gray-600 mb-1">Slug (optional)</label>
              <input 
                type="text" 
                value={formData.slug} 
                onChange={e => setFormData({...formData, slug: e.target.value})} 
                placeholder="auto-generated if empty" 
                className="w-full border border-gray-200 rounded-xl p-3 outline-none focus:border-[var(--border-admin)] text-xs text-gray-900 bg-gray-50/50" 
              />
            </div>
            <div>
              <label className="block font-micro uppercase tracking-widest text-[9px] text-gray-600 mb-1">Collection</label>
              <select 
                value={formData.collection} 
                onChange={e => setFormData({...formData, collection: e.target.value})} 
                className="w-full border border-gray-200 rounded-xl p-3 outline-none focus:border-[var(--border-admin)] text-xs text-gray-900 bg-gray-50/50"
              >
                <option value="women">Women</option>
                <option value="men">Men</option>
                <option value="both">Both</option>
              </select>
            </div>
            <div>
              <label className="block font-micro uppercase tracking-widest text-[9px] text-gray-600 mb-1">Category</label>
              <div className="flex gap-2">
                <select
                  value={categories.some(c => c.slug === formData.category || c.name.toLowerCase() === formData.category.toLowerCase()) ? formData.category : (formData.category ? 'custom' : '')}
                  onChange={e => {
                    if (e.target.value && e.target.value !== 'custom') {
                      setFormData({ ...formData, category: e.target.value });
                    }
                  }}
                  className="border border-gray-200 rounded-xl p-3 outline-none focus:border-[var(--border-admin)] bg-gray-50/50 text-xs text-gray-900"
                >
                  <option value="">Select Category...</option>
                  {categories.map(c => (
                    <option key={c.id} value={c.slug || c.name.toLowerCase()}>{c.name}</option>
                  ))}
                  <option value="custom">Other / Custom</option>
                </select>
                <input
                  required
                  type="text"
                  value={formData.category}
                  onChange={e => setFormData({...formData, category: e.target.value})}
                  placeholder="e.g. jewelry"
                  className="flex-1 border border-gray-200 rounded-xl p-3 outline-none focus:border-[var(--border-admin)] text-xs text-gray-900 bg-gray-50/50"
                />
              </div>
            </div>
            <div>
              <label className="block font-micro uppercase tracking-widest text-[9px] text-gray-600 mb-1">Price (₹)</label>
              <input 
                required 
                type="number" 
                min="0"
                value={formData.price} 
                onChange={e => setFormData({...formData, price: Number(e.target.value)})} 
                className="w-full border border-gray-200 rounded-xl p-3 outline-none focus:border-[var(--border-admin)] text-xs text-gray-900 bg-gray-50/50 font-bold" 
              />
            </div>
            <div>
              <label className="block font-micro uppercase tracking-widest text-[9px] text-gray-600 mb-1">Material</label>
              <input 
                type="text" 
                value={formData.material} 
                onChange={e => setFormData({...formData, material: e.target.value})} 
                placeholder="e.g. 18k Gold Plated Brass"
                className="w-full border border-gray-200 rounded-xl p-3 outline-none focus:border-[var(--border-admin)] text-xs text-gray-900 bg-gray-50/50" 
              />
            </div>
          </div>

          <div>
            <label className="block font-micro uppercase tracking-widest text-[9px] text-gray-600 mb-1">Description</label>
            <textarea 
              rows={3} 
              value={formData.description} 
              onChange={e => setFormData({...formData, description: e.target.value})} 
              className="w-full border border-gray-200 rounded-xl p-3 outline-none focus:border-[var(--border-admin)] text-xs text-gray-900 bg-gray-50/50 resize-none"
            />
          </div>

          {/* Media Section */}
          <div className="space-y-4 border-t border-gray-100 pt-5">
            <div className="flex items-center justify-between">
              <h4 className="font-micro uppercase tracking-widest text-[10px] text-gray-700 font-bold">Product Media</h4>
              {isUploading && (
                <span className="text-[var(--border-admin)] font-micro uppercase tracking-wider text-[9px] flex items-center gap-1 animate-pulse">
                  <Loader2 className="w-3 h-3 animate-spin" /> uploading...
                </span>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block font-micro uppercase tracking-widest text-[9px] text-gray-600 mb-1">Main Image URL</label>
                <div className="flex gap-2">
                  <input 
                    required 
                    type="url" 
                    value={formData.mainImage} 
                    onChange={e => setFormData({...formData, mainImage: e.target.value})} 
                    className="flex-1 border border-gray-200 rounded-xl p-3 outline-none focus:border-[var(--border-admin)] text-xs bg-gray-50/50" 
                  />
                  <label className="cursor-pointer flex items-center justify-center px-4 bg-gray-100 hover:bg-gray-200 border border-gray-200 rounded-xl text-xs font-medium transition-colors">
                    Upload
                    <input type="file" accept="image/*" className="hidden" onChange={(e) => handleFileUpload(e, 'mainImage')} />
                  </label>
                </div>
              </div>
              <div>
                <label className="block font-micro uppercase tracking-widest text-[9px] text-gray-600 mb-1">Lifestyle Image URL</label>
                <div className="flex gap-2">
                  <input 
                    type="url" 
                    value={formData.lifestyleImage} 
                    onChange={e => setFormData({...formData, lifestyleImage: e.target.value})} 
                    className="flex-1 border border-gray-200 rounded-xl p-3 outline-none focus:border-[var(--border-admin)] text-xs bg-gray-50/50" 
                  />
                  <label className="cursor-pointer flex items-center justify-center px-4 bg-gray-100 hover:bg-gray-200 border border-gray-200 rounded-xl text-xs font-medium transition-colors">
                    Upload
                    <input type="file" accept="image/*" className="hidden" onChange={(e) => handleFileUpload(e, 'lifestyleImage')} />
                  </label>
                </div>
              </div>
            </div>

            {/* Gallery Images */}
            <div>
              <label className="block font-micro uppercase tracking-widest text-[9px] text-gray-600 mb-1.5">Gallery Images</label>
              <div className="space-y-2">
                {formData.galleryImages.map((img, i) => (
                  <div key={i} className="flex gap-2 items-center">
                    <input 
                      type="url" 
                      value={img} 
                      onChange={e => handleArrayChange(i, e.target.value, 'galleryImages')} 
                      placeholder="Image URL" 
                      className="flex-1 border border-gray-200 rounded-xl p-2.5 outline-none focus:border-[var(--border-admin)] text-xs bg-gray-50/50" 
                    />
                    <label className="cursor-pointer flex items-center justify-center px-3 py-2 bg-gray-100 hover:bg-gray-200 border border-gray-200 rounded-xl text-xs font-medium transition-colors">
                      Upload
                      <input type="file" accept="image/*" className="hidden" onChange={(e) => handleFileUpload(e, 'galleryImages', i)} />
                    </label>
                    <button
                      type="button"
                      onClick={() => removeArrayItem(i, 'galleryImages')}
                      className="p-2 text-gray-400 hover:text-red-500 rounded-lg"
                      title="Remove image"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
              <button 
                type="button" 
                onClick={() => addArrayItem('galleryImages')} 
                className="text-[var(--border-admin)] hover:underline flex items-center gap-1 mt-2 text-xs font-semibold"
              >
                <Plus className="w-3.5 h-3.5" /> Add Gallery Image
              </button>
            </div>
          </div>

          {/* Variants and Stock */}
          <div className="border-t border-gray-100 pt-5 space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="font-micro uppercase tracking-widest text-[10px] text-gray-700 font-bold">Variants &amp; Stock Management</h4>
              <span className="font-micro uppercase tracking-wider text-[10px] text-gray-500">
                Total Stock: <strong className="text-[var(--border-admin)]">{formData.stock_count}</strong>
              </span>
            </div>

            <div className="space-y-2">
              {formData.variants.map((v, i) => (
                <div key={i} className="flex flex-wrap items-center gap-2 p-3 rounded-2xl border border-gray-200 bg-gray-50/70">
                  <input
                    type="text"
                    value={v.name}
                    onChange={e => handleVariantChange(i, 'name', e.target.value)}
                    placeholder="Variant name (e.g. Gold, 18 inch)"
                    className="flex-1 min-w-[140px] border border-gray-200 rounded-xl p-2 outline-none focus:border-[var(--border-admin)] bg-white text-xs"
                  />
                  <div className="flex items-center gap-1.5">
                    <span className="font-micro uppercase tracking-wider text-[9px] text-gray-500 font-bold">Qty:</span>
                    <input
                      type="number"
                      min="0"
                      value={v.stock !== undefined ? v.stock : (v.inStock ? 10 : 0)}
                      onChange={e => {
                        const val = Math.max(0, parseInt(e.target.value, 10) || 0);
                        const newVars = [...formData.variants];
                        newVars[i] = { ...newVars[i], stock: val, inStock: val > 0 };
                        const newTotalStock = newVars.reduce((sum: number, item: any) => sum + (item.stock || 0), 0);
                        setFormData({ ...formData, variants: newVars, stock_count: newTotalStock });
                      }}
                      className="w-16 border border-gray-200 rounded-xl p-2 outline-none focus:border-[var(--border-admin)] bg-white text-xs text-center font-bold"
                    />
                  </div>
                  {formData.variants.length > 1 && (
                    <button
                      type="button"
                      onClick={() => {
                        const updated = formData.variants.filter((_, idx) => idx !== i);
                        const newTotal = updated.reduce((sum: number, item: any) => sum + (item.stock || 0), 0);
                        setFormData({ ...formData, variants: updated, stock_count: newTotal });
                      }}
                      className="text-gray-400 hover:text-red-500 p-1.5"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              ))}
            </div>

            <button 
              type="button" 
              onClick={addVariant} 
              className="text-[var(--border-admin)] hover:underline flex items-center gap-1 text-xs font-semibold"
            >
              <Plus className="w-3.5 h-3.5" /> Add Another Variant
            </button>
          </div>

          {/* Badges & Flags */}
          <div className="flex flex-wrap items-center gap-6 border-t border-gray-100 pt-5">
            <label className="flex items-center gap-2 font-micro uppercase tracking-widest text-[9px] cursor-pointer text-gray-700">
              <input 
                type="checkbox" 
                checked={formData.isFeatured} 
                onChange={e => setFormData({...formData, isFeatured: e.target.checked})} 
                className="accent-[var(--border-admin)] w-4 h-4 rounded" 
              />
              Featured in Studio
            </label>
            <label className="flex items-center gap-2 font-micro uppercase tracking-widest text-[9px] cursor-pointer text-gray-700">
              <input 
                type="checkbox" 
                checked={formData.hasVictorianFrame} 
                onChange={e => setFormData({...formData, hasVictorianFrame: e.target.checked})} 
                className="accent-[var(--border-admin)] w-4 h-4 rounded" 
              />
              Victorian Frame Accent
            </label>
          </div>

          {/* Submit */}
          <div className="pt-4 border-t border-gray-100 flex gap-3">
            <button
              type="button"
              onClick={() => setIsModalOpen(false)}
              className="flex-1 py-3.5 border border-gray-200 rounded-full font-micro uppercase tracking-widest text-[10px] text-gray-600 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button 
              type="submit" 
              disabled={isSaving}
              className="flex-1 bg-[var(--border-admin)] text-white font-micro uppercase tracking-widest text-[10px] py-3.5 rounded-full hover:opacity-90 transition-opacity flex items-center justify-center gap-1.5 shadow-sm disabled:opacity-50"
            >
              {isSaving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              <span>{isSaving ? 'Saving...' : 'Save Product'}</span>
            </button>
          </div>
        </form>
      </AdminModal>

      {/* Delete Confirmation Modal */}
      <AdminConfirmModal
        isOpen={!!deletingProduct}
        onClose={() => setDeletingProduct(null)}
        onConfirm={confirmAndExecuteDelete}
        title={`delete "${deletingProduct?.title}"?`}
        message="This product will be permanently removed from the studio catalogue and customers will no longer be able to purchase it."
        confirmLabel="Delete Product"
        isDestructive={true}
        loading={isDeleting}
      />
    </div>
  );
};
