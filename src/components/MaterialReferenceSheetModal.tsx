import React, { useState, useEffect, useRef } from 'react';
import { 
  ReferenceRegistration, 
  MasterItem, 
  AppConfig, 
  FormTemplate 
} from '../types';
import { 
  X, 
  Printer, 
  FileText, 
  Download, 
  ShieldCheck, 
  Clock, 
  User, 
  Calendar, 
  Building, 
  Tag, 
  CheckCircle2, 
  Image as ImageIcon, 
  Paperclip, 
  ExternalLink,
  Layers,
  Sparkles,
  Maximize2,
  FileCheck,
  Check,
  FileSpreadsheet
} from 'lucide-react';
import mammoth from 'mammoth';
import { userService, AppUser } from '../services/userService';
import { db } from '../services/db';
import { wordService } from '../services/wordService';
import { pdfService } from '../services/pdfService';
import { 
  buildSystemDataDictionary, 
  renderHtmlTemplateWithData,
  DEFAULT_MATERIAL_SHEET_HTML,
  DEFAULT_MATERIAL_SHEET_CSS
} from '../services/templateDefaults';

interface MaterialReferenceSheetModalProps {
  isOpen: boolean;
  onClose: () => void;
  registration: ReferenceRegistration | null;
  masterItem?: MasterItem;
  config: AppConfig;
}

