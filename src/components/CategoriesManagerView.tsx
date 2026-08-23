import React, { useState, useEffect, useMemo } from 'react';
import { MasterItem, ReferenceRegistration, AppConfig } from '../types';
import {
  Layers,
  Download,
  Trash2,
  Plus,
  Search,
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
  FileSpreadsheet,
  FileText,
  Filter,
  Check,
  X,
  ShieldAlert,
  Sparkles,
  Tag,
  Boxes,
  Database,
  ArrowRight
} from 'lucide-react';
import { db } from '../services/db';
import { excelService } from '../services/excelService';
import { tauriBridge } from '../services/tauriService';
import { DEFAULT_CATEGORIES } from '../services/defaultData';

interface CategoriesManagerViewProps {
  config: AppConfig;
  masterItems: MasterItem[];
  registrations: ReferenceRegistration[];
  onRefreshData: () => Promise<void>;
  onConfigChange?: (newConfig: Partial<AppConfig>) => Promise<void>;
  onNotify?: (title: string, message: string, type?: 'success' | 'error' | 'info') => void;
}

export const CategoriesManagerView: React.FC<CategoriesManagerViewProps> = ({
  config,
  masterItems,
  registrations,
  onRefreshData,
  onNotify
}) => {
  const [categories, setCategories] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [newCategoryName, setNewCategoryName] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);

  // Deletion modal state for single category
  const [categoryToDelete, setCategoryToDelete] = useState<{
    name: string;
    masterCount: number;
    regCount: number;
  } | null>(null);
  const [unlinkSingleOnDelete, setUnlinkSingleOnDelete] = useState(false);
  const [isDeletingSingle, setIsDeletingSingle] = useState(false);

  // Deletion modal state for ALL categories
  const [showDeleteAllModal, setShowDeleteAllModal] = useState(false);
  const [deleteAllConfirmText, setDeleteAllConfirmText] = useState('');
  const [unlinkAllOnDelete, setUnlinkAllOnDelete] = useState(false);
  const [isDeletingAll, setIsDeletingAll] = useState(false);

  // Reset defaults modal state
  const [showResetModal, setShowResetModal] = useState(false);
  const [isResetting, setIsResetting] = useState(false);

  // Load categories from database
  const loadCategories = async () => {
    try {
      const cats = await db.getCategories();
      setCategories(cats);
    } catch (err: any) {
      console.error('Failed to load categories:', err);
    }
  };

  useEffect(() => {
    loadCategories();
  }, [config]);

  // Calculate usage stats per category
  const categoryStats = useMemo(() => {
    return categories.map((cat) => {
      const clean = cat.trim().toLowerCase();
      const masterCount = masterItems.filter(
        (m) => m.category && m.category.trim().toLowerCase() === clean
      ).length;
      const regCount = registrations.filter(
        (r) => r.category && r.category.trim().toLowerCase() === clean
      ).length;
      const totalUsage = masterCount + regCount;

      return {
        name: cat,
        masterCount,
        regCount,
        totalUsage,
        isInUse: totalUsage > 0
      };
    });
  }, [categories, masterItems, registrations]);

  // Filtered list based on search
  const filteredCategoryStats = useMemo(() => {
    if (!searchQuery.trim()) return categoryStats;
    const q = searchQuery.trim().toLowerCase();
    return categoryStats.filter((c) => c.name.toLowerCase().includes(q));
  }, [categoryStats, searchQuery]);

  // Overall KPI stats
  const totalCategoriesCount = categories.length;
  const inUseCategoriesCount = categoryStats.filter((c) => c.isInUse).length;
  const unusedCategoriesCount = categoryStats.filter((c) => !c.isInUse).length;
  const topCategory = [...categoryStats].sort((a, b) => b.totalUsage - a.totalUsage)[0];

  // Handler: Add new category
  const handleAddCategory = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const clean = newCategoryName.trim();
    if (!clean) {
      setErrorMessage('Category name cannot be empty.');
      return;
    }

    if (categories.some((c) => c.toLowerCase() === clean.toLowerCase())) {
      setErrorMessage(`Category "${clean}" already exists.`);
      return;
    }

    setIsAdding(true);
    setErrorMessage(null);

    try {
      const res = await db.addCategory(clean);
      if (!res.success) {
        setErrorMessage(res.error || 'Failed to add category.');
      } else {
        setNewCategoryName('');
        setCategories(res.categories);
        setStatusMessage({
          type: 'success',
          text: `Category "${clean}" added successfully.`
        });
        if (onNotify) onNotify('Category Created', `Category "${clean}" was registered.`, 'success');
        await onRefreshData();
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'Error adding category.');
    } finally {
      setIsAdding(false);
    }
  };

  // Handler: Confirm single delete
  const handleConfirmDeleteSingle = async () => {
    if (!categoryToDelete) return;
    setIsDeletingSingle(true);

    try {
      const res = await db.deleteCategory(categoryToDelete.name, unlinkSingleOnDelete);
      if (res.success) {
        setCategories(res.categories);
        setStatusMessage({
          type: 'success',
          text: `Category "${categoryToDelete.name}" was deleted${
            unlinkSingleOnDelete && res.affectedCount ? ` (unlinked from ${res.affectedCount} items/records)` : ''
          }.`
        });
        if (onNotify) {
          onNotify(
            'Category Deleted',
            `Category "${categoryToDelete.name}" was removed.`,
            'info'
          );
        }
        await onRefreshData();
        setCategoryToDelete(null);
        setUnlinkSingleOnDelete(false);
      }
    } catch (err: any) {
      setStatusMessage({
        type: 'error',
        text: `Failed to delete category: ${err?.message || 'Unknown error'}`
      });
    } finally {
      setIsDeletingSingle(false);
    }
  };

  // Handler: Confirm delete ALL categories
  const handleConfirmDeleteAll = async () => {
    if (deleteAllConfirmText.trim().toUpperCase() !== 'DELETE') {
      return;
    }

    setIsDeletingAll(true);
    try {
      const res = await db.deleteAllCategories(unlinkAllOnDelete);
      if (res.success) {
        setCategories([]);
        setStatusMessage({
          type: 'success',
          text: `All categories have been deleted${
            unlinkAllOnDelete && res.affectedCount ? ` (unlinked from ${res.affectedCount} records)` : ''
          }.`
        });
        if (onNotify) {
          onNotify('All Categories Cleared', 'All configured category classifications were deleted.', 'info');
        }
        await onRefreshData();
        setShowDeleteAllModal(false);
        setDeleteAllConfirmText('');
        setUnlinkAllOnDelete(false);
      }
    } catch (err: any) {
      setStatusMessage({
        type: 'error',
        text: `Failed to delete all categories: ${err?.message || 'Unknown error'}`
      });
    } finally {
      setIsDeletingAll(false);
    }
  };

  // Handler: Reset to factory defaults
  const handleConfirmResetDefaults = async () => {
    setIsResetting(true);
    try {
      const res = await db.resetDefaultCategories();
      if (res.success) {
        setCategories(res.categories);
        setStatusMessage({
          type: 'success',
          text: `Restored ${DEFAULT_CATEGORIES.length} factory default categories successfully.`
        });
        if (onNotify) {
          onNotify('Defaults Restored', 'Standard manufacturing categories reloaded.', 'success');
        }
        await onRefreshData();
        setShowResetModal(false);
      }
    } catch (err: any) {
      setStatusMessage({
        type: 'error',
        text: `Failed to restore defaults: ${err?.message || 'Unknown error'}`
      });
    } finally {
      setIsResetting(false);
    }
  };

  // Handler: Export to Excel
  const handleExportExcel = () => {
    try {
      excelService.exportCategories(categories, masterItems, registrations);
      setStatusMessage({
        type: 'success',
        text: `Categories list (${categories.length} categories) exported to Excel successfully.`
      });
      if (onNotify) onNotify('Export Complete', 'Categories spreadsheet downloaded.', 'success');
    } catch (err: any) {
      setStatusMessage({
        type: 'error',
        text: `Export failed: ${err?.message || 'Error creating Excel sheet'}`
      });
    }
  };

  // Handler: Export to JSON
  const handleExportJson = () => {
    try {
      const dataToExport = {
        exportDate: new Date().toISOString(),
        totalCategories: categories.length,
        categories: categoryStats
      };
      const blob = new Blob([JSON.stringify(dataToExport, null, 2)], {
        type: 'application/json'
      });
      tauriBridge.saveFileBlob(
        blob,
        `Categories_Export_${new Date().toISOString().split('T')[0]}.json`
      );
      setStatusMessage({
        type: 'success',
        text: 'Categories JSON archive downloaded successfully.'
      });
    } catch (err: any) {
      setStatusMessage({
        type: 'error',
        text: `JSON export failed: ${err?.message || 'Error'}`
      });
    }
  };

  return (
    <div className="bg-[#141414] rounded-2xl border border-[#222] p-6 shadow-xl space-y-6 animate-in fade-in duration-150">
      {/* Header & Main Actions */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 pb-4 border-b border-[#222]">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-amber-500/10 border border-amber-500/20 text-amber-400 rounded-xl">
            <Layers className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-white">Item & Specimen Categories Management</h2>
              <span className="px-2 py-0.5 bg-amber-500/20 border border-amber-500/30 text-amber-300 text-[11px] font-bold rounded-full font-mono">
                {totalCategoriesCount} Categories
              </span>
            </div>
            <p className="text-xs text-gray-400">
              Manage classification taxonomy for Raw Materials (RM), Production Supplies (PS), and reference samples
            </p>
          </div>
        </div>

        {/* Top Header Buttons: Export, Reset, Delete All */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Export to Excel */}
          <button
            onClick={handleExportExcel}
            disabled={categories.length === 0}
            className="px-3.5 py-2 bg-emerald-600/90 hover:bg-emerald-500 disabled:opacity-40 text-white text-xs font-bold rounded-xl shadow-xs transition-all flex items-center gap-2 cursor-pointer"
            title="Export full categories list with active usage metrics to Excel (.xlsx)"
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>Export Categories (.xlsx)</span>
          </button>

          {/* Export to JSON */}
          <button
            onClick={handleExportJson}
            disabled={categories.length === 0}
            className="px-3 py-2 bg-[#222] hover:bg-[#2A2A2A] text-gray-300 hover:text-white disabled:opacity-40 text-xs font-semibold rounded-xl border border-[#333] transition-all flex items-center gap-1.5 cursor-pointer"
            title="Export Categories taxonomy metadata to JSON"
          >
            <Download className="w-3.5 h-3.5 text-blue-400" />
            <span>JSON</span>
          </button>

          {/* Reset to Default Categories */}
          <button
            onClick={() => setShowResetModal(true)}
            className="px-3 py-2 bg-[#222] hover:bg-[#2A2A2A] text-gray-300 hover:text-white text-xs font-semibold rounded-xl border border-[#333] transition-all flex items-center gap-1.5 cursor-pointer"
            title="Restore standard factory baseline categories (Box, Tape, Packaging, etc.)"
          >
            <RefreshCw className="w-3.5 h-3.5 text-gray-400" />
            <span>Reset Defaults</span>
          </button>

          {/* Delete ALL Categories Danger Button */}
          <button
            onClick={() => {
              setDeleteAllConfirmText('');
              setUnlinkAllOnDelete(false);
              setShowDeleteAllModal(true);
            }}
            disabled={categories.length === 0}
            className="px-3.5 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 hover:text-red-300 disabled:opacity-40 text-xs font-bold rounded-xl border border-red-500/30 transition-all flex items-center gap-1.5 cursor-pointer"
            title="Delete all categories from configuration"
          >
            <Trash2 className="w-4 h-4 text-red-400" />
            <span>Delete All Categories</span>
          </button>
        </div>
      </div>

      {/* Notification status banner */}
      {statusMessage && (
        <div
          className={`p-3.5 rounded-xl border flex items-center justify-between text-xs animate-in fade-in duration-150 ${
            statusMessage.type === 'success'
              ? 'bg-green-500/10 border-green-500/30 text-green-300'
              : statusMessage.type === 'error'
              ? 'bg-red-500/10 border-red-500/30 text-red-300'
              : 'bg-blue-500/10 border-blue-500/30 text-blue-300'
          }`}
        >
          <div className="flex items-center gap-2">
            {statusMessage.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-green-400 shrink-0" />
            ) : statusMessage.type === 'error' ? (
              <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
            ) : (
              <Layers className="w-4 h-4 text-blue-400 shrink-0" />
            )}
            <span>{statusMessage.text}</span>
          </div>
          <button
            onClick={() => setStatusMessage(null)}
            className="text-gray-400 hover:text-white p-1 rounded-lg"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* KPI Overview Metrics Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5">
        <div className="p-4 bg-[#1A1A1A] border border-[#2A2A2A] rounded-xl">
          <div className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Total Categories</div>
          <div className="text-2xl font-bold font-mono text-white mt-1">{totalCategoriesCount}</div>
          <div className="text-[10px] text-gray-500 mt-0.5">Configured classifications</div>
        </div>

        <div className="p-4 bg-[#1A1A1A] border border-[#2A2A2A] rounded-xl">
          <div className="text-[11px] font-bold text-emerald-400 uppercase tracking-wider">In Active Use</div>
          <div className="text-2xl font-bold font-mono text-emerald-300 mt-1">{inUseCategoriesCount}</div>
          <div className="text-[10px] text-gray-500 mt-0.5">Linked to items or registrations</div>
        </div>

        <div className="p-4 bg-[#1A1A1A] border border-[#2A2A2A] rounded-xl">
          <div className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Unused Categories</div>
          <div className="text-2xl font-bold font-mono text-gray-300 mt-1">{unusedCategoriesCount}</div>
          <div className="text-[10px] text-gray-500 mt-0.5">Ready for new items</div>
        </div>

        <div className="p-4 bg-[#1A1A1A] border border-[#2A2A2A] rounded-xl">
          <div className="text-[11px] font-bold text-amber-400 uppercase tracking-wider">Most Referenced</div>
          <div className="text-sm font-bold text-amber-300 mt-1.5 truncate">
            {topCategory && topCategory.totalUsage > 0 ? topCategory.name : 'None yet'}
          </div>
          <div className="text-[10px] text-gray-500 mt-0.5">
            {topCategory && topCategory.totalUsage > 0 ? `${topCategory.totalUsage} active references` : 'No usage data'}
          </div>
        </div>
      </div>

      {/* Quick Add Category & Search Bar */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center">
        {/* Add Category Form (7 cols) */}
        <form onSubmit={handleAddCategory} className="md:col-span-7 flex items-center gap-2">
          <div className="relative flex-1">
            <Tag className="w-4 h-4 text-gray-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={newCategoryName}
              onChange={(e) => {
                setNewCategoryName(e.target.value);
                if (errorMessage) setErrorMessage(null);
              }}
              placeholder="Enter new category name (e.g. Shrink Wrap, Stainless Foil, Cap Seal)..."
              className="w-full pl-9 pr-3.5 py-2.5 bg-[#1C1C1C] border border-[#333] text-white text-xs rounded-xl focus:outline-hidden focus:border-amber-500 font-medium placeholder-gray-500"
            />
          </div>
          <button
            type="submit"
            disabled={isAdding || !newCategoryName.trim()}
            className="px-4 py-2.5 bg-amber-600 hover:bg-amber-500 disabled:opacity-40 text-white text-xs font-bold rounded-xl shadow-xs transition-all flex items-center gap-2 shrink-0 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Add Category</span>
          </button>
        </form>

        {/* Search Input (5 cols) */}
        <div className="md:col-span-5 relative">
          <Search className="w-4 h-4 text-gray-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search categories taxonomy..."
            className="w-full pl-9 pr-8 py-2.5 bg-[#1C1C1C] border border-[#333] text-white text-xs rounded-xl focus:outline-hidden focus:border-blue-500 font-medium placeholder-gray-500"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white p-1"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Error message */}
      {errorMessage && (
        <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-300 text-xs flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Categories Table / List */}
      <div className="bg-[#181818] rounded-xl border border-[#282828] overflow-hidden">
        {filteredCategoryStats.length === 0 ? (
          <div className="p-12 text-center text-gray-400 space-y-3">
            <Layers className="w-10 h-10 mx-auto text-gray-600" />
            <div className="text-sm font-semibold text-gray-300">
              {searchQuery ? `No categories match "${searchQuery}"` : 'No categories configured'}
            </div>
            <p className="text-xs text-gray-500 max-w-md mx-auto">
              {searchQuery
                ? 'Try a different keyword or clear the search query.'
                : 'Click "Add Category" above or "Reset Defaults" to populate standard industrial material classifications.'}
            </p>
            {!searchQuery && (
              <button
                onClick={() => setShowResetModal(true)}
                className="mt-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-xl transition-all inline-flex items-center gap-2 cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Load Default Categories</span>
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#1F1F1F] text-gray-400 font-bold border-b border-[#2C2C2C] uppercase text-[10px] tracking-wider">
                <tr>
                  <th className="py-3 px-4 w-12 text-center">#</th>
                  <th className="py-3 px-4">Category Name</th>
                  <th className="py-3 px-4 text-center">Master Catalog Items</th>
                  <th className="py-3 px-4 text-center">Registered QA Samples</th>
                  <th className="py-3 px-4 text-center">Total Reference Links</th>
                  <th className="py-3 px-4 text-center">Usage Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#262626]">
                {filteredCategoryStats.map((item, idx) => (
                  <tr
                    key={item.name}
                    className="hover:bg-[#1E1E1E] transition-colors group"
                  >
                    <td className="py-3 px-4 text-center font-mono text-gray-500 text-[11px]">
                      {idx + 1}
                    </td>
                    <td className="py-3 px-4 font-semibold text-white">
                      <div className="flex items-center gap-2">
                        <Tag className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                        <span>{item.name}</span>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-center font-mono">
                      {item.masterCount > 0 ? (
                        <span className="px-2 py-0.5 bg-blue-500/10 text-blue-400 border border-blue-500/20 rounded-md font-semibold">
                          {item.masterCount} items
                        </span>
                      ) : (
                        <span className="text-gray-500 font-sans">-</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-center font-mono">
                      {item.regCount > 0 ? (
                        <span className="px-2 py-0.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-md font-semibold">
                          {item.regCount} samples
                        </span>
                      ) : (
                        <span className="text-gray-500 font-sans">-</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-center font-mono">
                      <span className="text-gray-300 font-bold">{item.totalUsage}</span>
                    </td>
                    <td className="py-3 px-4 text-center">
                      {item.isInUse ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                          <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                          <span>Active ({item.totalUsage})</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-medium bg-gray-800 text-gray-400 border border-gray-700">
                          <span>Unused</span>
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {/* Delete Single Category */}
                        <button
                          onClick={() => {
                            setUnlinkSingleOnDelete(false);
                            setCategoryToDelete({
                              name: item.name,
                              masterCount: item.masterCount,
                              regCount: item.regCount
                            });
                          }}
                          className="p-1.5 text-gray-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors cursor-pointer"
                          title={`Delete category "${item.name}"`}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* MODAL 1: Single Category Deletion Confirmation */}
      {categoryToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-[#1A1A1A] border border-[#333] rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-start gap-3">
              <div className="p-2.5 bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl shrink-0">
                <Trash2 className="w-6 h-6" />
              </div>
              <div className="flex-1">
                <h3 className="text-base font-bold text-white">
                  Delete Category "{categoryToDelete.name}"?
                </h3>
                <p className="text-xs text-gray-400 mt-1">
                  This will remove "{categoryToDelete.name}" from your system's category taxonomy.
                </p>
              </div>
            </div>

            {/* Warning if items are using it */}
            {categoryToDelete.masterCount + categoryToDelete.regCount > 0 ? (
              <div className="p-3.5 bg-amber-500/10 border border-amber-500/20 rounded-xl space-y-2 text-xs text-amber-200">
                <div className="flex items-center gap-2 font-bold text-amber-400">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>Category is currently in active use:</span>
                </div>
                <ul className="list-disc list-inside space-y-1 text-[11px] text-amber-300/90 pl-1 font-mono">
                  <li>{categoryToDelete.masterCount} Master Catalog Item(s)</li>
                  <li>{categoryToDelete.regCount} Reference Sample Registration(s)</li>
                </ul>

                <label className="flex items-start gap-2 pt-2 border-t border-amber-500/20 text-xs text-gray-300 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={unlinkSingleOnDelete}
                    onChange={(e) => setUnlinkSingleOnDelete(e.target.checked)}
                    className="mt-0.5 rounded border-gray-600 bg-[#222] text-red-600 focus:ring-0"
                  />
                  <span>
                    Also clear/unlink this category from active master items and registrations
                  </span>
                </label>
              </div>
            ) : (
              <p className="text-xs text-gray-400 bg-[#222] p-3 rounded-xl border border-[#333]">
                This category is not currently linked to any master items or sample records. It is safe to delete.
              </p>
            )}

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setCategoryToDelete(null)}
                disabled={isDeletingSingle}
                className="px-4 py-2 bg-[#252525] hover:bg-[#303030] text-gray-300 text-xs font-semibold rounded-xl transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteSingle}
                disabled={isDeletingSingle}
                className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white text-xs font-bold rounded-xl shadow-lg transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>{isDeletingSingle ? 'Deleting...' : 'Delete Category'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: Delete ALL Categories Confirmation */}
      {showDeleteAllModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-[#1A1A1A] border border-red-500/30 rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-start gap-3">
              <div className="p-3 bg-red-500/20 border border-red-500/40 text-red-400 rounded-xl shrink-0">
                <ShieldAlert className="w-6 h-6" />
              </div>
              <div className="flex-1">
                <h3 className="text-base font-bold text-white">
                  Delete All {categories.length} Categories?
                </h3>
                <p className="text-xs text-gray-400 mt-1">
                  This action will remove all configured category classifications from the system.
                </p>
              </div>
            </div>

            <div className="p-3.5 bg-red-500/10 border border-red-500/20 rounded-xl space-y-2 text-xs text-red-200">
              <p className="font-semibold text-red-300">
                ⚠️ Warning: You are about to delete the entire category taxonomy ({categories.length} categories).
              </p>
              <label className="flex items-start gap-2 pt-2 border-t border-red-500/20 text-xs text-gray-300 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={unlinkAllOnDelete}
                  onChange={(e) => setUnlinkAllOnDelete(e.target.checked)}
                  className="mt-0.5 rounded border-gray-600 bg-[#222] text-red-600 focus:ring-0"
                />
                <span>
                  Also clear categories on all existing master items and reference registrations
                </span>
              </label>
            </div>

            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-gray-300">
                Type <span className="font-mono text-red-400">DELETE</span> to confirm:
              </label>
              <input
                type="text"
                value={deleteAllConfirmText}
                onChange={(e) => setDeleteAllConfirmText(e.target.value)}
                placeholder="Type DELETE"
                className="w-full px-3 py-2 bg-[#222] border border-[#333] text-white text-xs rounded-xl font-mono focus:outline-hidden focus:border-red-500"
              />
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => {
                  setShowDeleteAllModal(false);
                  setDeleteAllConfirmText('');
                }}
                disabled={isDeletingAll}
                className="px-4 py-2 bg-[#252525] hover:bg-[#303030] text-gray-300 text-xs font-semibold rounded-xl transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteAll}
                disabled={isDeletingAll || deleteAllConfirmText.trim().toUpperCase() !== 'DELETE'}
                className="px-4 py-2 bg-red-600 hover:bg-red-500 disabled:opacity-30 text-white text-xs font-bold rounded-xl shadow-lg transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>{isDeletingAll ? 'Deleting All...' : 'Confirm Delete All'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: Reset Default Categories Confirmation */}
      {showResetModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-[#1A1A1A] border border-[#333] rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-start gap-3">
              <div className="p-2.5 bg-blue-500/10 border border-blue-500/20 text-blue-400 rounded-xl shrink-0">
                <RefreshCw className="w-6 h-6" />
              </div>
              <div className="flex-1">
                <h3 className="text-base font-bold text-white">
                  Restore Default Factory Categories?
                </h3>
                <p className="text-xs text-gray-400 mt-1">
                  This will reload the {DEFAULT_CATEGORIES.length} baseline industrial categories:
                </p>
              </div>
            </div>

            <div className="p-3 bg-[#222] rounded-xl border border-[#333] max-h-36 overflow-y-auto">
              <div className="flex flex-wrap gap-1.5">
                {DEFAULT_CATEGORIES.map((c) => (
                  <span
                    key={c}
                    className="px-2 py-0.5 bg-[#181818] border border-[#2A2A2A] text-gray-300 text-[11px] rounded font-medium"
                  >
                    {c}
                  </span>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setShowResetModal(false)}
                disabled={isResetting}
                className="px-4 py-2 bg-[#252525] hover:bg-[#303030] text-gray-300 text-xs font-semibold rounded-xl transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmResetDefaults}
                disabled={isResetting}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-xl shadow-lg transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                <Check className="w-3.5 h-3.5" />
                <span>{isResetting ? 'Restoring...' : 'Restore Defaults'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
