import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  MasterItem, 
  ReferenceRegistration, 
  PhotoAttachment, 
  DocumentAttachment, 
  CustomFieldDefinition,
  PhotoCategory,
  PrintLayoutType,
  MaterialType
} from '../types';
import { 
  X, 
  ShieldCheck, 
  Upload, 
  Trash2, 
  Image as ImageIcon, 
  Paperclip, 
  AlertCircle, 
  Plus, 
  Star, 
  Printer, 
  ArrowUp, 
  ArrowDown, 
  Layers, 
  CheckSquare, 
  Square, 
  Sparkles, 
  Lock, 
  User, 
  Search, 
  Tag, 
  Check, 
  ChevronDown, 
  Calendar, 
  Boxes,
  Clock
} from 'lucide-react';
import { tauriBridge } from '../services/tauriService';
import { userService } from '../services/userService';
import { db } from '../services/db';

interface ReferenceRegistrationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (regData: Omit<ReferenceRegistration, 'id' | 'createdAt' | 'updatedAt'>) => Promise<{ success: boolean; error?: string }>;
  masterItems: MasterItem[];
  registrations: ReferenceRegistration[];
  customFieldDefs: CustomFieldDefinition[];
  defaultUser: string;
  initialMasterItem?: MasterItem | null;
  existingRegistration?: ReferenceRegistration | null;
}

const PHOTO_CATEGORY_OPTIONS: { value: PhotoCategory; label: string }[] = [
  { value: 'SPECIMEN_PRIMARY', label: 'Primary Sample / Full View' },
  { value: 'DEFECT_LIMIT', label: 'Defect Tolerance / Limit Sample' },
  { value: 'SURFACE_FINISH', label: 'Surface Finish & Texture' },
  { value: 'DIMENSION_CHECK', label: 'Dimension / Scale Check' },
  { value: 'PACKAGING_LABEL', label: 'Packaging & Label Spec' },
  { value: 'OTHER', label: 'Other Inspection Evidence' }
];

