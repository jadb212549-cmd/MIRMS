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
  name?: string; // alias for fileName
  fileSize: number;
  size?: number; // alias for fileSize
  dataUrl: string; // base64 or relative file path in Tauri
  caption?: string;
  uploadedAt: string;
  isPrimary?: boolean; // Main sample photo flag
  includeInPrint?: boolean; // Whether to include in physical printable card / Word doc
  photoCategory?: PhotoCategory;
  category?: string; // alias / string category
  orderIndex?: number;
}

export interface DocumentAttachment {
  id: string;
  fileName: string;
  name?: string; // alias for fileName
  fileSize: number;
  size?: number; // alias for fileSize
  fileType: string;
  type?: string; // alias for fileType
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

export type RevisionStatus = 'APPROVED' | 'PENDING_APPROVAL' | 'REJECTED' | 'DRAFT';

export interface ReferenceRevisionRecord {
  id: string;
  referenceId: string;
  versionNumber: number; // 1, 2, 3...
  revisionCode: string; // "Rev 01", "Rev 02", etc.
  status: RevisionStatus;

  // Data snapshot for this specific revision
  masterItemId: string;
  productCode: string;
  materialType?: MaterialType;
  category?: string;
  registrationDate: string;
  registeredBy: string; // Original registrant or revision author
  supplier?: string;
  specification?: string;
  remarks?: string;
  customFields: Record<string, string | number | boolean>;
  photos: PhotoAttachment[];
  attachments: DocumentAttachment[];
  selectedPrintPhotoIds?: string[];
  printLayout?: PrintLayoutType;

  // Revision & Approval Tracking
  submittedBy: string;
  submittedAt: string;
  approvedBy?: string;
  approvedAt?: string;
  rejectedBy?: string;
  rejectedAt?: string;
  rejectionReason?: string;
  revisionNotes?: string;
  changeSummary?: string;
  changedFields?: string[];
}

export interface ReferenceRevision {
  id: string;
  revision: string; // e.g. "Rev 01"
  date: string;
  author: string;
  status?: RevisionStatus;
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
  revision: string; // Active official revision e.g. "Rev 01", "Rev 02"
  status: RevisionStatus; // Status of the active reference (APPROVED, PENDING_APPROVAL, REJECTED)
  currentVersionNumber?: number; // 1, 2, 3...
  currentApprovedVersionId?: string;

  // Pending Revision Pointer
  hasPendingRevision?: boolean;
  pendingRevisionId?: string;
  pendingRevision?: ReferenceRevisionRecord;

  // Full Version History
  versions?: ReferenceRevisionRecord[];
  revisionHistory?: ReferenceRevision[]; // backwards compatibility

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
  performedBy?: string; // alias for user
  action: 'CREATE' | 'UPDATE' | 'DELETE' | 'IMPORT' | 'EXPORT' | 'BACKUP' | 'RESTORE' | 'GENERATE_FORM' | 'APPROVE' | 'REJECT' | 'SUBMIT_REVISION';
  entityType: 'MASTER_ITEM' | 'REFERENCE' | 'TEMPLATE' | 'SETTINGS' | 'SYSTEM' | 'REVISION';
  entityId?: string;
  entityIdentifier?: string; // e.g. Product Code
  entityKey?: string; // alias for entityIdentifier
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
    | 'MUTATION_REVISION_SUBMITTED'
    | 'MUTATION_REVISION_APPROVED'
    | 'MUTATION_REVISION_REJECTED'
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
  adminCanAutoApproveOwnRevisions?: boolean;
  requireApprovalForRevisions?: boolean;
  requireAdminApprovalForNewRegistrations?: boolean;
  hiddenDashboardProductCodes?: string[];
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

export type FormType = 'material_reference_sheet' | 'inspection_proof_slip';

export interface FormTemplate {
  id: string;
  name: string;
  description?: string;
  formType: FormType;
  version: string;
  isActive: boolean;
  fileType: 'docx' | 'html' | 'json' | 'txt' | 'pdf';
  fileName?: string;
  filePath?: string;
  fileContent?: string; // base64 for docx or raw HTML/markup template
  fieldMappings: Record<string, string>; // Template Placeholder / tag (e.g. "{{material_code}}") -> System Field Key (e.g. "productCode")
  customCss?: string;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  isBuiltIn?: boolean;
}

export interface SystemFieldOption {
  key: string;
  tag: string;
  label: string;
  category: 'Material Data' | 'Registration & Inspection' | 'Sign-off & Approval' | 'System & Meta' | 'Custom Fields' | 'Photos';
  sampleValue: string;
  isRequired?: boolean;
  description: string;
}

export type NavigationTab =
  | 'DASHBOARD'
  | 'MASTER_ITEMS'
  | 'REGISTRATIONS'
  | 'ADMIN_DASHBOARD'
  | 'FORM_TEMPLATES'
  | 'EXCEL_MANAGER'
  | 'WORD_TEMPLATES'
  | 'DATA_MANAGEMENT'
  | 'AUDIT_TRAIL'
  | 'SHARED_FOLDER';


