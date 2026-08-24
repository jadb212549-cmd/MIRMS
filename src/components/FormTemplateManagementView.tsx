import React, { useState, useEffect, useRef } from 'react';
import { renderAsync } from 'docx-preview';
import {
  FormTemplate,
  FormType,
  SystemFieldOption,
  AppConfig,
  MasterItem,
  ReferenceRegistration,
  PdfCoordinateMapping
} from '../types';
import {
  db
} from '../services/db';
import {
  SYSTEM_FIELD_OPTIONS,
  DEFAULT_TEMPLATES,
  renderHtmlTemplateWithData,
  buildSystemDataDictionary
} from '../services/templateDefaults';
import {
  userService
} from '../services/userService';
import {
  pdfService
} from '../services/pdfService';
import { PdfViewer } from './PdfViewer';
import {
  LayoutTemplate,
  Plus,
  Upload,
  CheckCircle2,
  AlertCircle,
  FileText,
  Code,
  FileSpreadsheet,
  Copy,
  Trash2,
  Edit3,
  Eye,
  Download,
  RotateCcw,
  Sparkles,
  Search,
  Tag,
  Check,
  X,
  HelpCircle,
  ShieldAlert,
  ArrowRight,
  Printer,
  ChevronDown
} from 'lucide-react';

interface FormTemplateManagementViewProps {
  config: AppConfig;
  masterItems?: MasterItem[];
  registrations?: ReferenceRegistration[];
  onNotify?: (title: string, message: string, type?: 'info' | 'success' | 'warning') => void;
}

const DocxModalPreview: React.FC<{
  template: FormTemplate;
  config: AppConfig;
  sampleDict: Record<string, string>;
}> = ({ template, config, sampleDict }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isRendering, setIsRendering] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    const render = async () => {
      if (!containerRef.current || !template.fileContent) {
        setIsRendering(false);
        return;
      }
      setIsRendering(true);
      setError(null);
      containerRef.current.innerHTML = '';

      try {
        const binaryString = atob(template.fileContent);
        const len = binaryString.length;
        const bytes = new Uint8Array(len);
        for (let i = 0; i < len; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }
        const blob = new Blob([bytes.buffer], {
          type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
        });

        await renderAsync(blob, containerRef.current, undefined, {
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
      } catch (err: any) {
        console.error('Error rendering template docx preview:', err);
        if (isMounted) setError(err?.message || 'Failed to render DOCX preview');
      } finally {
        if (isMounted) setIsRendering(false);
      }
    };

    render();

    return () => {
      isMounted = false;
    };
  }, [template.id, template.fileContent]);

  return (
    <div className="w-full flex flex-col items-center">
      {isRendering && (
        <div className="flex items-center gap-2 text-xs text-blue-400 font-mono py-4">
          <Sparkles className="w-4 h-4 animate-spin" />
          <span>Rendering Word document...</span>
        </div>
      )}
      {error && (
        <div className="p-3 bg-red-500/10 border border-red-500/30 text-red-300 text-xs rounded-lg mb-4">
          {error}
        </div>
      )}
      <div className="docx-preview-container w-full flex flex-col items-center">
        <div ref={containerRef} className="w-full flex flex-col items-center" />
      </div>
    </div>
  );
};

