import React, { useState } from 'react';
import { CustomFieldDefinition } from '../types';
import { X, Plus, Trash2, Edit2, Sliders, AlertCircle, CheckCircle2 } from 'lucide-react';

interface CustomFieldsManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  fields: CustomFieldDefinition[];
  onSaveField: (field: CustomFieldDefinition) => Promise<void>;
  onDeleteField: (id: string) => Promise<void>;
}

export const CustomFieldsManagerModal: React.FC<CustomFieldsManagerModalProps> = ({
  isOpen,
  onClose,
  fields,
  onSaveField,
  onDeleteField
}) => {
  const [editingField, setEditingField] = useState<CustomFieldDefinition | null>(null);
  const [label, setLabel] = useState('');
  const [key, setKey] = useState('');
  const [type, setType] = useState<CustomFieldDefinition['type']>('text');
  const [categoryApplicability, setCategoryApplicability] = useState<string>('ALL');
  const [defaultValue, setDefaultValue] = useState('');
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const startEdit = (field: CustomFieldDefinition) => {
    setEditingField(field);
    setLabel(field.label);
    setKey(field.key);
    setType(field.type);
    setCategoryApplicability(field.categoryApplicability || 'ALL');
    setDefaultValue(field.defaultValue || '');
    setError(null);
  };

  const startNew = () => {
    setEditingField({
      id: `cf_${Date.now()}`,
      label: '',
      key: '',
      type: 'text',
      categoryApplicability: 'ALL',
      defaultValue: ''
    });
    setLabel('');
    setKey('');
    setType('text');
    setCategoryApplicability('ALL');
    setDefaultValue('');
    setError(null);
  };

  const handleLabelChange = (val: string) => {
    setLabel(val);
    if (!editingField || !editingField.key || editingField.id.startsWith('cf_')) {
      // Auto-generate camelCase key
      const camel = val
        .replace(/[^a-zA-Z0-9 ]/g, '')
        .split(' ')
        .map((w, idx) => (idx === 0 ? w.toLowerCase() : w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()))
        .join('');
      setKey(camel);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!label.trim()) {
      setError('Field Label is required.');
      return;
    }
    if (!key.trim()) {
      setError('Field Key is required.');
      return;
    }

    const fieldToSave: CustomFieldDefinition = {
      id: editingField?.id || `cf_${Date.now()}`,
      label: label.trim(),
      key: key.trim(),
      type,
      categoryApplicability,
      defaultValue: defaultValue.trim() || undefined
    };

    await onSaveField(fieldToSave);
    setEditingField(null);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-[#161616] rounded-xl shadow-2xl border border-[#333] w-full max-w-xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="bg-[#0A0A0A] text-white px-5 py-4 flex items-center justify-between border-b border-[#222]">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-[#1A1A1A] border border-[#2A2A2A] rounded-lg text-blue-400">
              <Sliders className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-gray-100">
                Modular Dynamic Custom Fields
              </h3>
              <p className="text-xs text-gray-400">
                Define and customize material reference attributes without modifying code
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

        {/* Content */}
        <div className="p-5 space-y-4 max-h-[80vh] overflow-y-auto">
          {editingField ? (
            <form onSubmit={handleSave} className="bg-[#141414] p-4 rounded-xl border border-[#222] space-y-3">
              <h4 className="text-xs font-mono font-bold text-gray-300 uppercase tracking-wider">
                {fields.some((f) => f.id === editingField.id) ? 'Edit Dynamic Field' : 'Create New Dynamic Field'}
              </h4>

              {error && (
                <div className="p-2.5 bg-red-500/10 border border-red-500/20 text-red-400 text-xs rounded-lg flex items-center gap-1.5">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-300 mb-1 font-mono">
                    Display Label <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Storage Shelf / Bin"
                    value={label}
                    onChange={(e) => handleLabelChange(e.target.value)}
                    className="w-full text-xs px-3 py-2 bg-[#1A1A1A] border border-[#333] text-gray-200 rounded-lg focus:outline-hidden focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-300 mb-1 font-mono">
                    Attribute Key <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. storageLocation"
                    value={key}
                    onChange={(e) => setKey(e.target.value)}
                    className="w-full text-xs px-3 py-2 bg-[#1A1A1A] border border-[#333] text-gray-200 rounded-lg font-mono focus:outline-hidden focus:border-blue-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-300 mb-1 font-mono">
                    Data Type
                  </label>
                  <select
                    value={type}
                    onChange={(e) => setType(e.target.value as any)}
                    className="w-full text-xs px-3 py-2 bg-[#1A1A1A] border border-[#333] text-gray-200 rounded-lg focus:outline-hidden focus:border-blue-500 cursor-pointer"
                  >
                    <option value="text" className="bg-[#1A1A1A] text-gray-200">Text String</option>
                    <option value="number" className="bg-[#1A1A1A] text-gray-200">Numeric Value</option>
                    <option value="boolean" className="bg-[#1A1A1A] text-gray-200">Yes / No (Boolean)</option>
                    <option value="date" className="bg-[#1A1A1A] text-gray-200">Date</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-300 mb-1 font-mono">
                    Applicable Category
                  </label>
                  <select
                    value={categoryApplicability}
                    onChange={(e) => setCategoryApplicability(e.target.value as any)}
                    className="w-full text-xs px-3 py-2 bg-[#1A1A1A] border border-[#333] text-gray-200 rounded-lg focus:outline-hidden focus:border-blue-500 cursor-pointer"
                  >
                    <option value="ALL" className="bg-[#1A1A1A] text-gray-200">All Materials (RM & PS)</option>
                    <option value="RM" className="bg-[#1A1A1A] text-gray-200">Raw Materials Only (RM)</option>
                    <option value="PS" className="bg-[#1A1A1A] text-gray-200">Production Supplies Only (PS)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-300 mb-1 font-mono">
                  Default Value
                </label>
                <input
                  type="text"
                  placeholder="Optional preset default value"
                  value={defaultValue}
                  onChange={(e) => setDefaultValue(e.target.value)}
                  className="w-full text-xs px-3 py-2 bg-[#1A1A1A] border border-[#333] text-gray-200 rounded-lg focus:outline-hidden focus:border-blue-500"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setEditingField(null)}
                  className="px-3 py-1.5 text-xs font-semibold text-gray-400 hover:text-gray-200 hover:bg-[#222] rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm transition-colors"
                >
                  Save Attribute
                </button>
              </div>
            </form>
          ) : (
            <div className="flex justify-between items-center">
              <span className="text-xs font-mono font-bold text-gray-400 uppercase tracking-wider">
                Configured Attributes ({fields.length})
              </span>
              <button
                type="button"
                onClick={startNew}
                className="inline-flex items-center gap-1 text-xs font-semibold bg-blue-600 text-white px-3 py-1.5 rounded-lg hover:bg-blue-700 transition-colors shadow-sm"
              >
                <Plus className="w-3.5 h-3.5" /> Add Attribute
              </button>
            </div>
          )}

          {/* List of Defined Custom Fields */}
          <div className="space-y-2">
            {fields.map((f) => (
              <div
                key={f.id}
                className="p-3 bg-[#141414] border border-[#222] rounded-xl flex items-center justify-between gap-3 hover:border-[#333] transition-colors"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <strong className="text-xs font-bold text-gray-200">{f.label}</strong>
                    <code className="text-[10px] font-mono text-blue-400 bg-[#1A1A1A] px-1.5 py-0.5 rounded border border-[#2A2A2A]">
                      {f.key}
                    </code>
                    <span className="text-[10px] bg-[#1A1A1A] text-gray-400 px-1.5 py-0.5 rounded font-mono border border-[#2A2A2A]">
                      {f.type}
                    </span>
                  </div>
                  <div className="text-[11px] text-gray-400 mt-0.5 font-mono">
                    Category: <strong className="text-gray-300">{f.categoryApplicability || 'ALL'}</strong>
                    {f.defaultValue && <span> • Default: "{f.defaultValue}"</span>}
                  </div>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => startEdit(f)}
                    className="p-1.5 text-gray-400 hover:text-gray-200 hover:bg-[#222] rounded-md transition-colors"
                    title="Edit Attribute"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => onDeleteField(f.id)}
                    className="p-1.5 text-gray-400 hover:text-red-400 hover:bg-red-500/10 rounded-md transition-colors"
                    title="Delete Attribute"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 bg-[#0A0A0A] border-t border-[#222] flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-gray-300 hover:text-white bg-[#1A1A1A] hover:bg-[#222] border border-[#333] rounded-lg transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
