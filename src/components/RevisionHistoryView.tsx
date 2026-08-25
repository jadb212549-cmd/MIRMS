import React, { useState, useMemo } from 'react';
import { ReferenceRegistration, ReferenceRevisionRecord, MasterItem, AppConfig } from '../types';
import { 
  History, 
  Search, 
  Filter, 
  Layers, 
  Eye, 
  ArrowLeftRight, 
  Download, 
  Printer, 
  Clock, 
  ShieldCheck, 
  XCircle, 
  Calendar, 
  User, 
  Tag, 
  X
} from 'lucide-react';
import { excelService } from '../services/excelService';
import { RevisionAuditSnapshotModal } from './RevisionAuditSnapshotModal';
import { RevisionCompareModal } from './RevisionCompareModal';
import { RevisionAuditDossierModal } from './RevisionAuditDossierModal';

interface RevisionHistoryViewProps {
  registrations: ReferenceRegistration[];
  masterItems: MasterItem[];
  config: AppConfig;
  onRefreshData: () => Promise<void>;
  onOpenDetailModal?: (reg: ReferenceRegistration) => void;
}

export const RevisionHistoryView: React.FC<RevisionHistoryViewProps> = ({
  registrations,
  masterItems,
  config,
  onRefreshData,
  onOpenDetailModal
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'APPROVED' | 'PENDING_APPROVAL' | 'REJECTED'>('ALL');
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Modals state
  const [selectedForCompare, setSelectedForCompare] = useState<{
    registration: ReferenceRegistration;
    revision: ReferenceRevisionRecord;
  } | null>(null);

  const [inspectSnapshot, setInspectSnapshot] = useState<{
    registration: ReferenceRegistration;
    revision: ReferenceRevisionRecord;
  } | null>(null);

  const [dossierRegistration, setDossierRegistration] = useState<ReferenceRegistration | null>(null);

  // Master Items Map
  const masterMap = useMemo(() => {
    const map = new Map<string, MasterItem>();
    masterItems.forEach((m) => map.set(m.productCode.toLowerCase(), m));
    return map;
  }, [masterItems]);

  // Extract all historical revisions across the system
  const allRevisionsHistory = useMemo(() => {
    const list: Array<{ registration: ReferenceRegistration; revision: ReferenceRevisionRecord }> = [];
    for (const reg of registrations) {
      if (reg.versions) {
        for (const rev of reg.versions) {
          list.push({ registration: reg, revision: rev });
        }
      }
    }
    return list.sort((a, b) => new Date(b.revision.submittedAt || 0).getTime() - new Date(a.revision.submittedAt || 0).getTime());
  }, [registrations]);

  // Filtered lists based on search and selected filters
  const filteredHistory = useMemo(() => {
    return allRevisionsHistory.filter(({ registration, revision }) => {
      const master = masterMap.get(registration.productCode.toLowerCase());
      const q = searchTerm.toLowerCase();

      const matchesSearch =
        !searchTerm.trim() ||
        registration.productCode.toLowerCase().includes(q) ||
        revision.revisionCode.toLowerCase().includes(q) ||
        revision.submittedBy.toLowerCase().includes(q) ||
        (revision.changeSummary && revision.changeSummary.toLowerCase().includes(q)) ||
        (revision.revisionNotes && revision.revisionNotes.toLowerCase().includes(q)) ||
        (master && master.description.toLowerCase().includes(q));

      const matchesStatus = statusFilter === 'ALL' || revision.status === statusFilter;
      const matchesCategory = categoryFilter === 'ALL' || (master && master.category === categoryFilter);

      return matchesSearch && matchesStatus && matchesCategory;
    });
  }, [allRevisionsHistory, searchTerm, statusFilter, categoryFilter, masterMap]);

  const distinctCategories = useMemo(() => {
    const cats = Array.from(new Set(masterItems.map((m) => m.category).filter(Boolean))) as string[];
    return cats.sort((a, b) => a.localeCompare(b));
  }, [masterItems]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await onRefreshData();
    setIsRefreshing(false);
  };

  const handleExportAllHistoryExcel = () => {
    excelService.exportRevisionAuditHistory(registrations, masterItems, 'Reference_Registry_Full_Revision_History.xlsx');
  };

  return (
    <div className="space-y-4 select-none animate-in fade-in duration-150">
      {/* Top Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-[#141414] border border-[#222] rounded-xl p-4 flex items-center justify-between shadow-xs">
          <div className="space-y-1">
            <span className="text-[11px] font-mono font-semibold text-emerald-400 uppercase tracking-wider">
              Approved Revisions
            </span>
            <div className="text-2xl font-bold font-mono text-gray-100">
              {allRevisionsHistory.filter(({ revision }) => revision.status === 'APPROVED').length}
            </div>
            <p className="text-[11px] text-gray-400">
              Active baselines successfully signed-off and implemented
            </p>
          </div>
          <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-lg text-emerald-400">
            <ShieldCheck className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-[#141414] border border-[#222] rounded-xl p-4 flex items-center justify-between shadow-xs">
          <div className="space-y-1">
            <span className="text-[11px] font-mono font-semibold text-amber-400 uppercase tracking-wider">
              Pending Approvals
            </span>
            <div className="text-2xl font-bold font-mono text-gray-100">
              {allRevisionsHistory.filter(({ revision }) => revision.status === 'PENDING_APPROVAL').length}
            </div>
            <p className="text-[11px] text-gray-400">
              Proposed modifications awaiting Administrator QA review
            </p>
          </div>
          <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg text-amber-400">
            <Clock className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-[#141414] border border-[#222] rounded-xl p-4 flex items-center justify-between shadow-xs">
          <div className="space-y-1">
            <span className="text-[11px] font-mono font-semibold text-purple-400 uppercase tracking-wider">
              Total Recorded Revisions
            </span>
            <div className="text-2xl font-bold font-mono text-gray-100">
              {allRevisionsHistory.length}
            </div>
            <p className="text-[11px] text-gray-400">
              Full chronological registry across all reference items
            </p>
          </div>
          <div className="p-3 bg-purple-500/10 border border-purple-500/20 rounded-lg text-purple-400">
            <History className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Control Panel: Filters & Actions */}
      <div className="bg-[#141414] p-4 rounded-xl border border-[#222] flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
        {/* Search Input */}
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-gray-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search revision history by product code, submitter, justification, description..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-xs bg-[#1A1A1A] border border-[#333] text-gray-200 placeholder-gray-500 rounded-lg focus:outline-hidden focus:border-blue-500 transition-colors"
          />
        </div>

        {/* Filters Group */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Status Filter */}
          <div className="flex items-center gap-1.5 bg-[#1A1A1A] border border-[#333] px-2.5 py-1.5 rounded-lg text-xs">
            <span className="text-gray-400 font-medium">Status:</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="bg-transparent font-semibold text-gray-200 focus:outline-hidden cursor-pointer font-mono"
            >
              <option value="ALL" className="bg-[#1A1A1A] text-gray-200">All Statuses</option>
              <option value="APPROVED" className="bg-[#1A1A1A] text-emerald-400">APPROVED</option>
              <option value="PENDING_APPROVAL" className="bg-[#1A1A1A] text-amber-400 font-bold">PENDING APPROVAL</option>
              <option value="REJECTED" className="bg-[#1A1A1A] text-red-400">REJECTED</option>
            </select>
          </div>

          {/* Category Filter */}
          <div className="flex items-center gap-1.5 bg-[#1A1A1A] border border-[#333] px-2.5 py-1.5 rounded-lg text-xs">
            <span className="text-gray-400 font-medium">Category:</span>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="bg-transparent font-semibold text-gray-200 focus:outline-hidden cursor-pointer"
            >
              <option value="ALL" className="bg-[#1A1A1A] text-gray-200">All Categories</option>
              {distinctCategories.map((cat) => (
                <option key={cat} value={cat} className="bg-[#1A1A1A] text-gray-200">
                  {cat}
                </option>
              ))}
            </select>
          </div>

          <button
            onClick={handleExportAllHistoryExcel}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-emerald-400 bg-[#1A1A1A] border border-[#333] hover:bg-[#252525] rounded-lg transition-colors cursor-pointer"
            title="Export full revision history ledger to Excel"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export Excel</span>
          </button>

          <button
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="p-2 text-gray-400 hover:text-gray-200 bg-[#1A1A1A] hover:bg-[#252525] rounded-lg border border-[#333] transition-colors"
            title="Refresh Ledger"
          >
            <Layers className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Main Ledger Table */}
      <div className="bg-[#141414] rounded-xl border border-[#222] overflow-hidden">
        {filteredHistory.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-[#222] bg-[#0A0A0A] text-gray-400 font-mono text-[10px] uppercase tracking-wider">
                  <th className="px-4 py-3 font-semibold">Product Code</th>
                  <th className="px-4 py-3 font-semibold">Revision / Version</th>
                  <th className="px-4 py-3 font-semibold">Verification Status</th>
                  <th className="px-4 py-3 font-semibold">Submitted By / Date</th>
                  <th className="px-4 py-3 font-semibold">QA Audit Details</th>
                  <th className="px-4 py-3 font-semibold">Justification / Summary</th>
                  <th className="px-4 py-3 text-right font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#222]">
                {filteredHistory.map(({ registration, revision }) => (
                  <tr key={revision.id} className="hover:bg-[#1A1A1A]/50 transition-colors">
                    <td className="px-4 py-3 font-mono font-bold text-gray-100">
                      <button
                        onClick={() => onOpenDetailModal && onOpenDetailModal(registration)}
                        className="hover:text-blue-400 text-left transition-colors cursor-pointer focus:outline-hidden"
                      >
                        {registration.productCode}
                      </button>
                    </td>
                    <td className="px-4 py-3 font-mono">
                      <span className="font-semibold text-blue-400">{revision.revisionCode}</span>
                      <span className="text-gray-500 ml-1.5">(v{revision.versionNumber})</span>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded ${
                          revision.status === 'APPROVED'
                            ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                            : revision.status === 'PENDING_APPROVAL'
                            ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                            : 'bg-red-500/15 text-red-400 border border-red-500/30'
                        }`}
                      >
                        {revision.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-200 flex items-center gap-1">
                        <User className="w-3 h-3 text-gray-400" />
                        {revision.submittedBy}
                      </div>
                      <div className="text-[10px] text-gray-500 font-mono flex items-center gap-1 mt-0.5">
                        <Calendar className="w-3 h-3" />
                        {new Date(revision.submittedAt).toLocaleDateString()}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {revision.approvedBy ? (
                        <div>
                          <div className="font-medium text-emerald-400 flex items-center gap-1">
                            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                            {revision.approvedBy}
                          </div>
                          <div className="text-[10px] text-gray-500 font-mono mt-0.5">
                            {revision.approvedAt ? new Date(revision.approvedAt).toLocaleDateString() : ''}
                          </div>
                        </div>
                      ) : revision.rejectedBy ? (
                        <div>
                          <div className="font-medium text-red-400 flex items-center gap-1">
                            <XCircle className="w-3.5 h-3.5" />
                            {revision.rejectedBy}
                          </div>
                          <div className="text-[10px] text-gray-500 font-mono mt-0.5">
                            {revision.rejectedAt ? new Date(revision.rejectedAt).toLocaleDateString() : ''}
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1 text-amber-400 font-medium">
                          <Clock className="w-3.5 h-3.5" />
                          <span>Pending Review</span>
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 max-w-xs truncate text-gray-400" title={revision.changeSummary || revision.revisionNotes || ''}>
                      {revision.changeSummary || revision.revisionNotes || 'Baseline reference registration'}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => setInspectSnapshot({ registration, revision })}
                          className="px-2.5 py-1 text-[11px] font-semibold text-gray-300 hover:text-white bg-[#222] hover:bg-[#2A2A2A] rounded-lg border border-[#333] transition-colors cursor-pointer"
                          title="Inspect revision snapshot"
                        >
                          <Eye className="w-3 h-3 text-purple-400 inline-block mr-1" />
                          <span>Inspect</span>
                        </button>
                        
                        {revision.versionNumber > 1 && (
                          <button
                            onClick={() => {
                              const prev = registration.versions?.find(v => v.versionNumber === revision.versionNumber - 1);
                              setSelectedForCompare({ registration, revision });
                            }}
                            className="px-2.5 py-1 text-[11px] font-semibold text-blue-400 hover:text-blue-300 bg-blue-500/10 hover:bg-blue-500/20 rounded-lg border border-blue-500/20 transition-colors cursor-pointer"
                          >
                            <ArrowLeftRight className="w-3 h-3 inline-block mr-1" />
                            <span>Compare</span>
                          </button>
                        )}

                        <button
                          onClick={() => setDossierRegistration(registration)}
                          className="p-1 text-gray-400 hover:text-purple-300 bg-[#222] hover:bg-purple-500/20 rounded border border-[#333] transition-colors cursor-pointer"
                          title="Full Item Dossier"
                        >
                          <History className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-8 text-center text-gray-400">
            <History className="w-10 h-10 text-gray-600 mx-auto mb-2" />
            <p className="text-sm font-semibold">No revision records match current filters.</p>
            <p className="text-xs text-gray-500 mt-1">Try resetting your search query or choosing another tab.</p>
          </div>
        )}
      </div>

      {/* Side-by-Side Compare Modal */}
      {selectedForCompare && (
        <RevisionCompareModal
          onClose={() => setSelectedForCompare(null)}
          registration={selectedForCompare.registration}
          masterItem={masterMap.get(selectedForCompare.registration.productCode.toLowerCase())}
          initialRevA={selectedForCompare.registration.versions?.find(v => v.versionNumber === selectedForCompare.revision.versionNumber - 1)}
          initialRevB={selectedForCompare.revision}
        />
      )}

      {/* Inspect Revision Snapshot Modal */}
      {inspectSnapshot && (
        <RevisionAuditSnapshotModal
          onClose={() => setInspectSnapshot(null)}
          registration={inspectSnapshot.registration}
          revision={inspectSnapshot.revision}
          masterItem={masterMap.get(inspectSnapshot.registration.productCode.toLowerCase())}
        />
      )}

      {/* Full Audit Dossier Modal */}
      {dossierRegistration && (
        <RevisionAuditDossierModal
          registration={dossierRegistration}
          masterItem={masterMap.get(dossierRegistration.productCode.toLowerCase())}
          onClose={() => setDossierRegistration(null)}
        />
      )}
    </div>
  );
};
