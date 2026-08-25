import { MasterItem, ReferenceRegistration, AuditLogEntry, AppConfig, CustomFieldDefinition, SyncMessage, FormTemplate, FormType, ReferenceRevisionRecord, RevisionStatus } from '../types';
import { INITIAL_MASTER_ITEMS, INITIAL_REGISTRATIONS, INITIAL_AUDIT_LOGS, DEFAULT_CONFIG, DEFAULT_CUSTOM_FIELDS, DEFAULT_CATEGORIES } from './defaultData';
import { INITIAL_FORM_TEMPLATES } from './templateDefaults';
import { isTauri, tauriBridge } from './tauriService';
import { realtimeSync } from './realtimeSync';
import JSZip from 'jszip';

const STORAGE_KEYS = {
  MASTER_ITEMS: 'mat_ref_master_items_v1',
  REGISTRATIONS: 'mat_ref_registrations_v1',
  AUDIT_LOGS: 'mat_ref_audit_logs_v1',
  APP_CONFIG: 'mat_ref_app_config_v1',
  FORM_TEMPLATES: 'mat_ref_form_templates_v2',
  DAILY_BACKUPS: 'mat_ref_daily_backups_v1',
  LAST_AUTO_BACKUP_DATE: 'mat_ref_last_auto_backup_date'
};

const IDB_NAME = 'mat_ref_storage_db';
const IDB_VERSION = 1;
const IDB_STORE_SNAPSHOTS = 'snapshots';

function openSnapshotDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      return reject(new Error('IndexedDB not supported in this environment'));
    }
    const request = indexedDB.open(IDB_NAME, IDB_VERSION);
    request.onupgradeneeded = () => {
      const idb = request.result;
      if (!idb.objectStoreNames.contains(IDB_STORE_SNAPSHOTS)) {
        idb.createObjectStore(IDB_STORE_SNAPSHOTS, { keyPath: 'id' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function idbSaveSnapshot(snapshot: any): Promise<void> {
  try {
    const idb = await openSnapshotDB();
    return new Promise((resolve, reject) => {
      const tx = idb.transaction(IDB_STORE_SNAPSHOTS, 'readwrite');
      const store = tx.objectStore(IDB_STORE_SNAPSHOTS);
      store.put(snapshot);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (err) {
    console.warn('Could not save snapshot to IndexedDB:', err);
  }
}

async function idbGetSnapshot(id: string): Promise<any | null> {
  try {
    const idb = await openSnapshotDB();
    return new Promise((resolve, reject) => {
      const tx = idb.transaction(IDB_STORE_SNAPSHOTS, 'readonly');
      const store = tx.objectStore(IDB_STORE_SNAPSHOTS);
      const req = store.get(id);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.warn('Could not read snapshot from IndexedDB:', err);
    return null;
  }
}

async function idbDeleteOldSnapshots(keepIds: string[]): Promise<void> {
  try {
    const idb = await openSnapshotDB();
    const keepSet = new Set(keepIds);
    return new Promise((resolve, reject) => {
      const tx = idb.transaction(IDB_STORE_SNAPSHOTS, 'readwrite');
      const store = tx.objectStore(IDB_STORE_SNAPSHOTS);
      const req = store.getAllKeys();
      req.onsuccess = () => {
        const keys = req.result as string[];
        keys.forEach((k) => {
          if (!keepSet.has(k)) {
            store.delete(k);
          }
        });
      };
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (err) {
    console.warn('Could not clean old snapshots in IndexedDB:', err);
  }
}

class DatabaseService {
  private masterItems: MasterItem[] = [];
  private registrations: ReferenceRegistration[] = [];
  private auditLogs: AuditLogEntry[] = [];
  private config: AppConfig = DEFAULT_CONFIG;
  private formTemplates: FormTemplate[] = [];
  private initialized = false;
  private changeListeners: Set<() => void> = new Set();
  private syncUnsubscribe: (() => void) | null = null;

  constructor() {
    this.setupRealtimeListener();
  }

  private setupRealtimeListener() {
    if (this.syncUnsubscribe) return;
    this.syncUnsubscribe = realtimeSync.subscribe((msg: SyncMessage) => {
      if (msg.type.startsWith('MUTATION_')) {
        this.reloadFromDisk();
      }
    });
  }

  public subscribe(listener: () => void): () => void {
    this.changeListeners.add(listener);
    return () => {
      this.changeListeners.delete(listener);
    };
  }

  private notifyListeners(): void {
    this.changeListeners.forEach((listener) => {
      try {
        listener();
      } catch (err) {
        console.error('Error in db change listener:', err);
      }
    });
  }

  public async reloadFromDisk(): Promise<void> {
    try {
      const storedItems = localStorage.getItem(STORAGE_KEYS.MASTER_ITEMS);
      const storedRefs = localStorage.getItem(STORAGE_KEYS.REGISTRATIONS);
      const storedAudits = localStorage.getItem(STORAGE_KEYS.AUDIT_LOGS);
      const storedConfig = localStorage.getItem(STORAGE_KEYS.APP_CONFIG);
      const storedTemplates = localStorage.getItem(STORAGE_KEYS.FORM_TEMPLATES);

      if (storedItems) this.masterItems = JSON.parse(storedItems);
      if (storedRefs) this.registrations = JSON.parse(storedRefs);
      if (storedAudits) this.auditLogs = JSON.parse(storedAudits);
      if (storedConfig) this.config = { ...DEFAULT_CONFIG, ...JSON.parse(storedConfig) };
      if (storedTemplates) {
        this.formTemplates = JSON.parse(storedTemplates);
      }

      this.notifyListeners();
    } catch (err) {
      console.error('Error reloading database state from disk:', err);
    }
  }

  public async init(): Promise<void> {
    if (this.initialized) return;

    // Prune any legacy oversized backup keys or temp snapshots to free localStorage quota
    this.pruneNonEssentialLocalStorage();

    try {
      if (isTauri()) {
        // Attempt to load from Tauri SQLite database if running in Tauri
        try {
          const { invoke } = await import('@tauri-apps/api/core');
          const data: {
            masterItems: MasterItem[];
            registrations: ReferenceRegistration[];
            auditLogs: AuditLogEntry[];
            config: AppConfig;
          } = await invoke('db_get_initial_state');
          if (data && data.masterItems && data.masterItems.length > 0) {
            this.masterItems = data.masterItems;
            this.registrations = data.registrations || [];
            this.auditLogs = data.auditLogs || [];
            this.config = data.config || DEFAULT_CONFIG;

            // Load templates from persistent local store in Tauri environment
            const storedTemplates = localStorage.getItem(STORAGE_KEYS.FORM_TEMPLATES);
            if (storedTemplates) {
              try {
                const parsedTemplates = JSON.parse(storedTemplates);
                if (Array.isArray(parsedTemplates) && parsedTemplates.length > 0) {
                  this.formTemplates = parsedTemplates;
                } else {
                  this.formTemplates = [...INITIAL_FORM_TEMPLATES];
                  this.saveFormTemplatesLocal();
                }
              } catch {
                this.formTemplates = [...INITIAL_FORM_TEMPLATES];
                this.saveFormTemplatesLocal();
              }
            } else {
              this.formTemplates = [...INITIAL_FORM_TEMPLATES];
              this.saveFormTemplatesLocal();
            }

            this.initialized = true;
            this.notifyListeners();
            return;
          }
        } catch (tauriErr) {
          console.warn('Tauri SQLite backend not available or returned empty, falling back to local store:', tauriErr);
        }
      }

      // Load from persistent local store
      const storedItems = localStorage.getItem(STORAGE_KEYS.MASTER_ITEMS);
      const storedRefs = localStorage.getItem(STORAGE_KEYS.REGISTRATIONS);
      const storedAudits = localStorage.getItem(STORAGE_KEYS.AUDIT_LOGS);
      const storedConfig = localStorage.getItem(STORAGE_KEYS.APP_CONFIG);
      const storedTemplates = localStorage.getItem(STORAGE_KEYS.FORM_TEMPLATES);

      if (storedItems) {
        const parsed = JSON.parse(storedItems);
        this.masterItems = parsed.map((item: any) => ({
          ...item,
          materialType: item.materialType || (item.category === 'RM' || item.category === 'PS' ? item.category : 'RM'),
          category: (item.category && item.category !== 'RM' && item.category !== 'PS')
            ? item.category
            : (item.materialType === 'PS' ? 'Tape' : 'Box')
        }));
      } else {
        this.masterItems = [...INITIAL_MASTER_ITEMS];
        this.saveMasterItems();
      }

      if (storedRefs) {
        const parsed = JSON.parse(storedRefs);
        this.registrations = parsed.map((r: any) => {
          const status: RevisionStatus = r.status || 'APPROVED';
          const currentVersionNumber = r.currentVersionNumber || 1;
          const versions: ReferenceRevisionRecord[] = Array.isArray(r.versions) && r.versions.length > 0
            ? r.versions
            : [
                {
                  id: `ver-${r.id}-1`,
                  referenceId: r.id,
                  versionNumber: 1,
                  revisionCode: r.revision || 'Rev 01',
                  status: status,
                  masterItemId: r.masterItemId,
                  productCode: r.productCode,
                  materialType: r.materialType,
                  category: r.category,
                  registrationDate: r.registrationDate,
                  registeredBy: r.registeredBy,
                  supplier: r.supplier,
                  specification: r.specification,
                  remarks: r.remarks,
                  customFields: r.customFields || {},
                  photos: r.photos || [],
                  attachments: r.attachments || [],
                  selectedPrintPhotoIds: r.selectedPrintPhotoIds,
                  printLayout: r.printLayout,
                  submittedBy: r.registeredBy,
                  submittedAt: r.createdAt || new Date().toISOString(),
                  approvedBy: status === 'APPROVED' ? 'System Admin' : undefined,
                  approvedAt: status === 'APPROVED' ? (r.createdAt || new Date().toISOString()) : undefined,
                  changeSummary: 'Initial base registration and official approval'
                }
              ];

          const pendingRev = versions.find((v) => v.status === 'PENDING_APPROVAL');

          return {
            ...r,
            status,
            currentVersionNumber,
            hasPendingRevision: !!pendingRev,
            pendingRevisionId: pendingRev ? pendingRev.id : undefined,
            pendingRevision: pendingRev || undefined,
            versions,
            materialType: r.materialType || (r.category === 'RM' || r.category === 'PS' ? r.category : undefined),
            category: (r.category && r.category !== 'RM' && r.category !== 'PS') ? r.category : undefined
          };
        });
      } else {
        this.registrations = [...INITIAL_REGISTRATIONS];
        this.saveRegistrations();
      }

      if (storedAudits) {
        this.auditLogs = JSON.parse(storedAudits);
      } else {
        this.auditLogs = [...INITIAL_AUDIT_LOGS];
        this.saveAuditLogs();
      }

      if (storedConfig) {
        const parsedConfig = JSON.parse(storedConfig);
        this.config = {
          ...DEFAULT_CONFIG,
          ...parsedConfig,
          categories: Array.isArray(parsedConfig.categories)
            ? parsedConfig.categories
            : DEFAULT_CATEGORIES
        };
      } else {
        this.config = { ...DEFAULT_CONFIG };
        this.saveLocalConfig();
      }

      if (storedTemplates) {
        try {
          const parsedTemplates = JSON.parse(storedTemplates);
          if (Array.isArray(parsedTemplates) && parsedTemplates.length > 0) {
            this.formTemplates = parsedTemplates;
          } else {
            this.formTemplates = [...INITIAL_FORM_TEMPLATES];
            this.saveFormTemplatesLocal();
          }
        } catch {
          this.formTemplates = [...INITIAL_FORM_TEMPLATES];
          this.saveFormTemplatesLocal();
        }
      } else {
        this.formTemplates = [...INITIAL_FORM_TEMPLATES];
        this.saveFormTemplatesLocal();
      }
    } catch (err) {
      console.error('Error initializing database service:', err);
      this.masterItems = [...INITIAL_MASTER_ITEMS];
      this.registrations = [...INITIAL_REGISTRATIONS];
      this.auditLogs = [...INITIAL_AUDIT_LOGS];
      this.config = { ...DEFAULT_CONFIG };
      this.formTemplates = [...INITIAL_FORM_TEMPLATES];
    }

    this.initialized = true;
    this.notifyListeners();
  }

  // Categories Management
  public async getCategories(): Promise<string[]> {
    await this.init();
    const configCats = Array.isArray(this.config.categories) ? this.config.categories : DEFAULT_CATEGORIES;
    return [...configCats];
  }

  public async getAllActiveCategories(): Promise<string[]> {
    await this.init();
    const configCats = Array.isArray(this.config.categories) ? this.config.categories : DEFAULT_CATEGORIES;
    const itemCats = this.masterItems.map(m => m.category).filter(Boolean) as string[];
    const regCats = this.registrations.map(r => r.category).filter(Boolean) as string[];
    const combined = Array.from(new Set([...configCats, ...itemCats, ...regCats].map(c => c.trim()).filter(Boolean)));
    return combined.sort((a, b) => a.localeCompare(b));
  }

  public async addCategory(name: string): Promise<{ success: boolean; categories: string[]; error?: string }> {
    await this.init();
    const clean = name.trim();
    if (!clean) {
      return { success: false, categories: await this.getCategories(), error: 'Category name cannot be empty.' };
    }
    const currentCats = Array.isArray(this.config.categories) ? this.config.categories : [...DEFAULT_CATEGORIES];
    if (currentCats.some(c => c.toLowerCase() === clean.toLowerCase())) {
      return { success: false, categories: currentCats, error: `Category "${clean}" already exists.` };
    }
    const updated = [...currentCats, clean];
    this.config = { ...this.config, categories: updated };
    this.saveLocalConfig();

    await this.logAudit({
      user: this.config.defaultRegisteredBy || 'Admin',
      action: 'CREATE',
      entityType: 'SETTINGS',
      details: `Created new category classification: "${clean}"`
    });

    this.notifyListeners();
    return { success: true, categories: updated };
  }

  public async bulkImportCategories(names: string[]): Promise<{ success: boolean; importedCount: number; categories: string[] }> {
    await this.init();
    const currentCats = Array.isArray(this.config.categories) ? this.config.categories : [...DEFAULT_CATEGORIES];
    const currentCatsLower = new Set(currentCats.map(c => c.toLowerCase()));

    const added: string[] = [];
    names.forEach(name => {
      const clean = name.trim();
      if (clean && !currentCatsLower.has(clean.toLowerCase())) {
        currentCatsLower.add(clean.toLowerCase());
        added.push(clean);
      }
    });

    if (added.length === 0) {
      return { success: true, importedCount: 0, categories: currentCats };
    }

    const updated = [...currentCats, ...added];
    this.config = { ...this.config, categories: updated };
    this.saveLocalConfig();

    await this.logAudit({
      user: this.config.defaultRegisteredBy || 'Admin',
      action: 'UPDATE',
      entityType: 'SETTINGS',
      details: `Bulk imported ${added.length} categories from Excel spreadsheet.`
    });

    this.notifyListeners();
    return { success: true, importedCount: added.length, categories: updated };
  }

  public async deleteCategory(name: string, unlinkReferences = false): Promise<{ success: boolean; categories: string[]; affectedCount?: number }> {
    await this.init();
    const clean = name.trim();
    const currentCats = Array.isArray(this.config.categories) ? this.config.categories : [...DEFAULT_CATEGORIES];
    const updated = currentCats.filter(c => c.toLowerCase() !== clean.toLowerCase());
    this.config = { ...this.config, categories: updated };
    this.saveLocalConfig();

    let affectedCount = 0;
    if (unlinkReferences) {
      let masterUpdated = false;
      this.masterItems = this.masterItems.map(item => {
        if (item.category && item.category.trim().toLowerCase() === clean.toLowerCase()) {
          affectedCount++;
          masterUpdated = true;
          return { ...item, category: '', updatedAt: new Date().toISOString() };
        }
        return item;
      });
      if (masterUpdated) {
        this.saveMasterItems();
      }

      let regUpdated = false;
      this.registrations = this.registrations.map(reg => {
        if (reg.category && reg.category.trim().toLowerCase() === clean.toLowerCase()) {
          affectedCount++;
          regUpdated = true;
          return { ...reg, category: '', updatedAt: new Date().toISOString() };
        }
        return reg;
      });
      if (regUpdated) {
        this.saveRegistrations();
      }
    }

    await this.logAudit({
      user: this.config.defaultRegisteredBy || 'Admin',
      action: 'DELETE',
      entityType: 'SETTINGS',
      details: `Deleted category "${clean}"${unlinkReferences ? ` (unlinked from ${affectedCount} records)` : ''}`
    });

    this.notifyListeners();
    return { success: true, categories: updated, affectedCount };
  }

  public async deleteAllCategories(unlinkReferences = false): Promise<{ success: boolean; categories: string[]; affectedCount?: number }> {
    await this.init();
    const countBefore = (this.config.categories || []).length;
    this.config = { ...this.config, categories: [] };
    this.saveLocalConfig();

    let affectedCount = 0;
    if (unlinkReferences) {
      let masterUpdated = false;
      this.masterItems = this.masterItems.map(item => {
        if (item.category) {
          affectedCount++;
          masterUpdated = true;
          return { ...item, category: '', updatedAt: new Date().toISOString() };
        }
        return item;
      });
      if (masterUpdated) {
        this.saveMasterItems();
      }

      let regUpdated = false;
      this.registrations = this.registrations.map(reg => {
        if (reg.category) {
          affectedCount++;
          regUpdated = true;
          return { ...reg, category: '', updatedAt: new Date().toISOString() };
        }
        return reg;
      });
      if (regUpdated) {
        this.saveRegistrations();
      }
    }

    await this.logAudit({
      user: this.config.defaultRegisteredBy || 'Admin',
      action: 'DELETE',
      entityType: 'SETTINGS',
      details: `Deleted all configured categories (${countBefore} categories removed)${unlinkReferences ? ` (unlinked from ${affectedCount} records)` : ''}`
    });

    this.notifyListeners();
    return { success: true, categories: [], affectedCount };
  }

  public async resetDefaultCategories(): Promise<{ success: boolean; categories: string[] }> {
    await this.init();
    const updated = [...DEFAULT_CATEGORIES];
    this.config = { ...this.config, categories: updated };
    this.saveLocalConfig();

    await this.logAudit({
      user: this.config.defaultRegisteredBy || 'Admin',
      action: 'UPDATE',
      entityType: 'SETTINGS',
      details: `Restored default category list (${DEFAULT_CATEGORIES.length} baseline categories)`
    });

    this.notifyListeners();
    return { success: true, categories: updated };
  }

  // Master Items Management
  public async getMasterItems(): Promise<MasterItem[]> {
    await this.init();
    return [...this.masterItems];
  }

  public async getMasterItemById(id: string): Promise<MasterItem | undefined> {
    await this.init();
    return this.masterItems.find((item) => item.id === id);
  }

  public async getMasterItemByCode(code: string): Promise<MasterItem | undefined> {
    await this.init();
    const clean = code.trim().toLowerCase();
    return this.masterItems.find((item) => item.productCode.toLowerCase() === clean);
  }

  public async createMasterItem(
    itemData: Omit<MasterItem, 'id' | 'createdAt' | 'updatedAt'>,
    author = 'User'
  ): Promise<{ success: boolean; item?: MasterItem; error?: string }> {
    await this.init();

    const normalizedCode = itemData.productCode.trim();
    if (!normalizedCode) {
      return { success: false, error: 'Product Code is required.' };
    }

    const exists = this.masterItems.some(
      (m) => m.productCode.toLowerCase() === normalizedCode.toLowerCase()
    );
    if (exists) {
      return { success: false, error: `Product Code "${normalizedCode}" already exists in Master Items.` };
    }

    // Auto-register category if not present
    if (itemData.category && itemData.category.trim()) {
      await this.addCategory(itemData.category.trim());
    }

    const now = new Date().toISOString();
    const newItem: MasterItem = {
      id: `item-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      productCode: normalizedCode,
      description: itemData.description.trim(),
      materialType: itemData.materialType || 'RM',
      category: itemData.category?.trim() || '',
      status: itemData.status,
      unit: itemData.unit?.trim() || undefined,
      createdAt: now,
      updatedAt: now
    };

    this.masterItems.unshift(newItem);
    this.saveMasterItems();

    await this.logAudit({
      user: author,
      action: 'CREATE',
      entityType: 'MASTER_ITEM',
      entityId: newItem.id,
      entityIdentifier: newItem.productCode,
      details: `Created master item "${newItem.productCode}" (${newItem.materialType}, Cat: ${newItem.category}, ${newItem.status})`
    });

    if (isTauri()) {
      this.syncTauri('create_master_item', newItem);
    }

    realtimeSync.broadcastMutation('MUTATION_ITEM_CREATED', newItem.productCode, `Created master item "${newItem.productCode}"`, newItem);
    this.notifyListeners();

    return { success: true, item: newItem };
  }

  public async updateMasterItem(
    id: string,
    updates: Partial<Omit<MasterItem, 'id' | 'createdAt'>>,
    author = 'User'
  ): Promise<{ success: boolean; item?: MasterItem; error?: string }> {
    await this.init();
    const index = this.masterItems.findIndex((m) => m.id === id);
    if (index === -1) {
      return { success: false, error: 'Master item not found.' };
    }

    const current = this.masterItems[index];

    // If productCode changed, check duplicate
    if (updates.productCode && updates.productCode.toLowerCase() !== current.productCode.toLowerCase()) {
      const codeExists = this.masterItems.some(
        (m) => m.id !== id && m.productCode.toLowerCase() === updates.productCode!.trim().toLowerCase()
      );
      if (codeExists) {
        return { success: false, error: `Product Code "${updates.productCode}" is already used by another item.` };
      }

      // Also update linked registrations productCode
      const oldCode = current.productCode;
      const newCode = updates.productCode.trim();
      this.registrations.forEach((reg) => {
        if (reg.masterItemId === id || reg.productCode.toLowerCase() === oldCode.toLowerCase()) {
          reg.productCode = newCode;
          reg.updatedAt = new Date().toISOString();
        }
      });
      this.saveRegistrations();
    }

    // Auto-register category if not present
    if (updates.category && updates.category.trim()) {
      await this.addCategory(updates.category.trim());
    }

    const updated: MasterItem = {
      ...current,
      ...updates,
      productCode: updates.productCode ? updates.productCode.trim() : current.productCode,
      description: updates.description !== undefined ? updates.description.trim() : current.description,
      materialType: updates.materialType !== undefined ? updates.materialType : current.materialType,
      category: updates.category !== undefined ? updates.category.trim() : current.category,
      unit: updates.unit !== undefined ? updates.unit.trim() : current.unit,
      updatedAt: new Date().toISOString()
    };

    this.masterItems[index] = updated;
    this.saveMasterItems();

    await this.logAudit({
      user: author,
      action: 'UPDATE',
      entityType: 'MASTER_ITEM',
      entityId: updated.id,
      entityIdentifier: updated.productCode,
      details: `Updated master item "${updated.productCode}"`
    });

    if (isTauri()) {
      this.syncTauri('update_master_item', updated);
    }

    realtimeSync.broadcastMutation('MUTATION_ITEM_UPDATED', updated.productCode, `Updated master item "${updated.productCode}"`, updated);
    this.notifyListeners();

    return { success: true, item: updated };
  }

  public async deleteMasterItem(
    id: string,
    author = 'User'
  ): Promise<{ success: boolean; error?: string }> {
    await this.init();
    const item = this.masterItems.find((m) => m.id === id);
    if (!item) {
      return { success: false, error: 'Master item not found.' };
    }

    // Check if referenced
    const hasReg = this.registrations.some(
      (r) => r.masterItemId === id || r.productCode.toLowerCase() === item.productCode.toLowerCase()
    );
    if (hasReg) {
      return {
        success: false,
        error: `Cannot delete "${item.productCode}" because active reference registration exists. Please delete or archive the sample registration first.`
      };
    }

    this.masterItems = this.masterItems.filter((m) => m.id !== id);
    this.saveMasterItems();

    await this.logAudit({
      user: author,
      action: 'DELETE',
      entityType: 'MASTER_ITEM',
      entityId: id,
      entityIdentifier: item.productCode,
      details: `Deleted master item "${item.productCode}"`
    });

    if (isTauri()) {
      this.syncTauri('delete_master_item', { id });
    }

    realtimeSync.broadcastMutation('MUTATION_ITEM_DELETED', item.productCode, `Deleted master item "${item.productCode}"`, { id });
    this.notifyListeners();

    return { success: true };
  }

  public async bulkImportMasterItems(
    rows: Array<Omit<MasterItem, 'id' | 'createdAt' | 'updatedAt'>>,
    author = 'User'
  ): Promise<{ importedCount: number; updatedCount: number }> {
    await this.init();
    let importedCount = 0;
    let updatedCount = 0;
    const now = new Date().toISOString();

    for (const row of rows) {
      const code = row.productCode.trim();
      if (!code) continue;

      const rawMatType = (row as any).materialType || ((row.category === 'RM' || row.category === 'PS') ? row.category : 'RM');
      const rawCat = (row.category && row.category !== 'RM' && row.category !== 'PS') 
        ? row.category.trim() 
        : '';

      if (rawCat) {
        await this.addCategory(rawCat);
      }

      const existingIndex = this.masterItems.findIndex(
        (m) => m.productCode.toLowerCase() === code.toLowerCase()
      );

      if (existingIndex >= 0) {
        this.masterItems[existingIndex] = {
          ...this.masterItems[existingIndex],
          description: row.description.trim(),
          materialType: rawMatType,
          category: rawCat,
          status: row.status,
          unit: row.unit?.trim() || undefined,
          updatedAt: now
        };
        updatedCount++;
      } else {
        const newItem: MasterItem = {
          id: `item-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
          productCode: code,
          description: row.description.trim(),
          materialType: rawMatType,
          category: rawCat,
          status: row.status,
          unit: row.unit?.trim() || undefined,
          createdAt: now,
          updatedAt: now
        };
        this.masterItems.push(newItem);
        importedCount++;
      }
    }

    this.saveMasterItems();

    await this.logAudit({
      user: author,
      action: 'IMPORT',
      entityType: 'MASTER_ITEM',
      details: `Bulk imported Excel master items: ${importedCount} new created, ${updatedCount} updated. (Zero inventory fields loaded).`
    });

    if (isTauri()) {
      this.syncTauri('bulk_save_master_items', this.masterItems);
    }

    realtimeSync.broadcastMutation('MUTATION_ITEM_BULK', 'Catalog', `Bulk imported ${importedCount} new items, updated ${updatedCount} items`);
    this.notifyListeners();

    return { importedCount, updatedCount };
  }

  // Reference Registration & Revision Approval Management
  public async getRegistrations(): Promise<ReferenceRegistration[]> {
    await this.init();
    return [...this.registrations];
  }

  public async getRegistrationById(id: string): Promise<ReferenceRegistration | undefined> {
    await this.init();
    return this.registrations.find((r) => r.id === id);
  }

  public async getRegistrationByProductCode(productCode: string): Promise<ReferenceRegistration | undefined> {
    await this.init();
    const clean = productCode.trim().toLowerCase();
    return this.registrations.find((r) => r.productCode.toLowerCase() === clean);
  }

  // Permission & Ownership Check
  public checkCanEdit(
    reg: ReferenceRegistration,
    user?: { role?: string; shortName?: string; fullName?: string; idNumber?: string } | null
  ): { allowed: boolean; reason?: string } {
    if (!user) {
      return { allowed: false, reason: 'Authentication required. Please log in to edit or submit revisions.' };
    }
    if (user.role === 'admin') {
      return { allowed: true };
    }
    const cleanRegBy = (reg.registeredBy || '').trim().toLowerCase();
    const userFull = (user.fullName || '').trim().toLowerCase();
    const userShort = (user.shortName || '').trim().toLowerCase();
    const userId = (user.idNumber || '').trim().toLowerCase();

    const isOwner = (
      cleanRegBy === userFull ||
      cleanRegBy === userShort ||
      cleanRegBy === userId ||
      cleanRegBy.includes(userShort) ||
      userFull.includes(cleanRegBy)
    );

    if (!isOwner) {
      return {
        allowed: false,
        reason: `Permission Restricted: Reference was registered by "${reg.registeredBy}". Only the original registrant or a System Administrator can edit or submit revisions.`
      };
    }

    return { allowed: true };
  }

  public async createRegistration(
    regData: Omit<ReferenceRegistration, 'id' | 'createdAt' | 'updatedAt'>,
    author?: string,
    autoApprove = false
  ): Promise<{ success: boolean; registration?: ReferenceRegistration; error?: string }> {
    await this.init();
    const normalizedCode = regData.productCode.trim();

    // Verify master item exists or auto-create it
    let masterItem = await this.getMasterItemByCode(normalizedCode);
    if (!masterItem) {
      const createRes = await this.createMasterItem({
        productCode: normalizedCode,
        description: regData.specification || `Reference Item ${normalizedCode}`,
        materialType: regData.materialType || 'RM',
        category: regData.category || 'Box',
        unit: 'Piece',
        status: 'Active'
      }, author || regData.registeredBy || 'System');

      if (createRes.success && createRes.item) {
        masterItem = createRes.item;
      } else {
        return {
          success: false,
          error: createRes.error || `Master item for Product Code "${normalizedCode}" could not be created.`
        };
      }
    }

    // Duplicate Check: if duplicate exists, route to submitRevision for the existing registration
    const duplicate = this.registrations.find(
      (r) => r.productCode.toLowerCase() === normalizedCode.toLowerCase()
    );
    if (duplicate) {
      return this.submitRevision(
        duplicate.id,
        regData,
        { shortName: author || regData.registeredBy, fullName: author || regData.registeredBy, role: autoApprove ? 'admin' : 'user' },
        'Updated via registration form',
        autoApprove
      );
    }

    const regCategory = regData.category?.trim() || masterItem.category;
    if (regCategory) {
      await this.addCategory(regCategory);
    }

    const now = new Date().toISOString();
    const initialStatus: RevisionStatus = autoApprove ? 'APPROVED' : 'PENDING_APPROVAL';
    const initialRevisionCode = regData.revision?.trim() || 'Rev 01';
    const refId = `ref-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const versionId = `ver-${Date.now()}-1`;

    const initialVersionRecord: ReferenceRevisionRecord = {
      id: versionId,
      referenceId: refId,
      versionNumber: 1,
      revisionCode: initialRevisionCode,
      status: initialStatus,
      masterItemId: masterItem.id,
      productCode: masterItem.productCode,
      materialType: regData.materialType || masterItem.materialType,
      category: regCategory,
      registrationDate: regData.registrationDate || now.split('T')[0],
      registeredBy: regData.registeredBy.trim() || author || this.config.defaultRegisteredBy,
      supplier: regData.supplier?.trim() || undefined,
      specification: regData.specification?.trim() || undefined,
      remarks: regData.remarks?.trim() || undefined,
      customFields: regData.customFields || {},
      photos: regData.photos || [],
      attachments: regData.attachments || [],
      selectedPrintPhotoIds: regData.selectedPrintPhotoIds,
      printLayout: regData.printLayout,
      submittedBy: regData.registeredBy.trim() || author || this.config.defaultRegisteredBy,
      submittedAt: now,
      approvedBy: autoApprove ? (author || 'System Admin') : undefined,
      approvedAt: autoApprove ? now : undefined,
      changeSummary: 'Initial base registration'
    };

    const newReg: ReferenceRegistration = {
      id: refId,
      masterItemId: masterItem.id,
      productCode: masterItem.productCode,
      materialType: regData.materialType || masterItem.materialType,
      category: regCategory,
      registrationDate: regData.registrationDate || now.split('T')[0],
      registeredBy: regData.registeredBy.trim() || author || this.config.defaultRegisteredBy,
      supplier: regData.supplier?.trim() || undefined,
      specification: regData.specification?.trim() || undefined,
      remarks: regData.remarks?.trim() || undefined,
      revision: initialRevisionCode,
      status: initialStatus,
      currentVersionNumber: 1,
      currentApprovedVersionId: autoApprove ? versionId : undefined,
      hasPendingRevision: !autoApprove,
      pendingRevisionId: !autoApprove ? versionId : undefined,
      pendingRevision: !autoApprove ? initialVersionRecord : undefined,
      versions: [initialVersionRecord],
      revisionHistory: [
        {
          id: versionId,
          revision: initialRevisionCode,
          date: regData.registrationDate || now.split('T')[0],
          author: regData.registeredBy.trim() || author || 'Inspector',
          status: initialStatus,
          specification: regData.specification,
          remarks: regData.remarks,
          supplier: regData.supplier,
          changeSummary: 'Initial base registration'
        }
      ],
      customFields: regData.customFields || {},
      photos: regData.photos || [],
      attachments: regData.attachments || [],
      selectedPrintPhotoIds: regData.selectedPrintPhotoIds,
      printLayout: regData.printLayout,
      wordFormGenerated: !!regData.wordFormGenerated,
      wordFormLastGeneratedAt: regData.wordFormLastGeneratedAt,
      createdAt: now,
      updatedAt: now
    };

    this.registrations.unshift(newReg);
    this.saveRegistrations();

    await this.logAudit({
      user: newReg.registeredBy,
      action: autoApprove ? 'CREATE' : 'SUBMIT_REVISION',
      entityType: 'REFERENCE',
      entityId: newReg.id,
      entityIdentifier: newReg.productCode,
      details: autoApprove
        ? `Registered official reference sample for "${newReg.productCode}" (${newReg.revision}) by ${newReg.registeredBy}`
        : `Submitted new reference registration for "${newReg.productCode}" (${newReg.revision}) awaiting Admin Approval`
    });

    if (isTauri()) {
      this.syncTauri('create_registration', newReg);
    }

    realtimeSync.broadcastMutation('MUTATION_REG_CREATED', newReg.productCode, `Registered reference sample "${newReg.productCode}" (${newReg.revision})`, newReg);
    this.notifyListeners();

    return { success: true, registration: newReg };
  }

  public getNextRevision(currentRev: string): string {
    if (!currentRev) return 'Rev 02';
    const match = currentRev.match(/(\d+)/);
    if (match) {
      const num = parseInt(match[1], 10) + 1;
      const padded = num < 10 ? `0${num}` : `${num}`;
      const prefix = currentRev.substring(0, match.index);
      return `${prefix}${padded}`;
    }
    return `${currentRev} Rev 02`;
  }

  // Submit Revision Workflow (Preserves Active Version while Pending Approval)
  public async submitRevision(
    referenceId: string,
    updates: Partial<ReferenceRegistration>,
    authorUser?: { shortName?: string; fullName?: string; role?: string; idNumber?: string } | null,
    revisionNotes?: string,
    autoApprove = false
  ): Promise<{ success: boolean; registration?: ReferenceRegistration; revision?: ReferenceRevisionRecord; error?: string }> {
    await this.init();
    const index = this.registrations.findIndex((r) => r.id === referenceId);
    if (index === -1) {
      return { success: false, error: 'Reference registration not found.' };
    }

    const current = this.registrations[index];

    // Check permissions
    if (authorUser) {
      const check = this.checkCanEdit(current, authorUser);
      if (!check.allowed) {
        return { success: false, error: check.reason };
      }
    }

    // Determine new revision code and version number
    const nextVersionNumber = (current.currentVersionNumber || 1) + 1;
    let newRevisionCode = updates.revision && updates.revision.trim()
      ? updates.revision.trim()
      : this.getNextRevision(current.revision || 'Rev 01');

    if (newRevisionCode === current.revision) {
      newRevisionCode = this.getNextRevision(current.revision);
    }

    // Calculate changed fields summary
    const changedFields: string[] = [];
    if (updates.supplier !== undefined && updates.supplier !== current.supplier) changedFields.push('Supplier');
    if (updates.lotReference !== undefined && updates.lotReference !== current.lotReference) changedFields.push('Lot Reference');
    if (updates.specification !== undefined && updates.specification !== current.specification) changedFields.push('Specification');
    if (updates.remarks !== undefined && updates.remarks !== current.remarks) changedFields.push('Remarks');
    if (updates.category !== undefined && updates.category !== current.category) changedFields.push('Category');
    if (updates.materialType !== undefined && updates.materialType !== current.materialType) changedFields.push('Material Type');
    if (updates.photos && JSON.stringify(updates.photos) !== JSON.stringify(current.photos)) changedFields.push('Photos');
    if (updates.attachments && JSON.stringify(updates.attachments) !== JSON.stringify(current.attachments)) changedFields.push('Attachments');
    if (updates.customFields && JSON.stringify(updates.customFields) !== JSON.stringify(current.customFields)) changedFields.push('Custom Fields');
    if (updates.printLayout !== undefined && updates.printLayout !== current.printLayout) changedFields.push('Print Layout');

    const changeSummary = changedFields.length > 0
      ? `Updated ${changedFields.join(', ')}`
      : 'Specification and metadata review';

    const now = new Date().toISOString();
    const authorName = authorUser?.fullName || authorUser?.shortName || current.registeredBy || 'Inspector';
    const versionId = `ver-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;

    if (updates.category && updates.category.trim()) {
      await this.addCategory(updates.category.trim());
    }

    const revisionRecord: ReferenceRevisionRecord = {
      id: versionId,
      referenceId: current.id,
      versionNumber: nextVersionNumber,
      revisionCode: newRevisionCode,
      status: autoApprove ? 'APPROVED' : 'PENDING_APPROVAL',
      masterItemId: current.masterItemId,
      productCode: current.productCode,
      materialType: updates.materialType || current.materialType,
      category: updates.category || current.category,
      registrationDate: updates.registrationDate || now.split('T')[0],
      registeredBy: current.registeredBy,
      supplier: updates.supplier !== undefined ? updates.supplier?.trim() : current.supplier,
      lotReference: updates.lotReference !== undefined ? updates.lotReference?.trim() : current.lotReference,
      specification: updates.specification !== undefined ? updates.specification?.trim() : current.specification,
      remarks: updates.remarks !== undefined ? updates.remarks?.trim() : current.remarks,
      customFields: updates.customFields || { ...current.customFields },
      photos: updates.photos || [...current.photos],
      attachments: updates.attachments || [...current.attachments],
      selectedPrintPhotoIds: updates.selectedPrintPhotoIds || current.selectedPrintPhotoIds,
      printLayout: updates.printLayout || current.printLayout,
      submittedBy: authorName,
      submittedAt: now,
      approvedBy: autoApprove ? authorName : undefined,
      approvedAt: autoApprove ? now : undefined,
      revisionNotes: revisionNotes || changeSummary,
      changeSummary,
      changedFields
    };

    let existingVersions = Array.isArray(current.versions) ? [...current.versions] : [];
    // If pending revision already exists, replace or prepend
    existingVersions = existingVersions.filter((v) => v.status !== 'PENDING_APPROVAL');
    existingVersions.unshift(revisionRecord);

    let updatedReg: ReferenceRegistration;

    if (autoApprove) {
      // Immediate Admin Approval: Apply directly to active official fields
      updatedReg = {
        ...current,
        supplier: revisionRecord.supplier,
        specification: revisionRecord.specification,
        remarks: revisionRecord.remarks,
        category: revisionRecord.category,
        materialType: revisionRecord.materialType,
        customFields: revisionRecord.customFields,
        photos: revisionRecord.photos,
        attachments: revisionRecord.attachments,
        selectedPrintPhotoIds: revisionRecord.selectedPrintPhotoIds,
        printLayout: revisionRecord.printLayout,
        revision: revisionRecord.revisionCode,
        currentVersionNumber: revisionRecord.versionNumber,
        currentApprovedVersionId: revisionRecord.id,
        status: 'APPROVED',
        hasPendingRevision: false,
        pendingRevisionId: undefined,
        pendingRevision: undefined,
        versions: existingVersions,
        updatedAt: now
      };

      await this.logAudit({
        user: authorName,
        action: 'APPROVE',
        entityType: 'REVISION',
        entityId: updatedReg.id,
        entityIdentifier: updatedReg.productCode,
        details: `Approved revision "${revisionRecord.revisionCode}" for "${updatedReg.productCode}" (${changeSummary})`
      });

      realtimeSync.broadcastMutation('MUTATION_REVISION_APPROVED', updatedReg.productCode, `Approved revision "${revisionRecord.revisionCode}" for "${updatedReg.productCode}"`, updatedReg);
    } else {
      // Staged Revision: Keep current active official version completely UNTOUCHED
      updatedReg = {
        ...current,
        hasPendingRevision: true,
        pendingRevisionId: revisionRecord.id,
        pendingRevision: revisionRecord,
        versions: existingVersions,
        updatedAt: now
      };

      await this.logAudit({
        user: authorName,
        action: 'SUBMIT_REVISION',
        entityType: 'REVISION',
        entityId: updatedReg.id,
        entityIdentifier: updatedReg.productCode,
        details: `Submitted new revision "${revisionRecord.revisionCode}" for "${updatedReg.productCode}" awaiting Admin Approval (${changeSummary})`
      });

      realtimeSync.broadcastMutation('MUTATION_REVISION_SUBMITTED', updatedReg.productCode, `New revision "${revisionRecord.revisionCode}" submitted for "${updatedReg.productCode}"`, updatedReg);
    }

    this.registrations[index] = updatedReg;
    this.saveRegistrations();

    if (isTauri()) {
      this.syncTauri('update_registration', updatedReg);
    }

    this.notifyListeners();
    return { success: true, registration: updatedReg, revision: revisionRecord };
  }

  // Update registration wrapper (direct update if item is pending approval; otherwise routes to submitRevision)
  public async updateRegistration(
    id: string,
    updates: Partial<Omit<ReferenceRegistration, 'id' | 'createdAt'>>,
    author?: string,
    authorUser?: { shortName?: string; fullName?: string; role?: string; idNumber?: string } | null,
    autoApprove = false
  ): Promise<{ success: boolean; registration?: ReferenceRegistration; error?: string }> {
    await this.init();
    const index = this.registrations.findIndex((r) => r.id === id);
    if (index === -1) {
      return { success: false, error: 'Reference registration not found.' };
    }

    const current = this.registrations[index];

    // If the registration is NOT approved yet (e.g. PENDING_APPROVAL or REJECTED),
    // editing it should NOT be counted as a revision. It updates the pending record directly.
    if (current.status !== 'APPROVED') {
      // Check permissions
      if (authorUser) {
        const check = this.checkCanEdit(current, authorUser);
        if (!check.allowed) {
          return { success: false, error: check.reason };
        }
      }

      const now = new Date().toISOString();
      const authorName = authorUser?.fullName || authorUser?.shortName || author || current.registeredBy || 'Inspector';

      if (updates.category && updates.category.trim()) {
        await this.addCategory(updates.category.trim());
      }

      // Selected print photo IDs
      const selectedPrintPhotoIds = updates.selectedPrintPhotoIds !== undefined
        ? updates.selectedPrintPhotoIds
        : updates.photos
        ? updates.photos.filter(p => p.includeInPrint).map(p => p.id)
        : current.selectedPrintPhotoIds;

      const updatedReg: ReferenceRegistration = {
        ...current,
        supplier: updates.supplier !== undefined ? updates.supplier?.trim() : current.supplier,
        specification: updates.specification !== undefined ? updates.specification?.trim() : current.specification,
        remarks: updates.remarks !== undefined ? updates.remarks?.trim() : current.remarks,
        category: updates.category || current.category,
        materialType: updates.materialType || current.materialType,
        customFields: updates.customFields || { ...current.customFields },
        photos: updates.photos || [...current.photos],
        attachments: updates.attachments || [...current.attachments],
        selectedPrintPhotoIds,
        printLayout: updates.printLayout || current.printLayout,
        // Maintain active revision code (e.g. Rev 01) - no revision increment
        revision: current.revision || 'Rev 01',
        // If an admin directly updates it with autoApprove, approve it, otherwise keep pending
        status: autoApprove ? 'APPROVED' : current.status,
        updatedAt: now
      };

      this.registrations[index] = updatedReg;
      this.saveRegistrations();

      await this.logAudit({
        user: authorName,
        action: 'UPDATE',
        entityType: 'REFERENCE',
        entityId: updatedReg.id,
        entityIdentifier: updatedReg.productCode,
        details: `Updated pending reference registration "${updatedReg.productCode}" (${updatedReg.revision}) before approval`
      });

      if (isTauri()) {
        this.syncTauri('update_registration', updatedReg);
      }

      realtimeSync.broadcastMutation(
        'MUTATION_REG_UPDATED',
        updatedReg.productCode,
        `Updated pending reference registration "${updatedReg.productCode}"`,
        updatedReg
      );

      this.notifyListeners();
      return { success: true, registration: updatedReg };
    }

    // If the registration is already APPROVED, editing requires formal revision workflow & approval
    return this.submitRevision(
      id,
      updates,
      authorUser || (author ? { fullName: author, shortName: author, role: autoApprove ? 'admin' : 'user' } : null),
      'Updated via edit dialog',
      autoApprove
    );
  }

  // Admin Revision Approval
  public async approveRevision(
    referenceId: string,
    revisionId: string,
    adminUser: { fullName?: string; shortName?: string; role?: string },
    approvalNotes?: string
  ): Promise<{ success: boolean; registration?: ReferenceRegistration; error?: string }> {
    await this.init();
    if (adminUser.role !== 'admin') {
      return { success: false, error: 'Only administrators have authorization to approve revisions.' };
    }

    const index = this.registrations.findIndex((r) => r.id === referenceId);
    if (index === -1) {
      return { success: false, error: 'Reference registration not found.' };
    }

    const current = this.registrations[index];
    const versions = Array.isArray(current.versions) ? [...current.versions] : [];
    const revIndex = versions.findIndex((v) => v.id === revisionId);
    if (revIndex === -1) {
      return { success: false, error: 'Target revision record not found.' };
    }

    const targetRev = versions[revIndex];
    const adminName = adminUser.fullName || adminUser.shortName || 'Administrator';
    const now = new Date().toISOString();

    const approvedRev: ReferenceRevisionRecord = {
      ...targetRev,
      status: 'APPROVED',
      approvedBy: adminName,
      approvedAt: now,
      revisionNotes: approvalNotes || targetRev.revisionNotes || 'Approved by administrator'
    };

    versions[revIndex] = approvedRev;

    // Apply revision to official fields of ReferenceRegistration
    const updatedReg: ReferenceRegistration = {
      ...current,
      supplier: approvedRev.supplier,
      specification: approvedRev.specification,
      remarks: approvedRev.remarks,
      category: approvedRev.category,
      materialType: approvedRev.materialType,
      customFields: approvedRev.customFields,
      photos: approvedRev.photos,
      attachments: approvedRev.attachments,
      selectedPrintPhotoIds: approvedRev.selectedPrintPhotoIds,
      printLayout: approvedRev.printLayout,
      revision: approvedRev.revisionCode,
      currentVersionNumber: approvedRev.versionNumber,
      currentApprovedVersionId: approvedRev.id,
      status: 'APPROVED',
      hasPendingRevision: false,
      pendingRevisionId: undefined,
      pendingRevision: undefined,
      versions,
      updatedAt: now
    };

    this.registrations[index] = updatedReg;
    this.saveRegistrations();

    await this.logAudit({
      user: adminName,
      action: 'APPROVE',
      entityType: 'REVISION',
      entityId: updatedReg.id,
      entityIdentifier: updatedReg.productCode,
      details: `Admin Approved Revision "${approvedRev.revisionCode}" for "${updatedReg.productCode}". Revision is now the official active version.`
    });

    if (isTauri()) {
      this.syncTauri('update_registration', updatedReg);
    }

    realtimeSync.broadcastMutation('MUTATION_REVISION_APPROVED', updatedReg.productCode, `Admin Approved Revision "${approvedRev.revisionCode}" for "${updatedReg.productCode}"`, updatedReg);
    this.notifyListeners();

    return { success: true, registration: updatedReg };
  }

  // Admin Revision Rejection
  public async rejectRevision(
    referenceId: string,
    revisionId: string,
    adminUser: { fullName?: string; shortName?: string; role?: string },
    rejectionReason: string
  ): Promise<{ success: boolean; registration?: ReferenceRegistration; error?: string }> {
    await this.init();
    if (adminUser.role !== 'admin') {
      return { success: false, error: 'Only administrators have authorization to reject revisions.' };
    }

    const index = this.registrations.findIndex((r) => r.id === referenceId);
    if (index === -1) {
      return { success: false, error: 'Reference registration not found.' };
    }

    const current = this.registrations[index];
    const versions = Array.isArray(current.versions) ? [...current.versions] : [];
    const revIndex = versions.findIndex((v) => v.id === revisionId);
    if (revIndex === -1) {
      return { success: false, error: 'Target revision record not found.' };
    }

    const targetRev = versions[revIndex];
    const adminName = adminUser.fullName || adminUser.shortName || 'Administrator';
    const now = new Date().toISOString();

    const rejectedRev: ReferenceRevisionRecord = {
      ...targetRev,
      status: 'REJECTED',
      rejectedBy: adminName,
      rejectedAt: now,
      rejectionReason: rejectionReason.trim() || 'Revision rejected by administrator'
    };

    versions[revIndex] = rejectedRev;

    // Keep current official active fields completely UNTOUCHED
    const updatedReg: ReferenceRegistration = {
      ...current,
      hasPendingRevision: false,
      pendingRevisionId: undefined,
      pendingRevision: undefined,
      versions,
      updatedAt: now
    };

    this.registrations[index] = updatedReg;
    this.saveRegistrations();

    await this.logAudit({
      user: adminName,
      action: 'REJECT',
      entityType: 'REVISION',
      entityId: updatedReg.id,
      entityIdentifier: updatedReg.productCode,
      details: `Admin Rejected Revision "${targetRev.revisionCode}" for "${updatedReg.productCode}". Reason: ${rejectionReason}. Official version remains "${current.revision}".`
    });

    if (isTauri()) {
      this.syncTauri('update_registration', updatedReg);
    }

    realtimeSync.broadcastMutation('MUTATION_REVISION_REJECTED', updatedReg.productCode, `Admin Rejected Revision "${targetRev.revisionCode}" for "${updatedReg.productCode}"`, updatedReg);
    this.notifyListeners();

    return { success: true, registration: updatedReg };
  }

  // Admin New Registration Approval
  public async approveNewRegistration(
    referenceId: string,
    adminUser: { fullName?: string; shortName?: string; role?: string }
  ): Promise<{ success: boolean; registration?: ReferenceRegistration; error?: string }> {
    await this.init();
    const index = this.registrations.findIndex((r) => r.id === referenceId);
    if (index === -1) return { success: false, error: 'Reference registration not found.' };

    const current = this.registrations[index];
    const adminName = adminUser.fullName || adminUser.shortName || 'Administrator';
    const now = new Date().toISOString();

    const versions = (current.versions || []).map((v) => {
      if (v.status === 'PENDING_APPROVAL') {
        return {
          ...v,
          status: 'APPROVED' as RevisionStatus,
          approvedBy: adminName,
          approvedAt: now
        };
      }
      return v;
    });

    const approvedVersion = versions.find((v) => v.status === 'APPROVED');

    const updatedReg: ReferenceRegistration = {
      ...current,
      status: 'APPROVED',
      currentApprovedVersionId: approvedVersion ? approvedVersion.id : current.currentApprovedVersionId,
      hasPendingRevision: false,
      pendingRevisionId: undefined,
      pendingRevision: undefined,
      versions,
      updatedAt: now
    };

    this.registrations[index] = updatedReg;
    this.saveRegistrations();

    await this.logAudit({
      user: adminName,
      action: 'APPROVE',
      entityType: 'REFERENCE',
      entityId: updatedReg.id,
      entityIdentifier: updatedReg.productCode,
      details: `Admin Approved New Reference Registration for "${updatedReg.productCode}" (${updatedReg.revision})`
    });

    realtimeSync.broadcastMutation('MUTATION_REVISION_APPROVED', updatedReg.productCode, `Admin Approved New Reference Registration for "${updatedReg.productCode}"`, updatedReg);
    this.notifyListeners();
    return { success: true, registration: updatedReg };
  }

  // Admin New Registration Rejection
  public async rejectNewRegistration(
    referenceId: string,
    adminUser: { fullName?: string; shortName?: string; role?: string },
    rejectionReason: string
  ): Promise<{ success: boolean; registration?: ReferenceRegistration; error?: string }> {
    await this.init();
    const index = this.registrations.findIndex((r) => r.id === referenceId);
    if (index === -1) return { success: false, error: 'Reference registration not found.' };

    const current = this.registrations[index];
    const adminName = adminUser.fullName || adminUser.shortName || 'Administrator';
    const now = new Date().toISOString();

    const versions = (current.versions || []).map((v) => {
      if (v.status === 'PENDING_APPROVAL') {
        return {
          ...v,
          status: 'REJECTED' as RevisionStatus,
          rejectedBy: adminName,
          rejectedAt: now,
          rejectionReason
        };
      }
      return v;
    });

    const updatedReg: ReferenceRegistration = {
      ...current,
      status: 'REJECTED',
      hasPendingRevision: false,
      pendingRevisionId: undefined,
      pendingRevision: undefined,
      versions,
      updatedAt: now
    };

    this.registrations[index] = updatedReg;
    this.saveRegistrations();

    await this.logAudit({
      user: adminName,
      action: 'REJECT',
      entityType: 'REFERENCE',
      entityId: updatedReg.id,
      entityIdentifier: updatedReg.productCode,
      details: `Admin Rejected New Reference Registration for "${updatedReg.productCode}". Reason: ${rejectionReason}`
    });

    realtimeSync.broadcastMutation('MUTATION_REVISION_REJECTED', updatedReg.productCode, `Admin Rejected New Reference Registration for "${updatedReg.productCode}"`, updatedReg);
    this.notifyListeners();
    return { success: true, registration: updatedReg };
  }

  // Get list of pending revisions across all references
  public async getPendingRevisions(): Promise<Array<{ registration: ReferenceRegistration; revision: ReferenceRevisionRecord }>> {
    await this.init();
    const pendingList: Array<{ registration: ReferenceRegistration; revision: ReferenceRevisionRecord }> = [];

    for (const reg of this.registrations) {
      if (reg.versions) {
        for (const rev of reg.versions) {
          if (rev.status === 'PENDING_APPROVAL' && rev.versionNumber > 1) {
            pendingList.push({ registration: reg, revision: rev });
          }
        }
      }
    }

    return pendingList.sort((a, b) => new Date(b.revision.submittedAt).getTime() - new Date(a.revision.submittedAt).getTime());
  }

  // Get list of pending new registrations
  public async getPendingNewRegistrations(): Promise<ReferenceRegistration[]> {
    await this.init();
    return this.registrations.filter((r) => r.status === 'PENDING_APPROVAL' && (!r.currentVersionNumber || r.currentVersionNumber <= 1));
  }

  // Get full revision history
  public async getAllRevisions(referenceId?: string): Promise<ReferenceRevisionRecord[]> {
    await this.init();
    if (referenceId) {
      const reg = this.registrations.find((r) => r.id === referenceId);
      return reg?.versions || [];
    }
    const all: ReferenceRevisionRecord[] = [];
    for (const reg of this.registrations) {
      if (reg.versions) {
        all.push(...reg.versions);
      }
    }
    return all.sort((a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime());
  }

  public async deleteRegistration(
    id: string,
    author = 'User'
  ): Promise<{ success: boolean; error?: string }> {
    await this.init();
    const reg = this.registrations.find((r) => r.id === id);
    if (!reg) {
      return { success: false, error: 'Registration not found.' };
    }

    this.registrations = this.registrations.filter((r) => r.id !== id);
    this.saveRegistrations();

    await this.logAudit({
      user: author,
      action: 'DELETE',
      entityType: 'REFERENCE',
      entityId: id,
      entityIdentifier: reg.productCode,
      details: `Deleted reference sample registration for "${reg.productCode}" (${reg.revision})`
    });

    if (isTauri()) {
      this.syncTauri('delete_registration', { id });
    }

    realtimeSync.broadcastMutation('MUTATION_REG_DELETED', reg.productCode, `Deleted reference sample for "${reg.productCode}"`, { id });
    this.notifyListeners();

    return { success: true };
  }

  // Audit Logs
  public async getAuditLogs(): Promise<AuditLogEntry[]> {
    await this.init();
    return [...this.auditLogs];
  }

  public async logAudit(entry: Omit<AuditLogEntry, 'id' | 'timestamp'>): Promise<void> {
    const newEntry: AuditLogEntry = {
      id: `audit-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      timestamp: new Date().toISOString(),
      ...entry
    };
    this.auditLogs.unshift(newEntry);
    if (this.auditLogs.length > 500) {
      this.auditLogs = this.auditLogs.slice(0, 500);
    }
    this.saveAuditLogs();
  }

  // Custom Fields Modular Schema
  public async getCustomFields(): Promise<CustomFieldDefinition[]> {
    await this.init();
    return [...(this.config.customFields || DEFAULT_CUSTOM_FIELDS)];
  }

  public async saveCustomField(
    field: CustomFieldDefinition,
    author = 'Admin'
  ): Promise<{ success: boolean }> {
    await this.init();
    const currentFields = [...(this.config.customFields || DEFAULT_CUSTOM_FIELDS)];
    const idx = currentFields.findIndex((f) => f.id === field.id || f.key === field.key);
    if (idx >= 0) {
      currentFields[idx] = field;
    } else {
      currentFields.push(field);
    }
    this.config.customFields = currentFields;
    this.saveLocalConfig();

    await this.logAudit({
      user: author,
      action: 'UPDATE',
      entityType: 'SETTINGS',
      details: `Updated custom dynamic field definition: "${field.label}" (${field.key})`
    });

    return { success: true };
  }

  public async deleteCustomField(
    fieldId: string,
    author = 'Admin'
  ): Promise<{ success: boolean }> {
    await this.init();
    const currentFields = (this.config.customFields || DEFAULT_CUSTOM_FIELDS).filter(
      (f) => f.id !== fieldId
    );
    this.config.customFields = currentFields;
    this.saveLocalConfig();

    await this.logAudit({
      user: author,
      action: 'DELETE',
      entityType: 'SETTINGS',
      details: `Removed custom dynamic field with ID "${fieldId}"`
    });

    return { success: true };
  }

  // App Config
  public async getConfig(): Promise<AppConfig> {
    await this.init();
    return { ...this.config };
  }

  // Form Templates Management
  public async getFormTemplates(formType?: FormType): Promise<FormTemplate[]> {
    await this.init();
    if (formType) {
      return this.formTemplates.filter(t => t.formType === formType);
    }
    return [...this.formTemplates];
  }

  public async getActiveFormTemplate(formType: FormType): Promise<FormTemplate | null> {
    await this.init();
    const match = this.formTemplates.find(t => t.formType === formType && t.isActive);
    if (match) return { ...match };
    // If no active template found, fallback to first built-in or first available
    const fallback = this.formTemplates.find(t => t.formType === formType && t.isBuiltIn) ||
      this.formTemplates.find(t => t.formType === formType);
    return fallback ? { ...fallback } : null;
  }

  public async saveFormTemplate(
    template: FormTemplate,
    author = 'Admin'
  ): Promise<{ success: boolean; template: FormTemplate }> {
    await this.init();
    const existingIndex = this.formTemplates.findIndex(t => t.id === template.id);
    const now = new Date().toISOString();
    let updatedTemplate: FormTemplate;

    if (existingIndex >= 0) {
      updatedTemplate = {
        ...this.formTemplates[existingIndex],
        ...template,
        updatedAt: now
      };
      this.formTemplates[existingIndex] = updatedTemplate;
    } else {
      updatedTemplate = {
        ...template,
        id: template.id || `tpl-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        createdAt: template.createdAt || now,
        updatedAt: now,
        createdBy: template.createdBy || author
      };
      this.formTemplates.push(updatedTemplate);
    }

    // If this template is marked active, deactivate other templates of the same formType
    if (updatedTemplate.isActive) {
      this.formTemplates.forEach(t => {
        if (t.formType === updatedTemplate.formType && t.id !== updatedTemplate.id) {
          t.isActive = false;
        }
      });
    }

    this.saveFormTemplatesLocal();

    await this.logAudit({
      user: author,
      action: existingIndex >= 0 ? 'UPDATE' : 'CREATE',
      entityType: 'SETTINGS',
      details: `${existingIndex >= 0 ? 'Updated' : 'Imported/Created'} form template "${updatedTemplate.name}" (${updatedTemplate.formType}, v${updatedTemplate.version})`
    });

    realtimeSync.broadcastMutation(
      'MUTATION_CONFIG_UPDATED',
      'FormTemplates',
      `Form template "${updatedTemplate.name}" was saved.`
    );
    this.notifyListeners();

    return { success: true, template: updatedTemplate };
  }

  public async setActiveFormTemplate(
    templateId: string,
    formType: FormType,
    author = 'Admin'
  ): Promise<{ success: boolean; message?: string }> {
    await this.init();
    const target = this.formTemplates.find(t => t.id === templateId && t.formType === formType);
    if (!target) {
      return { success: false, message: 'Template not found for the specified form type.' };
    }

    this.formTemplates.forEach(t => {
      if (t.formType === formType) {
        t.isActive = t.id === templateId;
      }
    });

    this.saveFormTemplatesLocal();

    await this.logAudit({
      user: author,
      action: 'UPDATE',
      entityType: 'SETTINGS',
      details: `Set "${target.name}" as the active template for ${formType === 'material_reference_sheet' ? 'Material Reference Sheet' : 'Inspection Proof Slip'}`
    });

    realtimeSync.broadcastMutation(
      'MUTATION_CONFIG_UPDATED',
      'FormTemplates',
      `Active template changed to "${target.name}".`
    );
    this.notifyListeners();

    return { success: true };
  }

  public async deleteFormTemplate(
    templateId: string,
    author = 'Admin'
  ): Promise<{ success: boolean; message?: string }> {
    await this.init();
    const targetIndex = this.formTemplates.findIndex(t => t.id === templateId);
    if (targetIndex === -1) {
      return { success: false, message: 'Template not found.' };
    }

    const target = this.formTemplates[targetIndex];
    const sameTypeTemplates = this.formTemplates.filter(t => t.formType === target.formType);

    if (sameTypeTemplates.length <= 1) {
      return {
        success: false,
        message: `Cannot delete "${target.name}". At least one template must remain for ${
          target.formType === 'material_reference_sheet' ? 'Material Reference Sheets' : 'Inspection Proof Slips'
        }. Import or create another template first.`
      };
    }

    const wasActive = target.isActive;
    const formType = target.formType;

    // Delete template file from disk in Tauri environment if path/name exists
    try {
      await tauriBridge.deleteTemplateFile(target.filePath, target.fileName);
    } catch (fsErr) {
      console.warn('Failed to remove template file from disk:', fsErr);
    }

    this.formTemplates.splice(targetIndex, 1);

    // If deleted template was active, activate the built-in default or first available template
    if (wasActive) {
      const fallback = this.formTemplates.find(t => t.formType === formType && t.isBuiltIn) ||
        this.formTemplates.find(t => t.formType === formType);
      if (fallback) {
        fallback.isActive = true;
      }
    }

    this.saveFormTemplatesLocal();

    await this.logAudit({
      user: author,
      action: 'DELETE',
      entityType: 'SETTINGS',
      details: `Deleted form template "${target.name}" (${formType})`
    });

    realtimeSync.broadcastMutation(
      'MUTATION_CONFIG_UPDATED',
      'FormTemplates',
      `Deleted template "${target.name}".`
    );
    this.notifyListeners();

    return { success: true };
  }

  public async duplicateFormTemplate(
    templateId: string,
    author = 'Admin'
  ): Promise<{ success: boolean; newTemplate?: FormTemplate }> {
    await this.init();
    const target = this.formTemplates.find(t => t.id === templateId);
    if (!target) {
      return { success: false };
    }

    const newTemplate: FormTemplate = {
      ...target,
      id: `tpl-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      name: `${target.name} (Copy)`,
      version: `${target.version}.1`,
      isActive: false,
      isBuiltIn: false,
      createdBy: author,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    this.formTemplates.push(newTemplate);
    this.saveFormTemplatesLocal();

    await this.logAudit({
      user: author,
      action: 'CREATE',
      entityType: 'SETTINGS',
      details: `Duplicated form template "${target.name}" to create "${newTemplate.name}"`
    });

    this.notifyListeners();
    return { success: true, newTemplate };
  }

  public async resetFormTemplates(author = 'Admin'): Promise<{ success: boolean }> {
    await this.init();
    this.formTemplates = [...INITIAL_FORM_TEMPLATES];
    this.saveFormTemplatesLocal();

    await this.logAudit({
      user: author,
      action: 'RESTORE',
      entityType: 'SETTINGS',
      details: `Reset form templates catalog to built-in system standards`
    });

    this.notifyListeners();
    return { success: true };
  }

  public async saveAppConfig(newConfig: Partial<AppConfig>, author = 'Admin'): Promise<void> {
    await this.init();
    this.config = { ...this.config, ...newConfig };
    this.saveLocalConfig();

    await this.logAudit({
      user: author,
      action: 'UPDATE',
      entityType: 'SETTINGS',
      details: `Updated application system configuration settings`
    });

    if (isTauri()) {
      this.syncTauri('save_app_config', this.config);
    }

    realtimeSync.broadcastMutation('MUTATION_CONFIG_UPDATED', 'Settings', 'Updated application settings');
    this.notifyListeners();
  }

  public async saveConfig(newConfig: Partial<AppConfig>, author = 'Admin'): Promise<void> {
    await this.saveAppConfig(newConfig, author);
  }

  // Full Portable Backup & Restore (ZIP)
  public async createBackupZip(): Promise<Blob> {
    await this.init();
    const zip = new JSZip();

    // 1. Database JSON dump
    const dbDump = {
      meta: {
        appName: 'Material Reference & Sample Tracking System',
        version: '1.0.0-portable',
        exportedAt: new Date().toISOString(),
        format: 'SQLITE_JSON_PORTABLE_SCHEMA_V1'
      },
      masterItems: this.masterItems,
      registrations: this.registrations,
      auditLogs: this.auditLogs,
      config: this.config,
      formTemplates: this.formTemplates
    };

    zip.file('database/material_reference_dump.json', JSON.stringify(dbDump, null, 2));

    // 2. References folder with photos and attachments metadata
    const photosFolder = zip.folder('references/PHOTOS');
    const attachmentsFolder = zip.folder('references/ATTACHMENTS');
    const formsFolder = zip.folder('references/FORMS');

    // Store photos as individual data files in ZIP
    this.registrations.forEach((reg) => {
      reg.photos.forEach((photo, pIdx) => {
        if (photo.dataUrl && photo.dataUrl.startsWith('data:')) {
          const base64Data = photo.dataUrl.split(',')[1];
          if (base64Data) {
            photosFolder?.file(`${reg.productCode}_photo_${pIdx + 1}_${photo.fileName}`, base64Data, { base64: true });
          }
        }
      });

      reg.attachments.forEach((att, aIdx) => {
        if (att.dataUrl && att.dataUrl.startsWith('data:')) {
          const base64Data = att.dataUrl.split(',')[1];
          if (base64Data) {
            attachmentsFolder?.file(`${reg.productCode}_att_${aIdx + 1}_${att.fileName}`, base64Data, { base64: true });
          }
        }
      });
    });

    // 3. Template and Config
    zip.file('templates/README_TEMPLATES.txt', 'Custom Word .docx templates and official material forms reside here.');
    zip.file('config/app_settings.json', JSON.stringify(this.config, null, 2));
    zip.file('README_PORTABLE_DATA.txt', `Reference Tracker Portable Backup\nCreated: ${new Date().toLocaleString()}\nMaster Items: ${this.masterItems.length}\nRegistered References: ${this.registrations.length}\nNote: Inventory data is excluded by system architectural mandate.`);

    await this.logAudit({
      user: this.config.defaultRegisteredBy || 'User',
      action: 'BACKUP',
      entityType: 'SYSTEM',
      details: `Generated complete portable data backup ZIP (${this.masterItems.length} master items, ${this.registrations.length} registrations)`
    });

    return await zip.generateAsync({
      type: 'blob',
      mimeType: 'application/zip',
      compression: 'DEFLATE',
      compressionOptions: { level: 6 }
    });
  }

  public async restoreBackupZip(
    zipBuffer: ArrayBuffer,
    author = 'User'
  ): Promise<{ success: boolean; message: string; details?: any }> {
    await this.init();
    try {
      const zip = await JSZip.loadAsync(zipBuffer);
      const dbFile = zip.file('database/material_reference_dump.json');
      if (!dbFile) {
        return { success: false, message: 'Invalid backup file: database/material_reference_dump.json not found in ZIP.' };
      }

      const rawJson = await dbFile.async('text');
      const parsed = JSON.parse(rawJson);

      if (!parsed.masterItems || !Array.isArray(parsed.masterItems)) {
        return { success: false, message: 'Invalid backup payload: missing masterItems array.' };
      }

      // Create safety backup in IndexedDB before replacing
      const safetyBackupKey = `mat_ref_safety_backup_${Date.now()}`;
      await idbSaveSnapshot({
        id: safetyBackupKey,
        date: new Date().toISOString().split('T')[0],
        timestamp: new Date().toISOString(),
        data: {
          masterItems: this.masterItems,
          registrations: this.registrations,
          auditLogs: this.auditLogs,
          config: this.config
        }
      });

      // Restore data (ensuring no inventory data is processed)
      this.masterItems = parsed.masterItems.map((item: any) => ({
        id: item.id,
        productCode: item.productCode,
        description: item.description,
        category: item.category,
        status: item.status,
        unit: item.unit,
        createdAt: item.createdAt || new Date().toISOString(),
        updatedAt: item.updatedAt || new Date().toISOString()
      }));

      this.registrations = (parsed.registrations || []).map((r: any) => ({
        id: r.id,
        masterItemId: r.masterItemId,
        productCode: r.productCode,
        registrationDate: r.registrationDate,
        registeredBy: r.registeredBy,
        supplier: r.supplier,
        specification: r.specification,
        remarks: r.remarks,
        revision: r.revision || 'Rev 01',
        customFields: r.customFields || {},
        photos: r.photos || [],
        attachments: r.attachments || [],
        wordFormGenerated: r.wordFormGenerated,
        wordFormLastGeneratedAt: r.wordFormLastGeneratedAt,
        createdAt: r.createdAt,
        updatedAt: r.updatedAt
      }));

      if (parsed.config) {
        this.config = { ...DEFAULT_CONFIG, ...parsed.config };
      }

      if (parsed.formTemplates && Array.isArray(parsed.formTemplates)) {
        this.formTemplates = parsed.formTemplates;
      }

      const restoreAudit: AuditLogEntry = {
        id: `audit-${Date.now()}`,
        timestamp: new Date().toISOString(),
        user: author,
        action: 'RESTORE',
        entityType: 'SYSTEM',
        details: `Successfully restored database from backup ZIP. Safety backup created (${safetyBackupKey}).`
      };

      this.auditLogs = [restoreAudit, ...(parsed.auditLogs || this.auditLogs)];

      this.saveMasterItems();
      this.saveRegistrations();
      this.saveAuditLogs();
      this.saveLocalConfig();
      this.saveFormTemplatesLocal();

      if (isTauri()) {
        this.syncTauri('restore_full_backup', {
          masterItems: this.masterItems,
          registrations: this.registrations,
          auditLogs: this.auditLogs,
          config: this.config
        });
      }

      realtimeSync.broadcastMutation('MUTATION_FULL_RESTORE', 'Database', 'Restored complete database package');
      this.notifyListeners();

      return {
        success: true,
        message: `Restored ${this.masterItems.length} Master Items and ${this.registrations.length} Reference Registrations successfully. Safety snapshot saved.`
      };
    } catch (err: any) {
      console.error('Error during restore:', err);
      return { success: false, message: `Failed to unpack and restore backup: ${err?.message || 'Unknown error'}` };
    }
  }

  // Daily Automatic Backup Methods (Triggered once daily on app launch)
  public async checkAndPerformDailyAutoBackup(): Promise<{
    performed: boolean;
    date: string;
    backupId?: string;
    masterItemsCount: number;
    registrationsCount: number;
    message?: string;
  }> {
    await this.init();

    const now = new Date();
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const lastBackupDate = localStorage.getItem(STORAGE_KEYS.LAST_AUTO_BACKUP_DATE) || this.config.lastAutoBackupDate;

    if (lastBackupDate === todayStr) {
      return {
        performed: false,
        date: todayStr,
        masterItemsCount: this.masterItems.length,
        registrationsCount: this.registrations.length,
        message: `Already backed up for today (${todayStr})`
      };
    }

    try {
      const backupId = `auto-backup-${todayStr}-${Date.now()}`;
      const timestamp = now.toISOString();

      const backupSnapshot = {
        id: backupId,
        date: todayStr,
        timestamp,
        masterItemsCount: this.masterItems.length,
        registrationsCount: this.registrations.length,
        data: {
          masterItems: this.masterItems,
          registrations: this.registrations,
          auditLogs: this.auditLogs.slice(0, 100),
          config: this.config
        }
      };

      // 1. Store the full heavy snapshot into IndexedDB (virtually unlimited quota)
      await idbSaveSnapshot(backupSnapshot);

      // 2. Prepare lightweight metadata (<1KB) for instant UI display
      const dataSizeBytes = JSON.stringify(backupSnapshot.data).length;
      const dataSizeEstimate = `${(dataSizeBytes / 1024).toFixed(1)} KB`;

      const metaEntry = {
        id: backupId,
        date: todayStr,
        timestamp,
        masterItemsCount: this.masterItems.length,
        registrationsCount: this.registrations.length,
        dataSizeEstimate
      };

      // Read existing daily backup metadata list
      const existingList = this.getDailyAutoBackups();
      const updatedList = [metaEntry, ...existingList.filter((b) => b.date !== todayStr)].slice(0, 14);

      // Clean old snapshots in IndexedDB that are no longer in rolling 14-day window
      await idbDeleteOldSnapshots(updatedList.map((b) => b.id));

      // Save lightweight metadata array to localStorage (<1KB, safe against quota)
      this.safeSetItem(STORAGE_KEYS.DAILY_BACKUPS, JSON.stringify(updatedList));

      // Mark today as backed up
      this.safeSetItem(STORAGE_KEYS.LAST_AUTO_BACKUP_DATE, todayStr);
      this.safeSetItem('mat_ref_last_auto_backup_timestamp', timestamp);

      // Update config object
      this.config = {
        ...this.config,
        autoBackupDailyEnabled: true,
        lastAutoBackupDate: todayStr,
        lastAutoBackupTimestamp: timestamp
      };
      this.saveLocalConfig();

      // Log system audit entry
      await this.logAudit({
        user: 'System (Auto-Backup)',
        action: 'BACKUP',
        entityType: 'SYSTEM',
        details: `Automated daily backup created on startup for ${todayStr} (${this.masterItems.length} master items, ${this.registrations.length} registered references)`
      });

      if (isTauri()) {
        this.syncTauri('save_app_config', this.config);
      }

      this.notifyListeners();

      return {
        performed: true,
        date: todayStr,
        backupId,
        masterItemsCount: this.masterItems.length,
        registrationsCount: this.registrations.length,
        message: `Daily auto-backup completed for ${todayStr}`
      };
    } catch (err) {
      console.error('Failed to execute daily auto-backup:', err);
      return {
        performed: false,
        date: todayStr,
        masterItemsCount: this.masterItems.length,
        registrationsCount: this.registrations.length,
        message: 'Auto-backup encountered an error'
      };
    }
  }

  public getDailyAutoBackups(): Array<{
    id: string;
    date: string;
    timestamp: string;
    masterItemsCount: number;
    registrationsCount: number;
    dataSizeEstimate: string;
  }> {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.DAILY_BACKUPS);
      if (!raw) return [];
      const list = JSON.parse(raw);
      if (!Array.isArray(list)) return [];

      return list.map((b) => ({
        id: b.id,
        date: b.date,
        timestamp: b.timestamp,
        masterItemsCount: b.masterItemsCount || (b.data?.masterItems?.length ?? 0),
        registrationsCount: b.registrationsCount || (b.data?.registrations?.length ?? 0),
        dataSizeEstimate: b.dataSizeEstimate || `${((JSON.stringify(b.data || {}).length) / 1024).toFixed(1)} KB`
      }));
    } catch {
      return [];
    }
  }

  public async restoreDailyAutoBackup(
    backupId: string,
    author = 'User'
  ): Promise<{ success: boolean; message: string }> {
    await this.init();
    try {
      // 1. First retrieve full snapshot from IndexedDB
      let snapshot = await idbGetSnapshot(backupId);

      // 2. Fallback to localStorage if older backup was stored there
      if (!snapshot || !snapshot.data) {
        const raw = localStorage.getItem(STORAGE_KEYS.DAILY_BACKUPS);
        if (raw) {
          try {
            const list = JSON.parse(raw);
            const found = list.find((b: any) => b.id === backupId);
            if (found && found.data) {
              snapshot = found;
            }
          } catch {}
        }
      }

      if (!snapshot || !snapshot.data) {
        return { success: false, message: 'Selected daily backup snapshot not found.' };
      }

      // Safety snapshot before restoring
      const safetyBackupKey = `mat_ref_safety_before_daily_${Date.now()}`;
      await idbSaveSnapshot({
        id: safetyBackupKey,
        date: new Date().toISOString().split('T')[0],
        timestamp: new Date().toISOString(),
        data: {
          masterItems: this.masterItems,
          registrations: this.registrations,
          auditLogs: this.auditLogs,
          config: this.config
        }
      });

      // Restore data from snapshot
      if (Array.isArray(snapshot.data.masterItems)) {
        this.masterItems = snapshot.data.masterItems;
      }
      if (Array.isArray(snapshot.data.registrations)) {
        this.registrations = snapshot.data.registrations;
      }
      if (snapshot.data.config) {
        this.config = { ...this.config, ...snapshot.data.config };
      }

      await this.logAudit({
        user: author,
        action: 'RESTORE',
        entityType: 'SYSTEM',
        details: `Restored database from automated daily backup snapshot (${snapshot.date}, ${this.masterItems.length} items, ${this.registrations.length} registrations)`
      });

      this.saveMasterItems();
      this.saveRegistrations();
      this.saveAuditLogs();
      this.saveLocalConfig();

      if (isTauri()) {
        this.syncTauri('restore_full_backup', {
          masterItems: this.masterItems,
          registrations: this.registrations,
          auditLogs: this.auditLogs,
          config: this.config
        });
      }

      realtimeSync.broadcastMutation('MUTATION_FULL_RESTORE', 'Database', `Restored from daily backup (${snapshot.date})`);
      this.notifyListeners();

      return {
        success: true,
        message: `Successfully restored ${this.masterItems.length} Master Items and ${this.registrations.length} Reference Registrations from ${snapshot.date} snapshot.`
      };
    } catch (err: any) {
      return { success: false, message: `Failed to restore: ${err?.message || 'Unknown error'}` };
    }
  }

  public async downloadDailyBackupJson(backupId: string): Promise<void> {
    try {
      let snapshot = await idbGetSnapshot(backupId);
      if (!snapshot || !snapshot.data) {
        const raw = localStorage.getItem(STORAGE_KEYS.DAILY_BACKUPS);
        if (raw) {
          try {
            const list = JSON.parse(raw);
            snapshot = list.find((b: any) => b.id === backupId);
          } catch {}
        }
      }

      if (!snapshot) {
        console.warn('Backup snapshot not found.');
        return;
      }

      const blob = new Blob([JSON.stringify(snapshot, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `ReferenceTracker_DailyBackup_${snapshot.date || 'snapshot'}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Failed to download daily backup JSON:', err);
    }
  }

  // Reset to default sample data
  public async resetToSampleData(author = 'Admin'): Promise<void> {
    this.masterItems = [...INITIAL_MASTER_ITEMS];
    this.registrations = [...INITIAL_REGISTRATIONS];
    this.config = { ...DEFAULT_CONFIG };
    this.auditLogs = [
      {
        id: `audit-${Date.now()}`,
        timestamp: new Date().toISOString(),
        user: author,
        action: 'RESTORE',
        entityType: 'SYSTEM',
        details: 'Reset system database to clean initial demonstration reference state.'
      },
      ...INITIAL_AUDIT_LOGS
    ];

    this.saveMasterItems();
    this.saveRegistrations();
    this.saveAuditLogs();
    this.saveLocalConfig();

    realtimeSync.broadcastMutation('MUTATION_FULL_RESTORE', 'Database', 'Reset database to demo sample state');
    this.notifyListeners();
  }

  // Storage pruning and quota management
  private pruneNonEssentialLocalStorage(): void {
    try {
      // 1. Remove temporary safety snapshots and legacy keys from localStorage
      const keysToRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && (k.startsWith('mat_ref_safety_') || k.startsWith('mat_ref_temp_'))) {
          keysToRemove.push(k);
        }
      }
      keysToRemove.forEach((k) => {
        try { localStorage.removeItem(k); } catch {}
      });

      // 2. Convert any old bloated DAILY_BACKUPS string in localStorage to lightweight metadata
      const rawDaily = localStorage.getItem(STORAGE_KEYS.DAILY_BACKUPS);
      if (rawDaily) {
        try {
          const parsed = JSON.parse(rawDaily);
          if (Array.isArray(parsed)) {
            // Check if any element contains heavy data object
            const hasHeavyData = parsed.some((p: any) => p.data !== undefined);
            if (hasHeavyData) {
              const lightweight = parsed.map((item: any) => ({
                id: item.id,
                date: item.date,
                timestamp: item.timestamp,
                masterItemsCount: item.masterItemsCount || item.data?.masterItems?.length || 0,
                registrationsCount: item.registrationsCount || item.data?.registrations?.length || 0,
                dataSizeEstimate: item.dataSizeEstimate || `${((JSON.stringify(item.data || {}).length) / 1024).toFixed(1)} KB`
              })).slice(0, 14);

              // Also persist heavy snapshots into IndexedDB for safety
              parsed.forEach((item: any) => {
                if (item.data) {
                  idbSaveSnapshot(item);
                }
              });

              localStorage.setItem(STORAGE_KEYS.DAILY_BACKUPS, JSON.stringify(lightweight));
            }
          }
        } catch {
          localStorage.removeItem(STORAGE_KEYS.DAILY_BACKUPS);
        }
      }

      // 3. Trim audit logs to last 100 entries if oversized
      if (this.auditLogs.length > 100) {
        this.auditLogs = this.auditLogs.slice(0, 100);
        try {
          localStorage.setItem(STORAGE_KEYS.AUDIT_LOGS, JSON.stringify(this.auditLogs));
        } catch {}
      }
    } catch (err) {
      console.warn('Error during localStorage pruning:', err);
    }
  }

  private safeSetItem(key: string, value: string): boolean {
    try {
      localStorage.setItem(key, value);
      return true;
    } catch (err: any) {
      if (
        err &&
        (err.name === 'QuotaExceededError' ||
          err.name === 'NS_ERROR_DOM_QUOTA_REACHED' ||
          err.code === 22 ||
          err.code === 1014 ||
          err.number === -2147024882)
      ) {
        console.warn(`LocalStorage quota exceeded when storing "${key}". Pruning non-essential storage keys and retrying.`);
        this.pruneNonEssentialLocalStorage();
        try {
          localStorage.setItem(key, value);
          return true;
        } catch (retryErr) {
          console.error(`Failed to store "${key}" in localStorage after pruning:`, retryErr);
          return false;
        }
      }
      console.error(`LocalStorage error when setting "${key}":`, err);
      return false;
    }
  }

  // Internal persistence helpers
  private saveMasterItems(): void {
    this.safeSetItem(STORAGE_KEYS.MASTER_ITEMS, JSON.stringify(this.masterItems));
  }

  private saveRegistrations(): void {
    this.safeSetItem(STORAGE_KEYS.REGISTRATIONS, JSON.stringify(this.registrations));
  }

  private saveAuditLogs(): void {
    this.safeSetItem(STORAGE_KEYS.AUDIT_LOGS, JSON.stringify(this.auditLogs));
  }

  private saveLocalConfig(): void {
    this.safeSetItem(STORAGE_KEYS.APP_CONFIG, JSON.stringify(this.config));
    if (isTauri()) {
      this.syncTauri('save_app_config', this.config);
    }
  }

  private saveFormTemplatesLocal(): void {
    this.safeSetItem(STORAGE_KEYS.FORM_TEMPLATES, JSON.stringify(this.formTemplates));
  }

  private async syncTauri(command: string, payload: any): Promise<void> {
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      await invoke(command, { payload });
    } catch (e) {
      // Ignored in web preview
    }
  }
}

export const db = new DatabaseService();
