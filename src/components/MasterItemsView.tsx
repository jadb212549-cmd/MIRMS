import React, { useState, useMemo, useEffect } from 'react';
import { MasterItem, ReferenceRegistration, ItemCategory, ItemStatus } from '../types';
import { Database, Plus, Search, Filter, FileSpreadsheet, ShieldCheck, Edit3, Trash2, ShieldAlert, Calendar, X, Clock, Check, ChevronDown, Sparkles, RefreshCw, Camera, User } from 'lucide-react';
import { excelService } from '../services/excelService';
import { userService } from '../services/userService';

interface MasterItemsViewProps {
  masterItems: MasterItem[];
  registrations: ReferenceRegistration[];
  onOpenCreateModal: () => void;
  onOpenEditModal: (item: MasterItem) => void;
  onDeleteMasterItem: (id: string) => Promise<void>;
  onRegisterReference: (item: MasterItem) => void;
  onViewReference: (reg: ReferenceRegistration) => void;
  onNavigateTab: (tab: any) => void;
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

  // Material Type, Dynamic Category, Status, Sample Registration filters
  const [materialTypeFilter, setMaterialTypeFilter] = useState<'ALL' | 'RM' | 'PS'>('ALL');
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | ItemStatus>('ALL');
  const [regFilter, setRegFilter] = useState<'ALL' | 'REGISTERED' | 'UNREGISTERED'>('ALL');

  // Distinct categories in master items
  const distinctCategories = useMemo(() => {
    const cats = Array.from(new Set(masterItems.map((m) => m.category).filter(Boolean))) as string[];
    return cats.sort((a, b) => a.localeCompare(b));
  }, [masterItems]);

