export type MaterialType = 'RM' | 'PS'; // RM = Raw Material, PS = Production Supply
export type ItemCategory = string; // e.g. 'Box', 'Tape', 'Packaging', etc.
export type ItemStatus = 'Active' | 'Inactive';

export type PhotoCategory =
  | 'SPECIMEN_PRIMARY'
  | 'SURFACE_FINISH'
  | 'DEFECT_LIMIT'
  | 'DIMENSION_CHECK'
  | 'PACKAGING_LABEL'
  | 'OTHER';

export type PrintLayoutType =
  | 'HERO_SINGLE'
  | 'DUAL_COMPARISON'
  | 'GRID_FOUR'
  | 'SPECS_ONLY'
  | 'ALL_PHOTOS';

export interface MasterItem {
  id: string;
  productCode: string;
  description: string;
  materialType: MaterialType;
  category: string; // Dynamic category e.g. Box, Tape, Packaging, Corrugated, etc.
  status: ItemStatus;
  unit?: string;
  createdAt: string;
  updatedAt: string;
}

export interface PhotoAttachment {
  id: string;
  fileName: string;
  fileSize: number;
  dataUrl: string; // base64 or relative file path in Tauri
  caption?: string;
  uploadedAt: string;
  isPrimary?: boolean; // Main sample photo flag
  includeInPrint?: boolean; // Whether to include in physical printable card / Word doc
  photoCategory?: PhotoCategory;
  orderIndex?: number;
}

export interface DocumentAttachment {
  id: string;
  fileName: string;
  fileSize: number;
  fileType: string;
  dataUrl?: string; // base64 or path
  uploadedAt: string;
}

export interface CustomFieldDefinition {
  id: string;
  label: string;
  key: string;
  type: 'text' | 'number' | 'date' | 'select' | 'textarea' | 'boolean';
  options?: string[]; // for select
  categoryApplicability?: 'ALL' | 'RM' | 'PS' | string;
  materialTypeApplicability?: 'ALL' | 'RM' | 'PS';
  required?: boolean;
  defaultValue?: string;
}

export interface CustomFieldValue {
  fieldId: string;
  key: string;
  value: string | number | boolean;
}

export interface ReferenceRevision {
  id: string;
  revision: string; // e.g. "Rev 01"
  date: string;
  author: string;
  specification?: string;
  remarks?: string;
  supplier?: string;
  changeSummary?: string;
}

export interface ReferenceRegistration {
  id: string;
  masterItemId: string;
  productCode: string; // duplicate link & quick query
  materialType?: MaterialType; // RM or PS
  category?: string; // Category e.g. Box, Tape, etc.
  registrationDate: string;
  registeredBy: string;
  supplier?: string;
  specification?: string;
  remarks?: string;
  revision: string; // e.g. "Rev 01", "Rev 02"
  revisionHistory?: ReferenceRevision[];
  customFields: Record<string, string | number | boolean>;
  photos: PhotoAttachment[];
  attachments: DocumentAttachment[];
  selectedPrintPhotoIds?: string[]; // Specified photo IDs designated for print
  printLayout?: PrintLayoutType;
  wordFormGenerated?: boolean;
  wordFormLastGeneratedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AuditLogEntry {
  id: string;
  timestamp: string;
  user: string;
  action: 'CREATE' | 'UPDATE' | 'DELETE' | 'IMPORT' | 'EXPORT' | 'BACKUP' | 'RESTORE' | 'GENERATE_FORM';
  entityType: 'MASTER_ITEM' | 'REFERENCE' | 'TEMPLATE' | 'SETTINGS' | 'SYSTEM';
  entityId?: string;
  entityIdentifier?: string; // e.g. Product Code
  details: string;
}

export interface WorkstationUser {
  id: string;
  workstationName: string;
  userName: string;
  color: string;
  lastActive: string;
  currentTab?: NavigationTab;
  currentEditingItemCode?: string;
}

export interface SyncMessage {
  id: string;
  type:
    | 'MUTATION_ITEM_CREATED'
    | 'MUTATION_ITEM_UPDATED'
    | 'MUTATION_ITEM_DELETED'
    | 'MUTATION_ITEM_BULK'
    | 'MUTATION_REG_CREATED'
    | 'MUTATION_REG_UPDATED'
    | 'MUTATION_REG_DELETED'
    | 'MUTATION_CONFIG_UPDATED'
    | 'MUTATION_FULL_RESTORE'
    | 'PRESENCE_HEARTBEAT'
    | 'PRESENCE_LEAVE';
  sender: WorkstationUser;
  timestamp: string;
  entityIdentifier?: string;
  summary?: string;
  payload?: any;
}

export interface WordDocPlaceholder {
  id: string;
  tag: string; // e.g. "{{lotNumber}}"
  label?: string; // Human-readable label e.g. "Lot / Batch Number"
  desc: string; // Description / intended purpose
  category?: 'System' | 'Master' | 'Registration' | 'Sign-off' | 'CustomField' | 'Custom' | 'QC Inspection' | 'Compliance' | 'Packaging';
  defaultValue?: string;
  sampleValue?: string;
  isSystem?: boolean;
  isCustom?: boolean;
  customFieldKey?: string; // Optional linked custom field key
  createdAt?: string;
}

export interface AppConfig {
  appName: string;
  dataDirectory: string;
  defaultRegisteredBy: string;
  companyName: string;
  workstationName?: string;
  categories?: string[]; // Custom and predefined categories list
  customFields: CustomFieldDefinition[];
  wordTemplateName: string;
  wordTemplateContent?: string; // base64 encoded template
  wordDocPlaceholders?: WordDocPlaceholder[];
  portableMode: boolean;
  sharedFolderSyncEnabled?: boolean;
  autoSyncIntervalSec?: number;
  autoBackupDailyEnabled?: boolean;
  lastAutoBackupDate?: string;
  lastAutoBackupTimestamp?: string;
}

export interface DailyAutoBackupRecord {
  id: string;
  date: string; // YYYY-MM-DD
  timestamp: string; // ISO
  masterItemsCount: number;
  registrationsCount: number;
  dataSizeEstimate: string;
}

export interface ExcelImportRow {
  rowNumber: number;
  productCode: string;
  description: string;
  materialType: MaterialType; // RM or PS
  category: string; // e.g. Box, Tape, etc.
  status: ItemStatus;
  unit: string;
  isValid: boolean;
  errors: string[];
  isExisting: boolean;
  existingId?: string;
}

export interface DashboardStats {
  totalMasterItems: number;
  activeItems: number;
  inactiveItems: number;
  rmItems: number;
  psItems: number;
  categoriesCount: number;
  registeredCount: number;
  unregisteredCount: number;
  registrationPercentage: number;
  recentRegistrations: ReferenceRegistration[];
  recentAudits: AuditLogEntry[];
}

export type NavigationTab =
  | 'DASHBOARD'
  | 'MASTER_ITEMS'
  | 'REGISTRATIONS'
  | 'ADMIN_DASHBOARD'
  | 'EXCEL_MANAGER'
  | 'WORD_TEMPLATES'
  | 'DATA_MANAGEMENT'
  | 'AUDIT_TRAIL'
  | 'SHARED_FOLDER';


