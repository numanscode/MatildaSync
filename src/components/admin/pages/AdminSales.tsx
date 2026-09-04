import React, { useEffect, useState } from 'react';
import { Loader2, Megaphone, Check, AlertCircle } from 'lucide-react';
import { getSupabase } from '../../../lib/supabaseClient';
import { getAdminAuthHeaders } from '../../../lib/adminApi';
import { broadcastSync } from '../../../lib/syncChannel';
import { AdminStatCard } from '../shared/AdminStatCard';
import { AdminBadge } from '../shared/AdminBadge';

export const AdminSales: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saleActive, setSaleActive] = useState(false);
  const [saleText, setSaleText] = useState('END OF SEASON SALE: UP TO 50% OFF');
  const [saleDiscountPercent, setSaleDiscountPercent] = useState(0);
  const [saleType, setSaleType] = useState('percentage');
  const [saleDiscountAmount, setSaleDiscountAmount] = useState(0);

  useEffect(() => {
    const loadStoreSettings = async () => {
      let settingsObj: Record<string, any> = {};

      // 1. Supabase
      try {
        const client = getSupabase();
        const { data: storeData } = await client.from('store_settings').select('*');
        if (Array.isArray(storeData)) {
          const found = storeData.find(s => s.id === 'sale' || s.id === 'current');
          if (found) settingsObj = found;
        }
      } catch (e) {
        console.warn("Supabase load sale settings notice:", e);
      }

      // 2. Express Backend API
      if (Object.keys(settingsObj).length === 0) {
        try {
          const res = await fetch('/api/store/settings');
          if (res.ok) {
            settingsObj = await res.json();
          }
        } catch (e) {}
      }

      // 3. LocalStorage
      if (Object.keys(settingsObj).length === 0) {
        try {
          const local = localStorage.getItem('matilda_store_settings');
          if (local) settingsObj = JSON.parse(local);
        } catch (e) {}
      }

      if (settingsObj.sale_active !== undefined) setSaleActive(settingsObj.sale_active === 'true' || settingsObj.sale_active === true);
      if (settingsObj.sale_text) setSaleText(settingsObj.sale_text);
      if (settingsObj.sale_discount_percent) setSaleDiscountPercent(Number(settingsObj.sale_discount_percent));
      if (settingsObj.sale_type) setSaleType(settingsObj.sale_type);
      if (settingsObj.sale_discount_amount) setSaleDiscountAmount(Number(settingsObj.sale_discount_amount));

      setLoading(false);
    };

    loadStoreSettings();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setSaveSuccess(false);
    const settings = {
      sale_active: saleActive.toString(),
      sale_text: saleText,
      sale_discount_percent: saleDiscountPercent.toString(),
      sale_type: saleType,
      sale_discount_amount: saleDiscountAmount.toString()
    };

    // 1. Supabase
    try {
      const client = getSupabase();
      await client.from('store_settings').upsert({
        id: 'sale',
        ...settings,
        updated_at: new Date().toISOString()
      }, { onConflict: 'id' });
    } catch (e) {
      console.warn("Supabase upsert settings notice:", e);
    }

    // 2. Express Backend API
    try {
      for (const [key, value] of Object.entries(settings)) {
        await fetch('/api/admin/settings', {
          method: 'PUT',
          headers: getAdminAuthHeaders(),
          credentials: 'include',
          body: JSON.stringify({ key, value })
        });
      }
    } catch (e) {}

    // 3. LocalStorage
    try {
      localStorage.setItem('matilda_store_settings', JSON.stringify(settings));
    } catch (e) {}

    // Broadcast update across all open tabs & window listeners
    broadcastSync({ type: 'SETTINGS_UPDATED', timestamp: Date.now() });
    try {
      window.dispatchEvent(new CustomEvent('matilda-settings-updated'));
    } catch (e) {}

    setSaving(false);
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 3000);
  };

  if (loading) {
    return (
      <div className="p-16 flex flex-col items-center justify-center">
        <Loader2 className="animate-spin text-[var(--border-admin)] w-8 h-8 mb-2" />
        <p className="font-micro uppercase tracking-widest text-xs text-gray-400">Loading store sale settings...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div>
        <h2 className="font-display text-2xl font-bold lowercase tracking-tighter">store sales &amp; announcements.</h2>
        <p className="font-micro uppercase tracking-widest text-[10px] text-gray-500 mt-0.5">
          control site-wide top announcement banners and automatic global shopping bag discounts
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <AdminStatCard 
          label="Sale Status" 
          value={saleActive ? "Live Campaign" : "Disabled"} 
          subValue={saleActive ? "Banner actively showing" : "No discount active"}
          className={saleActive ? "border-emerald-300 bg-emerald-50/40" : ""}
        />
        <AdminStatCard 
          label="Discount Type" 
          value={saleType === 'percentage' ? `${saleDiscountPercent}% Off` : `₹${saleDiscountAmount} Off`} 
          subValue="Applied at basket"
        />
        <AdminStatCard 
          label="Broadcast Reach" 
          value="All Visitors" 
          subValue="Top ticker banner"
        />
      </div>

      {/* Main Settings Card */}
      <div className="bg-white/80 backdrop-blur-md rounded-3xl p-6 sm:p-8 border border-[var(--border-admin-subtle)] shadow-xs space-y-6">
        
        {/* Toggle Active Switch */}
        <div className="flex items-center justify-between border-b border-gray-100 pb-6">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-sm text-gray-900">Site-Wide Sale Active</h3>
              <AdminBadge variant={saleActive ? 'active' : 'inactive'}>
                {saleActive ? 'Live' : 'Paused'}
              </AdminBadge>
            </div>
            <p className="text-xs text-gray-500 mt-1">Enable to broadcast announcement banner on the storefront and apply universal checkout markdown.</p>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input 
              type="checkbox" 
              checked={saleActive} 
              onChange={e => setSaleActive(e.target.checked)} 
              className="sr-only peer" 
            />
            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[var(--border-admin)]"></div>
          </label>
        </div>

        {/* Live Preview of Banner */}
        {saleActive && (
          <div className="p-3.5 rounded-2xl bg-[var(--border-admin)] text-white flex items-center justify-between text-xs shadow-xs font-body">
            <div className="flex items-center gap-2 font-micro uppercase tracking-wider text-[11px] truncate">
              <Megaphone className="w-4 h-4 shrink-0 text-amber-300" />
              <span className="truncate">{saleText || 'END OF SEASON SALE: UP TO 50% OFF'}</span>
            </div>
            <span className="font-micro uppercase text-[9px] tracking-widest bg-white/20 px-2 py-0.5 rounded-full shrink-0">
              Live Preview
            </span>
          </div>
        )}

        {/* Configuration Form */}
        <div className="space-y-5 font-body text-xs">
          <div>
            <label className="block font-micro uppercase tracking-widest text-[9px] text-gray-600 mb-1.5">Announcement Banner Text</label>
            <input 
              type="text" 
              value={saleText} 
              onChange={e => setSaleText(e.target.value)} 
              className="w-full border border-gray-200 rounded-xl p-3 outline-none focus:border-[var(--border-admin)] bg-gray-50/50 text-xs text-gray-900 font-medium"
              placeholder="e.g. END OF SEASON SALE: 20% OFF ALL JEWELLERY"
            />
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block font-micro uppercase tracking-widest text-[9px] text-gray-600 mb-1.5">Discount Type</label>
              <select 
                value={saleType} 
                onChange={e => setSaleType(e.target.value)} 
                className="w-full border border-gray-200 rounded-xl p-3 outline-none focus:border-[var(--border-admin)] bg-gray-50/50 text-xs text-gray-900 font-medium"
              >
                <option value="percentage">Percentage Markdown (%)</option>
                <option value="fixed">Fixed Cash Markdown (₹)</option>
              </select>
            </div>
            
            {saleType === 'percentage' ? (
              <div>
                <label className="block font-micro uppercase tracking-widest text-[9px] text-gray-600 mb-1.5">Global Markdown Percentage (%)</label>
                <input 
                  type="number" 
                  value={saleDiscountPercent} 
                  onChange={e => setSaleDiscountPercent(Number(e.target.value))} 
                  className="w-full border border-gray-200 rounded-xl p-3 outline-none focus:border-[var(--border-admin)] bg-gray-50/50 text-xs font-bold text-gray-900"
                  placeholder="e.g. 20"
                  min="0" max="100"
                />
              </div>
            ) : (
              <div>
                <label className="block font-micro uppercase tracking-widest text-[9px] text-gray-600 mb-1.5">Global Markdown Amount (₹)</label>
                <input 
                  type="number" 
                  value={saleDiscountAmount} 
                  onChange={e => setSaleDiscountAmount(Number(e.target.value))} 
                  className="w-full border border-gray-200 rounded-xl p-3 outline-none focus:border-[var(--border-admin)] bg-gray-50/50 text-xs font-bold text-gray-900"
                  placeholder="e.g. 500"
                  min="0"
                />
              </div>
            )}
          </div>
        </div>

        {/* Save Bar */}
        <div className="pt-4 border-t border-gray-100 flex items-center justify-between gap-4">
          <span className="font-micro uppercase tracking-widest text-[9px] text-gray-400">
            Changes sync directly to Supabase, LocalStorage, and Express API
          </span>
          <div className="flex items-center gap-3">
            {saveSuccess && (
              <span className="font-micro uppercase tracking-widest text-[10px] text-emerald-600 flex items-center gap-1 font-bold">
                <Check className="w-3.5 h-3.5" /> Saved successfully
              </span>
            )}
            <button 
              onClick={handleSave}
              disabled={saving}
              className="bg-[var(--border-admin)] text-white font-micro uppercase tracking-widest text-[10px] px-8 py-3.5 rounded-full hover:opacity-90 transition-opacity flex items-center gap-2 shadow-xs disabled:opacity-50 font-bold"
            >
              {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              <span>{saving ? 'Saving...' : 'Save Configuration'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
