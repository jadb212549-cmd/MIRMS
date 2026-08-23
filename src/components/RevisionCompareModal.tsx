import React, { useState, useMemo } from 'react';
import { ReferenceRegistration, ReferenceRevisionRecord, MasterItem } from '../types';
import { 
  ArrowLeftRight, 
  X, 
  User, 
  Calendar, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  AlertTriangle, 
  FileText, 
  Tag, 
  Image as ImageIcon, 
  Paperclip, 
  Printer, 
  Eye, 
  Sparkles,
  ChevronRight
} from 'lucide-react';

interface RevisionCompareModalProps {
  registration: ReferenceRegistration;
  masterItem?: MasterItem;
  initialRevA?: ReferenceRevisionRecord;
  initialRevB?: ReferenceRevisionRecord;
  onClose: () => void;
}

export const RevisionCompareModal: React.FC<RevisionCompareModalProps> = ({
  registration,
  masterItem,
  initialRevA,
  initialRevB,
  onClose
}) => {
  const versionsList = useMemo(() => {
    return registration.versions || [];
  }, [registration]);

  // Default Rev A (older version or v1) and Rev B (newer version or pending)
  const [selectedRevAId, setSelectedRevAId] = useState<string>(
    initialRevA?.id || (versionsList.length > 1 ? versionsList[versionsList.length - 2]?.id : versionsList[0]?.id || '')
  );
  const [selectedRevBId, setSelectedRevBId] = useState<string>(
    initialRevB?.id || versionsList[versionsList.length - 1]?.id || ''
  );

  const revA = useMemo(() => {
    return versionsList.find((v) => v.id === selectedRevAId) || versionsList[0] || initialRevA;
  }, [versionsList, selectedRevAId, initialRevA]);

  const revB = useMemo(() => {
    return versionsList.find((v) => v.id === selectedRevBId) || versionsList[versionsList.length - 1] || initialRevB;
  }, [versionsList, selectedRevBId, initialRevB]);

  // Compare field helper
  const isDifferent = (valA: any, valB: any) => {
    return JSON.stringify(valA ?? '') !== JSON.stringify(valB ?? '');
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-[#121212] border border-[#2E2E2E] w-full max-w-6xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[94vh]">
        {/* Header */}
        <div className="px-6 py-4 bg-[#181818] border-b border-[#2A2A2A] flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400">
              <ArrowLeftRight className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono font-bold text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded border border-blue-500/20">
                  {registration.productCode}
                </span>
                <span className="text-xs font-mono text-gray-400">
                  Revision Diff & Compliance Audit
                </span>
              </div>
              <h3 className="text-sm font-semibold text-gray-200 mt-1 truncate max-w-md">
                {masterItem?.description || 'Comparing Reference Versions'}
              </h3>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-gray-300 bg-[#222] hover:bg-[#2A2A2A] border border-[#333] rounded-lg transition-colors cursor-pointer"
              title="Print Side-by-Side Comparison"
            >
              <Printer className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Print Diff Report</span>
            </button>
            <button
              onClick={onClose}
              className="p-1.5 text-gray-400 hover:text-white hover:bg-[#252525] rounded-lg transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Version Selectors Bar */}
        <div className="px-6 py-3 bg-[#151515] border-b border-[#222] grid grid-cols-1 md:grid-cols-2 gap-4 shrink-0">
          {/* Base / Baseline Version Selector */}
          <div className="flex items-center justify-between gap-2 bg-[#1A1A1A] p-2 rounded-xl border border-[#2E2E2E]">
            <span className="text-xs font-mono text-gray-400 font-semibold pl-2">Base Version (A):</span>
            <select
              value={selectedRevAId}
              onChange={(e) => setSelectedRevAId(e.target.value)}
              className="bg-[#121212] text-xs font-mono font-bold text-blue-400 border border-[#333] rounded-lg px-3 py-1.5 focus:outline-hidden"
            >
              {versionsList.map((v) => (
                <option key={v.id} value={v.id}>
                  v{v.versionNumber}: {v.revisionCode} ({v.status}) - {v.submittedBy}
                </option>
              ))}
            </select>
          </div>

          {/* Compared / Target Version Selector */}
          <div className="flex items-center justify-between gap-2 bg-[#1A1A1A] p-2 rounded-xl border border-[#2E2E2E]">
            <span className="text-xs font-mono text-gray-400 font-semibold pl-2">Compared Version (B):</span>
            <select
              value={selectedRevBId}
              onChange={(e) => setSelectedRevBId(e.target.value)}
              className="bg-[#121212] text-xs font-mono font-bold text-purple-400 border border-[#333] rounded-lg px-3 py-1.5 focus:outline-hidden"
            >
              {versionsList.map((v) => (
                <option key={v.id} value={v.id}>
                  v{v.versionNumber}: {v.revisionCode} ({v.status}) - {v.submittedBy}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Comparison Content */}
        <div className="p-6 space-y-6 overflow-y-auto max-h-[calc(94vh-140px)] text-xs text-gray-300">
          {/* Version Sign-off & Audit Trail Headers */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Version A Card */}
            <div className="bg-[#161616] border border-[#2A2A2A] rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono font-bold text-blue-400 bg-blue-500/10 px-2.5 py-1 rounded border border-blue-500/20">
                  Version {revA?.versionNumber || 1} • {revA?.revisionCode || 'Rev 01'}
                </span>
                <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded ${
                  revA?.status === 'APPROVED' ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30' : 'bg-[#222] text-gray-400'
                }`}>
                  {revA?.status || 'APPROVED'}
                </span>
              </div>
              <div className="text-xs space-y-1 font-mono text-gray-400 border-t border-[#222] pt-2">
                <div>Submitted By: <strong className="text-gray-200">{revA?.submittedBy || revA?.registeredBy || '-'}</strong></div>
                <div>Submitted At: {revA?.submittedAt ? new Date(revA.submittedAt).toLocaleString() : revA?.registrationDate || '-'}</div>
                {revA?.approvedBy && (
                  <div className="text-emerald-400">Approved By: {revA.approvedBy} ({revA.approvedAt ? new Date(revA.approvedAt).toLocaleDateString() : ''})</div>
                )}
                {revA?.revisionNotes && (
                  <div className="text-gray-300 italic pt-1 font-sans">"{revA.revisionNotes}"</div>
                )}
              </div>
            </div>

            {/* Version B Card */}
            <div className="bg-[#161616] border border-[#2A2A2A] rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono font-bold text-purple-400 bg-purple-500/10 px-2.5 py-1 rounded border border-purple-500/20">
                  Version {revB?.versionNumber || 2} • {revB?.revisionCode || 'Rev 02'}
                </span>
                <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded ${
                  revB?.status === 'APPROVED' 
                    ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30' 
                    : revB?.status === 'PENDING_APPROVAL' 
                    ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30' 
                    : 'bg-red-500/15 text-red-400 border border-red-500/30'
                }`}>
                  {revB?.status || 'PENDING'}
                </span>
              </div>
              <div className="text-xs space-y-1 font-mono text-gray-400 border-t border-[#222] pt-2">
                <div>Submitted By: <strong className="text-gray-200">{revB?.submittedBy || '-'}</strong></div>
                <div>Submitted At: {revB?.submittedAt ? new Date(revB.submittedAt).toLocaleString() : '-'}</div>
                {revB?.approvedBy && (
                  <div className="text-emerald-400">Approved By: {revB.approvedBy} ({revB.approvedAt ? new Date(revB.approvedAt).toLocaleDateString() : ''})</div>
                )}
                {revB?.rejectedBy && (
                  <div className="text-red-400">Rejected By: {revB.rejectedBy} ({revB.rejectedAt ? new Date(revB.rejectedAt).toLocaleDateString() : ''})</div>
                )}
                {revB?.revisionNotes && (
                  <div className="text-amber-300 italic pt-1 font-sans">"{revB.revisionNotes}"</div>
                )}
              </div>
            </div>
          </div>

          {/* Side-by-Side Specifications Comparison */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-mono font-bold text-gray-300 uppercase tracking-wider flex items-center gap-2">
                <FileText className="w-4 h-4 text-blue-400" />
                <span>Technical Specifications Diff</span>
              </h4>
              {isDifferent(revA?.specification, revB?.specification) ? (
                <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  SPECIFICATION MODIFIED
                </span>
              ) : (
                <span className="text-[10px] font-mono text-gray-500">Identical Specification</span>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-[#161616] p-3.5 rounded-xl border border-[#262626] font-sans leading-relaxed whitespace-pre-wrap">
                <span className="text-[10px] font-mono text-gray-500 block mb-1">Version {revA?.revisionCode}:</span>
                {revA?.specification || 'No specifications recorded.'}
              </div>
              <div className={`p-3.5 rounded-xl border font-sans leading-relaxed whitespace-pre-wrap ${
                isDifferent(revA?.specification, revB?.specification)
                  ? 'bg-amber-950/15 border-amber-500/40 text-amber-100'
                  : 'bg-[#161616] border-[#262626] text-gray-300'
              }`}>
                <span className="text-[10px] font-mono text-gray-500 block mb-1">Version {revB?.revisionCode}:</span>
                {revB?.specification || 'No specifications recorded.'}
              </div>
            </div>
          </div>

          {/* Supplier & Category Comparison */}
          <div className="space-y-2">
            <h4 className="text-xs font-mono font-bold text-gray-300 uppercase tracking-wider flex items-center gap-2">
              <Tag className="w-4 h-4 text-cyan-400" />
              <span>Supplier & Category Attributes</span>
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-[#161616] p-3.5 rounded-xl border border-[#262626] space-y-1">
                <div>Supplier: <strong className="text-gray-200">{revA?.supplier || '-'}</strong></div>
                <div>Category: <span className="font-mono text-blue-400">{revA?.category || 'RM'}</span></div>
                <div>Remarks: <span className="text-gray-400">{revA?.remarks || '-'}</span></div>
              </div>
              <div className={`p-3.5 rounded-xl border space-y-1 ${
                isDifferent(revA?.supplier, revB?.supplier) || isDifferent(revA?.remarks, revB?.remarks)
                  ? 'bg-amber-950/15 border-amber-500/40'
                  : 'bg-[#161616] border-[#262626]'
              }`}>
                <div>
                  Supplier:{' '}
                  <strong className={isDifferent(revA?.supplier, revB?.supplier) ? 'text-amber-300 font-bold' : 'text-gray-200'}>
                    {revB?.supplier || '-'}
                  </strong>
                </div>
                <div>Category: <span className="font-mono text-blue-400">{revB?.category || 'RM'}</span></div>
                <div>
                  Remarks:{' '}
                  <span className={isDifferent(revA?.remarks, revB?.remarks) ? 'text-amber-200 font-medium' : 'text-gray-400'}>
                    {revB?.remarks || '-'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Attached Photos Comparison */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-mono font-bold text-gray-300 uppercase tracking-wider flex items-center gap-2">
                <ImageIcon className="w-4 h-4 text-purple-400" />
                <span>Photos Comparison</span>
              </h4>
              <span className="text-xs font-mono text-gray-400">
                {revA?.photos?.length || 0} photos vs {revB?.photos?.length || 0} photos
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Rev A Photos */}
              <div className="bg-[#161616] p-3 rounded-xl border border-[#262626] space-y-2">
                <span className="text-[10px] font-mono text-gray-500 block">Version {revA?.revisionCode} Photos:</span>
                {revA?.photos && revA.photos.length > 0 ? (
                  <div className="grid grid-cols-3 gap-2">
                    {revA.photos.map((p, idx) => (
                      <div key={p.id || idx} className="rounded-lg overflow-hidden border border-[#333] aspect-video">
                        <img src={p.dataUrl} alt={p.name} className="w-full h-full object-cover" />
                      </div>
                    ))}
                  </div>
                ) : (
                  <span className="text-gray-500 italic text-xs">No photos attached</span>
                )}
              </div>

              {/* Rev B Photos */}
              <div className="bg-[#161616] p-3 rounded-xl border border-[#262626] space-y-2">
                <span className="text-[10px] font-mono text-gray-500 block">Version {revB?.revisionCode} Photos:</span>
                {revB?.photos && revB.photos.length > 0 ? (
                  <div className="grid grid-cols-3 gap-2">
                    {revB.photos.map((p, idx) => (
                      <div key={p.id || idx} className="rounded-lg overflow-hidden border border-[#333] aspect-video">
                        <img src={p.dataUrl} alt={p.name} className="w-full h-full object-cover" />
                      </div>
                    ))}
                  </div>
                ) : (
                  <span className="text-gray-500 italic text-xs">No photos attached</span>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
