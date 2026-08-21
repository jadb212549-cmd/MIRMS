import { MasterItem, ReferenceRegistration, AuditLogEntry, AppConfig, CustomFieldDefinition, SyncMessage } from '../types';
import { INITIAL_MASTER_ITEMS, INITIAL_REGISTRATIONS, INITIAL_AUDIT_LOGS, DEFAULT_CONFIG, DEFAULT_CUSTOM_FIELDS } from './defaultData';
import { isTauri } from './tauriService';
import { realtimeSync } from './realtimeSync';
import JSZip from 'jszip';

const STORAGE_KEYS = {
  MASTER_ITEMS: 'mat_ref_master_items_v1',
  REGISTRATIONS: 'mat_ref_registrations_v1',
  AUDIT_LOGS: 'mat_ref_audit_logs_v1',
  APP_CONFIG: 'mat_ref_app_config_v1',
  DAILY_BACKUPS: 'mat_ref_daily_backups_v1',
  LAST_AUTO_BACKUP_DATE: 'mat_ref_last_auto_backup_date'
};

class DatabaseService {
  private masterItems: MasterItem[] = [];
  private registrations: ReferenceRegistration[] = [];
  private auditLogs: AuditLogEntry[] = [];
  private config: AppConfig = DEFAULT_CONFIG;
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

      if (storedItems) this.masterItems = JSON.parse(storedItems);
      if (storedRefs) this.registrations = JSON.parse(storedRefs);
      if (storedAudits) this.auditLogs = JSON.parse(storedAudits);
      if (storedConfig) this.config = { ...DEFAULT_CONFIG, ...JSON.parse(storedConfig) };

