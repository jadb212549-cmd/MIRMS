import React, { useState, useMemo } from 'react';
import JSZip from 'jszip';
import { AppConfig, MasterItem, ReferenceRegistration, WordDocPlaceholder } from '../types';
import { 
  FileText, 
  Download, 
  Upload, 
  CheckCircle2, 
  Copy, 
  Sparkles, 
  AlertCircle, 
  RefreshCw, 
  Plus, 
  Search, 
  Tag, 
  Edit2, 
  Trash2, 
  Layers, 
  Sliders, 
  Eye, 
  Check, 
  HelpCircle,
  RotateCcw,
  Columns,
  Maximize2,
  FileCode
} from 'lucide-react';
import { wordService } from '../services/wordService';
import { DEFAULT_WORD_PLACEHOLDERS } from '../services/defaultData';
import { NewPlaceholderModal } from './NewPlaceholderModal';
import { WordTemplateDocPreview } from './WordTemplateDocPreview';

interface WordTemplateViewProps {
  config: AppConfig;
  masterItems: MasterItem[];
  registrations: ReferenceRegistration[];
  onConfigChange: (newConfig: Partial<AppConfig>) => Promise<void>;
}

export const WordTemplateView: React.FC<WordTemplateViewProps> = ({
  config,
  masterItems,
  registrations,
  onConfigChange
}) => {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [templateName, setTemplateName] = useState(config.wordTemplateName || 'Official_Material_Reference_Template_v2.docx');
  const [companyName, setCompanyName] = useState(config.companyName || 'Precision Industrial Manufacturing Corp.');
  const [selectedRegId, setSelectedRegId] = useState<string>(registrations[0]?.id || '');
  const [isGeneratingTest, setIsGeneratingTest] = useState(false);
  const [statusMsg, setStatusMsg] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);

  // Layout mode: 'split' (side-by-side) | 'preview-focused' | 'placeholders-focused'
  const [layoutMode, setLayoutMode] = useState<'split' | 'preview-focused' | 'placeholders-focused'>('split');

  // Preview Pane States
  const [docViewMode, setDocViewMode] = useState<'populated' | 'tags' | 'matrix'>('populated');
  const [showHighlightTags, setShowHighlightTags] = useState(true);
  const [hoveredTag, setHoveredTag] = useState<string | null>(null);
  const [selectedTag, setSelectedTag] = useState<string | null>(null);

  // Placeholders management state
  const [isPlaceholderModalOpen, setIsPlaceholderModalOpen] = useState(false);
  const [editingPlaceholder, setEditingPlaceholder] = useState<WordDocPlaceholder | null>(null);
  const [placeholderSearch, setPlaceholderSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [showLiveEvaluatedValues, setShowLiveEvaluatedValues] = useState(false);
  const [showConfigSettings, setShowConfigSettings] = useState(false);

  // Combine configured placeholders, default placeholders, and dynamic custom fields
  const allPlaceholders = useMemo<WordDocPlaceholder[]>(() => {
    const baseList: WordDocPlaceholder[] = config.wordDocPlaceholders && config.wordDocPlaceholders.length > 0
      ? config.wordDocPlaceholders
      : DEFAULT_WORD_PLACEHOLDERS;

    // Build list with unique tags
    const tagMap = new Map<string, WordDocPlaceholder>();
    baseList.forEach((p) => {
      tagMap.set(p.tag.toLowerCase(), p);
    });

    // Also auto-incorporate any defined custom fields as dynamic placeholders if not already present
    if (config.customFields && config.customFields.length > 0) {
      config.customFields.forEach((cf) => {
        const tag = `{{${cf.key}}}`;
        if (!tagMap.has(tag.toLowerCase())) {
          tagMap.set(tag.toLowerCase(), {
            id: `ph_cf_${cf.id}`,
            tag,
            label: cf.label,
            desc: `Custom attribute: ${cf.label} (${cf.type})`,
            category: 'CustomField',
            defaultValue: cf.defaultValue || 'N/A',
            sampleValue: cf.defaultValue || 'Sample Value',
            isSystem: false,
            isCustom: true,
            customFieldKey: cf.key
          });
        }
      });
    }

    return Array.from(tagMap.values());
  }, [config.wordDocPlaceholders, config.customFields]);

  // Selected registration for test preview
  const selectedReg = useMemo(() => {
    return registrations.find((r) => r.id === selectedRegId) || registrations[0] || null;
  }, [registrations, selectedRegId]);

  const selectedMaster = useMemo(() => {
    if (!selectedReg) return null;
    return masterItems.find((m) => m.productCode.toLowerCase() === selectedReg.productCode.toLowerCase()) || null;
  }, [masterItems, selectedReg]);

  // Filtered placeholders
  const filteredPlaceholders = useMemo(() => {
    return allPlaceholders.filter((item) => {
      const matchSearch =
        item.tag.toLowerCase().includes(placeholderSearch.toLowerCase()) ||
        (item.label && item.label.toLowerCase().includes(placeholderSearch.toLowerCase())) ||
        item.desc.toLowerCase().includes(placeholderSearch.toLowerCase());

      const itemCat = item.category?.toUpperCase() || 'CUSTOM';
      const matchCategory =
        selectedCategory === 'ALL' ||
        (selectedCategory === 'CUSTOM' && (item.isCustom || item.category === 'Custom')) ||
        (selectedCategory === 'SYSTEM' && (item.isSystem || item.category === 'System')) ||
        (selectedCategory === 'CUSTOMFIELD' && item.category === 'CustomField') ||
        (selectedCategory === 'MASTER' && item.category === 'Master') ||
        (selectedCategory === 'REGISTRATION' && item.category === 'Registration') ||
        (selectedCategory === 'SIGN-OFF' && item.category === 'Sign-off') ||
        itemCat === selectedCategory;

      return matchSearch && matchCategory;
    });
  }, [allPlaceholders, placeholderSearch, selectedCategory]);

  // Categories list
  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = { 
      ALL: allPlaceholders.length, 
      MASTER: 0, 
      REGISTRATION: 0, 
      'SIGN-OFF': 0, 
      SYSTEM: 0, 
      CUSTOMFIELD: 0,
      CUSTOM: 0 
    };
    allPlaceholders.forEach((p) => {
      const cat = p.category?.toUpperCase() || 'CUSTOM';
      if (cat === 'MASTER') counts.MASTER = (counts.MASTER || 0) + 1;
      else if (cat === 'REGISTRATION') counts.REGISTRATION = (counts.REGISTRATION || 0) + 1;
      else if (cat === 'SIGN-OFF' || cat === 'SIGNOFF') counts['SIGN-OFF'] = (counts['SIGN-OFF'] || 0) + 1;
      else if (cat === 'SYSTEM') counts.SYSTEM = (counts.SYSTEM || 0) + 1;
      else if (cat === 'CUSTOMFIELD') counts.CUSTOMFIELD = (counts.CUSTOMFIELD || 0) + 1;
      
      if (p.isCustom || p.category === 'Custom') counts.CUSTOM = (counts.CUSTOM || 0) + 1;
    });
    return counts;
  }, [allPlaceholders]);

  const handleCopy = (tag: string) => {
    navigator.clipboard.writeText(tag);
    setCopiedKey(tag);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const handleCopyAllPlaceholders = () => {
    const text = allPlaceholders.map(p => `${p.tag.padEnd(24)} -> ${p.label || ''} (${p.desc})`).join('\n');
    navigator.clipboard.writeText(text);
    setStatusMsg({ type: 'success', text: `Copied all ${allPlaceholders.length} placeholder tags to clipboard.` });
    setTimeout(() => setStatusMsg(null), 3500);
  };

  const handleTemplateFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith('.docx') && !file.name.endsWith('.doc')) {
      setStatusMsg({ type: 'error', text: 'Please select a valid Microsoft Word (.docx) document file.' });
      setTimeout(() => setStatusMsg(null), 4000);
      return;
    }

    try {
      setStatusMsg({ type: 'info', text: `Processing Word template "${file.name}"...` });

      const arrayBuffer = await file.arrayBuffer();
      let binary = '';
      const bytes = new Uint8Array(arrayBuffer);
      const len = bytes.byteLength;
      for (let i = 0; i < len; i++) {
        binary += String.fromCharCode(bytes[i]);
      }
      const base64Data = btoa(binary);

      // Extract placeholders using JSZip
      let extractedTags: string[] = [];
      try {
        const zip = await JSZip.loadAsync(arrayBuffer);
        const docXmlFile = zip.file('word/document.xml');
        if (docXmlFile) {
          const xmlText = await docXmlFile.async('text');
          const plainText = xmlText.replace(/<[^>]+>/g, '');
          const tagMatches = plainText.match(/\{\{([a-zA-Z0-9_]+)\}\}/g);
          if (tagMatches) {
            extractedTags = Array.from(new Set(tagMatches));
          }
        }
      } catch (zipErr) {
        console.warn('Could not extract zip contents for tag scanning:', zipErr);
      }

      // Merge extracted placeholders into existing placeholders
      const currentList = config.wordDocPlaceholders && config.wordDocPlaceholders.length > 0
        ? [...config.wordDocPlaceholders]
        : [...DEFAULT_WORD_PLACEHOLDERS];

      let newlyAddedCount = 0;
      extractedTags.forEach((fullTag) => {
        const cleanTag = fullTag.replace(/^\{\{|\}\}$/g, '');
        const exists = currentList.some(
          (p) => p.tag.toLowerCase() === fullTag.toLowerCase() || p.id.toLowerCase() === `ph_${cleanTag.toLowerCase()}`
        );
        if (!exists) {
          newlyAddedCount++;
          currentList.push({
            id: `ph_${cleanTag.toLowerCase()}_${Date.now()}`,
            tag: fullTag,
            label: cleanTag.replace(/([A-Z])/g, ' $1').trim(),
            desc: `Detected from imported template (${file.name})`,
            category: 'Custom',
            sampleValue: `[${cleanTag}]`,
            isSystem: false,
            isCustom: true
          });
        }
      });

      setTemplateName(file.name);
      await onConfigChange({
        wordTemplateName: file.name,
        wordTemplateContent: base64Data,
        wordDocPlaceholders: currentList
      });

      setStatusMsg({
        type: 'success',
        text: `Word template "${file.name}" imported and active! Found ${extractedTags.length} placeholder tag(s)${newlyAddedCount > 0 ? ` (${newlyAddedCount} new added)` : ''}.`
      });
      setTimeout(() => setStatusMsg(null), 5000);
    } catch (err: any) {
      console.error('Failed to import Word template:', err);
      setStatusMsg({
        type: 'error',
        text: `Failed to import Word template: ${err.message || 'Invalid or corrupted .docx file'}`
      });
      setTimeout(() => setStatusMsg(null), 5000);
    }
  };

  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    await onConfigChange({
      wordTemplateName: templateName.trim(),
      companyName: companyName.trim()
    });
    setStatusMsg({ type: 'success', text: 'Template settings updated successfully.' });
    setTimeout(() => setStatusMsg(null), 3500);
  };

  // Add / Edit Placeholder
  const handleSavePlaceholder = async (newPlaceholder: WordDocPlaceholder) => {
    let updatedList: WordDocPlaceholder[] = [];
    const currentList = config.wordDocPlaceholders && config.wordDocPlaceholders.length > 0
      ? config.wordDocPlaceholders
      : DEFAULT_WORD_PLACEHOLDERS;

    const existingIndex = currentList.findIndex(
      (p) => p.id === newPlaceholder.id || p.tag.toLowerCase() === newPlaceholder.tag.toLowerCase()
    );

    if (existingIndex >= 0) {
      updatedList = [...currentList];
      updatedList[existingIndex] = newPlaceholder;
    } else {
      updatedList = [...currentList, newPlaceholder];
    }

    await onConfigChange({
      wordDocPlaceholders: updatedList
    });

    setStatusMsg({
      type: 'success',
      text: `Placeholder "${newPlaceholder.tag}" saved successfully.`
    });
    setTimeout(() => setStatusMsg(null), 3500);
  };

  // Delete Placeholder
  const handleDeletePlaceholder = async (placeholderId: string) => {
    const currentList = config.wordDocPlaceholders && config.wordDocPlaceholders.length > 0
      ? config.wordDocPlaceholders
      : DEFAULT_WORD_PLACEHOLDERS;

    const target = currentList.find((p) => p.id === placeholderId);
    const updatedList = currentList.filter((p) => p.id !== placeholderId);

    await onConfigChange({
      wordDocPlaceholders: updatedList
    });

    if (selectedTag && target && selectedTag === target.tag) {
      setSelectedTag(null);
    }

    setStatusMsg({
      type: 'success',
      text: `Placeholder ${target ? `"${target.tag}"` : ''} deleted.`
    });
    setTimeout(() => setStatusMsg(null), 3500);
  };

  // Reset to default placeholders
  const handleResetPlaceholders = async () => {
    if (window.confirm('Are you sure you want to restore the default system placeholders?')) {
      await onConfigChange({
        wordDocPlaceholders: DEFAULT_WORD_PLACEHOLDERS
      });
      setStatusMsg({ type: 'success', text: 'Placeholders reset to default system set.' });
      setTimeout(() => setStatusMsg(null), 3500);
    }
  };

  // Evaluate tag value against live selected reference sample
  const evaluatePlaceholderValue = (item: WordDocPlaceholder): string => {
    if (!selectedReg || !selectedMaster) {
      return item.sampleValue || item.defaultValue || 'N/A';
    }

    const tagKey = item.tag.replace(/^\{\{|\}\}$/g, '');
    const tagLower = tagKey.toLowerCase();
    
    switch (tagLower) {
      // Master Data
      case 'productcode':
        return selectedReg.productCode;
      case 'description':
        return selectedMaster.description;
      case 'materialtype': {
        const matType = selectedReg.materialType || selectedMaster.materialType || (selectedMaster.category === 'PS' ? 'PS' : 'RM');
        return matType === 'PS' ? 'Production Supply (PS)' : 'Raw Material (RM)';
      }
      case 'materialtypecode':
        return selectedReg.materialType || selectedMaster.materialType || (selectedMaster.category === 'PS' ? 'PS' : 'RM');
      case 'category':
        return selectedReg.category || selectedMaster.category || 'Standard';
      case 'unit':
        return selectedMaster.unit || 'Piece';
      case 'itemstatus':
      case 'status':
        return selectedMaster.status || 'Active';
      case 'itemcreatedat':
        return selectedMaster.createdAt ? selectedMaster.createdAt.split('T')[0] : '2026-08-15';
        
      // Registration & QA
      case 'revision':
        return selectedReg.revision || 'Rev 01';
      case 'registeredby':
        return selectedReg.registeredBy;
      case 'registeredbyid':
        return `EMP-${selectedReg.registeredBy ? selectedReg.registeredBy.replace(/[^a-zA-Z0-9]/g, '').slice(0, 4).toUpperCase() : 'QA01'}`;
      case 'registrationdate':
        return selectedReg.registrationDate;
      case 'supplier':
        return selectedReg.supplier || 'N/A';
      case 'specification':
        return selectedReg.specification || 'N/A';
      case 'remarks':
        return selectedReg.remarks || 'None';
      case 'registrationid':
        return selectedReg.id;
      case 'proofid':
        return `IP-${selectedReg.productCode.replace(/[^a-zA-Z0-9]/g, '')}-${selectedReg.id.slice(-6)}`;
      case 'photoscount':
        return String(selectedReg.photos?.length || 0);
      case 'photoslist':
        return `${selectedReg.photos?.length || 0} attached sample photos`;
      case 'attachmentscount':
        return String(selectedReg.attachments?.length || 0);
        
      // Sign-off & Verification
      case 'checkedby':
        return 'JD. Stone (System Admin)';
      case 'checkedbyid':
        return 'ADM-001';
      case 'approvedby':
        return 'Quality Assurance Director';
      case 'approvaldate':
        return selectedReg.registrationDate;
      case 'inspectorsignature':
        return '___________________________ (Sign & Date)';
      case 'adminsignature':
        return '___________________________ (Sign & Date)';

      // System & Org
      case 'companyname':
        return config.companyName || 'Precision Industrial Manufacturing Corp.';
      case 'department':
        return 'Quality Assurance & Materials Engineering';
      case 'todaydate':
        return new Date().toISOString().split('T')[0];
      case 'todaydatetime':
        return new Date().toISOString().replace('T', ' ').slice(0, 19);
      case 'currentyear':
        return String(new Date().getFullYear());
      case 'documenttitle':
        return 'MATERIAL REFERENCE & SAMPLE SPECIFICATION FORM';
      case 'templatename':
        return config.wordTemplateName || 'Official_Material_Reference_Template_v2.docx';

      // Custom attributes / Custom fields
      default:
        if (selectedReg.customFields && selectedReg.customFields[tagKey] !== undefined) {
          const val = selectedReg.customFields[tagKey];
          return typeof val === 'boolean' ? (val ? 'YES' : 'NO') : String(val);
        }
        if (item.customFieldKey && selectedReg.customFields && selectedReg.customFields[item.customFieldKey] !== undefined) {
          const val = selectedReg.customFields[item.customFieldKey];
          return typeof val === 'boolean' ? (val ? 'YES' : 'NO') : String(val);
        }
        return item.defaultValue || item.sampleValue || 'Sample Value';
    }
  };

  const handleGenerateTestForm = async () => {
    if (!selectedReg || !selectedMaster) return;

    setIsGeneratingTest(true);
    try {
      await wordService.generateAndSave(selectedReg, selectedMaster, config, 'Template Tester');
      setStatusMsg({
        type: 'success',
        text: `Successfully generated official Word reference document for ${selectedReg.productCode}.`
      });
    } catch (err: any) {
      console.error(err);
      setStatusMsg({
        type: 'error',
        text: `Error generating Word document: ${err?.message || 'Unknown error'}`
      });
    } finally {
      setIsGeneratingTest(false);
    }
  };

  return (
    <div className="space-y-5 select-none">
      {/* Top Banner & Navigation Header */}
      <div className="bg-[#141414] rounded-xl border border-[#222] p-5 shadow-xs">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className="p-3 bg-[#1A1A1A] border border-[#2A2A2A] text-blue-400 rounded-xl shrink-0">
              <FileText className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-base font-bold text-gray-100 flex items-center gap-2">
                Word Template Dynamic Mapping & Live Preview (.docx)
                <span className="text-[10px] font-mono bg-blue-500/10 text-blue-400 px-2 py-0.5 rounded border border-blue-500/20">
                  DOCX Engine
                </span>
              </h2>
              <p className="text-xs text-gray-400 mt-1 max-w-3xl leading-relaxed">
                Design and audit how Word template placeholders <code className="bg-[#222] px-1 py-0.2 rounded text-blue-400 font-mono text-[11px] border border-[#333]">{"{{tag}}"}</code> map to actual inspection and material registration data. Inspect live evaluated values and export official reference forms directly.
              </p>
            </div>
          </div>

            {/* Action Toolbar */}
          <div className="flex items-center gap-2.5 flex-wrap self-start lg:self-center">
            {/* Import Word Template (.docx) Action */}
            <label
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-gray-200 bg-[#1A1A1A] hover:bg-[#252525] border border-[#333] hover:border-gray-500 rounded-lg cursor-pointer transition-colors shadow-xs"
              title="Import and upload an official Microsoft Word (.docx) document template"
            >
              <Upload className="w-3.5 h-3.5 text-blue-400" />
              <span>Import Word Doc</span>
              <input
                type="file"
                accept=".docx,.doc,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                onChange={handleTemplateFileUpload}
                className="hidden"
              />
            </label>

            {/* Layout Mode Segmented Control */}
            <div className="flex items-center bg-[#101010] border border-[#2D2D2D] rounded-lg p-0.5 text-xs font-mono">
              <button
                type="button"
                onClick={() => setLayoutMode('split')}
                className={`px-2.5 py-1.5 rounded-md transition-colors flex items-center gap-1.5 ${
                  layoutMode === 'split'
                    ? 'bg-blue-600 text-white font-bold shadow-xs'
                    : 'text-gray-400 hover:text-gray-200'
                }`}
                title="Side-by-side view (Placeholders & Live Word Preview)"
              >
                <Columns className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Side-by-Side</span>
              </button>
              <button
                type="button"
                onClick={() => setLayoutMode('preview-focused')}
                className={`px-2.5 py-1.5 rounded-md transition-colors flex items-center gap-1.5 ${
                  layoutMode === 'preview-focused'
                    ? 'bg-blue-600 text-white font-bold shadow-xs'
                    : 'text-gray-400 hover:text-gray-200'
                }`}
                title="Full Word Document Preview"
              >
                <Eye className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Document Only</span>
              </button>
              <button
                type="button"
                onClick={() => setLayoutMode('placeholders-focused')}
                className={`px-2.5 py-1.5 rounded-md transition-colors flex items-center gap-1.5 ${
                  layoutMode === 'placeholders-focused'
                    ? 'bg-blue-600 text-white font-bold shadow-xs'
                    : 'text-gray-400 hover:text-gray-200'
                }`}
                title="Placeholders Library"
              >
                <Tag className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Placeholders</span>
              </button>
            </div>

            {/* Template Settings Toggle */}
            <button
              type="button"
              onClick={() => setShowConfigSettings(!showConfigSettings)}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
                showConfigSettings
                  ? 'bg-blue-500/10 text-blue-300 border-blue-500/30 font-bold'
                  : 'bg-[#1A1A1A] text-gray-400 hover:text-white border-[#333]'
              }`}
              title="Toggle Word template configuration settings"
            >
              <Sliders className="w-3.5 h-3.5" />
              <span>Config</span>
            </button>

            {/* + New Placeholder Action Button */}
            <button
              type="button"
              onClick={() => {
                setEditingPlaceholder(null);
                setIsPlaceholderModalOpen(true);
              }}
              className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-500 rounded-lg shadow-sm transition-colors cursor-pointer shrink-0"
              title="Add a new custom dynamic placeholder tag for Word documents"
            >
              <Plus className="w-4 h-4" />
              <span>+ New Placeholder</span>
            </button>
          </div>
        </div>

        {statusMsg && (
          <div
            className={`mt-4 p-3 border rounded-lg text-xs flex items-center gap-2 animate-in fade-in ${
              statusMsg.type === 'success'
                ? 'bg-green-500/10 border-green-500/20 text-green-400'
                : 'bg-red-500/10 border-red-500/20 text-red-400'
            }`}
          >
            {statusMsg.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-green-400 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
            )}
            <span>{statusMsg.text}</span>
          </div>
        )}
      </div>

      {/* Collapsible Template Configuration Panel */}
      {showConfigSettings && (
        <div className="bg-[#141414] rounded-xl border border-[#222] p-5 shadow-xs animate-in fade-in">
          <div className="flex items-center justify-between pb-3 mb-4 border-b border-[#222]">
            <h3 className="text-xs font-mono font-bold text-gray-300 uppercase tracking-wider flex items-center gap-2">
              <Sliders className="w-4 h-4 text-blue-400" />
              Word Template Properties & Header Settings
            </h3>
            <button
              onClick={() => setShowConfigSettings(false)}
              className="text-xs text-gray-500 hover:text-gray-300"
            >
              Close Config
            </button>
          </div>

          <form onSubmit={handleSaveConfig} className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-300 mb-1">
                Active Word Template File Name
              </label>
              <input
                type="text"
                value={templateName}
                onChange={(e) => setTemplateName(e.target.value)}
                className="w-full text-xs px-3 py-2 bg-[#1A1A1A] border border-[#333] text-gray-200 rounded-lg focus:outline-hidden focus:border-blue-500 font-mono"
                placeholder="Official_Material_Reference_Template_v2.docx"
              />
              <p className="text-[11px] text-gray-500 mt-1 font-mono">
                Master template folder: <span className="text-gray-400">ReferenceTracker_Data/templates/</span>
              </p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-300 mb-1">
                Organization / Company Header
              </label>
              <input
                type="text"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                className="w-full text-xs px-3 py-2 bg-[#1A1A1A] border border-[#333] text-gray-200 rounded-lg focus:outline-hidden focus:border-blue-500"
                placeholder="Precision Industrial Manufacturing Corp."
              />
              <p className="text-[11px] text-gray-500 mt-1">
                Used in <code className="text-blue-400 font-mono">{"{{companyName}}"}</code> header
              </p>
            </div>

            <div className="md:col-span-2 pt-2 flex items-center justify-end">
              <button
                type="submit"
                className="px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-500 rounded-lg shadow-sm transition-colors"
              >
                Save Configuration
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Main Grid: Side-by-Side Dual-Pane Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* Left Pane: Placeholders Explorer & Mapping Controls */}
        {(layoutMode === 'split' || layoutMode === 'placeholders-focused') && (
          <div
            className={`${
              layoutMode === 'split' ? 'lg:col-span-5' : 'lg:col-span-12'
            } bg-[#141414] rounded-xl border border-[#222] p-5 shadow-xs flex flex-col space-y-4`}
          >
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-[#222]">
              <div>
                <div className="flex items-center gap-2">
                  <Tag className="w-4 h-4 text-blue-400" />
                  <h3 className="text-xs font-mono font-bold text-gray-200 uppercase tracking-wider">
                    Placeholders & Mapping Dictionary
                  </h3>
                  <span className="text-[10px] font-mono bg-[#222] text-gray-300 px-2 py-0.5 rounded-full border border-[#333]">
                    {allPlaceholders.length} tags
                  </span>
                </div>
                <p className="text-[11px] text-gray-400 mt-0.5">
                  Hover or click any tag to highlight its mapped field on the preview.
                </p>
              </div>

              {/* + New Placeholder */}
              <button
                type="button"
                onClick={() => {
                  setEditingPlaceholder(null);
                  setIsPlaceholderModalOpen(true);
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-500 rounded-lg shadow-sm transition-colors cursor-pointer shrink-0"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>+ New Tag</span>
              </button>
            </div>

            {/* Search, Live Evaluation & Category Filter */}
            <div className="space-y-2.5">
              <div className="flex flex-col sm:flex-row items-center gap-2">
                <div className="relative flex-1 w-full">
                  <Search className="w-3.5 h-3.5 text-gray-500 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    placeholder="Search placeholder tags (e.g. {{productCode}}, revision)..."
                    value={placeholderSearch}
                    onChange={(e) => setPlaceholderSearch(e.target.value)}
                    className="w-full text-xs pl-8 pr-3 py-1.5 bg-[#1A1A1A] border border-[#333] text-gray-200 rounded-lg focus:outline-hidden focus:border-blue-500 font-mono"
                  />
                  {placeholderSearch && (
                    <button
                      onClick={() => setPlaceholderSearch('')}
                      className="absolute right-2.5 top-2 text-gray-500 hover:text-gray-300 text-xs"
                    >
                      ×
                    </button>
                  )}
                </div>

                {/* Toggle Live Evaluated Values */}
                <button
                  type="button"
                  onClick={() => setShowLiveEvaluatedValues(!showLiveEvaluatedValues)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg border transition-colors shrink-0 ${
                    showLiveEvaluatedValues
                      ? 'bg-blue-600/20 text-blue-300 border-blue-500/40'
                      : 'bg-[#1A1A1A] text-gray-400 hover:text-white border-[#333]'
                  }`}
                  title="Toggle between tag description and actual live evaluated sample value"
                >
                  <Eye className="w-3.5 h-3.5" />
                  <span className="text-xs">{showLiveEvaluatedValues ? 'Live Values' : 'Descriptions'}</span>
                </button>
              </div>

              {/* Category Filter Pills */}
              <div className="flex flex-wrap items-center gap-1.5 text-xs">
                <span className="text-[11px] font-mono text-gray-500 mr-1">Filter:</span>
                {[
                  { id: 'ALL', label: `All (${categoryCounts.ALL || 0})` },
                  { id: 'MASTER', label: `Master (${categoryCounts.MASTER || 0})` },
                  { id: 'REGISTRATION', label: `QA (${categoryCounts.REGISTRATION || 0})` },
                  { id: 'SIGN-OFF', label: `Sign-off (${categoryCounts['SIGN-OFF'] || 0})` },
                  { id: 'SYSTEM', label: `System (${categoryCounts.SYSTEM || 0})` },
                  { id: 'CUSTOMFIELD', label: `Custom Fields (${categoryCounts.CUSTOMFIELD || 0})` },
                  { id: 'CUSTOM', label: `Custom (${categoryCounts.CUSTOM || 0})` }
                ].map((pill) => (
                  <button
                    key={pill.id}
                    type="button"
                    onClick={() => setSelectedCategory(pill.id)}
                    className={`text-[11px] px-2 py-1 rounded-md transition-all font-mono ${
                      selectedCategory === pill.id
                        ? 'bg-blue-600 text-white font-bold shadow-xs'
                        : 'bg-[#1A1A1A] text-gray-400 hover:text-white border border-[#2E2E2E]'
                    }`}
                  >
                    {pill.label}
                  </button>
                ))}

                <div className="ml-auto flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleCopyAllPlaceholders}
                    className="text-[10px] text-blue-400 hover:text-blue-300 flex items-center gap-1 font-mono transition-colors bg-[#1A1A1A] px-2 py-1 rounded border border-blue-500/30"
                    title="Copy all placeholder tags list to clipboard to paste into Word template"
                  >
                    <Copy className="w-3 h-3" /> Copy All
                  </button>
                  <button
                    type="button"
                    onClick={handleResetPlaceholders}
                    className="text-[10px] text-gray-500 hover:text-gray-300 flex items-center gap-1 font-mono transition-colors"
                    title="Reset placeholder list to default system set"
                  >
                    <RotateCcw className="w-3 h-3" /> Reset
                  </button>
                </div>
              </div>
            </div>

            {/* Placeholders List with Interactive Hover / Select */}
            <div className="space-y-2 max-h-[620px] overflow-y-auto pr-1">
              {filteredPlaceholders.length === 0 ? (
                <div className="p-8 text-center bg-[#181818] rounded-xl border border-[#2A2A2A] space-y-3">
                  <Tag className="w-8 h-8 text-gray-600 mx-auto" />
                  <p className="text-xs text-gray-400">No placeholders match "{placeholderSearch}".</p>
                  <button
                    type="button"
                    onClick={() => {
                      setEditingPlaceholder(null);
                      setIsPlaceholderModalOpen(true);
                    }}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold bg-blue-600 text-white rounded-lg hover:bg-blue-500"
                  >
                    <Plus className="w-3.5 h-3.5" /> Add New Placeholder
                  </button>
                </div>
              ) : (
                filteredPlaceholders.map((item) => {
                  const isCopied = copiedKey === item.tag;
                  const evaluatedVal = evaluatePlaceholderValue(item);
                  const isCustom = item.isCustom || !item.isSystem;
                  const isSelected = selectedTag === item.tag;
                  const isHovered = hoveredTag === item.tag;

                  return (
                    <div
                      key={item.id || item.tag}
                      onMouseEnter={() => setHoveredTag(item.tag)}
                      onMouseLeave={() => setHoveredTag(null)}
                      onClick={() => setSelectedTag(selectedTag === item.tag ? null : item.tag)}
                      className={`p-3 bg-[#1A1A1A] hover:bg-[#202020] border rounded-xl transition-all text-xs cursor-pointer group relative ${
                        isSelected
                          ? 'border-amber-400 bg-amber-950/20 ring-1 ring-amber-400/50'
                          : isHovered
                          ? 'border-blue-500/60 bg-[#162033]'
                          : isCopied
                          ? 'border-green-500/50 bg-[#162319]'
                          : 'border-[#2A2A2A]'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <code className="font-mono font-bold text-blue-400 text-xs px-2 py-0.5 rounded bg-[#10192A] border border-blue-500/30 select-all">
                              {item.tag}
                            </code>

                            {item.label && item.label !== item.tag && (
                              <span className="font-semibold text-gray-200 truncate">
                                {item.label}
                              </span>
                            )}

                            <span
                              className={`text-[9px] font-mono px-1.5 py-0.5 rounded border uppercase ${
                                isCustom
                                  ? 'bg-amber-500/10 text-amber-300 border-amber-500/30'
                                  : 'bg-slate-800 text-slate-400 border-slate-700'
                              }`}
                            >
                              {item.category || (isCustom ? 'Custom' : 'System')}
                            </span>
                          </div>

                          {/* Live Evaluated Sample Value or Description */}
                          {showLiveEvaluatedValues ? (
                            <div className="mt-1.5 p-1.5 bg-[#0D1117] rounded border border-blue-900/40 text-[11px] font-mono text-emerald-400 flex items-center gap-1.5">
                              <span className="text-gray-500 text-[10px]">Value:</span>
                              <span className="font-bold truncate">{evaluatedVal}</span>
                            </div>
                          ) : (
                            <p className="text-[11px] text-gray-400 mt-1 leading-snug">
                              {item.desc}
                            </p>
                          )}
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-1 shrink-0 pt-0.5" onClick={(e) => e.stopPropagation()}>
                          {/* Copy Button */}
                          <button
                            type="button"
                            onClick={() => handleCopy(item.tag)}
                            className={`p-1.5 rounded-md border text-xs font-mono transition-colors flex items-center gap-1 ${
                              isCopied
                                ? 'bg-green-500/20 text-green-400 border-green-500/40'
                                : 'bg-[#222] text-gray-400 hover:text-white border-[#333]'
                            }`}
                            title="Copy placeholder tag"
                          >
                            {isCopied ? (
                              <>
                                <Check className="w-3.5 h-3.5 text-green-400" />
                                <span className="text-[10px] text-green-400 font-bold">Copied!</span>
                              </>
                            ) : (
                              <>
                                <Copy className="w-3.5 h-3.5" />
                                <span className="text-[10px] hidden sm:inline">Copy</span>
                              </>
                            )}
                          </button>

                          {/* Edit for custom */}
                          {isCustom && (
                            <button
                              type="button"
                              onClick={() => {
                                setEditingPlaceholder(item);
                                setIsPlaceholderModalOpen(true);
                              }}
                              className="p-1.5 bg-[#222] hover:bg-[#2A2A2A] text-gray-400 hover:text-blue-400 border border-[#333] rounded-md transition-colors"
                              title="Edit custom placeholder"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                          )}

                          {/* Delete for custom */}
                          {isCustom && (
                            <button
                              type="button"
                              onClick={() => {
                                if (window.confirm(`Delete placeholder "${item.tag}"?`)) {
                                  handleDeletePlaceholder(item.id);
                                }
                              }}
                              className="p-1.5 bg-[#222] hover:bg-red-500/20 text-gray-400 hover:text-red-400 border border-[#333] hover:border-red-500/30 rounded-md transition-colors"
                              title="Delete custom placeholder"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Quick guide footnote */}
            <div className="pt-3 border-t border-[#222] flex items-center justify-between text-[11px] text-gray-400">
              <span className="flex items-center gap-1.5">
                <HelpCircle className="w-3.5 h-3.5 text-blue-400" />
                <span>Clicking a tag highlights it directly on the Word preview</span>
              </span>
              <span className="font-mono text-gray-500 text-[10px]">
                {filteredPlaceholders.length} shown of {allPlaceholders.length}
              </span>
            </div>
          </div>
        )}

        {/* Right Pane: Visual Side-by-Side Word Template (.docx) Document Preview */}
        {(layoutMode === 'split' || layoutMode === 'preview-focused') && (
          <div
            className={`${
              layoutMode === 'split' ? 'lg:col-span-7' : 'lg:col-span-12'
            } h-full min-h-[680px]`}
          >
            <WordTemplateDocPreview
              registration={selectedReg}
              masterItem={selectedMaster}
              config={config}
              allPlaceholders={allPlaceholders}
              hoveredTag={hoveredTag}
              selectedTag={selectedTag}
              onSelectTag={(tag) => setSelectedTag(tag)}
              viewMode={docViewMode}
              onViewModeChange={(mode) => setDocViewMode(mode)}
              showHighlightTags={showHighlightTags}
              onToggleHighlightTags={() => setShowHighlightTags(!showHighlightTags)}
              registrations={registrations}
              onSelectRegistration={(id) => setSelectedRegId(id)}
              onDownloadDocx={handleGenerateTestForm}
              isGenerating={isGeneratingTest}
            />
          </div>
        )}
      </div>

      {/* Modal for adding/editing placeholder */}
      <NewPlaceholderModal
        isOpen={isPlaceholderModalOpen}
        onClose={() => {
          setIsPlaceholderModalOpen(false);
          setEditingPlaceholder(null);
        }}
        onSavePlaceholder={handleSavePlaceholder}
        editingPlaceholder={editingPlaceholder}
        existingTags={allPlaceholders.map((p) => p.tag)}
        customFields={config.customFields}
      />
    </div>
  );
};
