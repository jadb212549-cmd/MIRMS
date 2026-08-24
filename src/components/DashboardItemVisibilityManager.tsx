import React, { useState, useMemo, useEffect } from 'react';
import { MasterItem, ReferenceRegistration, AppConfig } from '../types';
import {
  EyeOff,
  Eye,
  Search,
  CheckSquare,
  Square,
  RefreshCw,
  Filter,
  Check,
  X,
  AlertCircle,
  Database,
  ShieldCheck,
  CheckCircle2,
  SlidersHorizontal,
  Info
} from 'lucide-react';

interface DashboardItemVisibilityManagerProps {
  config: AppConfig;
  masterItems: MasterItem[];
  registrations: ReferenceRegistration[];
  onConfigChange: (newConfig: Partial<AppConfig>) => Promise<void>;
  onNotify?: (title: string, message: string, type?: 'success' | 'error' | 'info') => void;
}

export const DashboardItemVisibilityManager: React.FC<DashboardItemVisibilityManagerProps> = ({
  config,
  masterItems,
  registrations,
  onConfigChange,
  onNotify
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<'ALL' | 'RM' | 'PS'>('ALL');
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');
  const [visibilityFilter, setVisibilityFilter] = useState<'ALL' | 'HIDDEN' | 'VISIBLE'>('ALL');
  const [isSaving, setIsSaving] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'info' | 'error'; text: string } | null>(null);

  // Hidden product codes list from configuration
  const hiddenCodes = useMemo(() => {
    return (config.hiddenDashboardProductCodes || []).map((c) => c.toLowerCase());
  }, [config.hiddenDashboardProductCodes]);

  const hiddenSet = useMemo(() => new Set(hiddenCodes), [hiddenCodes]);

  // Map of registrations by productCode
  const regMap = useMemo(() => {
    const map = new Map<string, ReferenceRegistration>();
    registrations.forEach((r) => map.set(r.productCode.toLowerCase(), r));
    return map;
  }, [registrations]);

  // Distinct categories
  const categoriesList = useMemo(() => {
    const cats = Array.from(new Set(masterItems.map((m) => m.category).filter(Boolean))) as string[];
    return cats.sort((a, b) => a.localeCompare(b));
  }, [masterItems]);

  // Filtered master items
  const filteredItems = useMemo(() => {
    const term = searchQuery.trim().toLowerCase();
    return masterItems.filter((item) => {
      const codeLower = item.productCode.toLowerCase();
      const isHidden = hiddenSet.has(codeLower);

      // Search match
      const searchMatch =
        term === '' ||
        codeLower.includes(term) ||
        item.description.toLowerCase().includes(term) ||
        (item.category && item.category.toLowerCase().includes(term)) ||
        (item.materialType && item.materialType.toLowerCase().includes(term));

      // Type match
      const itemType = item.materialType || (item.category === 'RM' || item.category === 'PS' ? item.category : 'RM');
      const typeMatch = typeFilter === 'ALL' || itemType === typeFilter;

      // Category match
      const catMatch = categoryFilter === 'ALL' || item.category === categoryFilter;

      // Visibility match
      const visMatch =
        visibilityFilter === 'ALL' ||
        (visibilityFilter === 'HIDDEN' && isHidden) ||
        (visibilityFilter === 'VISIBLE' && !isHidden);

      return searchMatch && typeMatch && catMatch && visMatch;
    });
  }, [masterItems, searchQuery, typeFilter, categoryFilter, visibilityFilter, hiddenSet]);

  // Helper to commit changes
  const commitHiddenList = async (newList: string[], actionSummary: string) => {
    setIsSaving(true);
    setStatusMessage(null);
    try {
      // Deduplicate and sanitize
      const cleanList = Array.from(new Set(newList.map((c) => c.trim())));
      await onConfigChange({ hiddenDashboardProductCodes: cleanList });
      setStatusMessage({
        type: 'success',
        text: `${actionSummary} (${cleanList.length} total items hidden from dashboard).`
      });
      if (onNotify) {
        onNotify('Dashboard Visibility', actionSummary, 'success');
      }
    } catch (err: any) {
      setStatusMessage({
        type: 'error',
        text: `Failed to update dashboard visibility: ${err?.message || 'Unknown error'}`
      });
    } finally {
      setIsSaving(false);
    }
  };

  // Toggle single item
  const toggleItemVisibility = async (item: MasterItem) => {
    const code = item.productCode;
    const isCurrentlyHidden = hiddenSet.has(code.toLowerCase());

    let updatedList: string[];
    let summary: string;

    if (isCurrentlyHidden) {
      // Unhide (uncheck)
      updatedList = (config.hiddenDashboardProductCodes || []).filter(
        (c) => c.toLowerCase() !== code.toLowerCase()
      );
      summary = `Unhid "${code}" - will now display on Dashboard`;
    } else {
      // Hide (tick)
      updatedList = [...(config.hiddenDashboardProductCodes || []), code];
      summary = `Hidden "${code}" from Dashboard display`;
    }

    await commitHiddenList(updatedList, summary);
  };

  // Check / Hide all filtered items
  const handleHideAllFiltered = async () => {
    if (filteredItems.length === 0) return;

    const currentList = config.hiddenDashboardProductCodes || [];
    const newItemsToHide = filteredItems.map((i) => i.productCode);
    const combined = Array.from(new Set([...currentList, ...newItemsToHide]));

    await commitHiddenList(
      combined,
      `Ticked and hidden all ${filteredItems.length} filtered items from dashboard`
    );
  };

  // Uncheck / Unhide all filtered items
  const handleUnhideAllFiltered = async () => {
    if (filteredItems.length === 0) return;

    const filteredCodesSet = new Set(filteredItems.map((i) => i.productCode.toLowerCase()));
    const remainingHidden = (config.hiddenDashboardProductCodes || []).filter(
      (c) => !filteredCodesSet.has(c.toLowerCase())
    );

    await commitHiddenList(
      remainingHidden,
      `Unchecked and made visible all ${filteredItems.length} filtered items on dashboard`
    );
  };

  // Unhide ALL items in the entire database (Show Everything)
  const handleUnhideEverything = async () => {
    if ((config.hiddenDashboardProductCodes || []).length === 0) {
      setStatusMessage({ type: 'info', text: 'All items are already visible on the dashboard.' });
      return;
    }

    if (!confirm('Make all master items visible on the Main Dashboard?')) {
      return;
    }

    await commitHiddenList([], 'Restored visibility for all catalog items on Dashboard');
  };

  // Invert filtered items visibility
  const handleInvertFiltered = async () => {
    if (filteredItems.length === 0) return;

    const currentHiddenSet = new Set((config.hiddenDashboardProductCodes || []).map((c) => c.toLowerCase()));
    const otherCodes = (config.hiddenDashboardProductCodes || []).filter(
      (c) => !filteredItems.some((fi) => fi.productCode.toLowerCase() === c.toLowerCase())
    );

    const invertedFiltered: string[] = [];
    filteredItems.forEach((fi) => {
      if (!currentHiddenSet.has(fi.productCode.toLowerCase())) {
        invertedFiltered.push(fi.productCode);
      }
    });

    const resultList = [...otherCodes, ...invertedFiltered];
    await commitHiddenList(resultList, `Inverted dashboard visibility for ${filteredItems.length} items`);
  };

  // Determine master checkbox state for filtered items
  const allFilteredHidden =
    filteredItems.length > 0 &&
    filteredItems.every((i) => hiddenSet.has(i.productCode.toLowerCase()));
  const someFilteredHidden =
    filteredItems.some((i) => hiddenSet.has(i.productCode.toLowerCase())) && !allFilteredHidden;

  const totalHiddenCount = (config.hiddenDashboardProductCodes || []).length;
  const totalVisibleCount = Math.max(0, masterItems.length - totalHiddenCount);

  return (
    <div className="space-y-5 select-none font-sans">
      {/* Top Banner / Explanation */}
      <div className="bg-[#141414] rounded-2xl border border-[#222] p-5 shadow-lg relative overflow-hidden">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className="p-3 bg-amber-500/10 border border-amber-500/20 text-amber-400 rounded-xl shrink-0">
              <EyeOff className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <h3 className="text-base font-bold text-white tracking-tight">
                  Dashboard Display & Item Visibility Policy
                </h3>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-amber-500/10 text-amber-300 border border-amber-500/20 uppercase tracking-wider">
                  Admin Policy Control
                </span>
              </div>
              <p className="text-xs text-gray-400 mt-1 max-w-2xl leading-relaxed">
                Tick the checkbox <span className="text-amber-300 font-semibold">[✓ Hide]</span> for any items you wish to hide from the Main Dashboard metrics, registration percentages, today/yesterday tallies, and operator activity feeds. Uncheck items to make them visible again.
              </p>
            </div>
          </div>

          {/* Quick Metrics */}
          <div className="flex items-center gap-3 shrink-0">
            <div className="bg-[#1A1A1A] px-3.5 py-2 rounded-xl border border-[#2A2A2A] text-right">
              <span className="text-[10px] text-gray-500 font-mono block uppercase">Visible on Dashboard</span>
              <strong className="text-sm font-bold text-emerald-400 font-mono">
                {totalVisibleCount} / {masterItems.length}
              </strong>
            </div>

            <div className="bg-[#1A1A1A] px-3.5 py-2 rounded-xl border border-[#2A2A2A] text-right">
              <span className="text-[10px] text-gray-500 font-mono block uppercase">Hidden from Dashboard</span>
              <strong className="text-sm font-bold text-amber-400 font-mono">
                {totalHiddenCount} items
              </strong>
            </div>
          </div>
        </div>
      </div>

      {/* Dashboard Section / Component Visibility Control */}
      <div className="bg-[#141414] rounded-2xl border border-[#222] p-5 shadow-lg space-y-3.5">
        <h4 className="text-xs font-mono font-bold text-gray-400 uppercase tracking-wider">Dashboard Element Visibility</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <label className="flex items-start gap-3 p-4 bg-[#1A1A1A] hover:bg-[#1E1E1E] rounded-xl border border-[#252525] hover:border-[#333] transition-all cursor-pointer select-none">
            <input
              type="checkbox"
              checked={config.hidePerformanceTable ?? false}
              onChange={async (e) => {
                try {
                  await onConfigChange({ hidePerformanceTable: e.target.checked });
                  if (onNotify) {
                    onNotify(
                      'Dashboard Visibility',
                      e.target.checked
                        ? 'Individual Performance Table is now hidden from the dashboard'
                        : 'Individual Performance Table is now visible on the dashboard',
                      'success'
                    );
                  }
                } catch (err: any) {
                  if (onNotify) {
                    onNotify('Error', `Failed to update configuration: ${err?.message || err}`, 'error');
                  }
                }
              }}
              className="rounded bg-[#222] border-[#444] text-amber-500 focus:ring-amber-500 focus:ring-offset-0 w-4.5 h-4.5 mt-0.5 cursor-pointer"
            />
            <div>
              <span className="text-xs font-bold text-gray-200 block">Hide Individual Performance Table</span>
              <span className="text-[10px] text-gray-500 block mt-1 leading-relaxed">
                Hides the team members' performance metrics and registration targets from displaying on the main dashboard view.
              </span>
            </div>
          </label>
        </div>
      </div>

      {/* Status Feedback Message */}
      {statusMessage && (
        <div
          className={`p-3.5 rounded-xl border flex items-center justify-between gap-3 text-xs animate-in fade-in duration-150 ${
            statusMessage.type === 'success'
              ? 'bg-emerald-950/40 border-emerald-500/30 text-emerald-300'
              : statusMessage.type === 'error'
              ? 'bg-red-950/40 border-red-500/30 text-red-300'
              : 'bg-blue-950/40 border-blue-500/30 text-blue-300'
          }`}
        >
          <div className="flex items-center gap-2">
            {statusMessage.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            ) : statusMessage.type === 'error' ? (
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
            ) : (
              <Info className="w-4 h-4 text-blue-400 shrink-0" />
            )}
            <span>{statusMessage.text}</span>
          </div>
          <button
            onClick={() => setStatusMessage(null)}
            className="text-gray-400 hover:text-white p-1 rounded"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Filter and Action Control Bar */}
      <div className="bg-[#141414] p-4 rounded-xl border border-[#222] space-y-3">
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
          {/* Search Box */}
          <div className="relative flex-1 min-w-[240px]">
            <Search className="w-4 h-4 text-gray-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Filter items by code, description, type, category..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-8 py-2 text-xs bg-[#1A1A1A] border border-[#333] text-gray-200 placeholder-gray-500 rounded-lg focus:outline-hidden focus:border-amber-500 transition-colors"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Filter Dropdowns */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Visibility State Filter */}
            <div className="flex items-center gap-1.5 bg-[#1A1A1A] border border-[#333] px-2.5 py-1.5 rounded-lg text-xs">
              <EyeOff className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              <span className="text-gray-400 font-medium">Show:</span>
              <select
                value={visibilityFilter}
                onChange={(e) => setVisibilityFilter(e.target.value as any)}
                className="bg-transparent font-semibold text-gray-200 focus:outline-hidden cursor-pointer"
              >
                <option value="ALL" className="bg-[#1A1A1A] text-gray-200">All Items ({masterItems.length})</option>
                <option value="HIDDEN" className="bg-[#1A1A1A] text-amber-400">Hidden on Dashboard ({totalHiddenCount})</option>
                <option value="VISIBLE" className="bg-[#1A1A1A] text-emerald-400">Visible on Dashboard ({totalVisibleCount})</option>
              </select>
            </div>

            {/* Type Filter */}
            <div className="flex items-center gap-1.5 bg-[#1A1A1A] border border-[#333] px-2.5 py-1.5 rounded-lg text-xs">
              <span className="text-gray-400 font-medium">Type:</span>
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value as any)}
                className="bg-transparent font-semibold text-gray-200 focus:outline-hidden cursor-pointer"
              >
                <option value="ALL" className="bg-[#1A1A1A] text-gray-200">All Types</option>
                <option value="RM" className="bg-[#1A1A1A] text-gray-200">Raw Material (RM)</option>
                <option value="PS" className="bg-[#1A1A1A] text-gray-200">Prod Supply (PS)</option>
              </select>
            </div>

            {/* Category Filter */}
            <div className="flex items-center gap-1.5 bg-[#1A1A1A] border border-[#333] px-2.5 py-1.5 rounded-lg text-xs">
              <span className="text-gray-400 font-medium">Category:</span>
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="bg-transparent font-semibold text-gray-200 focus:outline-hidden cursor-pointer max-w-[130px] truncate"
              >
                <option value="ALL" className="bg-[#1A1A1A] text-gray-200">All Categories</option>
                {categoriesList.map((c) => (
                  <option key={c} value={c} className="bg-[#1A1A1A] text-gray-200">
                    {c}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Batch Operation Buttons */}
        <div className="flex flex-wrap items-center justify-between gap-2.5 pt-2 border-t border-[#222]">
          <div className="flex items-center gap-2 text-xs text-gray-400 font-mono">
            <span>Showing <strong className="text-gray-200">{filteredItems.length}</strong> matching items</span>
            {isSaving && (
              <span className="text-amber-400 flex items-center gap-1">
                <RefreshCw className="w-3 h-3 animate-spin" /> Saving changes...
              </span>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={handleHideAllFiltered}
              disabled={isSaving || filteredItems.length === 0}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-600/20 hover:bg-amber-600/30 text-amber-300 border border-amber-500/30 text-xs font-semibold rounded-lg transition-colors disabled:opacity-50 cursor-pointer"
              title="Tick all currently displayed items to hide them from the dashboard"
            >
              <CheckSquare className="w-3.5 h-3.5 text-amber-400" />
              <span>Hide All Checked ({filteredItems.length})</span>
            </button>

            <button
              onClick={handleUnhideAllFiltered}
              disabled={isSaving || filteredItems.length === 0}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/30 text-xs font-semibold rounded-lg transition-colors disabled:opacity-50 cursor-pointer"
              title="Uncheck all currently displayed items to make them visible on the dashboard"
            >
              <Square className="w-3.5 h-3.5 text-emerald-400" />
              <span>Uncheck All (Show Filtered)</span>
            </button>

            <button
              onClick={handleInvertFiltered}
              disabled={isSaving || filteredItems.length === 0}
              className="flex items-center gap-1 px-2.5 py-1.5 bg-[#1F1F1F] hover:bg-[#282828] text-gray-300 border border-[#333] text-xs font-medium rounded-lg transition-colors disabled:opacity-50 cursor-pointer"
              title="Invert selection for filtered items"
            >
              <SlidersHorizontal className="w-3.5 h-3.5 text-gray-400" />
              <span>Invert</span>
            </button>

            {totalHiddenCount > 0 && (
              <button
                onClick={handleUnhideEverything}
                disabled={isSaving}
                className="flex items-center gap-1 px-3 py-1.5 bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 border border-blue-500/30 text-xs font-semibold rounded-lg transition-colors disabled:opacity-50 cursor-pointer"
                title="Reset all items to visible on the dashboard"
              >
                <Eye className="w-3.5 h-3.5 text-blue-400" />
                <span>Show All ({masterItems.length})</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Items Table */}
      <div className="bg-[#121212] rounded-xl border border-[#222] overflow-hidden flex flex-col shadow-md">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-[#0A0A0A] border-b border-[#222] text-gray-500 font-mono uppercase tracking-wider text-[10px]">
                <th className="py-3 px-3 w-28 text-center font-medium">
                  <div className="flex items-center justify-center gap-1.5">
                    <input
                      type="checkbox"
                      checked={allFilteredHidden}
                      ref={(el) => {
                        if (el) el.indeterminate = someFilteredHidden;
                      }}
                      onChange={() => {
                        if (allFilteredHidden) {
                          handleUnhideAllFiltered();
                        } else {
                          handleHideAllFiltered();
                        }
                      }}
                      className="w-4 h-4 rounded bg-[#1A1A1A] border-[#444] text-amber-600 focus:ring-amber-500 cursor-pointer"
                      title={allFilteredHidden ? 'Uncheck all to make visible' : 'Check all to hide on dashboard'}
                    />
                    <span className="text-amber-400 font-bold">Hide</span>
                  </div>
                </th>
                <th className="py-3 px-4 w-40 font-medium">Product Code</th>
                <th className="py-3 px-4 font-medium">Material Description</th>
                <th className="py-3 px-3 w-20 font-medium">Type</th>
                <th className="py-3 px-3 w-28 font-medium">Category</th>
                <th className="py-3 px-3 w-36 font-medium">Sample Status</th>
                <th className="py-3 px-4 w-44 text-right font-medium">Dashboard Visibility</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#222]">
              {filteredItems.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-gray-500">
                    <Database className="w-8 h-8 mx-auto text-gray-600 mb-2" />
                    <p className="font-semibold text-gray-300">No items matched your filter criteria.</p>
                    <p className="text-xs text-gray-500 mt-1">Try clearing the search query or adjusting filters.</p>
                  </td>
                </tr>
              ) : (
                filteredItems.map((item) => {
                  const isHidden = hiddenSet.has(item.productCode.toLowerCase());
                  const reg = regMap.get(item.productCode.toLowerCase());
                  const isRegistered = !!reg;

                  return (
                    <tr
                      key={item.id}
                      className={`transition-colors group cursor-pointer ${
                        isHidden
                          ? 'bg-amber-950/15 hover:bg-amber-950/25 text-gray-300'
                          : 'hover:bg-[#1A1A1A] text-gray-200'
                      }`}
                      onClick={() => toggleItemVisibility(item)}
                    >
                      {/* Checkbox */}
                      <td className="py-3 px-3 text-center" onClick={(e) => e.stopPropagation()}>
                        <label className="flex items-center justify-center cursor-pointer p-1">
                          <input
                            type="checkbox"
                            checked={isHidden}
                            onChange={() => toggleItemVisibility(item)}
                            className="w-4 h-4 rounded bg-[#1A1A1A] border-[#444] text-amber-600 focus:ring-amber-500 cursor-pointer"
                          />
                        </label>
                      </td>

                      {/* Product Code */}
                      <td className="py-3 px-4 font-mono font-bold">
                        <div className="flex items-center gap-1.5">
                          <span className={isHidden ? 'text-amber-400/90' : 'text-blue-400'}>
                            {item.productCode}
                          </span>
                        </div>
                      </td>

                      {/* Description */}
                      <td className="py-3 px-4 font-medium max-w-xs truncate">
                        {item.description}
                      </td>

                      {/* Material Type */}
                      <td className="py-3 px-3 font-mono">
                        <span
                          className={`text-[10px] font-semibold px-2 py-0.5 rounded ${
                            (item.materialType || item.category) === 'PS'
                              ? 'bg-purple-500/10 text-purple-400 border border-purple-900/40'
                              : 'bg-blue-500/10 text-blue-400 border border-blue-900/40'
                          }`}
                        >
                          {item.materialType || ((item.category === 'RM' || item.category === 'PS') ? item.category : 'RM')}
                        </span>
                      </td>

                      {/* Category */}
                      <td className="py-3 px-3 font-mono text-[11px] text-gray-400">
                        {item.category || '-'}
                      </td>

                      {/* Sample Status */}
                      <td className="py-3 px-3">
                        {isRegistered ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-mono font-semibold px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                            <ShieldCheck className="w-3 h-3" />
                            {reg.revision || 'Registered'}
                          </span>
                        ) : (
                          <span className="inline-flex items-center text-[10px] font-mono text-gray-500 px-2 py-0.5 rounded bg-[#181818] border border-[#2A2A2A]">
                            Unregistered
                          </span>
                        )}
                      </td>

                      {/* Dashboard Status Badge */}
                      <td className="py-3 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                        <button
                          type="button"
                          onClick={() => toggleItemVisibility(item)}
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-mono font-bold transition-all cursor-pointer ${
                            isHidden
                              ? 'bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 shadow-xs'
                              : 'bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-400 border border-emerald-500/30'
                          }`}
                          title={isHidden ? 'Click to unhide on dashboard' : 'Click to hide from dashboard'}
                        >
                          {isHidden ? (
                            <>
                              <EyeOff className="w-3.5 h-3.5 text-amber-400" />
                              <span>Hidden on Dashboard</span>
                            </>
                          ) : (
                            <>
                              <Eye className="w-3.5 h-3.5 text-emerald-400" />
                              <span>Visible on Dashboard</span>
                            </>
                          )}
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
