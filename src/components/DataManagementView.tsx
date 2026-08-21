import React, { useState } from 'react';
import { AppConfig, MasterItem, ReferenceRegistration } from '../types';
import { HardDrive, FolderOpen, Download, Upload, RefreshCw, AlertTriangle, ShieldCheck, CheckCircle2, Sliders, Database, FileText, Image, Paperclip, Clock, Calendar, Check, History } from 'lucide-react';
import { tauriBridge } from '../services/tauriService';
import { db } from '../services/db';
import { CustomFieldsManagerModal } from './CustomFieldsManagerModal';

interface DataManagementViewProps {
  config: AppConfig;
  masterItems: MasterItem[];
  registrations: ReferenceRegistration[];
  onRefreshData: () => Promise<void>;
  onConfigChange: (newConfig: Partial<AppConfig>) => Promise<void>;
}

export const DataManagementView: React.FC<DataManagementViewProps> = ({
  config,
  masterItems,
  registrations,
  onRefreshData,
  onConfigChange
}) => {
  const [isBackingUp, setIsBackingUp] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);
  const [isCustomFieldsOpen, setIsCustomFieldsOpen] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [dailyBackups, setDailyBackups] = useState(() => db.getDailyAutoBackups());

  const reloadDailyBackups = () => {
    setDailyBackups(db.getDailyAutoBackups());
  };

  const handleRestoreDailyBackup = async (backupId: string, dateStr: string) => {
    if (!confirm(`Restore system state from automatic daily backup taken on ${dateStr}? Current state will be safely snapshotted.`)) {
      return;
    }
    setIsRestoring(true);
    try {
      const res = await db.restoreDailyAutoBackup(backupId, config.defaultRegisteredBy || 'User');
      if (res.success) {
        await onRefreshData();
        reloadDailyBackups();
        setStatusMessage({ type: 'success', text: res.message });
      } else {
        setStatusMessage({ type: 'error', text: res.message });
      }
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: `Failed to restore daily backup: ${err?.message || 'Unknown error'}` });
    } finally {
      setIsRestoring(false);
    }
  };

  const handleOpenDataFolder = async () => {
    try {
      const openedPath = await tauriBridge.openDataFolder(config.dataDirectory);
      setStatusMessage({
        type: 'info',
        text: `Data directory opened: ${openedPath}`
      });
    } catch (err: any) {
      console.error(err);
    }
  };

  const handleCreateBackup = async () => {
    setIsBackingUp(true);
    setStatusMessage(null);
    try {
      const zipBlob = await db.createBackupZip();
      const dateStr = new Date().toISOString().split('T')[0];
      const filename = `ReferenceTracker_Backup_${dateStr}.zip`;
      tauriBridge.saveFileBlob(zipBlob, filename);

      setStatusMessage({
        type: 'success',
        text: `Complete portable backup saved as "${filename}". Includes SQLite database, photos, documents, and system configuration.`
      });
    } catch (err: any) {
      console.error('Backup error:', err);
      setStatusMessage({
        type: 'error',
        text: `Failed to create backup: ${err.message || 'Unknown error'}`
      });
    } finally {
      setIsBackingUp(false);
    }
  };

  const handleRestoreBackup = async () => {
    setStatusMessage(null);
    const fileRes = await tauriBridge.pickBackupZipFile();
    if (!fileRes || !fileRes.fileData) return;

    if (!confirm('Warning: Restoring will merge/replace your local database and reference files. An automatic safety backup snapshot will be saved. Do you want to proceed?')) {
      return;
    }

    setIsRestoring(true);
    try {
      const res = await db.restoreBackupZip(fileRes.fileData as ArrayBuffer, config.defaultRegisteredBy || 'User');
      if (res.success) {
        await onRefreshData();
        setStatusMessage({
          type: 'success',
          text: res.message
        });
      } else {
        setStatusMessage({
          type: 'error',
          text: res.message
        });
      }
    } catch (err: any) {
      console.error('Restore error:', err);
      setStatusMessage({
        type: 'error',
        text: `Failed to restore: ${err.message || 'Unknown error'}`
      });
    } finally {
      setIsRestoring(false);
    }
  };

  const handleResetSampleData = async () => {
    setShowResetConfirm(false);
    await db.resetToSampleData(config.defaultRegisteredBy || 'Admin');
    await onRefreshData();
    setStatusMessage({
      type: 'success',
      text: 'Database successfully reset to standard baseline reference sample catalog.'
    });
  };

  return (
    <div className="space-y-6 select-none">
      {/* Overview Card */}
      <div className="bg-[#141414] rounded-xl border border-[#222] p-6 shadow-xs">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className="p-3 bg-[#1A1A1A] border border-[#2A2A2A] text-blue-400 rounded-xl shrink-0">
              <HardDrive className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-base font-bold text-gray-100">
                Portable Data Management & Database Storage
              </h2>
              <p className="text-xs text-gray-400 mt-1 max-w-2xl leading-relaxed">
                Because this application runs as a portable Windows executable, your SQLite database (<code className="text-blue-400 font-mono text-[11px] bg-[#222] px-1.5 py-0.5 rounded border border-[#333]">material_reference.db</code>), photos, and Word templates are kept strictly separate from the EXE. Replacing the EXE will never erase your data.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={handleOpenDataFolder}
              className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-gray-200 bg-[#222] hover:bg-[#2A2A2A] rounded-lg transition-colors border border-[#333]"
            >
              <FolderOpen className="w-4 h-4 text-gray-400" />
              <span>Open Data Folder</span>
            </button>
            <button
              onClick={handleCreateBackup}
              disabled={isBackingUp}
              className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm transition-colors disabled:opacity-50"
            >
              <Download className="w-4 h-4" />
              <span>{isBackingUp ? 'Archiving...' : 'Create Full Backup (.zip)'}</span>
            </button>
          </div>
        </div>

        {/* Status Message */}
        {statusMessage && (
          <div
            className={`mt-4 p-3 rounded-lg border text-xs flex items-start gap-2 ${
              statusMessage.type === 'success'
                ? 'bg-green-500/10 border-green-500/20 text-green-400'
                : statusMessage.type === 'error'
                ? 'bg-red-500/10 border-red-500/20 text-red-400'
                : 'bg-blue-500/10 border-blue-500/20 text-blue-400'
            }`}
          >
            {statusMessage.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-green-400 shrink-0 mt-0.5" />
            ) : statusMessage.type === 'error' ? (
              <AlertTriangle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
            ) : (
              <FolderOpen className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
            )}
            <span>{statusMessage.text}</span>
          </div>
        )}
      </div>

      {/* 2-Column Storage & Actions Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Storage Directory Structure Card */}
        <div className="bg-[#141414] rounded-xl border border-[#222] p-5 shadow-xs space-y-4">
          <h3 className="text-xs font-mono font-bold text-gray-400 uppercase tracking-wider flex items-center justify-between">
            <span>Desktop Storage Architecture</span>
            <span className="text-[10px] text-green-400 bg-green-500/10 border border-green-500/20 px-2 py-0.5 rounded font-semibold font-mono">
              SQLite Persistent
            </span>
          </h3>

          <div className="bg-[#0A0A0A] border border-[#222] text-gray-300 p-4 rounded-xl font-mono text-xs space-y-2 overflow-x-auto shadow-inner">
            <div className="text-gray-400 font-bold">ReferenceTracker_Data/</div>
            <div className="pl-4 space-y-1 text-gray-300">
              <div className="flex items-center gap-2">
                <span className="text-blue-400">├── database/</span>
                <span className="text-gray-400 text-[11px] font-sans">material_reference.db (SQLite master catalog & registrations)</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-blue-400">├── references/</span>
              </div>
              <div className="pl-6 space-y-1 text-gray-400 text-[11px]">
                <div>├── PHOTOS/ (High-res specimen macro photos)</div>
                <div>├── ATTACHMENTS/ (PDF certificates, TDS, mill test reports)</div>
                <div>└── FORMS/ (Generated official Word .docx reference forms)</div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-blue-400">├── templates/</span>
                <span className="text-gray-400 text-[11px] font-sans">Reference_Form_Template.docx (Preserved original template)</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-blue-400">└── backups/</span>
                <span className="text-gray-400 text-[11px] font-sans">ReferenceTracker_Backup_*.zip</span>
              </div>
            </div>
          </div>

          <div className="text-xs text-gray-400 space-y-1 leading-relaxed">
            <p><strong className="text-gray-300">Configured Location:</strong> <span className="font-mono text-blue-400">{config.dataDirectory}</span></p>
            <p className="text-[11px] text-gray-500">
              To migrate to a new computer or USB, copy your portable EXE and the <span className="font-mono text-gray-400">ReferenceTracker_Data</span> folder together.
            </p>
          </div>
        </div>

        {/* Backup, Restore & Dynamic Fields Management */}
        <div className="space-y-4">
          {/* Daily Auto-Backup Status & History Card */}
          <div className="bg-[#141414] rounded-xl border border-[#222] p-5 shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-mono font-bold text-gray-400 uppercase tracking-wider flex items-center gap-2">
                <Clock className="w-3.5 h-3.5 text-green-400" />
                <span>Daily Auto-Backup System</span>
              </h3>
              <span className="text-[10px] bg-green-500/10 text-green-400 border border-green-500/20 px-2 py-0.5 rounded font-mono font-semibold flex items-center gap-1">
                <Check className="w-3 h-3" /> Runs on App Startup
              </span>
            </div>

            <p className="text-xs text-gray-400 leading-relaxed">
              The application automatically generates a complete snapshot once per calendar day upon opening, keeping a rolling 14-day history.
            </p>

            <div className="bg-[#0A0A0A] rounded-lg border border-[#222] p-3 text-xs space-y-2">
              <div className="flex items-center justify-between text-gray-400">
                <span className="flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-blue-400" />
                  <span>Last Automated Backup:</span>
                </span>
                <span className="font-mono text-gray-200 font-semibold">
                  {config.lastAutoBackupDate ? `${config.lastAutoBackupDate} (${new Date(config.lastAutoBackupTimestamp || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })})` : 'Today on launch'}
                </span>
              </div>

              {dailyBackups.length > 0 && (
                <div className="pt-2 border-t border-[#222] space-y-1.5 max-h-44 overflow-y-auto pr-1">
                  <span className="text-[10px] uppercase font-mono text-gray-500 block font-semibold">Available Daily Snapshots:</span>
                  {dailyBackups.map((b) => (
                    <div key={b.id} className="flex items-center justify-between bg-[#141414] border border-[#262626] px-2.5 py-1.5 rounded text-xs">
                      <div>
                        <div className="font-mono text-gray-200 font-semibold text-[11px]">{b.date}</div>
                        <div className="text-[10px] text-gray-500 font-mono">
                          {b.masterItemsCount} items · {b.registrationsCount} refs ({b.dataSizeEstimate})
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => db.downloadDailyBackupJson(b.id)}
                          className="px-2 py-1 text-[10px] font-semibold bg-[#222] hover:bg-[#2A2A2A] text-gray-300 rounded border border-[#333] transition-colors"
                          title="Download backup JSON"
                        >
                          JSON
                        </button>
                        <button
                          onClick={() => handleRestoreDailyBackup(b.id, b.date)}
                          disabled={isRestoring}
                          className="px-2 py-1 text-[10px] font-semibold bg-blue-600/20 hover:bg-blue-600/40 text-blue-400 border border-blue-500/30 rounded transition-colors disabled:opacity-50"
                        >
                          Restore
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Backup & Restore Action Box */}
          <div className="bg-[#141414] rounded-xl border border-[#222] p-5 shadow-xs space-y-3">
            <h3 className="text-xs font-mono font-bold text-gray-400 uppercase tracking-wider">
              Backup & Disaster Recovery
            </h3>
            <p className="text-xs text-gray-400">
              Create a compressed <code className="font-mono text-blue-400 bg-[#222] px-1 py-0.5 rounded">.ZIP</code> archive containing the complete database, photos, documents, and config, or restore from a previous archive:
            </p>

            <div className="grid grid-cols-2 gap-3 pt-1">
              <button
                onClick={handleCreateBackup}
                disabled={isBackingUp}
                className="flex items-center justify-center gap-2 py-2.5 px-3 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm transition-colors disabled:opacity-50"
              >
                <Download className="w-4 h-4" />
                <span>{isBackingUp ? 'Creating ZIP...' : 'Backup All Data (.zip)'}</span>
              </button>

              <button
                onClick={handleRestoreBackup}
                disabled={isRestoring}
                className="flex items-center justify-center gap-2 py-2.5 px-3 text-xs font-semibold text-gray-200 bg-[#222] hover:bg-[#2A2A2A] rounded-lg transition-colors border border-[#333]"
              >
                <Upload className="w-4 h-4 text-gray-400" />
                <span>{isRestoring ? 'Restoring...' : 'Restore from Backup'}</span>
              </button>
            </div>
          </div>

          {/* Dynamic Custom Fields Trigger (Requirement 20) */}
          <div className="bg-[#141414] rounded-xl border border-[#222] p-5 shadow-xs flex items-center justify-between gap-4">
            <div>
              <h4 className="text-xs font-mono font-bold text-gray-400 uppercase tracking-wider">
                Dynamic Schema Custom Fields
              </h4>
              <p className="text-xs text-gray-400 mt-0.5">
                Add, remove, or modify custom reference attributes (shelf location, hazardous flags, etc.) without rebuilding.
              </p>
            </div>
            <button
              onClick={() => setIsCustomFieldsOpen(true)}
              className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-blue-400 bg-[#1A1A1A] hover:bg-[#222] rounded-lg border border-[#333] transition-colors shrink-0"
            >
              <Sliders className="w-4 h-4" />
              <span>Configure Fields ({config.customFields?.length || 0})</span>
            </button>
          </div>

          {/* Database Reset Option */}
          <div className="bg-[#141414] rounded-xl border border-[#222] p-5 shadow-xs flex items-center justify-between gap-4">
            <div>
              <h4 className="text-xs font-mono font-bold text-gray-400 uppercase tracking-wider">
                Demonstration Baseline Reset
              </h4>
              <p className="text-xs text-gray-400 mt-0.5">
                Reload factory standard Raw Materials (RM) and Production Supplies (PS) reference specimens.
              </p>
            </div>
            <button
              onClick={() => setShowResetConfirm(true)}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-gray-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors shrink-0 border border-transparent hover:border-red-500/20"
            >
              <RefreshCw className="w-4 h-4" />
              <span>Reset to Sample Data</span>
            </button>
          </div>
        </div>
      </div>

      {/* Reset Confirmation Modal */}
      {showResetConfirm && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-[#161616] rounded-xl shadow-2xl border border-[#333] w-full max-w-md p-5 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-start gap-3">
              <div className="p-2 bg-amber-500/10 border border-amber-500/20 text-amber-400 rounded-lg shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-gray-100">Reset Reference Database?</h3>
                <p className="text-xs text-gray-400 mt-1 leading-relaxed">
                  This will reload standard initial Raw Materials (RM-SS-304, RM-AL-6061, RM-POLY-HDPE) and Production Supplies (PS-NIT-GLOVE, PS-LUB-SYN) sample records.
                </p>
              </div>
            </div>

            <div className="mt-5 pt-3 border-t border-[#222] flex items-center justify-end gap-2">
              <button
                onClick={() => setShowResetConfirm(false)}
                className="px-3.5 py-1.5 text-xs font-semibold text-gray-400 hover:text-gray-200 hover:bg-[#222] rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleResetSampleData}
                className="px-4 py-1.5 text-xs font-semibold text-white bg-amber-600 hover:bg-amber-700 rounded-lg shadow-sm transition-colors"
              >
                Confirm Reset
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Dynamic Custom Fields Modal */}
      <CustomFieldsManagerModal
        isOpen={isCustomFieldsOpen}
        onClose={() => setIsCustomFieldsOpen(false)}
        fields={config.customFields || []}
        onSaveField={async (field) => {
          await db.saveCustomField(field, config.defaultRegisteredBy || 'Admin');
          await onRefreshData();
        }}
        onDeleteField={async (id) => {
          await db.deleteCustomField(id, config.defaultRegisteredBy || 'Admin');
          await onRefreshData();
        }}
      />
    </div>
  );
};