export const MaterialReferenceSheetModal: React.FC<MaterialReferenceSheetModalProps> = ({
  isOpen,
  onClose,
  registration,
  masterItem,
  config
}) => {
  const [adminUsers, setAdminUsers] = useState<AppUser[]>([]);
  const [selectedAdminId, setSelectedAdminId] = useState<string>('');
  const [activeTemplate, setActiveTemplate] = useState<FormTemplate | null>(null);
  const [isGeneratingDocx, setIsGeneratingDocx] = useState(false);
  const [selectedPhoto, setSelectedPhoto] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'SHEET' | 'DETAILS' | 'PHOTOS'>('SHEET');
  const [copiedNotification, setCopiedNotification] = useState(false);
  const [convertedDocxHtml, setConvertedDocxHtml] = useState<string | null>(null);
  const [pdfDataUrl, setPdfDataUrl] = useState<string | null>(null);
  const [isConverting, setIsConverting] = useState(false);

  const printAreaRef = useRef<HTMLDivElement>(null);

  // Load and subscribe to active template changes from DB
  useEffect(() => {
    if (isOpen && registration) {
      const admins = userService.getAdminUsers();
      setAdminUsers(admins);
      if (admins.length > 0) {
        setSelectedAdminId(admins[0].idNumber);
      }

      const fetchActiveTemplate = () => {
        db.getActiveFormTemplate('material_reference_sheet')
          .then(tpl => {
            setActiveTemplate(tpl);
          })
          .catch(err => {
            console.warn('Failed to load active material reference sheet template:', err);
          });
      };

      fetchActiveTemplate();

      const unsubscribe = db.subscribe(() => {
        fetchActiveTemplate();
      });

      return () => {
        unsubscribe();
      };
    }
  }, [isOpen, registration]);

  // Convert DOCX / PDF if active template is binary
  useEffect(() => {
    if (!isOpen || !registration || !activeTemplate) {
      setConvertedDocxHtml(null);
      setPdfDataUrl(null);
      return;
    }

    const selectedAdmin = adminUsers.find(a => a.idNumber === selectedAdminId) || adminUsers[0];
    const authorizerName = selectedAdmin 
      ? `${selectedAdmin.shortName} (${selectedAdmin.fullName})`
      : 'QA Technical Administrator';

    const systemDataDict = buildSystemDataDictionary(
      registration,
      masterItem,
      config,
      authorizerName
    );

    if (activeTemplate.fileType === 'docx' && activeTemplate.fileContent) {
      setIsConverting(true);
      try {
        const cleanBase64 = activeTemplate.fileContent.includes(',')
          ? activeTemplate.fileContent.split(',')[1]
          : activeTemplate.fileContent;
        const binaryString = atob(cleanBase64);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }

        mammoth.convertToHtml({ arrayBuffer: bytes.buffer })
          .then(result => {
            const rawHtml = result.value;
            const styledDocxHtml = `
              <div class="sheet-container docx-rendered-content">
                ${rawHtml}
              </div>
            `;
            const replaced = renderHtmlTemplateWithData(
              styledDocxHtml,
              systemDataDict,
              activeTemplate.fieldMappings,
              activeTemplate.customCss || `
                .docx-rendered-content {
                  padding: 28px;
                  background: #ffffff;
                  color: #0f172a;
                  font-family: Calibri, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
                  font-size: 11pt;
                  line-height: 1.5;
                }
                .docx-rendered-content table {
                  width: 100%;
                  border-collapse: collapse;
                  margin: 12px 0;
                }
                .docx-rendered-content td, .docx-rendered-content th {
                  border: 1px solid #cbd5e1;
                  padding: 6px 10px;
                }
                .docx-rendered-content h1, .docx-rendered-content h2, .docx-rendered-content h3 {
                  color: #0f172a;
                  margin-top: 14px;
                  margin-bottom: 6px;
                }
              `
            );
            setConvertedDocxHtml(replaced);
            setIsConverting(false);
          })
          .catch(err => {
            console.warn('Failed to parse docx template with mammoth:', err);
            setConvertedDocxHtml(null);
            setIsConverting(false);
          });
      } catch (err) {
        console.warn('Docx conversion error:', err);
        setConvertedDocxHtml(null);
        setIsConverting(false);
      }
    } else if (activeTemplate.fileType === 'pdf' && activeTemplate.fileContent) {
      pdfService.fillPdfTemplate(activeTemplate, systemDataDict)
        .then(filledBase64 => {
          setPdfDataUrl(`data:application/pdf;base64,${filledBase64}`);
        })
        .catch(err => {
          console.warn('Failed to fill active PDF template:', err);
          setPdfDataUrl(null);
        });
    } else {
      setConvertedDocxHtml(null);
      setPdfDataUrl(null);
    }
  }, [activeTemplate, registration, masterItem, config, selectedAdminId, adminUsers, isOpen]);

  if (!isOpen || !registration) return null;

  const selectedAdmin = adminUsers.find(a => a.idNumber === selectedAdminId) || adminUsers[0];
  const currentUser = userService.getCurrentUser();
  const authorizerName = selectedAdmin 
    ? `${selectedAdmin.shortName} (${selectedAdmin.fullName})`
    : 'QA Technical Administrator';

  // Build system data dictionary for template replacement
  const systemDataDict = buildSystemDataDictionary(
    registration,
    masterItem,
    config,
    authorizerName
  );

  // Template content resolution
  let renderedHtml = '';
  const templateCss = (activeTemplate && activeTemplate.customCss)
    ? activeTemplate.customCss
    : DEFAULT_MATERIAL_SHEET_CSS;

  if (activeTemplate?.fileType === 'docx' && convertedDocxHtml) {
    renderedHtml = convertedDocxHtml;
  } else if (activeTemplate?.fileType === 'txt' && activeTemplate.fileContent) {
    const renderedTxt = renderHtmlTemplateWithData(
      activeTemplate.fileContent,
      systemDataDict,
      activeTemplate.fieldMappings
    );
    renderedHtml = `
      <div class="sheet-container" style="background:#fff; color:#0f172a; padding:24px; font-family:monospace; font-size:12px; white-space:pre-wrap; border:1px solid #cbd5e1; line-height:1.5;">
        ${renderedTxt}
      </div>
    `;
  } else if (activeTemplate && activeTemplate.fileContent) {
    renderedHtml = renderHtmlTemplateWithData(
      activeTemplate.fileContent,
      systemDataDict,
      activeTemplate.fieldMappings,
      templateCss
    );
  } else {
    renderedHtml = renderHtmlTemplateWithData(
      DEFAULT_MATERIAL_SHEET_HTML,
      systemDataDict,
      undefined,
      DEFAULT_MATERIAL_SHEET_CSS
    );
  }

  const handlePrint = () => {
    try {
      const iframe = document.createElement('iframe');
      iframe.style.position = 'fixed';
      iframe.style.right = '0';
      iframe.style.bottom = '0';
      iframe.style.width = '0';
      iframe.style.height = '0';
      iframe.style.border = '0';
      document.body.appendChild(iframe);

      const doc = iframe.contentWindow?.document;
      if (doc) {
        doc.open();
        doc.write(`
          <!DOCTYPE html>
          <html>
            <head>
              <title>Material Reference Sheet - ${registration.productCode} (${registration.revision})</title>
              <style>
                @page {
                  size: A4 portrait;
                  margin: 12mm 15mm;
                }
                body {
                  margin: 0;
                  padding: 0;
                  background: #fff;
                  color: #0f172a;
                  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
                }
                ${templateCss}
                @media print {
                  body {
                    -webkit-print-color-adjust: exact;
                    print-color-adjust: exact;
                  }
                  .sheet-container {
                    border: none !important;
                    box-shadow: none !important;
                    padding: 0 !important;
                    max-width: 100% !important;
                  }
                }
              </style>
            </head>
            <body>
              ${renderedHtml}
            </body>
          </html>
        `);
        doc.close();

        setTimeout(() => {
          iframe.contentWindow?.focus();
          iframe.contentWindow?.print();
          setTimeout(() => {
            document.body.removeChild(iframe);
          }, 1000);
        }, 300);
      }
    } catch (e) {
      console.error('Print iframe error:', e);
      window.print();
    }
  };

  const handleDownloadDocx = async () => {
    if (!masterItem) return;
    setIsGeneratingDocx(true);
    try {
      await wordService.generateAndSave(
        registration,
        masterItem,
        config,
        currentUser?.shortName || registration.registeredBy
      );
    } catch (err) {
      console.error('Word form generation error:', err);
    } finally {
      setIsGeneratingDocx(false);
    }
  };

  const hasPhotos = registration.photos && registration.photos.length > 0;
  const hasAttachments = registration.attachments && registration.attachments.length > 0;

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-[#141414] rounded-2xl shadow-2xl border border-[#2F2F2F] w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        
        {/* Top Header */}
        <div className="bg-[#0A0A0A] text-white px-5 py-3.5 flex items-center justify-between border-b border-[#222] shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-500/10 border border-blue-500/20 rounded-xl text-blue-400">
              <FileCheck className="w-5 h-5" />
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
                {registration.lotReference && (
                  <span className="text-xs font-mono px-2 py-0.5 rounded bg-[#222] text-gray-300 border border-[#333]">
                    Lot: {registration.lotReference}
                  </span>
                )}
              </div>
              <p className="text-xs text-gray-400 mt-0.5">
                Material Reference Sheet • Quality Assurance Technical Document
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="p-1.5 text-gray-400 hover:text-white hover:bg-[#222] rounded-lg transition-colors cursor-pointer"
              title="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Sub-bar: Navigation & Authorizer selection */}
        <div className="px-5 py-2.5 bg-[#121212] border-b border-[#222] flex flex-wrap items-center justify-between gap-3 shrink-0">
          {/* Tab buttons */}
          <div className="flex items-center gap-1.5 bg-[#181818] p-1 rounded-xl border border-[#282828]">
            <button
              onClick={() => setActiveTab('SHEET')}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                activeTab === 'SHEET'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-gray-400 hover:text-gray-200 hover:bg-[#222]'
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Official Reference Sheet</span>
            </button>

            <button
              onClick={() => setActiveTab('DETAILS')}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                activeTab === 'DETAILS'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-gray-400 hover:text-gray-200 hover:bg-[#222]'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Data Specifications</span>
            </button>

            <button
              onClick={() => setActiveTab('PHOTOS')}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                activeTab === 'PHOTOS'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-gray-400 hover:text-gray-200 hover:bg-[#222]'
              }`}
            >
              <ImageIcon className="w-3.5 h-3.5" />
              <span>Photos ({registration.photos?.length || 0})</span>
            </button>
          </div>

          {/* QA Admin Approver selector */}
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-gray-400 font-mono hidden sm:inline">QA Admin Sign-off:</span>
            <select
              value={selectedAdminId}
              onChange={(e) => setSelectedAdminId(e.target.value)}
              className="text-xs bg-[#1C1C1C] border border-[#333] text-gray-200 rounded-lg px-2.5 py-1.5 focus:outline-hidden focus:border-blue-500 font-mono"
            >
              {adminUsers.map((adm) => (
                <option key={adm.idNumber} value={adm.idNumber}>
                  {adm.shortName} ({adm.fullName})
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Modal Body: Active View */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-[#0D0D0D]">
          {activeTab === 'SHEET' && (
            <div className="flex flex-col items-center">
              {/* Sheet Paper Preview Container */}
              <div 
                ref={printAreaRef}
                className="w-full max-w-3xl bg-white text-slate-900 rounded-xl shadow-2xl border border-slate-300 overflow-hidden my-1 p-6 sm:p-8"
              >
                <style>{templateCss}</style>
                <div dangerouslySetInnerHTML={{ __html: renderedHtml }} />
              </div>
            </div>
          )}

          {activeTab === 'DETAILS' && (
            <div className="space-y-4 max-w-3xl mx-auto">
              {/* Section 1: Classification */}
              <div className="bg-[#161616] border border-[#282828] rounded-xl p-4.5 space-y-3">
                <h4 className="text-xs font-mono font-bold text-blue-400 uppercase tracking-wider flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4" />
                  <span>1. Material Master Classification</span>
                </h4>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
                  <div>
                    <span className="text-gray-500 text-[11px] block">Material Code:</span>
                    <strong className="text-gray-100 font-mono">{registration.productCode}</strong>
                  </div>
                  <div>
                    <span className="text-gray-500 text-[11px] block">Revision Code:</span>
                    <span className="text-emerald-400 font-mono font-bold">{registration.revision}</span>
                  </div>
                  <div>
                    <span className="text-gray-500 text-[11px] block">Material Type:</span>
                    <span className="text-gray-200">
                      {masterItem?.category === 'RM' ? 'Raw Material (RM)' : 'Production Supply (PS)'}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-500 text-[11px] block">Category:</span>
                    <span className="text-gray-200">{registration.category || masterItem?.category || 'Standard'}</span>
                  </div>
                  <div>
                    <span className="text-gray-500 text-[11px] block">Reference Unit:</span>
                    <span className="text-gray-200">{masterItem?.unit || 'Piece / Unit'}</span>
                  </div>
                  <div>
                    <span className="text-gray-500 text-[11px] block">Master Status:</span>
                    <span className="text-gray-200">{masterItem?.status || 'Active'}</span>
                  </div>
                </div>
                <div className="pt-2 border-t border-[#222]">
                  <span className="text-gray-500 text-[11px] block">Material Description:</span>
                  <p className="text-gray-200 font-medium mt-0.5">
                    {masterItem?.description || 'Quality Assurance Approved Reference Standard'}
                  </p>
                </div>
              </div>

              {/* Section 2: Registration & Specifications */}
              <div className="bg-[#161616] border border-[#282828] rounded-xl p-4.5 space-y-3">
                <h4 className="text-xs font-mono font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-2">
                  <User className="w-4 h-4" />
                  <span>2. QA Inspection & Registration Data</span>
                </h4>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                  <div>
                    <span className="text-gray-500 text-[11px] block">Registered By:</span>
                    <strong className="text-gray-200">{registration.registeredBy}</strong>
                  </div>
                  <div>
                    <span className="text-gray-500 text-[11px] block">Registration Date:</span>
                    <span className="text-gray-200 font-mono">{registration.registrationDate}</span>
                  </div>
                  <div>
                    <span className="text-gray-500 text-[11px] block">Supplier / Source:</span>
                    <span className="text-gray-200">{registration.supplier || 'N/A'}</span>
                  </div>
                  <div>
                    <span className="text-gray-500 text-[11px] block">Lot Reference:</span>
                    <span className="text-gray-200 font-mono font-bold">{registration.lotReference || 'N/A'}</span>
                  </div>
                </div>

                <div className="pt-2 border-t border-[#222] space-y-2">
                  <div>
                    <span className="text-gray-500 text-[11px] block">Technical Specification & Acceptance Criteria:</span>
                    <p className="text-gray-200 bg-[#1A1A1A] p-2.5 rounded-lg border border-[#2A2A2A] mt-1 text-xs leading-relaxed">
                      {registration.specification || 'Standard physical reference specimen verified against QA benchmark tolerances.'}
                    </p>
                  </div>
                  {registration.remarks && (
                    <div>
                      <span className="text-gray-500 text-[11px] block">Remarks / Storage Notes:</span>
                      <p className="text-gray-300 bg-[#1A1A1A] p-2.5 rounded-lg border border-[#2A2A2A] mt-1 text-xs leading-relaxed">
                        {registration.remarks}
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Section 3: Dynamic Custom Fields */}
              {config.customFields && config.customFields.length > 0 && registration.customFields && (
                <div className="bg-[#161616] border border-[#282828] rounded-xl p-4.5 space-y-3">
                  <h4 className="text-xs font-mono font-bold text-purple-400 uppercase tracking-wider flex items-center gap-2">
                    <Tag className="w-4 h-4" />
                    <span>3. Additional Custom QA Parameters</span>
                  </h4>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
                    {config.customFields.map((cf) => {
                      const val = registration.customFields?.[cf.key];
                      if (!val && val !== 0 && val !== false) return null;
                      return (
                        <div key={cf.id} className="bg-[#1A1A1A] p-2.5 rounded-lg border border-[#2A2A2A]">
                          <span className="text-gray-500 text-[11px] block">{cf.label}:</span>
                          <strong className="text-gray-200 mt-0.5 block">
                            {typeof val === 'boolean' ? (val ? 'Yes' : 'No') : String(val)}
                          </strong>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'PHOTOS' && (
            <div className="max-w-3xl mx-auto space-y-4">
              {hasPhotos ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {registration.photos.map((photo, idx) => (
                    <div
                      key={photo.id || idx}
                      onClick={() => setSelectedPhoto(photo.dataUrl)}
                      className="bg-[#161616] border border-[#2A2A2A] rounded-xl overflow-hidden group hover:border-blue-500/50 transition-all cursor-pointer shadow-sm"
                    >
                      <div className="relative h-48 bg-black/40 overflow-hidden flex items-center justify-center">
                        <img
                          src={photo.dataUrl}
                          alt={photo.caption || `Specimen photo ${idx + 1}`}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                          <span className="flex items-center gap-1 px-3 py-1.5 bg-black/80 text-white rounded-lg text-xs font-semibold">
                            <Maximize2 className="w-3.5 h-3.5" /> Click to Enlarge
                          </span>
                        </div>
                      </div>
                      <div className="p-3 bg-[#161616] flex items-center justify-between text-xs">
                        <span className="font-semibold text-gray-300 truncate">
                          {photo.caption || photo.fileName || `Photo #${idx + 1}`}
                        </span>
                        <span className="text-[10px] font-mono text-gray-500 shrink-0">
                          {photo.uploadedAt ? new Date(photo.uploadedAt).toLocaleDateString() : ''}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="bg-[#161616] rounded-xl border border-[#282828] p-12 text-center text-gray-500">
                  <ImageIcon className="w-10 h-10 mx-auto text-gray-600 mb-2 opacity-50" />
                  <h4 className="font-semibold text-gray-300 text-sm">No Specimen Photos Registered</h4>
                  <p className="text-xs text-gray-500 mt-1">
                    No physical visual proof images are attached to this material reference registration.
                  </p>
                </div>
              )}

              {/* Attachments Section */}
              {hasAttachments && (
                <div className="bg-[#161616] border border-[#282828] rounded-xl p-4 space-y-3 mt-4">
                  <h4 className="text-xs font-mono font-bold text-gray-300 uppercase tracking-wider flex items-center gap-2">
                    <Paperclip className="w-4 h-4 text-amber-400" />
                    <span>Associated Document Attachments ({registration.attachments.length})</span>
                  </h4>
                  <div className="space-y-2">
                    {registration.attachments.map((att, idx) => (
                      <div
                        key={att.id || idx}
                        className="flex items-center justify-between p-2.5 bg-[#1C1C1C] rounded-lg border border-[#2F2F2F] text-xs"
                      >
                        <div className="flex items-center gap-2 truncate">
                          <FileText className="w-4 h-4 text-blue-400 shrink-0" />
                          <span className="text-gray-200 truncate">{att.fileName}</span>
                          <span className="text-[10px] text-gray-500 font-mono shrink-0">
                            ({Math.round((att.fileSize || 0) / 1024)} KB)
                          </span>
                        </div>
                        {att.dataUrl && (
                          <a
                            href={att.dataUrl}
                            download={att.fileName}
                            className="flex items-center gap-1 px-2.5 py-1 text-xs bg-blue-600/20 text-blue-400 hover:bg-blue-600/30 rounded border border-blue-500/30 transition-colors"
                          >
                            <Download className="w-3.5 h-3.5" /> Download
                          </a>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Modal Footer Controls */}
        <div className="px-5 py-3 bg-[#0A0A0A] border-t border-[#222] flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2 text-xs text-gray-400 font-mono">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span>Document Ref: MRS-{registration.productCode}-{registration.revision}</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-500 rounded-xl shadow-sm transition-all cursor-pointer"
              title="Print Reference Document (A4)"
            >
              <Printer className="w-4 h-4" />
              <span>Print Reference Sheet</span>
            </button>

            {masterItem && (
              <button
                onClick={handleDownloadDocx}
                disabled={isGeneratingDocx}
                className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-gray-200 bg-[#202020] hover:bg-[#2A2A2A] border border-[#333] rounded-xl transition-colors disabled:opacity-50 cursor-pointer"
                title="Generate and Download Official Word DOCX Document"
              >
                <FileText className="w-4 h-4 text-blue-400" />
                <span>{isGeneratingDocx ? 'Generating DOCX...' : 'Download Word (DOCX)'}</span>
              </button>
            )}

            <button
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-gray-300 bg-[#1A1A1A] hover:bg-[#242424] border border-[#333] rounded-xl transition-colors cursor-pointer"
            >
              Close
            </button>
          </div>
        </div>

      </div>

      {/* Lightbox Photo Preview */}
      {selectedPhoto && (
        <div
          onClick={() => setSelectedPhoto(null)}
          className="fixed inset-0 z-60 bg-black/90 flex items-center justify-center p-4 cursor-zoom-out"
        >
          <img
            src={selectedPhoto}
            alt="Specimen Detail"
            className="max-w-full max-h-[90vh] rounded-lg shadow-2xl object-contain bg-[#161616] border border-[#333]"
          />
        </div>
      )}
    </div>
  );
};
