import React, { useState, useEffect } from 'react';
import { WordDocPlaceholder, CustomFieldDefinition } from '../types';
import { X, Plus, Sparkles, Tag, FileText, CheckCircle2, AlertCircle, HelpCircle } from 'lucide-react';

interface NewPlaceholderModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSavePlaceholder: (placeholder: WordDocPlaceholder) => Promise<void>;
  editingPlaceholder?: WordDocPlaceholder | null;
  existingTags: string[];
  customFields?: CustomFieldDefinition[];
}

const CATEGORY_OPTIONS: Array<NonNullable<WordDocPlaceholder['category']>> = [
  'Custom',
  'Master',
  'Registration',
  'Sign-off',
  'QC Inspection',
  'Compliance',
  'Packaging',
  'CustomField',
  'System'
];

export const NewPlaceholderModal: React.FC<NewPlaceholderModalProps> = ({
  isOpen,
  onClose,
  onSavePlaceholder,
  editingPlaceholder,
  existingTags,
  customFields = []
}) => {
  const [tagName, setTagName] = useState('');
  const [label, setLabel] = useState('');
  const [desc, setDesc] = useState('');
  const [defaultValue, setDefaultValue] = useState('');
  const [sampleValue, setSampleValue] = useState('');
  const [category, setCategory] = useState<WordDocPlaceholder['category']>('Custom');
  const [linkedCustomFieldKey, setLinkedCustomFieldKey] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (editingPlaceholder) {
      // Strip {{ and }} for editing form
      const rawTag = editingPlaceholder.tag.replace(/^\{\{|\}\}$/g, '');
      setTagName(rawTag);
      setLabel(editingPlaceholder.label || rawTag);
      setDesc(editingPlaceholder.desc || '');
      setDefaultValue(editingPlaceholder.defaultValue || '');
      setSampleValue(editingPlaceholder.sampleValue || '');
      setCategory(editingPlaceholder.category || 'Custom');
      setLinkedCustomFieldKey(editingPlaceholder.customFieldKey || '');
      setError(null);
    } else {
      setTagName('');
      setLabel('');
      setDesc('');
      setDefaultValue('');
      setSampleValue('');
      setCategory('Custom');
      setLinkedCustomFieldKey('');
      setError(null);
    }
  }, [editingPlaceholder, isOpen]);

  if (!isOpen) return null;

  // Clean formatted tag preview
  const sanitizedTagKey = tagName
    .trim()
    .replace(/[^a-zA-Z0-9_]/g, '')
    .replace(/^_+|_+$/g, '');
  const formattedTag = sanitizedTagKey ? `{{${sanitizedTagKey}}}` : '{{placeholderName}}';

  const handleTagNameChange = (raw: string) => {
    // Strip braces if typed
    const clean = raw.replace(/[\{\}\s]/g, '');
    setTagName(clean);
    if (!label || label === tagName) {
      // Auto suggest human label (e.g. batchNumber -> Batch Number)
      const formattedLabel = clean
        .replace(/([A-Z])/g, ' $1')
        .replace(/^./, (str) => str.toUpperCase())
        .trim();
      setLabel(formattedLabel);
    }
    setError(null);
  };

  const handleLinkCustomField = (key: string) => {
    setLinkedCustomFieldKey(key);
    if (key) {
      const field = customFields.find((cf) => cf.key === key);
      if (field) {
        setTagName(field.key);
        setLabel(field.label);
        setDesc(`Value of custom inspection field: "${field.label}"`);
        setDefaultValue(field.defaultValue || '');
        setSampleValue(field.defaultValue || 'Sample Value');
        setCategory('CustomField');
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sanitizedTagKey) {
      setError('Please provide a valid alphanumeric placeholder tag name.');
      return;
    }

    const finalTag = `{{${sanitizedTagKey}}}`;

    // Check duplicate tag
    const isEditingCurrent = editingPlaceholder && editingPlaceholder.tag.toLowerCase() === finalTag.toLowerCase();
    if (!isEditingCurrent && existingTags.some((t) => t.toLowerCase() === finalTag.toLowerCase())) {
      setError(`Placeholder "${finalTag}" already exists. Please choose a different tag name.`);
      return;
    }

    if (!desc.trim()) {
      setError('Please enter a short description explaining what this placeholder replaces.');
      return;
    }

    setIsSubmitting(true);
    try {
      const placeholder: WordDocPlaceholder = {
        id: editingPlaceholder?.id || `ph_custom_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        tag: finalTag,
        label: label.trim() || sanitizedTagKey,
        desc: desc.trim(),
        category: category || 'Custom',
        defaultValue: defaultValue.trim() || undefined,
        sampleValue: sampleValue.trim() || defaultValue.trim() || 'N/A',
        isCustom: true,
        isSystem: false,
        customFieldKey: linkedCustomFieldKey || undefined,
        createdAt: editingPlaceholder?.createdAt || new Date().toISOString()
      };

      await onSavePlaceholder(placeholder);
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Failed to save placeholder.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-[#161616] rounded-xl shadow-2xl border border-[#333] w-full max-w-xl overflow-hidden my-6 animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="bg-[#0A0A0A] text-white px-6 py-4 flex items-center justify-between border-b border-[#222]">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-500/10 border border-blue-500/30 rounded-lg text-blue-400">
              <Tag className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-gray-100 flex items-center gap-2">
                {editingPlaceholder ? 'Edit Word Template Placeholder' : 'Add New Word Template Placeholder'}
                <span className="text-[10px] font-mono bg-blue-500/20 text-blue-300 px-2 py-0.5 rounded border border-blue-500/30">
                  .docx Dynamic Tag
                </span>
              </h3>
              <p className="text-xs text-gray-400">
                Define dynamic tags to automatically substitute data into Microsoft Word reference forms.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-gray-400 hover:text-white hover:bg-[#222] rounded-md transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-xs flex items-start gap-2 animate-in fade-in">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Quick link to custom fields if available */}
          {customFields.length > 0 && !editingPlaceholder && (
            <div className="p-3 bg-[#111827]/60 border border-blue-900/30 rounded-lg space-y-1.5">
              <label className="text-[11px] font-mono font-bold text-blue-400 uppercase tracking-wider flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-blue-400" />
                Quick Populate From Custom Inspection Field (Optional)
              </label>
              <select
                value={linkedCustomFieldKey}
                onChange={(e) => handleLinkCustomField(e.target.value)}
                className="w-full text-xs px-3 py-1.5 bg-[#0D1117] border border-[#2B3545] rounded-md text-gray-200 focus:outline-hidden focus:border-blue-500 font-mono"
              >
                <option value="">-- None (Create Independent Custom Placeholder) --</option>
                {customFields.map((cf) => (
                  <option key={cf.id} value={cf.key}>
                    {cf.label} [key: {cf.key}] ({cf.type})
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Tag Name & Live Preview */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-300 mb-1">
                Placeholder Key / Tag Name <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                placeholder="e.g. batchNumber, toolCalibration"
                value={tagName}
                onChange={(e) => handleTagNameChange(e.target.value)}
                className="w-full text-xs px-3 py-2 bg-[#1A1A1A] border border-[#333] text-gray-200 rounded-lg focus:outline-hidden focus:border-blue-500 font-mono"
                required
              />
              <p className="text-[10px] text-gray-500 mt-1 font-mono">
                Alphanumeric camelCase or snake_case
              </p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-300 mb-1">
                Formatted Word Tag (Word .docx)
              </label>
              <div className="h-9 px-3 bg-[#0E1726] border border-blue-500/40 rounded-lg flex items-center justify-between">
                <code className="text-xs font-mono font-bold text-blue-400">
                  {formattedTag}
                </code>
                <span className="text-[10px] text-blue-300/70 font-mono">Insert in .docx</span>
              </div>
              <p className="text-[10px] text-gray-500 mt-1 font-mono">
                Type this exact tag inside your Word template file.
              </p>
            </div>
          </div>

          {/* Human-readable Label & Category */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-300 mb-1">
                Field Label / Display Name <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                placeholder="e.g. Production Batch / Heat Number"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                className="w-full text-xs px-3 py-2 bg-[#1A1A1A] border border-[#333] text-gray-200 rounded-lg focus:outline-hidden focus:border-blue-500"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-300 mb-1">
                Category / Classification
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as WordDocPlaceholder['category'])}
                className="w-full text-xs px-3 py-2 bg-[#1A1A1A] border border-[#333] text-gray-200 rounded-lg focus:outline-hidden focus:border-blue-500"
              >
                {CATEGORY_OPTIONS.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-semibold text-gray-300 mb-1">
              Description / Intended Purpose <span className="text-red-400">*</span>
            </label>
            <textarea
              rows={2}
              placeholder="Describe what data this tag inserts into the generated Word document..."
              value={desc}
              onChange={(e) => setDesc(e.target.value)}
              className="w-full text-xs px-3 py-2 bg-[#1A1A1A] border border-[#333] text-gray-200 rounded-lg focus:outline-hidden focus:border-blue-500 resize-none"
              required
            />
          </div>

          {/* Default Value & Sample Preview */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-300 mb-1">
                Default Value (Fallback if empty)
              </label>
              <input
                type="text"
                placeholder="e.g. Standard Tolerance / N/A"
                value={defaultValue}
                onChange={(e) => setDefaultValue(e.target.value)}
                className="w-full text-xs px-3 py-2 bg-[#1A1A1A] border border-[#333] text-gray-200 rounded-lg focus:outline-hidden focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-300 mb-1">
                Sample Test Preview Value
              </label>
              <input
                type="text"
                placeholder="e.g. BATCH-2026-A09"
                value={sampleValue}
                onChange={(e) => setSampleValue(e.target.value)}
                className="w-full text-xs px-3 py-2 bg-[#1A1A1A] border border-[#333] text-gray-200 rounded-lg focus:outline-hidden focus:border-blue-500"
              />
            </div>
          </div>

          {/* Helpful Tips Card */}
          <div className="p-3 bg-[#111] rounded-lg border border-[#222] text-[11px] text-gray-400 space-y-1">
            <div className="font-semibold text-gray-300 flex items-center gap-1.5">
              <HelpCircle className="w-3.5 h-3.5 text-blue-400" />
              How to use in Microsoft Word:
            </div>
            <p className="text-gray-400 leading-relaxed pl-5">
              Open your Word template <code className="text-blue-400 font-mono">.docx</code> file, paste <code className="text-blue-400 font-mono font-bold">{formattedTag}</code> in any paragraph or table cell. During document generation, the system replaces this code with live registered sample values.
            </p>
          </div>

          {/* Footer Actions */}
          <div className="pt-3 border-t border-[#222] flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-gray-400 hover:text-white bg-[#1A1A1A] hover:bg-[#222] border border-[#333] rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-500 rounded-lg shadow-sm transition-colors flex items-center gap-1.5 disabled:opacity-50"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>{editingPlaceholder ? 'Save Changes' : 'Create Placeholder'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
