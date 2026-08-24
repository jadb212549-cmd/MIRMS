import React, { useState } from 'react';
import { ReferenceRegistration, ReferenceRevisionRecord, MasterItem, AppConfig } from '../types';
import { 
  X, 
  ShieldCheck, 
  FileText, 
  Image as ImageIcon, 
  Paperclip, 
  Calendar, 
  User, 
  Edit3, 
  Trash2, 
  Printer, 
  Download, 
  Star, 
  Clock,
  ExternalLink,
  History,
  Eye,
  ArrowLeftRight
} from 'lucide-react';
import { wordService } from '../services/wordService';
import { InspectionProofModal } from './InspectionProofModal';
import { RevisionAuditSnapshotModal } from './RevisionAuditSnapshotModal';
import { RevisionCompareModal } from './RevisionCompareModal';
import { RevisionAuditDossierModal } from './RevisionAuditDossierModal';
import { db } from '../services/db';
import { userService } from '../services/userService';

interface ReferenceDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  registration: ReferenceRegistration | null;
  masterItem?: MasterItem;
  config: AppConfig;
  onEdit: (reg: ReferenceRegistration) => void;
  onDelete: (id: string) => Promise<void>;
}

export const ReferenceDetailModal: React.FC<ReferenceDetailModalProps> = ({
  isOpen,
  onClose,
  registration,
  masterItem,
  config,
  onEdit,
  onDelete
}) => {
  const [currentUser, setCurrentUser] = useState(userService.getCurrentUser());
  const [selectedPhoto, setSelectedPhoto] = useState<string | null>(null);
  const [showInspectionProof, setShowInspectionProof] = useState(false);
  const [isGeneratingDoc, setIsGeneratingDoc] = useState(false);
  
  // Auditing & Revision Snapshot Modals
  const [snapshotRevision, setSnapshotRevision] = useState<ReferenceRevisionRecord | null>(null);
  const [showDossierModal, setShowDossierModal] = useState(false);
  const [compareRevisions, setCompareRevisions] = useState<{ revA?: ReferenceRevisionRecord; revB?: ReferenceRevisionRecord } | null>(null);

  React.useEffect(() => {
    const unsubscribe = userService.subscribe(() => {
      setCurrentUser(userService.getCurrentUser());
    });
    return () => unsubscribe();
  }, []);

  const isAdmin = currentUser?.role === 'admin';

  if (!isOpen || !registration) return null;

  const handleGenerateWordForm = async () => {
    if (!masterItem) return;
    setIsGeneratingDoc(true);
    try {
      await wordService.generateAndSave(registration, masterItem, config, registration.registeredBy);
    } catch (err) {
      console.error('Word form generation error:', err);
    } finally {
      setIsGeneratingDoc(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-[#161616] rounded-xl shadow-2xl border border-[#333] w-full max-w-3xl overflow-hidden my-6 animate-in fade-in zoom-in-95 duration-150">
        {/* Modal Top Bar */}
        <div className="bg-[#0A0A0A] text-white px-6 py-4 flex items-center justify-between border-b border-[#222]">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-[#1A1A1A] border border-[#2A2A2A] rounded-lg text-blue-400 font-bold">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold font-mono text-gray-100">
                  {registration.productCode}
                </h3>
                <span className="text-xs font-semibold px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-mono">
                  {registration.revision}
                </span>
                <span className="text-xs font-semibold px-2 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20 font-mono">
                  {masterItem?.category === 'RM' ? 'Raw Material' : 'Production Supply'}
                </span>
                <span
                  className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded ${
                    registration.status === 'APPROVED'
                      ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                      : registration.status === 'PENDING_APPROVAL'
                      ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                      : 'bg-red-500/15 text-red-400 border border-red-500/30'
                  }`}
                >
                  {registration.status || 'APPROVED'}
                </span>
              </div>
              <p className="text-xs text-gray-400 mt-0.5 truncate max-w-md">
                {masterItem?.description || 'Registered Material Reference Sample'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {currentUser && (
              <button
                onClick={() => onEdit(registration)}
                className="p-1.5 text-gray-400 hover:text-white hover:bg-[#222] rounded-md transition-colors cursor-pointer"
                title={registration.status === 'PENDING_APPROVAL' ? 'Edit Pending Reference' : 'Edit Reference (Submit Revision)'}
              >
                <Edit3 className="w-4 h-4" />
              </button>
            )}
            <button
              onClick={onClose}
              className="p-1.5 text-gray-400 hover:text-white hover:bg-[#222] rounded-md transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-6 max-h-[80vh] overflow-y-auto">
          {/* Pending New Registration Alert Banner */}
          {registration.status === 'PENDING_APPROVAL' && !registration.hasPendingRevision && (
            <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-4 flex items-start gap-3 animate-in fade-in duration-150">
              <div className="p-2 bg-blue-500/20 text-blue-400 rounded-lg shrink-0 mt-0.5">
                <Clock className="w-5 h-5" />
              </div>
              <div className="space-y-1 flex-1 text-xs">
                <div className="flex items-center justify-between">
                  <h4 className="font-bold text-blue-300 font-mono text-sm">
                    New Reference Registration Pending Admin Approval
                  </h4>
                  <span className="font-mono text-[11px] font-bold px-2 py-0.5 rounded bg-blue-500 text-white">
                    {registration.revision || 'Rev 01'}
                  </span>
                </div>
                <p className="text-gray-300 leading-relaxed">
                  This new reference sample was registered by <strong className="text-blue-200">{registration.registeredBy}</strong> on{' '}
                  <span className="font-mono text-gray-400">{registration.registrationDate}</span>.
                  It is currently in <strong className="text-amber-400 font-mono">PENDING_APPROVAL</strong> state and awaiting review by a System Administrator.
                </p>
              </div>
            </div>
          )}

          {/* Pending Revision Alert Banner */}
          {registration.hasPendingRevision && (
            <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4 flex items-start gap-3 animate-in fade-in duration-150">
              <div className="p-2 bg-amber-500/20 text-amber-400 rounded-lg shrink-0 mt-0.5">
                <Clock className="w-5 h-5" />
              </div>
              <div className="space-y-1 flex-1 text-xs">
                <div className="flex items-center justify-between">
                  <h4 className="font-bold text-amber-300 font-mono text-sm">
                    Proposed Revision Pending Admin Approval
                  </h4>
                  <span className="font-mono text-[11px] font-bold px-2 py-0.5 rounded bg-amber-500 text-black">
                    {registration.pendingRevision?.revisionCode || 'Next Revision'}
                  </span>
                </div>
                <p className="text-gray-300 leading-relaxed">
                  A new revision has been submitted by <strong className="text-amber-200">{registration.pendingRevision?.submittedBy || 'QA Staff'}</strong> on{' '}
                  <span className="font-mono text-gray-400">{registration.pendingRevision ? new Date(registration.pendingRevision.submittedAt).toLocaleString() : 'recently'}</span>.
                  The current official version (<strong className="text-emerald-400">{registration.revision}</strong>) remains in effect until an Administrator reviews and approves the revision.
                </p>
                {registration.pendingRevision?.revisionNotes && (
                  <div className="mt-2 p-2.5 bg-[#141414] rounded-lg border border-amber-500/20 text-gray-300 font-mono text-[11px]">
                    <span className="text-amber-400 font-bold">Revision Justification: </span>
                    "{registration.pendingRevision.revisionNotes}"
                  </div>
                )}
              </div>
            </div>
          )}
          {/* Metadata Badges Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-[#141414] p-3.5 rounded-xl border border-[#222] text-xs">
            <div>
              <span className="text-gray-500 block text-[11px] font-mono">Registered By</span>
              <strong className="text-gray-200 flex items-center gap-1 mt-0.5">
                <User className="w-3.5 h-3.5 text-blue-400" />
                {registration.registeredBy}
              </strong>
            </div>
            <div>
              <span className="text-gray-500 block text-[11px] font-mono">Registration Date</span>
              <strong className="text-gray-200 flex items-center gap-1 mt-0.5 font-mono">
                <Calendar className="w-3.5 h-3.5 text-gray-400" />
                {registration.registrationDate}
              </strong>
            </div>
            <div>
              <span className="text-gray-500 block text-[11px] font-mono">Supplier / Source</span>
              <strong className="text-gray-200 truncate block mt-0.5">
                {registration.supplier || 'N/A'}
              </strong>
            </div>
            <div>
              <span className="text-gray-500 block text-[11px] font-mono">Inspection Status</span>
              {registration.status === 'APPROVED' ? (
                <strong className="text-emerald-400 flex items-center gap-1 mt-0.5 font-mono">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  Verified Active
                </strong>
              ) : registration.status === 'PENDING_APPROVAL' ? (
                <strong className="text-amber-400 flex items-center gap-1 mt-0.5 font-mono">
                  <Clock className="w-3.5 h-3.5" />
                  Pending Approval
                </strong>
              ) : (
                <strong className="text-red-400 flex items-center gap-1 mt-0.5 font-mono">
                  Rejected
                </strong>
              )}
            </div>
          </div>

          {/* Master Item Reference Comparison */}
          {masterItem && (
            <div className="border border-[#222] rounded-xl p-4 bg-[#141414]">
              <h4 className="text-xs font-mono font-bold text-gray-300 uppercase tracking-wider mb-2 flex items-center justify-between">
                <span>Master Item Reference Data (From Catalog)</span>
                <span className="text-[10px] text-gray-500 font-normal">Read-only baseline</span>
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                <div>
                  <span className="text-gray-500 text-[11px]">Description:</span>
                  <p className="font-medium text-gray-200 mt-0.5">{masterItem.description}</p>
                </div>
                <div>
                  <span className="text-gray-500 text-[11px]">Master Status:</span>
                  <p className="font-medium text-gray-200 mt-0.5">{masterItem.status}</p>
                </div>
                <div>
                  <span className="text-gray-500 text-[11px]">Reference Unit:</span>
                  <p className="font-medium text-gray-200 mt-0.5">{masterItem.unit || 'Unit'}</p>
                </div>
              </div>
            </div>
          )}

          {/* Technical Specifications */}
          <div className="border border-[#222] rounded-xl p-4 bg-[#141414] space-y-2">
            <h4 className="text-xs font-mono font-bold text-gray-300 uppercase tracking-wider">
              Technical Specifications & Acceptance Criteria
            </h4>
            <div className="text-xs text-gray-300 whitespace-pre-wrap bg-[#1A1A1A] p-3 rounded-lg border border-[#2A2A2A] leading-relaxed font-sans">
              {registration.specification || 'No detailed technical specification recorded.'}
            </div>
          </div>

          {/* Revision History & Simplified Preview of Last Revision */}
          <div className="border border-[#222] rounded-xl p-4 bg-[#141414] space-y-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <h4 className="text-xs font-mono font-bold text-gray-300 uppercase tracking-wider flex items-center gap-2">
                  <History className="w-3.5 h-3.5 text-purple-400" />
                  <span>
                    Revision & Audit Lifecycle ({registration.versions?.length || registration.revisionHistory?.length || 1})
                  </span>
                </h4>
                <span className="text-[11px] font-mono text-purple-400 font-semibold bg-purple-500/10 px-2 py-0.5 rounded border border-purple-500/20">
                  Official: {registration.revision} (v{registration.currentVersionNumber || 1})
                </span>
              </div>

              <div className="flex items-center gap-2">
                {(registration.versions && registration.versions.length > 1) && (
                  <button
                    onClick={() => setCompareRevisions({ revA: registration.versions![registration.versions!.length - 2], revB: registration.versions![registration.versions!.length - 1] })}
                    className="flex items-center gap-1 text-[11px] font-semibold text-blue-400 hover:text-blue-300 bg-blue-500/10 hover:bg-blue-500/20 px-2.5 py-1 rounded-lg border border-blue-500/20 transition-colors cursor-pointer"
                  >
                    <ArrowLeftRight className="w-3 h-3" />
                    <span>Compare Diff</span>
                  </button>
                )}
                <button
                  onClick={() => setShowDossierModal(true)}
                  className="flex items-center gap-1 text-[11px] font-semibold text-purple-300 hover:text-purple-200 bg-purple-500/15 hover:bg-purple-500/25 px-2.5 py-1 rounded-lg border border-purple-500/30 transition-colors cursor-pointer"
                >
                  <Eye className="w-3 h-3" />
                  <span>Full Audit Dossier</span>
                </button>
              </div>
            </div>

            {/* Versions List */}
            {registration.versions && registration.versions.length > 0 ? (
              <div className="space-y-2">
                <div className="divide-y divide-[#222]">
                  {registration.versions.map((ver, idx) => {
                    const isOfficial = ver.revisionCode === registration.revision && ver.status === 'APPROVED';
                    const prevVer = registration.versions![idx + 1];
                    return (
                      <div key={ver.id} className="py-2.5 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 hover:bg-[#181818]/60 p-2 rounded-lg transition-colors">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-mono font-bold text-gray-100 bg-[#222] px-2 py-0.5 rounded text-[11px] border border-[#333]">
                              v{ver.versionNumber}: {ver.revisionCode}
                            </span>
                            <span
                              className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded ${
                                ver.status === 'APPROVED'
                                  ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                                  : ver.status === 'PENDING_APPROVAL'
                                  ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                                  : 'bg-red-500/15 text-red-400 border border-red-500/30'
                              }`}
                            >
                              {ver.status}
                            </span>
                            {isOfficial && (
                              <span className="text-[9px] font-mono font-bold bg-blue-500/20 text-blue-300 border border-blue-500/30 px-1.5 py-0.5 rounded">
                                ACTIVE BASELINE
                              </span>
                            )}
                          </div>
                          <p className="text-gray-400 text-[11px]">
                            {ver.revisionNotes || ver.changeSummary || 'Baseline reference registration'}
                          </p>
                        </div>

                        <div className="flex items-center gap-3 shrink-0 sm:self-center">
                          <div className="text-right text-[10px] text-gray-500 font-mono hidden md:block">
                            <div>Sub: {ver.submittedBy} ({new Date(ver.submittedAt).toLocaleDateString()})</div>
                            {ver.approvedBy && (
                              <div className="text-emerald-400">Appr: {ver.approvedBy}</div>
                            )}
                            {ver.rejectedBy && (
                              <div className="text-red-400">Rej: {ver.rejectedBy}</div>
                            )}
                          </div>

                          <div className="flex items-center gap-1.5">
                            {prevVer && (
                              <button
                                onClick={() => setCompareRevisions({ revA: prevVer, revB: ver })}
                                title="Compare this version with previous"
                                className="p-1 text-blue-400 hover:text-blue-300 bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/20 rounded transition-colors"
                              >
                                <ArrowLeftRight className="w-3.5 h-3.5" />
                              </button>
                            )}
                            <button
                              onClick={() => setSnapshotRevision(ver)}
                              className="flex items-center gap-1 px-2 py-1 text-[11px] font-semibold text-gray-300 hover:text-white bg-[#222] hover:bg-[#2A2A2A] border border-[#333] rounded transition-colors"
                            >
                              <Eye className="w-3 h-3 text-purple-400" />
                              <span>Inspect</span>
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : registration.revisionHistory && registration.revisionHistory.length > 0 ? (
              <div className="space-y-2">
                <div className="divide-y divide-[#222]">
                  {registration.revisionHistory.map((rev, idx) => (
                    <div key={rev.id || idx} className="py-2 text-xs flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-gray-200 bg-[#222] px-1.5 py-0.5 rounded text-[10px]">
                          {rev.revision}
                        </span>
                        <span className="text-gray-400 text-[11px]">
                          {rev.changeSummary || 'Specification revision'}
                        </span>
                      </div>
                      <span className="text-[10px] text-gray-500 font-mono">
                        {rev.date} ({rev.author})
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="p-3 bg-[#1A1A1A] rounded-lg border border-[#2A2A2A] text-xs text-gray-400 flex items-center justify-between">
                <span>Original baseline registration ({registration.revision}). No previous revisions logged.</span>
                <span className="text-[10px] text-gray-500 font-mono">{registration.registrationDate}</span>
              </div>
            )}
          </div>

          {/* Photos Gallery */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-mono font-bold text-gray-300 uppercase tracking-wider flex items-center gap-2">
                <ImageIcon className="w-4 h-4 text-blue-400" />
                <span>Reference Specimen Photos ({registration.photos?.length || 0})</span>
              </h4>
              <span className="text-[11px] text-gray-500 font-mono">
                Click any image to enlarge
              </span>
            </div>

            {!registration.photos || registration.photos.length === 0 ? (
              <div className="text-xs text-gray-500 italic bg-[#141414] p-4 rounded-xl border border-[#222] text-center">
                No visual photos attached to this sample reference.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                {registration.photos.map((photo) => (
                  <div
                    key={photo.id}
                    className="group border border-[#2A2A2A] hover:border-[#444] rounded-xl bg-[#141414] p-2.5 transition-all relative"
                  >
                    {/* Photo Thumbnail */}
                    <div
                      onClick={() => setSelectedPhoto(photo.dataUrl)}
                      className="relative h-32 w-full overflow-hidden rounded-lg bg-[#0A0A0A] border border-[#222] cursor-pointer"
                    >
                      <img
                        src={photo.dataUrl}
                        alt={photo.fileName}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                      />
                      {photo.isPrimary && (
                        <div className="absolute top-2 left-2 bg-amber-500 text-black px-1.5 py-0.5 rounded text-[10px] font-bold flex items-center gap-1 shadow-sm">
                          <Star className="w-2.5 h-2.5 fill-black" /> Primary
                        </div>
                      )}
                      <div className="absolute bottom-2 left-2 bg-black/80 backdrop-blur-xs text-gray-300 px-1.5 py-0.5 rounded text-[9px] font-mono">
                        {photo.photoCategory?.replace('_', ' ') || 'Inspection Photo'}
                      </div>
                    </div>

                    {/* Photo Info */}
                    <div className="mt-2 space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <p className="font-semibold text-gray-200 truncate flex-1 mr-1">
                          {photo.fileName}
                        </p>
                        <span className="text-[10px] text-gray-500 font-mono">
                          {Math.round(photo.fileSize / 1024)} KB
                        </span>
                      </div>

                      {photo.caption && (
                        <p className="text-[11px] text-gray-400 italic truncate">
                          "{photo.caption}"
                        </p>
                      )}

                      <div className="pt-1 flex items-center justify-end">
                        <button
                          type="button"
                          onClick={() => setSelectedPhoto(photo.dataUrl)}
                          className="text-[11px] text-blue-400 hover:text-blue-300 font-medium flex items-center gap-1"
                        >
                          <ExternalLink className="w-3 h-3" /> Enlarge
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Document Attachments */}
          {registration.attachments && registration.attachments.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-xs font-mono font-bold text-gray-300 uppercase tracking-wider">
                Reference Documents & Test Certificates ({registration.attachments.length})
              </h4>
              <div className="space-y-1.5">
                {registration.attachments.map((att) => (
                  <div
                    key={att.id}
                    className="flex items-center justify-between p-2.5 rounded-lg bg-[#141414] border border-[#222] text-xs"
                  >
                    <div className="flex items-center gap-2">
                      <Paperclip className="w-4 h-4 text-blue-400 shrink-0" />
                      <span className="font-semibold text-gray-200">{att.fileName}</span>
                      <span className="text-[11px] text-gray-500 font-mono">
                        ({Math.round(att.fileSize / 1024)} KB)
                      </span>
                    </div>
                    {att.dataUrl && (
                      <a
                        href={att.dataUrl}
                        download={att.fileName}
                        className="text-xs font-semibold text-blue-400 hover:text-blue-300 flex items-center gap-1 transition-colors"
                      >
                        <Download className="w-3.5 h-3.5" /> Download
                      </a>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Remarks */}
          {registration.remarks && (
            <div className="border border-[#222] rounded-xl p-4 bg-[#141414] space-y-1">
              <h4 className="text-xs font-mono font-bold text-gray-300 uppercase tracking-wider">
                Remarks & Quality Notes
              </h4>
              <p className="text-xs text-gray-300">{registration.remarks}</p>
            </div>
          )}

          {/* Action Footer */}
          <div className="pt-4 border-t border-[#222] flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              {registration.status === 'PENDING_APPROVAL' ? (
                currentUser && (
                  <button
                    type="button"
                    onClick={() => onEdit(registration)}
                    className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-amber-950 bg-amber-400 hover:bg-amber-300 rounded-lg shadow-sm transition-colors cursor-pointer"
                  >
                    <Edit3 className="w-4 h-4" />
                    <span>Edit Pending Registration</span>
                  </button>
                )
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => setShowInspectionProof(true)}
                    className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-500 rounded-lg shadow-sm transition-colors cursor-pointer"
                  >
                    <Printer className="w-4 h-4" />
                    <span>Print Inspection Proof</span>
                  </button>

                  <button
                    onClick={handleGenerateWordForm}
                    disabled={isGeneratingDoc || !masterItem}
                    className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-gray-200 bg-[#222] hover:bg-[#2A2A2A] border border-[#333] rounded-lg transition-colors disabled:opacity-50"
                  >
                    <FileText className="w-4 h-4 text-blue-400" />
                    <span>{isGeneratingDoc ? 'Generating DOCX...' : 'Generate Word Form (DOCX)'}</span>
                  </button>
                </>
              )}
            </div>

            {isAdmin && (
              <div className="flex items-center gap-2">
                <button
                  onClick={async () => {
                    if (confirm(`Delete reference sample registration for ${registration.productCode}?`)) {
                      await onDelete(registration.id);
                      onClose();
                    }
                  }}
                  className="flex items-center gap-1 text-xs font-semibold text-red-400 hover:text-red-300 px-3 py-2 hover:bg-red-500/10 rounded-lg transition-colors cursor-pointer"
                  title="Admin Only: Delete Reference Registration"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Delete Registration</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Lightbox Photo Preview Modal */}
      {selectedPhoto && (
        <div
          onClick={() => setSelectedPhoto(null)}
          className="fixed inset-0 z-60 bg-black/90 flex items-center justify-center p-4 cursor-zoom-out"
        >
          <img
            src={selectedPhoto}
            alt="Sample Preview"
            className="max-w-full max-h-[90vh] rounded-lg shadow-2xl object-contain bg-[#161616] border border-[#333]"
          />
        </div>
      )}

      {/* Print Inspection Proof Modal */}
      <InspectionProofModal
        isOpen={showInspectionProof}
        onClose={() => setShowInspectionProof(false)}
        registration={registration}
        masterItem={masterItem}
        config={config}
      />

      {/* Revision Snapshot Audit Modal */}
      {snapshotRevision && (
        <RevisionAuditSnapshotModal
          registration={registration}
          revision={snapshotRevision}
          masterItem={masterItem}
          onClose={() => setSnapshotRevision(null)}
          onCompareWithAnother={(rev) => {
            setSnapshotRevision(null);
            setCompareRevisions({ revA: rev, revB: registration.versions?.[registration.versions.length - 1] });
          }}
        />
      )}

      {/* Revision Side-by-Side Diff Modal */}
      {compareRevisions && (
        <RevisionCompareModal
          registration={registration}
          masterItem={masterItem}
          initialRevA={compareRevisions.revA}
          initialRevB={compareRevisions.revB}
          onClose={() => setCompareRevisions(null)}
        />
      )}

      {/* Full Revision Audit Dossier Modal */}
      {showDossierModal && (
        <RevisionAuditDossierModal
          registration={registration}
          masterItem={masterItem}
          onClose={() => setShowDossierModal(false)}
        />
      )}
    </div>
  );
};