  // Date Filtering State (Targeting Date Recorded)
  const [dateFilterOption, setDateFilterOption] = useState<DateFilterOption>('ALL');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);

  const [itemToDelete, setItemToDelete] = useState<MasterItem | null>(null);

  // Map of registrations by productCode
  const regMap = useMemo(() => {
    const map = new Map<string, ReferenceRegistration>();
    registrations.forEach((r) => map.set(r.productCode.toLowerCase(), r));
    return map;
  }, [registrations]);

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
        (item.unit && item.unit.toLowerCase().includes(searchTerm.toLowerCase()));

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
    setRegisteredByFilter('ALL');
    setMaterialTypeFilter('ALL');
    setCategoryFilter('ALL');
    setStatusFilter('ALL');
    setRegFilter('ALL');
    setDateFilterOption('ALL');
    setCustomStartDate('');
    setCustomEndDate('');
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
              placeholder="Search code, description, unit..."
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

          {/* Actions: Add New Item & Export */}
          <div className="flex items-center gap-2 shrink-0">
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

            {/* Registered By Filter (Requested Feature: Filter by Registered By) */}
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

            {/* Date Quick Presets (Requested Feature) */}
            <div className="flex items-center bg-[#181818] p-0.5 rounded-lg border border-[#333] text-xs">
              <button
                onClick={() => setDateFilterOption('ALL')}
                className={`px-2 py-1 rounded text-[11px] font-semibold transition-colors ${
                  dateFilterOption === 'ALL'
                    ? 'bg-[#2A2A2A] text-white shadow-xs'
                    : 'text-gray-400 hover:text-gray-200'
                }`}
              >
                All Dates
              </button>
              <button
                onClick={() => setDateFilterOption('TODAY')}
                className={`px-2 py-1 rounded text-[11px] font-semibold transition-colors ${
                  dateFilterOption === 'TODAY'
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'text-gray-400 hover:text-blue-300'
                }`}
              >
                Today
              </button>
              <button
                onClick={() => setDateFilterOption('YESTERDAY')}
                className={`px-2 py-1 rounded text-[11px] font-semibold transition-colors ${
                  dateFilterOption === 'YESTERDAY'
                    ? 'bg-purple-600 text-white shadow-xs'
                    : 'text-gray-400 hover:text-purple-300'
                }`}
              >
                Yesterday
              </button>
              <button
                onClick={() => setDateFilterOption('PAST_7_DAYS')}
                className={`px-2 py-1 rounded text-[11px] font-semibold transition-colors ${
                  dateFilterOption === 'PAST_7_DAYS'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'text-gray-400 hover:text-emerald-300'
                }`}
              >
                Past 7d
              </button>
              {hasActiveFilters && (
                <button
                  onClick={resetAllFilters}
                  className="px-2 py-1 rounded text-[11px] font-semibold bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/30 transition-colors flex items-center gap-1"
                >
                  <RefreshCw className="w-3 h-3" />
                  <span>Clear Filters</span>
                </button>
              )}
            </div>
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
                {currentUser && <th className="py-3 px-3 w-20 text-center font-medium">Actions</th>}
                <th className="py-3 px-3 w-28 text-center font-medium">Reference</th>
                <th className="py-3 px-4 w-36 font-medium">Product Code</th>
                <th className="py-3 px-4 font-medium">Material / Item Description</th>
                <th className="py-3 px-3 w-20 font-medium">Type</th>
                <th className="py-3 px-3 w-28 font-medium">Category</th>
                <th className="py-3 px-3 w-20 font-medium">Status</th>
                <th className="py-3 px-3 w-16 font-medium">Unit</th>
                <th className="py-3 px-4 w-36 font-medium">Sample Status</th>
                <th className="py-3 px-4 w-32 font-medium">Date Recorded</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#222]">
              {filteredItems.length === 0 ? (
                <tr>
                  <td colSpan={currentUser ? 10 : 9} className="py-12 text-center text-gray-500">
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

                  return (
                    <tr key={item.id} className="hover:bg-[#1A1A1A] transition-colors group">
                      {/* 1. Actions (Edit & Delete) - Only if logged in */}
                      {currentUser && (
                        <td className="py-3 px-3 text-center">
                          <div className="flex items-center justify-center gap-1">
                            <button
                              onClick={() => onOpenEditModal(item)}
                              title="Edit Master Item"
                              className="p-1.5 text-gray-400 hover:text-blue-400 hover:bg-[#252525] rounded transition-colors cursor-pointer"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                            {isAdmin && (
                              <button
                                onClick={() => setItemToDelete(item)}
                                title="Delete Master Item"
                                className="p-1.5 text-gray-400 hover:text-rose-400 hover:bg-rose-500/10 rounded transition-colors cursor-pointer"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </td>
                      )}

                      {/* 2. View / Register Reference */}
                      <td className="py-3 px-3 text-center">
                        {isRegistered ? (
                          <button
                            onClick={() => onViewReference(reg!)}
                            className="px-2.5 py-1 text-xs font-semibold bg-[#222] text-blue-400 hover:bg-[#2A2A2A] hover:text-blue-300 rounded border border-[#333] transition-colors cursor-pointer"
                          >
                            View
                          </button>
                        ) : currentUser ? (
                          <button
                            onClick={() => onRegisterReference(item)}
                            className="px-2.5 py-1 text-xs font-semibold bg-[#222] text-green-400 hover:bg-[#2A2A2A] hover:text-green-300 rounded border border-[#333] transition-colors flex items-center gap-1 mx-auto cursor-pointer"
                          >
                            <Plus className="w-3 h-3" />
                            <span>Register</span>
                          </button>
                        ) : (
                          <span className="text-[10px] text-gray-500 font-mono italic">
                            Unregistered
                          </span>
                        )}
                      </td>

                      {/* 3. Product Code (Hover Flashes Primary Image) */}
                      <td className="py-3 px-4 font-mono font-bold text-blue-400 relative group/code">
                        <span className="hover:underline flex items-center gap-1.5 cursor-pointer">
                          {item.productCode}
                          {primaryPhoto && (
                            <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" title="Sample image uploaded"></span>
                          )}
                        </span>

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

                      {/* 4. Description / Item Name */}
                      <td className="py-3 px-4 text-gray-200 font-medium max-w-xs sm:max-w-md">
                        <div className="truncate">{item.description}</div>
                      </td>

                      {/* 5. Material Type */}
                      <td className="py-3 px-3 font-mono">
                        <span
                          className={`inline-flex items-center text-[10px] font-semibold px-2 py-0.5 rounded ${
                            (item.materialType || item.category) === 'PS'
                              ? 'bg-purple-500/10 text-purple-400 border border-purple-900/40'
                              : 'bg-blue-500/10 text-blue-400 border border-blue-900/40'
                          }`}
                        >
                          {item.materialType || ((item.category === 'RM' || item.category === 'PS') ? item.category : 'RM')}
                        </span>
                      </td>

                      {/* 6. Dynamic Category */}
                      <td className="py-3 px-3">
                        <span className="inline-flex items-center text-[10px] font-medium px-2 py-0.5 rounded bg-[#1C1C1C] text-gray-300 border border-[#333] max-w-[120px] truncate">
                          {item.category || 'Box'}
                        </span>
                      </td>

                      {/* 6. Status */}
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

                      {/* 7. Unit */}
                      <td className="py-3 px-3 text-gray-400 font-mono">
                        {item.unit || <span className="text-gray-600 italic">-</span>}
                      </td>

                      {/* 8. Sample Registration Badge */}
                      <td className="py-3 px-4">
                        {isRegistered ? (
                          <div className="flex flex-col items-start gap-1">
                            <span className="inline-flex items-center gap-1 text-[10px] font-mono font-semibold px-2 py-0.5 rounded bg-green-500/10 text-green-400 border border-green-500/20">
                              <ShieldCheck className="w-3 h-3 text-green-400" />
                              <span>{reg.revision} ({reg.registrationDate})</span>
                            </span>
                            {reg.registeredBy && (
                              <span className="inline-flex items-center gap-1 text-[10px] text-gray-400 font-sans">
                                <User className="w-2.5 h-2.5 text-cyan-400/80" />
                                <span>{reg.registeredBy}</span>
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[10px] font-mono font-medium px-2 py-0.5 rounded bg-orange-500/10 text-orange-400 border border-orange-500/20">
                            <span>Pending Sample</span>
                          </span>
                        )}
                      </td>

                      {/* 9. Date Recorded */}
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
          </div>
          <div className="text-[11px] text-gray-600">
            Zero inventory policy • SQLite Indexed
          </div>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {itemToDelete && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-[#161616] rounded-xl shadow-2xl border border-[#333] w-full max-w-md p-5 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-start gap-3">
              <div className="p-2 bg-rose-500/10 text-rose-400 border border-rose-500/20 rounded-lg shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">Delete Master Reference Item</h3>
                <p className="text-xs text-gray-400 mt-1">
                  Are you sure you want to remove <strong className="text-blue-400 font-mono">{itemToDelete.productCode}</strong> from the master list?
                </p>
                {regMap.has(itemToDelete.productCode.toLowerCase()) && (
                  <div className="mt-2 p-2 bg-amber-500/10 border border-amber-500/20 text-amber-300 text-[11px] rounded-md flex items-center gap-1.5">
                    <ShieldAlert className="w-4 h-4 shrink-0 text-amber-400" />
                    <span>Warning: A registered sample specimen is linked to this code. You must delete the sample registration first.</span>
                  </div>
                )}
              </div>
            </div>

            <div className="mt-5 pt-3 border-t border-[#222] flex items-center justify-end gap-2">
              <button
                onClick={() => setItemToDelete(null)}
                className="px-3.5 py-1.5 text-xs font-semibold text-gray-400 hover:text-gray-200 hover:bg-[#222] rounded-lg transition-colors border border-transparent"
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  await onDeleteMasterItem(itemToDelete.id);
                  setItemToDelete(null);
                }}
                className="px-4 py-1.5 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-lg shadow-xs transition-colors"
              >
                Confirm Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