      this.notifyListeners();
    } catch (err) {
      console.error('Error reloading database state from disk:', err);
    }
  }

  public async init(): Promise<void> {
    if (this.initialized) return;

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

      if (storedItems) {
        this.masterItems = JSON.parse(storedItems);
      } else {
        this.masterItems = [...INITIAL_MASTER_ITEMS];
        this.saveMasterItems();
      }

      if (storedRefs) {
        this.registrations = JSON.parse(storedRefs);
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
        this.config = { ...DEFAULT_CONFIG, ...JSON.parse(storedConfig) };
      } else {
        this.config = { ...DEFAULT_CONFIG };
        this.saveLocalConfig();
      }
    } catch (err) {
      console.error('Error initializing database service:', err);
      this.masterItems = [...INITIAL_MASTER_ITEMS];
      this.registrations = [...INITIAL_REGISTRATIONS];
      this.auditLogs = [...INITIAL_AUDIT_LOGS];
      this.config = { ...DEFAULT_CONFIG };
    }

    this.initialized = true;
    this.notifyListeners();
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

    const now = new Date().toISOString();
    const newItem: MasterItem = {
      id: `item-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      productCode: normalizedCode,
      description: itemData.description.trim(),
      category: itemData.category,
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
      details: `Created master item "${newItem.productCode}" (${newItem.category}, ${newItem.status})`
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

    const updated: MasterItem = {
      ...current,
      ...updates,
      productCode: updates.productCode ? updates.productCode.trim() : current.productCode,
      description: updates.description !== undefined ? updates.description.trim() : current.description,
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

      const existingIndex = this.masterItems.findIndex(
        (m) => m.productCode.toLowerCase() === code.toLowerCase()
      );

      if (existingIndex >= 0) {
        // Update master item attributes without breaking existing references
        this.masterItems[existingIndex] = {
          ...this.masterItems[existingIndex],
          description: row.description.trim(),
          category: row.category,
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
          category: row.category,
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

  // Reference Registration Management
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

  public async createRegistration(
    regData: Omit<ReferenceRegistration, 'id' | 'createdAt' | 'updatedAt'>,
    author?: string
  ): Promise<{ success: boolean; registration?: ReferenceRegistration; error?: string }> {
    await this.init();
    const normalizedCode = regData.productCode.trim();

    // Verify master item exists
    const masterItem = await this.getMasterItemByCode(normalizedCode);
    if (!masterItem) {
      return {
        success: false,
        error: `Master item with Product Code "${normalizedCode}" does not exist in master list.`
      };
    }

    // Duplicate Check: Requirement 5: Primary duplicate identifier is Product Code. Duplicate registrations must be blocked!
    const duplicate = this.registrations.find(
      (r) => r.productCode.toLowerCase() === normalizedCode.toLowerCase()
    );
    if (duplicate) {
      return {
        success: false,
        error: `Duplicate Registration Blocked: Product Code "${normalizedCode}" is already registered (Registration Date: ${duplicate.registrationDate}, By: ${duplicate.registeredBy}, Revision: ${duplicate.revision}). Please edit the existing registration or update its revision.`
      };
    }

    const now = new Date().toISOString();
    const newReg: ReferenceRegistration = {
      id: `ref-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      masterItemId: masterItem.id,
      productCode: masterItem.productCode,
      registrationDate: regData.registrationDate || now.split('T')[0],
      registeredBy: regData.registeredBy.trim() || author || this.config.defaultRegisteredBy,
      supplier: regData.supplier?.trim() || undefined,
      specification: regData.specification?.trim() || undefined,
      remarks: regData.remarks?.trim() || undefined,
      revision: regData.revision?.trim() || 'Rev 01',
      customFields: regData.customFields || {},
      photos: regData.photos || [],
      attachments: regData.attachments || [],
      wordFormGenerated: !!regData.wordFormGenerated,
      wordFormLastGeneratedAt: regData.wordFormLastGeneratedAt,
      createdAt: now,
      updatedAt: now
    };

    this.registrations.unshift(newReg);
    this.saveRegistrations();

    await this.logAudit({
      user: newReg.registeredBy,
      action: 'CREATE',
      entityType: 'REFERENCE',
      entityId: newReg.id,
      entityIdentifier: newReg.productCode,
      details: `Registered reference sample for "${newReg.productCode}" (${newReg.revision}) by ${newReg.registeredBy}`
    });

    if (isTauri()) {
      this.syncTauri('create_registration', newReg);
    }

    realtimeSync.broadcastMutation('MUTATION_REG_CREATED', newReg.productCode, `Registered reference sample "${newReg.productCode}" (${newReg.revision})`, newReg);
    this.notifyListeners();

    return { success: true, registration: newReg };
  }

  public async updateRegistration(
    id: string,
    updates: Partial<Omit<ReferenceRegistration, 'id' | 'createdAt'>>,
    author?: string
  ): Promise<{ success: boolean; registration?: ReferenceRegistration; error?: string }> {
    await this.init();
    const index = this.registrations.findIndex((r) => r.id === id);
    if (index === -1) {
      return { success: false, error: 'Reference registration not found.' };
    }

    const current = this.registrations[index];

    // If productCode changed, check duplicate
    if (updates.productCode && updates.productCode.toLowerCase() !== current.productCode.toLowerCase()) {
      const codeCheck = updates.productCode.trim();
      const master = await this.getMasterItemByCode(codeCheck);
      if (!master) {
        return { success: false, error: `Target master item "${codeCheck}" not found.` };
      }

      const dup = this.registrations.find(
        (r) => r.id !== id && r.productCode.toLowerCase() === codeCheck.toLowerCase()
      );
      if (dup) {
        return { success: false, error: `Product Code "${codeCheck}" already has another registered sample.` };
      }
      updates.masterItemId = master.id;
    }

    // Capture revision history snapshot if revision or specification changed
    let revisionHistory = current.revisionHistory ? [...current.revisionHistory] : [];
    if (
      (updates.revision && updates.revision !== current.revision) ||
      (updates.specification !== undefined && updates.specification !== current.specification)
    ) {
      const snapshot = {
        id: `rev-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        revision: current.revision || 'Rev 01',
        date: current.registrationDate || current.createdAt.split('T')[0],
        author: author || current.registeredBy || 'Inspector',
        specification: current.specification,
        remarks: current.remarks,
        supplier: current.supplier,
        changeSummary: updates.revision && updates.revision !== current.revision
          ? `Revised from ${current.revision} to ${updates.revision}`
          : 'Specification update'
      };
      if (!revisionHistory.some((r) => r.revision === snapshot.revision && r.date === snapshot.date)) {
        revisionHistory.unshift(snapshot);
      }
    }

    const updated: ReferenceRegistration = {
      ...current,
      ...updates,
      revisionHistory,
      updatedAt: new Date().toISOString()
    };

    this.registrations[index] = updated;
    this.saveRegistrations();

    const loggedUser = author || updated.registeredBy;
    await this.logAudit({
      user: loggedUser,
      action: 'UPDATE',
      entityType: 'REFERENCE',
      entityId: updated.id,
      entityIdentifier: updated.productCode,
      details: `Updated reference registration for "${updated.productCode}" (${updated.revision})`
    });

    if (isTauri()) {
      this.syncTauri('update_registration', updated);
    }

    realtimeSync.broadcastMutation('MUTATION_REG_UPDATED', updated.productCode, `Updated reference for "${updated.productCode}" (${updated.revision})`, updated);
    this.notifyListeners();

    return { success: true, registration: updated };
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
      config: this.config
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

    return await zip.generateAsync({ type: 'blob' });
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

      // Create safety backup in localStorage before replacing
      const safetyBackupKey = `mat_ref_safety_backup_${Date.now()}`;
      localStorage.setItem(safetyBackupKey, JSON.stringify({
        masterItems: this.masterItems,
        registrations: this.registrations,
        auditLogs: this.auditLogs,
        config: this.config
      }));

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

      // Store in rolling daily backups list (keep up to 14 days)
      const existingRaw = localStorage.getItem(STORAGE_KEYS.DAILY_BACKUPS);
      let backupsList: any[] = [];
      if (existingRaw) {
        try {
          backupsList = JSON.parse(existingRaw);
          if (!Array.isArray(backupsList)) backupsList = [];
        } catch {
          backupsList = [];
        }
      }

      // Filter out any existing backup for today and keep latest 14
      backupsList = [backupSnapshot, ...backupsList.filter((b) => b.date !== todayStr)].slice(0, 14);
      localStorage.setItem(STORAGE_KEYS.DAILY_BACKUPS, JSON.stringify(backupsList));

      // Mark today as backed up
      localStorage.setItem(STORAGE_KEYS.LAST_AUTO_BACKUP_DATE, todayStr);
      localStorage.setItem('mat_ref_last_auto_backup_timestamp', timestamp);

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

      return list.map((b) => {
        const jsonStr = JSON.stringify(b.data || {});
        const kbSize = (jsonStr.length / 1024).toFixed(1);
        return {
          id: b.id,
          date: b.date,
          timestamp: b.timestamp,
          masterItemsCount: b.masterItemsCount || (b.data?.masterItems?.length ?? 0),
          registrationsCount: b.registrationsCount || (b.data?.registrations?.length ?? 0),
          dataSizeEstimate: `${kbSize} KB`
        };
      });
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
      const raw = localStorage.getItem(STORAGE_KEYS.DAILY_BACKUPS);
      if (!raw) return { success: false, message: 'No daily backups found.' };
      const list = JSON.parse(raw);
      const target = list.find((b: any) => b.id === backupId);
      if (!target || !target.data) {
        return { success: false, message: 'Selected daily backup record not found.' };
      }

      // Safety snapshot before restoring
      const safetyBackupKey = `mat_ref_safety_before_daily_${Date.now()}`;
      localStorage.setItem(safetyBackupKey, JSON.stringify({
        masterItems: this.masterItems,
        registrations: this.registrations,
        auditLogs: this.auditLogs,
        config: this.config
      }));

      // Restore data from snapshot
      if (Array.isArray(target.data.masterItems)) {
        this.masterItems = target.data.masterItems;
      }
      if (Array.isArray(target.data.registrations)) {
        this.registrations = target.data.registrations;
      }
      if (target.data.config) {
        this.config = { ...this.config, ...target.data.config };
      }

      await this.logAudit({
        user: author,
        action: 'RESTORE',
        entityType: 'SYSTEM',
        details: `Restored database from automated daily backup snapshot (${target.date}, ${this.masterItems.length} items, ${this.registrations.length} registrations)`
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

      realtimeSync.broadcastMutation('MUTATION_FULL_RESTORE', 'Database', `Restored from daily backup (${target.date})`);
      this.notifyListeners();

      return {
        success: true,
        message: `Successfully restored ${this.masterItems.length} Master Items and ${this.registrations.length} Reference Registrations from ${target.date} snapshot.`
      };
    } catch (err: any) {
      return { success: false, message: `Failed to restore: ${err?.message || 'Unknown error'}` };
    }
  }

  public downloadDailyBackupJson(backupId: string): void {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.DAILY_BACKUPS);
      if (!raw) return;
      const list = JSON.parse(raw);
      const target = list.find((b: any) => b.id === backupId);
      if (!target || !target.data) return;

      const blob = new Blob([JSON.stringify(target, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `ReferenceTracker_DailyBackup_${target.date}.json`;
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

  // Internal persistence helpers
  private saveMasterItems(): void {
    localStorage.setItem(STORAGE_KEYS.MASTER_ITEMS, JSON.stringify(this.masterItems));
  }

  private saveRegistrations(): void {
    localStorage.setItem(STORAGE_KEYS.REGISTRATIONS, JSON.stringify(this.registrations));
  }

  private saveAuditLogs(): void {
    localStorage.setItem(STORAGE_KEYS.AUDIT_LOGS, JSON.stringify(this.auditLogs));
  }

  private saveLocalConfig(): void {
    localStorage.setItem(STORAGE_KEYS.APP_CONFIG, JSON.stringify(this.config));
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
