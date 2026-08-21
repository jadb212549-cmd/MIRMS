import React, { useState, useMemo } from 'react';
import { AppConfig, MasterItem, ReferenceRegistration, WordDocPlaceholder } from '../types';
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
  Printer
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

  // Helper function to evaluate value
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
      case 'category':
        return {
          value: masterItem.category === 'RM' ? 'Raw Material (RM)' : 'Production Supply (PS)',
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
      case 'registrationdate':
        return {
          value: registration.registrationDate || new Date().toISOString().split('T')[0],
          isDefault: false,
          fieldLabel: 'Registration Date'
        };
      case 'todaydate':
        return {
          value: new Date().toISOString().split('T')[0],
          isDefault: false,
          fieldLabel: 'Export Date'
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
      default: {
        // Custom fields check
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
        // Custom placeholder check
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

  // Reusable inline placeholder renderer
  const renderField = (tag: string, fallbackLabel?: string, className = '') => {
    const isHovered = hoveredTag?.toLowerCase() === tag.toLowerCase();
    const isSelected = selectedTag?.toLowerCase() === tag.toLowerCase();
    const { value, isDefault } = evaluateTag(tag);

    const isShowingTag = viewMode === 'tags';
    const displayText = isShowingTag ? tag : value;

    return (
      <span
        onClick={(e) => {
          e.stopPropagation();
          onSelectTag(selectedTag === tag ? null : tag);
        }}
        className={`inline-flex items-baseline px-1.5 py-0.5 rounded transition-all cursor-pointer select-text ${
          showHighlightTags || isHovered || isSelected || isShowingTag
            ? isHovered || isSelected
              ? 'bg-amber-300 text-amber-950 font-bold ring-2 ring-amber-500 shadow-xs'
              : isShowingTag
              ? 'bg-blue-100 text-blue-900 border border-blue-300 font-mono font-bold'
              : 'bg-blue-50 text-blue-950 border border-blue-200'
            : 'text-gray-900'
        } ${className}`}
        title={`Click to inspect ${tag} (Evaluates to: "${value}")`}
      >
        {displayText}
        {(showHighlightTags || isHovered || isSelected) && !isShowingTag && (
          <span className="ml-1 text-[9px] font-mono text-blue-600 bg-blue-100/80 px-1 py-0.2 rounded border border-blue-200 opacity-90 select-none">
            {tag}
          </span>
        )}
      </span>
    );
  };

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

  // Dynamic custom attributes list
  const customAttributesList = useMemo(() => {
    const list: Array<{ tag: string; label: string; value: string; isDefault: boolean }> = [];
    const seen = new Set<string>();

    if (config.customFields && config.customFields.length > 0) {
      config.customFields.forEach((cf) => {
        const tag = `{{${cf.key}}}`;
        seen.add(tag.toLowerCase());
        const { value, isDefault } = evaluateTag(tag);
        list.push({ tag, label: cf.label, value, isDefault });
      });
    }

    if (config.wordDocPlaceholders && config.wordDocPlaceholders.length > 0) {
      config.wordDocPlaceholders.forEach((ph) => {
        if (!ph.isCustom) return;
        if (seen.has(ph.tag.toLowerCase())) return;
        seen.add(ph.tag.toLowerCase());
        const { value, isDefault } = evaluateTag(ph.tag);
        list.push({ tag: ph.tag, label: ph.label || ph.tag, value, isDefault });
      });
    }

    return list;
  }, [config.customFields, config.wordDocPlaceholders, registration, masterItem]);

  return (
    <div className="bg-[#141414] rounded-xl border border-[#222] overflow-hidden flex flex-col shadow-xs h-full">
      {/* Top Controls Toolbar */}
      <div className="p-3.5 bg-[#181818] border-b border-[#2A2A2A] flex flex-wrap items-center justify-between gap-3">
        {/* Left: Title & Live Sample Selector */}
        <div className="flex items-center gap-2.5 flex-wrap">
          <div className="flex items-center gap-1.5 px-2.5 py-1 bg-blue-500/10 border border-blue-500/30 rounded-lg text-blue-400">
            <FileText className="w-4 h-4" />
            <span className="text-xs font-bold uppercase tracking-wider font-mono">Word Preview</span>
          </div>

          {/* Quick Registration Selector */}
          <div className="flex items-center gap-1 bg-[#101010] border border-[#2D2D2D] rounded-lg p-0.5">
            <button
              type="button"
              onClick={handlePrevReg}
              disabled={currentIndex <= 0}
              className="p-1 text-gray-400 hover:text-white disabled:opacity-30 disabled:hover:text-gray-400 rounded transition-colors"
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
              className="p-1 text-gray-400 hover:text-white disabled:opacity-30 disabled:hover:text-gray-400 rounded transition-colors"
              title="Next sample"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Center: View Mode Segmented Control */}
        <div className="flex items-center bg-[#101010] border border-[#2E2E2E] rounded-lg p-0.5 text-xs font-medium">
          <button
            type="button"
            onClick={() => onViewModeChange('populated')}
            className={`px-2.5 py-1 rounded-md transition-colors flex items-center gap-1.5 ${
              viewMode === 'populated'
                ? 'bg-blue-600 text-white font-bold shadow-xs'
                : 'text-gray-400 hover:text-gray-200'
            }`}
            title="Show document populated with live specimen data"
          >
            <Eye className="w-3.5 h-3.5" />
            <span>Mapped Live</span>
          </button>
          <button
            type="button"
            onClick={() => onViewModeChange('tags')}
            className={`px-2.5 py-1 rounded-md transition-colors flex items-center gap-1.5 ${
              viewMode === 'tags'
                ? 'bg-blue-600 text-white font-bold shadow-xs'
                : 'text-gray-400 hover:text-gray-200'
            }`}
            title="Show raw placeholder tokens e.g. {{productCode}}"
          >
            <Tag className="w-3.5 h-3.5" />
            <span>Template Tags</span>
          </button>
          <button
            type="button"
            onClick={() => onViewModeChange('matrix')}
            className={`px-2.5 py-1 rounded-md transition-colors flex items-center gap-1.5 ${
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

        {/* Right: Tag Badges Toggle, Zoom & Download */}
        <div className="flex items-center gap-2">
          {viewMode !== 'matrix' && (
            <button
              type="button"
              onClick={onToggleHighlightTags}
              className={`text-xs px-2.5 py-1 rounded-lg border flex items-center gap-1.5 transition-colors ${
                showHighlightTags
                  ? 'bg-blue-500/20 text-blue-300 border-blue-500/40 font-semibold'
                  : 'bg-[#141414] text-gray-400 hover:text-white border-[#333]'
              }`}
              title="Toggle placeholder tag badges on the document sheet"
            >
              <Tag className="w-3 h-3" />
              <span>{showHighlightTags ? 'Tags On' : 'Tags Off'}</span>
            </button>
          )}

          {/* Zoom controls */}
          {viewMode !== 'matrix' && (
            <div className="hidden sm:flex items-center gap-1 bg-[#101010] border border-[#2D2D2D] rounded-lg p-0.5">
              <button
                type="button"
                onClick={() => setZoomLevel((z) => Math.max(70, z - 10))}
                className="p-1 text-gray-400 hover:text-white rounded"
                title="Zoom out"
              >
                <ZoomOut className="w-3.5 h-3.5" />
              </button>
              <span className="text-[11px] font-mono text-gray-400 px-1 min-w-[36px] text-center">
                {zoomLevel}%
              </span>
              <button
                type="button"
                onClick={() => setZoomLevel((z) => Math.min(130, z + 10))}
                className="p-1 text-gray-400 hover:text-white rounded"
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
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-500 rounded-lg shadow-sm transition-colors disabled:opacity-50"
            title="Download generated Microsoft Word (.docx) file"
          >
            <Download className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">{isGenerating ? 'Generating...' : 'Export DOCX'}</span>
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-[#0E0E0E] flex items-start justify-center min-h-[550px]">
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
          /* Realistic Word Document Page Simulation (A4 / Standard Doc Layout) */
          <div
            style={{ transform: `scale(${zoomLevel / 100})`, transformOrigin: 'top center' }}
            className="w-full max-w-[760px] bg-white text-gray-900 rounded-lg shadow-2xl border border-gray-300 p-8 sm:p-12 font-sans transition-transform duration-150 select-text relative"
          >
            {/* Watermark/Background subtle cue */}
            <div className="absolute top-3 right-4 text-[10px] font-mono text-gray-400 select-none flex items-center gap-1">
              <ShieldCheck className="w-3 h-3 text-blue-600" />
              <span>Official Reference Template .docx Simulation</span>
            </div>

            {/* Document Header Section */}
            <div className="border-b-2 border-slate-900 pb-4 mb-6">
              <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
                <div className="flex-1">
                  <div className="text-xs font-bold text-sky-700 tracking-wider uppercase font-sans mb-1 flex items-center gap-1.5">
                    <Building className="w-3.5 h-3.5" />
                    {renderField('{{companyName}}', 'Precision Industrial Manufacturing Corp.', 'font-bold')}
                  </div>
                  <h1 className="text-lg sm:text-xl font-extrabold text-slate-900 leading-tight uppercase">
                    Material Reference & Sample Specification Form
                  </h1>
                  <p className="text-[11px] text-gray-500 font-mono mt-0.5">
                    Standard Operating Quality Procedure QA-SOP-REF-04
                  </p>
                </div>

                <div className="bg-slate-100 p-3 rounded-lg border border-slate-200 text-right shrink-0 min-w-[170px] space-y-1">
                  <div className="text-[11px] font-mono text-gray-600 flex justify-between gap-2">
                    <span className="font-semibold">Doc Ref:</span>
                    <span className="font-bold text-slate-900">
                      REF-{renderField('{{productCode}}')}
                    </span>
                  </div>
                  <div className="text-[11px] font-mono text-gray-600 flex justify-between gap-2">
                    <span className="font-semibold">Revision:</span>
                    <span className="font-bold text-red-600">
                      {renderField('{{revision}}', 'Rev 01')}
                    </span>
                  </div>
                  <div className="text-[11px] font-mono text-gray-600 flex justify-between gap-2">
                    <span className="font-semibold">Export Date:</span>
                    <span className="font-bold text-slate-700">
                      {renderField('{{todayDate}}')}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Section 1: Master Item Baseline Data */}
            <div className="mb-6">
              <div className="bg-slate-900 text-white text-xs font-bold px-3 py-1.5 rounded-t-md uppercase tracking-wider flex items-center justify-between">
                <span>1. Master Item Reference Details</span>
                <span className="text-[10px] font-mono text-slate-300">Catalog Standard</span>
              </div>
              <table className="w-full text-xs border border-slate-200 border-t-0 rounded-b-md overflow-hidden">
                <tbody className="divide-y divide-slate-200">
                  <tr className="bg-slate-50/50">
                    <td className="py-2 px-3 font-bold text-slate-700 w-1/4 bg-slate-100/70 border-r border-slate-200">
                      Product Code:
                    </td>
                    <td className="py-2 px-3 w-1/4 font-mono font-bold text-slate-900 border-r border-slate-200">
                      {renderField('{{productCode}}')}
                    </td>
                    <td className="py-2 px-3 font-bold text-slate-700 w-1/4 bg-slate-100/70 border-r border-slate-200">
                      Material Category:
                    </td>
                    <td className="py-2 px-3 w-1/4 font-medium text-slate-800">
                      {renderField('{{category}}')}
                    </td>
                  </tr>
                  <tr>
                    <td className="py-2 px-3 font-bold text-slate-700 bg-slate-100/70 border-r border-slate-200">
                      Description:
                    </td>
                    <td colSpan={3} className="py-2 px-3 text-slate-800 font-medium leading-relaxed">
                      {renderField('{{description}}')}
                    </td>
                  </tr>
                  <tr className="bg-slate-50/50">
                    <td className="py-2 px-3 font-bold text-slate-700 bg-slate-100/70 border-r border-slate-200">
                      Item Status:
                    </td>
                    <td className="py-2 px-3 border-r border-slate-200 font-semibold text-emerald-700">
                      {renderField('{{itemStatus}}')}
                    </td>
                    <td className="py-2 px-3 font-bold text-slate-700 bg-slate-100/70 border-r border-slate-200">
                      Reference Unit:
                    </td>
                    <td className="py-2 px-3 font-medium text-slate-800">
                      {renderField('{{unit}}')}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Section 2: Reference Registration Details */}
            <div className="mb-6">
              <div className="bg-slate-900 text-white text-xs font-bold px-3 py-1.5 rounded-t-md uppercase tracking-wider flex items-center justify-between">
                <span>2. Reference Registration & Sampling Data</span>
                <span className="text-[10px] font-mono text-slate-300">QC Record</span>
              </div>
              <table className="w-full text-xs border border-slate-200 border-t-0 rounded-b-md overflow-hidden">
                <tbody className="divide-y divide-slate-200">
                  <tr className="bg-slate-50/50">
                    <td className="py-2 px-3 font-bold text-slate-700 w-1/4 bg-slate-100/70 border-r border-slate-200">
                      Registered By:
                    </td>
                    <td className="py-2 px-3 w-1/4 font-semibold text-slate-900 border-r border-slate-200">
                      {renderField('{{registeredBy}}')}
                    </td>
                    <td className="py-2 px-3 font-bold text-slate-700 w-1/4 bg-slate-100/70 border-r border-slate-200">
                      Registration Date:
                    </td>
                    <td className="py-2 px-3 w-1/4 font-mono font-medium text-slate-800">
                      {renderField('{{registrationDate}}')}
                    </td>
                  </tr>
                  <tr>
                    <td className="py-2 px-3 font-bold text-slate-700 bg-slate-100/70 border-r border-slate-200">
                      Supplier / Source:
                    </td>
                    <td colSpan={3} className="py-2 px-3 text-slate-800 font-medium">
                      {renderField('{{supplier}}')}
                    </td>
                  </tr>
                  <tr className="bg-slate-50/50">
                    <td className="py-2 px-3 font-bold text-slate-700 bg-slate-100/70 border-r border-slate-200">
                      Technical Spec:
                    </td>
                    <td colSpan={3} className="py-2 px-3 text-slate-800 font-medium leading-relaxed">
                      {renderField('{{specification}}')}
                    </td>
                  </tr>
                  <tr>
                    <td className="py-2 px-3 font-bold text-slate-700 bg-slate-100/70 border-r border-slate-200">
                      Inspector Remarks:
                    </td>
                    <td colSpan={3} className="py-2 px-3 text-slate-700 italic leading-relaxed">
                      {renderField('{{remarks}}')}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Section 3: Extended Material Attributes (Custom Fields & Custom Placeholders) */}
            <div className="mb-6">
              <div className="bg-slate-900 text-white text-xs font-bold px-3 py-1.5 rounded-t-md uppercase tracking-wider flex items-center justify-between">
                <span>3. Extended Material Attributes & Physical Location</span>
                <span className="text-[10px] font-mono text-slate-300">Custom Placeholders</span>
              </div>
              <table className="w-full text-xs border border-slate-200 border-t-0 rounded-b-md overflow-hidden">
                <tbody className="divide-y divide-slate-200">
                  {customAttributesList.length > 0 ? (
                    customAttributesList.map((attr) => (
                      <tr key={attr.tag} className="hover:bg-slate-50 transition-colors">
                        <td className="py-2 px-3 font-bold text-slate-700 w-1/3 bg-slate-100/70 border-r border-slate-200">
                          {attr.label}:
                        </td>
                        <td className="py-2 px-3 text-slate-900 font-medium">
                          {renderField(attr.tag)}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={2} className="py-3 px-3 text-center text-gray-500 italic text-xs">
                        No custom attributes defined. Click "+ New Placeholder" on the left to add custom tags!
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Section 4: Attached Specimen Verification Photos */}
            <div className="mb-6">
              <div className="bg-slate-900 text-white text-xs font-bold px-3 py-1.5 rounded-t-md uppercase tracking-wider flex items-center justify-between">
                <span>4. Attached Specimen Photos & Visual Standards</span>
                <span className="text-[10px] font-mono text-slate-300">
                  {renderField('{{photosCount}}')} Files Recorded
                </span>
              </div>
              <div className="border border-slate-200 border-t-0 rounded-b-md p-4 bg-slate-50/50">
                <div className="mb-3 text-[11px] text-gray-600 flex items-center gap-2">
                  <ImageIcon className="w-3.5 h-3.5 text-blue-600" />
                  <span>
                    Verified photographic evidence catalog: {renderField('{{photosList}}')}
                  </span>
                </div>

                {registration?.photos && registration.photos.length > 0 ? (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {registration.photos.map((photo, idx) => (
                      <div
                        key={photo.id || idx}
                        className="bg-white p-2 rounded border border-slate-200 shadow-xs flex flex-col items-center"
                      >
                        <div className="w-full h-24 bg-gray-100 rounded overflow-hidden flex items-center justify-center border border-gray-200">
                          <img
                            src={photo.dataUrl}
                            alt={photo.caption || `Specimen ${idx + 1}`}
                            className="w-full h-full object-cover"
                          />
                        </div>
                        <span className="text-[10px] font-semibold text-slate-700 mt-1 truncate w-full text-center">
                          {photo.category ? `[${photo.category}] ` : ''}
                          {photo.caption || `Photo #${idx + 1}`}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-4 bg-white border border-dashed border-slate-300 rounded text-center text-xs text-gray-500">
                    No physical sample photos attached for this specimen.
                  </div>
                )}
              </div>
            </div>

            {/* Section 5: Authorization & Sign-Off Block */}
            <div className="pt-3 border-t border-slate-200">
              <div className="text-[11px] font-bold uppercase text-slate-700 mb-2">
                5. Quality Assurance Approval Sign-Off
              </div>
              <div className="grid grid-cols-3 gap-4 text-[10px] text-gray-600">
                <div className="p-2.5 bg-slate-50 border border-slate-200 rounded">
                  <div className="font-bold text-slate-800 mb-6">Prepared / Sampled By:</div>
                  <div className="border-t border-slate-300 pt-1 font-mono text-[9px]">
                    Signature / Date
                  </div>
                </div>
                <div className="p-2.5 bg-slate-50 border border-slate-200 rounded">
                  <div className="font-bold text-slate-800 mb-6">Verified by QA Lead:</div>
                  <div className="border-t border-slate-300 pt-1 font-mono text-[9px]">
                    Signature / Date
                  </div>
                </div>
                <div className="p-2.5 bg-slate-50 border border-slate-200 rounded">
                  <div className="font-bold text-slate-800 mb-6">QC Manager Approved:</div>
                  <div className="border-t border-slate-300 pt-1 font-mono text-[9px]">
                    Signature / Date
                  </div>
                </div>
              </div>
            </div>

            {/* Document Footer */}
            <div className="mt-8 pt-3 border-t border-slate-200 text-center text-[9px] font-mono text-gray-400 flex justify-between items-center">
              <span>{config.companyName || 'Precision Industrial Manufacturing Corp.'}</span>
              <span>Template: {config.wordTemplateName || 'Official_Material_Reference_Template_v2.docx'}</span>
              <span>Page 1 of 1</span>
            </div>
          </div>
        )}
      </div>

      {/* Bottom Status / Selected Tag Inspector */}
      {selectedTag && (
        <div className="p-3 bg-[#111827] border-t border-blue-900/50 flex items-center justify-between text-xs text-gray-300 animate-in fade-in">
          <div className="flex items-center gap-2">
            <span className="text-blue-400 font-mono font-bold">{selectedTag}</span>
            <span className="text-gray-500">→</span>
            <span className="text-emerald-400 font-mono font-semibold">
              "{evaluateTag(selectedTag).value}"
            </span>
            <span className="text-[10px] text-gray-400">
              ({evaluateTag(selectedTag).fieldLabel || 'Template Tag'})
            </span>
          </div>
          <button
            onClick={() => onSelectTag(null)}
            className="text-[11px] text-gray-400 hover:text-white px-2 py-0.5 rounded bg-[#1A2333] border border-blue-800/40"
          >
            Clear Selection
          </button>
        </div>
      )}
    </div>
  );
};