export const ReferenceRegistrationModal: React.FC<ReferenceRegistrationModalProps> = ({
  isOpen,
  onClose,
  onSave,
  masterItems,
  registrations = [],
  customFieldDefs,
  defaultUser,
  initialMasterItem,
  existingRegistration
}) => {
  const [selectedProductCode, setSelectedProductCode] = useState('');
  const [materialType, setMaterialType] = useState<MaterialType>('RM');
  const [category, setCategory] = useState<string>('Box');
  const [categoriesList, setCategoriesList] = useState<string[]>([]);
  const [isCustomCategory, setIsCustomCategory] = useState(false);
  const [customCategoryName, setCustomCategoryName] = useState('');
  const [registrationDate, setRegistrationDate] = useState('');
  const [registeredBy, setRegisteredBy] = useState('');
  const [supplier, setSupplier] = useState('');
  const [specification, setSpecification] = useState('');
  const [remarks, setRemarks] = useState('');
  const [revision, setRevision] = useState('Rev 01');
  const [customFields, setCustomFields] = useState<Record<string, any>>({});
  const [photos, setPhotos] = useState<PhotoAttachment[]>([]);
  const [attachments, setAttachments] = useState<DocumentAttachment[]>([]);
  const [printLayout, setPrintLayout] = useState<PrintLayoutType>('HERO_SINGLE');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const suggestionsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const loadCategories = async () => {
      const cats = await db.getCategories();
      setCategoriesList(cats);
    };
    if (isOpen) {
      loadCategories();
    }
  }, [isOpen]);

  // Close suggestions when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (suggestionsRef.current && !suggestionsRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Helper to increment revision e.g. "Rev 01" -> "Rev 02"
  const getNextRevision = (currentRev: string): string => {
    if (!currentRev) return 'Rev 02';
    const match = currentRev.match(/(\d+)/);
    if (match) {
      const num = parseInt(match[1], 10) + 1;
      const padded = num < 10 ? `0${num}` : `${num}`;
      const prefix = currentRev.substring(0, match.index);
      return `${prefix}${padded}`;
    }
    return `${currentRev} Rev 02`;
  };

  // Filtered auto-suggestions from master items catalog based on what the user types, excluding items already registered (unless editing)
  const suggestedMasterItems = useMemo(() => {
    const q = selectedProductCode.trim().toLowerCase();
    if (!q) {
      return []; // Of no letters on the field there should also be no suggestion.
    }
    const registeredCodes = new Set(
      registrations
        .filter((r) => !existingRegistration || r.id !== existingRegistration.id)
        .map((r) => r.productCode.toLowerCase())
    );

    return masterItems.filter((item) => {
      if (registeredCodes.has(item.productCode.toLowerCase())) {
        return false;
      }
      return (
        item.productCode.toLowerCase().includes(q) ||
        item.description.toLowerCase().includes(q) ||
        (item.category && item.category.toLowerCase().includes(q)) ||
        (item.materialType && item.materialType.toLowerCase().includes(q))
      );
    }).slice(0, 10);
  }, [masterItems, registrations, selectedProductCode, existingRegistration]);

  useEffect(() => {
    const currentUser = userService.getCurrentUser();
    const activeShortName = currentUser?.shortName || defaultUser || 'JD. Stone';

    if (existingRegistration) {
      setSelectedProductCode(existingRegistration.productCode);
      setMaterialType(existingRegistration.materialType || 'RM');
      setCategory(existingRegistration.category || 'Box');
      setIsCustomCategory(false);
      setCustomCategoryName('');
      setRegistrationDate(existingRegistration.registrationDate);
      
      // Match existing registeredBy to a user's shortName if possible
      const matchingUser = userService.getRegisteredUsers().find(
        (u) => u.fullName === existingRegistration.registeredBy || u.shortName === existingRegistration.registeredBy
      );
      setRegisteredBy(matchingUser ? matchingUser.shortName : existingRegistration.registeredBy);

      setSupplier(existingRegistration.supplier || '');
      setSpecification(existingRegistration.specification || '');
      setRemarks(existingRegistration.remarks || '');
      // If existing registration is already approved, editing will submit a new revision (e.g. Rev 02).
      // If it is NOT approved yet (e.g. PENDING_APPROVAL), editing updates the pending record directly without incrementing revision.
      const isPending = existingRegistration.status !== 'APPROVED';
      setRevision(isPending ? (existingRegistration.revision || 'Rev 01') : getNextRevision(existingRegistration.revision || 'Rev 01'));
      setCustomFields(existingRegistration.customFields || {});
      setPrintLayout(existingRegistration.printLayout || 'HERO_SINGLE');

      // Ensure photos have print metadata defaults
      const mappedPhotos = (existingRegistration.photos || []).map((p, idx) => ({
        ...p,
        isPrimary: p.isPrimary ?? (idx === 0),
        includeInPrint: p.includeInPrint ?? true,
        photoCategory: p.photoCategory || (idx === 0 ? 'SPECIMEN_PRIMARY' : 'OTHER'),
        orderIndex: p.orderIndex ?? idx
      }));
      setPhotos(mappedPhotos);
      setAttachments(existingRegistration.attachments || []);
    } else if (initialMasterItem) {
      setSelectedProductCode(initialMasterItem.productCode);
      setMaterialType(initialMasterItem.materialType || 'RM');
      setCategory(initialMasterItem.category || 'Box');
      setIsCustomCategory(false);
      setCustomCategoryName('');
      setRegistrationDate(new Date().toISOString().split('T')[0]);
      setRegisteredBy(activeShortName);
      setSupplier('');
      setSpecification('');
      setRemarks('');
      setRevision('Rev 01');
      setPrintLayout('HERO_SINGLE');

      // Initialize default custom field values
      const initialCustom: Record<string, any> = {};
      customFieldDefs.forEach((cf) => {
        if (cf.defaultValue) {
          initialCustom[cf.key] = cf.type === 'boolean' ? cf.defaultValue === 'true' : cf.defaultValue;
        }
      });
      setCustomFields(initialCustom);
      setPhotos([]);
      setAttachments([]);
    } else {
      setSelectedProductCode(''); // Blank on reference registry
      setMaterialType('RM');
      setCategory('Box');
      setIsCustomCategory(false);
      setCustomCategoryName('');
      setRegistrationDate(new Date().toISOString().split('T')[0]);
      setRegisteredBy(activeShortName);
      setSupplier('');
      setSpecification('');
      setRemarks('');
      setRevision('Rev 01');
      setCustomFields({});
      setPrintLayout('HERO_SINGLE');
      setPhotos([]);
      setAttachments([]);
    }
    setError(null);
  }, [isOpen, initialMasterItem, existingRegistration, defaultUser, masterItems, customFieldDefs]);

  // When matching catalog item is chosen or found, sync defaults if user didn't customize
  const handleSelectMasterItem = (item: MasterItem) => {
    setSelectedProductCode(item.productCode);
    if (item.materialType) setMaterialType(item.materialType);
    if (item.category) {
      setCategory(item.category);
      setIsCustomCategory(false);
    }
    setShowSuggestions(false);
  };

  const currentMasterItem = useMemo(() => {
    return masterItems.find(
      (m) => m.productCode.toLowerCase() === selectedProductCode.toLowerCase()
    );
  }, [masterItems, selectedProductCode]);

  useEffect(() => {
    if (currentMasterItem) {
      if (currentMasterItem.materialType) {
        setMaterialType(currentMasterItem.materialType);
      }
      if (currentMasterItem.category) {
        setCategory(currentMasterItem.category);
        setIsCustomCategory(false);
      }
    }
  }, [currentMasterItem]);

  if (!isOpen) return null;

  const handleAddMultiplePhotos = async () => {
    const results = await tauriBridge.pickMultipleImageFiles();
    if (results && results.length > 0) {
      const newItems: PhotoAttachment[] = results.map((res, i) => {
        const isFirstOverall = photos.length === 0 && i === 0;
        return {
          id: `photo-${Date.now()}-${i}-${Math.random().toString(36).substring(2, 6)}`,
          fileName: res.fileName,
          fileSize: res.fileSize,
          dataUrl: res.fileData as string,
          caption: res.fileName.replace(/\.[^/.]+$/, ''),
          uploadedAt: new Date().toISOString(),
          isPrimary: isFirstOverall,
          includeInPrint: true,
          photoCategory: isFirstOverall ? 'SPECIMEN_PRIMARY' : 'OTHER',
          orderIndex: photos.length + i
        };
      });
      setPhotos(prev => [...prev, ...newItems]);
    }
  };

  const handleDropFiles = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer && e.dataTransfer.files.length > 0) {
      const results = await tauriBridge.readFilesFromDrop(e.dataTransfer);
      if (results.length > 0) {
        const newItems: PhotoAttachment[] = results.map((res, i) => {
          const isFirstOverall = photos.length === 0 && i === 0;
          return {
            id: `photo-${Date.now()}-${i}-${Math.random().toString(36).substring(2, 6)}`,
            fileName: res.fileName,
            fileSize: res.fileSize,
            dataUrl: res.fileData as string,
            caption: res.fileName.replace(/\.[^/.]+$/, ''),
            uploadedAt: new Date().toISOString(),
            isPrimary: isFirstOverall,
            includeInPrint: true,
            photoCategory: isFirstOverall ? 'SPECIMEN_PRIMARY' : 'OTHER',
            orderIndex: photos.length + i
          };
        });
        setPhotos(prev => [...prev, ...newItems]);
      }
    }
  };

  const handleSetPrimaryPhoto = (photoId: string) => {
    setPhotos(prev =>
      prev.map(p => ({
        ...p,
        isPrimary: p.id === photoId,
        includeInPrint: p.id === photoId ? true : p.includeInPrint
      }))
    );
  };

  const handleToggleIncludeInPrint = (photoId: string) => {
    setPhotos(prev =>
      prev.map(p =>
        p.id === photoId ? { ...p, includeInPrint: !p.includeInPrint } : p
      )
    );
  };

  const handleMovePhoto = (index: number, direction: 'up' | 'down') => {
    const targetIdx = direction === 'up' ? index - 1 : index + 1;
    if (targetIdx < 0 || targetIdx >= photos.length) return;
    const list = [...photos];
    const temp = list[index];
    list[index] = list[targetIdx];
    list[targetIdx] = temp;
    setPhotos(list.map((item, idx) => ({ ...item, orderIndex: idx })));
  };

  const handleAddAttachment = async () => {
    const res = await tauriBridge.pickDocumentFile();
    if (res) {
      const newAtt: DocumentAttachment = {
        id: `att-${Date.now()}`,
        fileName: res.fileName,
        fileSize: res.fileSize,
        fileType: res.fileName.endsWith('.pdf') ? 'application/pdf' : 'application/octet-stream',
        dataUrl: res.fileData as string,
        uploadedAt: new Date().toISOString()
      };
      setAttachments([...attachments, newAtt]);
    }
  };

  const handleCustomFieldChange = (key: string, value: any) => {
    setCustomFields((prev) => ({
      ...prev,
      [key]: value
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProductCode.trim()) {
      setError('Please enter a Product Code.');
      return;
    }
    if (!registeredBy.trim()) {
      setError('Registered By is mandatory to track the person who entered the sample.');
      return;
    }

    const codeClean = selectedProductCode.trim().toLowerCase();
    const isDuplicate = registrations.some(
      (r) => r.productCode.toLowerCase() === codeClean && (!existingRegistration || r.id !== existingRegistration.id)
    );

    if (isDuplicate) {
      setError(`Product Code "${selectedProductCode.trim()}" is already registered. Please edit the existing registration or select a different item.`);
      return;
    }

    setIsSubmitting(true);
    setError(null);

    // Selected print photo IDs
    const selectedPrintPhotoIds = photos.filter(p => p.includeInPrint).map(p => p.id);
    const finalCategory = isCustomCategory ? customCategoryName.trim() : category.trim();

    const currentUser = userService.getCurrentUser();
    const isAdmin = currentUser?.role === 'admin';
    const initialStatus = existingRegistration?.status || (isAdmin ? 'APPROVED' : 'PENDING_APPROVAL');

    const res = await onSave({
      masterItemId: currentMasterItem?.id || '',
      productCode: selectedProductCode.trim(),
      materialType,
      category: finalCategory || 'Box',
      registrationDate: registrationDate || new Date().toISOString().split('T')[0],
      registeredBy: registeredBy.trim(),
      supplier: supplier.trim() || undefined,
      specification: specification.trim() || undefined,
      remarks: remarks.trim() || undefined,
      revision: revision.trim() || 'Rev 01',
      status: initialStatus,
      customFields,
      photos,
      attachments,
      selectedPrintPhotoIds,
      printLayout,
      wordFormGenerated: existingRegistration?.wordFormGenerated || false,
      wordFormLastGeneratedAt: existingRegistration?.wordFormLastGeneratedAt
    });

    setIsSubmitting(false);
    if (res.success) {
      onClose();
    } else {
      setError(res.error || 'Failed to save reference registration.');
    }
  };

  const printPhotosCount = photos.filter(p => p.includeInPrint).length;

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-[#161616] rounded-xl shadow-2xl border border-[#333] w-full max-w-3xl overflow-hidden my-6 animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="bg-[#0A0A0A] text-white px-5 py-4 flex items-center justify-between border-b border-[#222]">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-[#1A1A1A] border border-[#2A2A2A] rounded-lg text-blue-400">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-gray-100">
                {existingRegistration
                  ? existingRegistration.status === 'APPROVED'
                    ? 'Propose Reference Revision (Requires Approval)'
                    : 'Edit Pending Reference Registration'
                  : 'Register Material Reference Sample'}
              </h3>
              <p className="text-xs text-gray-400">
                {existingRegistration && existingRegistration.status !== 'APPROVED'
                  ? 'Update technical specifications, metadata and photos for pending sample (not counted as revision)'
                  : 'QA specimen physical verification, multi-photo print configuration & certificates'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white p-1 rounded-md transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5 max-h-[82vh] overflow-y-auto">
          {error && (
            <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-400 text-xs rounded-lg flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold">Registration Alert: </span>
                <span>{error}</span>
              </div>
            </div>
          )}

          {/* Section 1: Linked Product Code & Master Item Reference */}
          <div className="bg-[#141414] p-4 rounded-xl border border-[#222] space-y-3">
            <div className="text-xs font-mono font-bold text-gray-400 uppercase tracking-wider flex items-center justify-between">
              <span>1. Product Code & Catalog Reference</span>
              <span className="text-[11px] font-normal text-gray-500 lowercase">
                (Type manually or select from suggestions)
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="relative">
                <label className="block text-xs font-semibold text-gray-300 mb-1 font-mono flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <Tag className="w-3.5 h-3.5 text-blue-400" />
                    Product Code <span className="text-red-400">*</span>
                  </span>
                  {currentMasterItem ? (
                    <span className="text-[10px] text-green-400 font-mono flex items-center gap-1">
                      <Check className="w-3 h-3" /> Catalog Matched
                    </span>
                  ) : selectedProductCode.trim() ? (
                    <span className="text-[10px] text-amber-400 font-mono">
                      Custom Code
                    </span>
                  ) : null}
                </label>

                <div className="relative">
                  <input
                    type="text"
                    required
                    placeholder="Type product code (e.g. RM-101, SP-201)..."
                    value={selectedProductCode}
                    onChange={(e) => {
                      setSelectedProductCode(e.target.value);
                      setShowSuggestions(true);
                    }}
                    onFocus={() => setShowSuggestions(true)}
                    className="w-full text-xs pl-8 pr-8 py-2 bg-[#1A1A1A] border border-[#333] text-gray-100 rounded-lg focus:outline-hidden focus:border-blue-500 font-mono font-bold"
                    autoComplete="off"
                  />
                  <Search className="w-3.5 h-3.5 text-gray-500 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  {selectedProductCode && (
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedProductCode('');
                        setShowSuggestions(true);
                      }}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-200"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                {/* Auto-suggest dropdown lookup from Master Items */}
                {showSuggestions && suggestedMasterItems.length > 0 && (
                  <div
                    ref={suggestionsRef}
                    className="absolute left-0 right-0 top-full mt-1 bg-[#181818] border border-[#333] rounded-lg shadow-2xl z-50 max-h-56 overflow-y-auto divide-y divide-[#262626]"
                  >
                    <div className="px-3 py-1.5 bg-[#121212] text-[10px] font-mono text-gray-400 flex items-center justify-between">
                      <span>Suggested Master Items ({suggestedMasterItems.length})</span>
                      <span className="text-gray-500">Click to select</span>
                    </div>
                    {suggestedMasterItems.map((item) => {
                      const isSelected = item.productCode.toLowerCase() === selectedProductCode.trim().toLowerCase();
                      return (
                        <button
                          key={item.id}
                          type="button"
                          onMouseDown={(e) => {
                            e.preventDefault();
                            setSelectedProductCode(item.productCode);
                            setShowSuggestions(false);
                          }}
                          className={`w-full text-left px-3 py-2 text-xs flex items-center justify-between hover:bg-[#252525] transition-colors ${
                            isSelected ? 'bg-blue-600/15 text-blue-300' : 'text-gray-200'
                          }`}
                        >
                          <div className="flex flex-col min-w-0 pr-2">
                            <span className="font-mono font-bold text-gray-100 flex items-center gap-1.5">
                              {item.productCode}
                              <span className={`text-[9px] px-1.5 py-0.2 rounded font-sans font-medium ${
                                item.category === 'RM' ? 'bg-amber-500/15 text-amber-300' : 'bg-purple-500/15 text-purple-300'
                              }`}>
                                {item.category}
                              </span>
                            </span>
                            <span className="text-[11px] text-gray-400 truncate mt-0.5">
                              {item.description}
                            </span>
                          </div>
                          {isSelected && <Check className="w-3.5 h-3.5 text-blue-400 shrink-0" />}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-300 mb-1 font-mono">
                  Revision Designation <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Rev 01, Rev 02, Rev 03"
                  value={revision}
                  onChange={(e) => setRevision(e.target.value)}
                  className="w-full text-xs px-3 py-2 bg-[#1A1A1A] border border-[#333] text-gray-200 rounded-lg focus:outline-hidden focus:border-blue-500 font-semibold font-mono"
                />
              </div>
            </div>

            {/* Material Type & Category Classification (Auto-filled & Locked from Master Item) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-gray-300 uppercase tracking-wider mb-1 font-mono flex items-center justify-between">
                  <span>Material Type</span>
                  <span className="text-[10px] font-normal text-gray-400 flex items-center gap-1">
                    <Lock className="w-3 h-3 text-gray-500" />
                    Auto-filled / Locked
                  </span>
                </label>
                <div className="relative">
                  <input
                    type="text"
                    readOnly
                    tabIndex={-1}
                    value={materialType === 'PS' ? 'PS (Production Supply)' : 'RM (Raw Material)'}
                    className="w-full text-xs pl-3 pr-20 py-2 bg-[#141414] border border-[#333] text-cyan-300 font-mono font-medium rounded-lg focus:outline-hidden cursor-not-allowed select-all opacity-95"
                  />
                  <div className="absolute right-2.5 top-1/2 -translate-y-1/2 flex items-center gap-1 px-2 py-0.5 rounded bg-[#202020] border border-[#333] text-[10px] text-gray-400 font-mono pointer-events-none">
                    <Lock className="w-2.5 h-2.5 text-gray-400" />
                    <span>Master</span>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-300 uppercase tracking-wider mb-1 font-mono flex items-center justify-between">
                  <span>Category</span>
                  <span className="text-[10px] font-normal text-gray-400 flex items-center gap-1">
                    <Lock className="w-3 h-3 text-gray-500" />
                    Auto-filled / Locked
                  </span>
                </label>
                <div className="relative">
                  <input
                    type="text"
                    readOnly
                    tabIndex={-1}
                    value={category || 'Box'}
                    className="w-full text-xs pl-3 pr-20 py-2 bg-[#141414] border border-[#333] text-blue-300 font-mono font-medium rounded-lg focus:outline-hidden cursor-not-allowed select-all opacity-95"
                  />
                  <div className="absolute right-2.5 top-1/2 -translate-y-1/2 flex items-center gap-1 px-2 py-0.5 rounded bg-[#202020] border border-[#333] text-[10px] text-gray-400 font-mono pointer-events-none">
                    <Lock className="w-2.5 h-2.5 text-gray-400" />
                    <span>Master</span>
                  </div>
                </div>
              </div>
            </div>

            {currentMasterItem && (
              <div className="text-xs bg-[#1A1A1A] p-2.5 rounded-lg border border-[#2A2A2A] text-gray-300 flex items-center justify-between animate-in fade-in duration-150">
                <div>
                  <span className="font-medium text-gray-200">{currentMasterItem.description}</span>
                  <div className="flex items-center gap-2 mt-0.5 text-[11px] text-gray-400 font-mono">
                    <span>Type: <strong className="text-gray-300">{currentMasterItem.materialType || 'RM'}</strong></span>
                    <span>•</span>
                    <span>Category: <strong className="text-gray-300">{currentMasterItem.category || 'Box'}</strong></span>
                    <span>•</span>
                    <span>Status: <strong className="text-gray-300">{currentMasterItem.status}</strong></span>
                    {currentMasterItem.unit && (
                      <>
                        <span>•</span>
                        <span>Unit: {currentMasterItem.unit}</span>
                      </>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Section 2: Registration Authority & Metadata */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-gray-300 uppercase tracking-wider mb-1 font-mono flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5 text-cyan-400" />
                  Registered By
                </span>
                <span className="text-[10px] font-normal text-gray-400 flex items-center gap-1">
                  <Lock className="w-3 h-3 text-gray-500" />
                  Auto-filled / Locked
                </span>
              </label>
              <div className="relative">
                <input
                  type="text"
                  readOnly
                  tabIndex={-1}
                  value={registeredBy}
                  className="w-full text-xs pl-3 pr-24 py-2 bg-[#141414] border border-[#333] text-cyan-300 font-mono font-medium rounded-lg focus:outline-hidden cursor-not-allowed select-all opacity-95"
                />
                <div className="absolute right-2.5 top-1/2 -translate-y-1/2 flex items-center gap-1 px-2 py-0.5 rounded bg-[#202020] border border-[#333] text-[10px] text-gray-400 font-mono pointer-events-none">
                  <Lock className="w-2.5 h-2.5 text-gray-400" />
                  <span>Short Name</span>
                </div>
              </div>
              <p className="text-[11px] text-gray-500 mt-1">
                Auto-filled with the Short Name of the currently logged-in account.
              </p>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-300 uppercase tracking-wider mb-1 font-mono flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-blue-400" />
                  Registration Date
                </span>
                <span className="text-[10px] font-normal text-gray-400 flex items-center gap-1">
                  <Lock className="w-3 h-3 text-gray-500" />
                  Auto-filled / Locked
                </span>
              </label>
              <div className="relative">
                <input
                  type="text"
                  readOnly
                  tabIndex={-1}
                  value={registrationDate}
                  className="w-full text-xs pl-3 pr-20 py-2 bg-[#141414] border border-[#333] text-blue-300 font-mono font-medium rounded-lg focus:outline-hidden cursor-not-allowed select-all opacity-95"
                />
                <div className="absolute right-2.5 top-1/2 -translate-y-1/2 flex items-center gap-1 px-2 py-0.5 rounded bg-[#202020] border border-[#333] text-[10px] text-gray-400 font-mono pointer-events-none">
                  <Lock className="w-2.5 h-2.5 text-gray-400" />
                  <span>Date</span>
                </div>
              </div>
              <p className="text-[11px] text-gray-500 mt-1">
                Auto-assigned system date on sample registration.
              </p>
            </div>
          </div>

          {/* Supplier / Manufacturer Source */}
          <div>
            <label className="block text-xs font-bold text-gray-300 uppercase tracking-wider mb-1 font-mono">
              Supplier / Manufacturer Source
            </label>
            <input
              type="text"
              placeholder="e.g. Apex Metal Alloys Corp. / Lot #2026-08"
              value={supplier}
              onChange={(e) => setSupplier(e.target.value)}
              className="w-full text-xs px-3 py-2 bg-[#1A1A1A] border border-[#333] text-gray-200 rounded-lg focus:outline-hidden focus:border-blue-500"
            />
          </div>

          {/* Technical Specifications */}
          <div>
            <label className="block text-xs font-bold text-gray-300 uppercase tracking-wider mb-1 font-mono">
              Technical Specifications & Acceptance Tolerances
            </label>
            <textarea
              rows={3}
              placeholder="Dimensional tolerances, ASTM / ISO test standards, chemical/physical specifications, color standards, hardness, or finish requirements..."
              value={specification}
              onChange={(e) => setSpecification(e.target.value)}
              className="w-full text-xs px-3 py-2 bg-[#1A1A1A] border border-[#333] text-gray-200 rounded-lg focus:outline-hidden focus:border-blue-500"
            />
          </div>

          {/* Section 3: Multiple Sample Photos & Visual Attachments */}
          <div className="bg-[#141414] p-4 rounded-xl border border-[#222] space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#222] pb-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono font-bold text-gray-300 uppercase tracking-wider">
                    2. Reference Specimen Photos ({photos.length})
                  </span>
                </div>
                <p className="text-[11px] text-gray-400 mt-0.5">
                  Upload visual inspection reference photos and specimen angles for digital quality archive.
                </p>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  id="btn-upload-multiple-photos"
                  onClick={handleAddMultiplePhotos}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-500 px-3 py-1.5 rounded-lg transition-colors shadow-sm"
                >
                  <Plus className="w-3.5 h-3.5" /> Batch Upload Photos
                </button>
              </div>
            </div>

            {/* Drag & Drop Multi-Image Zone */}
            <div
              onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDropFiles}
              onClick={handleAddMultiplePhotos}
              className={`border-2 border-dashed rounded-xl p-4 text-center cursor-pointer transition-all ${
                isDragging
                  ? 'border-blue-400 bg-blue-500/10 text-blue-300'
                  : 'border-[#333] hover:border-blue-500/50 hover:bg-[#1A1A1A]/40 text-gray-400'
              }`}
            >
              <div className="flex items-center justify-center gap-2">
                <ImageIcon className="w-5 h-5 text-blue-400" />
                <span className="text-xs font-medium text-gray-300">
                  {photos.length === 0
                    ? 'Click or Drag & Drop multiple reference photos here (PNG, JPG, WebP)'
                    : 'Click or drop more photos to add to this reference sample'}
                </span>
              </div>
            </div>

            {/* Multi-Photo Grid */}
            {photos.length > 0 && (
              <div className="space-y-3 pt-1">
                {photos.map((photo, idx) => (
                  <div
                    key={photo.id}
                    className="p-3 rounded-lg border border-[#2A2A2A] bg-[#181818] transition-all flex flex-col sm:flex-row items-start gap-3"
                  >
                    {/* Thumbnail & Badges */}
                    <div className="relative shrink-0 w-full sm:w-28 h-24 bg-[#0A0A0A] rounded-lg border border-[#2A2A2A] overflow-hidden group">
                      <img
                        src={photo.dataUrl}
                        alt={photo.fileName}
                        className="w-full h-full object-cover"
                      />
                      {photo.isPrimary && (
                        <div className="absolute top-1.5 left-1.5 bg-amber-500 text-black px-1.5 py-0.5 rounded text-[10px] font-bold flex items-center gap-1 shadow-sm">
                          <Star className="w-2.5 h-2.5 fill-black" /> Primary
                        </div>
                      )}
                    </div>

                    {/* Metadata & Controls */}
                    <div className="flex-1 min-w-0 space-y-2 w-full">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs text-gray-200 font-bold">
                            #{idx + 1} {photo.fileName}
                          </span>
                          <span className="text-[10px] text-gray-500 font-mono">
                            ({Math.round(photo.fileSize / 1024)} KB)
                          </span>
                        </div>

                        {/* Primary Star & Remove */}
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => handleSetPrimaryPhoto(photo.id)}
                            className={`px-2 py-1 rounded text-xs flex items-center gap-1 font-medium transition-colors ${
                              photo.isPrimary
                                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                                : 'bg-[#222] text-gray-400 hover:text-amber-300 border border-[#333]'
                            }`}
                            title="Set as primary master image"
                          >
                            <Star className={`w-3 h-3 ${photo.isPrimary ? 'fill-amber-400 text-amber-400' : ''}`} />
                            <span>{photo.isPrimary ? 'Primary Image' : 'Set Primary'}</span>
                          </button>
                        </div>
                      </div>

                      {/* Inputs: Caption and Category */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <div>
                          <label className="block text-[10px] font-mono text-gray-400 mb-0.5">
                            Inspection Photo Caption
                          </label>
                          <input
                            type="text"
                            placeholder="e.g. Standard Surface Finish, Front Specimen..."
                            value={photo.caption || ''}
                            onChange={(e) => {
                              const updated = [...photos];
                              updated[idx].caption = e.target.value;
                              setPhotos(updated);
                            }}
                            className="w-full text-xs px-2.5 py-1.5 border border-[#333] rounded bg-[#1A1A1A] text-gray-200 focus:outline-hidden focus:border-blue-500"
                          />
                        </div>

                        <div>
                          <label className="block text-[10px] font-mono text-gray-400 mb-0.5">
                            Photo Category / Reference Type
                          </label>
                          <select
                            value={photo.photoCategory || 'OTHER'}
                            onChange={(e) => {
                              const updated = [...photos];
                              updated[idx].photoCategory = e.target.value as PhotoCategory;
                              setPhotos(updated);
                            }}
                            className="w-full text-xs px-2 py-1.5 border border-[#333] rounded bg-[#1A1A1A] text-gray-200 focus:outline-hidden focus:border-blue-500 font-mono cursor-pointer"
                          >
                            {PHOTO_CATEGORY_OPTIONS.map(opt => (
                              <option key={opt.value} value={opt.value} className="bg-[#1A1A1A] text-gray-200">
                                {opt.label}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>

                      {/* Order and Delete Controls */}
                      <div className="flex items-center justify-between pt-1 text-[11px] text-gray-500">
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            disabled={idx === 0}
                            onClick={() => handleMovePhoto(idx, 'up')}
                            className="p-1 text-gray-400 hover:text-white disabled:opacity-30 rounded hover:bg-[#222]"
                            title="Move photo up in print sequence"
                          >
                            <ArrowUp className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            disabled={idx === photos.length - 1}
                            onClick={() => handleMovePhoto(idx, 'down')}
                            className="p-1 text-gray-400 hover:text-white disabled:opacity-30 rounded hover:bg-[#222]"
                            title="Move photo down in print sequence"
                          >
                            <ArrowDown className="w-3.5 h-3.5" />
                          </button>
                          <span className="font-mono text-[10px] text-gray-400 ml-1">Order #{idx + 1}</span>
                        </div>

                        <button
                          type="button"
                          onClick={() => setPhotos(photos.filter((_, i) => i !== idx))}
                          className="text-red-400 hover:text-red-300 p-1 flex items-center gap-1 transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" /> Remove
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Section 4: Document Attachments */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-mono font-bold text-gray-400 uppercase tracking-wider">
                Reference Documents & Test Certificates ({attachments.length})
              </label>
              <button
                type="button"
                onClick={handleAddAttachment}
                className="inline-flex items-center gap-1 text-xs font-semibold text-blue-400 bg-[#1A1A1A] hover:bg-[#222] px-2.5 py-1 rounded-md border border-[#333] transition-colors"
              >
                <Plus className="w-3.5 h-3.5" /> Add Document
              </button>
            </div>

            {attachments.length > 0 && (
              <div className="space-y-1.5">
                {attachments.map((att, idx) => (
                  <div
                    key={att.id}
                    className="flex items-center justify-between p-2 rounded-lg bg-[#141414] border border-[#222] text-xs"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <Paperclip className="w-3.5 h-3.5 text-gray-500 shrink-0" />
                      <span className="font-medium text-gray-200 truncate">{att.fileName}</span>
                      <span className="text-[10px] text-gray-500 font-mono">
                        ({Math.round(att.fileSize / 1024)} KB)
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setAttachments(attachments.filter((_, i) => i !== idx))}
                      className="text-gray-500 hover:text-red-400 p-1 transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Remarks */}
          <div>
            <label className="block text-xs font-bold text-gray-300 uppercase tracking-wider mb-1 font-mono">
              Remarks & Quality Notes
            </label>
            <textarea
              rows={2}
              placeholder="Inspection notes, approved applications, expiry details, storage precautions..."
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              className="w-full text-xs px-3 py-2 bg-[#1A1A1A] border border-[#333] text-gray-200 rounded-lg focus:outline-hidden focus:border-blue-500"
            />
          </div>

          {/* Submission Workflow Info Banner */}
          <div className={`p-3 rounded-lg text-xs flex items-center gap-2.5 border ${
            userService.getCurrentUser()?.role === 'admin'
              ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-300'
              : 'bg-amber-500/10 border-amber-500/20 text-amber-300'
          }`}>
            <Clock className="w-4 h-4 shrink-0" />
            <div className="leading-snug">
              {userService.getCurrentUser()?.role === 'admin' ? (
                <span>
                  <strong className="text-emerald-200">Administrator Authority:</strong> Changes to this reference registration will be <strong>Approved & Activated</strong> immediately.
                </span>
              ) : existingRegistration && existingRegistration.status !== 'APPROVED' ? (
                <span>
                  <strong className="text-amber-200">Pending Item Update:</strong> This registration is currently <strong className="font-mono">PENDING APPROVAL</strong>. Saving changes will update the pending record directly without creating a new revision.
                </span>
              ) : (
                <span>
                  <strong className="text-amber-200">Approval Workflow:</strong> As a Standard User, this registration/revision will be submitted as <strong className="font-mono">PENDING APPROVAL</strong> and will require Administrator review before becoming official.
                </span>
              )}
            </div>
          </div>

          {/* Modal Actions */}
          <div className="pt-3 border-t border-[#222] flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-gray-400 hover:text-gray-200 hover:bg-[#222] rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm transition-colors disabled:opacity-50"
            >
              {isSubmitting
                ? 'Saving...'
                : existingRegistration && existingRegistration.status !== 'APPROVED'
                ? 'Save Pending Updates'
                : existingRegistration
                ? 'Submit Revision for Approval'
                : userService.getCurrentUser()?.role === 'admin'
                ? 'Confirm & Approve Registration'
                : 'Submit for Admin Approval'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

