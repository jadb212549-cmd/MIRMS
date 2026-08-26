import React, { useState, useMemo, useEffect } from 'react';
import { MasterItem, ReferenceRegistration, ItemCategory, ItemStatus } from '../types';
import { Database, Plus, Search, Filter, FileSpreadsheet, ShieldCheck, Calendar, X, Clock, Check, ChevronDown, Sparkles, RefreshCw, Camera, User, AlertTriangle, AlertCircle, Edit2 } from 'lucide-react';
import { excelService } from '../services/excelService';
import { userService } from '../services/userService';
import { db } from '../services/db';

interface MasterItemsViewProps {
  masterItems: MasterItem[];
  registrations: ReferenceRegistration[];
  onOpenCreateModal?: () => void;
  onOpenEditModal?: (item: MasterItem) => void;
  onDeleteMasterItem?: (id: string) => Promise<void>;
  onRegisterReference?: (item: MasterItem) => void;
  onViewReference?: (reg: ReferenceRegistration) => void;
  onNavigateTab?: (tab: any) => void;
  globalSearchQuery?: string;
  onSearchChange?: (query: string) => void;
}

export type DateFilterOption = 'ALL' | 'TODAY' | 'YESTERDAY' | 'PAST_7_DAYS' | 'PAST_30_DAYS' | 'CUSTOM';