export const FormTemplateManagementView: React.FC<FormTemplateManagementViewProps> = ({
  config,
  masterItems = [],
  registrations = [],
  onNotify
}) => {
  const currentUser = userService.getCurrentUser();
  const isAdmin = currentUser?.role === 'admin';

  const [templates, setTemplates] = useState<FormTemplate[]>([]);
  const [selectedFormType, setSelectedFormType] = useState<FormType | 'ALL'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  // Modals
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isPreviewModalOpen, setIsPreviewModalOpen] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<FormTemplate | null>(null);

  // Import / Create Form State
  const [importFormType, setImportFormType] = useState<FormType>('material_reference_sheet');
  const [importName, setImportName] = useState('');
  const [importDescription, setImportDescription] = useState('');
  const [importVersion, setImportVersion] = useState('1.0');
  const [importFileType, setImportFileType] = useState<'docx' | 'html' | 'txt' | 'json' | 'pdf'>('html');
  const [importFileName, setImportFileName] = useState('');
  const [importFilePath, setImportFilePath] = useState('');
  const [importFileContent, setImportFileContent] = useState('');
  const [importCustomCss, setImportCustomCss] = useState('');
  const [importMappings, setImportMappings] = useState<Record<string, string>>({});
  const [setAsActiveOnSave, setSetAsActiveOnSave] = useState(true);
  const [isUploading, setIsUploading] = useState(false);

  // Sample data selection for preview
  const sampleReg = registrations[0] || null;
  const sampleMaster = sampleReg
    ? masterItems.find(m => m.productCode.toLowerCase() === sampleReg.productCode.toLowerCase()) || null
    : masterItems[0] || null;

  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadTemplates = async () => {
    setIsLoading(true);
    try {
      const list = await db.getFormTemplates();
      setTemplates(list);
    } catch (err) {
      console.error('Error loading form templates:', err);
      onNotify?.('Templates', 'Failed to load form templates', 'warning');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadTemplates();
  }, []);

  const [templateToDelete, setTemplateToDelete] = useState<FormTemplate | null>(null);
  const [isResetConfirmOpen, setIsResetConfirmOpen] = useState(false);

  // PDF mapping state variables
  const [pdfCoordinateMappings, setPdfCoordinateMappings] = useState<Record<string, PdfCoordinateMapping>>({});
  const [detectedPdfFormFields, setDetectedPdfFormFields] = useState<string[]>([]);
  const [pdfMappingTab, setPdfMappingTab] = useState<'forms' | 'coordinates'>('forms');

  useEffect(() => {
    if (importFileType === 'pdf' && importFileContent) {
      pdfService.parsePdfFormFields(importFileContent).then(fields => {
        setDetectedPdfFormFields(fields);
      }).catch(err => {
        console.warn('PDF parse failed:', err);
        setDetectedPdfFormFields([]);
      });
    } else {
      setDetectedPdfFormFields([]);
    }
  }, [importFileType, importFileContent]);

  // Filter templates
  const filteredTemplates = templates.filter(t => {
    const matchesType = selectedFormType === 'ALL' || t.formType === selectedFormType;
    const matchesSearch =
      t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (t.description && t.description.toLowerCase().includes(searchQuery.toLowerCase())) ||
      t.fileType.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesType && matchesSearch;
  });

  const activeRefTemplate = templates.find(t => t.formType === 'material_reference_sheet' && t.isActive);
  const activeProofTemplate = templates.find(t => t.formType === 'inspection_proof_slip' && t.isActive);

  // Handler: Set active template
  const handleSetActive = async (template: FormTemplate) => {
    if (!isAdmin) {
      onNotify?.('Permission Denied', 'Only administrators can change active form templates', 'warning');
      return;
    }

    try {
      await db.setActiveFormTemplate(
        template.id,
        template.formType,
        currentUser ? `${currentUser.shortName} (${currentUser.fullName})` : 'Administrator'
      );
      await loadTemplates();
      onNotify?.(
        'Active Template Changed',
        `"${template.name}" is now the active template for ${
          template.formType === 'material_reference_sheet'
            ? 'Material Reference Sheets'
            : 'Inspection Proof Slips'
        }.`,
        'success'
      );
    } catch (err) {
      console.error('Failed to set active template:', err);
      onNotify?.('Error', 'Failed to set active template', 'warning');
    }
  };

  // Handler: Duplicate template
  const handleDuplicate = async (template: FormTemplate) => {
    if (!isAdmin) {
      onNotify?.('Permission Denied', 'Only administrators can duplicate templates', 'warning');
      return;
    }

    try {
      const res = await db.duplicateFormTemplate(
        template.id,
        currentUser ? `${currentUser.shortName} (${currentUser.fullName})` : 'Administrator'
      );
      if (res.success && res.newTemplate) {
        await loadTemplates();
        onNotify?.('Template Duplicated', `Created copy "${res.newTemplate.name}"`, 'success');
      }
    } catch (err) {
      console.error('Failed to duplicate template:', err);
      onNotify?.('Error', 'Failed to duplicate template', 'warning');
    }
  };

  // Handler: Delete template
  const handleDelete = async (template: FormTemplate) => {
    if (!isAdmin) {
      onNotify?.('Permission Denied', 'Only administrators can delete templates', 'warning');
      return;
    }

    const sameTypeCount = templates.filter(t => t.formType === template.formType).length;
    if (sameTypeCount <= 1) {
      onNotify?.(
        'Cannot Delete Template',
        `At least one template must remain for ${
          template.formType === 'material_reference_sheet' ? 'Material Reference Sheets' : 'Inspection Proof Slips'
        }.`,
        'warning'
      );
      return;
    }

    setTemplateToDelete(template);
  };

  const handleConfirmDelete = async () => {
    if (!templateToDelete) return;

    try {
      const res = await db.deleteFormTemplate(
        templateToDelete.id,
        currentUser ? `${currentUser.shortName} (${currentUser.fullName})` : 'Administrator'
      );

      if (res && !res.success) {
        onNotify?.('Delete Error', res.message || 'Failed to delete template', 'warning');
        return;
      }

      await loadTemplates();

      if (selectedTemplate?.id === templateToDelete.id) {
        setIsPreviewModalOpen(false);
        setSelectedTemplate(null);
      }

      onNotify?.('Template Deleted', `Template "${templateToDelete.name}" was successfully removed.`, 'info');
    } catch (err: any) {
      console.error('Failed to delete template:', err);
      onNotify?.('Error', err?.message || 'Failed to delete template', 'warning');
    } finally {
      setTemplateToDelete(null);
    }
  };

  // Handler: Reset to factory defaults
  const handleResetDefaults = async () => {
    if (!isAdmin) {
      onNotify?.('Permission Denied', 'Only administrators can reset templates', 'warning');
      return;
    }
    setIsResetConfirmOpen(true);
  };

  const handleConfirmResetDefaults = async () => {
    try {
      await db.resetFormTemplates(
        currentUser ? `${currentUser.shortName} (${currentUser.fullName})` : 'Administrator'
      );
      await loadTemplates();
      onNotify?.('Templates Reset', 'System templates have been restored to defaults.', 'success');
    } catch (err) {
      console.error('Failed to reset templates:', err);
      onNotify?.('Error', 'Failed to reset templates', 'warning');
    } finally {
      setIsResetConfirmOpen(false);
    }
  };

  // Handler: File selection for import
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    const fileName = file.name;
    const filePath = (file as any).path || '';
    const extension = fileName.split('.').pop()?.toLowerCase() || '';

    setImportFileName(fileName);
    if (filePath) setImportFilePath(filePath);
    if (!importName) {
      setImportName(fileName.replace(/\.[^/.]+$/, '').replace(/[_-]/g, ' '));
    }

    const reader = new FileReader();

    if (extension === 'docx') {
      setImportFileType('docx');
      setImportFormType('material_reference_sheet');
      reader.onload = (event) => {
        const base64 = (event.target?.result as string).split(',')[1] || '';
        setImportFileContent(base64);
        setIsUploading(false);
        // Default docx placeholder mappings
        const autoMappings: Record<string, string> = {
          '{{productCode}}': 'productCode',
          '{{materialType}}': 'materialType',
          '{{category}}': 'category',
          '{{description}}': 'description',
          '{{supplier}}': 'supplier',
          '{{unit}}': 'unit',
          '{{registrationDate}}': 'registrationDate',
          '{{registeredBy}}': 'registeredBy',
          '{{revision}}': 'revision',
          '{{specification}}': 'specification',
          '{{remarks}}': 'remarks'
        };
        setImportMappings(autoMappings);
      };
      reader.readAsDataURL(file);
    } else if (extension === 'pdf') {
      setImportFileType('pdf');
      setImportFormType('material_reference_sheet');
      reader.onload = (event) => {
        const base64 = (event.target?.result as string).split(',')[1] || '';
        setImportFileContent(base64);
        setIsUploading(false);
        const autoMappings: Record<string, string> = {
          '{{productCode}}': 'productCode',
          '{{materialType}}': 'materialType',
          '{{category}}': 'category',
          '{{description}}': 'description',
          '{{supplier}}': 'supplier',
          '{{unit}}': 'unit',
          '{{registrationDate}}': 'registrationDate',
          '{{registeredBy}}': 'registeredBy',
          '{{revision}}': 'revision',
          '{{specification}}': 'specification',
          '{{remarks}}': 'remarks'
        };
        setImportMappings(autoMappings);
      };
      reader.readAsDataURL(file);
    } else {
      // HTML or TXT
      if (extension === 'txt') {
        setImportFileType('txt');
      } else {
        setImportFileType('html');
      }

      reader.onload = (event) => {
        const textContent = (event.target?.result as string) || '';
        setImportFileContent(textContent);
        setIsUploading(false);

        // Scan for {{tags}} in the text content
        const detectedTags = textContent.match(/\{\{([a-zA-Z0-9_]+)\}\}/g) || [];
        const uniqueTags = Array.from(new Set(detectedTags));
        
        const detectedMappings: Record<string, string> = {};
        uniqueTags.forEach(tag => {
          const rawKey = tag.replace(/[{}]/g, '');
          // Fuzzy match to standard system field keys
          const matchedOpt = SYSTEM_FIELD_OPTIONS.find(
            opt => opt.key.toLowerCase() === rawKey.toLowerCase() ||
                   opt.tag.toLowerCase() === tag.toLowerCase() ||
                   opt.label.toLowerCase().replace(/[^a-z0-9]/g, '') === rawKey.toLowerCase().replace(/[^a-z0-9]/g, '')
          );
          if (matchedOpt) {
            detectedMappings[tag] = matchedOpt.key;
          } else {
            detectedMappings[tag] = rawKey;
          }
        });

        setImportMappings(detectedMappings);
      };
      reader.readAsText(file);
    }
  };

  // Handler: Save new imported template
  const handleSaveImport = async () => {
    if (!isAdmin) {
      onNotify?.('Permission Denied', 'Only administrators can save templates', 'warning');
      return;
    }

    if (!importName.trim()) {
      onNotify?.('Validation', 'Please provide a name for this template', 'warning');
      return;
    }

    if (!importFileContent) {
      onNotify?.('Validation', 'Please upload a template file', 'warning');
      return;
    }

    try {
      const newTemplate: FormTemplate = {
        id: `tpl-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
        name: importName.trim(),
        description: importDescription.trim(),
        formType: importFormType,
        version: importVersion.trim() || '1.0',
        isActive: setAsActiveOnSave,
        fileType: importFileType,
        fileName: importFileName,
        filePath: importFilePath || undefined,
        fileContent: importFileContent,
        customCss: importCustomCss,
        fieldMappings: importMappings,
        pdfCoordinateMappings: Object.keys(pdfCoordinateMappings).length > 0 ? pdfCoordinateMappings : undefined,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        createdBy: currentUser ? `${currentUser.shortName} (${currentUser.fullName})` : 'Administrator',
        isBuiltIn: false
      };

      await db.saveFormTemplate(newTemplate);
      if (setAsActiveOnSave) {
        await db.setActiveFormTemplate(
          newTemplate.id,
          newTemplate.formType,
          currentUser ? `${currentUser.shortName} (${currentUser.fullName})` : 'Administrator'
        );
      }

      await loadTemplates();
      setIsImportModalOpen(false);
      resetImportForm();
      onNotify?.('Template Saved', `Template "${newTemplate.name}" was imported successfully.`, 'success');
    } catch (err) {
      console.error('Failed to save imported template:', err);
      onNotify?.('Error', 'Failed to save template', 'warning');
    }
  };

  // Reset import form
  const resetImportForm = () => {
    setImportName('');
    setImportDescription('');
    setImportVersion('1.0');
    setImportFileType('html');
    setImportFileName('');
    setImportFileContent('');
    setImportCustomCss('');
    setImportMappings({});
    setPdfCoordinateMappings({});
    setSetAsActiveOnSave(true);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // Handler: Open edit modal
  const handleOpenEdit = (template: FormTemplate) => {
    setSelectedTemplate(template);
    setImportName(template.name);
    setImportDescription(template.description || '');
    setImportVersion(template.version);
    setImportFormType(template.formType);
    setImportFileType(template.fileType);
    setImportFileName(template.fileName || '');
    setImportFileContent(template.fileContent || '');
    setImportCustomCss(template.customCss || '');
    setImportMappings({ ...template.fieldMappings });
    setPdfCoordinateMappings(template.pdfCoordinateMappings || {});
    setIsEditModalOpen(true);
  };

  // Handler: Save edited template
  const handleSaveEdit = async () => {
    if (!isAdmin || !selectedTemplate) return;

    try {
      const updatedTemplate: FormTemplate = {
        ...selectedTemplate,
        name: importName.trim(),
        description: importDescription.trim(),
        version: importVersion.trim() || '1.0',
        formType: importFormType,
        fileType: importFileType,
        fileName: importFileName,
        fileContent: importFileContent,
        customCss: importCustomCss,
        fieldMappings: importMappings,
        pdfCoordinateMappings: Object.keys(pdfCoordinateMappings).length > 0 ? pdfCoordinateMappings : undefined,
        updatedAt: new Date().toISOString()
      };

      await db.saveFormTemplate(updatedTemplate);
      await loadTemplates();
      setIsEditModalOpen(false);
      setSelectedTemplate(null);
      resetImportForm();
      onNotify?.('Template Updated', `Template "${updatedTemplate.name}" was updated successfully.`, 'success');
    } catch (err) {
      console.error('Failed to update template:', err);
      onNotify?.('Error', 'Failed to update template', 'warning');
    }
  };

  // Handler: Open preview modal
  const handleOpenPreview = (template: FormTemplate) => {
    setSelectedTemplate(template);
    setIsPreviewModalOpen(true);
  };

  // Download template file
  const handleDownloadTemplate = (template: FormTemplate) => {
    if (!template.fileContent) {
      onNotify?.('Download', 'Template has no file content to export', 'warning');
      return;
    }

    try {
      let mimeType = 'text/html';
      let extension = template.fileType || 'html';

      if (template.fileType === 'pdf') {
        pdfService.downloadPdfFromBase64(template.fileContent, template.fileName || `${template.name.replace(/\s+/g, '_')}.pdf`);
        return;
      }

      if (template.fileType === 'docx') {
        const byteCharacters = atob(template.fileContent);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
          byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        const blob = new Blob([byteArray], {
          type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
        });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = template.fileName || `${template.name.replace(/\s+/g, '_')}.docx`;
        a.click();
        URL.revokeObjectURL(url);
        return;
      }

      if (template.fileType === 'txt') mimeType = 'text/plain';
      if (template.fileType === 'json') mimeType = 'application/json';

      const blob = new Blob([template.fileContent], { type: mimeType });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = template.fileName || `${template.name.replace(/\s+/g, '_')}.${extension}`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error('Failed to download template:', e);
      onNotify?.('Download Error', 'Could not export template file', 'warning');
    }
  };

  // Build sample preview HTML
  const sampleDict = buildSystemDataDictionary(sampleReg, sampleMaster, config);
  const previewHtml = selectedTemplate && selectedTemplate.fileContent
    ? renderHtmlTemplateWithData(
        selectedTemplate.fileContent,
        sampleDict,
        selectedTemplate.fieldMappings,
        selectedTemplate.customCss
      )
    : null;

  return (
    <div className="space-y-6 animate-in fade-in duration-150">
      {/* Top Banner / Header */}
      <div className="bg-[#121212] border border-[#2A2A2A] rounded-2xl p-5 shadow-xl">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className="p-3 bg-blue-500/10 border border-blue-500/30 rounded-xl text-blue-400 shrink-0">
              <LayoutTemplate className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-white tracking-tight">
                  Form Template Management
                </h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-blue-500/10 text-blue-300 border border-blue-500/30">
                  ADMIN CONFIG
                </span>
              </div>
              <p className="text-xs text-gray-400 mt-1 max-w-2xl leading-relaxed">
                Import, configure, and assign the active templates used for generating 
                <strong className="text-gray-200"> Material Reference Sheets</strong> and 
                <strong className="text-gray-200"> QA Inspection Proof Slips</strong>. Configure dynamic field placeholders and instant live preview.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            {isAdmin && (
              <>
                <button
                  onClick={handleResetDefaults}
                  className="px-3 py-2 text-xs font-semibold bg-[#1E1E1E] hover:bg-[#282828] text-gray-300 rounded-xl border border-[#333] transition-all flex items-center gap-1.5 cursor-pointer"
                  title="Reset to default factory templates"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Restore Defaults</span>
                </button>
                <button
                  onClick={() => {
                    resetImportForm();
                    setIsImportModalOpen(true);
                  }}
                  className="px-4 py-2 text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white rounded-xl shadow-lg hover:shadow-blue-600/30 transition-all flex items-center gap-2 cursor-pointer active:scale-98"
                >
                  <Upload className="w-4 h-4" />
                  <span>Import / New Template</span>
                </button>
              </>
            )}
          </div>
        </div>

        {/* Current Active Status Highlights */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 mt-5 pt-4 border-t border-[#222]">
          {/* Active Material Reference Sheet */}
          <div className="bg-[#181818] border border-[#2D2D2D] rounded-xl p-3.5 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="p-2 bg-blue-500/10 text-blue-400 rounded-lg shrink-0">
                <FileSpreadsheet className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <div className="text-[10px] font-mono font-bold uppercase tracking-wider text-gray-400">
                  Active Reference Sheet Template
                </div>
                <div className="text-sm font-bold text-white truncate flex items-center gap-2 mt-0.5">
                  <span>{activeRefTemplate ? activeRefTemplate.name : 'System Default (.docx)'}</span>
                  <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-normal">
                    ACTIVE
                  </span>
                </div>
                <div className="text-[11px] text-gray-500 font-mono mt-0.5">
                  Format: {activeRefTemplate?.fileType.toUpperCase() || 'DOCX'} • v{activeRefTemplate?.version || '1.0'}
                </div>
              </div>
            </div>
            {activeRefTemplate && (
              <button
                onClick={() => handleOpenPreview(activeRefTemplate)}
                className="px-2.5 py-1.5 text-xs font-mono bg-[#242424] hover:bg-blue-600 hover:text-white text-gray-300 rounded-lg border border-[#3A3A3A] transition-all flex items-center gap-1 shrink-0"
              >
                <Eye className="w-3.5 h-3.5" />
                <span>Preview</span>
              </button>
            )}
          </div>

          {/* Active Inspection Proof Slip */}
          <div className="bg-[#181818] border border-[#2D2D2D] rounded-xl p-3.5 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="p-2 bg-emerald-500/10 text-emerald-400 rounded-lg shrink-0">
                <Printer className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <div className="text-[10px] font-mono font-bold uppercase tracking-wider text-gray-400">
                  Active Proof Slip Template
                </div>
                <div className="text-sm font-bold text-white truncate flex items-center gap-2 mt-0.5">
                  <span>{activeProofTemplate ? activeProofTemplate.name : 'System Slip Standard (HTML)'}</span>
                  <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-normal">
                    ACTIVE
                  </span>
                </div>
                <div className="text-[11px] text-gray-500 font-mono mt-0.5">
                  Format: {activeProofTemplate?.fileType.toUpperCase() || 'HTML'} • v{activeProofTemplate?.version || '1.0'}
                </div>
              </div>
            </div>
            {activeProofTemplate && (
              <button
                onClick={() => handleOpenPreview(activeProofTemplate)}
                className="px-2.5 py-1.5 text-xs font-mono bg-[#242424] hover:bg-emerald-600 hover:text-white text-gray-300 rounded-lg border border-[#3A3A3A] transition-all flex items-center gap-1 shrink-0"
              >
                <Eye className="w-3.5 h-3.5" />
                <span>Preview</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
        {/* Form Type Tabs */}
        <div className="flex items-center gap-1 bg-[#141414] p-1 rounded-xl border border-[#2A2A2A] w-full sm:w-auto">
          <button
            onClick={() => setSelectedFormType('ALL')}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all ${
              selectedFormType === 'ALL'
                ? 'bg-blue-600 text-white font-semibold shadow-xs'
                : 'text-gray-400 hover:text-white hover:bg-[#1E1E1E]'
            }`}
          >
            All Templates ({templates.length})
          </button>
          <button
            onClick={() => setSelectedFormType('material_reference_sheet')}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all flex items-center gap-1.5 ${
              selectedFormType === 'material_reference_sheet'
                ? 'bg-blue-600 text-white font-semibold shadow-xs'
                : 'text-gray-400 hover:text-white hover:bg-[#1E1E1E]'
            }`}
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            <span>Material Reference Sheets</span>
          </button>
          <button
            onClick={() => setSelectedFormType('inspection_proof_slip')}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all flex items-center gap-1.5 ${
              selectedFormType === 'inspection_proof_slip'
                ? 'bg-blue-600 text-white font-semibold shadow-xs'
                : 'text-gray-400 hover:text-white hover:bg-[#1E1E1E]'
            }`}
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Inspection Proof Slips</span>
          </button>
        </div>

        {/* Search Bar */}
        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search templates..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 text-xs bg-[#161616] border border-[#2F2F2F] text-gray-200 placeholder-gray-500 rounded-xl focus:outline-hidden focus:border-blue-500 transition-all font-mono"
          />
        </div>
      </div>

      {/* Templates List Grid */}
      {isLoading ? (
        <div className="p-12 text-center text-gray-400 font-mono text-xs">
          Loading form templates...
        </div>
      ) : filteredTemplates.length === 0 ? (
        <div className="bg-[#121212] border border-[#2A2A2A] rounded-2xl p-12 text-center">
          <LayoutTemplate className="w-10 h-10 text-gray-600 mx-auto mb-3" />
          <h3 className="text-sm font-bold text-gray-300">No form templates found</h3>
          <p className="text-xs text-gray-500 mt-1 max-w-sm mx-auto">
            {searchQuery
              ? 'No templates match your search query. Try clearing the search.'
              : 'Import an external form template or restore default templates.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredTemplates.map((template) => {
            const isRef = template.formType === 'material_reference_sheet';
            const mappedCount = Object.keys(template.fieldMappings || {}).length;

            return (
              <div
                key={template.id}
                className={`bg-[#141414] border rounded-2xl p-4.5 flex flex-col justify-between transition-all group ${
                  template.isActive
                    ? 'border-emerald-500/50 shadow-lg shadow-emerald-500/5 ring-1 ring-emerald-500/20'
                    : 'border-[#282828] hover:border-[#3A3A3A] hover:bg-[#171717]'
                }`}
              >
                {/* Card Top Header */}
                <div>
                  <div className="flex items-start justify-between gap-2 mb-2.5">
                    <div className="flex items-center gap-2">
                      <span
                        className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full border ${
                          isRef
                            ? 'bg-blue-500/10 text-blue-400 border-blue-500/20'
                            : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                        }`}
                      >
                        {isRef ? 'Reference Sheet' : 'Proof Slip'}
                      </span>
                      <span
                        className={`text-[10px] font-mono px-1.5 py-0.2 rounded uppercase border ${
                          template.fileType === 'pdf'
                            ? 'bg-red-500/10 text-red-400 border-red-500/30 font-bold'
                            : 'bg-[#222] text-gray-400 border-[#333]'
                        }`}
                      >
                        {template.fileType}
                      </span>
                    </div>

                    {template.isActive ? (
                      <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-md bg-emerald-500 text-slate-950 flex items-center gap-1 shadow-xs">
                        <Check className="w-3 h-3 stroke-[3]" />
                        ACTIVE
                      </span>
                    ) : (
                      isAdmin && (
                        <button
                          onClick={() => handleSetActive(template)}
                          className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#202020] hover:bg-blue-600 text-gray-400 hover:text-white border border-[#333] transition-all cursor-pointer"
                        >
                          Set as Active
                        </button>
                      )
                    )}
                  </div>

                  {/* Title & Description */}
                  <h3 className="text-sm font-bold text-white group-hover:text-blue-300 transition-colors line-clamp-1">
                    {template.name}
                  </h3>
                  <p className="text-xs text-gray-400 mt-1 line-clamp-2 min-h-[32px] leading-relaxed">
                    {template.description || 'Custom configured form template for system generation.'}
                  </p>

                  {/* Template Meta Badges */}
                  <div className="flex flex-wrap items-center gap-2 mt-3 pt-3 border-t border-[#222] text-[10px] font-mono text-gray-400">
                    <span className="bg-[#1C1C1C] px-2 py-0.5 rounded border border-[#2A2A2A]">
                      v{template.version}
                    </span>
                    <span className="bg-[#1C1C1C] px-2 py-0.5 rounded border border-[#2A2A2A]">
                      {mappedCount} Mapped {mappedCount === 1 ? 'Field' : 'Fields'}
                    </span>
                    {template.isBuiltIn && (
                      <span className="bg-amber-500/10 text-amber-400 border border-amber-500/20 px-2 py-0.5 rounded">
                        Built-in Default
                      </span>
                    )}
                  </div>
                </div>

                {/* Card Actions Footer */}
                <div className="mt-4 pt-3 border-t border-[#222] flex items-center justify-between gap-1.5">
                  <button
                    onClick={() => handleOpenPreview(template)}
                    className="px-2.5 py-1.5 text-xs font-mono bg-[#1E1E1E] hover:bg-blue-600 hover:text-white text-gray-300 rounded-lg border border-[#303030] transition-all flex items-center gap-1 cursor-pointer"
                    title="Live Preview Template"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    <span>Preview</span>
                  </button>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => {
                        try {
                          pdfService.exportTemplateAsPdf(
                            template,
                            sampleDict,
                            `${template.name}_${sampleReg?.productCode || 'Sample'}`
                          );
                        } catch (err: any) {
                          onNotify?.('PDF Export', err.message || 'Failed to export PDF', 'warning');
                        }
                      }}
                      className="p-1.5 text-gray-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors cursor-pointer"
                      title="Export Form Sample as PDF"
                    >
                      <FileText className="w-3.5 h-3.5 text-red-400" />
                    </button>

                    <button
                      onClick={() => handleDownloadTemplate(template)}
                      className="p-1.5 text-gray-400 hover:text-white hover:bg-[#252525] rounded-lg transition-colors"
                      title="Download Original Template File"
                    >
                      <Download className="w-3.5 h-3.5" />
                    </button>

                    {isAdmin && (
                      <>
                        <button
                          onClick={() => handleDuplicate(template)}
                          className="p-1.5 text-gray-400 hover:text-white hover:bg-[#252525] rounded-lg transition-colors"
                          title="Duplicate Template"
                        >
                          <Copy className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleOpenEdit(template)}
                          className="p-1.5 text-gray-400 hover:text-blue-400 hover:bg-blue-500/10 rounded-lg transition-colors"
                          title="Edit Template & Mappings"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        {templates.filter(t => t.formType === template.formType).length > 1 && (
                          <button
                            onClick={() => handleDelete(template)}
                            className="p-1.5 text-gray-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                            title="Delete Template"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Available Placeholders Reference Guide Table */}
      <div className="bg-[#121212] border border-[#2A2A2A] rounded-2xl p-5 shadow-xl">
        <div className="flex items-center justify-between gap-3 mb-3">
          <div className="flex items-center gap-2">
            <Tag className="w-4 h-4 text-blue-400" />
            <h3 className="text-sm font-bold text-white">System Data Field & Placeholder Guide</h3>
          </div>
          <span className="text-[11px] text-gray-400 font-mono">
            {SYSTEM_FIELD_OPTIONS.length} Available Standard Placeholders
          </span>
        </div>
        <p className="text-xs text-gray-400 mb-4 leading-relaxed">
          When designing custom DOCX, HTML, or TXT forms, insert any of the tags below into your document. The system will automatically replace them with live material and QA data upon form generation or receipt slip printing.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 max-h-80 overflow-y-auto pr-1">
          {SYSTEM_FIELD_OPTIONS.map((opt) => (
            <div
              key={opt.key}
              className="p-2.5 rounded-xl bg-[#181818] border border-[#282828] hover:border-[#383838] transition-all flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between gap-1.5">
                  <code className="text-[11px] font-mono font-bold text-blue-300 bg-blue-500/10 px-1.5 py-0.5 rounded border border-blue-500/20">
                    {opt.tag}
                  </code>
                  <span className="text-[9px] font-mono text-gray-500 uppercase">
                    {opt.category}
                  </span>
                </div>
                <div className="text-xs font-semibold text-white mt-1.5">
                  {opt.label}
                </div>
                <p className="text-[11px] text-gray-400 mt-0.5 line-clamp-1">
                  {opt.description}
                </p>
              </div>
              <div className="mt-2 pt-1.5 border-t border-[#222] text-[10px] font-mono text-gray-500 truncate">
                Sample: <span className="text-gray-300">{opt.sampleValue}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Modal: Import / New Template */}
      {isImportModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-[#141414] rounded-2xl border border-[#333] w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden shadow-2xl animate-in zoom-in-95 duration-100">
            {/* Modal Header */}
            <div className="px-5 py-4 bg-[#0E0E0E] border-b border-[#252525] flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-blue-500/10 text-blue-400 rounded-lg">
                  <Upload className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">Import External Form Template</h3>
                  <p className="text-xs text-gray-400">Upload a DOCX, HTML, or TXT file and configure field mappings</p>
                </div>
              </div>
              <button
                onClick={() => setIsImportModalOpen(false)}
                className="p-1.5 text-gray-400 hover:text-white rounded-lg hover:bg-[#222] transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 space-y-4 overflow-y-auto flex-1 text-xs">
              {/* Form Type Selection */}
              <div>
                <label className="block text-xs font-semibold text-gray-300 mb-1.5">
                  Select Form Type <span className="text-red-400">*</span>
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setImportFormType('material_reference_sheet');
                      if (importFileType === 'txt') setImportFileType('html');
                    }}
                    className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                      importFormType === 'material_reference_sheet'
                        ? 'border-blue-500 bg-blue-500/10 text-white'
                        : 'border-[#2A2A2A] bg-[#1A1A1A] text-gray-400 hover:border-[#3A3A3A]'
                    }`}
                  >
                    <div className="font-bold flex items-center gap-1.5">
                      <FileSpreadsheet className="w-4 h-4 text-blue-400" />
                      <span>Material Reference Sheet</span>
                    </div>
                    <div className="text-[11px] text-gray-400 mt-1">
                      Full QA document for reference books & archiving (.docx, .html)
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setImportFormType('inspection_proof_slip')}
                    className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                      importFormType === 'inspection_proof_slip'
                        ? 'border-emerald-500 bg-emerald-500/10 text-white'
                        : 'border-[#2A2A2A] bg-[#1A1A1A] text-gray-400 hover:border-[#3A3A3A]'
                    }`}
                  >
                    <div className="font-bold flex items-center gap-1.5">
                      <Printer className="w-4 h-4 text-emerald-400" />
                      <span>Inspection Proof Slip</span>
                    </div>
                    <div className="text-[11px] text-gray-400 mt-1">
                      Printable receipt voucher / specimen slip (.html, .txt)
                    </div>
                  </button>
                </div>
              </div>

              {/* File Upload Box */}
              <div>
                <label className="block text-xs font-semibold text-gray-300 mb-1.5">
                  Upload Template File <span className="text-red-400">*</span>
                </label>
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed border-[#333] hover:border-blue-500 bg-[#181818] hover:bg-[#1C1C1C] rounded-xl p-5 text-center cursor-pointer transition-all"
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".docx,.html,.htm,.txt,.pdf"
                    onChange={handleFileSelect}
                    className="hidden"
                  />
                  <Upload className="w-8 h-8 text-gray-500 mx-auto mb-2" />
                  <p className="font-semibold text-gray-200">
                    {importFileName ? importFileName : 'Click to select or drag & drop template file'}
                  </p>
                  <p className="text-[11px] text-gray-500 mt-1">
                    {importFormType === 'material_reference_sheet'
                      ? 'Supported formats: Word (.docx), HTML (.html), PDF (.pdf)'
                      : 'Supported formats: HTML (.html), PDF (.pdf), Receipt Text (.txt)'}
                  </p>
                </div>
              </div>

              {/* Template Name & Version */}
              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2">
                  <label className="block text-xs font-semibold text-gray-300 mb-1">
                    Template Name <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Standard Plant A Reference Sheet"
                    value={importName}
                    onChange={(e) => setImportName(e.target.value)}
                    className="w-full px-3 py-2 bg-[#1A1A1A] border border-[#2F2F2F] rounded-xl text-white placeholder-gray-500 focus:outline-hidden focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-300 mb-1">
                    Version
                  </label>
                  <input
                    type="text"
                    placeholder="1.0"
                    value={importVersion}
                    onChange={(e) => setImportVersion(e.target.value)}
                    className="w-full px-3 py-2 bg-[#1A1A1A] border border-[#2F2F2F] rounded-xl text-white font-mono placeholder-gray-500 focus:outline-hidden focus:border-blue-500"
                  />
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="block text-xs font-semibold text-gray-300 mb-1">
                  Description / Purpose
                </label>
                <textarea
                  rows={2}
                  placeholder="Optional description of when this template should be used..."
                  value={importDescription}
                  onChange={(e) => setImportDescription(e.target.value)}
                  className="w-full px-3 py-2 bg-[#1A1A1A] border border-[#2F2F2F] rounded-xl text-white placeholder-gray-500 focus:outline-hidden focus:border-blue-500 resize-none"
                />
              </div>

              {/* Field Mappings Preview Table */}
              {importFileType === 'pdf' ? (
                <div className="space-y-4 border border-[#282828] rounded-2xl p-4 bg-[#111111]">
                  <div className="flex items-center justify-between border-b border-[#222] pb-2">
                    <div className="text-xs font-bold text-gray-300 uppercase tracking-wider">
                      PDF Document Field Mapper
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setPdfMappingTab('forms')}
                        className={`px-3 py-1 text-[10px] font-bold rounded-lg border transition-all cursor-pointer ${
                          pdfMappingTab === 'forms'
                            ? 'bg-blue-600/15 border-blue-500/35 text-blue-400'
                            : 'bg-transparent border-[#2F2F2F] text-gray-400 hover:text-white'
                        }`}
                      >
                        AcroForm Fields
                      </button>
                      <button
                        type="button"
                        onClick={() => setPdfMappingTab('coordinates')}
                        className={`px-3 py-1 text-[10px] font-bold rounded-lg border transition-all cursor-pointer ${
                          pdfMappingTab === 'coordinates'
                            ? 'bg-blue-600/15 border-blue-500/35 text-blue-400'
                            : 'bg-transparent border-[#2F2F2F] text-gray-400 hover:text-white'
                        }`}
                      >
                        Stamp Coordinates
                      </button>
                    </div>
                  </div>

                  {pdfMappingTab === 'forms' ? (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="text-gray-400 text-[10px]">
                          Map predefined PDF Form fields directly to dynamic database properties.
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            const fName = prompt('Enter predefined PDF form field name (e.g. InspectorSignature):');
                            if (fName && fName.trim()) {
                              setImportMappings({
                                ...importMappings,
                                [fName.trim()]: 'productCode'
                              });
                            }
                          }}
                          className="text-[10px] text-blue-400 hover:text-blue-350 flex items-center gap-1 cursor-pointer font-mono font-semibold"
                        >
                          <Plus className="w-3 h-3" /> Map Manual Field
                        </button>
                      </div>

                      {detectedPdfFormFields.length === 0 && Object.keys(importMappings).length === 0 ? (
                        <div className="p-4 bg-amber-500/10 border border-amber-500/20 text-amber-400 rounded-xl text-center">
                          <AlertCircle className="w-4 h-4 mx-auto mb-1" />
                          <div className="font-semibold text-[11px]">No Interactive PDF Fields Found</div>
                          <p className="text-[10px] text-gray-400 mt-0.5 max-w-sm mx-auto">
                            We didn't detect fillable form objects. Switch to <strong>"Stamp Coordinates"</strong> above to drop text onto coordinates.
                          </p>
                        </div>
                      ) : (
                        <div className="border border-[#282828] rounded-xl bg-[#161616] p-2.5 max-h-56 overflow-y-auto space-y-2">
                          {/* Detected Interactive Fields */}
                          {detectedPdfFormFields.map(fName => {
                            const systemKey = importMappings[fName] || '';
                            return (
                              <div key={fName} className="flex items-center justify-between gap-2 p-1.5 bg-[#121212] rounded-lg border border-[#222]">
                                <div className="flex items-center gap-1.5">
                                  <code className="text-xs font-mono font-bold text-blue-300">{fName}</code>
                                  <span className="text-[8px] tracking-wide uppercase font-bold text-green-400 bg-green-500/10 border border-green-500/20 rounded px-1 font-mono">
                                    Detected
                                  </span>
                                </div>
                                <div className="flex items-center gap-1.5">
                                  <ArrowRight className="w-3 h-3 text-gray-500" />
                                  <select
                                    value={systemKey}
                                    onChange={(e) => {
                                      setImportMappings({
                                        ...importMappings,
                                        [fName]: e.target.value
                                      });
                                    }}
                                    className="text-xs font-mono bg-[#1E1E1E] text-white border border-[#333] rounded-md px-2 py-0.5 focus:outline-hidden focus:border-blue-500"
                                  >
                                    <option value="">-- Do Not Map --</option>
                                    {SYSTEM_FIELD_OPTIONS.map((opt) => (
                                      <option key={opt.key} value={opt.key}>
                                        {opt.label} ({opt.key})
                                      </option>
                                    ))}
                                  </select>
                                </div>
                              </div>
                            );
                          })}

                          {/* Manually Mapped Interactive Fields */}
                          {Object.entries(importMappings)
                            .filter(([placeholder]) => !detectedPdfFormFields.includes(placeholder))
                            .map(([placeholder, systemKey]) => (
                              <div key={placeholder} className="flex items-center justify-between gap-2 p-1.5 bg-[#121212] rounded-lg border border-[#222]">
                                <div className="flex items-center gap-1.5">
                                  <code className="text-xs font-mono font-bold text-blue-300">{placeholder}</code>
                                  <span className="text-[8px] tracking-wide uppercase font-bold text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded px-1 font-mono">
                                    Manual
                                  </span>
                                </div>
                                <div className="flex items-center gap-1.5">
                                  <ArrowRight className="w-3 h-3 text-gray-500" />
                                  <select
                                    value={systemKey}
                                    onChange={(e) => {
                                      setImportMappings({
                                        ...importMappings,
                                        [placeholder]: e.target.value
                                      });
                                    }}
                                    className="text-xs font-mono bg-[#1E1E1E] text-white border border-[#333] rounded-md px-2 py-0.5 focus:outline-hidden focus:border-blue-500"
                                  >
                                    {SYSTEM_FIELD_OPTIONS.map((opt) => (
                                      <option key={opt.key} value={opt.key}>
                                        {opt.label} ({opt.key})
                                      </option>
                                    ))}
                                  </select>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const copy = { ...importMappings };
                                      delete copy[placeholder];
                                      setImportMappings(copy);
                                    }}
                                    className="p-1 text-gray-500 hover:text-red-400 rounded transition-colors"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </div>
                            ))}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="text-gray-400 text-[10px]">
                          Draw dynamic text fields at exact Cartesian coordinates (X, Y in PDF points relative to bottom-left).
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            const systemKey = 'productCode';
                            const randId = `stamp_${Date.now().toString(36)}`;
                            setPdfCoordinateMappings({
                              ...pdfCoordinateMappings,
                              [randId]: {
                                systemKey,
                                page: 1,
                                x: 100,
                                y: 700,
                                fontSize: 10,
                                textColor: '#000000'
                              }
                            });
                          }}
                          className="text-[10px] text-blue-400 hover:text-blue-355 flex items-center gap-1 cursor-pointer font-mono font-semibold"
                        >
                          <Plus className="w-3 h-3" /> Add Stamp Position
                        </button>
                      </div>

                      {Object.keys(pdfCoordinateMappings).length === 0 ? (
                        <div className="p-6 border border-dashed border-[#333] rounded-xl text-center text-gray-500 text-[11px] font-mono">
                          No coordinates mapped yet. Click "Add Stamp Position" above to map your first field.
                        </div>
                      ) : (
                        <div className="border border-[#282828] rounded-xl bg-[#161616] p-2.5 max-h-60 overflow-y-auto space-y-2.5">
                          {Object.entries(pdfCoordinateMappings).map(([id, mapping]) => (
                            <div key={id} className="p-2.5 bg-[#121212] rounded-lg border border-[#222] space-y-2">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-1.5">
                                  <span className="text-[9px] font-bold text-gray-400 uppercase tracking-wider">Attribute:</span>
                                  <select
                                    value={mapping.systemKey}
                                    onChange={(e) => {
                                      setPdfCoordinateMappings({
                                        ...pdfCoordinateMappings,
                                        [id]: { ...mapping, systemKey: e.target.value }
                                      });
                                    }}
                                    className="text-xs font-mono bg-[#1E1E1E] text-white border border-[#333] rounded px-1.5 py-0.5 focus:border-blue-500 focus:outline-hidden"
                                  >
                                    {SYSTEM_FIELD_OPTIONS.map((opt) => (
                                      <option key={opt.key} value={opt.key}>
                                        {opt.label}
                                      </option>
                                    ))}
                                  </select>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => {
                                    const copy = { ...pdfCoordinateMappings };
                                    delete copy[id];
                                    setPdfCoordinateMappings(copy);
                                  }}
                                  className="p-1 text-gray-500 hover:text-red-400 rounded transition-colors"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>

                              <div className="grid grid-cols-5 gap-1.5 items-center">
                                <div>
                                  <label className="block text-[8px] text-gray-500 font-bold uppercase mb-0.5">Page</label>
                                  <input
                                    type="number"
                                    min={1}
                                    value={mapping.page}
                                    onChange={(e) => {
                                      setPdfCoordinateMappings({
                                        ...pdfCoordinateMappings,
                                        [id]: { ...mapping, page: parseInt(e.target.value) || 1 }
                                      });
                                    }}
                                    className="w-full text-xs font-mono bg-[#1E1E1E] text-white border border-[#333] rounded px-1.5 py-0.5 text-center focus:border-blue-500 focus:outline-hidden"
                                  />
                                </div>
                                <div>
                                  <label className="block text-[8px] text-gray-500 font-bold uppercase mb-0.5">X (pt)</label>
                                  <input
                                    type="number"
                                    value={mapping.x}
                                    onChange={(e) => {
                                      setPdfCoordinateMappings({
                                        ...pdfCoordinateMappings,
                                        [id]: { ...mapping, x: parseFloat(e.target.value) || 0 }
                                      });
                                    }}
                                    className="w-full text-xs font-mono bg-[#1E1E1E] text-white border border-[#333] rounded px-1.5 py-0.5 text-center focus:border-blue-500 focus:outline-hidden"
                                  />
                                </div>
                                <div>
                                  <label className="block text-[8px] text-gray-500 font-bold uppercase mb-0.5">Y (pt)</label>
                                  <input
                                    type="number"
                                    value={mapping.y}
                                    onChange={(e) => {
                                      setPdfCoordinateMappings({
                                        ...pdfCoordinateMappings,
                                        [id]: { ...mapping, y: parseFloat(e.target.value) || 0 }
                                      });
                                    }}
                                    className="w-full text-xs font-mono bg-[#1E1E1E] text-white border border-[#333] rounded px-1.5 py-0.5 text-center focus:border-blue-500 focus:outline-hidden"
                                  />
                                </div>
                                <div>
                                  <label className="block text-[8px] text-gray-500 font-bold uppercase mb-0.5">Size</label>
                                  <input
                                    type="number"
                                    min={1}
                                    value={mapping.fontSize || 10}
                                    onChange={(e) => {
                                      setPdfCoordinateMappings({
                                        ...pdfCoordinateMappings,
                                        [id]: { ...mapping, fontSize: parseInt(e.target.value) || 10 }
                                      });
                                    }}
                                    className="w-full text-xs font-mono bg-[#1E1E1E] text-white border border-[#333] rounded px-1.5 py-0.5 text-center focus:border-blue-500 focus:outline-hidden"
                                  />
                                </div>
                                <div>
                                  <label className="block text-[8px] text-gray-500 font-bold uppercase mb-0.5">Color</label>
                                  <div className="flex items-center gap-1 justify-center">
                                    <input
                                      type="color"
                                      value={mapping.textColor || '#000000'}
                                      onChange={(e) => {
                                        setPdfCoordinateMappings({
                                          ...pdfCoordinateMappings,
                                          [id]: { ...mapping, textColor: e.target.value }
                                        });
                                      }}
                                      className="w-5 h-5 border border-[#333] bg-transparent rounded cursor-pointer p-0"
                                    />
                                    <span className="text-[8px] font-mono text-gray-400">{mapping.textColor || '#000000'}</span>
                                  </div>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ) : (
                Object.keys(importMappings).length > 0 && (
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="text-xs font-semibold text-gray-300">
                        Detected Field Placeholders & Mappings ({Object.keys(importMappings).length})
                      </label>
                      <span className="text-[10px] text-gray-500 font-mono">
                        Template Placeholder &rarr; System Field
                      </span>
                    </div>

                    <div className="border border-[#282828] rounded-xl bg-[#181818] p-3 max-h-48 overflow-y-auto space-y-2">
                      {Object.entries(importMappings).map(([placeholder, systemKey]) => (
                        <div
                          key={placeholder}
                          className="flex items-center justify-between gap-2 p-1.5 bg-[#141414] rounded-lg border border-[#222]"
                        >
                          <code className="text-xs font-mono font-bold text-blue-300">
                            {placeholder}
                          </code>
                          <div className="flex items-center gap-1.5">
                            <ArrowRight className="w-3.5 h-3.5 text-gray-500" />
                            <select
                              value={systemKey}
                              onChange={(e) => {
                                setImportMappings({
                                  ...importMappings,
                                  [placeholder]: e.target.value
                                });
                              }}
                              className="text-xs font-mono bg-[#1E1E1E] text-white border border-[#333] rounded-md px-2 py-1 focus:outline-hidden focus:border-blue-500"
                            >
                              {SYSTEM_FIELD_OPTIONS.map((opt) => (
                                <option key={opt.key} value={opt.key}>
                                  {opt.label} ({opt.key})
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )
              )}

              {/* Active Toggle */}
              <div className="p-3 bg-[#181818] border border-[#282828] rounded-xl flex items-center justify-between">
                <div>
                  <div className="font-semibold text-white">Set as Active Template</div>
                  <div className="text-[11px] text-gray-400">
                    Immediately use this template when generating {importFormType === 'material_reference_sheet' ? 'Reference Sheets' : 'Inspection Proofs'}.
                  </div>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={setAsActiveOnSave}
                    onChange={(e) => setSetAsActiveOnSave(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-[#2A2A2A] peer-focus:outline-hidden rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                </label>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-5 py-3.5 bg-[#0E0E0E] border-t border-[#252525] flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setIsImportModalOpen(false)}
                className="px-3.5 py-2 text-xs font-semibold text-gray-400 hover:text-white rounded-xl transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveImport}
                disabled={isUploading || !importFileContent || !importName.trim()}
                className="px-4 py-2 text-xs font-semibold bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-xl shadow-lg transition-all flex items-center gap-2 cursor-pointer active:scale-98"
              >
                <Check className="w-4 h-4" />
                <span>Save Template</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Edit Template & Mappings */}
      {isEditModalOpen && selectedTemplate && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-[#141414] rounded-2xl border border-[#333] w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden shadow-2xl animate-in zoom-in-95 duration-100">
            {/* Header */}
            <div className="px-5 py-4 bg-[#0E0E0E] border-b border-[#252525] flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-blue-500/10 text-blue-400 rounded-lg">
                  <Edit3 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">Edit Form Template</h3>
                  <p className="text-xs text-gray-400">Configure template settings and field placeholder mappings</p>
                </div>
              </div>
              <button
                onClick={() => setIsEditModalOpen(false)}
                className="p-1.5 text-gray-400 hover:text-white rounded-lg hover:bg-[#222] transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Body */}
            <div className="p-5 space-y-4 overflow-y-auto flex-1 text-xs">
              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2">
                  <label className="block text-xs font-semibold text-gray-300 mb-1">
                    Template Name
                  </label>
                  <input
                    type="text"
                    value={importName}
                    onChange={(e) => setImportName(e.target.value)}
                    className="w-full px-3 py-2 bg-[#1A1A1A] border border-[#2F2F2F] rounded-xl text-white focus:outline-hidden focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-300 mb-1">
                    Version
                  </label>
                  <input
                    type="text"
                    value={importVersion}
                    onChange={(e) => setImportVersion(e.target.value)}
                    className="w-full px-3 py-2 bg-[#1A1A1A] border border-[#2F2F2F] rounded-xl text-white font-mono focus:outline-hidden focus:border-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-300 mb-1">
                  Description
                </label>
                <textarea
                  rows={2}
                  value={importDescription}
                  onChange={(e) => setImportDescription(e.target.value)}
                  className="w-full px-3 py-2 bg-[#1A1A1A] border border-[#2F2F2F] rounded-xl text-white focus:outline-hidden focus:border-blue-500 resize-none"
                />
              </div>

              {/* Field Mappings Editor */}
              {importFileType === 'pdf' ? (
                <div className="space-y-4 border border-[#282828] rounded-2xl p-4 bg-[#111111]">
                  <div className="flex items-center justify-between border-b border-[#222] pb-2">
                    <div className="text-xs font-bold text-gray-300 uppercase tracking-wider">
                      PDF Document Field Mapper
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setPdfMappingTab('forms')}
                        className={`px-3 py-1 text-[10px] font-bold rounded-lg border transition-all cursor-pointer ${
                          pdfMappingTab === 'forms'
                            ? 'bg-blue-600/15 border-blue-500/35 text-blue-400'
                            : 'bg-transparent border-[#2F2F2F] text-gray-400 hover:text-white'
                        }`}
                      >
                        AcroForm Fields
                      </button>
                      <button
                        type="button"
                        onClick={() => setPdfMappingTab('coordinates')}
                        className={`px-3 py-1 text-[10px] font-bold rounded-lg border transition-all cursor-pointer ${
                          pdfMappingTab === 'coordinates'
                            ? 'bg-blue-600/15 border-blue-500/35 text-blue-400'
                            : 'bg-transparent border-[#2F2F2F] text-gray-400 hover:text-white'
                        }`}
                      >
                        Stamp Coordinates
                      </button>
                    </div>
                  </div>

                  {pdfMappingTab === 'forms' ? (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="text-gray-400 text-[10px]">
                          Map predefined PDF Form fields directly to dynamic database properties.
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            const fName = prompt('Enter predefined PDF form field name (e.g. InspectorSignature):');
                            if (fName && fName.trim()) {
                              setImportMappings({
                                ...importMappings,
                                [fName.trim()]: 'productCode'
                              });
                            }
                          }}
                          className="text-[10px] text-blue-400 hover:text-blue-350 flex items-center gap-1 cursor-pointer font-mono font-semibold"
                        >
                          <Plus className="w-3 h-3" /> Map Manual Field
                        </button>
                      </div>

                      {detectedPdfFormFields.length === 0 && Object.keys(importMappings).length === 0 ? (
                        <div className="p-4 bg-amber-500/10 border border-amber-500/20 text-amber-400 rounded-xl text-center">
                          <AlertCircle className="w-4 h-4 mx-auto mb-1" />
                          <div className="font-semibold text-[11px]">No Interactive PDF Fields Found</div>
                          <p className="text-[10px] text-gray-400 mt-0.5 max-w-sm mx-auto">
                            We didn't detect fillable form objects. Switch to <strong>"Stamp Coordinates"</strong> above to drop text onto coordinates.
                          </p>
                        </div>
                      ) : (
                        <div className="border border-[#282828] rounded-xl bg-[#161616] p-2.5 max-h-56 overflow-y-auto space-y-2">
                          {/* Detected Interactive Fields */}
                          {detectedPdfFormFields.map(fName => {
                            const systemKey = importMappings[fName] || '';
                            return (
                              <div key={fName} className="flex items-center justify-between gap-2 p-1.5 bg-[#121212] rounded-lg border border-[#222]">
                                <div className="flex items-center gap-1.5">
                                  <code className="text-xs font-mono font-bold text-blue-300">{fName}</code>
                                  <span className="text-[8px] tracking-wide uppercase font-bold text-green-400 bg-green-500/10 border border-green-500/20 rounded px-1 font-mono">
                                    Detected
                                  </span>
                                </div>
                                <div className="flex items-center gap-1.5">
                                  <ArrowRight className="w-3 h-3 text-gray-500" />
                                  <select
                                    value={systemKey}
                                    onChange={(e) => {
                                      setImportMappings({
                                        ...importMappings,
                                        [fName]: e.target.value
                                      });
                                    }}
                                    className="text-xs font-mono bg-[#1E1E1E] text-white border border-[#333] rounded-md px-2 py-0.5 focus:outline-hidden focus:border-blue-500"
                                  >
                                    <option value="">-- Do Not Map --</option>
                                    {SYSTEM_FIELD_OPTIONS.map((opt) => (
                                      <option key={opt.key} value={opt.key}>
                                        {opt.label} ({opt.key})
                                      </option>
                                    ))}
                                  </select>
                                </div>
                              </div>
                            );
                          })}

                          {/* Manually Mapped Interactive Fields */}
                          {Object.entries(importMappings)
                            .filter(([placeholder]) => !detectedPdfFormFields.includes(placeholder))
                            .map(([placeholder, systemKey]) => (
                              <div key={placeholder} className="flex items-center justify-between gap-2 p-1.5 bg-[#121212] rounded-lg border border-[#222]">
                                <div className="flex items-center gap-1.5">
                                  <code className="text-xs font-mono font-bold text-blue-300">{placeholder}</code>
                                  <span className="text-[8px] tracking-wide uppercase font-bold text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded px-1 font-mono">
                                    Manual
                                  </span>
                                </div>
                                <div className="flex items-center gap-1.5">
                                  <ArrowRight className="w-3 h-3 text-gray-500" />
                                  <select
                                    value={systemKey}
                                    onChange={(e) => {
                                      setImportMappings({
                                        ...importMappings,
                                        [placeholder]: e.target.value
                                      });
                                    }}
                                    className="text-xs font-mono bg-[#1E1E1E] text-white border border-[#333] rounded-md px-2 py-0.5 focus:outline-hidden focus:border-blue-500"
                                  >
                                    {SYSTEM_FIELD_OPTIONS.map((opt) => (
                                      <option key={opt.key} value={opt.key}>
                                        {opt.label} ({opt.key})
                                      </option>
                                    ))}
                                  </select>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const copy = { ...importMappings };
                                      delete copy[placeholder];
                                      setImportMappings(copy);
                                    }}
                                    className="p-1 text-gray-500 hover:text-red-400 rounded transition-colors"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </div>
                            ))}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="text-gray-400 text-[10px]">
                          Draw dynamic text fields at exact Cartesian coordinates (X, Y in PDF points relative to bottom-left).
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            const systemKey = 'productCode';
                            const randId = `stamp_${Date.now().toString(36)}`;
                            setPdfCoordinateMappings({
                              ...pdfCoordinateMappings,
                              [randId]: {
                                systemKey,
                                page: 1,
                                x: 100,
                                y: 700,
                                fontSize: 10,
                                textColor: '#000000'
                              }
                            });
                          }}
                          className="text-[10px] text-blue-400 hover:text-blue-355 flex items-center gap-1 cursor-pointer font-mono font-semibold"
                        >
                          <Plus className="w-3 h-3" /> Add Stamp Position
                        </button>
                      </div>

                      {Object.keys(pdfCoordinateMappings).length === 0 ? (
                        <div className="p-6 border border-dashed border-[#333] rounded-xl text-center text-gray-500 text-[11px] font-mono">
                          No coordinates mapped yet. Click "Add Stamp Position" above to map your first field.
                        </div>
                      ) : (
                        <div className="border border-[#282828] rounded-xl bg-[#161616] p-2.5 max-h-60 overflow-y-auto space-y-2.5">
                          {Object.entries(pdfCoordinateMappings).map(([id, mapping]) => (
                            <div key={id} className="p-2.5 bg-[#121212] rounded-lg border border-[#222] space-y-2">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-1.5">
                                  <span className="text-[9px] font-bold text-gray-400 uppercase tracking-wider">Attribute:</span>
                                  <select
                                    value={mapping.systemKey}
                                    onChange={(e) => {
                                      setPdfCoordinateMappings({
                                        ...pdfCoordinateMappings,
                                        [id]: { ...mapping, systemKey: e.target.value }
                                      });
                                    }}
                                    className="text-xs font-mono bg-[#1E1E1E] text-white border border-[#333] rounded px-1.5 py-0.5 focus:border-blue-500 focus:outline-hidden"
                                  >
                                    {SYSTEM_FIELD_OPTIONS.map((opt) => (
                                      <option key={opt.key} value={opt.key}>
                                        {opt.label}
                                      </option>
                                    ))}
                                  </select>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => {
                                    const copy = { ...pdfCoordinateMappings };
                                    delete copy[id];
                                    setPdfCoordinateMappings(copy);
                                  }}
                                  className="p-1 text-gray-500 hover:text-red-400 rounded transition-colors"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>

                              <div className="grid grid-cols-5 gap-1.5 items-center">
                                <div>
                                  <label className="block text-[8px] text-gray-500 font-bold uppercase mb-0.5">Page</label>
                                  <input
                                    type="number"
                                    min={1}
                                    value={mapping.page}
                                    onChange={(e) => {
                                      setPdfCoordinateMappings({
                                        ...pdfCoordinateMappings,
                                        [id]: { ...mapping, page: parseInt(e.target.value) || 1 }
                                      });
                                    }}
                                    className="w-full text-xs font-mono bg-[#1E1E1E] text-white border border-[#333] rounded px-1.5 py-0.5 text-center focus:border-blue-500 focus:outline-hidden"
                                  />
                                </div>
                                <div>
                                  <label className="block text-[8px] text-gray-500 font-bold uppercase mb-0.5">X (pt)</label>
                                  <input
                                    type="number"
                                    value={mapping.x}
                                    onChange={(e) => {
                                      setPdfCoordinateMappings({
                                        ...pdfCoordinateMappings,
                                        [id]: { ...mapping, x: parseFloat(e.target.value) || 0 }
                                      });
                                    }}
                                    className="w-full text-xs font-mono bg-[#1E1E1E] text-white border border-[#333] rounded px-1.5 py-0.5 text-center focus:border-blue-500 focus:outline-hidden"
                                  />
                                </div>
                                <div>
                                  <label className="block text-[8px] text-gray-500 font-bold uppercase mb-0.5">Y (pt)</label>
                                  <input
                                    type="number"
                                    value={mapping.y}
                                    onChange={(e) => {
                                      setPdfCoordinateMappings({
                                        ...pdfCoordinateMappings,
                                        [id]: { ...mapping, y: parseFloat(e.target.value) || 0 }
                                      });
                                    }}
                                    className="w-full text-xs font-mono bg-[#1E1E1E] text-white border border-[#333] rounded px-1.5 py-0.5 text-center focus:border-blue-500 focus:outline-hidden"
                                  />
                                </div>
                                <div>
                                  <label className="block text-[8px] text-gray-500 font-bold uppercase mb-0.5">Size</label>
                                  <input
                                    type="number"
                                    min={1}
                                    value={mapping.fontSize || 10}
                                    onChange={(e) => {
                                      setPdfCoordinateMappings({
                                        ...pdfCoordinateMappings,
                                        [id]: { ...mapping, fontSize: parseInt(e.target.value) || 10 }
                                      });
                                    }}
                                    className="w-full text-xs font-mono bg-[#1E1E1E] text-white border border-[#333] rounded px-1.5 py-0.5 text-center focus:border-blue-500 focus:outline-hidden"
                                  />
                                </div>
                                <div>
                                  <label className="block text-[8px] text-gray-500 font-bold uppercase mb-0.5">Color</label>
                                  <div className="flex items-center gap-1 justify-center">
                                    <input
                                      type="color"
                                      value={mapping.textColor || '#000000'}
                                      onChange={(e) => {
                                        setPdfCoordinateMappings({
                                          ...pdfCoordinateMappings,
                                          [id]: { ...mapping, textColor: e.target.value }
                                        });
                                      }}
                                      className="w-5 h-5 border border-[#333] bg-transparent rounded cursor-pointer p-0"
                                    />
                                    <span className="text-[8px] font-mono text-gray-400">{mapping.textColor || '#000000'}</span>
                                  </div>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ) : (
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-semibold text-gray-300">
                      Field Mappings ({Object.keys(importMappings).length})
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        const newTag = prompt('Enter placeholder tag (e.g. {{custom_tag}}):');
                        if (newTag && newTag.trim()) {
                          const formatted = newTag.startsWith('{{') ? newTag.trim() : `{{${newTag.trim()}}}`;
                          setImportMappings({
                            ...importMappings,
                            [formatted]: 'productCode'
                          });
                        }
                      }}
                      className="text-[11px] text-blue-400 hover:text-blue-300 flex items-center gap-1 font-mono cursor-pointer"
                    >
                      <Plus className="w-3 h-3" /> Add Placeholder
                    </button>
                  </div>

                  <div className="border border-[#282828] rounded-xl bg-[#181818] p-3 max-h-56 overflow-y-auto space-y-2">
                    {Object.entries(importMappings).map(([placeholder, systemKey]) => (
                      <div
                        key={placeholder}
                        className="flex items-center justify-between gap-2 p-1.5 bg-[#141414] rounded-lg border border-[#222]"
                      >
                        <code className="text-xs font-mono font-bold text-blue-300">
                          {placeholder}
                        </code>
                        <div className="flex items-center gap-1.5">
                          <ArrowRight className="w-3.5 h-3.5 text-gray-500" />
                          <select
                            value={systemKey}
                            onChange={(e) => {
                              setImportMappings({
                                ...importMappings,
                                [placeholder]: e.target.value
                              });
                            }}
                            className="text-xs font-mono bg-[#1E1E1E] text-white border border-[#333] rounded-md px-2 py-1 focus:outline-hidden focus:border-blue-500"
                          >
                            {SYSTEM_FIELD_OPTIONS.map((opt) => (
                              <option key={opt.key} value={opt.key}>
                                {opt.label} ({opt.key})
                              </option>
                            ))}
                          </select>
                          <button
                            type="button"
                            onClick={() => {
                              const copy = { ...importMappings };
                              delete copy[placeholder];
                              setImportMappings(copy);
                            }}
                            className="p-1 text-gray-500 hover:text-red-400 rounded transition-colors"
                            title="Remove mapping"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-5 py-3.5 bg-[#0E0E0E] border-t border-[#252525] flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setIsEditModalOpen(false)}
                className="px-3.5 py-2 text-xs font-semibold text-gray-400 hover:text-white rounded-xl transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveEdit}
                className="px-4 py-2 text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white rounded-xl shadow-lg transition-all flex items-center gap-2 cursor-pointer active:scale-98"
              >
                <Check className="w-4 h-4" />
                <span>Save Changes</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Interactive Live Preview */}
      {isPreviewModalOpen && selectedTemplate && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-[#141414] rounded-2xl border border-[#333] w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden shadow-2xl animate-in zoom-in-95 duration-100">
            {/* Header */}
            <div className="px-5 py-3.5 bg-[#0E0E0E] border-b border-[#252525] flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-blue-500/10 text-blue-400 rounded-lg">
                  <Eye className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-bold text-white">{selectedTemplate.name}</h3>
                    <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20">
                      Preview Mode
                    </span>
                  </div>
                  <p className="text-xs text-gray-400">
                    Sample rendering using {sampleReg ? `Registration #${sampleReg.productCode}` : 'Default System Data'}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsPreviewModalOpen(false)}
                className="p-1.5 text-gray-400 hover:text-white rounded-lg hover:bg-[#222] transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Body Preview */}
            <div className="p-6 overflow-y-auto flex-1 bg-[#1A1A1A] flex justify-center">
              {selectedTemplate.fileType === 'pdf' && selectedTemplate.fileContent ? (
                <PdfViewer
                  base64={selectedTemplate.fileContent}
                  fileName={selectedTemplate.fileName || selectedTemplate.name}
                  height="600px"
                  className="w-full max-w-4xl"
                />
              ) : selectedTemplate.fileType === 'docx' ? (
                <DocxModalPreview template={selectedTemplate} config={config} sampleDict={sampleDict} />
              ) : previewHtml ? (
                <div
                  className="bg-white text-slate-900 rounded-lg shadow-2xl p-4 max-w-xl w-full overflow-x-auto"
                  dangerouslySetInnerHTML={{ __html: previewHtml }}
                />
              ) : (
                <div className="text-gray-400 text-xs font-mono">No preview content available</div>
              )}
            </div>

            {/* Footer */}
            <div className="px-5 py-3.5 bg-[#0E0E0E] border-t border-[#252525] flex items-center justify-between">
              <div className="text-xs text-gray-400 font-mono">
                Format: {selectedTemplate.fileType.toUpperCase()} • Status: {selectedTemplate.isActive ? 'Active' : 'Inactive'}
              </div>
              <div className="flex items-center gap-2">
                {isAdmin && templates.filter(t => t.formType === selectedTemplate.formType).length > 1 && (
                  <button
                    onClick={() => handleDelete(selectedTemplate)}
                    className="px-3 py-1.5 text-xs font-semibold bg-red-950/40 hover:bg-red-900/60 text-red-300 border border-red-500/30 rounded-xl transition-colors cursor-pointer flex items-center gap-1.5"
                    title="Delete this template"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Delete</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => {
                    try {
                      pdfService.exportTemplateAsPdf(
                        selectedTemplate,
                        sampleDict,
                        `${selectedTemplate.name}_${sampleReg?.productCode || 'Sample'}`
                      );
                    } catch (err: any) {
                      onNotify?.('PDF Export', err.message || 'Failed to export PDF', 'warning');
                    }
                  }}
                  className="px-3.5 py-1.5 text-xs font-semibold bg-red-600 hover:bg-red-500 text-white rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer shadow-sm"
                >
                  <FileText className="w-3.5 h-3.5" />
                  <span>Export PDF</span>
                </button>
                {!selectedTemplate.isActive && isAdmin && (
                  <button
                    onClick={() => {
                      handleSetActive(selectedTemplate);
                      setIsPreviewModalOpen(false);
                    }}
                    className="px-3.5 py-1.5 text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl transition-colors cursor-pointer"
                  >
                    Set as Active Template
                  </button>
                )}
                <button
                  onClick={() => setIsPreviewModalOpen(false)}
                  className="px-3.5 py-1.5 text-xs font-semibold bg-[#222] hover:bg-[#333] text-white rounded-xl transition-colors cursor-pointer"
                >
                  Close Preview
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* CUSTOM CONFIRMATION MODAL: Delete Template */}
      {templateToDelete && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-[#1A1A1A] border border-[#333] rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4 animate-in zoom-in duration-150">
            <div className="flex items-start gap-3">
              <div className="p-2 bg-red-500/10 border border-red-500/20 text-red-500 rounded-xl">
                <Trash2 className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">Delete Document Template</h3>
                <p className="text-xs text-gray-400 mt-1">
                  Are you sure you want to permanently delete template <strong className="text-gray-200">"{templateToDelete.name}"</strong>? This action cannot be undone.
                </p>
                {templateToDelete.isActive && (
                  <p className="text-xs text-amber-400 font-semibold mt-2 bg-amber-500/10 border border-amber-500/20 p-2 rounded-lg">
                    ⚠️ This is the currently ACTIVE template. Deleting it will automatically fall back to the built-in standard template.
                  </p>
                )}
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setTemplateToDelete(null)}
                className="px-3.5 py-2 bg-[#252525] hover:bg-[#303030] text-gray-300 text-xs font-semibold rounded-xl transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                className="px-3.5 py-2 bg-red-600 hover:bg-red-500 text-white text-xs font-bold rounded-xl transition-colors cursor-pointer"
              >
                Confirm Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CUSTOM CONFIRMATION MODAL: Reset Factory Defaults */}
      {isResetConfirmOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-[#1A1A1A] border border-[#333] rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4 animate-in zoom-in duration-150">
            <div className="flex items-start gap-3">
              <div className="p-2 bg-amber-500/10 border border-amber-500/20 text-amber-500 rounded-xl">
                <RotateCcw className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">Restore Standard Factory Templates?</h3>
                <p className="text-xs text-gray-400 mt-1">
                  This will reset all template defaults back to factory standards. Any custom-uploaded templates will be preserved, and standard built-in templates will be reactivated.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsResetConfirmOpen(false)}
                className="px-3.5 py-2 bg-[#252525] hover:bg-[#303030] text-gray-300 text-xs font-semibold rounded-xl transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmResetDefaults}
                className="px-3.5 py-2 bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold rounded-xl transition-colors cursor-pointer"
              >
                Reset to Defaults
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
