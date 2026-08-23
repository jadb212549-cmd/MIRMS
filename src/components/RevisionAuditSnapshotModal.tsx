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
  ShieldCheck,
  AlertTriangle,
  ExternalLink
} from 'lucide-react';

interface RevisionAuditSnapshotModalProps {
  registration: ReferenceRegistration;
  revision: ReferenceRevisionRecord;
  masterItem?: MasterItem;
  onClose: () => void;
  onCompareWithAnother?: (rev: ReferenceRevisionRecord) => void;
}

export const RevisionAuditSnapshotModal: React.FC<RevisionAuditSnapshotModalProps> = ({
  registration,
  revision,
  masterItem,
  onClose,
  onCompareWithAnother
}) => {
  const [selectedPhoto, setSelectedPhoto] = useState<string | null>(null);

  const isApproved = revision.status === 'APPROVED';
  const isPending = revision.status === 'PENDING_APPROVAL';
  const isRejected = revision.status === 'REJECTED';

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-[#121212] border border-[#2E2E2E] w-full max-w-4xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="px-6 py-4 bg-[#181818] border-b border-[#2A2A2A] flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-400">
              <History className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-mono font-bold text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded border border-blue-500/20">
                  {revision.productCode || registration.productCode}
                </span>
                <span className="text-xs font-mono font-bold text-purple-300 bg-purple-500/20 px-2.5 py-0.5 rounded border border-purple-500/30">
                  Version {revision.versionNumber} ({revision.revisionCode})
                </span>
                <span
                  className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded ${
                    isApproved
                      ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                      : isPending
                      ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                      : 'bg-red-500/20 text-red-400 border border-red-500/30'
                  }`}
                >
                  {revision.status}
                </span>
              </div>
              <h3 className="text-sm font-semibold text-gray-200 mt-1 truncate max-w-lg">
                {masterItem?.description || 'Material Reference Historical Snapshot'}
              </h3>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {onCompareWithAnother && (
              <button
                onClick={() => onCompareWithAnother(revision)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-blue-400 bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/20 rounded-lg transition-colors cursor-pointer"
                title="Compare this snapshot with another revision"
              >
                <ArrowLeftRight className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Compare Diff</span>
              </button>
            )}
            <button
              onClick={handlePrint}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-gray-300 bg-[#222] hover:bg-[#2A2A2A] border border-[#333] rounded-lg transition-colors cursor-pointer"
              title="Print Revision Audit Record"
            >
              <Printer className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Print Snapshot</span>
            </button>
            <button
              onClick={onClose}
              className="p-1.5 text-gray-400 hover:text-white hover:bg-[#252525] rounded-lg transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Scrollable Content */}
        <div className="p-6 space-y-6 overflow-y-auto max-h-[calc(92vh-80px)] text-gray-300 text-xs">
          {/* Audit Verification Banner */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Submission Log Card */}
            <div className="bg-[#181818] border border-[#2A2A2A] rounded-xl p-4 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5 text-blue-400" />
                  <span>Submission Record</span>
                </span>
                <span className="text-[10px] font-mono text-gray-500">
                  ID: {revision.id.slice(0, 10)}...
                </span>
              </div>
              <div className="text-xs space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-gray-400 font-sans">Submitted By:</span>
                  <strong className="text-gray-200 font-sans">{revision.submittedBy || revision.registeredBy}</strong>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-400 font-sans">Submission Date & Time:</span>
                  <span className="font-mono text-gray-300">
                    {revision.submittedAt ? new Date(revision.submittedAt).toLocaleString() : revision.registrationDate}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-400 font-sans">Material Type / Category:</span>
                  <span className="font-mono text-blue-400">
                    {revision.materialType || 'RM'} • {revision.category || masterItem?.category || 'General'}
                  </span>
                </div>
              </div>
            </div>

            {/* Approval / Decision Log Card */}
            <div className={`border rounded-xl p-4 space-y-2.5 ${
              isApproved 
                ? 'bg-emerald-950/15 border-emerald-500/30' 
                : isRejected 
                ? 'bg-red-950/15 border-red-500/30' 
                : 'bg-amber-950/15 border-amber-500/30'
            }`}>
              <div className="flex items-center justify-between">
                <span className={`text-[10px] font-mono font-bold uppercase tracking-wider flex items-center gap-1.5 ${
                  isApproved ? 'text-emerald-400' : isRejected ? 'text-red-400' : 'text-amber-400'
                }`}>
                  {isApproved && <CheckCircle2 className="w-3.5 h-3.5" />}
                  {isRejected && <XCircle className="w-3.5 h-3.5" />}
                  {isPending && <Clock className="w-3.5 h-3.5" />}
                  <span>Verification & Audit Status</span>
                </span>
                <span className="text-[10px] font-mono font-bold uppercase">
                  {revision.status}
                </span>
              </div>
              <div className="text-xs space-y-1">
                {isApproved && (
                  <>
                    <div className="flex items-center justify-between">
                      <span className="text-gray-400 font-sans">Approved By (QA Admin):</span>
                      <strong className="text-emerald-300 font-sans">{revision.approvedBy || 'Quality Assurance Lead'}</strong>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-gray-400 font-sans">Approval Date & Time:</span>
                      <span className="font-mono text-emerald-400">
                        {revision.approvedAt ? new Date(revision.approvedAt).toLocaleString() : 'Recorded'}
                      </span>
                    </div>
                  </>
                )}
                {isRejected && (
                  <>
                    <div className="flex items-center justify-between">
                      <span className="text-gray-400 font-sans">Rejected By (QA Admin):</span>
                      <strong className="text-red-300 font-sans">{revision.rejectedBy || 'Quality Assurance Lead'}</strong>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-gray-400 font-sans">Rejection Date:</span>
                      <span className="font-mono text-red-400">
                        {revision.rejectedAt ? new Date(revision.rejectedAt).toLocaleString() : 'Recorded'}
                      </span>
                    </div>
                  </>
                )}
                {isPending && (
                  <p className="text-amber-300 text-xs py-1">
                    This revision is currently in the QA queue awaiting review and administrative sign-off.
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Revision Notes / Justification */}
          {(revision.revisionNotes || revision.changeSummary || revision.rejectionReason) && (
            <div className="bg-[#181818] border border-[#2A2A2A] rounded-xl p-4 space-y-2">
              <h4 className="text-[10px] font-mono font-bold text-gray-400 uppercase tracking-wider flex items-center gap-2">
                <FileText className="w-3.5 h-3.5 text-amber-400" />
                <span>Revision Justification & Audit Notes</span>
              </h4>
              {revision.revisionNotes && (
                <div className="p-3 bg-[#121212] rounded-lg border border-[#222] text-gray-200 font-mono text-xs">
                  <span className="text-amber-400 font-bold">Author Justification: </span>
                  "{revision.revisionNotes}"
                </div>
              )}
              {revision.changeSummary && (
                <p className="text-xs text-gray-400">
                  <span className="font-semibold text-gray-300">Summary: </span>
                  {revision.changeSummary}
                </p>
              )}
              {revision.rejectionReason && (
                <div className="p-3 bg-red-950/20 border border-red-500/30 rounded-lg text-red-300 text-xs">
                  <span className="font-bold text-red-400">Rejection Feedback / Required Actions: </span>
                  "{revision.rejectionReason}"
                </div>
              )}
            </div>
          )}

          {/* Snapshot Specifications & Acceptance Criteria */}
          <div className="bg-[#181818] border border-[#2A2A2A] rounded-xl p-4 space-y-2">
            <div className="flex items-center justify-between">
              <h4 className="text-[10px] font-mono font-bold text-gray-400 uppercase tracking-wider flex items-center gap-2">
                <ShieldCheck className="w-3.5 h-3.5 text-blue-400" />
                <span>Technical Specifications Snapshot</span>
              </h4>
              {revision.supplier && (
                <span className="text-xs text-gray-400">
                  Supplier: <strong className="text-gray-200">{revision.supplier}</strong>
                </span>
              )}
            </div>
            <div className="p-3 bg-[#121212] rounded-lg border border-[#222] text-gray-200 whitespace-pre-wrap leading-relaxed">
              {revision.specification || 'No detailed technical specifications recorded in this revision.'}
            </div>
          </div>

          {/* Quality Remarks / Inspection Notes */}
          {revision.remarks && (
            <div className="bg-[#181818] border border-[#2A2A2A] rounded-xl p-4 space-y-2">
              <h4 className="text-[10px] font-mono font-bold text-gray-400 uppercase tracking-wider">
                Inspection Remarks & Acceptance Notes
              </h4>
              <div className="p-3 bg-[#121212] rounded-lg border border-[#222] text-gray-300 whitespace-pre-wrap">
                {revision.remarks}
              </div>
            </div>
          )}

          {/* Custom Fields at this Revision */}
          {revision.customFields && Object.keys(revision.customFields).length > 0 && (
            <div className="bg-[#181818] border border-[#2A2A2A] rounded-xl p-4 space-y-3">
              <h4 className="text-[10px] font-mono font-bold text-gray-400 uppercase tracking-wider flex items-center gap-2">
                <Tag className="w-3.5 h-3.5 text-cyan-400" />
                <span>Custom QC Parameters Snapshot ({Object.keys(revision.customFields).length})</span>
              </h4>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {Object.entries(revision.customFields).map(([key, val]) => (
                  <div key={key} className="bg-[#121212] p-2.5 rounded-lg border border-[#222]">
                    <span className="text-[10px] font-mono text-gray-500 block truncate">{key}</span>
                    <span className="text-xs font-semibold text-gray-200 block truncate mt-0.5">
                      {typeof val === 'boolean' ? (val ? 'Yes / Passed' : 'No / Failed') : String(val)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Attached Specimen Photos Snapshot */}
          <div className="bg-[#181818] border border-[#2A2A2A] rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-[10px] font-mono font-bold text-gray-400 uppercase tracking-wider flex items-center gap-2">
                <ImageIcon className="w-3.5 h-3.5 text-blue-400" />
                <span>Attached Specimen Photos ({revision.photos?.length || 0})</span>
              </h4>
              <span className="text-[11px] text-gray-500 font-mono">
                Archived at Revision {revision.revisionCode}
              </span>
            </div>

            {revision.photos && revision.photos.length > 0 ? (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {revision.photos.map((p, idx) => (
                  <div
                    key={p.id || idx}
                    onClick={() => setSelectedPhoto(p.dataUrl)}
                    className="group relative bg-[#121212] border border-[#262626] hover:border-blue-500/50 rounded-xl overflow-hidden cursor-pointer transition-all aspect-video flex flex-col"
                  >
                    <img
                      src={p.dataUrl}
                      alt={p.name || `Photo ${idx + 1}`}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-2 justify-between">
                      <span className="text-[10px] text-white font-mono truncate">{p.name || `Photo #${idx + 1}`}</span>
                      <Eye className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-gray-500 italic p-3 bg-[#121212] rounded-lg border border-[#222]">
                No specimen photos were attached in this revision snapshot.
              </p>
            )}
          </div>

          {/* Document Attachments */}
          {revision.attachments && revision.attachments.length > 0 && (
            <div className="bg-[#181818] border border-[#2A2A2A] rounded-xl p-4 space-y-2">
              <h4 className="text-[10px] font-mono font-bold text-gray-400 uppercase tracking-wider flex items-center gap-2">
                <Paperclip className="w-3.5 h-3.5 text-amber-400" />
                <span>Test Certificates & Documents ({revision.attachments.length})</span>
              </h4>
              <div className="divide-y divide-[#222]">
                {revision.attachments.map((att, idx) => (
                  <div key={att.id || idx} className="py-2 flex items-center justify-between text-xs">
                    <span className="font-mono text-gray-300">{att.name}</span>
                    <span className="text-[10px] text-gray-500 font-mono">
                      {(att.size / 1024).toFixed(1)} KB • {att.type || 'Document'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Photo Zoom Modal */}
        {selectedPhoto && (
          <div
            className="fixed inset-0 z-60 bg-black/90 flex items-center justify-center p-4"
            onClick={() => setSelectedPhoto(null)}
          >
            <div className="relative max-w-4xl max-h-[90vh]">
              <img src={selectedPhoto} alt="Zoomed View" className="max-w-full max-h-[85vh] rounded-lg object-contain" />
              <button
                onClick={() => setSelectedPhoto(null)}
                className="absolute top-2 right-2 p-2 bg-black/70 text-white rounded-full hover:bg-black transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
