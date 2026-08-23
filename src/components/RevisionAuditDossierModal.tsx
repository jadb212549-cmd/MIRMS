import React, { useState } from 'react';
import { ReferenceRegistration, ReferenceRevisionRecord, MasterItem } from '../types';
import { 
  History, 
  X, 
  User, 
  Calendar, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  FileText, 
  Tag, 
  Layers, 
  Image as ImageIcon, 
  Paperclip, 
  Printer, 
  Eye, 
  ArrowLeftRight, 
  Download,
  ShieldCheck,
  Search,
  Filter
} from 'lucide-react';
import { RevisionAuditSnapshotModal } from './RevisionAuditSnapshotModal';
import { RevisionCompareModal } from './RevisionCompareModal';
import { excelService } from '../services/excelService';

interface RevisionAuditDossierModalProps {
  registration: ReferenceRegistration;
  masterItem?: MasterItem;
  onClose: () => void;
}

export const RevisionAuditDossierModal: React.FC<RevisionAuditDossierModalProps> = ({
  registration,
  masterItem,
  onClose
}) => {
  const [inspectRevision, setInspectRevision] = useState<ReferenceRevisionRecord | null>(null);
  const [compareModalOpen, setCompareModalOpen] = useState(false);
  const [compareRevA, setCompareRevA] = useState<ReferenceRevisionRecord | undefined>();
  const [compareRevB, setCompareRevB] = useState<ReferenceRevisionRecord | undefined>();

  const versions = registration.versions || [];

  const handlePrint = () => {
    window.print();
  };

  const handleExportExcel = () => {
    excelService.exportRevisionAuditHistory([registration], masterItem ? [masterItem] : [], `${registration.productCode}_Revision_Audit_Dossier.xlsx`);
  };

  const handleCompareClick = (revA?: ReferenceRevisionRecord, revB?: ReferenceRevisionRecord) => {
    setCompareRevA(revA);
    setCompareRevB(revB);
    setCompareModalOpen(true);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-[#121212] border border-[#2E2E2E] w-full max-w-5xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="px-6 py-4 bg-[#181818] border-b border-[#2A2A2A] flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-400">
              <History className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono font-bold text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded border border-blue-500/20">
                  {registration.productCode}
                </span>
                <span className="text-xs font-mono font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                  Current: {registration.revision}
                </span>
                <span className="text-xs font-mono text-gray-400">
                  Total Versions: {versions.length || 1}
                </span>
              </div>
              <h3 className="text-sm font-semibold text-gray-200 mt-1 truncate max-w-lg">
                {masterItem?.description || 'Material Reference Quality Audit Dossier'}
              </h3>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => handleCompareClick()}
              disabled={versions.length < 2}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-blue-400 bg-blue-500/10 hover:bg-blue-500/20 disabled:opacity-40 disabled:cursor-not-allowed border border-blue-500/20 rounded-lg transition-colors cursor-pointer"
              title="Compare Revisions Side-by-Side"
            >
              <ArrowLeftRight className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Compare Revisions</span>
            </button>
            <button
              onClick={handleExportExcel}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 rounded-lg transition-colors cursor-pointer"
              title="Export Revision Audit Log to Excel"
            >
              <Download className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Excel Audit Log</span>
            </button>
            <button
              onClick={handlePrint}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-gray-300 bg-[#222] hover:bg-[#2A2A2A] border border-[#333] rounded-lg transition-colors cursor-pointer"
              title="Print Audit Report"
            >
              <Printer className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Print Dossier</span>
            </button>
            <button
              onClick={onClose}
              className="p-1.5 text-gray-400 hover:text-white hover:bg-[#252525] rounded-lg transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6 overflow-y-auto max-h-[calc(92vh-80px)] text-xs text-gray-300">
          {/* Summary Audit Card */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-[#161616] p-4 rounded-xl border border-[#262626]">
            <div>
              <span className="text-[10px] font-mono text-gray-500 uppercase tracking-wider block">Product Code</span>
              <span className="font-mono font-bold text-blue-400 text-sm">{registration.productCode}</span>
            </div>
            <div>
              <span className="text-[10px] font-mono text-gray-500 uppercase tracking-wider block">Material Category</span>
              <span className="font-semibold text-gray-200">{masterItem?.category || registration.category || 'Raw Material'}</span>
            </div>
            <div>
              <span className="text-[10px] font-mono text-gray-500 uppercase tracking-wider block">Official Revision</span>
              <span className="font-mono font-bold text-emerald-400 text-sm">{registration.revision}</span>
            </div>
            <div>
              <span className="text-[10px] font-mono text-gray-500 uppercase tracking-wider block">Baseline Date</span>
              <span className="font-mono text-gray-300">{registration.registrationDate}</span>
            </div>
          </div>

          {/* Chronological Version Lifecycle Ledger */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-mono font-bold text-gray-300 uppercase tracking-wider flex items-center gap-2">
                <Clock className="w-3.5 h-3.5 text-purple-400" />
                <span>Revision Audit Log & Version History</span>
              </h4>
              <span className="text-xs text-gray-500 font-mono">
                Chronological order from newest to initial baseline
              </span>
            </div>

            {versions.length > 0 ? (
              <div className="space-y-3">
                {versions.map((ver, idx) => {
                  const isApproved = ver.status === 'APPROVED';
                  const isPending = ver.status === 'PENDING_APPROVAL';
                  const isRejected = ver.status === 'REJECTED';
                  const prevVer = versions[idx + 1];

                  return (
                    <div
                      key={ver.id || idx}
                      className={`border rounded-xl p-4.5 transition-all ${
                        isApproved
                          ? 'bg-[#151515] border-[#2A2A2A] hover:border-emerald-500/40'
                          : isPending
                          ? 'bg-amber-950/10 border-amber-500/30'
                          : 'bg-red-950/10 border-red-500/30'
                      }`}
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#222]">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-mono font-bold text-gray-100 bg-[#222] px-2.5 py-1 rounded text-xs border border-[#333]">
                            v{ver.versionNumber}: {ver.revisionCode}
                          </span>
                          <span
                            className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded ${
                              isApproved
                                ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                                : isPending
                                ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30 animate-pulse'
                                : 'bg-red-500/15 text-red-400 border border-red-500/30'
                            }`}
                          >
                            {ver.status}
                          </span>
                          {ver.revisionCode === registration.revision && isApproved && (
                            <span className="text-[10px] font-mono font-bold bg-blue-500/20 text-blue-300 border border-blue-500/30 px-2 py-0.5 rounded">
                              CURRENT ACTIVE OFFICIAL
                            </span>
                          )}
                        </div>

                        {/* Action buttons */}
                        <div className="flex items-center gap-2 shrink-0">
                          {prevVer && (
                            <button
                              onClick={() => handleCompareClick(prevVer, ver)}
                              className="flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold text-blue-400 bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/20 rounded-lg transition-colors cursor-pointer"
                              title="Compare with previous version"
                            >
                              <ArrowLeftRight className="w-3 h-3" />
                              <span>Diff Previous</span>
                            </button>
                          )}
                          <button
                            onClick={() => setInspectRevision(ver)}
                            className="flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold text-gray-200 bg-[#242424] hover:bg-[#2F2F2F] border border-[#333] rounded-lg transition-colors cursor-pointer"
                            title="Inspect full revision snapshot"
                          >
                            <Eye className="w-3 h-3 text-purple-400" />
                            <span>Inspect Snapshot</span>
                          </button>
                        </div>
                      </div>

                      {/* Version Meta Grid */}
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-3 text-xs">
                        <div className="space-y-0.5">
                          <span className="text-[10px] font-mono text-gray-500 uppercase block">Submission Details</span>
                          <div className="text-gray-200 font-medium">{ver.submittedBy}</div>
                          <div className="text-[10px] font-mono text-gray-400">
                            {ver.submittedAt ? new Date(ver.submittedAt).toLocaleString() : ver.registrationDate}
                          </div>
                        </div>

                        <div className="space-y-0.5">
                          <span className="text-[10px] font-mono text-gray-500 uppercase block">Audit Verification</span>
                          {ver.approvedBy ? (
                            <>
                              <div className="text-emerald-400 font-medium">Approved: {ver.approvedBy}</div>
                              <div className="text-[10px] font-mono text-gray-400">
                                {ver.approvedAt ? new Date(ver.approvedAt).toLocaleString() : ''}
                              </div>
                            </>
                          ) : ver.rejectedBy ? (
                            <>
                              <div className="text-red-400 font-medium">Rejected: {ver.rejectedBy}</div>
                              <div className="text-[10px] font-mono text-gray-400">
                                {ver.rejectedAt ? new Date(ver.rejectedAt).toLocaleString() : ''}
                              </div>
                            </>
                          ) : (
                            <div className="text-amber-400 font-medium">Pending QA Sign-off</div>
                          )}
                        </div>

                        <div className="space-y-0.5">
                          <span className="text-[10px] font-mono text-gray-500 uppercase block">Attached Evidence</span>
                          <div className="flex items-center gap-3 text-gray-300 font-mono text-[11px]">
                            <span className="flex items-center gap-1">
                              <ImageIcon className="w-3 h-3 text-blue-400" /> {ver.photos?.length || 0} photos
                            </span>
                            <span className="flex items-center gap-1">
                              <Paperclip className="w-3 h-3 text-amber-400" /> {ver.attachments?.length || 0} files
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Revision Notes / Changes */}
                      {(ver.revisionNotes || ver.changeSummary || ver.rejectionReason) && (
                        <div className="mt-3 pt-2.5 border-t border-[#222] text-xs">
                          {ver.revisionNotes && (
                            <div className="text-gray-300 font-mono text-[11px]">
                              <span className="text-amber-400 font-bold">Justification: </span>
                              "{ver.revisionNotes}"
                            </div>
                          )}
                          {ver.rejectionReason && (
                            <div className="text-red-300 font-mono text-[11px] mt-1">
                              <span className="text-red-400 font-bold">Rejection Feedback: </span>
                              "{ver.rejectionReason}"
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="p-4 bg-[#161616] rounded-xl border border-[#262626] text-gray-400 text-xs">
                No historical revisions recorded. Currently on baseline initial registration ({registration.revision}).
              </div>
            )}
          </div>
        </div>

        {/* Snapshot Modal */}
        {inspectRevision && (
          <RevisionAuditSnapshotModal
            registration={registration}
            revision={inspectRevision}
            masterItem={masterItem}
            onClose={() => setInspectRevision(null)}
            onCompareWithAnother={(rev) => {
              setInspectRevision(null);
              handleCompareClick(undefined, rev);
            }}
          />
        )}

        {/* Compare Modal */}
        {compareModalOpen && (
          <RevisionCompareModal
            registration={registration}
            masterItem={masterItem}
            initialRevA={compareRevA}
            initialRevB={compareRevB}
            onClose={() => setCompareModalOpen(false)}
          />
        )}
      </div>
    </div>
  );
};
