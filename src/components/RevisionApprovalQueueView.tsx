import React, { useState, useMemo } from 'react';
import { ReferenceRegistration, ReferenceRevisionRecord, MasterItem, AppConfig } from '../types';
import { 
  ShieldCheck, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  Eye, 
  Layers, 
  Search, 
  Filter, 
  ArrowRight, 
  AlertTriangle, 
  FileText, 
  User, 
  Calendar, 
  Tag, 
  Image as ImageIcon, 
  Paperclip, 
  Check, 
  X, 
  RotateCcw, 
  Sparkles,
  Info,
  ChevronRight,
  ExternalLink,
  MessageSquare,
  History,
  FileSpreadsheet,
  ArrowLeftRight
} from 'lucide-react';
import { db } from '../services/db';
import { userService } from '../services/userService';
import { excelService } from '../services/excelService';
import { RevisionAuditSnapshotModal } from './RevisionAuditSnapshotModal';
import { RevisionAuditDossierModal } from './RevisionAuditDossierModal';

interface RevisionApprovalQueueViewProps {
  registrations: ReferenceRegistration[];
  masterItems: MasterItem[];
  config: AppConfig;
  onRefreshData: () => Promise<void>;
  onOpenDetailModal?: (reg: ReferenceRegistration) => void;
}