export const MasterItemsView: React.FC<MasterItemsViewProps> = ({
  masterItems,
  registrations,
  onOpenCreateModal,
  onOpenEditModal,
  onDeleteMasterItem,
  onRegisterReference,
  onViewReference,
  onNavigateTab,
  globalSearchQuery = '',
  onSearchChange
}) => {
  const [currentUser, setCurrentUser] = useState(userService.getCurrentUser());
  const [localSearch, setLocalSearch] = useState('');
  const searchTerm = globalSearchQuery || localSearch;

  useEffect(() => {
    const unsubscribe = userService.subscribe(() => {
      setCurrentUser(userService.getCurrentUser());
    });
    return () => unsubscribe();
  }, []);

  const isAdmin = currentUser?.role === 'admin';

  const handleSearchChange = (val: string) => {
    setLocalSearch(val);
    if (onSearchChange) {
      onSearchChange(val);
    }
  };

  // Registered By / Personnel Filter
  const [registeredByFilter, setRegisteredByFilter] = useState<string>('ALL');

  // Distinct registeredBy operators from registrations
  const distinctRegisteredByList = useMemo(() => {
    const list = Array.from(new Set(registrations.map((r) => r.registeredBy).filter(Boolean))) as string[];
    return list.sort((a, b) => a.localeCompare(b));
  }, [registrations]);

  // Material Type, Dynamic Category, Status, Sample Registration, and Incomplete filters
  const [materialTypeFilter, setMaterialTypeFilter] = useState<'ALL' | 'RM' | 'PS'>('ALL');
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | ItemStatus>('ALL');
  const [regFilter, setRegFilter] = useState<'ALL' | 'REGISTERED' | 'UNREGISTERED'>('ALL');
  const [incompleteOnlyFilter, setIncompleteOnlyFilter] = useState<boolean>(false);

  // Distinct categories in master items
  const distinctCategories = useMemo(() => {
    const cats = Array.from(new Set(masterItems.map((m) => m.category).filter(Boolean))) as string[];
    return cats.sort((a, b) => a.localeCompare(b));
  }, [masterItems]);

  const [availableCategories, setAvailableCategories] = useState<string[]>([]);
  useEffect(() => {
    const loadCats = async () => {
      const cats = await db.getCategories();
      const combined = Array.from(new Set([...cats, ...distinctCategories])).filter(Boolean);
      setAvailableCategories(combined.sort((a, b) => a.localeCompare(b)));
    };
    loadCats();
  }, [distinctCategories]);

  // Date Filtering State (Targeting Date Recorded)
  const [dateFilterOption, setDateFilterOption] = useState<DateFilterOption>('ALL');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);

  // Inline Editing States
  const [inlineEdit, setInlineEdit] = useState<{
    itemId: string;
    field: 'category' | 'materialType' | 'unit' | 'description';
    value: string;
    customInput?: string;
    isCustom?: boolean;
  } | null>(null);
  const [isSavingInline, setIsSavingInline] = useState(false);
  const [inlineSaveError, setInlineSaveError] = useState<string | null>(null);

  // Incomplete Item Validation Error Popup Modal State
  const [incompleteModalInfo, setIncompleteModalInfo] = useState<{
    isOpen: boolean;
    item?: MasterItem;
    missingFields: string[];
  } | null>(null);

  // Map of registrations by productCode
  const regMap = useMemo(() => {
    const map = new Map<string, ReferenceRegistration>();
    registrations.forEach((r) => map.set(r.productCode.toLowerCase(), r));
    return map;
  }, [registrations]);

  // Missing fields helper
  const getMissingFields = (item: MasterItem): string[] => {
    const missing: string[] = [];
    if (!item.category || item.category.trim() === '') missing.push('Category');
    if (!item.materialType || item.materialType.trim() === '') missing.push('Material Type');
    if (!item.description || item.description.trim() === '') missing.push('Description');
    return missing;
  };

  // Total incomplete items count
  const incompleteItemsCount = useMemo(() => {
    return masterItems.filter((item) => !item.category || item.category.trim() === '' || !item.materialType || !item.description).length;
  }, [masterItems]);

  // Date calculation boundaries
  const { todayStr, yesterdayStr, past7DaysStr, past30DaysStr } = useMemo(() => {
    const now = new Date();
    const formatYMD = (d: Date) =>
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

    const t = formatYMD(now);

    const y = new Date(now);
    y.setDate(y.getDate() - 1);
    const yStr = formatYMD(y);

    const d7 = new Date(now);
    d7.setDate(d7.getDate() - 7);
    const d7Str = formatYMD(d7);

    const d30 = new Date(now);
    d30.setDate(d30.getDate() - 30);
    const d30Str = formatYMD(d30);

    return { todayStr: t, yesterdayStr: yStr, past7DaysStr: d7Str, past30DaysStr: d30Str };
  }, []);

  const extractDateStr = (dateVal?: string) => {
    if (!dateVal) return '';
    if (dateVal.length === 10 && dateVal.includes('-')) return dateVal;
    try {
      const d = new Date(dateVal);
      if (isNaN(d.getTime())) return '';
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    } catch {
      return '';
    }
  };

  const filteredItems = useMemo(() => {
    return masterItems.filter((item) => {
      // 1. General Search Term
      const searchMatch =
        searchTerm === '' ||
        item.productCode.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (item.unit && item.unit.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (item.category && item.category.toLowerCase().includes(searchTerm.toLowerCase()));

      // 2. Incomplete Only Filter
      const isMissing = !item.category || item.category.trim() === '' || !item.materialType || !item.description;
      if (incompleteOnlyFilter && !isMissing) {
        return false;
      }

      // 3. Material Type Filter
      const matMatch = materialTypeFilter === 'ALL' || (item.materialType || (item.category === 'RM' || item.category === 'PS' ? item.category : 'RM')) === materialTypeFilter;

      // 4. Category Filter
      const catMatch = categoryFilter === 'ALL' || item.category === categoryFilter;

      // 5. Status Filter
      const statusMatch = statusFilter === 'ALL' || item.status === statusFilter;

      // 6. Sample Registration Filter
      const reg = regMap.get(item.productCode.toLowerCase());
      const isRegistered = !!reg;
      const regMatch =
        regFilter === 'ALL' ||
        (regFilter === 'REGISTERED' && isRegistered) ||
        (regFilter === 'UNREGISTERED' && !isRegistered);

      // 7. Registered By Filter
      const registeredByMatch =
        registeredByFilter === 'ALL' ||
        (reg && reg.registeredBy && reg.registeredBy.toLowerCase() === registeredByFilter.toLowerCase());

      // 8. Date Filtering (Automatically targets Date Recorded: item.createdAt)
      let dateMatch = true;
      if (dateFilterOption !== 'ALL' || customStartDate || customEndDate) {
        const itemCreatedDate = extractDateStr(item.createdAt);

        if (dateFilterOption === 'TODAY') {
          dateMatch = itemCreatedDate === todayStr;
        } else if (dateFilterOption === 'YESTERDAY') {
          dateMatch = itemCreatedDate === yesterdayStr;
        } else if (dateFilterOption === 'PAST_7_DAYS') {
          dateMatch = itemCreatedDate >= past7DaysStr && itemCreatedDate <= todayStr;
        } else if (dateFilterOption === 'PAST_30_DAYS') {
          dateMatch = itemCreatedDate >= past30DaysStr && itemCreatedDate <= todayStr;
        }

        if (customStartDate && itemCreatedDate < customStartDate) dateMatch = false;
        if (customEndDate && itemCreatedDate > customEndDate) dateMatch = false;
      }

      return searchMatch && matMatch && catMatch && statusMatch && regMatch && registeredByMatch && dateMatch;
    });
  }, [
    masterItems,
    searchTerm,
    incompleteOnlyFilter,
    registeredByFilter,
    materialTypeFilter,
    categoryFilter,
    statusFilter,
    regFilter,
    dateFilterOption,
    customStartDate,
    customEndDate,
    regMap,
    todayStr,
    yesterdayStr,
    past7DaysStr,
    past30DaysStr
  ]);

  const hasActiveFilters =
    searchTerm !== '' ||
    incompleteOnlyFilter ||
    registeredByFilter !== 'ALL' ||
    materialTypeFilter !== 'ALL' ||
    categoryFilter !== 'ALL' ||
    statusFilter !== 'ALL' ||
    regFilter !== 'ALL' ||
    dateFilterOption !== 'ALL' ||
    customStartDate !== '' ||
    customEndDate !== '';

  const resetAllFilters = () => {
    handleSearchChange('');
    setIncompleteOnlyFilter(false);
    setRegisteredByFilter('ALL');
    setMaterialTypeFilter('ALL');
    setCategoryFilter('ALL');
    setStatusFilter('ALL');
    setRegFilter('ALL');
    setDateFilterOption('ALL');
    setCustomStartDate('');
    setCustomEndDate('');
  };

  // Inline Save Handler
  const handleSaveInline = async (item: MasterItem) => {
    if (!inlineEdit || inlineEdit.itemId !== item.id) return;
    setIsSavingInline(true);
    setInlineSaveError(null);

    let finalValue = inlineEdit.value;
    if (inlineEdit.field === 'category') {
      if (inlineEdit.isCustom || inlineEdit.value === '__NEW__') {
        finalValue = (inlineEdit.customInput || '').trim();
      } else {
        finalValue = (inlineEdit.value || '').trim();
      }
      if (!finalValue) {
        setInlineSaveError('Category cannot be empty.');
        setIsSavingInline(false);
        return;
      }
    } else {
      finalValue = finalValue.trim();
    }

    try {
      const updates: Partial<MasterItem> = {
        [inlineEdit.field]: finalValue
      };
      const res = await db.updateMasterItem(
        item.id,
        updates,
        currentUser?.fullName || currentUser?.shortName || 'Admin'
      );
      if (res && res.success === false) {
        setInlineSaveError(res.error || 'Failed to update item.');
      } else {
        setInlineEdit(null);
        if (inlineEdit.field === 'category' && finalValue) {
          setAvailableCategories((prev) => Array.from(new Set([...prev, finalValue])).sort());
        }
      }
    } catch (err: any) {
      setInlineSaveError(err.message || 'Error updating item.');
    } finally {
      setIsSavingInline(false);
    }
  };

  // Safe registration attempt check
  const handleAttemptRegister = (item: MasterItem) => {
    const missing = getMissingFields(item);
    if (missing.length > 0) {
      setIncompleteModalInfo({
        isOpen: true,
        item,
        missingFields: missing
      });
      return;
    }
    if (onRegisterReference) {
      onRegisterReference(item);
    }
  };

  return (
    <div className="space-y-4 select-none">
      {/* Control & Filter Header */}
      <div className="bg-[#141414] p-4 rounded-xl border border-[#222] space-y-3">
        {/* Primary Row: Global Search, Add & Export */}
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
          {/* Global Search Bar */}
          <div className="relative flex-1 min-w-[250px]">
            <Search className="w-4 h-4 text-gray-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search code, description, category, unit..."
              value={searchTerm}
              onChange={(e) => handleSearchChange(e.target.value)}
              className="w-full pl-9 pr-8 py-2 text-xs bg-[#1A1A1A] border border-[#333] text-gray-200 placeholder-gray-500 rounded-lg focus:outline-hidden focus:border-blue-500 transition-colors"
            />
            {searchTerm && (
              <button
                onClick={() => handleSearchChange('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Actions: Add New Item, Missing Filter Toggle & Export */}
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {incompleteItemsCount > 0 && (
              <button
                onClick={() => setIncompleteOnlyFilter(!incompleteOnlyFilter)}
                className={`flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg border transition-all cursor-pointer ${
                  incompleteOnlyFilter
                    ? 'bg-amber-500/20 text-amber-300 border-amber-500/50 ring-2 ring-amber-500/30'
                    : 'bg-amber-500/10 text-amber-400 border-amber-500/30 hover:bg-amber-500/15'
                }`}
                title="Filter items missing required details (e.g. Category)"
              >
                <AlertTriangle className="w-3.5 h-3.5 text-amber-400 animate-pulse" />
                <span>Missing Fields ({incompleteItemsCount})</span>
              </button>
            )}

            <button
              onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
              className={`flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg border transition-colors ${
                showAdvancedFilters || dateFilterOption !== 'ALL'
                  ? 'bg-blue-950/40 border-blue-500/40 text-blue-300'
                  : 'bg-[#1A1A1A] border-[#333] text-gray-300 hover:bg-[#222]'
              }`}
            >
              <Calendar className="w-3.5 h-3.5 text-blue-400" />
              <span>Date & Filters</span>
              {dateFilterOption !== 'ALL' && (
                <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse"></span>
              )}
            </button>

            <button
              onClick={() => excelService.exportMasterItems(filteredItems)}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-gray-200 bg-[#222] hover:bg-[#2A2A2A] rounded-lg border border-[#333] transition-colors"
              title="Export filtered master items list to Excel"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-green-400" />
              <span className="hidden sm:inline">Export</span>
            </button>

            {currentUser && (
              <button
                onClick={onOpenCreateModal}
                className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm transition-colors shrink-0"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Master Item</span>
              </button>
            )}
          </div>
        </div>

        {/* Secondary Row: Dropdowns (Material Type, Category, Status, Sample Status) & Quick Date Presets */}
        <div className="flex flex-wrap items-center justify-between gap-2.5 pt-1 border-t border-[#222]/80">
          <div className="flex flex-wrap items-center gap-2">
            {/* Material Type Filter */}
            <div className="flex items-center gap-1.5 bg-[#1A1A1A] border border-[#333] px-2.5 py-1.5 rounded-lg text-xs">
              <span className="text-gray-400 font-medium">Type:</span>
              <select
                value={materialTypeFilter}
                onChange={(e) => setMaterialTypeFilter(e.target.value as any)}
                className="bg-transparent font-semibold text-gray-200 focus:outline-hidden cursor-pointer"
              >
                <option value="ALL" className="bg-[#1A1A1A] text-gray-200">All (RM & PS)</option>
                <option value="RM" className="bg-[#1A1A1A] text-gray-200">RM (Raw Material)</option>
                <option value="PS" className="bg-[#1A1A1A] text-gray-200">PS (Prod Supply)</option>
              </select>
            </div>

            {/* Dynamic Category Filter */}
            <div className="flex items-center gap-1.5 bg-[#1A1A1A] border border-[#333] px-2.5 py-1.5 rounded-lg text-xs">
              <span className="text-gray-400 font-medium">Category:</span>
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="bg-transparent font-semibold text-gray-200 focus:outline-hidden cursor-pointer max-w-[140px] truncate"
              >
                <option value="ALL" className="bg-[#1A1A1A] text-gray-200">All Categories</option>
                {distinctCategories.map((cat) => (
                  <option key={cat} value={cat} className="bg-[#1A1A1A] text-gray-200">
                    {cat}
                  </option>
                ))}
              </select>
            </div>

            {/* Status Filter */}
            <div className="flex items-center gap-1.5 bg-[#1A1A1A] border border-[#333] px-2.5 py-1.5 rounded-lg text-xs">
              <span className="text-gray-400 font-medium">Status:</span>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as any)}
                className="bg-transparent font-semibold text-gray-200 focus:outline-hidden cursor-pointer"
              >
                <option value="ALL" className="bg-[#1A1A1A] text-gray-200">All Status</option>
                <option value="Active" className="bg-[#1A1A1A] text-gray-200">Active</option>
                <option value="Inactive" className="bg-[#1A1A1A] text-gray-200">Inactive</option>
              </select>
            </div>

            {/* Sample Registration Filter */}
            <div className="flex items-center gap-1.5 bg-[#1A1A1A] border border-[#333] px-2.5 py-1.5 rounded-lg text-xs">
              <span className="text-gray-400 font-medium">Sample:</span>
              <select
                value={regFilter}
                onChange={(e) => setRegFilter(e.target.value as any)}
                className="bg-transparent font-semibold text-gray-200 focus:outline-hidden cursor-pointer"
              >
                <option value="ALL" className="bg-[#1A1A1A] text-gray-200">All Samples</option>
                <option value="REGISTERED" className="bg-[#1A1A1A] text-gray-200">Registered</option>
                <option value="UNREGISTERED" className="bg-[#1A1A1A] text-gray-200">Pending</option>
              </select>
            </div>

            {/* Registered By Filter */}
            <div className="flex items-center gap-1.5 bg-[#1A1A1A] border border-[#333] px-2.5 py-1.5 rounded-lg text-xs">
              <User className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
              <span className="text-gray-400 font-medium">Reg By:</span>
              <select
                value={registeredByFilter}
                onChange={(e) => setRegisteredByFilter(e.target.value)}
                className="bg-transparent font-semibold text-gray-200 focus:outline-hidden cursor-pointer max-w-[150px] truncate"
              >
                <option value="ALL" className="bg-[#1A1A1A] text-gray-200">All Personnel</option>
                {distinctRegisteredByList.map((person) => (
                  <option key={person} value={person} className="bg-[#1A1A1A] text-gray-200">
                    {person}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Quick Date Presets & Clear Filters */}
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] text-gray-500 font-mono hidden sm:inline mr-1">Date:</span>
            <div className="flex items-center bg-[#1A1A1A] p-0.5 rounded-lg border border-[#333]">
              <button
                onClick={() => setDateFilterOption('ALL')}
                className={`px-2 py-1 rounded text-[11px] font-semibold transition-colors ${
                  dateFilterOption === 'ALL' ? 'bg-[#2A2A2A] text-blue-400' : 'text-gray-400 hover:text-gray-200'
                }`}
              >
                All
              </button>
              <button
                onClick={() => setDateFilterOption('TODAY')}
                className={`px-2 py-1 rounded text-[11px] font-semibold transition-colors ${
                  dateFilterOption === 'TODAY' ? 'bg-[#2A2A2A] text-blue-400' : 'text-gray-400 hover:text-gray-200'
                }`}
              >
                Today
              </button>
              <button
                onClick={() => setDateFilterOption('PAST_7_DAYS')}
                className={`px-2 py-1 rounded text-[11px] font-semibold transition-colors ${
                  dateFilterOption === 'PAST_7_DAYS' ? 'bg-[#2A2A2A] text-blue-400' : 'text-gray-400 hover:text-gray-200'
                }`}
              >
                Past 7d
              </button>
            </div>
            {hasActiveFilters && (
              <button
                onClick={resetAllFilters}
                className="px-2 py-1 rounded text-[11px] font-semibold bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/30 transition-colors flex items-center gap-1 cursor-pointer"
              >
                <RefreshCw className="w-3 h-3" />
                <span>Clear Filters</span>
              </button>
            )}
          </div>
        </div>

        {/* Expandable Date Range Selector (Automatically filters by Date Recorded) */}
        {showAdvancedFilters && (
          <div className="p-3 bg-[#0E0E0E] rounded-lg border border-[#282828] animate-in fade-in duration-150 flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-1.5 text-gray-400">
                <Calendar className="w-3.5 h-3.5 text-blue-400" />
                <span className="font-semibold text-gray-300">Date Recorded Range:</span>
              </div>

              {/* Start Date */}
              <div className="flex items-center gap-1.5">
                <span className="text-gray-500">From:</span>
                <input
                  type="date"
                  value={customStartDate}
                  onChange={(e) => {
                    setCustomStartDate(e.target.value);
                    setDateFilterOption('CUSTOM');
                  }}
                  className="bg-[#1A1A1A] border border-[#333] text-gray-200 px-2 py-1 rounded text-xs focus:outline-hidden focus:border-blue-500"
                />
              </div>

              {/* End Date */}
              <div className="flex items-center gap-1.5">
                <span className="text-gray-500">To:</span>
                <input
                  type="date"
                  value={customEndDate}
                  onChange={(e) => {
                    setCustomEndDate(e.target.value);
                    setDateFilterOption('CUSTOM');
                  }}
                  className="bg-[#1A1A1A] border border-[#333] text-gray-200 px-2 py-1 rounded text-xs focus:outline-hidden focus:border-blue-500"
                />
              </div>
            </div>

            <div className="text-[11px] text-gray-500 font-mono">
              Matching <span className="text-blue-400 font-bold">{filteredItems.length}</span> items
            </div>
          </div>
        )}

        {/* Active Filter Tags */}
        {hasActiveFilters && (
          <div className="flex flex-wrap items-center gap-1.5 pt-1 text-[11px]">
            <span className="text-gray-500 font-mono text-[10px] uppercase font-semibold mr-1">Active:</span>
            {searchTerm && (
              <span className="inline-flex items-center gap-1 bg-gray-800 text-gray-300 border border-gray-700 px-2 py-0.5 rounded font-mono">
                Search: "{searchTerm}"
                <X className="w-3 h-3 cursor-pointer hover:text-white" onClick={() => handleSearchChange('')} />
              </span>
            )}
            {incompleteOnlyFilter && (
              <span className="inline-flex items-center gap-1 bg-amber-500/20 text-amber-300 border border-amber-500/40 px-2 py-0.5 rounded font-mono font-bold">
                ⚠️ Missing Fields Only
                <X className="w-3 h-3 cursor-pointer hover:text-white" onClick={() => setIncompleteOnlyFilter(false)} />
              </span>
            )}
            {categoryFilter !== 'ALL' && (
              <span className="inline-flex items-center gap-1 bg-purple-500/10 text-purple-300 border border-purple-500/30 px-2 py-0.5 rounded font-mono">
                Cat: {categoryFilter}
                <X className="w-3 h-3 cursor-pointer hover:text-white" onClick={() => setCategoryFilter('ALL')} />
              </span>
            )}
            {statusFilter !== 'ALL' && (
              <span className="inline-flex items-center gap-1 bg-green-500/10 text-green-300 border border-green-500/30 px-2 py-0.5 rounded font-mono">
                Status: {statusFilter}
                <X className="w-3 h-3 cursor-pointer hover:text-white" onClick={() => setStatusFilter('ALL')} />
              </span>
            )}
            {regFilter !== 'ALL' && (
              <span className="inline-flex items-center gap-1 bg-amber-500/10 text-amber-300 border border-amber-500/30 px-2 py-0.5 rounded font-mono">
                Sample: {regFilter}
                <X className="w-3 h-3 cursor-pointer hover:text-white" onClick={() => setRegFilter('ALL')} />
              </span>
            )}
            {registeredByFilter !== 'ALL' && (
              <span className="inline-flex items-center gap-1 bg-cyan-500/10 text-cyan-300 border border-cyan-500/30 px-2 py-0.5 rounded font-mono">
                Reg By: {registeredByFilter}
                <X className="w-3 h-3 cursor-pointer hover:text-white" onClick={() => setRegisteredByFilter('ALL')} />
              </span>
            )}
            {dateFilterOption !== 'ALL' && (
              <span className="inline-flex items-center gap-1 bg-indigo-500/10 text-indigo-300 border border-indigo-500/30 px-2 py-0.5 rounded font-mono">
                Date: {dateFilterOption === 'CUSTOM' ? `${customStartDate || '...'} to ${customEndDate || '...'}` : dateFilterOption}
                <X className="w-3 h-3 cursor-pointer hover:text-white" onClick={() => setDateFilterOption('ALL')} />
              </span>
            )}
          </div>
        )}
      </div>

      {/* Master Items Table */}
      <div className="bg-[#121212] rounded-xl border border-[#222] overflow-hidden flex flex-col">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-[#0A0A0A] border-b border-[#222] text-gray-500 font-mono uppercase tracking-wider text-[10px]">
                <th className="py-3 px-4 w-40 font-medium">Product Code</th>
                <th className="py-3 px-4 font-medium">Material / Item Description</th>
                <th className="py-3 px-3 w-28 font-medium">Type</th>
                <th className="py-3 px-3 w-40 font-medium">Category</th>
                <th className="py-3 px-3 w-20 font-medium">Status</th>
                <th className="py-3 px-3 w-24 font-medium">Unit</th>
                <th className="py-3 px-4 w-32 font-medium">Date Recorded</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#222]">
              {filteredItems.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-gray-500">
                    <Database className="w-8 h-8 mx-auto text-gray-600 mb-2" />
                    <p className="font-semibold text-gray-300">No master reference items matched your filter criteria.</p>
                    <p className="text-xs text-gray-500 mt-1">Try clearing search, date, or category filters.</p>
                    {hasActiveFilters && (
                      <button
                        onClick={resetAllFilters}
                        className="mt-3 px-3 py-1.5 text-xs font-semibold bg-[#222] hover:bg-[#2A2A2A] text-blue-400 rounded border border-[#333] transition-colors cursor-pointer"
                      >
                        Reset All Filters
                      </button>
                    )}
                  </td>
                </tr>
              ) : (
                filteredItems.map((item) => {
                  const reg = regMap.get(item.productCode.toLowerCase());
                  const isRegistered = !!reg;
                  const itemDateStr = extractDateStr(item.createdAt);
                  const primaryPhoto = reg?.photos && reg.photos.length > 0 ? reg.photos[0] : null;
                  const missingFields = getMissingFields(item);
                  const isIncomplete = missingFields.length > 0;
                  const isEditingThis = inlineEdit?.itemId === item.id;

                  return (
                    <tr key={item.id} className={`transition-colors group ${isIncomplete ? 'bg-amber-500/[0.02] hover:bg-amber-500/[0.05]' : 'hover:bg-[#1A1A1A]'}`}>
                      {/* 1. Product Code */}
                      <td className="py-3 px-4 font-mono font-bold text-blue-400 relative group/code">
                        <div className="flex flex-col items-start gap-1">
                          <span
                            onClick={() => onOpenEditModal && onOpenEditModal(item)}
                            className="hover:underline flex items-center gap-1.5 cursor-pointer"
                            title="Click to view/edit item details"
                          >
                            {item.productCode}
                            {primaryPhoto && (
                              <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" title="Sample image uploaded"></span>
                            )}
                          </span>

                          {/* Incomplete Warning Badge */}
                          {isIncomplete && (
                            <span
                              onClick={() => {
                                setInlineEdit({
                                  itemId: item.id,
                                  field: !item.category ? 'category' : !item.materialType ? 'materialType' : 'description',
                                  value: !item.category ? (availableCategories[0] || 'Box') : (item.materialType || 'RM')
                                });
                              }}
                              className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[9px] font-sans font-bold rounded bg-amber-500/15 text-amber-400 border border-amber-500/30 cursor-pointer hover:bg-amber-500/25"
                              title={`Missing required fields: ${missingFields.join(', ')}. Click to complete.`}
                            >
                              <AlertTriangle className="w-2.5 h-2.5 shrink-0" />
                              <span>Missing {missingFields[0]}</span>
                            </span>
                          )}
                        </div>

                        {/* Flash Primary Image Tooltip Card on Hover */}
                        <div className="hidden group-hover/code:block absolute left-4 top-full mt-1 z-50 w-56 p-2 bg-[#181818] border border-blue-500/50 rounded-xl shadow-2xl shadow-black animate-in fade-in zoom-in-95 duration-150 pointer-events-none">
                          {primaryPhoto ? (
                            <div>
                              <div className="relative aspect-square w-full rounded-lg overflow-hidden bg-black/60 border border-[#333] mb-1.5">
                                <img
                                  src={primaryPhoto.dataUrl}
                                  alt={item.description}
                                  className="w-full h-full object-cover"
                                />
                                <span className="absolute bottom-1 right-1 bg-black/80 text-[9px] text-gray-200 px-1.5 py-0.5 rounded font-mono">
                                  {reg?.revision || 'Rev 01'} Primary
                                </span>
                              </div>
                              <div className="text-[10px] font-mono text-gray-200 truncate">
                                <strong className="text-blue-400">{item.productCode}</strong>
                              </div>
                              <p className="text-[10px] text-gray-400 truncate">{item.description}</p>
                            </div>
                          ) : (
                            <div className="p-3 text-center bg-[#111] rounded-lg border border-[#282828]">
                              <Camera className="w-6 h-6 mx-auto text-gray-600 mb-1" />
                              <p className="text-[10px] text-gray-400 font-mono font-semibold">No Primary Photo</p>
                              <p className="text-[9px] text-gray-600 mt-0.5">{item.productCode}</p>
                            </div>
                          )}
                        </div>
                      </td>

                      {/* 2. Description / Item Name */}
                      <td className="py-3 px-4 text-gray-200 font-medium max-w-xs sm:max-w-md">
                        {isEditingThis && inlineEdit.field === 'description' ? (
                          <div className="flex items-center gap-1">
                            <input
                              type="text"
                              value={inlineEdit.value}
                              onChange={(e) => setInlineEdit({ ...inlineEdit, value: e.target.value })}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') handleSaveInline(item);
                                if (e.key === 'Escape') setInlineEdit(null);
                              }}
                              className="w-full text-xs px-2 py-1 bg-[#1E1E1E] border border-blue-500 text-gray-100 rounded focus:outline-hidden"
                              autoFocus
                            />
                            <button
                              onClick={() => handleSaveInline(item)}
                              disabled={isSavingInline}
                              className="p-1 bg-blue-600 hover:bg-blue-500 text-white rounded cursor-pointer"
                              title="Save description"
                            >
                              <Check className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => setInlineEdit(null)}
                              className="p-1 bg-[#2A2A2A] hover:bg-[#333] text-gray-400 rounded cursor-pointer"
                              title="Cancel"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ) : !item.description || item.description.trim() === '' ? (
                          <button
                            onClick={() => setInlineEdit({ itemId: item.id, field: 'description', value: '' })}
                            className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded bg-amber-500/15 text-amber-300 border border-dashed border-amber-500/50 hover:bg-amber-500/25 hover:border-amber-400 transition-all cursor-pointer shadow-xs"
                            title="Missing Description - Click to Add"
                          >
                            <Plus className="w-3 h-3 text-amber-400" />
                            <span>+ ADD</span>
                          </button>
                        ) : (
                          <div className="flex items-center justify-between gap-2 group/desc">
                            <span className="truncate">{item.description}</span>
                            {isAdmin && (
                              <button
                                onClick={() => setInlineEdit({ itemId: item.id, field: 'description', value: item.description })}
                                className="opacity-0 group-hover/desc:opacity-100 p-1 text-gray-500 hover:text-gray-200 hover:bg-[#2A2A2A] rounded transition-opacity cursor-pointer shrink-0"
                                title="Quick Edit Description"
                              >
                                <Edit2 className="w-3 h-3" />
                              </button>
                            )}
                          </div>
                        )}
                      </td>

                      {/* 3. Material Type */}
                      <td className="py-3 px-3 font-mono">
                        {isEditingThis && inlineEdit.field === 'materialType' ? (
                          <div className="flex items-center gap-1">
                            <select
                              value={inlineEdit.value}
                              onChange={(e) => setInlineEdit({ ...inlineEdit, value: e.target.value })}
                              className="text-xs px-1.5 py-1 bg-[#1E1E1E] border border-blue-500 text-gray-100 rounded focus:outline-hidden"
                              autoFocus
                            >
                              <option value="RM">RM</option>
                              <option value="PS">PS</option>
                            </select>
                            <button
                              onClick={() => handleSaveInline(item)}
                              disabled={isSavingInline}
                              className="p-1 bg-blue-600 hover:bg-blue-500 text-white rounded cursor-pointer"
                            >
                              <Check className="w-3 h-3" />
                            </button>
                            <button
                              onClick={() => setInlineEdit(null)}
                              className="p-1 bg-[#2A2A2A] hover:bg-[#333] text-gray-400 rounded cursor-pointer"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </div>
                        ) : !item.materialType ? (
                          <button
                            onClick={() => setInlineEdit({ itemId: item.id, field: 'materialType', value: 'RM' })}
                            className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded bg-amber-500/15 text-amber-300 border border-dashed border-amber-500/50 hover:bg-amber-500/25 hover:border-amber-400 transition-all cursor-pointer shadow-xs"
                            title="Missing Material Type - Click to Add"
                          >
                            <Plus className="w-3 h-3 text-amber-400" />
                            <span>+ ADD</span>
                          </button>
                        ) : (
                          <div className="flex items-center gap-1 group/type">
                            <span
                              className={`inline-flex items-center text-[10px] font-semibold px-2 py-0.5 rounded ${
                                item.materialType === 'PS'
                                  ? 'bg-purple-500/10 text-purple-400 border border-purple-900/40'
                                  : 'bg-blue-500/10 text-blue-400 border border-blue-900/40'
                              }`}
                            >
                              {item.materialType}
                            </span>
                            {isAdmin && (
                              <button
                                onClick={() => setInlineEdit({ itemId: item.id, field: 'materialType', value: item.materialType || 'RM' })}
                                className="opacity-0 group-hover/type:opacity-100 p-0.5 text-gray-500 hover:text-gray-200 hover:bg-[#2A2A2A] rounded transition-opacity cursor-pointer"
                                title="Edit Material Type"
                              >
                                <Edit2 className="w-2.5 h-2.5" />
                              </button>
                            )}
                          </div>
                        )}
                      </td>

                      {/* 4. Dynamic Category (Includes Inline + ADD for empty category) */}
                      <td className="py-3 px-3">
                        {isEditingThis && inlineEdit.field === 'category' ? (
                          <div className="flex flex-col gap-1.5 min-w-[170px] bg-[#181818] p-2 rounded-lg border border-blue-500/50 shadow-xl">
                            {!inlineEdit.isCustom ? (
                              <div className="flex items-center gap-1">
                                <select
                                  value={inlineEdit.value}
                                  onChange={(e) => {
                                    if (e.target.value === '__NEW__') {
                                      setInlineEdit({ ...inlineEdit, isCustom: true, customInput: '' });
                                    } else {
                                      setInlineEdit({ ...inlineEdit, value: e.target.value });
                                    }
                                  }}
                                  className="w-full text-xs px-2 py-1 bg-[#1E1E1E] border border-[#444] text-gray-100 rounded focus:outline-hidden focus:border-blue-500"
                                  autoFocus
                                >
                                  <option value="">-- Choose Category --</option>
                                  {availableCategories.map((c) => (
                                    <option key={c} value={c}>{c}</option>
                                  ))}
                                  <option value="__NEW__" className="text-blue-400 font-semibold">+ New Category...</option>
                                </select>
                              </div>
                            ) : (
                              <input
                                type="text"
                                placeholder="Type new category..."
                                value={inlineEdit.customInput || ''}
                                onChange={(e) => setInlineEdit({ ...inlineEdit, customInput: e.target.value })}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') handleSaveInline(item);
                                  if (e.key === 'Escape') setInlineEdit(null);
                                }}
                                className="w-full text-xs px-2 py-1 bg-[#1E1E1E] border border-blue-500 text-gray-100 rounded focus:outline-hidden"
                                autoFocus
                              />
                            )}

                            {inlineSaveError && (
                              <span className="text-[10px] text-red-400 leading-tight">{inlineSaveError}</span>
                            )}

                            <div className="flex items-center justify-end gap-1 pt-0.5">
                              {inlineEdit.isCustom && (
                                <button
                                  type="button"
                                  onClick={() => setInlineEdit({ ...inlineEdit, isCustom: false, value: availableCategories[0] || 'Box' })}
                                  className="text-[10px] text-gray-400 hover:text-gray-200 mr-auto underline"
                                >
                                  List
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => setInlineEdit(null)}
                                className="px-2 py-0.5 text-[11px] bg-[#2A2A2A] hover:bg-[#333] text-gray-400 rounded cursor-pointer"
                              >
                                Cancel
                              </button>
                              <button
                                type="button"
                                onClick={() => handleSaveInline(item)}
                                disabled={isSavingInline}
                                className="px-2 py-0.5 text-[11px] bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded cursor-pointer flex items-center gap-1"
                              >
                                <Check className="w-3 h-3" />
                                <span>Save</span>
                              </button>
                            </div>
                          </div>
                        ) : !item.category || item.category.trim() === '' ? (
                          <button
                            onClick={() => {
                              setInlineEdit({
                                itemId: item.id,
                                field: 'category',
                                value: availableCategories[0] || 'Box',
                                isCustom: false,
                                customInput: ''
                              });
                            }}
                            className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded bg-amber-500/15 text-amber-300 border border-dashed border-amber-500/50 hover:bg-amber-500/25 hover:border-amber-400 transition-all cursor-pointer shadow-xs group/btn"
                            title="Missing Category - Click to quickly add inline"
                          >
                            <Plus className="w-3 h-3 text-amber-400 group-hover/btn:scale-110 transition-transform" />
                            <span>+ ADD</span>
                          </button>
                        ) : (
                          <div className="flex items-center gap-1 group/cat">
                            <span className="inline-flex items-center text-[10px] font-medium px-2 py-0.5 rounded bg-[#1C1C1C] text-gray-300 border border-[#333] max-w-[130px] truncate">
                              {item.category}
                            </span>
                            {isAdmin && (
                              <button
                                onClick={() => {
                                  setInlineEdit({
                                    itemId: item.id,
                                    field: 'category',
                                    value: item.category,
                                    isCustom: false,
                                    customInput: ''
                                  });
                                }}
                                className="opacity-0 group-hover/cat:opacity-100 p-0.5 text-gray-500 hover:text-gray-200 hover:bg-[#2A2A2A] rounded transition-opacity cursor-pointer"
                                title="Edit Category"
                              >
                                <Edit2 className="w-2.5 h-2.5" />
                              </button>
                            )}
                          </div>
                        )}
                      </td>

                      {/* 5. Status */}
                      <td className="py-3 px-3 font-mono">
                        <span
                          className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded ${
                            item.status === 'Active'
                              ? 'bg-[#222] text-green-400 border border-green-900/40'
                              : 'bg-[#222] text-gray-400 border border-[#333]'
                          }`}
                        >
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${
                              item.status === 'Active' ? 'bg-green-500' : 'bg-gray-500'
                            }`}
                          ></span>
                          {item.status}
                        </span>
                      </td>

                      {/* 6. Unit (Includes Inline + ADD for empty unit) */}
                      <td className="py-3 px-3 text-gray-400 font-mono">
                        {isEditingThis && inlineEdit.field === 'unit' ? (
                          <div className="flex items-center gap-1">
                            <input
                              type="text"
                              placeholder="e.g. pcs"
                              value={inlineEdit.value}
                              onChange={(e) => setInlineEdit({ ...inlineEdit, value: e.target.value })}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') handleSaveInline(item);
                                if (e.key === 'Escape') setInlineEdit(null);
                              }}
                              className="w-16 text-xs px-1.5 py-0.5 bg-[#1E1E1E] border border-blue-500 text-gray-100 rounded focus:outline-hidden font-mono"
                              autoFocus
                            />
                            <button
                              onClick={() => handleSaveInline(item)}
                              disabled={isSavingInline}
                              className="p-1 bg-blue-600 hover:bg-blue-500 text-white rounded cursor-pointer"
                            >
                              <Check className="w-3 h-3" />
                            </button>
                            <button
                              onClick={() => setInlineEdit(null)}
                              className="p-1 bg-[#2A2A2A] hover:bg-[#333] text-gray-400 rounded cursor-pointer"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </div>
                        ) : !item.unit || item.unit.trim() === '' ? (
                          <button
                            onClick={() => setInlineEdit({ itemId: item.id, field: 'unit', value: 'pcs' })}
                            className="inline-flex items-center gap-0.5 text-[9px] font-bold px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-dashed border-blue-500/40 hover:bg-blue-500/20 hover:border-blue-400 transition-all cursor-pointer"
                            title="Add Unit (Optional reference)"
                          >
                            <Plus className="w-2.5 h-2.5" />
                            <span>+ ADD</span>
                          </button>
                        ) : (
                          <div className="flex items-center gap-1 group/unit">
                            <span>{item.unit}</span>
                            {isAdmin && (
                              <button
                                onClick={() => setInlineEdit({ itemId: item.id, field: 'unit', value: item.unit || '' })}
                                className="opacity-0 group-hover/unit:opacity-100 p-0.5 text-gray-500 hover:text-gray-200 hover:bg-[#2A2A2A] rounded transition-opacity cursor-pointer"
                                title="Edit Unit"
                              >
                                <Edit2 className="w-2.5 h-2.5" />
                              </button>
                            )}
                          </div>
                        )}
                      </td>

                      {/* 7. Date Recorded */}
                      <td className="py-3 px-4 font-mono text-[11px] text-gray-400">
                        {itemDateStr || <span className="text-gray-600">-</span>}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Footer info */}
        <div className="px-4 py-3 bg-[#0E0E0E] border-t border-[#222] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-xs text-gray-500 font-mono">
          <div>
            Showing <strong className="text-gray-300">{filteredItems.length}</strong> of {masterItems.length} master reference items
            {hasActiveFilters && <span className="text-blue-400 ml-1.5">(Filtered)</span>}
            {incompleteItemsCount > 0 && (
              <span className="text-amber-400 ml-2 font-bold">
                • {incompleteItemsCount} incomplete {incompleteItemsCount === 1 ? 'item' : 'items'} need Category or details
              </span>
            )}
          </div>
          <div className="text-[11px] text-gray-600">
            Zero inventory policy • SQLite Indexed
          </div>
        </div>
      </div>

      {/* Pop-up Modal: Incomplete Item Record Validation */}
      {incompleteModalInfo && incompleteModalInfo.isOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-[#181818] rounded-xl border border-amber-500/40 shadow-2xl p-6 max-w-md w-full text-center space-y-4 animate-in zoom-in-95 duration-150">
            <div className="mx-auto w-12 h-12 bg-amber-500/10 border border-amber-500/30 rounded-full flex items-center justify-center text-amber-400">
              <AlertTriangle className="w-6 h-6" />
            </div>

            <div className="space-y-1.5">
              <h4 className="text-sm font-bold text-gray-100 uppercase tracking-wide font-mono">
                Validation Control Alert
              </h4>
              <p className="text-sm font-bold text-amber-300">
                Item details must be fully completed before proceeding.
              </p>
              <p className="text-xs text-gray-400 leading-relaxed pt-1">
                The master item <span className="font-mono font-bold text-blue-400">"{incompleteModalInfo.item?.productCode}"</span> is missing required information:
              </p>
            </div>

            <div className="bg-[#111] p-3 rounded-lg border border-[#282828] text-left space-y-1.5">
              <div className="text-[11px] text-gray-400 font-semibold font-mono">Missing Required Fields:</div>
              <div className="flex flex-wrap gap-1.5">
                {incompleteModalInfo.missingFields.map((field) => (
                  <span
                    key={field}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40 text-xs font-mono font-bold"
                  >
                    <AlertCircle className="w-3 h-3 text-amber-400" />
                    {field}
                  </span>
                ))}
              </div>
              <p className="text-[11px] text-gray-500 pt-1">
                All materials in the reference database must have an assigned Category classification before reference specimens can be registered, approved, or exported.
              </p>
            </div>

            <div className="flex items-center gap-2 pt-1">
              <button
                type="button"
                onClick={() => setIncompleteModalInfo(null)}
                className="flex-1 py-2 bg-[#252525] hover:bg-[#2E2E2E] text-gray-300 font-semibold text-xs rounded-lg transition-colors cursor-pointer"
              >
                Close
              </button>
              {incompleteModalInfo.item && (
                <button
                  type="button"
                  onClick={() => {
                    const itm = incompleteModalInfo.item!;
                    setIncompleteModalInfo(null);
                    setInlineEdit({
                      itemId: itm.id,
                      field: 'category',
                      value: availableCategories[0] || 'Box',
                      isCustom: false,
                      customInput: ''
                    });
                  }}
                  className="flex-1 py-2 bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs rounded-lg transition-colors cursor-pointer shadow-md flex items-center justify-center gap-1.5"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>+ ADD Missing Data</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
