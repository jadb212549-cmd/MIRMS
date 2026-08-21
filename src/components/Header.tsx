import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  Layers,
  HardDrive,
  ShieldCheck,
  Database,
  FileSpreadsheet,
  FileText,
  History,
  Cpu,
  Search,
  X,
  ArrowRight,
  ExternalLink,
  Tag,
  Calendar,
  User,
  CheckCircle2,
  AlertCircle,
  ChevronDown,
  Settings,
  FolderOpen,
  LogIn,
  LogOut,
  UserCheck
} from 'lucide-react';
import { isTauri } from '../services/tauriService';
import { NavigationTab, MasterItem, ReferenceRegistration } from '../types';
import { MultiUserPresenceBadge } from './MultiUserPresenceBadge';
import { userService, AppUser } from '../services/userService';
import { LoginModal } from './LoginModal';

interface HeaderProps {
  currentTab?: NavigationTab;
  onSelectTab?: (tab: NavigationTab) => void;
  // Fallbacks for backward compatibility
  activeTab?: string;
  setActiveTab?: (tab: any) => void;
  registeredCount: number;
  masterCount?: number;
  totalMasterItems?: number;
  masterItems?: MasterItem[];
  registrations?: ReferenceRegistration[];
  searchQuery?: string;
  onSearchChange?: (query: string) => void;
  onSelectMasterItem?: (item: MasterItem) => void;
  onSelectRegistration?: (reg: ReferenceRegistration) => void;
  onNotify?: (title: string, message: string, type?: 'info' | 'success' | 'warning') => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentTab,
  onSelectTab,
  activeTab,
  setActiveTab,
  registeredCount,
  masterCount,
  totalMasterItems,
  masterItems = [],
  registrations = [],
  searchQuery = '',
  onSearchChange,
  onSelectMasterItem,
  onSelectRegistration,
  onNotify
}) => {
  const isDesktop = isTauri();
  const totalMaster = masterCount ?? totalMasterItems ?? 0;
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const [currentUser, setCurrentUser] = useState<AppUser | null>(userService.getCurrentUser());
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);

  // Determine active tab key
  const current = currentTab || (activeTab === 'dashboard' ? 'DASHBOARD'
    : activeTab === 'master-items' ? 'MASTER_ITEMS'
    : activeTab === 'registrations' ? 'REGISTRATIONS'
    : activeTab === 'excel' ? 'EXCEL_MANAGER'
    : activeTab === 'templates' ? 'WORD_TEMPLATES'
    : activeTab === 'data-backup' ? 'DATA_MANAGEMENT'
    : activeTab === 'audit' ? 'AUDIT_TRAIL'
    : 'DASHBOARD');

  const handleTabClick = (tabId: NavigationTab) => {
    if (onSelectTab) {
      onSelectTab(tabId);
    } else if (setActiveTab) {
      const mapped = tabId === 'DASHBOARD' ? 'dashboard'
        : tabId === 'MASTER_ITEMS' ? 'master-items'
        : tabId === 'REGISTRATIONS' ? 'registrations'
        : tabId === 'EXCEL_MANAGER' ? 'excel'
        : tabId === 'WORD_TEMPLATES' ? 'templates'
        : tabId === 'DATA_MANAGEMENT' ? 'data-backup'
        : 'audit';
      setActiveTab(mapped);
    }
  };

  useEffect(() => {
    const unsubscribe = userService.subscribe(() => {
      setCurrentUser(userService.getCurrentUser());
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (current === 'ADMIN_DASHBOARD' && (!currentUser || currentUser.role !== 'admin')) {
      handleTabClick('DASHBOARD');
    }
  }, [currentUser, current]);

  // Keyboard shortcut (Ctrl+K or Cmd+K or '/')
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        searchInputRef.current?.focus();
        setIsDropdownOpen(true);
      } else if (e.key === 'Escape') {
        setIsDropdownOpen(false);
        searchInputRef.current?.blur();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node) &&
        searchInputRef.current &&
        !searchInputRef.current.contains(event.target as Node)
      ) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Real-time matched items based on searchQuery
  const term = searchQuery.trim().toLowerCase();

  const regMap = useMemo(() => {
    const map = new Map<string, ReferenceRegistration>();
    registrations.forEach((r) => map.set(r.productCode.toLowerCase(), r));
    return map;
  }, [registrations]);

  const masterMap = useMemo(() => {
    const map = new Map<string, MasterItem>();
    masterItems.forEach((m) => map.set(m.productCode.toLowerCase(), m));
    return map;
  }, [masterItems]);

  const searchSuggestions = useMemo(() => {
    if (!term) return [];
    const list: { type: 'code' | 'category' | 'operator'; label: string; value: string }[] = [];

    // Category suggestions
    if ('raw material'.includes(term) || 'rm'.includes(term)) {
      list.push({ type: 'category', label: 'Category: Raw Material (RM)', value: 'RM' });
    }
    if ('production supply'.includes(term) || 'ps'.includes(term)) {
      list.push({ type: 'category', label: 'Category: Production Supply (PS)', value: 'PS' });
    }

    // Operator suggestions
    const operators = Array.from(new Set(registrations.map((r) => r.registeredBy).filter(Boolean)));
    operators.forEach((op) => {
      if (op.toLowerCase().includes(term)) {
        list.push({ type: 'operator', label: `Operator: ${op}`, value: op });
      }
    });

    // Product Code suggestions
    const codes = Array.from(new Set(masterItems.map((m) => m.productCode).filter(Boolean)));
    codes.forEach((code) => {
      if (code.toLowerCase().includes(term) && list.length < 8) {
        list.push({ type: 'code', label: `Product Code: ${code}`, value: code });
      }
    });

    return list.slice(0, 5);
  }, [term, registrations, masterItems]);

  const matchingMasterItems = useMemo(() => {
    if (!term) return [];
    return masterItems.filter((item) => {
      return (
        item.productCode.toLowerCase().includes(term) ||
        item.description.toLowerCase().includes(term) ||
        (item.unit && item.unit.toLowerCase().includes(term)) ||
        item.category.toLowerCase().includes(term) ||
        item.status.toLowerCase().includes(term)
      );
    });
  }, [masterItems, term]);

  const matchingRegistrations = useMemo(() => {
    if (!term) return [];
    return registrations.filter((reg) => {
      const linkedMaster = masterMap.get(reg.productCode.toLowerCase());
      return (
        reg.productCode.toLowerCase().includes(term) ||
        reg.revision.toLowerCase().includes(term) ||
        (reg.supplier && reg.supplier.toLowerCase().includes(term)) ||
        reg.registeredBy.toLowerCase().includes(term) ||
        (reg.specification && reg.specification.toLowerCase().includes(term)) ||
        (reg.remarks && reg.remarks.toLowerCase().includes(term)) ||
        (linkedMaster && linkedMaster.description.toLowerCase().includes(term))
      );
    });
  }, [registrations, masterMap, term]);

  const totalMatches = matchingMasterItems.length + matchingRegistrations.length;

  const [isAdminOpen, setIsAdminOpen] = useState(false);
  const adminDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (adminDropdownRef.current && !adminDropdownRef.current.contains(event.target as Node)) {
        setIsAdminOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleClearSearch = () => {
    if (onSearchChange) {
      onSearchChange('');
    }
    setIsDropdownOpen(false);
  };

  const handleSelectMaster = (item: MasterItem) => {
    setIsDropdownOpen(false);
    if (onSelectMasterItem) {
      onSelectMasterItem(item);
    } else {
      handleTabClick('MASTER_ITEMS');
    }
  };

  const handleSelectReg = (reg: ReferenceRegistration) => {
    setIsDropdownOpen(false);
    if (onSelectRegistration) {
      onSelectRegistration(reg);
    } else {
      handleTabClick('REGISTRATIONS');
    }
  };

  const primaryNavItems: { id: NavigationTab; label: string; icon: React.ReactNode; badge?: string | number }[] = [
    { id: 'DASHBOARD', label: 'Dashboard', icon: <Layers className="w-3.5 h-3.5" /> },
    { id: 'MASTER_ITEMS', label: 'Master Items', icon: <Database className="w-3.5 h-3.5" />, badge: totalMaster },
    { id: 'REGISTRATIONS', label: 'Reference Registry', icon: <ShieldCheck className="w-3.5 h-3.5" />, badge: registeredCount },
    ...(currentUser?.role === 'admin' ? [{ id: 'ADMIN_DASHBOARD', label: 'Admin Dashboard', icon: <Settings className="w-3.5 h-3.5" /> } as any] : [])
  ];

  const isAdminActive = current === 'ADMIN_DASHBOARD';

  return (
    <header className="bg-[#0F0F0F] border-b border-[#222222] text-[#E5E7EB] sticky top-0 z-50 select-none">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        {/* Top Header Row: Centered Large Title & Multi-user Presence */}
        <div className="py-3.5 border-b border-[#1A1A1A] flex flex-col md:flex-row items-center justify-between gap-3">
          <div className="flex-1 hidden md:block"></div>
          
          {/* Centered Large System Title */}
          <div className="flex flex-col items-center justify-center text-center">
            <h1 className="text-lg sm:text-xl lg:text-2xl font-black tracking-tight text-white drop-shadow-sm">
              Material Inspection & Reference Management System
            </h1>
          </div>

          {/* Right Status Badges */}
          <div className="flex-1 hidden md:block"></div>
        </div>

        {/* Navigation Row: Primary Tabs, Admin Tab Dropdown, and Global Search Bar Beside Admin */}
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 py-2">
          {/* Left: Navigation Tabs & Admin Tab */}
          <nav className="flex items-center space-x-1 overflow-x-visible">
            {primaryNavItems.map((tab) => {
              const isActive = current === tab.id;
              return (
                <button
                  key={tab.id}
                  id={`nav-tab-${tab.id.toLowerCase()}`}
                  onClick={() => handleTabClick(tab.id)}
                  className={`flex items-center gap-2 px-3.5 py-1.5 text-xs font-medium rounded-lg transition-all whitespace-nowrap ${
                    isActive
                      ? 'bg-blue-600 text-white shadow-sm font-semibold'
                      : 'text-gray-400 hover:text-white hover:bg-[#1A1A1A]'
                  }`}
                >
                  {tab.icon}
                  <span>{tab.label}</span>
                  {tab.badge !== undefined && (
                    <span
                      className={`text-[10px] px-1.5 py-0.2 font-mono rounded ${
                        isActive ? 'bg-blue-800 text-blue-100' : 'bg-[#222] text-gray-400 border border-[#333]'
                      }`}
                    >
                      {tab.badge}
                    </span>
                  )}
                </button>
              );
            })}

            {/* Admin Dashboard is a first-class tab in navigation, so no dropdown is needed */}
          </nav>

          {/* Right: Global Search & Login Portal */}
          <div className="flex items-center gap-3 w-full md:w-auto shrink-0 justify-end flex-1 max-w-md">
            {/* Global Search Bar Beside Admin Tab */}
            <div className="relative flex-1 max-w-sm w-full z-40">
            <div className="relative flex items-center">
              <Search className="w-4 h-4 text-gray-400 absolute left-3 pointer-events-none" />
              <input
                ref={searchInputRef}
                type="text"
                id="header-global-search-input"
                placeholder="Global search Code, Description, Specs (Ctrl+K)..."
                value={searchQuery}
                onFocus={() => setIsDropdownOpen(true)}
                onChange={(e) => {
                  if (onSearchChange) onSearchChange(e.target.value);
                  setIsDropdownOpen(true);
                }}
                className="w-full pl-9 pr-16 py-1.5 text-xs bg-[#161616] border border-[#2F2F2F] text-gray-200 placeholder-gray-500 rounded-lg focus:outline-hidden focus:border-blue-500 focus:bg-[#1A1A1A] transition-all font-mono"
              />
              <div className="absolute right-2 flex items-center gap-1.5">
                {searchQuery ? (
                  <button
                    onClick={handleClearSearch}
                    className="p-1 text-gray-400 hover:text-white hover:bg-[#2A2A2A] rounded transition-colors"
                    title="Clear search"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                ) : (
                  <kbd className="hidden sm:inline-flex items-center px-1.5 py-0.5 text-[10px] font-mono text-gray-500 bg-[#0A0A0A] border border-[#2A2A2A] rounded">
                    Ctrl K
                  </kbd>
                )}
              </div>
            </div>

            {/* Real-Time Search Dropdown Flyout */}
            {isDropdownOpen && term.length > 0 && (
              <div
                ref={dropdownRef}
                className="absolute right-0 left-0 sm:left-auto sm:w-[480px] top-full mt-1.5 bg-[#141414] border border-[#333] rounded-xl shadow-2xl z-[9999] max-h-[75vh] overflow-y-auto divide-y divide-[#222] animate-in fade-in zoom-in-95 duration-100"
              >
                {/* Search Meta Status Bar */}
                <div className="px-3.5 py-2 bg-[#0E0E0E] flex items-center justify-between text-[11px] text-gray-400">
                  <span className="flex items-center gap-1.5 font-mono">
                    <Search className="w-3 h-3 text-blue-400" />
                    Matches for <strong className="text-white">"{searchQuery}"</strong>:
                  </span>
                  <span className="font-mono text-xs text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded border border-blue-500/20">
                    {totalMatches} Total {totalMatches === 1 ? 'Result' : 'Results'}
                  </span>
                </div>

                {/* Search Suggestions Chips */}
                {searchSuggestions.length > 0 && (
                  <div className="p-2 bg-[#101010] border-b border-[#222]">
                    <p className="text-[10px] font-mono font-bold text-gray-500 uppercase tracking-wider mb-1.5 px-1 flex items-center gap-1">
                      <Tag className="w-3 h-3 text-blue-400" />
                      <span>Suggested Keywords & Search Shortcuts:</span>
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {searchSuggestions.map((sug, i) => (
                        <button
                          key={i}
                          onClick={() => {
                            if (onSearchChange) onSearchChange(sug.value);
                          }}
                          className="px-2 py-1 text-[11px] font-mono bg-[#1E1E1E] hover:bg-blue-600 hover:text-white text-gray-300 rounded border border-[#333] transition-colors flex items-center gap-1 cursor-pointer"
                        >
                          <span>{sug.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {totalMatches === 0 ? (
                  <div className="p-6 text-center text-xs text-gray-500 space-y-1">
                    <p className="font-medium text-gray-400">No matching master items or registrations found</p>
                    <p className="text-[11px]">Try searching by product code, grade, supplier, specs, or QA name.</p>
                  </div>
                ) : (
                  <div className="p-2 space-y-3">
                    {/* Master Items Results */}
                    {matchingMasterItems.length > 0 && (
                      <div>
                        <div className="px-2 py-1 flex items-center justify-between text-[11px] font-mono font-bold text-gray-400 uppercase tracking-wider">
                          <span className="flex items-center gap-1.5">
                            <Database className="w-3.5 h-3.5 text-blue-400" />
                            Master Items Catalog ({matchingMasterItems.length})
                          </span>
                          <button
                            onClick={() => {
                              setIsDropdownOpen(false);
                              handleTabClick('MASTER_ITEMS');
                            }}
                            className="text-blue-400 hover:text-blue-300 flex items-center gap-1 normal-case font-sans text-[11px] transition-colors"
                          >
                            View in Catalog <ArrowRight className="w-3 h-3" />
                          </button>
                        </div>
                        <div className="mt-1 space-y-1">
                          {matchingMasterItems.slice(0, 5).map((item) => {
                            const isReg = regMap.has(item.productCode.toLowerCase());
                            const reg = regMap.get(item.productCode.toLowerCase());
                            return (
                              <div
                                key={item.id}
                                onClick={() => handleSelectMaster(item)}
                                className="group p-2.5 rounded-lg bg-[#181818] hover:bg-[#202020] border border-[#282828] hover:border-blue-500/50 cursor-pointer transition-all flex items-start justify-between gap-3"
                              >
                                <div className="min-w-0 flex-1">
                                  <div className="flex items-center gap-2">
                                    <span className="font-mono font-bold text-xs text-blue-300">
                                      {item.productCode}
                                    </span>
                                    <span className={`text-[10px] px-1.5 py-0.2 rounded font-mono font-semibold ${
                                      item.category === 'RM'
                                        ? 'bg-sky-500/10 text-sky-400 border border-sky-500/20'
                                        : 'bg-purple-500/10 text-purple-400 border border-purple-500/20'
                                    }`}>
                                      {item.category === 'RM' ? 'Raw Material' : 'Production Supply'}
                                    </span>
                                    <span className={`text-[10px] px-1.5 py-0.2 rounded font-mono ${
                                      item.status === 'Active'
                                        ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                        : 'bg-gray-800 text-gray-400 border border-[#333]'
                                    }`}>
                                      {item.status}
                                    </span>
                                  </div>
                                  <p className="text-xs text-gray-300 mt-1 line-clamp-1">
                                    {item.description}
                                  </p>
                                </div>
                                <div className="shrink-0 flex items-center gap-2">
                                  {isReg ? (
                                    <span className="text-[10px] flex items-center gap-1 font-mono text-emerald-400 bg-emerald-500/10 px-2 py-1 rounded border border-emerald-500/20">
                                      <CheckCircle2 className="w-3 h-3" />
                                      {reg?.revision || 'Registered'}
                                    </span>
                                  ) : (
                                    <span className="text-[10px] flex items-center gap-1 font-mono text-amber-400 bg-amber-500/10 px-2 py-1 rounded border border-amber-500/20">
                                      <AlertCircle className="w-3 h-3" />
                                      Unregistered
                                    </span>
                                  )}
                                  <ExternalLink className="w-3.5 h-3.5 text-gray-500 group-hover:text-blue-400 transition-colors" />
                                </div>
                              </div>
                            );
                          })}
                          {matchingMasterItems.length > 5 && (
                            <button
                              onClick={() => {
                                setIsDropdownOpen(false);
                                handleTabClick('MASTER_ITEMS');
                              }}
                              className="w-full text-center py-1.5 text-xs text-blue-400 hover:text-blue-300 bg-[#161616] rounded border border-[#2A2A2A] transition-colors"
                            >
                              + {matchingMasterItems.length - 5} more Master Items in Catalog
                            </button>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Registrations Results */}
                    {matchingRegistrations.length > 0 && (
                      <div>
                        <div className="px-2 py-1 flex items-center justify-between text-[11px] font-mono font-bold text-gray-400 uppercase tracking-wider">
                          <span className="flex items-center gap-1.5">
                            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                            Registered QA Specimens ({matchingRegistrations.length})
                          </span>
                          <button
                            onClick={() => {
                              setIsDropdownOpen(false);
                              handleTabClick('REGISTRATIONS');
                            }}
                            className="text-blue-400 hover:text-blue-300 flex items-center gap-1 normal-case font-sans text-[11px] transition-colors"
                          >
                            View in Registry <ArrowRight className="w-3 h-3" />
                          </button>
                        </div>
                        <div className="mt-1 space-y-1">
                          {matchingRegistrations.slice(0, 5).map((reg) => {
                            const linkedMaster = masterMap.get(reg.productCode.toLowerCase());
                            return (
                              <div
                                key={reg.id}
                                onClick={() => handleSelectReg(reg)}
                                className="group p-2.5 rounded-lg bg-[#181818] hover:bg-[#202020] border border-[#282828] hover:border-emerald-500/50 cursor-pointer transition-all flex items-start justify-between gap-3"
                              >
                                <div className="min-w-0 flex-1">
                                  <div className="flex items-center gap-2">
                                    <span className="font-mono font-bold text-xs text-emerald-300">
                                      {reg.productCode}
                                    </span>
                                    <span className="text-[10px] px-1.5 py-0.2 rounded font-mono font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                                      {reg.revision}
                                    </span>
                                    {linkedMaster && (
                                      <span className="text-[10px] px-1.5 py-0.2 rounded font-mono bg-[#222] text-gray-400 border border-[#333]">
                                        {linkedMaster.category}
                                      </span>
                                    )}
                                  </div>
                                  <p className="text-xs text-gray-300 mt-1 line-clamp-1">
                                    {linkedMaster?.description || reg.specification || 'QA Reference Specimen'}
                                  </p>
                                  <div className="flex items-center gap-3 mt-1 text-[10px] text-gray-500 font-mono">
                                    <span className="flex items-center gap-1 text-gray-400">
                                      <User className="w-3 h-3 text-blue-400" />
                                      {reg.registeredBy}
                                    </span>
                                    <span className="flex items-center gap-1">
                                      <Calendar className="w-3 h-3" />
                                      {reg.registrationDate}
                                    </span>
                                    {reg.supplier && (
                                      <span className="truncate max-w-[120px] text-gray-400">
                                        • {reg.supplier}
                                      </span>
                                    )}
                                  </div>
                                </div>
                                <div className="shrink-0 flex items-center gap-2">
                                  <span className="text-[10px] font-mono text-gray-400 bg-[#222] px-2 py-1 rounded border border-[#333] group-hover:border-emerald-500/40 group-hover:text-emerald-300 transition-colors">
                                    View Specimen
                                  </span>
                                </div>
                              </div>
                            );
                          })}
                          {matchingRegistrations.length > 5 && (
                            <button
                              onClick={() => {
                                setIsDropdownOpen(false);
                                handleTabClick('REGISTRATIONS');
                              }}
                              className="w-full text-center py-1.5 text-xs text-blue-400 hover:text-blue-300 bg-[#161616] rounded border border-[#2A2A2A] transition-colors"
                            >
                              + {matchingRegistrations.length - 5} more Registered Specimens
                            </button>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Footer instructions */}
                <div className="px-3.5 py-2 bg-[#0E0E0E] flex items-center justify-between text-[10px] text-gray-500 font-mono">
                  <span>Press <kbd className="text-gray-400">ESC</kbd> to close</span>
                  <span className="text-blue-400">Real-time filter active across tabs</span>
                </div>
              </div>
            )}
          </div>

          {/* Login Status & Portal trigger */}
          <div className="shrink-0">
            {currentUser ? (
              <div className="flex items-center gap-1.5 bg-[#141414] border border-[#2A2A2A] rounded-xl px-3 py-1.5 text-xs text-gray-200">
                <div className="p-1 bg-emerald-500/10 text-emerald-400 rounded-lg border border-emerald-500/20 shrink-0 flex items-center justify-center">
                  <UserCheck className="w-3.5 h-3.5" />
                </div>
                <div className="flex flex-col text-left">
                  <span className="font-semibold text-white leading-tight font-mono truncate max-w-[90px]" title={currentUser.fullName}>
                    {currentUser.shortName}
                  </span>
                  <span className="text-[9px] text-gray-500 uppercase tracking-wide leading-none font-bold">
                    {currentUser.role}
                  </span>
                </div>
                <button
                  onClick={() => userService.logout()}
                  className="ml-1.5 p-1 text-gray-400 hover:text-red-400 hover:bg-red-500/10 rounded transition-all shrink-0"
                  title="Sign Out"
                >
                  <LogOut className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <button
                onClick={() => setIsLoginModalOpen(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 active:scale-98 text-white text-xs font-semibold rounded-xl shadow-md transition-all whitespace-nowrap cursor-pointer"
              >
                <LogIn className="w-3.5 h-3.5" />
                <span>Sign In</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>

    <LoginModal
      isOpen={isLoginModalOpen}
      onClose={() => setIsLoginModalOpen(false)}
      onSuccess={(msg) => onNotify?.('Authentication', msg, 'success')}
    />
  </header>
  );
};


