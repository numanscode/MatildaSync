import React, { useEffect, useState, useMemo } from 'react';
import { fetchAdminPromos, saveAdminPromos } from '../../../lib/adminApi';
import { Pencil, Trash2, Plus, Loader2, Tag, Percent, Gift } from 'lucide-react';
import { AdminModal } from '../shared/AdminModal';
import { AdminConfirmModal } from '../shared/AdminConfirmModal';
import { AdminSearch } from '../shared/AdminSearch';
import { AdminStatCard } from '../shared/AdminStatCard';
import { AdminBadge } from '../shared/AdminBadge';

export const AdminDiscounts: React.FC = () => {
  const [promos, setPromos] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPromoIndex, setEditingPromoIndex] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [deletingIndex, setDeletingIndex] = useState<number | null>(null);

  const [formData, setFormData] = useState({
    code: '',
    discount_type: 'percentage',
    discount_percentage: 0,
    discount_amount: 0,
    bogo_buy: 1,
    bogo_get: 1,
    target_type: 'global',
    target_products: '',
    is_active: true
  });

  const fetchPromos = async () => {
    setLoading(true);
    try {
      const data = await fetchAdminPromos();
      setPromos(data || []);
    } catch (e) {
      console.warn("Fetch promos notice:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPromos();
  }, []);

  const savePromosData = async (updated: any[]) => {
    setIsSaving(true);
    try {
      await saveAdminPromos(updated);
      setPromos(updated);
    } catch (e) {
      console.warn("Save promos notice:", e);
    } finally {
      setIsSaving(false);
    }
  };

  const handleOpenModal = (index: number | null = null) => {
    if (index !== null) {
      setEditingPromoIndex(index);
      setFormData({
        code: promos[index].code || '',
        discount_type: promos[index].discount_type || 'percentage',
        discount_percentage: promos[index].discount_percentage || 0,
        discount_amount: promos[index].discount_amount || 0,
        bogo_buy: promos[index].bogo_buy || 1,
        bogo_get: promos[index].bogo_get || 1,
        target_type: promos[index].target_type || 'global',
        target_products: Array.isArray(promos[index].target_products) 
          ? promos[index].target_products.join(', ') 
          : (promos[index].target_products || ''),
        is_active: promos[index].is_active !== undefined ? promos[index].is_active : true
      });
    } else {
      setEditingPromoIndex(null);
      setFormData({
        code: '',
        discount_type: 'percentage',
        discount_percentage: 10,
        discount_amount: 100,
        bogo_buy: 1,
        bogo_get: 1,
        target_type: 'global',
        target_products: '',
        is_active: true
      });
    }
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanedTargetProducts = formData.target_type === 'specific'
      ? formData.target_products.split(',').map(s => s.trim()).filter(Boolean)
      : [];

    const promoPayload = {
      ...formData,
      code: formData.code.toUpperCase().trim(),
      target_products: cleanedTargetProducts
    };

    let updatedPromos = [...promos];
    if (editingPromoIndex !== null) {
      updatedPromos[editingPromoIndex] = promoPayload;
    } else {
      updatedPromos.push(promoPayload);
    }
    
    await savePromosData(updatedPromos);
    setIsModalOpen(false);
  };

  const executeDelete = async () => {
    if (deletingIndex === null) return;
    const updatedPromos = promos.filter((_, i) => i !== deletingIndex);
    await savePromosData(updatedPromos);
    setDeletingIndex(null);
  };

  const filteredPromos = useMemo(() => {
    return promos.filter(p => 
      (p.code && p.code.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (p.discount_type && p.discount_type.toLowerCase().includes(searchQuery.toLowerCase()))
    );
  }, [promos, searchQuery]);

  const stats = useMemo(() => {
    const total = promos.length;
    const active = promos.filter(p => p.is_active !== false).length;
    const percentageType = promos.filter(p => p.discount_type === 'percentage').length;
    return { total, active, percentageType };
  }, [promos]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="font-display text-2xl font-bold lowercase tracking-tighter">promo codes.</h2>
          <p className="font-micro uppercase tracking-widest text-[10px] text-gray-500 mt-0.5">
            manage coupon discounts, BOGO promotions, and targeted incentives
          </p>
        </div>
        <button 
          onClick={() => handleOpenModal()}
          className="bg-[var(--border-admin)] text-white font-micro uppercase tracking-widest text-[10px] px-6 py-2.5 rounded-full shadow-md hover:opacity-90 transition-all flex items-center gap-1.5"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>new promo code</span>
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <AdminStatCard label="Total Promo Codes" value={stats.total} subValue="Available in system" />
        <AdminStatCard label="Active Promos" value={stats.active} subValue="Usable at checkout" />
        <AdminStatCard label="Percentage Deals" value={stats.percentageType} subValue="Discount rate coupons" />
      </div>

      {/* Search Bar */}
      <div className="bg-white/80 backdrop-blur-md border border-[var(--border-admin-subtle)] rounded-2xl p-4 flex items-center justify-between shadow-xs">
        <div className="w-full max-w-md">
          <AdminSearch
            value={searchQuery}
            onChange={setSearchQuery}
            placeholder="Search promo codes..."
          />
        </div>
      </div>

      {/* Promos Table */}
      <div className="bg-white/80 backdrop-blur-md border border-[var(--border-admin-subtle)] rounded-3xl overflow-hidden shadow-xs">
        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full text-left font-body text-xs min-w-[650px]">
            <thead className="bg-[var(--border-admin-subtle)]/40 border-b border-[var(--border-admin-subtle)] font-micro uppercase tracking-widest text-[9px] text-gray-600">
              <tr>
                <th className="p-4">Coupon Code</th>
                <th className="p-4">Discount Type &amp; Value</th>
                <th className="p-4">Application Scope</th>
                <th className="p-4">Status</th>
                <th className="p-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredPromos.map((p, index) => (
                <tr key={index} className="hover:bg-white transition-colors">
                  <td className="p-4 font-mono font-bold text-sm text-[var(--border-admin)]">
                    {p.code}
                  </td>
                  <td className="p-4 font-bold text-gray-800">
                    {(!p.discount_type || p.discount_type === 'percentage') && `${p.discount_percentage}% off`}
                    {p.discount_type === 'fixed' && `₹${p.discount_amount} off`}
                    {p.discount_type === 'bogo' && `Buy ${p.bogo_buy} Get ${p.bogo_get} Free`}
                  </td>
                  <td className="p-4 font-micro uppercase tracking-wider text-gray-600">
                    {p.target_type === 'specific' ? 'Selected Products' : 'Storewide (All)'}
                  </td>
                  <td className="p-4">
                    <AdminBadge variant={p.is_active ? 'active' : 'inactive'}>
                      {p.is_active ? 'Active' : 'Inactive'}
                    </AdminBadge>
                  </td>
                  <td className="p-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button 
                        onClick={() => handleOpenModal(index)} 
                        className="p-1.5 text-gray-500 hover:text-[var(--border-admin)] hover:bg-gray-100 rounded-lg transition-colors"
                        title="Edit"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button 
                        onClick={() => setDeletingIndex(index)} 
                        className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                        title="Delete"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filteredPromos.length === 0 && (
                <tr>
                  <td colSpan={5} className="p-12 text-center text-gray-400 font-micro uppercase tracking-widest text-xs">
                    {loading ? 'Loading promo codes...' : 'No promo codes found.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Edit / New Promo Modal */}
      <AdminModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingPromoIndex !== null ? 'edit promo code' : 'new promo code'}
        subtitle="configure checkout discounts and redemption rules"
        maxWidth="md"
      >
        <form onSubmit={handleSave} className="space-y-4 font-body text-xs">
          <div>
            <label className="block font-micro uppercase tracking-widest text-[9px] text-gray-600 mb-1">Promo Code</label>
            <input 
              required 
              type="text" 
              value={formData.code} 
              onChange={e => setFormData({...formData, code: e.target.value.toUpperCase()})} 
              className="w-full border border-gray-200 rounded-xl p-3 outline-none focus:border-[var(--border-admin)] uppercase font-mono font-bold bg-gray-50/50" 
              placeholder="e.g. MATILDA10" 
            />
          </div>
          
          <div>
            <label className="block font-micro uppercase tracking-widest text-[9px] text-gray-600 mb-1">Discount Type</label>
            <select 
              value={formData.discount_type} 
              onChange={e => setFormData({...formData, discount_type: e.target.value})} 
              className="w-full border border-gray-200 rounded-xl p-3 outline-none focus:border-[var(--border-admin)] bg-gray-50/50"
            >
              <option value="percentage">Percentage (%)</option>
              <option value="fixed">Fixed Amount (₹)</option>
              <option value="bogo">Buy X Get Y Free (BOGO)</option>
            </select>
          </div>

          {formData.discount_type === 'percentage' && (
            <div>
              <label className="block font-micro uppercase tracking-widest text-[9px] text-gray-600 mb-1">Discount Percentage (%)</label>
              <input 
                required 
                type="number" 
                min="1" 
                max="100" 
                value={formData.discount_percentage} 
                onChange={e => setFormData({...formData, discount_percentage: Number(e.target.value)})} 
                className="w-full border border-gray-200 rounded-xl p-3 outline-none focus:border-[var(--border-admin)] bg-gray-50/50 font-bold" 
              />
            </div>
          )}

          {formData.discount_type === 'fixed' && (
            <div>
              <label className="block font-micro uppercase tracking-widest text-[9px] text-gray-600 mb-1">Discount Amount (₹)</label>
              <input 
                required 
                type="number" 
                min="1" 
                value={formData.discount_amount} 
                onChange={e => setFormData({...formData, discount_amount: Number(e.target.value)})} 
                className="w-full border border-gray-200 rounded-xl p-3 outline-none focus:border-[var(--border-admin)] bg-gray-50/50 font-bold" 
              />
            </div>
          )}

          {formData.discount_type === 'bogo' && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block font-micro uppercase tracking-widest text-[9px] text-gray-600 mb-1">Buy Quantity</label>
                <input 
                  required 
                  type="number" 
                  min="1" 
                  value={formData.bogo_buy} 
                  onChange={e => setFormData({...formData, bogo_buy: Number(e.target.value)})} 
                  className="w-full border border-gray-200 rounded-xl p-3 outline-none focus:border-[var(--border-admin)] bg-gray-50/50 text-center font-bold" 
                />
              </div>
              <div>
                <label className="block font-micro uppercase tracking-widest text-[9px] text-gray-600 mb-1">Get Free Quantity</label>
                <input 
                  required 
                  type="number" 
                  min="1" 
                  value={formData.bogo_get} 
                  onChange={e => setFormData({...formData, bogo_get: Number(e.target.value)})} 
                  className="w-full border border-gray-200 rounded-xl p-3 outline-none focus:border-[var(--border-admin)] bg-gray-50/50 text-center font-bold" 
                />
              </div>
            </div>
          )}

          <div>
            <label className="block font-micro uppercase tracking-widest text-[9px] text-gray-600 mb-1">Applicable Target</label>
            <select 
              value={formData.target_type} 
              onChange={e => setFormData({...formData, target_type: e.target.value})} 
              className="w-full border border-gray-200 rounded-xl p-3 outline-none focus:border-[var(--border-admin)] bg-gray-50/50"
            >
              <option value="global">Global (All Products in Cart)</option>
              <option value="specific">Specific Product IDs Only</option>
            </select>
          </div>

          {formData.target_type === 'specific' && (
            <div>
              <label className="block font-micro uppercase tracking-widest text-[9px] text-gray-600 mb-1">Target Product IDs (comma-separated)</label>
              <input 
                type="text" 
                value={formData.target_products} 
                onChange={e => setFormData({...formData, target_products: e.target.value})} 
                className="w-full border border-gray-200 rounded-xl p-3 outline-none focus:border-[var(--border-admin)] bg-gray-50/50 font-mono" 
                placeholder="e.g. golden-blob-studs-, matilda-02" 
              />
            </div>
          )}

          <div className="flex items-center gap-2 pt-2">
            <input 
              type="checkbox" 
              id="isActivePromo" 
              checked={formData.is_active} 
              onChange={e => setFormData({...formData, is_active: e.target.checked})} 
              className="accent-[var(--border-admin)] w-4 h-4 rounded" 
            />
            <label htmlFor="isActivePromo" className="font-micro uppercase tracking-widest text-[9px] text-gray-700 cursor-pointer">
              Promo Code is Active &amp; Redeemable
            </label>
          </div>

          <div className="pt-4 border-t border-gray-100 flex gap-3">
            <button
              type="button"
              onClick={() => setIsModalOpen(false)}
              className="flex-1 py-3 border border-gray-200 rounded-full font-micro uppercase tracking-widest text-[10px] text-gray-600 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button 
              type="submit" 
              disabled={isSaving}
              className="flex-1 bg-[var(--border-admin)] text-white font-micro uppercase tracking-widest text-[10px] py-3 rounded-full hover:opacity-90 transition-opacity flex items-center justify-center gap-1.5 shadow-sm disabled:opacity-50"
            >
              {isSaving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              <span>{isSaving ? 'Saving...' : 'Save Promo'}</span>
            </button>
          </div>
        </form>
      </AdminModal>

      {/* Delete Promo Confirmation Modal */}
      <AdminConfirmModal
        isOpen={deletingIndex !== null}
        onClose={() => setDeletingIndex(null)}
        onConfirm={executeDelete}
        title="delete promo code?"
        message="This discount code will be removed from the store and will no longer be redeemable at checkout."
        confirmLabel="Delete Promo"
        isDestructive={true}
        loading={isSaving}
      />
    </div>
  );
};
