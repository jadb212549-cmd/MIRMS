import React, { useState, useEffect, useCallback } from 'react';
import { MasterItem, ReferenceRegistration, AuditLogEntry, AppConfig, NavigationTab, SyncMessage } from './types';
import { db } from './services/db';
import { realtimeSync } from './services/realtimeSync';
import { Header } from './components/Header';
import { DashboardView } from './components/DashboardView';
import { MasterItemsView } from './components/MasterItemsView';
import { ReferenceRegistrationsView } from './components/ReferenceRegistrationsView';
import { ExcelManagerView } from './components/ExcelManagerView';
import { WordTemplateView } from './components/WordTemplateView';
import { DataManagementView } from './components/DataManagementView';
import { AuditTrailView } from './components/AuditTrailView';
import { MasterItemModal } from './components/MasterItemModal';
import { ReferenceRegistrationModal } from './components/ReferenceRegistrationModal';
import { ReferenceDetailModal } from './components/ReferenceDetailModal';
import { Bell, RefreshCw, X, Radio } from 'lucide-react';

interface ToastNotification {
  id: string;
  senderName: string;
  senderColor?: string;
  summary: string;
  timestamp: string;
}

export default function App() {
  const [currentTab, setCurrentTab] = useState<NavigationTab>('DASHBOARD');
  const [masterItems, setMasterItems] = useState<MasterItem[]>([]);
  const [registrations, setRegistrations] = useState<ReferenceRegistration[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);
  const [config, setConfig] = useState<AppConfig>({
    dataDirectory: 'Application Data/ReferenceTracker_Data/',
    companyName: 'Precision Industrial Corp.',
    defaultRegisteredBy: 'Juan Dela Cruz (QA)',
    wordTemplateName: 'Official_Material_Reference_Template_v2.docx',
    customFields: []
  });

  const [isLoading, setIsLoading] = useState(true);
  const [globalSearchQuery, setGlobalSearchQuery] = useState('');
  const [toasts, setToasts] = useState<ToastNotification[]>([]);

  // Modals state
  const [isMasterModalOpen, setIsMasterModalOpen] = useState(false);
  const [editingMasterItem, setEditingMasterItem] = useState<MasterItem | null>(null);

  const [isRegModalOpen, setIsRegModalOpen] = useState(false);
  const [regModalMasterItem, setRegModalMasterItem] = useState<MasterItem | null>(null);
  const [editingRegistration, setEditingRegistration] = useState<ReferenceRegistration | null>(null);

  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [viewingRegistration, setViewingRegistration] = useState<ReferenceRegistration | null>(null);

  // Load state from SQLite / persistent service
  const refreshAllData = useCallback(async () => {
    try {
      // Trigger daily automatic backup once on app open if not yet executed today
      const autoBackupResult = await db.checkAndPerformDailyAutoBackup();
      if (autoBackupResult.performed) {
        const backupToast: ToastNotification = {
          id: `toast-autobackup-${Date.now()}`,
          senderName: 'Daily Auto-Backup',
          senderColor: '#10B981',
          summary: `Automatic daily snapshot created for ${autoBackupResult.date} (${autoBackupResult.masterItemsCount} master items, ${autoBackupResult.registrationsCount} registrations)`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        };
        setToasts((prev) => [backupToast, ...prev.slice(0, 4)]);
        setTimeout(() => {
          setToasts((current) => current.filter((t) => t.id !== backupToast.id));
        }, 8000);
      }

      const [items, regs, logs, cfg] = await Promise.all([
        db.getMasterItems(),
        db.getRegistrations(),
        db.getAuditLogs(),
        db.getConfig()
      ]);
      setMasterItems(items);
      setRegistrations(regs);
      setAuditLogs(logs);
      setConfig(cfg);
    } catch (err) {
      console.error('Data load error:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshAllData();
  }, [refreshAllData]);

  // Sync active tab to peers
  useEffect(() => {
    realtimeSync.updateActiveTab(currentTab);
  }, [currentTab]);

  // Subscribe to real-time cross-workstation broadcast events
  useEffect(() => {
    const unsubscribe = realtimeSync.subscribe((msg: SyncMessage) => {
      // If the message is a data mutation from another workstation
      if (
        [
          'MASTER_ITEM_CREATE',
          'MASTER_ITEM_UPDATE',
          'MASTER_ITEM_DELETE',
          'REGISTRATION_CREATE',
          'REGISTRATION_UPDATE',
          'REGISTRATION_DELETE',
          'CONFIG_UPDATE',
          'EXCEL_IMPORT',
          'DATA_RESTORE'
        ].includes(msg.type)
      ) {
        // Auto-refresh data silently in the background
        refreshAllData();

        // Push live toast notification
        if (msg.summary) {
          const newToast: ToastNotification = {
            id: msg.id,
            senderName: msg.sender.workstationName || msg.sender.userName,
            senderColor: msg.sender.color,
            summary: msg.summary,
            timestamp: new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
          };

          setToasts((prev) => [newToast, ...prev.slice(0, 4)]);

          // Auto dismiss after 6 seconds
          setTimeout(() => {
            setToasts((current) => current.filter((t) => t.id !== newToast.id));
          }, 6000);
        }
      }
    });

    return () => {
      unsubscribe();
    };
  }, [refreshAllData]);

  const addNotification = (title: string, message?: string, type?: 'info' | 'success' | 'warning') => {
    const summaryText = message ? `${title}: ${message}` : title;
    const toastColor = type === 'success' ? '#10B981' : type === 'warning' ? '#F59E0B' : '#3B82F6';
    const toast: ToastNotification = {
      id: `local-${Date.now()}`,
      senderName: 'Local Workspace',
      senderColor: toastColor,
      summary: summaryText,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    };
    setToasts((prev) => [toast, ...prev.slice(0, 4)]);
    setTimeout(() => {
      setToasts((current) => current.filter((t) => t.id !== toast.id));
    }, 5000);
  };

  // Master Item Handlers
  const handleSaveMasterItem = async (itemData: Omit<MasterItem, 'id' | 'createdAt' | 'updatedAt'>) => {
    try {
      if (editingMasterItem) {
        await db.updateMasterItem(editingMasterItem.id, itemData, config.defaultRegisteredBy || 'Admin');
      } else {
        await db.createMasterItem(itemData, config.defaultRegisteredBy || 'Admin');
      }
      await refreshAllData();
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message || 'Failed to save master reference item.' };
    }
  };

  const handleDeleteMasterItem = async (id: string) => {
    await db.deleteMasterItem(id, config.defaultRegisteredBy || 'Admin');
    await refreshAllData();
  };

  // Reference Registration Handlers
  const handleSaveRegistration = async (regData: Omit<ReferenceRegistration, 'id' | 'createdAt' | 'updatedAt'>) => {
    try {
      if (editingRegistration) {
        await db.updateRegistration(editingRegistration.id, regData, config.defaultRegisteredBy || 'Admin');
      } else {
        await db.createRegistration(regData, config.defaultRegisteredBy || 'Admin');
      }
      await refreshAllData();
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message || 'Failed to register reference sample.' };
    }
  };

  const handleDeleteRegistration = async (id: string) => {
    await db.deleteRegistration(id, config.defaultRegisteredBy || 'Admin');
    await refreshAllData();
  };

  // Config Handlers
  const handleSaveConfig = async (newConfig: Partial<AppConfig>) => {
    await db.saveConfig(newConfig, config.defaultRegisteredBy || 'Admin');
    await refreshAllData();
  };

  // Modal openers
  const openCreateMasterModal = () => {
    setEditingMasterItem(null);
    setIsMasterModalOpen(true);
  };

  const openEditMasterModal = (item: MasterItem) => {
    setEditingMasterItem(item);
    setIsMasterModalOpen(true);
  };

  const openCreateRegistrationModal = (item?: MasterItem) => {
    setEditingRegistration(null);
    setRegModalMasterItem(item || null);
    setIsRegModalOpen(true);
  };

  const openEditRegistrationModal = (reg: ReferenceRegistration) => {
    setEditingRegistration(reg);
    setRegModalMasterItem(null);
    setIsRegModalOpen(true);
  };

  const openDetailModal = (reg: ReferenceRegistration) => {
    setViewingRegistration(reg);
    setIsDetailModalOpen(true);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#0A0A0A] flex items-center justify-center text-white">
        <div className="text-center space-y-3">
          <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="text-xs font-semibold tracking-wider uppercase text-gray-400">
            Initializing Material Reference & Sample Tracking Database...
          </p>
        </div>
      </div>
    );
  }

  const selectedRegistrationMasterItem = viewingRegistration
    ? masterItems.find((m) => m.productCode.toLowerCase() === viewingRegistration.productCode.toLowerCase())
    : undefined;

  return (
    <div className="min-h-screen bg-[#0A0A0A] flex flex-col font-sans text-[#E5E7EB] selection:bg-blue-600 selection:text-white relative">
      {/* Real-time Multi-User Live Toast Notifications */}
      {toasts.length > 0 && (
        <div className="fixed bottom-12 right-6 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none">
          {toasts.map((toast) => (
            <div
              key={toast.id}
              className="pointer-events-auto bg-[#161616]/95 backdrop-blur-md border border-blue-500/40 rounded-xl p-3.5 shadow-2xl flex items-start gap-3 animate-in slide-in-from-right duration-200"
            >
              <div
                className="w-2.5 h-2.5 rounded-full mt-1.5 shrink-0"
                style={{ backgroundColor: toast.senderColor || '#3B82F6' }}
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between text-[11px] mb-0.5">
                  <span className="font-bold text-gray-200 truncate">{toast.senderName}</span>
                  <span className="text-gray-500 font-mono text-[10px]">{toast.timestamp}</span>
                </div>
                <p className="text-xs text-gray-300 leading-snug">{toast.summary}</p>
              </div>
              <button
                onClick={() => setToasts((prev) => prev.filter((t) => t.id !== toast.id))}
                className="text-gray-500 hover:text-gray-300 p-0.5"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Fixed Application Header & Navigation */}
      <Header
        currentTab={currentTab}
        onSelectTab={setCurrentTab}
        masterCount={masterItems.length}
        registeredCount={registrations.length}
        masterItems={masterItems}
        registrations={registrations}
        searchQuery={globalSearchQuery}
        onSearchChange={setGlobalSearchQuery}
        onSelectMasterItem={(item) => {
          setCurrentTab('MASTER_ITEMS');
        }}
        onSelectRegistration={(reg) => {
          openDetailModal(reg);
        }}
        onNotify={addNotification}
      />

      {/* Main Workspace Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8">
        {currentTab === 'DASHBOARD' && (
          <DashboardView
            masterItems={masterItems}
            registrations={registrations}
            auditLogs={auditLogs}
            config={config}
            onNavigateTab={setCurrentTab}
            onOpenRegisterModal={openCreateRegistrationModal}
            onOpenMasterModal={openCreateMasterModal}
            onViewReference={openDetailModal}
            onOpenDetailModal={openDetailModal}
          />
        )}

        {currentTab === 'MASTER_ITEMS' && (
          <MasterItemsView
            masterItems={masterItems}
            registrations={registrations}
            onOpenCreateModal={openCreateMasterModal}
            onOpenEditModal={openEditMasterModal}
            onDeleteMasterItem={handleDeleteMasterItem}
            onRegisterReference={(item) => openCreateRegistrationModal(item)}
            onViewReference={openDetailModal}
            onNavigateTab={setCurrentTab}
            globalSearchQuery={globalSearchQuery}
            onSearchChange={setGlobalSearchQuery}
          />
        )}

        {currentTab === 'REGISTRATIONS' && (
          <ReferenceRegistrationsView
            registrations={registrations}
            masterItems={masterItems}
            config={config}
            onOpenCreateModal={() => openCreateRegistrationModal()}
            onOpenEditModal={openEditRegistrationModal}
            onOpenDetailModal={openDetailModal}
            globalSearchQuery={globalSearchQuery}
            onSearchChange={setGlobalSearchQuery}
          />
        )}

        {currentTab === 'EXCEL_MANAGER' && (
          <ExcelManagerView
            masterItems={masterItems}
            registrations={registrations}
            onRefreshData={refreshAllData}
            onNavigateTab={setCurrentTab}
          />
        )}

        {currentTab === 'WORD_TEMPLATES' && (
          <WordTemplateView
            config={config}
            masterItems={masterItems}
            registrations={registrations}
            onConfigChange={handleSaveConfig}
          />
        )}

        {(currentTab === 'DATA_MANAGEMENT' || currentTab === 'SHARED_FOLDER') && (
          <DataManagementView
            config={config}
            masterItems={masterItems}
            registrations={registrations}
            onRefreshData={refreshAllData}
            onConfigChange={handleSaveConfig}
          />
        )}

        {currentTab === 'AUDIT_TRAIL' && (
          <AuditTrailView
            logs={auditLogs}
            onRefresh={refreshAllData}
          />
        )}
      </main>

      {/* Footer System Status Bar */}
      <footer className="h-8 bg-[#161616] border-t border-[#222222] flex items-center justify-between px-4 text-[10px] text-gray-500 select-none">
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1.5 font-medium text-gray-400">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span>
            REF_TRACKER DESKTOP
          </span>
          <span className="hidden sm:inline text-gray-600">|</span>
          <span className="hidden sm:inline font-mono">TARGET: x86_64-pc-windows-msvc</span>
          <span className="hidden sm:inline text-gray-600">|</span>
          <span className="hidden md:inline font-mono">DB: SQLite Portable</span>
        </div>

        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1.5 text-emerald-400 font-mono">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
            SHARED FOLDER SYNC ACTIVE
          </span>
          <span className="text-gray-600">|</span>
          <span className="font-mono text-gray-400">v1.0.4-stable</span>
        </div>
      </footer>

      {/* Master Item Create/Edit Modal */}
      <MasterItemModal
        isOpen={isMasterModalOpen}
        onClose={() => setIsMasterModalOpen(false)}
        onSave={handleSaveMasterItem}
        existingItem={editingMasterItem}
        existingProductCodes={masterItems.map((m) => m.productCode)}
      />

      {/* Reference Registration Modal */}
      <ReferenceRegistrationModal
        isOpen={isRegModalOpen}
        onClose={() => setIsRegModalOpen(false)}
        onSave={handleSaveRegistration}
        masterItems={masterItems}
        customFieldDefs={config.customFields || []}
        defaultUser={config.defaultRegisteredBy || 'Juan Dela Cruz'}
        initialMasterItem={regModalMasterItem}
        existingRegistration={editingRegistration}
      />

      {/* Reference Sample Detail Modal */}
      <ReferenceDetailModal
        isOpen={isDetailModalOpen}
        onClose={() => setIsDetailModalOpen(false)}
        registration={viewingRegistration}
        masterItem={selectedRegistrationMasterItem}
        config={config}
        onEdit={(reg) => {
          setIsDetailModalOpen(false);
          openEditRegistrationModal(reg);
        }}
        onDelete={handleDeleteRegistration}
      />
    </div>
  );
}

