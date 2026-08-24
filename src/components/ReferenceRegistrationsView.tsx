import React, { useState, useMemo, useEffect } from 'react';
import { ReferenceRegistration, MasterItem, AppConfig } from '../types';
import { 
  ShieldCheck, 
  Search, 
  Filter, 
  Plus, 
  FileText, 
  FileSpreadsheet, 
  LayoutGrid, 
  List, 
  Image, 
  Paperclip, 
  Eye, 
  Download, 
  Printer, 
  History,
  Clock,
  Edit3
} from 'lucide-react';
import { excelService } from '../services/excelService';
import { wordService } from '../services/wordService';
import { userService } from '../services/userService';
import { InspectionProofModal } from './InspectionProofModal';
import { RevisionAuditDossierModal } from './RevisionAuditDossierModal';

interface ReferenceRegistrationsViewProps {
  registrations: ReferenceRegistration[];
  masterItems: MasterItem[];
  config: AppConfig;
  onOpenCreateModal: () => void;
  onOpenEditModal: (reg: ReferenceRegistration) => void;
  onOpenDetailModal: (reg: ReferenceRegistration) => void;
  globalSearchQuery?: string;
  onSearchChange?: (query: string) => void;
}

export const ReferenceRegistrationsView: React.FC<ReferenceRegistrationsViewProps> = ({
  registrations,
  masterItems,
  config,
  onOpenCreateModal,
  onOpenEditModal,
  onOpenDetailModal,
  globalSearchQuery = '',
  onSearchChange
}) => {
  const [currentUser, setCurrentUser] = useState(userService.getCurrentUser());

  useEffect(() => {
    const unsubscribe = userService.subscribe(() => {
      setCurrentUser(userService.getCurrentUser());
    });
    return () => unsubscribe();
  }, []);

  const [localSearch, setLocalSearch] = useState('');
  const [proofRegistration, setProofRegistration] = useState<ReferenceRegistration | null>(null);
  const [auditRegistration, setAuditRegistration] = useState<ReferenceRegistration | null>(null);
  const searchTerm = globalSearchQuery || localSearch;

  const handleSearchChange = (val: string) => {
    setLocalSearch(val);
    if (onSearchChange) {
      onSearchChange(val);
    }
  };
  const [categoryFilter, setCategoryFilter] = useState<'ALL' | 'RM' | 'PS'>('ALL');
  const [formFilter, setFormFilter] = useState<'ALL' | 'GENERATED' | 'PENDING'>('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'APPROVED' | 'PENDING_APPROVAL' | 'PENDING_REVISION' | 'REJECTED'>('ALL');
  const [viewMode, setViewMode] = useState<'GRID' | 'TABLE'>('GRID');

  const masterMap = useMemo(() => {
    const map = new Map<string, MasterItem>();
    masterItems.forEach((m) => map.set(m.productCode.toLowerCase(), m));
    return map;
  }, [masterItems]);

  const filteredRegistrations = useMemo(() => {
    return registrations.filter((reg) => {
      const master = masterMap.get(reg.productCode.toLowerCase());
      const term = searchTerm.toLowerCase();

      const searchMatch =
        searchTerm === '' ||
        reg.productCode.toLowerCase().includes(term) ||
        (master && master.description.toLowerCase().includes(term)) ||
        (reg.supplier && reg.supplier.toLowerCase().includes(term)) ||
        reg.registeredBy.toLowerCase().includes(term) ||
        (reg.specification && reg.specification.toLowerCase().includes(term)) ||
        (reg.remarks && reg.remarks.toLowerCase().includes(term));

      const catMatch =
        categoryFilter === 'ALL' || (master && master.category === categoryFilter);

      const formMatch =
        formFilter === 'ALL' ||
        (formFilter === 'GENERATED' && reg.wordFormGenerated) ||
        (formFilter === 'PENDING' && !reg.wordFormGenerated);

      const statusMatch =
        statusFilter === 'ALL' ||
        (statusFilter === 'APPROVED' && reg.status === 'APPROVED' && !reg.hasPendingRevision) ||
        (statusFilter === 'PENDING_APPROVAL' && reg.status === 'PENDING_APPROVAL') ||
        (statusFilter === 'PENDING_REVISION' && reg.hasPendingRevision) ||
        (statusFilter === 'REJECTED' && reg.status === 'REJECTED');

      return searchMatch && catMatch && formMatch && statusMatch;
    });
  }, [registrations, masterMap, searchTerm, categoryFilter, formFilter, statusFilter]);

  return (
    <div className="space-y-4 select-none">
      {/* Control & Filter Header */}
      <div className="bg-[#141414] p-4 rounded-xl border border-[#222] flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        {/* Search */}
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-gray-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search registered samples by Code, Description, Supplier, Registered By, or Specs..."
            value={searchTerm}
            onChange={(e) => handleSearchChange(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-xs bg-[#1A1A1A] border border-[#333] text-gray-200 placeholder-gray-500 rounded-lg focus:outline-hidden focus:border-blue-500 transition-colors"
          />
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Category Filter */}
          <div className="flex items-center gap-1.5 bg-[#1A1A1A] border border-[#333] px-2.5 py-1.5 rounded-lg text-xs">
            <span className="text-gray-400 font-medium">Category:</span>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value as any)}
              className="bg-transparent font-semibold text-gray-200 focus:outline-hidden cursor-pointer"
            >
              <option value="ALL" className="bg-[#1A1A1A] text-gray-200">All Categories</option>
              <option value="RM" className="bg-[#1A1A1A] text-gray-200">Raw Material (RM)</option>
              <option value="PS" className="bg-[#1A1A1A] text-gray-200">Prod Supply (PS)</option>
            </select>
          </div>

          {/* Form Status Filter */}
          <div className="flex items-center gap-1.5 bg-[#1A1A1A] border border-[#333] px-2.5 py-1.5 rounded-lg text-xs">
            <span className="text-gray-400 font-medium">Word Form:</span>
            <select
              value={formFilter}
              onChange={(e) => setFormFilter(e.target.value as any)}
              className="bg-transparent font-semibold text-gray-200 focus:outline-hidden cursor-pointer"
            >
              <option value="ALL" className="bg-[#1A1A1A] text-gray-200">All Status</option>
              <option value="GENERATED" className="bg-[#1A1A1A] text-gray-200">Generated Form</option>
              <option value="PENDING" className="bg-[#1A1A1A] text-gray-200">Pending Form</option>
            </select>
          </div>

          {/* Approval Status Filter */}
          <div className="flex items-center gap-1.5 bg-[#1A1A1A] border border-[#333] px-2.5 py-1.5 rounded-lg text-xs">
            <span className="text-gray-400 font-medium">Approval:</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="bg-transparent font-semibold text-gray-200 focus:outline-hidden cursor-pointer"
            >
              <option value="ALL" className="bg-[#1A1A1A] text-gray-200">All Approval States</option>
              <option value="APPROVED" className="bg-[#1A1A1A] text-emerald-400">Approved (Official)</option>
              <option value="PENDING_REVISION" className="bg-[#1A1A1A] text-amber-400">Pending Revision</option>
              <option value="PENDING_APPROVAL" className="bg-[#1A1A1A] text-blue-400">Pending Initial Approval</option>
              <option value="REJECTED" className="bg-[#1A1A1A] text-red-400">Rejected</option>
            </select>
          </div>

          {/* Grid / Table View toggle */}
          <div className="flex items-center bg-[#1A1A1A] p-0.5 rounded-lg border border-[#333]">
            <button
              onClick={() => setViewMode('GRID')}
              className={`p-1.5 rounded-md text-xs transition-colors ${
                viewMode === 'GRID' ? 'bg-[#2A2A2A] text-blue-400 shadow-xs' : 'text-gray-400 hover:text-gray-200'
              }`}
              title="Grid Cards View"
            >
              <LayoutGrid className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setViewMode('TABLE')}
              className={`p-1.5 rounded-md text-xs transition-colors ${
                viewMode === 'TABLE' ? 'bg-[#2A2A2A] text-blue-400 shadow-xs' : 'text-gray-400 hover:text-gray-200'
              }`}
              title="Table Dense View"
            >
              <List className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Export buttons */}
          <button
            onClick={() => excelService.exportRegistrations(filteredRegistrations, masterItems)}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-gray-200 bg-[#222] hover:bg-[#2A2A2A] rounded-lg border border-[#333] transition-colors"
            title="Export Reference Samples to Excel"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-green-400" />
            <span className="hidden sm:inline">Export Excel</span>
          </button>

          <button
            onClick={() => excelService.exportRevisionAuditHistory(filteredRegistrations, masterItems)}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-purple-300 bg-purple-500/10 hover:bg-purple-500/20 rounded-lg border border-purple-500/20 transition-colors"
            title="Export Complete Revision History & Audit Trail to Excel (.xlsx)"
          >
            <History className="w-3.5 h-3.5 text-purple-400" />
            <span className="hidden sm:inline">Audit Log (.xlsx)</span>
          </button>

          {/* Register New Reference */}
          {currentUser && (
            <button
              onClick={onOpenCreateModal}
              className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm transition-colors shrink-0 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Register Reference Sample</span>
            </button>
          )}
        </div>
      </div>

      {/* Main View: Grid vs Table */}
      {filteredRegistrations.length === 0 ? (
        <div className="bg-[#121212] rounded-xl border border-[#222] p-12 text-center text-gray-500 shadow-xs">
          <ShieldCheck className="w-10 h-10 mx-auto text-gray-600 mb-2" />
          <h3 className="font-semibold text-gray-300 text-sm">No sample reference registrations found.</h3>
          <p className="text-xs text-gray-500 mt-1">Register a new physical specimen or adjust search parameters.</p>
          {currentUser && (
            <button
              onClick={onOpenCreateModal}
              className="mt-4 inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors cursor-pointer"
            >
              <Plus className="w-4 h-4" /> Register Sample Now
            </button>
          )}
        </div>
      ) : viewMode === 'GRID' ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredRegistrations.map((reg) => {
            const master = masterMap.get(reg.productCode.toLowerCase());
            const hasPhoto = reg.photos && reg.photos.length > 0;

            return (
              <div
                key={reg.id}
                className="bg-[#161616] rounded-xl border border-[#222] shadow-xs hover:border-[#333] transition-all overflow-hidden flex flex-col justify-between"
              >
                <div>
                  {/* Photo Banner / Thumbnail */}
                  <div className="relative h-36 bg-[#1A1A1A] border-b border-[#222] overflow-hidden flex items-center justify-center">
                    {hasPhoto ? (
                      <img
                        src={reg.photos[0].dataUrl}
                        alt={reg.productCode}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="text-center text-gray-500 p-4">
                        <Image className="w-8 h-8 mx-auto mb-1 opacity-40" />
                        <span className="text-[11px] font-mono">No specimen photo</span>
                      </div>
                    )}

                    {/* Top Badges */}
                    <div className="absolute top-2 left-2 flex items-center gap-1">
                      <span className="text-[10px] font-mono font-bold bg-black/80 text-blue-400 px-2 py-0.5 rounded border border-[#333]">
                        {reg.productCode}
                      </span>
                      {reg.hasPendingRevision && (
                        <span className="text-[9px] font-mono font-bold bg-amber-500 text-black px-1.5 py-0.5 rounded animate-pulse" title="Proposed revision waiting for Admin approval">
                          REV PENDING
                        </span>
                      )}
                    </div>

                    <div className="absolute top-2 right-2 flex items-center gap-1">
                      <span className="text-[10px] font-mono font-bold bg-[#161616]/90 text-gray-300 px-2 py-0.5 rounded border border-[#333]">
                        {reg.revision}
                      </span>
                      <span
                        className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded ${
                          master?.category === 'RM'
                            ? 'bg-[#222] text-blue-400 border border-blue-900/40'
                            : 'bg-[#222] text-purple-400 border border-purple-900/40'
                        }`}
                      >
                        {master?.category || 'RM'}
                      </span>
                      <span
                        className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded ${
                          reg.status === 'APPROVED'
                            ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                            : reg.status === 'PENDING_APPROVAL'
                            ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                            : 'bg-red-500/20 text-red-400 border border-red-500/30'
                        }`}
                      >
                        {reg.status || 'APPROVED'}
                      </span>
                    </div>
                  </div>

                  {/* Body Content */}
                  <div className="p-4 space-y-2.5">
                    <p className="text-xs font-semibold text-gray-100 line-clamp-2 leading-snug">
                      {master?.description || 'Material reference specimen'}
                    </p>

                    {reg.specification && (
                      <p className="text-[11px] text-gray-400 line-clamp-2 bg-[#1A1A1A] p-2 rounded border border-[#2A2A2A]">
                        {reg.specification}
                      </p>
                    )}

                    <div className="pt-2 border-t border-[#222] text-[11px] text-gray-500 space-y-1 font-mono">
                      <div className="flex items-center justify-between">
                        <span className="text-gray-500 font-sans">Registered By:</span>
                        <strong className="text-gray-300 font-sans">{reg.registeredBy}</strong>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-gray-500 font-sans">Date:</span>
                        <span className="text-gray-400">{reg.registrationDate}</span>
                      </div>
                      {reg.supplier && (
                        <div className="flex items-center justify-between">
                          <span className="text-gray-500 font-sans">Supplier:</span>
                          <span className="truncate max-w-[140px] text-gray-300 font-sans">{reg.supplier}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Card Actions Footer */}
                <div className="px-4 py-3 bg-[#121212] border-t border-[#222] flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 text-[11px] text-gray-500">
                    {hasPhoto && (
                      <span className="flex items-center gap-1 text-blue-400 font-medium font-mono text-[10px]">
                        <Image className="w-3 h-3" /> {reg.photos.length}
                      </span>
                    )}
                    {reg.attachments?.length > 0 && (
                      <span className="flex items-center gap-1 text-amber-400 font-medium font-mono text-[10px]">
                        <Paperclip className="w-3 h-3" /> {reg.attachments.length}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-1.5">
                    {/* If item is pending approval: all functions are removed except View Details and Edit */}
                    {reg.status === 'PENDING_APPROVAL' ? (
                      <>
                        {currentUser && (
                          <button
                            onClick={() => onOpenEditModal(reg)}
                            title="Edit Pending Registration"
                            className="flex items-center gap-1 px-2.5 py-1 text-xs font-semibold bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 rounded border border-amber-500/30 transition-colors cursor-pointer"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                            <span>Edit</span>
                          </button>
                        )}
                        <button
                          onClick={() => onOpenDetailModal(reg)}
                          className="px-2.5 py-1 text-xs font-semibold bg-[#222] text-gray-200 hover:bg-[#2A2A2A] rounded border border-[#333] transition-colors cursor-pointer"
                        >
                          View Details
                        </button>
                      </>
                    ) : (
                      <>
                        {currentUser && (
                          <button
                            onClick={() => onOpenEditModal(reg)}
                            title="Edit / Propose Revision"
                            className="p-1.5 text-gray-400 hover:text-amber-300 bg-[#1A1A1A] hover:bg-amber-500/10 rounded border border-[#333] hover:border-amber-500/30 transition-colors cursor-pointer"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                        )}
                        <button
                          onClick={() => setAuditRegistration(reg)}
                          title="View Revision Audit History & Diff"
                          className="p-1.5 text-gray-400 hover:text-purple-300 bg-[#1A1A1A] hover:bg-purple-500/20 rounded border border-[#333] hover:border-purple-500/30 transition-colors cursor-pointer"
                        >
                          <History className="w-3.5 h-3.5" />
                        </button>
                        {currentUser && (
                          <button
                            onClick={() => setProofRegistration(reg)}
                            title="Print Inspection Proof"
                            className="p-1.5 text-gray-400 hover:text-emerald-400 bg-[#1A1A1A] hover:bg-[#252525] rounded border border-[#333] transition-colors"
                          >
                            <Printer className="w-3.5 h-3.5" />
                          </button>
                        )}
                        <button
                          onClick={() => {
                            if (master) {
                              wordService.generateAndSave(reg, master, config, reg.registeredBy);
                            }
                          }}
                          title="Generate Official Word Form (DOCX)"
                          className="p-1.5 text-gray-400 hover:text-blue-400 bg-[#1A1A1A] hover:bg-[#252525] rounded border border-[#333] transition-colors"
                        >
                          <FileText className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => onOpenDetailModal(reg)}
                          className="px-2.5 py-1 text-xs font-semibold bg-[#222] text-gray-200 hover:bg-[#2A2A2A] rounded border border-[#333] transition-colors"
                        >
                          View Details
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* Table View */
        <div className="bg-[#121212] rounded-xl border border-[#222] overflow-hidden flex flex-col">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-[#0A0A0A] border-b border-[#222] text-gray-500 font-mono uppercase tracking-wider text-[10px]">
                  <th className="py-3 px-4 w-44 font-medium">Product Code</th>
                  <th className="py-3 px-4 font-medium">Description</th>
                  <th className="py-3 px-3 w-20 font-medium">Rev</th>
                  <th className="py-3 px-3 w-28 font-medium">Category</th>
                  <th className="py-3 px-3 w-32 font-medium">Status</th>
                  <th className="py-3 px-3 w-36 font-medium">Registered By</th>
                  <th className="py-3 px-3 w-28 font-medium">Reg Date</th>
                  <th className="py-3 px-3 w-24 text-center font-medium">Files</th>
                  <th className="py-3 px-3 w-32 font-medium">Word Form</th>
                  <th className="py-3 px-4 w-36 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#222]">
                {filteredRegistrations.map((reg) => {
                  const master = masterMap.get(reg.productCode.toLowerCase());
                  return (
                    <tr key={reg.id} className="hover:bg-[#1A1A1A] transition-colors group">
                      <td className="py-3 px-4 font-mono font-bold text-blue-400">
                        <div className="flex items-center gap-1.5">
                          <span>{reg.productCode}</span>
                          {reg.hasPendingRevision && (
                            <span className="text-[9px] font-mono font-bold bg-amber-500 text-black px-1 rounded animate-pulse" title="Pending revision">
                              REV
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-gray-200 font-medium max-w-xs truncate">
                        {master?.description || reg.specification || '-'}
                      </td>
                      <td className="py-3 px-3">
                        <span className="font-semibold px-2 py-0.5 rounded bg-[#222] text-gray-300 border border-[#333] text-[10px] font-mono">
                          {reg.revision}
                        </span>
                      </td>
                      <td className="py-3 px-3 font-mono">
                        <span
                          className={`text-[10px] font-semibold px-2 py-0.5 rounded ${
                            master?.category === 'RM'
                              ? 'bg-[#222] text-blue-400 border border-blue-900/40'
                              : 'bg-[#222] text-purple-400 border border-purple-900/40'
                          }`}
                        >
                          {master?.category || 'RM'}
                        </span>
                      </td>
                      <td className="py-3 px-3">
                        <span
                          className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded ${
                            reg.status === 'APPROVED'
                              ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                              : reg.status === 'PENDING_APPROVAL'
                              ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                              : 'bg-red-500/15 text-red-400 border border-red-500/30'
                          }`}
                        >
                          {reg.status || 'APPROVED'}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-gray-300 font-medium">
                        {reg.registeredBy}
                      </td>
                      <td className="py-3 px-3 text-gray-400 font-mono">
                        {reg.registrationDate}
                      </td>
                      <td className="py-3 px-3 text-center font-mono">
                        <div className="flex items-center justify-center gap-2 text-[11px]">
                          <span className="text-blue-400 font-medium flex items-center gap-0.5">
                            <Image className="w-3 h-3" /> {reg.photos?.length || 0}
                          </span>
                          <span className="text-amber-400 font-medium flex items-center gap-0.5">
                            <Paperclip className="w-3 h-3" /> {reg.attachments?.length || 0}
                          </span>
                        </div>
                      </td>
                      <td className="py-3 px-3">
                        <span
                          className={`text-[10px] font-semibold px-2 py-0.5 rounded font-mono ${
                            reg.wordFormGenerated
                              ? 'bg-green-500/10 text-green-400 border border-green-500/20'
                              : 'bg-[#222] text-gray-400 border border-[#333]'
                          }`}
                        >
                          {reg.wordFormGenerated ? 'Generated' : 'Pending'}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {reg.status === 'PENDING_APPROVAL' ? (
                            <>
                              {currentUser && (
                                <button
                                  onClick={() => onOpenEditModal(reg)}
                                  title="Edit Pending Registration"
                                  className="flex items-center gap-1 px-2.5 py-1 text-xs font-semibold bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 rounded border border-amber-500/30 transition-colors cursor-pointer"
                                >
                                  <Edit3 className="w-3.5 h-3.5" />
                                  <span>Edit</span>
                                </button>
                              )}
                              <button
                                onClick={() => onOpenDetailModal(reg)}
                                className="px-2.5 py-1 text-xs font-semibold bg-[#222] hover:bg-[#2A2A2A] text-gray-200 rounded border border-[#333] transition-colors cursor-pointer"
                              >
                                Details
                              </button>
                            </>
                          ) : (
                            <>
                              {currentUser && (
                                <button
                                  onClick={() => onOpenEditModal(reg)}
                                  title="Edit / Propose Revision"
                                  className="p-1 text-gray-400 hover:text-amber-300 bg-[#1A1A1A] hover:bg-amber-500/10 rounded border border-[#333] hover:border-amber-500/30 transition-colors cursor-pointer"
                                >
                                  <Edit3 className="w-3.5 h-3.5" />
                                </button>
                              )}
                              <button
                                onClick={() => setAuditRegistration(reg)}
                                title="View Revision Audit History & Diff"
                                className="p-1 text-gray-400 hover:text-purple-300 bg-[#1A1A1A] hover:bg-purple-500/20 rounded border border-[#333] hover:border-purple-500/30 transition-colors cursor-pointer"
                              >
                                <History className="w-3.5 h-3.5" />
                              </button>
                              {currentUser && (
                                <button
                                  onClick={() => setProofRegistration(reg)}
                                  title="Print Inspection Proof"
                                  className="p-1 text-gray-400 hover:text-emerald-400 bg-[#1A1A1A] hover:bg-[#252525] rounded border border-[#333] transition-colors"
                                >
                                  <Printer className="w-3.5 h-3.5" />
                                </button>
                              )}
                              <button
                                onClick={() => {
                                  if (master) {
                                    wordService.generateAndSave(reg, master, config, reg.registeredBy);
                                  }
                                }}
                                title="Generate Word DOCX Form"
                                className="p-1 text-gray-400 hover:text-blue-400 bg-[#1A1A1A] hover:bg-[#252525] rounded border border-[#333] transition-colors"
                              >
                                <FileText className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => onOpenDetailModal(reg)}
                                className="px-2.5 py-1 text-xs font-semibold bg-[#222] hover:bg-[#2A2A2A] text-gray-200 rounded border border-[#333] transition-colors"
                              >
                                Details
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Print Inspection Proof Modal */}
      {proofRegistration && (
        <InspectionProofModal
          isOpen={!!proofRegistration}
          onClose={() => setProofRegistration(null)}
          registration={proofRegistration}
          masterItem={masterMap.get(proofRegistration.productCode.toLowerCase())}
          config={config}
        />
      )}

      {/* Revision Audit Dossier Modal */}
      {auditRegistration && (
        <RevisionAuditDossierModal
          registration={auditRegistration}
          masterItem={masterMap.get(auditRegistration.productCode.toLowerCase())}
          onClose={() => setAuditRegistration(null)}
        />
      )}
    </div>
  );
};
