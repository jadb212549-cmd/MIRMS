import React, { useState, useMemo, useRef, useEffect } from 'react';
import { renderAsync } from 'docx-preview';
import { AppConfig, MasterItem, ReferenceRegistration, WordDocPlaceholder } from '../types';
import { wordService } from '../services/wordService';
import { pdfService } from '../services/pdfService';
import {
  FileText,
  Download,
  Eye,
  Tag,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Minimize2,
  Layers,
  CheckCircle2,
  Calendar,
  User,
  Building,
  Image as ImageIcon,
  Check,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  Info,
  ShieldCheck,
  Printer,
  RefreshCw,
  AlertTriangle,
  FileCheck2
} from 'lucide-react';

interface WordTemplateDocPreviewProps {
  registration: ReferenceRegistration | null;
  masterItem: MasterItem | null;
  config: AppConfig;
  allPlaceholders: WordDocPlaceholder[];
  hoveredTag: string | null;
  selectedTag: string | null;
  onSelectTag: (tag: string | null) => void;
  viewMode: 'populated' | 'tags' | 'matrix';
  onViewModeChange: (mode: 'populated' | 'tags' | 'matrix') => void;
  showHighlightTags: boolean;
  onToggleHighlightTags: () => void;
  registrations: ReferenceRegistration[];
  onSelectRegistration: (id: string) => void;
  onDownloadDocx: () => void;
  isGenerating: boolean;
}

