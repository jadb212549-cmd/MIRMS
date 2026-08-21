import React, { useState, useEffect } from 'react';
import { MasterItem, MaterialType, ItemStatus } from '../types';
import { X, Database, AlertCircle, Plus } from 'lucide-react';
import { db } from '../services/db';

interface MasterItemModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (item: Omit<MasterItem, 'id' | 'createdAt' | 'updatedAt'>) => Promise<{ success: boolean; error?: string }>;
  initialItem?: MasterItem | null;
}

export const MasterItemModal: React.FC<MasterItemModalProps> = ({
  isOpen,
  onClose,
  onSave,
  initialItem
}) => {
  const [productCode, setProductCode] = useState('');
  const [description, setDescription] = useState('');
  const [materialType, setMaterialType] = useState<MaterialType>('RM');
  const [category, setCategory] = useState<string>('Box');
  const [categoriesList, setCategoriesList] = useState<string[]>([]);
  const [isCustomCategory, setIsCustomCategory] = useState(false);
  const [customCategoryName, setCustomCategoryName] = useState('');
  const [status, setStatus] = useState<ItemStatus>('Active');
  const [unit, setUnit] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    const loadCategories = async () => {
      const cats = await db.getCategories();
      setCategoriesList(cats);
    };
    if (isOpen) {
      loadCategories();
    }
  }, [isOpen]);

  useEffect(() => {
    if (initialItem) {
      setProductCode(initialItem.productCode);
      setDescription(initialItem.description);
      setMaterialType(initialItem.materialType || 'RM');
      setCategory(initialItem.category || 'Box');
      setIsCustomCategory(false);
      setCustomCategoryName('');
      setStatus(initialItem.status);
      setUnit(initialItem.unit || '');
    } else {
      setProductCode('');
      setDescription('');
      setMaterialType('RM');
      setCategory('Box');
      setIsCustomCategory(false);
      setCustomCategoryName('');
      setStatus('Active');
      setUnit('');
    }
    setError(null);
  }, [initialItem, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!productCode.trim()) {
      setError('Product Code is required.');
      return;
    }
    if (!description.trim()) {
      setError('Description is required.');
      return;
    }

    const finalCategory = isCustomCategory ? customCategoryName.trim() : category.trim();
    if (!finalCategory) {
      setError('Category is required.');
      return;
    }

    setIsSaving(true);
    setError(null);

    const res = await onSave({
      productCode: productCode.trim(),
      description: description.trim(),
      materialType,
      category: finalCategory,
      status,
      unit: unit.trim() || undefined
    });

    setIsSaving(false);
    if (res.success) {
      onClose();
    } else {
      setError(res.error || 'Failed to save master item.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-[#161616] rounded-xl shadow-2xl border border-[#333] w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="bg-[#0A0A0A] text-white px-5 py-4 flex items-center justify-between border-b border-[#222]">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-[#1A1A1A] border border-[#2A2A2A] rounded-lg text-blue-400">
              <Database className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-gray-100">
                {initialItem ? 'Edit Master Item Reference' : 'Add New Master Reference Item'}
              </h3>
              <p className="text-xs text-gray-400">
                Baseline master material reference definition
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white p-1 rounded-md transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {error && (
            <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-400 text-xs rounded-lg flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Product Code */}
          <div>
            <label className="block text-xs font-bold text-gray-300 uppercase tracking-wider mb-1 font-mono">
              Product Code <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              required
              placeholder="e.g. RM-SS-304-001 or PS-GLOVE-NIT"
              value={productCode}
              onChange={(e) => setProductCode(e.target.value)}
              className="w-full text-xs px-3 py-2 bg-[#1A1A1A] border border-[#333] text-gray-200 rounded-lg focus:outline-hidden focus:border-blue-500 font-mono"
            />
            <p className="text-[11px] text-gray-500 mt-1">
              Unique identifier used as master reference code.
            </p>
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-bold text-gray-300 uppercase tracking-wider mb-1 font-mono">
              Description <span className="text-red-400">*</span>
            </label>
            <textarea
              required
              rows={3}
              placeholder="Full material/item description and grade"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full text-xs px-3 py-2 bg-[#1A1A1A] border border-[#333] text-gray-200 rounded-lg focus:outline-hidden focus:border-blue-500"
            />
          </div>

          {/* Material Type & Status Grid */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-gray-300 uppercase tracking-wider mb-1 font-mono">
                Material Type <span className="text-red-400">*</span>
              </label>
              <select
                value={materialType}
                onChange={(e) => setMaterialType(e.target.value as MaterialType)}
                className="w-full text-xs px-3 py-2 bg-[#1A1A1A] border border-[#333] text-gray-200 rounded-lg focus:outline-hidden focus:border-blue-500 font-medium cursor-pointer"
              >
                <option value="RM" className="bg-[#1A1A1A] text-gray-200">RM (Raw Material)</option>
                <option value="PS" className="bg-[#1A1A1A] text-gray-200">PS (Production Supply)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-300 uppercase tracking-wider mb-1 font-mono">
                Status <span className="text-red-400">*</span>
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as ItemStatus)}
                className="w-full text-xs px-3 py-2 bg-[#1A1A1A] border border-[#333] text-gray-200 rounded-lg focus:outline-hidden focus:border-blue-500 font-medium cursor-pointer"
              >
                <option value="Active" className="bg-[#1A1A1A] text-gray-200">Active</option>
                <option value="Inactive" className="bg-[#1A1A1A] text-gray-200">Inactive</option>
              </select>
            </div>
          </div>

          {/* Dynamic Category Selection / Addition */}
          <div>
            <label className="block text-xs font-bold text-gray-300 uppercase tracking-wider mb-1 font-mono flex items-center justify-between">
              <span>Category (e.g. Box, Tape, Metal, Chemicals) <span className="text-red-400">*</span></span>
              {!isCustomCategory ? (
                <button
                  type="button"
                  onClick={() => setIsCustomCategory(true)}
                  className="text-[10px] text-blue-400 hover:text-blue-300 flex items-center gap-1 font-sans font-medium"
                >
                  <Plus className="w-3 h-3" /> Add New Category
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setIsCustomCategory(false)}
                  className="text-[10px] text-gray-400 hover:text-gray-300 font-sans"
                >
                  Choose from List
                </button>
              )}
            </label>

            {!isCustomCategory ? (
              <select
                value={category}
                onChange={(e) => {
                  if (e.target.value === '__NEW__') {
                    setIsCustomCategory(true);
                  } else {
                    setCategory(e.target.value);
                  }
                }}
                className="w-full text-xs px-3 py-2 bg-[#1A1A1A] border border-[#333] text-gray-200 rounded-lg focus:outline-hidden focus:border-blue-500 font-medium cursor-pointer"
              >
                {categoriesList.map((cat) => (
                  <option key={cat} value={cat} className="bg-[#1A1A1A] text-gray-200">
                    {cat}
                  </option>
                ))}
                {!categoriesList.includes(category) && category && (
                  <option value={category} className="bg-[#1A1A1A] text-gray-200">{category}</option>
                )}
                <option value="__NEW__" className="bg-[#1A1A1A] text-blue-400">+ Add New Category...</option>
              </select>
            ) : (
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Enter new category (e.g. Box, Tape, Film, Resin)..."
                  value={customCategoryName}
                  onChange={(e) => setCustomCategoryName(e.target.value)}
                  className="w-full text-xs px-3 py-2 bg-[#1A1A1A] border border-blue-500/50 text-gray-100 rounded-lg focus:outline-hidden focus:border-blue-400"
                  autoFocus
                />
              </div>
            )}
            <p className="text-[11px] text-gray-500 mt-1">
              Customizable list of item categories.
            </p>
          </div>

          {/* Unit (Reference field only) */}
          <div>
            <label className="block text-xs font-bold text-gray-300 uppercase tracking-wider mb-1 font-mono">
              Unit (Reference Only)
            </label>
            <input
              type="text"
              placeholder="e.g. Sheet, Roll, Drum, Length, Box"
              value={unit}
              onChange={(e) => setUnit(e.target.value)}
              className="w-full text-xs px-3 py-2 bg-[#1A1A1A] border border-[#333] text-gray-200 rounded-lg focus:outline-hidden focus:border-blue-500"
            />
            <p className="text-[11px] text-gray-500 mt-1">
              Reference packaging description only. Zero inventory levels are tracked.
            </p>
          </div>

          {/* Actions */}
          <div className="pt-3 border-t border-[#222] flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-1.5 text-xs font-semibold text-gray-400 hover:text-gray-200 hover:bg-[#222] rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="px-4 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm transition-colors disabled:opacity-50"
            >
              {isSaving ? 'Saving...' : initialItem ? 'Save Changes' : 'Create Master Item'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
