import React, { useState } from 'react';
import { ReferenceRegistration, MasterItem, AppConfig } from '../types';
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
  ExternalLink
} from 'lucide-react';
import { wordService } from '../services/wordService';
import { InspectionProofModal } from './InspectionProofModal';
import { db } from '../services/db';

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
  const [selectedPhoto, setSelectedPhoto] = useState<string | null>(null);
  const [showInspectionProof, setShowInspectionProof] = useState(false);
  const [isGeneratingDoc, setIsGeneratingDoc] = useState(false);

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
              </div>
              <p className="text-xs text-gray-400 mt-0.5 truncate max-w-md">
                {masterItem?.description || 'Registered Material Reference Sample'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => onEdit(registration)}
              className="p-1.5 text-gray-400 hover:text-white hover:bg-[#222] rounded-md transition-colors"
              title="Edit Registration"
            >
              <Edit3 className="w-4 h-4" />
            </button>
            <button
              onClick={onClose}
              className="p-1.5 text-gray-400 hover:text-white hover:bg-[#222] rounded-md transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-6 max-h-[80vh] overflow-y-auto">
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
              <strong className="text-emerald-400 flex items-center gap-1 mt-0.5 font-mono">
                <ShieldCheck className="w-3.5 h-3.5" />
                Verified Active
              </strong>
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
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-mono font-bold text-gray-300 uppercase tracking-wider flex items-center gap-2">
                <Clock className="w-3.5 h-3.5 text-purple-400" />
                <span>Revision History ({registration.revisionHistory?.length || 0})</span>
              </h4>
              <span className="text-[11px] font-mono text-purple-400 font-semibold bg-purple-500/10 px-2 py-0.5 rounded border border-purple-500/20">
                Current: {registration.revision}
              </span>
            </div>

            {/* Last Revision Preview */}
            {registration.revisionHistory && registration.revisionHistory.length > 0 ? (
              <div className="space-y-2">
                <div className="bg-[#1C1A24] p-3 rounded-lg border border-purple-500/30">
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="text-purple-300 font-mono font-bold flex items-center gap-1">
                      <span>Last Revision Preview:</span>
                      <span className="bg-purple-500/20 text-purple-200 px-1.5 py-0.5 rounded text-[10px]">
                        {registration.revisionHistory[0].revision}
                      </span>
                    </span>
                    <span className="text-[10px] text-gray-400 font-mono">
                      {registration.revisionHistory[0].date} • by {registration.revisionHistory[0].author}
                    </span>
                  </div>
                  {registration.revisionHistory[0].changeSummary && (
                    <p className="text-[11px] text-purple-200 font-mono mb-1">
                      {registration.revisionHistory[0].changeSummary}
                    </p>
                  )}
                  {registration.revisionHistory[0].specification && (
                    <p className="text-xs text-gray-300 line-clamp-2 bg-[#121118] p-2 rounded border border-purple-900/30 font-sans mt-1">
                      <span className="text-gray-500 font-mono text-[10px] block">Previous Specification:</span>
                      {registration.revisionHistory[0].specification}
                    </p>
                  )}
                </div>

                {/* Simplified Revision Timeline */}
                <div className="pt-2 divide-y divide-[#222]">
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
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={async () => {
                  if (confirm(`Delete reference sample registration for ${registration.productCode}?`)) {
                    await onDelete(registration.id);
                    onClose();
                  }
                }}
                className="flex items-center gap-1 text-xs font-semibold text-red-400 hover:text-red-300 px-3 py-2 hover:bg-red-500/10 rounded-lg transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Delete Registration</span>
              </button>
            </div>
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
    </div>
  );
};


