import React, { useState } from 'react';
import { useCollection } from '../../../context/CollectionContext';
import { Pencil, Trash2, Plus, Loader2 } from 'lucide-react';
import { AdminModal } from '../shared/AdminModal';
import { AdminConfirmModal } from '../shared/AdminConfirmModal';
import { AdminSearch } from '../shared/AdminSearch';
import { AdminStatCard } from '../shared/AdminStatCard';

export const AdminCategories: React.FC = () => {
  const { categories, addCategory, updateCategory, removeCategory, resetCategoriesToDefault } = useCollection();
  
  const [searchQuery, setSearchQuery] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [editingCat, setEditingCat] = useState<any>(null);
  const [formData, setFormData] = useState({ name: '', slug: '', description: '' });

  // Custom confirmation modals state
  const [confirmDeleteCat, setConfirmDeleteCat] = useState<any>(null);
  const [isConfirmClearAllOpen, setIsConfirmClearAllOpen] = useState(false);

  const handleOpenModal = (cat: any = null) => {
    if (cat) {
      setEditingCat(cat);
      setFormData({ name: cat.name, slug: cat.slug, description: cat.description || '' });
    } else {
      setEditingCat(null);
      setFormData({ name: '', slug: '', description: '' });
    }
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      if (editingCat) {
        await updateCategory({
          ...editingCat,
          ...formData,
          oldSlug: editingCat.slug
        });
      } else {
        await addCategory({
          id: `cat-${Date.now()}`,
          ...formData
        });
      }
      setIsModalOpen(false);
    } catch (err) {
      console.error("Failed to save category:", err);
    } finally {
      setIsSaving(false);
    }
  };

  const executeDelete = async () => {
    if (!confirmDeleteCat) return;
    setDeletingId(confirmDeleteCat.id);
    try {
      await removeCategory(confirmDeleteCat.id, confirmDeleteCat.slug);
      setConfirmDeleteCat(null);
    } catch (err) {
      console.error("Failed to delete category:", err);
    } finally {
      setDeletingId(null);
    }
  };

  const executeClearAll = async () => {
    setIsConfirmClearAllOpen(false);
    try {
      await resetCategoriesToDefault();
    } catch (err) {
      console.error("Failed to clear categories:", err);
    }
  };

  const filteredCategories = categories.filter(c => 
    c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.slug.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (c.description && c.description.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="font-display text-2xl font-bold lowercase tracking-tighter">categories.</h2>
          <p className="font-micro uppercase tracking-widest text-[10px] text-gray-500 mt-0.5">
            organize navigation categories and studio collections
          </p>
        </div>
        <div className="flex items-center gap-2">
          {categories.length > 0 && (
            <button 
              onClick={() => setIsConfirmClearAllOpen(true)} 
              className="px-4 py-2 text-[10px] font-micro uppercase tracking-widest text-red-600 hover:text-red-700 hover:bg-red-50 border border-red-200 rounded-full transition-colors flex items-center gap-1.5"
            >
              <Trash2 className="w-3.5 h-3.5" /> Clear All
            </button>
          )}
          <button 
            onClick={() => handleOpenModal()} 
            className="bg-[var(--border-admin)] text-white font-micro uppercase tracking-widest text-[10px] px-6 py-2.5 rounded-full shadow-md hover:opacity-90 transition-all flex items-center gap-1.5"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>new category</span>
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <AdminStatCard label="Total Categories" value={categories.length} subValue="Organized departments" />
        <AdminStatCard label="Filtered Matches" value={filteredCategories.length} subValue="Active search view" />
        <AdminStatCard label="Navigation Scope" value="Live Store" subValue="Header & footer synced" />
      </div>

      {/* Search Bar */}
      <div className="bg-white/80 backdrop-blur-md border border-[var(--border-admin-subtle)] rounded-2xl p-4 flex items-center justify-between shadow-xs">
        <div className="w-full max-w-md">
          <AdminSearch
            value={searchQuery}
            onChange={setSearchQuery}
            placeholder="Search categories by name, slug, description..."
          />
        </div>
      </div>

      {/* Categories Table */}
      <div className="bg-white/80 backdrop-blur-md border border-[var(--border-admin-subtle)] rounded-3xl overflow-hidden shadow-xs">
        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full text-left font-body text-xs min-w-[600px]">
            <thead className="bg-[var(--border-admin-subtle)]/40 border-b border-[var(--border-admin-subtle)] font-micro text-[9px] uppercase tracking-widest text-gray-600">
              <tr>
                <th className="px-6 py-4">Name</th>
                <th className="px-6 py-4">Slug</th>
                <th className="px-6 py-4">Description</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredCategories.map((cat) => (
                <tr key={cat.id} className="hover:bg-white transition-colors">
                  <td className="px-6 py-4 font-bold text-sm text-gray-900">{cat.name}</td>
                  <td className="px-6 py-4 font-mono text-xs text-gray-500">{cat.slug}</td>
                  <td className="px-6 py-4 text-gray-500 text-xs truncate max-w-[280px]">
                    {cat.description || <span className="italic text-gray-400">No description</span>}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex justify-end gap-2">
                      <button 
                        onClick={() => handleOpenModal(cat)} 
                        className="p-1.5 text-gray-500 hover:text-[var(--border-admin)] hover:bg-gray-100 rounded-lg transition-colors"
                        title="Edit"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button 
                        disabled={deletingId === cat.id}
                        onClick={() => setConfirmDeleteCat(cat)} 
                        className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
                        title="Delete"
                      >
                        {deletingId === cat.id ? <Loader2 className="w-4 h-4 animate-spin text-red-500" /> : <Trash2 className="w-4 h-4" />}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filteredCategories.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-6 py-12 text-center text-gray-400 uppercase tracking-widest text-xs font-micro">
                    No categories found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Edit / New Category Modal */}
      <AdminModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingCat ? 'edit category' : 'new category'}
        subtitle={editingCat ? `editing ${editingCat.name}` : 'create a department'}
        maxWidth="md"
      >
        <form onSubmit={handleSave} className="space-y-4 font-body text-xs">
          <div>
            <label className="block font-micro uppercase tracking-widest text-[9px] text-gray-600 mb-1">Category Name</label>
            <input 
              required 
              type="text" 
              value={formData.name} 
              onChange={e => setFormData({ ...formData, name: e.target.value })} 
              className="w-full border border-gray-200 rounded-xl p-3 outline-none focus:border-[var(--border-admin)] text-xs text-gray-900 bg-gray-50/50" 
              placeholder="e.g. Earrings"
            />
          </div>
          <div>
            <label className="block font-micro uppercase tracking-widest text-[9px] text-gray-600 mb-1">Slug (URL key)</label>
            <input 
              type="text" 
              value={formData.slug} 
              onChange={e => setFormData({ ...formData, slug: e.target.value.toLowerCase().replace(/\s+/g, '-') })} 
              placeholder="e.g. earrings" 
              className="w-full border border-gray-200 rounded-xl p-3 outline-none focus:border-[var(--border-admin)] text-xs text-gray-900 bg-gray-50/50 font-mono" 
            />
          </div>
          <div>
            <label className="block font-micro uppercase tracking-widest text-[9px] text-gray-600 mb-1">Description</label>
            <textarea 
              rows={3} 
              value={formData.description} 
              onChange={e => setFormData({ ...formData, description: e.target.value })} 
              className="w-full border border-gray-200 rounded-xl p-3 outline-none focus:border-[var(--border-admin)] text-xs text-gray-900 bg-gray-50/50 resize-none" 
              placeholder="Describe this category's aesthetic or contents..."
            />
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
              <span>{isSaving ? 'Saving...' : 'Save Category'}</span>
            </button>
          </div>
        </form>
      </AdminModal>

      {/* Delete Single Category Confirmation Modal */}
      <AdminConfirmModal
        isOpen={!!confirmDeleteCat}
        onClose={() => setConfirmDeleteCat(null)}
        onConfirm={executeDelete}
        title={`delete "${confirmDeleteCat?.name}"?`}
        message="This category will be permanently removed. Products currently under this category will remain, but will need to be reassigned."
        confirmLabel="Delete Category"
        isDestructive={true}
        loading={!!deletingId}
      />

      {/* Clear All Confirmation Modal */}
      <AdminConfirmModal
        isOpen={isConfirmClearAllOpen}
        onClose={() => setIsConfirmClearAllOpen(false)}
        onConfirm={executeClearAll}
        title="reset all categories?"
        message="Are you sure you want to reset all categories back to default studio presets? Custom created categories will be removed."
        confirmLabel="Reset to Default"
        isDestructive={true}
      />
    </div>
  );
};