export const RevisionApprovalQueueView: React.FC<RevisionApprovalQueueViewProps> = ({
  registrations,
  masterItems,
  config,
  onRefreshData,
  onOpenDetailModal
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState<'PENDING_REVISIONS' | 'PENDING_NEW' | 'ALL_HISTORY'>('PENDING_REVISIONS');
  const [selectedForCompare, setSelectedForCompare] = useState<{
    registration: ReferenceRegistration;
    revision: ReferenceRevisionRecord;
  } | null>(null);
  
  // Auditing modals
  const [inspectSnapshot, setInspectSnapshot] = useState<{
    registration: ReferenceRegistration;
    revision: ReferenceRevisionRecord;
  } | null>(null);
  const [dossierRegistration, setDossierRegistration] = useState<ReferenceRegistration | null>(null);

  // Approval / Rejection Action States
  const [actionModal, setActionModal] = useState<{
    type: 'APPROVE_REVISION' | 'REJECT_REVISION' | 'APPROVE_NEW' | 'REJECT_NEW';
    registration: ReferenceRegistration;
    revision?: ReferenceRevisionRecord;
  } | null>(null);
  const [actionNotes, setActionNotes] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  // Master Items Map
  const masterMap = useMemo(() => {
    const map = new Map<string, MasterItem>();
    masterItems.forEach((m) => map.set(m.productCode.toLowerCase(), m));
    return map;
  }, [masterItems]);

  // Extract pending revisions from all registrations
  const pendingRevisions = useMemo(() => {
    const list: Array<{ registration: ReferenceRegistration; revision: ReferenceRevisionRecord }> = [];
    for (const reg of registrations) {
      if (reg.versions) {
        for (const rev of reg.versions) {
          if (rev.status === 'PENDING_APPROVAL' && rev.versionNumber > 1) {
            list.push({ registration: reg, revision: rev });
          }
        }
      }
    }
    return list.sort((a, b) => new Date(b.revision.submittedAt).getTime() - new Date(a.revision.submittedAt).getTime());
  }, [registrations]);

  // Extract pending new registrations
  const pendingNewRegistrations = useMemo(() => {
    return registrations.filter(
      (r) => r.status === 'PENDING_APPROVAL' && (!r.currentVersionNumber || r.currentVersionNumber <= 1)
    );
  }, [registrations]);

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

  // Filtered lists based on search
  const filteredPendingRevisions = useMemo(() => {
    if (!searchTerm.trim()) return pendingRevisions;
    const q = searchTerm.toLowerCase();
    return pendingRevisions.filter(({ registration, revision }) => {
      const master = masterMap.get(registration.productCode.toLowerCase());
      return (
        registration.productCode.toLowerCase().includes(q) ||
        revision.revisionCode.toLowerCase().includes(q) ||
        revision.submittedBy.toLowerCase().includes(q) ||
        (revision.changeSummary && revision.changeSummary.toLowerCase().includes(q)) ||
        (master && master.description.toLowerCase().includes(q))
      );
    });
  }, [pendingRevisions, searchTerm, masterMap]);

  const filteredPendingNew = useMemo(() => {
    if (!searchTerm.trim()) return pendingNewRegistrations;
    const q = searchTerm.toLowerCase();
    return pendingNewRegistrations.filter((reg) => {
      const master = masterMap.get(reg.productCode.toLowerCase());
      return (
        reg.productCode.toLowerCase().includes(q) ||
        reg.registeredBy.toLowerCase().includes(q) ||
        (master && master.description.toLowerCase().includes(q))
      );
    });
  }, [pendingNewRegistrations, searchTerm, masterMap]);

  const filteredAllHistory = useMemo(() => {
    if (!searchTerm.trim()) return allRevisionsHistory;
    const q = searchTerm.toLowerCase();
    return allRevisionsHistory.filter(({ registration, revision }) => {
      const master = masterMap.get(registration.productCode.toLowerCase());
      return (
        registration.productCode.toLowerCase().includes(q) ||
        revision.revisionCode.toLowerCase().includes(q) ||
        revision.submittedBy.toLowerCase().includes(q) ||
        (revision.approvedBy && revision.approvedBy.toLowerCase().includes(q)) ||
        (master && master.description.toLowerCase().includes(q))
      );
    });
  }, [allRevisionsHistory, searchTerm, masterMap]);

  // Action Handlers
  const handleConfirmAction = async () => {
    if (!actionModal) return;
    const currentUser = userService.getCurrentUser();
    if (!currentUser || currentUser.role !== 'admin') {
      setActionError('Permission Denied: Administrator role is required to approve or reject revisions.');
      return;
    }

    setIsProcessing(true);
    setActionError(null);

    try {
      if (actionModal.type === 'APPROVE_REVISION' && actionModal.revision) {
        const res = await db.approveRevision(
          actionModal.registration.id,
          actionModal.revision.id,
          currentUser,
          actionNotes
        );
        if (!res.success) {
          setActionError(res.error || 'Failed to approve revision.');
          setIsProcessing(false);
          return;
        }
        setActionSuccess(`Revision ${actionModal.revision.revisionCode} for ${actionModal.registration.productCode} successfully approved as official version!`);
      } else if (actionModal.type === 'REJECT_REVISION' && actionModal.revision) {
        if (!actionNotes.trim()) {
          setActionError('Please provide a mandatory reason for rejecting this revision.');
          setIsProcessing(false);
          return;
        }
        const res = await db.rejectRevision(
          actionModal.registration.id,
          actionModal.revision.id,
          currentUser,
          actionNotes
        );
        if (!res.success) {
          setActionError(res.error || 'Failed to reject revision.');
          setIsProcessing(false);
          return;
        }
        setActionSuccess(`Revision ${actionModal.revision.revisionCode} for ${actionModal.registration.productCode} rejected. Official version remains active.`);
      } else if (actionModal.type === 'APPROVE_NEW') {
        const res = await db.approveNewRegistration(actionModal.registration.id, currentUser);
        if (!res.success) {
          setActionError(res.error || 'Failed to approve registration.');
          setIsProcessing(false);
          return;
        }
        setActionSuccess(`New registration for ${actionModal.registration.productCode} approved.`);
      } else if (actionModal.type === 'REJECT_NEW') {
        if (!actionNotes.trim()) {
          setActionError('Please provide a reason for rejecting this new registration.');
          setIsProcessing(false);
          return;
        }
        const res = await db.rejectNewRegistration(actionModal.registration.id, currentUser, actionNotes);
        if (!res.success) {
          setActionError(res.error || 'Failed to reject registration.');
          setIsProcessing(false);
          return;
        }
        setActionSuccess(`New registration for ${actionModal.registration.productCode} rejected.`);
      }

      await onRefreshData();
      setTimeout(() => {
        setActionModal(null);
        setSelectedForCompare(null);
        setActionNotes('');
        setActionSuccess(null);
      }, 1200);
    } catch (err: any) {
      setActionError(err.message || 'An unexpected error occurred.');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner / Stats Overview */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-[#141414] border border-amber-500/30 rounded-xl p-4 flex items-center justify-between shadow-xs">
          <div className="space-y-1">
            <span className="text-[11px] font-mono font-semibold text-amber-400 uppercase tracking-wider">
              Pending Revisions
            </span>
            <div className="text-2xl font-bold font-mono text-gray-100">
              {pendingRevisions.length}
            </div>
            <p className="text-[11px] text-gray-400">
              Awaiting Admin Approval (Active official version preserved)
            </p>
          </div>
          <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg text-amber-400">
            <Clock className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-[#141414] border border-blue-500/30 rounded-xl p-4 flex items-center justify-between shadow-xs">
          <div className="space-y-1">
            <span className="text-[11px] font-mono font-semibold text-blue-400 uppercase tracking-wider">
              Pending New Registrations
            </span>
            <div className="text-2xl font-bold font-mono text-gray-100">
              {pendingNewRegistrations.length}
            </div>
            <p className="text-[11px] text-gray-400">
              New sample submissions awaiting initial approval
            </p>
          </div>
          <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg text-blue-400">
            <ShieldCheck className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-[#141414] border border-emerald-500/30 rounded-xl p-4 flex items-center justify-between shadow-xs">
          <div className="space-y-1">
            <span className="text-[11px] font-mono font-semibold text-emerald-400 uppercase tracking-wider">
              Total Revision Records
            </span>
            <div className="text-2xl font-bold font-mono text-gray-100">
              {allRevisionsHistory.length}
            </div>
            <p className="text-[11px] text-gray-400">
              Complete revision history across entire Reference Registry
            </p>
          </div>
          <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-lg text-emerald-400">
            <Layers className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Tabs & Search Bar */}
      <div className="bg-[#141414] p-4 rounded-xl border border-[#222] flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
        <div className="flex items-center gap-1.5 bg-[#1A1A1A] p-1 rounded-lg border border-[#333]">
          <button
            onClick={() => setActiveTab('PENDING_REVISIONS')}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold flex items-center gap-2 transition-colors ${
              activeTab === 'PENDING_REVISIONS'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'text-gray-400 hover:text-gray-200'
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            <span>Pending Revisions Queue</span>
            {pendingRevisions.length > 0 && (
              <span className="px-1.5 py-0.2 text-[10px] rounded-full bg-amber-500 text-black font-bold">
                {pendingRevisions.length}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('PENDING_NEW')}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold flex items-center gap-2 transition-colors ${
              activeTab === 'PENDING_NEW'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'text-gray-400 hover:text-gray-200'
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Pending New Submissions</span>
            {pendingNewRegistrations.length > 0 && (
              <span className="px-1.5 py-0.2 text-[10px] rounded-full bg-blue-400 text-black font-bold">
                {pendingNewRegistrations.length}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('ALL_HISTORY')}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold flex items-center gap-2 transition-colors ${
              activeTab === 'ALL_HISTORY'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'text-gray-400 hover:text-gray-200'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Full Revision Log</span>
          </button>
        </div>

        <div className="flex items-center gap-2 flex-1 max-w-xl justify-end">
          <div className="relative flex-1 max-w-xs">
            <Search className="w-4 h-4 text-gray-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search revisions, codes, users..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-xs bg-[#1A1A1A] border border-[#333] text-gray-200 placeholder-gray-500 rounded-lg focus:outline-hidden focus:border-blue-500"
            />
          </div>

          <button
            onClick={() => excelService.exportRevisionAuditHistory(registrations, masterItems)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-purple-300 bg-purple-500/10 hover:bg-purple-500/20 border border-purple-500/20 rounded-lg transition-colors shrink-0"
            title="Export full system revision audit ledger to Excel (.xlsx)"
          >
            <History className="w-3.5 h-3.5 text-purple-400" />
            <span className="hidden sm:inline">Export Audit (.xlsx)</span>
          </button>
        </div>
      </div>

      {/* Main Tab Views */}
      {activeTab === 'PENDING_REVISIONS' && (
        <div className="space-y-4">
          {filteredPendingRevisions.length === 0 ? (
            <div className="bg-[#141414] rounded-xl border border-[#222] p-12 text-center text-gray-500">
              <CheckCircle2 className="w-10 h-10 mx-auto text-emerald-500/40 mb-3" />
              <h4 className="text-sm font-semibold text-gray-300">All Revisions Are Reviewed!</h4>
              <p className="text-xs text-gray-500 mt-1">
                There are no pending edits or revisions waiting for Admin Approval. All active official references are up to date.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4">
              {filteredPendingRevisions.map(({ registration, revision }) => {
                const master = masterMap.get(registration.productCode.toLowerCase());
                return (
                  <div
                    key={revision.id}
                    className="bg-[#161616] border border-[#333] hover:border-blue-500/40 rounded-xl p-5 transition-all shadow-xs space-y-4"
                  >
                    {/* Header bar */}
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 border-b border-[#262626]">
                      <div className="flex items-center gap-3">
                        <div className="p-2.5 bg-amber-500/10 border border-amber-500/20 rounded-lg text-amber-400">
                          <RotateCcw className="w-5 h-5" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-bold font-mono text-gray-100">
                              {registration.productCode}
                            </span>
                            <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-[#222] text-gray-400 border border-[#333]">
                              Current: {registration.revision}
                            </span>
                            <ArrowRight className="w-3.5 h-3.5 text-amber-400" />
                            <span className="text-[11px] font-mono font-bold px-2 py-0.5 rounded bg-amber-500/15 text-amber-300 border border-amber-500/30">
                              Proposed: {revision.revisionCode} (v{revision.versionNumber})
                            </span>
                            <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20 uppercase tracking-wider">
                              PENDING APPROVAL
                            </span>
                          </div>
                          <p className="text-xs text-gray-400 mt-0.5">
                            {master?.description || 'Material reference specimen'}
                          </p>
                        </div>
                      </div>

                      {/* Action buttons */}
                      <div className="flex items-center gap-2 self-end sm:self-center flex-wrap">
                        <button
                          onClick={() => setInspectSnapshot({ registration, revision })}
                          className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-gray-200 bg-[#222] hover:bg-[#2A2A2A] border border-[#333] rounded-lg transition-colors cursor-pointer"
                          title="Inspect full revision snapshot & evidence"
                        >
                          <Eye className="w-3.5 h-3.5 text-purple-400" />
                          <span>Snapshot</span>
                        </button>
                        <button
                          onClick={() => setSelectedForCompare({ registration, revision })}
                          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-blue-400 bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/20 rounded-lg transition-colors cursor-pointer"
                        >
                          <ArrowLeftRight className="w-3.5 h-3.5" />
                          <span>Compare Diff</span>
                        </button>
                        <button
                          onClick={() => setDossierRegistration(registration)}
                          className="p-1.5 text-gray-400 hover:text-purple-300 bg-[#222] hover:bg-purple-500/20 rounded-lg border border-[#333] transition-colors cursor-pointer"
                          title="View Complete Item Lifecycle Dossier"
                        >
                          <History className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => setActionModal({ type: 'APPROVE_REVISION', registration, revision })}
                          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-500 rounded-lg transition-colors shadow-xs cursor-pointer"
                        >
                          <Check className="w-3.5 h-3.5" />
                          <span>Approve</span>
                        </button>
                        <button
                          onClick={() => setActionModal({ type: 'REJECT_REVISION', registration, revision })}
                          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-red-400 hover:text-red-300 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 rounded-lg transition-colors cursor-pointer"
                        >
                          <X className="w-3.5 h-3.5" />
                          <span>Reject</span>
                        </button>
                      </div>
                    </div>

                    {/* Metadata & Changes Highlight */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                      <div className="space-y-1">
                        <span className="text-[10px] font-mono text-gray-500 uppercase tracking-wider block">
                          Submitted By
                        </span>
                        <div className="flex items-center gap-1.5 font-medium text-gray-200">
                          <User className="w-3.5 h-3.5 text-gray-400" />
                          <span>{revision.submittedBy}</span>
                        </div>
                        <span className="text-[11px] text-gray-500 font-mono">
                          {new Date(revision.submittedAt).toLocaleString()}
                        </span>
                      </div>

                      <div className="space-y-1">
                        <span className="text-[10px] font-mono text-gray-500 uppercase tracking-wider block">
                          Changed Attributes ({revision.changedFields?.length || 0})
                        </span>
                        <div className="flex flex-wrap gap-1">
                          {revision.changedFields && revision.changedFields.length > 0 ? (
                            revision.changedFields.map((f) => (
                              <span
                                key={f}
                                className="px-2 py-0.5 rounded bg-blue-500/15 text-blue-300 border border-blue-500/20 text-[10px] font-mono"
                              >
                                {f}
                              </span>
                            ))
                          ) : (
                            <span className="text-gray-400 italic">Specification metadata review</span>
                          )}
                        </div>
                      </div>

                      <div className="space-y-1">
                        <span className="text-[10px] font-mono text-gray-500 uppercase tracking-wider block">
                          Revision Notes / Justification
                        </span>
                        <p className="text-gray-300 italic bg-[#121212] p-2 rounded border border-[#222]">
                          "{revision.revisionNotes || revision.changeSummary || 'No notes provided'}"
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {activeTab === 'PENDING_NEW' && (
        <div className="space-y-4">
          {filteredPendingNew.length === 0 ? (
            <div className="bg-[#141414] rounded-xl border border-[#222] p-12 text-center text-gray-500">
              <CheckCircle2 className="w-10 h-10 mx-auto text-emerald-500/40 mb-3" />
              <h4 className="text-sm font-semibold text-gray-300">No New Registrations Pending</h4>
              <p className="text-xs text-gray-500 mt-1">
                All newly created reference registrations have been approved or processed.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4">
              {filteredPendingNew.map((reg) => {
                const master = masterMap.get(reg.productCode.toLowerCase());
                return (
                  <div
                    key={reg.id}
                    className="bg-[#161616] border border-[#333] hover:border-blue-500/40 rounded-xl p-5 transition-all shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
                  >
                    <div className="space-y-1.5 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold font-mono text-gray-100">
                          {reg.productCode}
                        </span>
                        <span className="text-xs font-mono font-semibold px-2 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20">
                          {reg.revision}
                        </span>
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20 uppercase tracking-wider">
                          INITIAL APPROVAL PENDING
                        </span>
                      </div>
                      <p className="text-xs text-gray-300 font-medium">
                        {master?.description || reg.specification || 'New reference specimen'}
                      </p>
                      <div className="flex items-center gap-4 text-xs text-gray-500 font-mono pt-1">
                        <span>Submitted by: <strong className="text-gray-300">{reg.registeredBy}</strong></span>
                        <span>Date: {reg.registrationDate}</span>
                        {reg.supplier && <span>Supplier: {reg.supplier}</span>}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {onOpenDetailModal && (
                        <button
                          onClick={() => onOpenDetailModal(reg)}
                          className="px-3 py-1.5 text-xs font-semibold text-gray-300 hover:text-white bg-[#222] hover:bg-[#2A2A2A] border border-[#333] rounded-lg transition-colors"
                        >
                          View Details
                        </button>
                      )}
                      <button
                        onClick={() => setActionModal({ type: 'APPROVE_NEW', registration: reg })}
                        className="px-3.5 py-1.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-500 rounded-lg transition-colors shadow-xs"
                      >
                        Approve Registration
                      </button>
                      <button
                        onClick={() => setActionModal({ type: 'REJECT_NEW', registration: reg })}
                        className="px-3.5 py-1.5 text-xs font-semibold text-red-400 hover:text-red-300 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 rounded-lg transition-colors"
                      >
                        Reject
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {activeTab === 'ALL_HISTORY' && (
        <div className="bg-[#141414] rounded-xl border border-[#222] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-gray-300">
              <thead className="bg-[#1A1A1A] text-gray-400 font-mono text-[11px] uppercase tracking-wider border-b border-[#262626]">
                <tr>
                  <th className="px-4 py-3">Product Code</th>
                  <th className="px-4 py-3">Version & Code</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Submitter & Date</th>
                  <th className="px-4 py-3">Approver / Reviewer</th>
                  <th className="px-4 py-3">Change Summary</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#222]">
                {filteredAllHistory.map(({ registration, revision }) => (
                  <tr key={revision.id} className="hover:bg-[#1A1A1A]/50 transition-colors">
                    <td className="px-4 py-3 font-mono font-bold text-gray-100">
                      {registration.productCode}
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
                      <div className="font-medium text-gray-200">{revision.submittedBy}</div>
                      <div className="text-[10px] text-gray-500 font-mono">
                        {new Date(revision.submittedAt).toLocaleDateString()}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {revision.approvedBy ? (
                        <div>
                          <div className="font-medium text-emerald-400">{revision.approvedBy}</div>
                          <div className="text-[10px] text-gray-500 font-mono">
                            {revision.approvedAt ? new Date(revision.approvedAt).toLocaleDateString() : ''}
                          </div>
                        </div>
                      ) : revision.rejectedBy ? (
                        <div>
                          <div className="font-medium text-red-400">{revision.rejectedBy}</div>
                          <div className="text-[10px] text-gray-500 font-mono">
                            {revision.rejectedAt ? new Date(revision.rejectedAt).toLocaleDateString() : ''}
                          </div>
                        </div>
                      ) : (
                        <span className="text-amber-400 italic">Pending Review</span>
                      )}
                    </td>
                    <td className="px-4 py-3 max-w-xs truncate text-gray-400">
                      {revision.changeSummary || revision.revisionNotes || '—'}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => setInspectSnapshot({ registration, revision })}
                          className="px-2 py-1 text-[11px] font-semibold text-gray-300 hover:text-white bg-[#222] hover:bg-[#2A2A2A] rounded border border-[#333] transition-colors"
                          title="Inspect revision snapshot"
                        >
                          <Eye className="w-3 h-3 text-purple-400" />
                        </button>
                        <button
                          onClick={() => setSelectedForCompare({ registration, revision })}
                          className="px-2.5 py-1 text-[11px] font-semibold text-blue-400 hover:text-blue-300 bg-blue-500/10 hover:bg-blue-500/20 rounded border border-blue-500/20 transition-colors"
                        >
                          Diff
                        </button>
                        <button
                          onClick={() => setDossierRegistration(registration)}
                          className="p-1 text-gray-400 hover:text-purple-300 bg-[#222] hover:bg-purple-500/20 rounded border border-[#333] transition-colors"
                          title="Full Item Dossier"
                        >
                          <History className="w-3 h-3" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Side-by-Side Compare Changes Modal */}
      {selectedForCompare && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-[#161616] rounded-xl shadow-2xl border border-[#333] w-full max-w-5xl overflow-hidden my-6 animate-in fade-in zoom-in-95 duration-150 flex flex-col max-h-[90vh]">
            {/* Modal Header */}
            <div className="bg-[#0A0A0A] px-6 py-4 flex items-center justify-between border-b border-[#222]">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-500/10 border border-blue-500/20 rounded-lg text-blue-400">
                  <RotateCcw className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-bold font-mono text-gray-100">
                      Compare Reference Revisions — {selectedForCompare.registration.productCode}
                    </h3>
                    <span className="text-xs font-mono px-2 py-0.5 rounded bg-amber-500/15 text-amber-300 border border-amber-500/30">
                      {selectedForCompare.revision.revisionCode} (v{selectedForCompare.revision.versionNumber})
                    </span>
                  </div>
                  <p className="text-xs text-gray-400 mt-0.5">
                    Side-by-side comparison between Current Official Version vs. Proposed Revision
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedForCompare(null)}
                className="text-gray-400 hover:text-white p-1 rounded-md transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body: Side-by-Side Diff */}
            <div className="p-6 overflow-y-auto space-y-6 flex-1">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Left: Approved Official Version */}
                <div className="bg-[#121212] rounded-xl border border-emerald-500/30 p-5 space-y-4">
                  <div className="flex items-center justify-between pb-3 border-b border-[#222]">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                      <span className="text-xs font-bold uppercase tracking-wider text-emerald-400 font-mono">
                        Current Approved Version
                      </span>
                    </div>
                    <span className="text-xs font-mono font-bold bg-[#1A1A1A] px-2.5 py-0.5 rounded text-gray-200 border border-[#333]">
                      {selectedForCompare.registration.revision}
                    </span>
                  </div>

                  <div className="space-y-3 text-xs">
                    <div>
                      <span className="text-[10px] font-mono text-gray-500 uppercase tracking-wider block">
                        Category & Material Type
                      </span>
                      <div className="font-semibold text-gray-200 mt-0.5">
                        {selectedForCompare.registration.category || 'Box'} ({selectedForCompare.registration.materialType || 'RM'})
                      </div>
                    </div>

                    <div>
                      <span className="text-[10px] font-mono text-gray-500 uppercase tracking-wider block">
                        Supplier / Source
                      </span>
                      <div className="font-semibold text-gray-200 mt-0.5">
                        {selectedForCompare.registration.supplier || '—'}
                      </div>
                    </div>

                    <div>
                      <span className="text-[10px] font-mono text-gray-500 uppercase tracking-wider block">
                        Specification & Physical Requirements
                      </span>
                      <div className="bg-[#181818] p-3 rounded-lg border border-[#262626] text-gray-300 mt-1 whitespace-pre-wrap">
                        {selectedForCompare.registration.specification || 'No specification recorded'}
                      </div>
                    </div>

                    <div>
                      <span className="text-[10px] font-mono text-gray-500 uppercase tracking-wider block">
                        Remarks & Notes
                      </span>
                      <div className="bg-[#181818] p-3 rounded-lg border border-[#262626] text-gray-300 mt-1 whitespace-pre-wrap">
                        {selectedForCompare.registration.remarks || 'No remarks recorded'}
                      </div>
                    </div>

                    <div>
                      <span className="text-[10px] font-mono text-gray-500 uppercase tracking-wider block">
                        Photos Attached
                      </span>
                      <div className="text-gray-300 mt-1">
                        {selectedForCompare.registration.photos?.length || 0} sample photos attached
                      </div>
                    </div>

                    <div>
                      <span className="text-[10px] font-mono text-gray-500 uppercase tracking-wider block">
                        Certificates & Attachments
                      </span>
                      <div className="text-gray-300 mt-1">
                        {selectedForCompare.registration.attachments?.length || 0} document attachments
                      </div>
                    </div>
                  </div>
                </div>

                {/* Right: Proposed Revision */}
                <div className="bg-[#121212] rounded-xl border border-amber-500/40 p-5 space-y-4">
                  <div className="flex items-center justify-between pb-3 border-b border-[#222]">
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4 text-amber-400" />
                      <span className="text-xs font-bold uppercase tracking-wider text-amber-400 font-mono">
                        Proposed Revision (Awaiting Approval)
                      </span>
                    </div>
                    <span className="text-xs font-mono font-bold bg-amber-500/15 text-amber-300 px-2.5 py-0.5 rounded border border-amber-500/30">
                      {selectedForCompare.revision.revisionCode} (v{selectedForCompare.revision.versionNumber})
                    </span>
                  </div>

                  <div className="space-y-3 text-xs">
                    <div>
                      <span className="text-[10px] font-mono text-gray-500 uppercase tracking-wider block">
                        Category & Material Type
                      </span>
                      <div className={`font-semibold mt-0.5 ${
                        selectedForCompare.revision.category !== selectedForCompare.registration.category ||
                        selectedForCompare.revision.materialType !== selectedForCompare.registration.materialType
                          ? 'text-amber-300 font-bold bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20'
                          : 'text-gray-200'
                      }`}>
                        {selectedForCompare.revision.category || 'Box'} ({selectedForCompare.revision.materialType || 'RM'})
                      </div>
                    </div>

                    <div>
                      <span className="text-[10px] font-mono text-gray-500 uppercase tracking-wider block">
                        Supplier / Source
                      </span>
                      <div className={`font-semibold mt-0.5 ${
                        selectedForCompare.revision.supplier !== selectedForCompare.registration.supplier
                          ? 'text-amber-300 font-bold bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20'
                          : 'text-gray-200'
                      }`}>
                        {selectedForCompare.revision.supplier || '—'}
                      </div>
                    </div>

                    <div>
                      <span className="text-[10px] font-mono text-gray-500 uppercase tracking-wider block">
                        Specification & Physical Requirements
                      </span>
                      <div className={`p-3 rounded-lg border text-gray-200 mt-1 whitespace-pre-wrap ${
                        selectedForCompare.revision.specification !== selectedForCompare.registration.specification
                          ? 'bg-amber-500/10 border-amber-500/30 text-amber-100 font-medium'
                          : 'bg-[#181818] border-[#262626] text-gray-300'
                      }`}>
                        {selectedForCompare.revision.specification || 'No specification recorded'}
                      </div>
                    </div>

                    <div>
                      <span className="text-[10px] font-mono text-gray-500 uppercase tracking-wider block">
                        Remarks & Notes
                      </span>
                      <div className={`p-3 rounded-lg border text-gray-200 mt-1 whitespace-pre-wrap ${
                        selectedForCompare.revision.remarks !== selectedForCompare.registration.remarks
                          ? 'bg-amber-500/10 border-amber-500/30 text-amber-100 font-medium'
                          : 'bg-[#181818] border-[#262626] text-gray-300'
                      }`}>
                        {selectedForCompare.revision.remarks || 'No remarks recorded'}
                      </div>
                    </div>

                    <div>
                      <span className="text-[10px] font-mono text-gray-500 uppercase tracking-wider block">
                        Photos Attached
                      </span>
                      <div className={`mt-1 ${
                        (selectedForCompare.revision.photos?.length || 0) !== (selectedForCompare.registration.photos?.length || 0)
                          ? 'text-amber-300 font-bold'
                          : 'text-gray-300'
                      }`}>
                        {selectedForCompare.revision.photos?.length || 0} sample photos attached
                      </div>
                    </div>

                    <div>
                      <span className="text-[10px] font-mono text-gray-500 uppercase tracking-wider block">
                        Certificates & Attachments
                      </span>
                      <div className={`mt-1 ${
                        (selectedForCompare.revision.attachments?.length || 0) !== (selectedForCompare.registration.attachments?.length || 0)
                          ? 'text-amber-300 font-bold'
                          : 'text-gray-300'
                      }`}>
                        {selectedForCompare.revision.attachments?.length || 0} document attachments
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Revision Submitter Info Bar */}
              <div className="bg-[#121212] p-4 rounded-xl border border-[#222] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
                <div>
                  <span className="text-gray-400 font-medium">Submitted by: </span>
                  <strong className="text-gray-200">{selectedForCompare.revision.submittedBy}</strong>
                  <span className="text-gray-500 ml-2 font-mono">
                    on {new Date(selectedForCompare.revision.submittedAt).toLocaleString()}
                  </span>
                </div>
                {selectedForCompare.revision.revisionNotes && (
                  <div className="text-gray-300 italic">
                    Note: "{selectedForCompare.revision.revisionNotes}"
                  </div>
                )}
              </div>
            </div>

            {/* Modal Footer Actions */}
            <div className="bg-[#0A0A0A] px-6 py-4 border-t border-[#222] flex items-center justify-between">
              <button
                type="button"
                onClick={() => setSelectedForCompare(null)}
                className="px-4 py-2 text-xs font-semibold text-gray-400 hover:text-gray-200 hover:bg-[#222] rounded-lg transition-colors"
              >
                Close Comparison
              </button>

              {selectedForCompare.revision.status === 'PENDING_APPROVAL' && (
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      setActionModal({
                        type: 'REJECT_REVISION',
                        registration: selectedForCompare.registration,
                        revision: selectedForCompare.revision
                      });
                    }}
                    className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-red-400 hover:text-red-300 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 rounded-lg transition-colors"
                  >
                    <X className="w-3.5 h-3.5" />
                    <span>Reject Revision</span>
                  </button>
                  <button
                    onClick={() => {
                      setActionModal({
                        type: 'APPROVE_REVISION',
                        registration: selectedForCompare.registration,
                        revision: selectedForCompare.revision
                      });
                    }}
                    className="flex items-center gap-1.5 px-5 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-500 rounded-lg transition-colors shadow-sm"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>Approve as Official Version</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Confirmation & Rejection Notes Modal */}
      {actionModal && (
        <div className="fixed inset-0 z-60 bg-black/85 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-[#181818] rounded-xl border border-[#333] w-full max-w-md p-6 space-y-4 shadow-2xl animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3">
              <div className={`p-2.5 rounded-lg border ${
                actionModal.type.startsWith('APPROVE')
                  ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                  : 'bg-red-500/10 border-red-500/20 text-red-400'
              }`}>
                {actionModal.type.startsWith('APPROVE') ? (
                  <Check className="w-5 h-5" />
                ) : (
                  <AlertTriangle className="w-5 h-5" />
                )}
              </div>
              <div>
                <h3 className="text-sm font-bold text-gray-100">
                  {actionModal.type === 'APPROVE_REVISION'
                    ? `Approve Revision ${actionModal.revision?.revisionCode}`
                    : actionModal.type === 'REJECT_REVISION'
                    ? `Reject Revision ${actionModal.revision?.revisionCode}`
                    : actionModal.type === 'APPROVE_NEW'
                    ? `Approve New Registration`
                    : `Reject New Registration`}
                </h3>
                <p className="text-xs text-gray-400">
                  Item: <span className="font-mono text-gray-200 font-bold">{actionModal.registration.productCode}</span>
                </p>
              </div>
            </div>

            {actionError && (
              <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-400 text-xs rounded-lg">
                {actionError}
              </div>
            )}

            {actionSuccess && (
              <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs rounded-lg">
                {actionSuccess}
              </div>
            )}

            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-gray-300 font-mono">
                {actionModal.type.startsWith('REJECT') ? (
                  <span>Rejection Reason <span className="text-red-400">* (Mandatory)</span></span>
                ) : (
                  <span>Admin Approval Notes (Optional)</span>
                )}
              </label>
              <textarea
                rows={3}
                required={actionModal.type.startsWith('REJECT')}
                placeholder={
                  actionModal.type.startsWith('REJECT')
                    ? 'Explain why this revision is rejected (e.g. invalid dimension tolerance, wrong supplier spec)...'
                    : 'Notes for the audit log...'
                }
                value={actionNotes}
                onChange={(e) => setActionNotes(e.target.value)}
                className="w-full text-xs px-3 py-2 bg-[#121212] border border-[#333] text-gray-200 rounded-lg focus:outline-hidden focus:border-blue-500"
              />
            </div>

            <div className="pt-3 border-t border-[#262626] flex items-center justify-end gap-2">
              <button
                type="button"
                disabled={isProcessing}
                onClick={() => {
                  setActionModal(null);
                  setActionNotes('');
                  setActionError(null);
                }}
                className="px-4 py-2 text-xs font-semibold text-gray-400 hover:text-gray-200 hover:bg-[#222] rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isProcessing}
                onClick={handleConfirmAction}
                className={`px-5 py-2 text-xs font-bold text-white rounded-lg shadow-sm transition-colors disabled:opacity-50 ${
                  actionModal.type.startsWith('APPROVE')
                    ? 'bg-emerald-600 hover:bg-emerald-500'
                    : 'bg-red-600 hover:bg-red-500'
                }`}
              >
                {isProcessing ? 'Processing...' : 'Confirm Decision'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Snapshot Audit Modal */}
      {inspectSnapshot && (
        <RevisionAuditSnapshotModal
          registration={inspectSnapshot.registration}
          revision={inspectSnapshot.revision}
          masterItem={masterMap.get(inspectSnapshot.registration.productCode.toLowerCase())}
          onClose={() => setInspectSnapshot(null)}
          onCompareWithAnother={(rev) => {
            const reg = inspectSnapshot.registration;
            setInspectSnapshot(null);
            setSelectedForCompare({ registration: reg, revision: rev });
          }}
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
