import React, { useState, useEffect, useCallback } from 'react';
import {
  AppConfig,
  MasterItem,
  ReferenceRegistration,
  AuditLogEntry,
  NavigationTab,
  WorkstationUser,
  SyncMessage,
  CustomFieldDefinition
} from '../types';
import {
  Settings,
  FolderOpen,
  RefreshCw,
  Radio,
  Users,
  HardDrive,
  FileSpreadsheet,
  FileText,
  History,
  Sliders,
  CheckCircle2,
  AlertTriangle,
  Download,
  Upload,
  Cpu,
  Layers,
  ShieldCheck,
  Zap,
  Activity,
  Server,
  ArrowRight,
  Database,
  Check,
  X,
  Edit2,
  Plus,
  Trash2,
  Lock,
  ExternalLink,
  Clock,
  Sparkles,
  LayoutTemplate,
  Printer
} from 'lucide-react';
import { realtimeSync } from '../services/realtimeSync';
import { tauriBridge } from '../services/tauriService';
import { db } from '../services/db';
import { userService } from '../services/userService';
import { excelService } from '../services/excelService';
import { DEFAULT_CATEGORIES } from '../services/defaultData';
import { CustomFieldsManagerModal } from './CustomFieldsManagerModal';
import { ExcelManagerView } from './ExcelManagerView';
import { WordTemplateView } from './WordTemplateView';
import { FormTemplateManagementView } from './FormTemplateManagementView';
import { AuditTrailView } from './AuditTrailView';
import { RevisionApprovalQueueView } from './RevisionApprovalQueueView';
import { CategoriesManagerView } from './CategoriesManagerView';

interface AdminDashboardViewProps {
  config: AppConfig;
  masterItems: MasterItem[];
  registrations: ReferenceRegistration[];
  auditLogs: AuditLogEntry[];
  onRefreshData: () => Promise<void>;
  onConfigChange: (newConfig: Partial<AppConfig>) => Promise<void>;
  onNavigateTab: (tab: NavigationTab) => void;
  initialSubTab?: string;
}