export const WordTemplateDocPreview: React.FC<WordTemplateDocPreviewProps> = ({
  registration,
  masterItem,
  config,
  allPlaceholders,
  hoveredTag,
  selectedTag,
  onSelectTag,
  viewMode,
  onViewModeChange,
  showHighlightTags,
  onToggleHighlightTags,
  registrations,
  onSelectRegistration,
  onDownloadDocx,
  isGenerating
}) => {
  const [zoomLevel, setZoomLevel] = useState<number>(100);
  const [isRenderingDocx, setIsRenderingDocx] = useState(false);
  const [renderError, setRenderError] = useState<string | null>(null);
  const [pageCount, setPageCount] = useState<number>(1);
  const [renderTimestamp, setRenderTimestamp] = useState<number>(Date.now());

  const docxContainerRef = useRef<HTMLDivElement>(null);

  // Helper function to evaluate tag values
  const evaluateTag = (tagWithBraces: string): { value: string; isDefault: boolean; fieldLabel?: string } => {
    const rawKey = tagWithBraces.replace(/^\{\{|\}\}$/g, '');
    const cleanKeyLower = rawKey.toLowerCase();

    if (!registration || !masterItem) {
      const matchPh = allPlaceholders.find((p) => p.tag.toLowerCase() === tagWithBraces.toLowerCase());
      return {
        value: matchPh?.sampleValue || matchPh?.defaultValue || '—',
        isDefault: true,
        fieldLabel: matchPh?.label
      };
    }

    switch (cleanKeyLower) {
      case 'companyname':
        return {
          value: config.companyName || 'Precision Industrial Manufacturing Corp.',
          isDefault: !config.companyName,
          fieldLabel: 'Company Header'
        };
      case 'productcode':
        return {
          value: registration.productCode || masterItem.productCode,
          isDefault: false,
          fieldLabel: 'Product Code'
        };
      case 'description':
        return {
          value: masterItem.description || 'N/A',
          isDefault: false,
          fieldLabel: 'Item Description'
        };
      case 'materialtype': {
        const matType = registration.materialType || masterItem.materialType || (masterItem.category === 'PS' ? 'PS' : 'RM');
        return {
          value: matType === 'PS' ? 'Production Supply (PS)' : 'Raw Material (RM)',
          isDefault: false,
          fieldLabel: 'Material Type'
        };
      }
      case 'materialtypecode': {
        const matType = registration.materialType || masterItem.materialType || (masterItem.category === 'PS' ? 'PS' : 'RM');
        return {
          value: matType,
          isDefault: false,
          fieldLabel: 'Material Type Code'
        };
      }
      case 'category':
        return {
          value: registration.category || masterItem.category || 'Standard',
          isDefault: false,
          fieldLabel: 'Category'
        };
      case 'unit':
        return {
          value: masterItem.unit || 'Piece',
          isDefault: !masterItem.unit,
          fieldLabel: 'Reference Unit'
        };
      case 'itemstatus':
      case 'status':
        return {
          value: masterItem.status || 'Active',
          isDefault: false,
          fieldLabel: 'Status'
        };
      case 'itemcreatedat':
        return {
          value: masterItem.createdAt ? masterItem.createdAt.split('T')[0] : '2026-08-15',
          isDefault: false,
          fieldLabel: 'Creation Date'
        };
      case 'revision':
        return {
          value: registration.revision || 'Rev 01',
          isDefault: !registration.revision,
          fieldLabel: 'Revision'
        };
      case 'registeredby':
        return {
          value: registration.registeredBy || config.defaultRegisteredBy || 'QA Inspector',
          isDefault: false,
          fieldLabel: 'Registered By'
        };
      case 'registeredbyid':
        return {
          value: `EMP-${registration.registeredBy ? registration.registeredBy.replace(/[^a-zA-Z0-9]/g, '').slice(0, 4).toUpperCase() : 'QA01'}`,
          isDefault: false,
          fieldLabel: 'Inspector ID'
        };
      case 'registrationdate':
        return {
          value: registration.registrationDate || new Date().toISOString().split('T')[0],
          isDefault: false,
          fieldLabel: 'Registration Date'
        };
      case 'registrationid':
        return {
          value: registration.id,
          isDefault: false,
          fieldLabel: 'Registration ID'
        };
      case 'proofid':
        return {
          value: `IP-${registration.productCode.replace(/[^a-zA-Z0-9]/g, '')}-${registration.id.slice(-6)}`,
          isDefault: false,
          fieldLabel: 'Proof Slip Voucher Serial'
        };
      case 'todaydate':
        return {
          value: new Date().toISOString().split('T')[0],
          isDefault: false,
          fieldLabel: 'Export Date'
        };
      case 'todaydatetime':
        return {
          value: new Date().toISOString().replace('T', ' ').slice(0, 19),
          isDefault: false,
          fieldLabel: 'Export Date & Time'
        };
      case 'currentyear':
        return {
          value: String(new Date().getFullYear()),
          isDefault: false,
          fieldLabel: 'Current Year'
        };
      case 'documenttitle':
        return {
          value: 'MATERIAL REFERENCE & SAMPLE SPECIFICATION FORM',
          isDefault: false,
          fieldLabel: 'Document Title'
        };
      case 'templatename':
        return {
          value: config.wordTemplateName || 'Official_Material_Reference_Template_v2.docx',
          isDefault: false,
          fieldLabel: 'Template Name'
        };
      case 'department':
        return {
          value: 'Quality Assurance & Materials Engineering',
          isDefault: false,
          fieldLabel: 'Department'
        };
      case 'checkedby':
        return {
          value: 'JD. Stone (System Admin)',
          isDefault: false,
          fieldLabel: 'Checked By'
        };
      case 'checkedbyid':
        return {
          value: 'ADM-001',
          isDefault: false,
          fieldLabel: 'Admin ID'
        };
      case 'approvedby':
        return {
          value: 'Quality Assurance Director',
          isDefault: false,
          fieldLabel: 'Approved By'
        };
      case 'approvaldate':
        return {
          value: registration.registrationDate || new Date().toISOString().split('T')[0],
          isDefault: false,
          fieldLabel: 'Approval Date'
        };
      case 'inspectorsignature':
        return {
          value: '___________________________ (Sign & Date)',
          isDefault: false,
          fieldLabel: 'Inspector Signature'
        };
      case 'adminsignature':
        return {
          value: '___________________________ (Sign & Date)',
          isDefault: false,
          fieldLabel: 'Admin Signature'
        };
      case 'supplier':
        return {
          value: registration.supplier || 'N/A',
          isDefault: !registration.supplier,
          fieldLabel: 'Supplier'
        };
      case 'specification':
        return {
          value: registration.specification || 'No technical specification recorded.',
          isDefault: !registration.specification,
          fieldLabel: 'Specification'
        };
      case 'remarks':
        return {
          value: registration.remarks || 'None',
          isDefault: !registration.remarks,
          fieldLabel: 'Remarks'
        };
      case 'photoscount':
        return {
          value: String(registration.photos?.length || 0),
          isDefault: false,
          fieldLabel: 'Photo Count'
        };
      case 'photoslist':
        return {
          value: `${registration.photos?.length || 0} attached sample photos verified in QC archive`,
          isDefault: false,
          fieldLabel: 'Photos List'
        };
      case 'attachmentscount':
        return {
          value: String(registration.attachments?.length || 0),
          isDefault: false,
          fieldLabel: 'Attachments Count'
        };
      default: {
        if (registration.customFields) {
          if (registration.customFields[rawKey] !== undefined) {
            const v = registration.customFields[rawKey];
            return {
              value: typeof v === 'boolean' ? (v ? 'YES' : 'NO') : String(v || 'N/A'),
              isDefault: false,
              fieldLabel: rawKey
            };
          }
        }
        const matchPh = allPlaceholders.find((p) => p.tag.toLowerCase() === tagWithBraces.toLowerCase());
        if (matchPh?.customFieldKey && registration.customFields?.[matchPh.customFieldKey] !== undefined) {
          const v = registration.customFields[matchPh.customFieldKey];
          return {
            value: typeof v === 'boolean' ? (v ? 'YES' : 'NO') : String(v || 'N/A'),
            isDefault: false,
            fieldLabel: matchPh.label || rawKey
          };
        }

        return {
          value: matchPh?.defaultValue || matchPh?.sampleValue || 'N/A',
          isDefault: true,
          fieldLabel: matchPh?.label || rawKey
        };
      }
    }
  };

  // Render true Word document (.docx) via docx-preview
  useEffect(() => {
    if (viewMode === 'matrix') return;

    let isMounted = true;
    const renderDocxDocument = async () => {
      if (!docxContainerRef.current) return;

      setIsRenderingDocx(true);
      setRenderError(null);

      try {
        if (docxContainerRef.current) {
          docxContainerRef.current.innerHTML = '';
        }

        // Generate or retrieve the docx Blob
        const docxBlob = await wordService.getPreviewDocxBlob(
          registration,
          masterItem,
          config,
          viewMode === 'tags' ? 'tags' : 'populated'
        );

        if (!isMounted || !docxContainerRef.current) return;

        // Render asynchronously via docx-preview library into DOM
        await renderAsync(docxBlob, docxContainerRef.current, undefined, {
          className: 'docx-doc-render',
          inWrapper: true,
          ignoreWidth: false,
          ignoreHeight: false,
          breakPages: true,
          renderHeaders: true,
          renderFooters: true,
          renderFootnotes: true,
          renderEndnotes: true,
          useBase64URL: true
        });

        if (isMounted && docxContainerRef.current) {
          const pages = docxContainerRef.current.querySelectorAll('section.docx');
          setPageCount(pages.length || 1);
        }
      } catch (err: any) {
        console.error('DOCX Preview Rendering Error:', err);
        if (isMounted) {
          setRenderError(err?.message || 'Failed to render Microsoft Word document preview.');
        }
      } finally {
        if (isMounted) {
          setIsRenderingDocx(false);
        }
      }
    };

    renderDocxDocument();

    return () => {
      isMounted = false;
    };
  }, [
    registration?.id,
    registration?.revision,
    registration?.updatedAt,
    masterItem?.productCode,
    config.wordTemplateContent,
    config.wordTemplateName,
    config.companyName,
    viewMode,
    config.customFields,
    renderTimestamp
  ]);

  // Registration navigation
  const currentIndex = registrations.findIndex((r) => r.id === registration?.id);
  const handlePrevReg = () => {
    if (currentIndex > 0) {
      onSelectRegistration(registrations[currentIndex - 1].id);
    }
  };
  const handleNextReg = () => {
    if (currentIndex < registrations.length - 1) {
      onSelectRegistration(registrations[currentIndex + 1].id);
    }
  };

  const hasUploadedCustomDocx = Boolean(config.wordTemplateContent);

  return (
    <div className="bg-[#141414] rounded-xl border border-[#222] overflow-hidden flex flex-col shadow-xs h-full">
      {/* Top Controls Toolbar */}
      <div className="p-3.5 bg-[#181818] border-b border-[#2A2A2A] flex flex-wrap items-center justify-between gap-3">
        {/* Left: Title & Active Template Indicator */}
        <div className="flex items-center gap-2.5 flex-wrap">
          <div className="flex items-center gap-1.5 px-2.5 py-1 bg-blue-500/10 border border-blue-500/30 rounded-lg text-blue-400">
            <FileText className="w-4 h-4" />
            <span className="text-xs font-bold uppercase tracking-wider font-mono">Word Document Preview</span>
          </div>

          {/* Quick Registration Selector */}
          <div className="flex items-center gap-1 bg-[#101010] border border-[#2D2D2D] rounded-lg p-0.5">
            <button
              type="button"
              onClick={handlePrevReg}
              disabled={currentIndex <= 0}
              className="p-1 text-gray-400 hover:text-white disabled:opacity-30 disabled:hover:text-gray-400 rounded transition-colors cursor-pointer"
              title="Previous sample"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
            <select
              value={registration?.id || ''}
              onChange={(e) => onSelectRegistration(e.target.value)}
              className="text-xs px-2 py-1 bg-transparent text-gray-200 font-mono focus:outline-hidden cursor-pointer max-w-[200px] truncate"
            >
              {registrations.map((r) => (
                <option key={r.id} value={r.id} className="bg-[#181818] text-gray-200">
                  {r.productCode} ({r.revision || 'Rev 01'})
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={handleNextReg}
              disabled={currentIndex >= registrations.length - 1}
              className="p-1 text-gray-400 hover:text-white disabled:opacity-30 disabled:hover:text-gray-400 rounded transition-colors cursor-pointer"
              title="Next sample"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Template source status pill */}
          {hasUploadedCustomDocx ? (
            <div className="hidden sm:flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[11px] font-mono">
              <FileCheck2 className="w-3.5 h-3.5" />
              <span className="truncate max-w-[170px]" title={config.wordTemplateName || 'Uploaded .docx'}>
                Uploaded: {config.wordTemplateName || 'Template.docx'}
              </span>
            </div>
          ) : (
            <div className="hidden sm:flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-slate-500/10 border border-slate-500/20 text-slate-400 text-[11px] font-mono">
              <Building className="w-3.5 h-3.5" />
              <span>Standard Default .docx</span>
            </div>
          )}
        </div>

        {/* Center: View Mode Segmented Control */}
        <div className="flex items-center bg-[#101010] border border-[#2E2E2E] rounded-lg p-0.5 text-xs font-medium">
          <button
            type="button"
            onClick={() => onViewModeChange('populated')}
            className={`px-2.5 py-1 rounded-md transition-colors flex items-center gap-1.5 cursor-pointer ${
              viewMode === 'populated'
                ? 'bg-blue-600 text-white font-bold shadow-xs'
                : 'text-gray-400 hover:text-gray-200'
            }`}
            title="Render Word document populated with live specimen data"
          >
            <Eye className="w-3.5 h-3.5" />
            <span>Mapped Live</span>
          </button>
          <button
            type="button"
            onClick={() => onViewModeChange('tags')}
            className={`px-2.5 py-1 rounded-md transition-colors flex items-center gap-1.5 cursor-pointer ${
              viewMode === 'tags'
                ? 'bg-blue-600 text-white font-bold shadow-xs'
                : 'text-gray-400 hover:text-gray-200'
            }`}
            title="Render raw Word template with original placeholder tags e.g. {{productCode}}"
          >
            <Tag className="w-3.5 h-3.5" />
            <span>Template Tags</span>
          </button>
          <button
            type="button"
            onClick={() => onViewModeChange('matrix')}
            className={`px-2.5 py-1 rounded-md transition-colors flex items-center gap-1.5 cursor-pointer ${
              viewMode === 'matrix'
                ? 'bg-blue-600 text-white font-bold shadow-xs'
                : 'text-gray-400 hover:text-gray-200'
            }`}
            title="View complete placeholder-to-value mapping matrix"
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Mapping Matrix</span>
          </button>
        </div>

        {/* Right: Refresh, Zoom & Export */}
        <div className="flex items-center gap-2">
          {viewMode !== 'matrix' && (
            <button
              type="button"
              onClick={() => setRenderTimestamp(Date.now())}
              disabled={isRenderingDocx}
              className="p-1.5 text-gray-400 hover:text-white bg-[#101010] border border-[#2D2D2D] rounded-lg transition-colors cursor-pointer"
              title="Reload and re-render document preview"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRenderingDocx ? 'animate-spin text-blue-400' : ''}`} />
            </button>
          )}

          {/* Zoom controls */}
          {viewMode !== 'matrix' && (
            <div className="hidden sm:flex items-center gap-1 bg-[#101010] border border-[#2D2D2D] rounded-lg p-0.5">
              <button
                type="button"
                onClick={() => setZoomLevel((z) => Math.max(60, z - 10))}
                className="p-1 text-gray-400 hover:text-white rounded cursor-pointer"
                title="Zoom out"
              >
                <ZoomOut className="w-3.5 h-3.5" />
              </button>
              <span className="text-[11px] font-mono text-gray-400 px-1 min-w-[36px] text-center">
                {zoomLevel}%
              </span>
              <button
                type="button"
                onClick={() => setZoomLevel((z) => Math.min(150, z + 10))}
                className="p-1 text-gray-400 hover:text-white rounded cursor-pointer"
                title="Zoom in"
              >
                <ZoomIn className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* Download DOCX */}
          <button
            type="button"
            onClick={onDownloadDocx}
            disabled={isGenerating || !registration}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-500 rounded-lg shadow-sm transition-colors disabled:opacity-50 cursor-pointer"
            title="Download generated Microsoft Word (.docx) file"
          >
            <Download className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">{isGenerating ? 'Generating...' : 'Export DOCX'}</span>
          </button>

          {/* Export PDF */}
          <button
            type="button"
            onClick={() => {
              if (!registration || !masterItem) return;
              const specHtml = `
                <div style="font-family: Arial, sans-serif; padding: 24px; max-width: 800px; margin: 0 auto; color: #0f172a;">
                  <div style="border-bottom: 2px solid #0284c7; padding-bottom: 12px; margin-bottom: 20px; display: flex; justify-content: space-between; align-items: flex-start;">
                    <div>
                      <h1 style="font-size: 20px; font-weight: bold; margin: 0; color: #0f172a;">${config.companyName || 'Precision Industrial Manufacturing Corp.'}</h1>
                      <p style="font-size: 12px; color: #0284c7; margin: 4px 0 0 0; font-weight: bold; tracking-wide;">MATERIAL REFERENCE & SAMPLE SPECIFICATION FORM</p>
                    </div>
                    <div style="text-align: right; font-size: 11px; color: #475569; font-family: monospace;">
                      <div><strong>Code:</strong> ${registration.productCode}</div>
                      <div><strong>Rev:</strong> ${registration.revision || 'Rev 01'}</div>
                      <div><strong>Date:</strong> ${registration.registrationDate || new Date().toISOString().split('T')[0]}</div>
                    </div>
                  </div>

                  <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 12px;">
                    <tbody>
                      <tr style="background-color: #f8fafc;">
                        <th style="border: 1px solid #cbd5e1; padding: 8px 12px; text-align: left; width: 35%; color: #334155;">Product Code</th>
                        <td style="border: 1px solid #cbd5e1; padding: 8px 12px; font-weight: bold; font-family: monospace;">${registration.productCode}</td>
                      </tr>
                      <tr>
                        <th style="border: 1px solid #cbd5e1; padding: 8px 12px; text-align: left; color: #334155;">Description</th>
                        <td style="border: 1px solid #cbd5e1; padding: 8px 12px;">${masterItem.description || 'N/A'}</td>
                      </tr>
                      <tr style="background-color: #f8fafc;">
                        <th style="border: 1px solid #cbd5e1; padding: 8px 12px; text-align: left; color: #334155;">Material Type</th>
                        <td style="border: 1px solid #cbd5e1; padding: 8px 12px;">${(registration.materialType || masterItem.materialType) === 'PS' ? 'Production Supply (PS)' : 'Raw Material (RM)'}</td>
                      </tr>
                      <tr>
                        <th style="border: 1px solid #cbd5e1; padding: 8px 12px; text-align: left; color: #334155;">Category</th>
                        <td style="border: 1px solid #cbd5e1; padding: 8px 12px;">${registration.category || masterItem.category || 'Standard'}</td>
                      </tr>
                      <tr style="background-color: #f8fafc;">
                        <th style="border: 1px solid #cbd5e1; padding: 8px 12px; text-align: left; color: #334155;">Supplier</th>
                        <td style="border: 1px solid #cbd5e1; padding: 8px 12px;">${registration.supplier || 'N/A'}</td>
                      </tr>
                      <tr>
                        <th style="border: 1px solid #cbd5e1; padding: 8px 12px; text-align: left; color: #334155;">Specification Details</th>
                        <td style="border: 1px solid #cbd5e1; padding: 8px 12px;">${registration.specification || 'N/A'}</td>
                      </tr>
                      <tr style="background-color: #f8fafc;">
                        <th style="border: 1px solid #cbd5e1; padding: 8px 12px; text-align: left; color: #334155;">Inspected By</th>
                        <td style="border: 1px solid #cbd5e1; padding: 8px 12px;">${registration.registeredBy || 'Inspector'}</td>
                      </tr>
                      <tr>
                        <th style="border: 1px solid #cbd5e1; padding: 8px 12px; text-align: left; color: #334155;">Remarks / Notes</th>
                        <td style="border: 1px solid #cbd5e1; padding: 8px 12px;">${registration.remarks || 'None'}</td>
                      </tr>
                    </tbody>
                  </table>

                  ${registration.photos && registration.photos.length > 0 ? `
                    <div style="margin-top: 20px;">
                      <h3 style="font-size: 13px; font-weight: bold; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px; color: #0f172a; margin-bottom: 10px;">Specimen Photos (${registration.photos.length})</h3>
                      <div style="display: flex; flex-wrap: wrap; gap: 12px;">
                        ${registration.photos.map(p => `
                          <div style="border: 1px solid #cbd5e1; padding: 6px; border-radius: 6px; text-align: center; background: #fafafa;">
                            <img src="${p.dataUrl}" style="max-width: 200px; max-height: 150px; object-fit: contain; display: block; border-radius: 4px;" />
                            <span style="font-size: 10px; color: #64748b; margin-top: 4px; display: block;">${p.caption || p.fileName}</span>
                          </div>
                        `).join('')}
                      </div>
                    </div>
                  ` : ''}

                  <div style="margin-top: 40px; border-top: 1px solid #cbd5e1; padding-top: 20px; display: flex; justify-content: space-between; font-size: 11px; color: #475569;">
                    <div>
                      <p style="margin: 0; font-weight: bold;">Inspector Signature:</p>
                      <p style="margin-top: 24px;">___________________________</p>
                    </div>
                    <div>
                      <p style="margin: 0; font-weight: bold;">QA Approval Signature:</p>
                      <p style="margin-top: 24px;">___________________________</p>
                    </div>
                  </div>
                </div>
              `;
              pdfService.exportHtmlToPdf(specHtml, `Material_Reference_${registration.productCode}`);
            }}
            disabled={!registration}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-white bg-red-600 hover:bg-red-500 rounded-lg shadow-sm transition-colors disabled:opacity-50 cursor-pointer"
            title="Export specification document as PDF"
          >
            <FileText className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Export PDF</span>
          </button>
        </div>
      </div>

      {/* Main Content Viewport */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-[#0E0E0E] flex items-start justify-center min-h-[600px] relative">
        {viewMode === 'matrix' ? (
          /* Mapping Matrix View */
          <div className="w-full max-w-4xl bg-[#161616] rounded-xl border border-[#2B2B2B] p-5 space-y-4 animate-in fade-in duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-[#262626]">
              <div>
                <h4 className="text-sm font-bold text-gray-200 flex items-center gap-2">
                  <Layers className="w-4 h-4 text-blue-400" />
                  Live Placeholder-to-Registration Mapping Matrix
                </h4>
                <p className="text-xs text-gray-400 mt-0.5">
                  Real-time mapping audit between Word template tokens and active specimen registration: <strong className="text-gray-300 font-mono">{registration?.productCode}</strong> ({registration?.revision || 'Rev 01'}).
                </p>
              </div>
              <span className="text-[11px] font-mono bg-blue-500/10 text-blue-400 border border-blue-500/20 px-2 py-0.5 rounded">
                {allPlaceholders.length} Active Mappings
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left border-collapse font-sans">
                <thead>
                  <tr className="bg-[#1F1F1F] text-gray-400 font-mono text-[11px] border-b border-[#2C2C2C]">
                    <th className="py-2.5 px-3">Word Placeholder Tag</th>
                    <th className="py-2.5 px-3">Field Label</th>
                    <th className="py-2.5 px-3">Live Evaluated Value</th>
                    <th className="py-2.5 px-3">Category</th>
                    <th className="py-2.5 px-3 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#222]">
                  {allPlaceholders.map((ph) => {
                    const { value, isDefault } = evaluateTag(ph.tag);
                    const isSelected = selectedTag === ph.tag;
                    const isHovered = hoveredTag === ph.tag;

                    return (
                      <tr
                        key={ph.id || ph.tag}
                        onClick={() => onSelectTag(selectedTag === ph.tag ? null : ph.tag)}
                        className={`hover:bg-[#1C1C1C] transition-colors cursor-pointer ${
                          isSelected ? 'bg-blue-900/30' : isHovered ? 'bg-[#222]' : ''
                        }`}
                      >
                        <td className="py-2.5 px-3">
                          <code className="font-mono font-bold text-blue-400 bg-[#0E1726] border border-blue-500/30 px-1.5 py-0.5 rounded text-[11px]">
                            {ph.tag}
                          </code>
                        </td>
                        <td className="py-2.5 px-3 font-semibold text-gray-300">
                          {ph.label || ph.tag}
                        </td>
                        <td className="py-2.5 px-3">
                          <span
                            className={`font-mono text-[11px] ${
                              isDefault ? 'text-amber-400/80 italic' : 'text-emerald-400 font-semibold'
                            }`}
                          >
                            {value}
                          </span>
                        </td>
                        <td className="py-2.5 px-3">
                          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#202020] text-gray-400 border border-[#303030]">
                            {ph.category || (ph.isCustom ? 'Custom' : 'System')}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          {isDefault ? (
                            <span className="inline-flex items-center gap-1 text-[10px] text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded font-mono">
                              Fallback Default
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[10px] text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded font-mono">
                              <CheckCircle2 className="w-3 h-3" /> Live Mapped
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          /* Real High-Fidelity Microsoft Word (.docx) Rendering Container */
          <div className="w-full flex flex-col items-center">
            {/* Loading Indicator Overlay */}
            {isRenderingDocx && (
              <div className="flex items-center gap-2.5 px-4 py-2 bg-blue-600/90 text-white rounded-full text-xs font-semibold shadow-lg animate-pulse mb-4 z-10">
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>Rendering exact Microsoft Word (.docx) document...</span>
              </div>
            )}

            {/* Error Banner */}
            {renderError && (
              <div className="w-full max-w-xl p-4 bg-red-500/10 border border-red-500/30 rounded-xl text-red-300 text-xs mb-4 flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 shrink-0 text-red-400 mt-0.5" />
                <div className="space-y-1">
                  <strong className="block font-semibold">Document Rendering Notice:</strong>
                  <p>{renderError}</p>
                  <p className="text-[11px] text-gray-400">
                    Ensure the uploaded file is a valid standard Microsoft Word (.docx) file.
                  </p>
                </div>
              </div>
            )}

            {/* Container for docx-preview rendering */}
            <div
              style={{
                transform: `scale(${zoomLevel / 100})`,
                transformOrigin: 'top center',
                transition: 'transform 0.1s ease-out'
              }}
              className="docx-preview-container w-full flex flex-col items-center"
            >
              <div ref={docxContainerRef} className="w-full flex flex-col items-center" />
            </div>
          </div>
        )}
      </div>

      {/* Bottom Status Bar */}
      <div className="px-4 py-2 bg-[#111] border-t border-[#222] flex flex-wrap items-center justify-between text-[11px] text-gray-400 font-mono">
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1.5 text-gray-300">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            <span>High-Fidelity DOCX Engine</span>
          </span>
          {hasUploadedCustomDocx ? (
            <span className="text-emerald-400">
              Active Template: <strong className="text-emerald-300">{config.wordTemplateName}</strong>
            </span>
          ) : (
            <span className="text-gray-500">
              Active Template: Standard QA Reference Sheet
            </span>
          )}
        </div>

        <div className="flex items-center gap-3">
          <span>Pages: {pageCount}</span>
          <span>Zoom: {zoomLevel}%</span>
          <span>Mode: {viewMode === 'populated' ? 'Mapped Live' : viewMode === 'tags' ? 'Template Tags' : 'Matrix'}</span>
        </div>
      </div>
    </div>
  );
};