export const AdminDashboardView: React.FC<AdminDashboardViewProps> = ({
  config,
  masterItems,
  registrations,
  auditLogs,
  onRefreshData,
  onConfigChange,
  onNavigateTab,
  initialSubTab
}) => {
  // Active sub-section within the Admin Dashboard
  const [activeAdminSubTab, setActiveAdminSubTab] = useState<
    'OVERVIEW' | 'APPROVAL_QUEUE' | 'CATEGORIES' | 'FORM_TEMPLATES' | 'SHARED_SYNC' | 'EXCEL' | 'WORD_TEMPLATES' | 'CUSTOM_FIELDS' | 'AUDIT' | 'BACKUP' | 'SETTINGS' | 'USER_ACCESS'
  >(
    initialSubTab === 'APPROVAL_QUEUE'
      ? 'APPROVAL_QUEUE'
      : initialSubTab === 'CATEGORIES'
      ? 'CATEGORIES'
      : initialSubTab === 'FORM_TEMPLATES'
      ? 'FORM_TEMPLATES'
      : initialSubTab === 'SHARED_FOLDER'
      ? 'SHARED_SYNC'
      : initialSubTab === 'EXCEL_MANAGER'
      ? 'EXCEL'
      : initialSubTab === 'WORD_TEMPLATES'
      ? 'FORM_TEMPLATES'
      : initialSubTab === 'AUDIT_TRAIL'
      ? 'AUDIT'
      : initialSubTab === 'DATA_MANAGEMENT'
      ? 'BACKUP'
      : 'OVERVIEW'
  );

  // Calculate pending revisions count across reference registry
  const pendingRevisionsCount = React.useMemo(() => {
    let count = 0;
    for (const reg of registrations) {
      if (reg.status === 'PENDING_APPROVAL') count++;
      if (reg.versions) {
        for (const rev of reg.versions) {
          if (rev.status === 'PENDING_APPROVAL' && rev.versionNumber > 1) {
            count++;
          }
        }
      }
    }
    return count;
  }, [registrations]);

  // User access registration states
  const [allowedIds, setAllowedIds] = useState(userService.getAllowedIds());
  const [registeredUsers, setRegisteredUsers] = useState(userService.getRegisteredUsers());
  const [newAllowedId, setNewAllowedId] = useState('');
  const [newAllowedRole, setNewAllowedRole] = useState<'admin' | 'user'>('user');
  const [newAllowedNote, setNewAllowedNote] = useState('');

  useEffect(() => {
    const unsubscribe = userService.subscribe(() => {
      setAllowedIds(userService.getAllowedIds());
      setRegisteredUsers(userService.getRegisteredUsers());
    });
    return () => unsubscribe();
  }, []);

  // Real-time peer workstation presence
  const [activeUsers, setActiveUsers] = useState<WorkstationUser[]>([]);
  const [syncLogs, setSyncLogs] = useState<SyncMessage[]>([]);
  const [isSyncingNow, setIsSyncingNow] = useState(false);
  const [lastManualSyncTime, setLastManualSyncTime] = useState<string | null>(null);

  // Settings form states
  const [sharedFolderPath, setSharedFolderPath] = useState(
    config.dataDirectory || 'Application Data/ReferenceTracker_Data/'
  );
  const [companyName, setCompanyName] = useState(config.companyName || 'Precision Industrial Corp.');
  const [defaultInspector, setDefaultInspector] = useState(config.defaultRegisteredBy || 'Juan Dela Cruz (QA)');
  const [workstationName, setWorkstationName] = useState(
    config.workstationName || realtimeSync.getCurrentUser().workstationName
  );
  const [syncEnabled, setSyncEnabled] = useState(config.sharedFolderSyncEnabled ?? true);
  const [autoSyncInterval, setAutoSyncInterval] = useState(config.autoSyncIntervalSec || 3);

  // Modals & Notifications
  const [isCustomFieldsModalOpen, setIsCustomFieldsModalOpen] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(
    null
  );
  const [isSavingConfig, setIsSavingConfig] = useState(false);
  const [isBackingUp, setIsBackingUp] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [dailyBackups, setDailyBackups] = useState(() => db.getDailyAutoBackups());

  // Subscribe to real-time sync & presence
  useEffect(() => {
    const unsubPresence = realtimeSync.subscribePresence((users) => {
      setActiveUsers(users);
    });

    const unsubSync = realtimeSync.subscribe((msg) => {
      setSyncLogs((prev) => [msg, ...prev.slice(0, 49)]);
    });

    return () => {
      unsubPresence();
      unsubSync();
    };
  }, []);

  // Update form fields if config changes externally
  useEffect(() => {
    setSharedFolderPath(config.dataDirectory || 'Application Data/ReferenceTracker_Data/');
    setCompanyName(config.companyName || 'Precision Industrial Corp.');
    setDefaultInspector(config.defaultRegisteredBy || 'Juan Dela Cruz (QA)');
    if (config.workstationName) setWorkstationName(config.workstationName);
    if (config.sharedFolderSyncEnabled !== undefined) setSyncEnabled(config.sharedFolderSyncEnabled);
    if (config.autoSyncIntervalSec !== undefined) setAutoSyncInterval(config.autoSyncIntervalSec);
  }, [config]);

  // Handle manual force sync
  const handleForceSync = async () => {
    setIsSyncingNow(true);
    try {
      await db.reloadFromDisk();
      await onRefreshData();
      realtimeSync.broadcastMutation('MUTATION_CONFIG_UPDATED', 'SHARED_SYNC', 'Manual force sync triggered by administrator');
      const nowStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      setLastManualSyncTime(nowStr);
      setStatusMessage({
        type: 'success',
        text: `Shared folder real-time synchronization complete (${nowStr}). Database and network cache updated.`
      });
    } catch (err: any) {
      setStatusMessage({
        type: 'error',
        text: `Manual sync failed: ${err?.message || 'Network directory unreachable'}`
      });
    } finally {
      setIsSyncingNow(false);
    }
  };

  // Handle configuration save
  const handleSaveSettings = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setIsSavingConfig(true);
    setStatusMessage(null);

    try {
      const updated: Partial<AppConfig> = {
        dataDirectory: sharedFolderPath.trim(),
        companyName: companyName.trim(),
        defaultRegisteredBy: defaultInspector.trim(),
        workstationName: workstationName.trim(),
        sharedFolderSyncEnabled: syncEnabled,
        autoSyncIntervalSec: Number(autoSyncInterval)
      };

      await onConfigChange(updated);
      realtimeSync.updateUserInfo(workstationName, defaultInspector);

      setStatusMessage({
        type: 'success',
        text: 'Admin settings and shared network synchronization preferences saved successfully.'
      });
    } catch (err: any) {
      setStatusMessage({
        type: 'error',
        text: `Failed to save settings: ${err?.message || 'Unknown error'}`
      });
    } finally {
      setIsSavingConfig(false);
    }
  };

  // Handle opening shared folder in system file explorer
  const handleOpenSharedDirectory = async () => {
    try {
      const path = await tauriBridge.openDataFolder(sharedFolderPath);
      setStatusMessage({
        type: 'info',
        text: `Shared directory opened: ${path}`
      });
    } catch (err: any) {
      setStatusMessage({
        type: 'error',
        text: `Unable to open directory: ${err?.message || 'Path does not exist'}`
      });
    }
  };

  // Create manual ZIP backup
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
        text: `Complete backup saved as "${filename}". Includes SQLite database, photos, documents, and system config.`
      });
    } catch (err: any) {
      setStatusMessage({
        type: 'error',
        text: `Failed to create backup: ${err.message || 'Unknown error'}`
      });
    } finally {
      setIsBackingUp(false);
    }
  };

  // Restore ZIP backup
  const handleRestoreBackup = async () => {
    setStatusMessage(null);
    const fileRes = await tauriBridge.pickBackupZipFile();
    if (!fileRes || !fileRes.fileData) return;

    if (!confirm('Warning: Restoring will merge/replace your local database and reference files. An automatic safety snapshot will be created. Proceed?')) {
      return;
    }

    setIsRestoring(true);
    try {
      const res = await db.restoreBackupZip(fileRes.fileData as ArrayBuffer, defaultInspector);
      if (res.success) {
        await onRefreshData();
        setDailyBackups(db.getDailyAutoBackups());
        setStatusMessage({ type: 'success', text: res.message });
      } else {
        setStatusMessage({ type: 'error', text: res.message });
      }
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: `Failed to restore: ${err.message || 'Unknown error'}` });
    } finally {
      setIsRestoring(false);
    }
  };

  // Restore daily backup
  const handleRestoreDailyBackup = async (backupId: string, dateStr: string) => {
    if (!confirm(`Restore system snapshot taken on ${dateStr}? Current state will be safely snapshotted.`)) {
      return;
    }
    setIsRestoring(true);
    try {
      const res = await db.restoreDailyAutoBackup(backupId, defaultInspector);
      if (res.success) {
        await onRefreshData();
        setDailyBackups(db.getDailyAutoBackups());
        setStatusMessage({ type: 'success', text: res.message });
      } else {
        setStatusMessage({ type: 'error', text: res.message });
      }
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: `Failed to restore snapshot: ${err?.message || 'Unknown error'}` });
    } finally {
      setIsRestoring(false);
    }
  };

  // Custom Field Handlers
  const handleSaveCustomField = async (field: CustomFieldDefinition) => {
    const existingIndex = config.customFields.findIndex((f) => f.id === field.id);
    let newFields = [...config.customFields];
    if (existingIndex >= 0) {
      newFields[existingIndex] = field;
    } else {
      newFields.push(field);
    }
    await onConfigChange({ customFields: newFields });
    await onRefreshData();
  };

  const handleDeleteCustomField = async (id: string) => {
    const newFields = config.customFields.filter((f) => f.id !== id);
    await onConfigChange({ customFields: newFields });
    await onRefreshData();
  };

  const currentUser = realtimeSync.getCurrentUser();

  return (
    <div className="space-y-6 select-none font-sans pb-12">
      {/* Admin Dashboard Header Banner */}
      <div className="bg-[#141414] rounded-2xl border border-[#222] p-6 shadow-xl relative overflow-hidden">
        {/* Glow background effect */}
        <div className="absolute -right-20 -top-20 w-80 h-80 bg-blue-600/10 rounded-full blur-3xl pointer-events-none"></div>

        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6 relative z-10">
          <div className="flex items-start gap-4">
            <div className="p-3.5 bg-blue-600/10 border border-blue-500/20 text-blue-400 rounded-2xl shrink-0 shadow-inner">
              <Settings className="w-8 h-8" />
            </div>
            <div>
              <div className="flex items-center gap-3 flex-wrap">
                <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">
                  Admin Dashboard & Workstation Control Center
                </h1>
                <span className="px-2.5 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 uppercase tracking-wider flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                  Shared Sync Live
                </span>
              </div>
              <p className="text-xs text-gray-400 mt-1.5 max-w-3xl leading-relaxed">
                Centralized management hub for Shared Folder Real-Time Synchronization, multi-user workstation presence, Excel bulk imports, Word DOCX templates, custom field schema, and database disaster recovery.
              </p>
            </div>
          </div>

          {/* Right Action Quick Controls */}
          <div className="flex items-center gap-2.5 shrink-0 self-stretch lg:self-auto justify-end">
            <button
              onClick={handleForceSync}
              disabled={isSyncingNow}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white text-xs font-semibold rounded-xl shadow-md transition-all disabled:opacity-50"
              title="Force immediate re-synchronization with network directory and active peers"
            >
              <RefreshCw className={`w-4 h-4 ${isSyncingNow ? 'animate-spin' : ''}`} />
              <span>{isSyncingNow ? 'Syncing Network...' : 'Force Sync Now'}</span>
            </button>

            <button
              onClick={handleOpenSharedDirectory}
              className="flex items-center gap-2 px-3.5 py-2 bg-[#1C1C1C] hover:bg-[#252525] border border-[#333] text-gray-300 hover:text-white text-xs font-medium rounded-xl transition-all"
            >
              <FolderOpen className="w-4 h-4 text-blue-400" />
              <span className="hidden sm:inline">Open Shared Folder</span>
            </button>
          </div>
        </div>

        {/* Status Metrics Bar */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3 mt-6 pt-5 border-t border-[#222]">
          <div className="bg-[#1A1A1A] p-3 rounded-xl border border-[#2A2A2A]">
            <div className="text-[10px] text-gray-500 font-mono uppercase tracking-wider">Sync Status</div>
            <div className="text-sm font-bold text-emerald-400 flex items-center gap-1.5 mt-0.5">
              <Radio className="w-3.5 h-3.5 animate-pulse text-emerald-400" />
              <span>{syncEnabled ? 'Active' : 'Disabled'}</span>
            </div>
          </div>

          <div className="bg-[#1A1A1A] p-3 rounded-xl border border-[#2A2A2A]">
            <div className="text-[10px] text-gray-500 font-mono uppercase tracking-wider">Online Workstations</div>
            <div className="text-sm font-bold text-white flex items-center gap-1.5 mt-0.5">
              <Users className="w-3.5 h-3.5 text-blue-400" />
              <span>{activeUsers.length} Active</span>
            </div>
          </div>

          <div className="bg-[#1A1A1A] p-3 rounded-xl border border-[#2A2A2A]">
            <div className="text-[10px] text-gray-500 font-mono uppercase tracking-wider">Master Items</div>
            <div className="text-sm font-bold text-white flex items-center gap-1.5 mt-0.5">
              <Database className="w-3.5 h-3.5 text-purple-400" />
              <span>{masterItems.length} Cataloged</span>
            </div>
          </div>

          <div className="bg-[#1A1A1A] p-3 rounded-xl border border-[#2A2A2A]">
            <div className="text-[10px] text-gray-500 font-mono uppercase tracking-wider">Reference Registry</div>
            <div className="text-sm font-bold text-white flex items-center gap-1.5 mt-0.5">
              <ShieldCheck className="w-3.5 h-3.5 text-indigo-400" />
              <span>{registrations.length} Samples</span>
            </div>
          </div>

          <div className="bg-[#1A1A1A] p-3 rounded-xl border border-[#2A2A2A]">
            <div className="text-[10px] text-gray-500 font-mono uppercase tracking-wider">Auto-Sync Rate</div>
            <div className="text-sm font-bold text-gray-200 flex items-center gap-1.5 mt-0.5">
              <Zap className="w-3.5 h-3.5 text-amber-400" />
              <span>Every {autoSyncInterval}s</span>
            </div>
          </div>

          <div className="bg-[#1A1A1A] p-3 rounded-xl border border-[#2A2A2A]">
            <div className="text-[10px] text-gray-500 font-mono uppercase tracking-wider">Last Sync</div>
            <div className="text-xs font-mono font-semibold text-gray-300 truncate mt-1">
              {lastManualSyncTime || 'Real-Time'}
            </div>
          </div>
        </div>
      </div>

      {/* Alert Status Banner */}
      {statusMessage && (
        <div
          className={`p-4 rounded-xl border flex items-start justify-between gap-3 animate-in fade-in duration-200 ${
            statusMessage.type === 'success'
              ? 'bg-emerald-950/40 border-emerald-500/30 text-emerald-300'
              : statusMessage.type === 'error'
              ? 'bg-red-950/40 border-red-500/30 text-red-300'
              : 'bg-blue-950/40 border-blue-500/30 text-blue-300'
          }`}
        >
          <div className="flex items-start gap-2.5">
            {statusMessage.type === 'success' ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
            ) : statusMessage.type === 'error' ? (
              <AlertTriangle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
            ) : (
              <Zap className="w-5 h-5 text-blue-400 shrink-0 mt-0.5" />
            )}
            <p className="text-xs font-medium leading-relaxed">{statusMessage.text}</p>
          </div>
          <button
            onClick={() => setStatusMessage(null)}
            className="text-gray-400 hover:text-white p-1 rounded-lg"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Admin Dashboard Sub-Navigation Tabs */}
      <div className="flex items-center gap-1.5 border-b border-[#222] pb-3 overflow-x-auto select-none">
        <button
          onClick={() => setActiveAdminSubTab('OVERVIEW')}
          className={`flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-xl transition-all whitespace-nowrap ${
            activeAdminSubTab === 'OVERVIEW'
              ? 'bg-blue-600 text-white shadow-sm'
              : 'bg-[#141414] text-gray-400 hover:text-white hover:bg-[#1C1C1C] border border-[#222]'
          }`}
        >
          <Activity className="w-3.5 h-3.5" />
          <span>Dashboard Overview</span>
        </button>

        <button
          onClick={() => setActiveAdminSubTab('APPROVAL_QUEUE')}
          className={`flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-xl transition-all whitespace-nowrap ${
            activeAdminSubTab === 'APPROVAL_QUEUE'
              ? 'bg-amber-600 text-white shadow-sm'
              : 'bg-[#141414] text-gray-400 hover:text-white hover:bg-[#1C1C1C] border border-[#222]'
          }`}
        >
          <ShieldCheck className="w-3.5 h-3.5 text-amber-400" />
          <span>Approval Queue</span>
          {pendingRevisionsCount > 0 ? (
            <span className="px-1.5 py-0.2 rounded-full font-mono bg-amber-500 text-black text-[10px] font-bold animate-pulse">
              {pendingRevisionsCount} Pending
            </span>
          ) : (
            <span className="text-[10px] px-1.5 py-0.2 rounded font-mono bg-emerald-500/20 text-emerald-400 font-semibold">
              All Clear
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveAdminSubTab('CATEGORIES')}
          className={`flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-xl transition-all whitespace-nowrap ${
            activeAdminSubTab === 'CATEGORIES'
              ? 'bg-amber-600 text-white shadow-sm'
              : 'bg-[#141414] text-gray-400 hover:text-white hover:bg-[#1C1C1C] border border-[#222]'
          }`}
        >
          <Layers className="w-3.5 h-3.5 text-amber-400" />
          <span>Categories Management</span>
          <span className="text-[10px] px-1.5 py-0.2 rounded font-mono bg-amber-500/20 text-amber-300 font-semibold">
            {config.categories?.length ?? DEFAULT_CATEGORIES.length} Categories
          </span>
        </button>

        <button
          onClick={() => setActiveAdminSubTab('FORM_TEMPLATES')}
          className={`flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-xl transition-all whitespace-nowrap ${
            activeAdminSubTab === 'FORM_TEMPLATES'
              ? 'bg-blue-600 text-white shadow-sm'
              : 'bg-[#141414] text-gray-400 hover:text-white hover:bg-[#1C1C1C] border border-[#222]'
          }`}
        >
          <LayoutTemplate className="w-3.5 h-3.5 text-blue-400" />
          <span>Form Templates (Ref & Slip)</span>
          <span className="text-[10px] px-1.5 py-0.2 rounded font-mono bg-blue-500/20 text-blue-300 font-semibold">
            Custom Forms
          </span>
        </button>

        <button
          onClick={() => setActiveAdminSubTab('SHARED_SYNC')}
          className={`flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-xl transition-all whitespace-nowrap ${
            activeAdminSubTab === 'SHARED_SYNC'
              ? 'bg-blue-600 text-white shadow-sm'
              : 'bg-[#141414] text-gray-400 hover:text-white hover:bg-[#1C1C1C] border border-[#222]'
          }`}
        >
          <Radio className="w-3.5 h-3.5 text-emerald-400" />
          <span>Shared Folder Real-Time Sync</span>
          <span className="text-[10px] px-1.5 py-0.2 rounded font-mono bg-emerald-500/20 text-emerald-300 font-semibold">
            {activeUsers.length} Peers
          </span>
        </button>

        <button
          onClick={() => setActiveAdminSubTab('EXCEL')}
          className={`flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-xl transition-all whitespace-nowrap ${
            activeAdminSubTab === 'EXCEL'
              ? 'bg-blue-600 text-white shadow-sm'
              : 'bg-[#141414] text-gray-400 hover:text-white hover:bg-[#1C1C1C] border border-[#222]'
          }`}
        >
          <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
          <span>Excel Import & Export</span>
        </button>

        <button
          onClick={() => setActiveAdminSubTab('WORD_TEMPLATES')}
          className={`flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-xl transition-all whitespace-nowrap ${
            activeAdminSubTab === 'WORD_TEMPLATES'
              ? 'bg-blue-600 text-white shadow-sm'
              : 'bg-[#141414] text-gray-400 hover:text-white hover:bg-[#1C1C1C] border border-[#222]'
          }`}
        >
          <FileText className="w-3.5 h-3.5 text-blue-400" />
          <span>Word Form (DOCX)</span>
        </button>

        <button
          onClick={() => setActiveAdminSubTab('CUSTOM_FIELDS')}
          className={`flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-xl transition-all whitespace-nowrap ${
            activeAdminSubTab === 'CUSTOM_FIELDS'
              ? 'bg-blue-600 text-white shadow-sm'
              : 'bg-[#141414] text-gray-400 hover:text-white hover:bg-[#1C1C1C] border border-[#222]'
          }`}
        >
          <Sliders className="w-3.5 h-3.5 text-purple-400" />
          <span>Custom Fields ({config.customFields.length})</span>
        </button>

        <button
          onClick={() => setActiveAdminSubTab('BACKUP')}
          className={`flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-xl transition-all whitespace-nowrap ${
            activeAdminSubTab === 'BACKUP'
              ? 'bg-blue-600 text-white shadow-sm'
              : 'bg-[#141414] text-gray-400 hover:text-white hover:bg-[#1C1C1C] border border-[#222]'
          }`}
        >
          <HardDrive className="w-3.5 h-3.5 text-amber-400" />
          <span>Backup & Snapshots</span>
        </button>

        <button
          onClick={() => setActiveAdminSubTab('AUDIT')}
          className={`flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-xl transition-all whitespace-nowrap ${
            activeAdminSubTab === 'AUDIT'
              ? 'bg-blue-600 text-white shadow-sm'
              : 'bg-[#141414] text-gray-400 hover:text-white hover:bg-[#1C1C1C] border border-[#222]'
          }`}
        >
          <History className="w-3.5 h-3.5 text-cyan-400" />
          <span>Audit Trail</span>
        </button>

        <button
          onClick={() => setActiveAdminSubTab('SETTINGS')}
          className={`flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-xl transition-all whitespace-nowrap ${
            activeAdminSubTab === 'SETTINGS'
              ? 'bg-blue-600 text-white shadow-sm'
              : 'bg-[#141414] text-gray-400 hover:text-white hover:bg-[#1C1C1C] border border-[#222]'
          }`}
        >
          <Settings className="w-3.5 h-3.5 text-gray-400" />
          <span>Workstation Config</span>
        </button>

        <button
          onClick={() => setActiveAdminSubTab('USER_ACCESS')}
          className={`flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-xl transition-all whitespace-nowrap ${
            activeAdminSubTab === 'USER_ACCESS'
              ? 'bg-blue-600 text-white shadow-sm'
              : 'bg-[#141414] text-gray-400 hover:text-white hover:bg-[#1C1C1C] border border-[#222]'
          }`}
        >
          <Users className="w-3.5 h-3.5 text-blue-400" />
          <span>User Access Control</span>
        </button>
      </div>

      {/* SUB-SECTION 1: DASHBOARD OVERVIEW & QUICK MODULE LAUNCHERS */}
      {activeAdminSubTab === 'OVERVIEW' && (
        <div className="space-y-6 animate-in fade-in duration-150">
          {/* Quick Launch Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {/* Module 0: Revision Approval Workflow Queue */}
            <div
              onClick={() => setActiveAdminSubTab('APPROVAL_QUEUE')}
              className="bg-[#141414] hover:bg-[#191919] border border-[#222] hover:border-amber-500/40 rounded-2xl p-5 shadow-lg transition-all cursor-pointer group flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div className="p-3 bg-amber-500/10 border border-amber-500/20 text-amber-400 rounded-xl group-hover:scale-105 transition-transform">
                    <ShieldCheck className="w-6 h-6" />
                  </div>
                  <span className={`text-[10px] font-mono px-2 py-0.5 rounded font-bold uppercase ${
                    pendingRevisionsCount > 0
                      ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                      : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                  }`}>
                    {pendingRevisionsCount > 0 ? `${pendingRevisionsCount} Pending` : 'All Reviewed'}
                  </span>
                </div>
                <h3 className="text-base font-bold text-white group-hover:text-amber-300 transition-colors">
                  Revision Approval Queue
                </h3>
                <p className="text-xs text-gray-400 mt-1.5 leading-relaxed">
                  Strict quality governance: review proposed revisions, compare specification diffs side-by-side, approve official version promotions, or reject changes with mandatory feedback.
                </p>
              </div>
              <div className="mt-5 pt-3 border-t border-[#222] flex items-center justify-between text-xs text-amber-400 font-semibold">
                <span>Open Approval Queue</span>
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </div>
            </div>

            {/* Module 0.5: Item & Specimen Categories Management */}
            <div
              onClick={() => setActiveAdminSubTab('CATEGORIES')}
              className="bg-[#141414] hover:bg-[#191919] border border-[#222] hover:border-amber-500/40 rounded-2xl p-5 shadow-lg transition-all cursor-pointer group flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div className="p-3 bg-amber-500/10 border border-amber-500/20 text-amber-400 rounded-xl group-hover:scale-105 transition-transform">
                    <Layers className="w-6 h-6" />
                  </div>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-amber-500/15 text-amber-300 border border-amber-500/30 font-bold uppercase">
                    {config.categories?.length ?? DEFAULT_CATEGORIES.length} Categories
                  </span>
                </div>
                <h3 className="text-base font-bold text-white group-hover:text-amber-300 transition-colors">
                  Categories & Taxonomy Management
                </h3>
                <p className="text-xs text-gray-400 mt-1.5 leading-relaxed">
                  Configure material categories, export Excel reports (.xlsx), add custom taxonomies, or perform safe batch deletions with reference unlinking.
                </p>
              </div>
              <div className="mt-5 pt-3 border-t border-[#222] flex items-center justify-between text-xs text-amber-400 font-semibold">
                <span>Manage Categories</span>
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </div>
            </div>

            {/* Module 1: Shared Folder Real-Time Sync */}
            <div
              onClick={() => setActiveAdminSubTab('SHARED_SYNC')}
              className="bg-[#141414] hover:bg-[#191919] border border-[#222] hover:border-emerald-500/40 rounded-2xl p-5 shadow-lg transition-all cursor-pointer group flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-xl group-hover:scale-105 transition-transform">
                    <Radio className="w-6 h-6 animate-pulse" />
                  </div>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-bold uppercase">
                    Live Active
                  </span>
                </div>
                <h3 className="text-base font-bold text-white group-hover:text-emerald-300 transition-colors">
                  Shared Folder Real-Time Sync
                </h3>
                <p className="text-xs text-gray-400 mt-1.5 leading-relaxed">
                  Configure network folder paths, view connected workstations live, monitor auto-sync frequencies, and trigger manual database updates across workstations.
                </p>
              </div>
              <div className="mt-5 pt-3 border-t border-[#222] flex items-center justify-between text-xs text-emerald-400 font-semibold">
                <span>Configure Real-Time Sync</span>
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </div>
            </div>

            {/* Module 2: Excel Import & Export Manager */}
            <div
              onClick={() => setActiveAdminSubTab('EXCEL')}
              className="bg-[#141414] hover:bg-[#191919] border border-[#222] hover:border-blue-500/40 rounded-2xl p-5 shadow-lg transition-all cursor-pointer group flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div className="p-3 bg-blue-500/10 border border-blue-500/20 text-blue-400 rounded-xl group-hover:scale-105 transition-transform">
                    <FileSpreadsheet className="w-6 h-6" />
                  </div>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20 font-bold uppercase">
                    Bulk Tool
                  </span>
                </div>
                <h3 className="text-base font-bold text-white group-hover:text-blue-300 transition-colors">
                  Excel Import & Export Manager
                </h3>
                <p className="text-xs text-gray-400 mt-1.5 leading-relaxed">
                  Bulk import Master Reference Items from Excel spreadsheets, download standardized XLSX templates, and dump full reference registries into CSV format.
                </p>
              </div>
              <div className="mt-5 pt-3 border-t border-[#222] flex items-center justify-between text-xs text-blue-400 font-semibold">
                <span>Launch Excel Manager</span>
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </div>
            </div>

            {/* Module 3: Form Template Management (Reference Sheet & Proof Slip) */}
            <div
              onClick={() => setActiveAdminSubTab('FORM_TEMPLATES')}
              className="bg-[#141414] hover:bg-[#191919] border border-[#222] hover:border-blue-500/40 rounded-2xl p-5 shadow-lg transition-all cursor-pointer group flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div className="p-3 bg-blue-500/10 border border-blue-500/20 text-blue-400 rounded-xl group-hover:scale-105 transition-transform">
                    <LayoutTemplate className="w-6 h-6" />
                  </div>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20 font-bold uppercase">
                    Forms & Slips
                  </span>
                </div>
                <h3 className="text-base font-bold text-white group-hover:text-blue-300 transition-colors">
                  Form Template Management
                </h3>
                <p className="text-xs text-gray-400 mt-1.5 leading-relaxed">
                  Import, map, and activate custom templates for Material Reference Sheets (DOCX/HTML) and Inspection Proof Slips (HTML/Receipt TXT) with live specimen previews.
                </p>
              </div>
              <div className="mt-5 pt-3 border-t border-[#222] flex items-center justify-between text-xs text-blue-400 font-semibold">
                <span>Manage Form Templates</span>
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </div>
            </div>

            {/* Module 4: Custom Field Schema Manager */}
            <div
              onClick={() => setIsCustomFieldsModalOpen(true)}
              className="bg-[#141414] hover:bg-[#191919] border border-[#222] hover:border-amber-500/40 rounded-2xl p-5 shadow-lg transition-all cursor-pointer group flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div className="p-3 bg-amber-500/10 border border-amber-500/20 text-amber-400 rounded-xl group-hover:scale-105 transition-transform">
                    <Sliders className="w-6 h-6" />
                  </div>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20 font-bold uppercase">
                    Schema Builder
                  </span>
                </div>
                <h3 className="text-base font-bold text-white group-hover:text-amber-300 transition-colors">
                  Custom QA Fields Definition
                </h3>
                <p className="text-xs text-gray-400 mt-1.5 leading-relaxed">
                  Define additional QA parameters (e.g. Viscosity, Tensile Strength, Density, Expiration) and map them to Raw Materials (RM) or Production Supplies (PS).
                </p>
              </div>
              <div className="mt-5 pt-3 border-t border-[#222] flex items-center justify-between text-xs text-amber-400 font-semibold">
                <span>Configure Custom Fields</span>
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </div>
            </div>

            {/* Module 5: Database Backup & Snapshot Disaster Recovery */}
            <div
              onClick={() => setActiveAdminSubTab('BACKUP')}
              className="bg-[#141414] hover:bg-[#191919] border border-[#222] hover:border-indigo-500/40 rounded-2xl p-5 shadow-lg transition-all cursor-pointer group flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div className="p-3 bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 rounded-xl group-hover:scale-105 transition-transform">
                    <HardDrive className="w-6 h-6" />
                  </div>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 font-bold uppercase">
                    Disaster Recovery
                  </span>
                </div>
                <h3 className="text-base font-bold text-white group-hover:text-indigo-300 transition-colors">
                  Portable Backup & Snapshots
                </h3>
                <p className="text-xs text-gray-400 mt-1.5 leading-relaxed">
                  Create single-file ZIP backups containing SQLite database, high-resolution sample photos, attachments, and restore historical snapshots with zero data loss.
                </p>
              </div>
              <div className="mt-5 pt-3 border-t border-[#222] flex items-center justify-between text-xs text-indigo-400 font-semibold">
                <span>Backup & Snapshots Hub</span>
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </div>
            </div>

            {/* Module 6: System Audit Trail & Modification History */}
            <div
              onClick={() => setActiveAdminSubTab('AUDIT')}
              className="bg-[#141414] hover:bg-[#191919] border border-[#222] hover:border-cyan-500/40 rounded-2xl p-5 shadow-lg transition-all cursor-pointer group flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div className="p-3 bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 rounded-xl group-hover:scale-105 transition-transform">
                    <History className="w-6 h-6" />
                  </div>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 font-bold uppercase">
                    {auditLogs.length} Events
                  </span>
                </div>
                <h3 className="text-base font-bold text-white group-hover:text-cyan-300 transition-colors">
                  System Audit Trail Logs
                </h3>
                <p className="text-xs text-gray-400 mt-1.5 leading-relaxed">
                  Review complete, immutable audit logs tracking creation, edits, deletions, backups, and Word form generations across all QA inspector workstations.
                </p>
              </div>
              <div className="mt-5 pt-3 border-t border-[#222] flex items-center justify-between text-xs text-cyan-400 font-semibold">
                <span>View Full Audit Logs</span>
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </div>
            </div>
          </div>

          {/* Quick Real-Time Workstations Panel on Overview */}
          <div className="bg-[#141414] rounded-2xl border border-[#222] p-6 shadow-xl">
            <div className="flex items-center justify-between pb-4 border-b border-[#222] mb-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-xl">
                  <Users className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Active Peer Workstations</h3>
                  <p className="text-xs text-gray-400">
                    Live real-time presence across network workstations connected to the shared directory
                  </p>
                </div>
              </div>
              <button
                onClick={() => setActiveAdminSubTab('SHARED_SYNC')}
                className="text-xs font-bold text-blue-400 hover:text-blue-300 flex items-center gap-1"
              >
                <span>Sync Center</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {activeUsers.map((user) => {
                const isSelf = user.id === currentUser.id;
                return (
                  <div
                    key={user.id}
                    className={`p-4 rounded-xl border flex items-center justify-between gap-3 ${
                      isSelf
                        ? 'bg-blue-950/20 border-blue-500/30'
                        : 'bg-[#1A1A1A] border-[#2A2A2A]'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className="w-10 h-10 rounded-xl flex items-center justify-center font-black text-white text-xs shrink-0 shadow-md"
                        style={{ backgroundColor: user.color || '#3B82F6' }}
                      >
                        {user.workstationName.substring(0, 2).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-bold text-white truncate">{user.workstationName}</span>
                          {isSelf && (
                            <span className="text-[9px] px-1.5 py-0.2 rounded font-mono bg-blue-500/20 text-blue-300 font-bold uppercase">
                              This Station
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-gray-400 truncate mt-0.5">{user.userName}</p>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <span className="inline-flex items-center gap-1 text-[10px] font-mono text-emerald-400 font-semibold bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                        Online
                      </span>
                      <p className="text-[9px] text-gray-500 font-mono mt-1">
                        {user.currentTab || 'DASHBOARD'}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* SUB-SECTION: APPROVAL QUEUE */}
      {activeAdminSubTab === 'APPROVAL_QUEUE' && (
        <div className="space-y-6 animate-in fade-in duration-150">
          <RevisionApprovalQueueView
            registrations={registrations}
            masterItems={masterItems}
            config={config}
            onRefreshData={onRefreshData}
          />
        </div>
      )}

      {/* SUB-SECTION: CATEGORIES & TAXONOMY MANAGEMENT */}
      {activeAdminSubTab === 'CATEGORIES' && (
        <div className="space-y-6 animate-in fade-in duration-150">
          <CategoriesManagerView
            config={config}
            masterItems={masterItems}
            registrations={registrations}
            onRefreshData={onRefreshData}
            onConfigChange={onConfigChange}
            onNotify={(title, text, type) =>
              setStatusMessage({
                type: type === 'error' ? 'error' : type === 'success' ? 'success' : 'info',
                text: `${title}: ${text}`
              })
            }
          />
        </div>
      )}

      {/* SUB-SECTION 2: SHARED FOLDER REAL-TIME SYNC CONTROL HUB */}
      {activeAdminSubTab === 'SHARED_SYNC' && (
        <div className="space-y-6 animate-in fade-in duration-150">
          {/* Main Shared Sync Configuration Card */}
          <div className="bg-[#141414] rounded-2xl border border-[#222] p-6 shadow-xl space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-[#222]">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-xl">
                  <Radio className="w-6 h-6 animate-pulse" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-white">Shared Network Directory Sync Hub</h2>
                  <p className="text-xs text-gray-400">
                    Keep SQLite database, photos, and inspection forms synchronized across workstation network drives
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <label className="flex items-center gap-2 cursor-pointer bg-[#1A1A1A] px-3.5 py-2 rounded-xl border border-[#2A2A2A] text-xs font-medium text-gray-200">
                  <input
                    type="checkbox"
                    checked={syncEnabled}
                    onChange={(e) => setSyncEnabled(e.target.checked)}
                    className="rounded bg-[#222] border-[#444] text-emerald-500 focus:ring-emerald-500 w-4 h-4"
                  />
                  <span>Enable Shared Real-Time Sync</span>
                </label>

                <button
                  onClick={handleForceSync}
                  disabled={isSyncingNow}
                  className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl shadow-md transition-all disabled:opacity-50"
                >
                  <RefreshCw className={`w-4 h-4 ${isSyncingNow ? 'animate-spin' : ''}`} />
                  <span>Force Sync</span>
                </button>
              </div>
            </div>

            {/* Path & Sync Frequency Settings Form */}
            <form onSubmit={handleSaveSettings} className="space-y-5">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
                {/* Network Path Input */}
                <div className="lg:col-span-2 space-y-1.5">
                  <label className="text-xs font-bold text-gray-300 flex items-center justify-between">
                    <span>Shared Folder / Network Directory Path</span>
                    <span className="text-[10px] text-gray-500 font-mono">UNC or Local Path</span>
                  </label>
                  <div className="flex items-center gap-2">
                    <div className="relative flex-1">
                      <FolderOpen className="w-4 h-4 text-gray-400 absolute left-3 top-3 pointer-events-none" />
                      <input
                        type="text"
                        value={sharedFolderPath}
                        onChange={(e) => setSharedFolderPath(e.target.value)}
                        placeholder="e.g. \\192.168.1.100\QA_ReferenceTracker_Shared\ or Application Data/ReferenceTracker_Data/"
                        className="w-full pl-9 pr-3 py-2 text-xs font-mono bg-[#1C1C1C] border border-[#333] text-white rounded-xl focus:outline-hidden focus:border-emerald-500 transition-all"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={handleOpenSharedDirectory}
                      className="px-3.5 py-2 bg-[#222] hover:bg-[#2A2A2A] border border-[#333] text-gray-300 text-xs font-medium rounded-xl transition-all shrink-0"
                    >
                      Verify / Open Path
                    </button>
                  </div>
                  <p className="text-[11px] text-gray-500">
                    This directory houses <code className="text-emerald-400 font-mono">material_reference.db</code>, photos, attachments, and generated Word forms.
                  </p>
                </div>

                {/* Auto-Sync Polling Frequency */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-gray-300">Auto-Sync Heartbeat Frequency</label>
                  <select
                    value={autoSyncInterval}
                    onChange={(e) => setAutoSyncInterval(Number(e.target.value))}
                    className="w-full px-3 py-2 text-xs bg-[#1C1C1C] border border-[#333] text-white rounded-xl focus:outline-hidden focus:border-emerald-500 transition-all font-medium"
                  >
                    <option value={1}>Every 1 Second (Ultra-Fast)</option>
                    <option value={3}>Every 3 Seconds (Recommended)</option>
                    <option value={5}>Every 5 Seconds (Standard)</option>
                    <option value={10}>Every 10 Seconds (Low Bandwidth)</option>
                    <option value={30}>Every 30 Seconds (Manual / Batch)</option>
                  </select>
                  <p className="text-[11px] text-gray-500">
                    Frequency of cross-station peer discovery and mutation sync polls.
                  </p>
                </div>
              </div>

              <div className="flex justify-end pt-3 border-t border-[#222]">
                <button
                  type="submit"
                  disabled={isSavingConfig}
                  className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-lg transition-all flex items-center gap-2"
                >
                  <Check className="w-4 h-4" />
                  <span>{isSavingConfig ? 'Saving Configuration...' : 'Save Sync Settings'}</span>
                </button>
              </div>
            </form>
          </div>

          {/* Connected Peer Workstations Monitor */}
          <div className="bg-[#141414] rounded-2xl border border-[#222] p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#222]">
              <div className="flex items-center gap-2.5">
                <Users className="w-5 h-5 text-emerald-400" />
                <h3 className="text-base font-bold text-white">
                  Live Peer Workstations ({activeUsers.length})
                </h3>
              </div>
              <span className="text-xs font-mono text-gray-400">
                Network Channel: <code className="text-emerald-400 font-bold">mat_ref_live_sync_channel_v1</code>
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {activeUsers.map((user) => {
                const isSelf = user.id === currentUser.id;
                return (
                  <div
                    key={user.id}
                    className={`p-4 rounded-xl border flex items-start justify-between gap-3 ${
                      isSelf
                        ? 'bg-blue-950/20 border-blue-500/40'
                        : 'bg-[#1A1A1A] border-[#2A2A2A]'
                    }`}
                  >
                    <div className="flex items-start gap-3 min-w-0">
                      <div
                        className="w-10 h-10 rounded-xl flex items-center justify-center font-black text-white text-xs shrink-0 shadow-md mt-0.5"
                        style={{ backgroundColor: user.color || '#3B82F6' }}
                      >
                        {user.workstationName.substring(0, 2).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-bold text-white truncate">{user.workstationName}</span>
                          {isSelf && (
                            <span className="text-[9px] px-1.5 py-0.2 rounded font-mono bg-blue-500/20 text-blue-300 font-bold uppercase">
                              Self
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-gray-400 truncate mt-0.5">{user.userName}</p>
                        <p className="text-[10px] text-gray-500 font-mono mt-1">
                          Active Tab: <span className="text-gray-300 font-semibold">{user.currentTab || 'DASHBOARD'}</span>
                        </p>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <span className="inline-flex items-center gap-1 text-[10px] font-mono text-emerald-400 font-semibold bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                        Active
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Shared Network Directory Folder Structure */}
          <div className="bg-[#141414] rounded-2xl border border-[#222] p-6 shadow-xl space-y-4">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <FolderOpen className="w-5 h-5 text-blue-400" />
              <span>Shared Folder Directory Structure & Health</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <div className="p-4 bg-[#1A1A1A] border border-[#2A2A2A] rounded-xl flex items-start gap-3">
                <Database className="w-5 h-5 text-purple-400 shrink-0 mt-1" />
                <div>
                  <h4 className="text-xs font-bold text-white font-mono">/database/</h4>
                  <p className="text-[11px] text-gray-400 mt-0.5">SQLite database (<code className="text-gray-300">material_reference.db</code>)</p>
                  <span className="text-[10px] text-emerald-400 font-mono mt-1 inline-block">Healthy & Synced</span>
                </div>
              </div>

              <div className="p-4 bg-[#1A1A1A] border border-[#2A2A2A] rounded-xl flex items-start gap-3">
                <FileText className="w-5 h-5 text-blue-400 shrink-0 mt-1" />
                <div>
                  <h4 className="text-xs font-bold text-white font-mono">/references/PHOTOS/</h4>
                  <p className="text-[11px] text-gray-400 mt-0.5">Specimen photos & inspection images</p>
                  <span className="text-[10px] text-gray-400 font-mono mt-1 inline-block">High-Res Local Storage</span>
                </div>
              </div>

              <div className="p-4 bg-[#1A1A1A] border border-[#2A2A2A] rounded-xl flex items-start gap-3">
                <FileText className="w-5 h-5 text-emerald-400 shrink-0 mt-1" />
                <div>
                  <h4 className="text-xs font-bold text-white font-mono">/references/ATTACHMENTS/</h4>
                  <p className="text-[11px] text-gray-400 mt-0.5">COA PDF documents & material specs</p>
                  <span className="text-[10px] text-gray-400 font-mono mt-1 inline-block">PDF / Document Store</span>
                </div>
              </div>

              <div className="p-4 bg-[#1A1A1A] border border-[#2A2A2A] rounded-xl flex items-start gap-3">
                <FileText className="w-5 h-5 text-indigo-400 shrink-0 mt-1" />
                <div>
                  <h4 className="text-xs font-bold text-white font-mono">/references/FORMS/</h4>
                  <p className="text-[11px] text-gray-400 mt-0.5">Generated Word DOCX inspection certificates</p>
                  <span className="text-[10px] text-gray-400 font-mono mt-1 inline-block">DOCX Output Directory</span>
                </div>
              </div>

              <div className="p-4 bg-[#1A1A1A] border border-[#2A2A2A] rounded-xl flex items-start gap-3">
                <FileText className="w-5 h-5 text-amber-400 shrink-0 mt-1" />
                <div>
                  <h4 className="text-xs font-bold text-white font-mono">/templates/</h4>
                  <p className="text-[11px] text-gray-400 mt-0.5">Custom QA Word DOCX templates</p>
                  <span className="text-[10px] text-gray-400 font-mono mt-1 inline-block">Template Master Store</span>
                </div>
              </div>

              <div className="p-4 bg-[#1A1A1A] border border-[#2A2A2A] rounded-xl flex items-start gap-3">
                <HardDrive className="w-5 h-5 text-cyan-400 shrink-0 mt-1" />
                <div>
                  <h4 className="text-xs font-bold text-white font-mono">/backups/</h4>
                  <p className="text-[11px] text-gray-400 mt-0.5">Automated daily ZIP snapshots</p>
                  <span className="text-[10px] text-emerald-400 font-mono mt-1 inline-block">Auto-Snapshot Active</span>
                </div>
              </div>
            </div>
          </div>

          {/* Sync Event Activity Stream */}
          <div className="bg-[#141414] rounded-2xl border border-[#222] p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#222]">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Activity className="w-5 h-5 text-cyan-400" />
                <span>Live Sync Event Stream ({syncLogs.length})</span>
              </h3>
              <button
                onClick={() => setSyncLogs([])}
                className="text-xs text-gray-500 hover:text-gray-300 font-mono"
              >
                Clear Stream
              </button>
            </div>

            {syncLogs.length === 0 ? (
              <div className="p-8 text-center bg-[#1A1A1A] rounded-xl border border-[#2A2A2A] text-gray-500 text-xs">
                No cross-workstation sync events captured yet in this session. Any modifications or heartbeats will stream here live.
              </div>
            ) : (
              <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
                {syncLogs.map((log) => (
                  <div
                    key={log.id}
                    className="p-3 bg-[#1A1A1A] border border-[#252525] rounded-xl flex items-start justify-between gap-3 text-xs"
                  >
                    <div className="flex items-start gap-2.5 min-w-0">
                      <span
                        className="w-2 h-2 rounded-full mt-1.5 shrink-0"
                        style={{ backgroundColor: log.sender.color || '#3B82F6' }}
                      />
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 font-mono text-[11px]">
                          <span className="font-bold text-white truncate">{log.sender.workstationName}</span>
                          <span className="text-gray-500">•</span>
                          <span className="text-blue-400 font-semibold">{log.type}</span>
                        </div>
                        <p className="text-xs text-gray-300 mt-0.5">{log.summary || 'Heartbeat signal'}</p>
                      </div>
                    </div>
                    <span className="text-[10px] font-mono text-gray-500 shrink-0">
                      {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* SUB-SECTION 3: EXCEL MANAGER EMBEDDED */}
      {activeAdminSubTab === 'EXCEL' && (
        <div className="bg-[#141414] rounded-2xl border border-[#222] p-6 shadow-xl space-y-6 animate-in fade-in duration-150">
          <div className="flex items-center gap-3 pb-4 border-b border-[#222]">
            <div className="p-3 bg-blue-500/10 border border-blue-500/20 text-blue-400 rounded-xl">
              <FileSpreadsheet className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">Excel Catalog Bulk Import & Export</h2>
              <p className="text-xs text-gray-400">
                Directly upload XLSX spreadsheets to bulk-create master material definitions or export reference registries
              </p>
            </div>
          </div>
          <ExcelManagerView
            config={config}
            masterItems={masterItems}
            registrations={registrations}
            onRefreshData={onRefreshData}
            onConfigChange={onConfigChange}
          />
        </div>
      )}

      {/* SUB-SECTION 3B: FORM TEMPLATES MANAGEMENT (MATERIAL REFERENCE & PROOF SLIP) */}
      {activeAdminSubTab === 'FORM_TEMPLATES' && (
        <FormTemplateManagementView
          config={config}
          masterItems={masterItems}
          registrations={registrations}
          onNotify={(title, text, type) => setStatusMessage({ type: type === 'warning' ? 'error' : (type || 'info'), text: `${title}: ${text}` })}
        />
      )}

      {/* SUB-SECTION 4: WORD TEMPLATES EMBEDDED */}
      {activeAdminSubTab === 'WORD_TEMPLATES' && (
        <div className="bg-[#141414] rounded-2xl border border-[#222] p-6 shadow-xl space-y-6 animate-in fade-in duration-150">
          <div className="flex items-center gap-3 pb-4 border-b border-[#222]">
            <div className="p-3 bg-purple-500/10 border border-purple-500/20 text-purple-400 rounded-xl">
              <FileText className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">Word Form (DOCX) Template Engine</h2>
              <p className="text-xs text-gray-400">
                Upload master templates, configure custom tag fields, and map QA placeholders
              </p>
            </div>
          </div>
          <WordTemplateView
            config={config}
            masterItems={masterItems}
            registrations={registrations}
            onConfigChange={onConfigChange}
          />
        </div>
      )}

      {/* SUB-SECTION 5: CUSTOM FIELDS MANAGEMENT */}
      {activeAdminSubTab === 'CUSTOM_FIELDS' && (
        <div className="bg-[#141414] rounded-2xl border border-[#222] p-6 shadow-xl space-y-6 animate-in fade-in duration-150">
          <div className="flex items-center justify-between pb-4 border-b border-[#222]">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-amber-500/10 border border-amber-500/20 text-amber-400 rounded-xl">
                <Sliders className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-white">Custom QA Inspection Fields Schema</h2>
                <p className="text-xs text-gray-400">
                  Add dynamic inspection parameters to Reference Registration forms
                </p>
              </div>
            </div>
            <button
              onClick={() => setIsCustomFieldsModalOpen(true)}
              className="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold rounded-xl shadow-md transition-all flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              <span>Add New Custom Field</span>
            </button>
          </div>

          {config.customFields.length === 0 ? (
            <div className="p-8 text-center bg-[#1A1A1A] rounded-xl border border-[#2A2A2A] text-gray-400 text-xs">
              No custom inspection fields defined. Click "Add New Custom Field" to create fields like Tensile Strength, Expiration Date, or Lot #.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {config.customFields.map((field) => (
                <div key={field.id} className="p-4 bg-[#1A1A1A] border border-[#2A2A2A] rounded-xl flex items-start justify-between gap-3">
                  <div>
                    <h4 className="text-xs font-bold text-white">{field.label}</h4>
                    <p className="text-[11px] font-mono text-amber-400 mt-0.5">Key: {field.key}</p>
                    <div className="flex items-center gap-2 mt-2 text-[10px] text-gray-400">
                      <span className="px-2 py-0.5 bg-[#222] rounded border border-[#333] font-mono uppercase">Type: {field.type}</span>
                      <span className="px-2 py-0.5 bg-[#222] rounded border border-[#333] font-mono uppercase">Category: {field.categoryApplicability || 'ALL'}</span>
                    </div>
                  </div>
                  <button
                    onClick={() => handleDeleteCustomField(field.id)}
                    className="p-1.5 text-gray-500 hover:text-red-400 rounded-lg hover:bg-[#222]"
                    title="Delete field"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* SUB-SECTION 6: BACKUP & DISASTER RECOVERY */}
      {activeAdminSubTab === 'BACKUP' && (
        <div className="bg-[#141414] rounded-2xl border border-[#222] p-6 shadow-xl space-y-6 animate-in fade-in duration-150">
          <div className="flex items-center justify-between pb-4 border-b border-[#222]">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 rounded-xl">
                <HardDrive className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-white">Portable Database Backup & Snapshot Recovery</h2>
                <p className="text-xs text-gray-400">
                  Export complete single-file ZIP archives or restore daily automated snapshots
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleCreateBackup}
                disabled={isBackingUp}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl shadow-md transition-all flex items-center gap-2 disabled:opacity-50"
              >
                <Download className="w-4 h-4" />
                <span>{isBackingUp ? 'Creating Backup...' : 'Export Backup ZIP'}</span>
              </button>

              <button
                onClick={handleRestoreBackup}
                disabled={isRestoring}
                className="px-4 py-2 bg-[#1F1F1F] hover:bg-[#282828] border border-[#333] text-gray-200 text-xs font-bold rounded-xl transition-all flex items-center gap-2 disabled:opacity-50"
              >
                <Upload className="w-4 h-4 text-emerald-400" />
                <span>{isRestoring ? 'Restoring...' : 'Restore Backup ZIP'}</span>
              </button>
            </div>
          </div>

          {/* Daily Automatic Snapshots Table */}
          <div className="space-y-3">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Clock className="w-4 h-4 text-emerald-400" />
              <span>Automated Daily Snapshot Backups ({dailyBackups.length})</span>
            </h3>

            {dailyBackups.length === 0 ? (
              <p className="text-xs text-gray-500 italic">No automated daily backups recorded yet.</p>
            ) : (
              <div className="space-y-2">
                {dailyBackups.map((bk) => (
                  <div
                    key={bk.id}
                    className="p-3.5 bg-[#1A1A1A] border border-[#2A2A2A] rounded-xl flex items-center justify-between gap-4"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold text-xs">
                        <CheckCircle2 className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="text-xs font-bold text-white">{bk.date}</div>
                        <div className="text-[11px] text-gray-400 font-mono mt-0.5">
                          {bk.masterItemsCount} Master Items • {bk.registrationsCount} Registrations • Est. {bk.dataSizeEstimate}
                        </div>
                      </div>
                    </div>

                    <button
                      onClick={() => handleRestoreDailyBackup(bk.id, bk.date)}
                      disabled={isRestoring}
                      className="px-3 py-1.5 bg-[#222] hover:bg-[#2A2A2A] border border-[#333] text-emerald-400 text-xs font-semibold rounded-lg transition-all"
                    >
                      Restore Snapshot
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* SUB-SECTION 7: AUDIT TRAIL EMBEDDED */}
      {activeAdminSubTab === 'AUDIT' && (
        <div className="bg-[#141414] rounded-2xl border border-[#222] p-6 shadow-xl space-y-6 animate-in fade-in duration-150">
          <div className="flex items-center gap-3 pb-4 border-b border-[#222]">
            <div className="p-3 bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 rounded-xl">
              <History className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">System Operation Audit Trail Logs</h2>
              <p className="text-xs text-gray-400">
                Complete chronological log of all QA operations and workstation events
              </p>
            </div>
          </div>
          <AuditTrailView
            logs={auditLogs}
            onRefresh={onRefreshData}
          />
        </div>
      )}

      {/* SUB-SECTION 8: WORKSTATION CONFIG & SETTINGS */}
      {activeAdminSubTab === 'SETTINGS' && (
        <div className="bg-[#141414] rounded-2xl border border-[#222] p-6 shadow-xl space-y-6 animate-in fade-in duration-150">
          <div className="flex items-center gap-3 pb-4 border-b border-[#222]">
            <div className="p-3 bg-gray-500/10 border border-gray-500/20 text-gray-300 rounded-xl">
              <Settings className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">Workstation & Company Settings</h2>
              <p className="text-xs text-gray-400">
                Configure corporate identity, default QA inspector profile, and workstation name
              </p>
            </div>
          </div>

          <form onSubmit={handleSaveSettings} className="space-y-5 max-w-2xl">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-gray-300">Company / Organization Name</label>
              <input
                type="text"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                className="w-full px-3.5 py-2 text-xs bg-[#1C1C1C] border border-[#333] text-white rounded-xl focus:outline-hidden focus:border-blue-500 font-medium"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-gray-300">Default Registered By (QA Inspector)</label>
              <input
                type="text"
                value={defaultInspector}
                onChange={(e) => setDefaultInspector(e.target.value)}
                className="w-full px-3.5 py-2 text-xs bg-[#1C1C1C] border border-[#333] text-white rounded-xl focus:outline-hidden focus:border-blue-500 font-medium"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-gray-300">This Workstation Name</label>
              <input
                type="text"
                value={workstationName}
                onChange={(e) => setWorkstationName(e.target.value)}
                className="w-full px-3.5 py-2 text-xs bg-[#1C1C1C] border border-[#333] text-white rounded-xl focus:outline-hidden focus:border-blue-500 font-medium"
              />
            </div>

            <div className="pt-3">
              <button
                type="submit"
                disabled={isSavingConfig}
                className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-lg transition-all flex items-center gap-2"
              >
                <Check className="w-4 h-4" />
                <span>{isSavingConfig ? 'Saving Settings...' : 'Save Settings'}</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* SUB-SECTION 9: USER ACCESS CONTROL */}
      {activeAdminSubTab === 'USER_ACCESS' && (
        <div className="space-y-6 animate-in fade-in duration-150">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            
            {/* COLUMN 1: PRE-AUTHORIZED IDS FOR REGISTRATION (5 cols) */}
            <div className="bg-[#141414] rounded-2xl border border-[#222] p-5 shadow-xl space-y-4 lg:col-span-5">
              <div className="flex items-center gap-2 pb-3 border-b border-[#222]">
                <div className="p-1.5 bg-blue-500/10 border border-blue-500/20 text-blue-400 rounded-lg">
                  <Lock className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">Pre-Authorized Person IDs</h3>
                  <p className="text-[10px] text-gray-400">Manage ID numbers authorized to register accounts</p>
                </div>
              </div>

              {/* Add Allowed ID Inline Form */}
              <form 
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!newAllowedId.trim()) return;
                  const success = userService.addAllowedId(newAllowedId, newAllowedRole, newAllowedNote);
                  if (success) {
                    setNewAllowedId('');
                    setNewAllowedNote('');
                    setStatusMessage({ text: `ID "${newAllowedId.toUpperCase()}" successfully pre-authorized!`, type: 'success' });
                  } else {
                    setStatusMessage({ text: `ID "${newAllowedId.toUpperCase()}" already exists or is invalid.`, type: 'error' });
                  }
                }} 
                className="space-y-3 bg-[#0C0C0C] p-3 rounded-xl border border-[#222]"
              >
                <p className="text-[10px] font-bold text-blue-400 uppercase tracking-wider">Authorize New ID</p>
                
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <label className="block text-[10px] text-gray-400 uppercase font-semibold">Person ID</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. ID999"
                      value={newAllowedId}
                      onChange={(e) => setNewAllowedId(e.target.value)}
                      className="w-full px-2.5 py-1.5 bg-[#181818] border border-[#2A2A2A] text-xs text-white rounded-lg focus:outline-hidden focus:border-blue-500 font-mono"
                    />
                  </div>
                  
                  <div className="space-y-1">
                    <label className="block text-[10px] text-gray-400 uppercase font-semibold">Role Group</label>
                    <select
                      value={newAllowedRole}
                      onChange={(e) => setNewAllowedRole(e.target.value as any)}
                      className="w-full px-2.5 py-1.5 bg-[#181818] border border-[#2A2A2A] text-xs text-white rounded-lg focus:outline-hidden focus:border-blue-500"
                    >
                      <option value="user">User (Standard)</option>
                      <option value="admin">Admin (All Access)</option>
                    </select>
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="block text-[10px] text-gray-400 uppercase font-semibold">Note / Owner Name</label>
                  <input
                    type="text"
                    placeholder="e.g. Jane Stone (Quality Eng)"
                    value={newAllowedNote}
                    onChange={(e) => setNewAllowedNote(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-[#181818] border border-[#2A2A2A] text-xs text-white rounded-lg focus:outline-hidden focus:border-blue-500"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full py-1.5 bg-blue-600 hover:bg-blue-500 font-bold text-xs text-white rounded-lg shadow-sm transition-all flex items-center justify-center gap-1 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Authorize ID</span>
                </button>
              </form>

              {/* Allowed IDs List */}
              <div className="space-y-1.5 max-h-[300px] overflow-y-auto pr-1">
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider px-1">Currently Authorized</p>
                {allowedIds.length === 0 ? (
                  <p className="text-xs text-gray-500 italic p-3 text-center bg-[#0C0C0C] rounded-lg">No IDs registered.</p>
                ) : (
                  allowedIds.map((item) => (
                    <div 
                      key={item.idNumber}
                      className="flex items-center justify-between p-2.5 bg-[#0C0C0C] border border-[#222] rounded-xl hover:border-[#333] transition-all"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono text-xs font-bold text-blue-400">{item.idNumber}</span>
                          <span className={`text-[9px] px-1.5 py-0.2 rounded font-bold uppercase ${
                            item.role === 'admin' 
                              ? 'bg-purple-500/15 text-purple-400 border border-purple-500/20' 
                              : 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                          }`}>
                            {item.role}
                          </span>
                        </div>
                        {item.note && (
                          <p className="text-[10px] text-gray-500 truncate mt-0.5">{item.note}</p>
                        )}
                      </div>
                      
                      <button
                        onClick={() => {
                          const success = userService.removeAllowedId(item.idNumber);
                          if (success) {
                            setStatusMessage({ text: `ID "${item.idNumber}" removed from authorization list.`, type: 'info' });
                          }
                        }}
                        className="p-1.5 text-gray-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-all cursor-pointer"
                        title="Remove Authorization"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* COLUMN 2: REGISTERED USERS DIRECTORY (7 cols) */}
            <div className="bg-[#141414] rounded-2xl border border-[#222] p-5 shadow-xl space-y-4 lg:col-span-7">
              <div className="flex items-center gap-2 pb-3 border-b border-[#222]">
                <div className="p-1.5 bg-blue-500/10 border border-blue-500/20 text-blue-400 rounded-lg">
                  <Users className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">Registered Accounts Directory</h3>
                  <p className="text-[10px] text-gray-400">Directory of registered personnel on this station</p>
                </div>
              </div>

              {/* Users Table */}
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-[#222] text-gray-400 text-[10px] uppercase font-bold tracking-wider">
                      <th className="pb-2.5">Full Name</th>
                      <th className="pb-2.5">Short Name</th>
                      <th className="pb-2.5 font-mono">Person ID</th>
                      <th className="pb-2.5">Role</th>
                      <th className="pb-2.5 text-right">Registered</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#1F1F1F]">
                    {registeredUsers.map((user) => (
                      <tr key={user.idNumber} className="hover:bg-[#181818]/50 transition-colors">
                        <td className="py-3 font-semibold text-white">{user.fullName}</td>
                        <td className="py-3 font-mono text-gray-300">{user.shortName}</td>
                        <td className="py-3 font-mono font-semibold text-blue-400">{user.idNumber}</td>
                        <td className="py-3">
                          <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold uppercase ${
                            user.role === 'admin' 
                              ? 'bg-purple-500/15 text-purple-400 border border-purple-500/20' 
                              : 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                          }`}>
                            {user.role}
                          </span>
                        </td>
                        <td className="py-3 text-right text-gray-500 text-[10px]">
                          {new Date(user.createdAt).toLocaleDateString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* Custom Fields Definition Modal */}
      <CustomFieldsManagerModal
        isOpen={isCustomFieldsModalOpen}
        onClose={() => setIsCustomFieldsModalOpen(false)}
        fields={config.customFields}
        onSaveField={handleSaveCustomField}
        onDeleteField={handleDeleteCustomField}
      />
    </div>
  );
};
