import { MasterItem, ReferenceRegistration, CustomFieldDefinition, AuditLogEntry, AppConfig, WordDocPlaceholder } from '../types';

export const DEFAULT_CATEGORIES: string[] = [
  'Box',
  'Tape',
  'Corrugated',
  'Packaging',
  'Label',
  'Sheet Metal',
  'Bar Stock',
  'Resin & Polymer',
  'Rubber & Gasket',
  'Adhesive',
  'Chemical & Solvent',
  'Abrasive',
  'Hardware & Fastener',
  'Gloves & PPE',
  'Lubricant & Oil',
  'Film & Foil',
  'Other'
];

export const DEFAULT_WORD_PLACEHOLDERS: WordDocPlaceholder[] = [
  // --- MASTER ITEM DATA PLACEHOLDERS ---
  {
    id: 'ph_product_code',
    tag: '{{productCode}}',
    label: 'Product Code',
    desc: 'Unique material master code (e.g. RM-SS-304-001)',
    category: 'Master',
    sampleValue: 'RM-SS-304-001',
    isSystem: true
  },
  {
    id: 'ph_description',
    tag: '{{description}}',
    label: 'Item Description',
    desc: 'Material description and dimensions from master record',
    category: 'Master',
    sampleValue: 'Stainless Steel Sheet 304 Grade 2B Finish 1.5mm',
    isSystem: true
  },
  {
    id: 'ph_material_type',
    tag: '{{materialType}}',
    label: 'Material Type',
    desc: 'Classification: Raw Material (RM) or Production Supply (PS)',
    category: 'Master',
    sampleValue: 'Raw Material (RM)',
    isSystem: true
  },
  {
    id: 'ph_material_type_code',
    tag: '{{materialTypeCode}}',
    label: 'Material Type Code',
    desc: 'Short code for classification: RM or PS',
    category: 'Master',
    sampleValue: 'RM',
    isSystem: true
  },
  {
    id: 'ph_category',
    tag: '{{category}}',
    label: 'Item Category',
    desc: 'Item category classification (e.g. Box, Tape, Packaging, Sheet Metal)',
    category: 'Master',
    sampleValue: 'Sheet Metal',
    isSystem: true
  },
  {
    id: 'ph_unit',
    tag: '{{unit}}',
    label: 'Reference Unit',
    desc: 'Standard stocking or reference unit (e.g. Sheet, Roll, Drum, Piece)',
    category: 'Master',
    sampleValue: 'Sheet',
    isSystem: true
  },
  {
    id: 'ph_item_status',
    tag: '{{itemStatus}}',
    label: 'Master Item Status',
    desc: 'Master item lifecycle state (Active / Inactive)',
    category: 'Master',
    sampleValue: 'Active',
    isSystem: true
  },
  {
    id: 'ph_item_created_at',
    tag: '{{itemCreatedAt}}',
    label: 'Item Creation Date',
    desc: 'Timestamp when the master item was first added',
    category: 'Master',
    sampleValue: '2026-08-15',
    isSystem: true
  },

  // --- SAMPLE REGISTRATION & QA INSPECTION ---
  {
    id: 'ph_revision',
    tag: '{{revision}}',
    label: 'Revision Number',
    desc: 'Sample specification revision code (e.g. Rev 01, Rev 02)',
    category: 'Registration',
    sampleValue: 'Rev 01',
    isSystem: true
  },
  {
    id: 'ph_registered_by',
    tag: '{{registeredBy}}',
    label: 'Registered Inspector',
    desc: 'Authorized QA Inspector / Person who entered the sample',
    category: 'Registration',
    sampleValue: 'Juan Dela Cruz',
    isSystem: true
  },
  {
    id: 'ph_registered_by_id',
    tag: '{{registeredById}}',
    label: 'Inspector ID Number',
    desc: 'Operator / Inspector employee identification number',
    category: 'Registration',
    sampleValue: 'EMP-QA-084',
    isSystem: true
  },
  {
    id: 'ph_registration_date',
    tag: '{{registrationDate}}',
    label: 'Registration Date',
    desc: 'Date of physical sample registration (YYYY-MM-DD)',
    category: 'Registration',
    sampleValue: '2026-08-15',
    isSystem: true
  },
  {
    id: 'ph_supplier',
    tag: '{{supplier}}',
    label: 'Supplier / Manufacturer',
    desc: 'Approved vendor or material manufacturer source',
    category: 'Registration',
    sampleValue: 'Apex Metals & Alloys Corp.',
    isSystem: true
  },
  {
    id: 'ph_specification',
    tag: '{{specification}}',
    label: 'Technical Specification',
    desc: 'Detailed QA specifications, tolerances, and criteria',
    category: 'Registration',
    sampleValue: 'Thickness: 1.50mm (+/- 0.05mm), Mill finish ASTM A240',
    isSystem: true
  },
  {
    id: 'ph_remarks',
    tag: '{{remarks}}',
    label: 'Inspection Remarks',
    desc: 'Visual evaluation notes, inspection limits, and condition',
    category: 'Registration',
    sampleValue: 'Visual standard for surface reflectivity and no burrs.',
    isSystem: true
  },
  {
    id: 'ph_registration_id',
    tag: '{{registrationId}}',
    label: 'Registration Record ID',
    desc: 'Internal unique reference sample ID',
    category: 'Registration',
    sampleValue: 'reg-001-ss304',
    isSystem: true
  },
  {
    id: 'ph_proof_id',
    tag: '{{proofId}}',
    label: 'Proof Slip Voucher Serial',
    desc: 'Serial voucher identifier for inspection verification slip',
    category: 'Registration',
    sampleValue: 'IP-RMSS304001-839201',
    isSystem: true
  },
  {
    id: 'ph_photos_list',
    tag: '{{photosList}}',
    label: 'Photos List Table',
    desc: 'Table of verified specimen photographs with captions',
    category: 'Registration',
    sampleValue: 'Photo #1: Primary Specimen standard with annotations',
    isSystem: true
  },
  {
    id: 'ph_photos_count',
    tag: '{{photosCount}}',
    label: 'Photos Count',
    desc: 'Total count of attached specimen photos',
    category: 'Registration',
    sampleValue: '3',
    isSystem: true
  },
  {
    id: 'ph_attachments_count',
    tag: '{{attachmentsCount}}',
    label: 'Attachments Count',
    desc: 'Number of technical drawings / certificates attached',
    category: 'Registration',
    sampleValue: '2',
    isSystem: true
  },

  // --- SIGN-OFF & VERIFICATION AUTHORITY ---
  {
    id: 'ph_checked_by',
    tag: '{{checkedBy}}',
    label: 'Checked By (Admin)',
    desc: 'Name of Administrator authority who checked and verified the sample',
    category: 'Sign-off',
    sampleValue: 'JD. Stone (System Admin)',
    isSystem: true
  },
  {
    id: 'ph_checked_by_id',
    tag: '{{checkedById}}',
    label: 'Admin ID Number',
    desc: 'Employee ID number of checking Administrator',
    category: 'Sign-off',
    sampleValue: 'ADM-001',
    isSystem: true
  },
  {
    id: 'ph_approved_by',
    tag: '{{approvedBy}}',
    label: 'Approved By (QA Head)',
    desc: 'QA Department Head or Engineering Manager sign-off',
    category: 'Sign-off',
    sampleValue: 'Quality Assurance Director',
    isSystem: true
  },
  {
    id: 'ph_approval_date',
    tag: '{{approvalDate}}',
    label: 'Approval Date',
    desc: 'Date of final managerial sign-off and standard authorization',
    category: 'Sign-off',
    sampleValue: '2026-08-16',
    isSystem: true
  },
  {
    id: 'ph_inspector_sig',
    tag: '{{inspectorSignature}}',
    label: 'Inspector Signature Line',
    desc: 'Sign-off line for QA Registering Inspector',
    category: 'Sign-off',
    sampleValue: '___________________________ (Sign & Date)',
    isSystem: true
  },
  {
    id: 'ph_admin_sig',
    tag: '{{adminSignature}}',
    label: 'Admin Sign-off Line',
    desc: 'Sign-off line for Authorizing Administrator',
    category: 'Sign-off',
    sampleValue: '___________________________ (Sign & Date)',
    isSystem: true
  },

  // --- SYSTEM & ORGANIZATIONAL METADATA ---
  {
    id: 'ph_company_name',
    tag: '{{companyName}}',
    label: 'Organization / Company Name',
    desc: 'Header company name configured in application settings',
    category: 'System',
    sampleValue: 'Precision Industrial Manufacturing Corp.',
    isSystem: true
  },
  {
    id: 'ph_department',
    tag: '{{department}}',
    label: 'QA / Inspection Department',
    desc: 'Quality Assurance & Incoming Material Control Department',
    category: 'System',
    sampleValue: 'Quality Assurance & Materials Engineering',
    isSystem: true
  },
  {
    id: 'ph_today_date',
    tag: '{{todayDate}}',
    label: 'Current Export Date (YYYY-MM-DD)',
    desc: 'Automatic generation date of the Word document',
    category: 'System',
    sampleValue: '2026-08-21',
    isSystem: true
  },
  {
    id: 'ph_today_datetime',
    tag: '{{todayDateTime}}',
    label: 'Current Export Date & Time',
    desc: 'Full timestamp with hour, minute, and second of document export',
    category: 'System',
    sampleValue: '2026-08-21 14:30:00',
    isSystem: true
  },
  {
    id: 'ph_current_year',
    tag: '{{currentYear}}',
    label: 'Current Year (YYYY)',
    desc: '4-digit current year for headers/footers',
    category: 'System',
    sampleValue: '2026',
    isSystem: true
  },
  {
    id: 'ph_document_title',
    tag: '{{documentTitle}}',
    label: 'Official Document Title',
    desc: 'Configured title for the formal reference specification sheet',
    category: 'System',
    sampleValue: 'MATERIAL REFERENCE & SAMPLE SPECIFICATION FORM',
    isSystem: true
  },
  {
    id: 'ph_template_name',
    tag: '{{templateName}}',
    label: 'Template File Name',
    desc: 'Active Word document template filename',
    category: 'System',
    sampleValue: 'Official_Material_Reference_Template_v2.docx',
    isSystem: true
  },

  // --- CUSTOM ATTRIBUTES & FIELD PLACEHOLDERS ---
  {
    id: 'ph_storage_loc',
    tag: '{{storageLocation}}',
    label: 'Sample Bin / Shelf Location',
    desc: 'Physical storage bin, rack, or cabinet location',
    category: 'CustomField',
    sampleValue: 'Shelf A-01',
    isSystem: false
  },
  {
    id: 'ph_country_origin',
    tag: '{{countryOfOrigin}}',
    label: 'Country of Origin',
    desc: 'Manufacturing country or origin region',
    category: 'CustomField',
    sampleValue: 'Philippines',
    isSystem: false
  },
  {
    id: 'ph_is_hazardous',
    tag: '{{isHazardous}}',
    label: 'Hazardous Material Status',
    desc: 'Indicates if material requires hazardous handling (YES / NO)',
    category: 'CustomField',
    sampleValue: 'NO',
    isSystem: false
  },
  {
    id: 'ph_shelf_life',
    tag: '{{shelfLifeMonths}}',
    label: 'Shelf Life (Months)',
    desc: 'Sample validity / shelf life duration in months',
    category: 'CustomField',
    sampleValue: '24 Months',
    isSystem: false
  },
  {
    id: 'ph_lot_number',
    tag: '{{lotNumber}}',
    label: 'Lot / Batch Number',
    desc: 'Manufacturing batch, heat number, or lot identification',
    category: 'CustomField',
    sampleValue: 'LOT-2026-B849',
    isSystem: false
  },
  {
    id: 'ph_color_std',
    tag: '{{colorStandard}}',
    label: 'Color Standard / Visual Spec',
    desc: 'Color matching standard, Pantone, or RAL code',
    category: 'CustomField',
    sampleValue: 'Natural Matte / Semi-gloss',
    isSystem: false
  },
  {
    id: 'ph_material_grade',
    tag: '{{materialGrade}}',
    label: 'Chemical / Material Grade',
    desc: 'Specific metallurgical or polymer grade designation',
    category: 'CustomField',
    sampleValue: 'AISI 304 / UNS S30400',
    isSystem: false
  }
];

export const DEFAULT_CUSTOM_FIELDS: CustomFieldDefinition[] = [
  {
    id: 'cf_storage_loc',
    key: 'storageLocation',
    label: 'Sample Bin / Shelf Location',
    type: 'text',
    categoryApplicability: 'ALL',
    materialTypeApplicability: 'ALL',
    required: false,
    defaultValue: 'Shelf A-01'
  },
  {
    id: 'cf_country_origin',
    key: 'countryOfOrigin',
    label: 'Country of Origin',
    type: 'text',
    categoryApplicability: 'ALL',
    materialTypeApplicability: 'ALL',
    required: false,
    defaultValue: 'Philippines'
  },
  {
    id: 'cf_hazardous',
    key: 'isHazardous',
    label: 'Hazardous / Controlled Material',
    type: 'boolean',
    categoryApplicability: 'RM',
    materialTypeApplicability: 'RM',
    required: false,
    defaultValue: 'false'
  },
  {
    id: 'cf_exp_months',
    key: 'shelfLifeMonths',
    label: 'Shelf Life (Months)',
    type: 'number',
    categoryApplicability: 'ALL',
    materialTypeApplicability: 'ALL',
    required: false,
    defaultValue: '24'
  }
];

export const DEFAULT_CONFIG: AppConfig = {
  appName: 'Material Reference & Sample Tracking System',
  companyName: 'Precision Industrial Manufacturing Corp.',
  dataDirectory: 'Application Data/ReferenceTracker_Data/',
  defaultRegisteredBy: 'JD. Stone',
  categories: DEFAULT_CATEGORIES,
  customFields: DEFAULT_CUSTOM_FIELDS,
  wordTemplateName: 'Official_Material_Reference_Template_v2.docx',
  wordDocPlaceholders: DEFAULT_WORD_PLACEHOLDERS,
  portableMode: true
};

export const INITIAL_MASTER_ITEMS: MasterItem[] = [
  {
    id: 'item-001',
    productCode: 'RM-SS-304-001',
    description: 'Stainless Steel Sheet 304 Grade 2B Finish 1.5mm x 1219mm x 2438mm',
    materialType: 'RM',
    category: 'Sheet Metal',
    status: 'Active',
    unit: 'Sheet',
    createdAt: '2026-08-15T08:00:00.000Z',
    updatedAt: '2026-08-15T08:00:00.000Z'
  },
  {
    id: 'item-002',
    productCode: 'RM-AL-6061-T6',
    description: 'Aluminum Extrusion Bar 6061-T6 50mm x 50mm Square Hollow',
    materialType: 'RM',
    category: 'Bar Stock',
    status: 'Active',
    unit: 'Length',
    createdAt: '2026-08-15T08:30:00.000Z',
    updatedAt: '2026-08-15T08:30:00.000Z'
  },
  {
    id: 'item-003',
    productCode: 'RM-POLY-HDPE-NAT',
    description: 'High-Density Polyethylene Resin Pellets Natural Grade Injection Molding',
    materialType: 'RM',
    category: 'Resin & Polymer',
    status: 'Active',
    unit: 'Bag (25kg)',
    createdAt: '2026-08-16T09:15:00.000Z',
    updatedAt: '2026-08-16T09:15:00.000Z'
  },
  {
    id: 'item-004',
    productCode: 'RM-RUB-EPDM-70',
    description: 'EPDM Rubber Gasket Sheet 70 Shore A Black 3.0mm Thickness',
    materialType: 'RM',
    category: 'Rubber & Gasket',
    status: 'Active',
    unit: 'Roll',
    createdAt: '2026-08-16T10:00:00.000Z',
    updatedAt: '2026-08-16T10:00:00.000Z'
  },
  {
    id: 'item-005',
    productCode: 'RM-COP-C1100-ROD',
    description: 'Electrolytic Tough Pitch Copper Round Rod Dia 25mm x 3000mm',
    materialType: 'RM',
    category: 'Bar Stock',
    status: 'Inactive',
    unit: 'Piece',
    createdAt: '2026-08-17T11:00:00.000Z',
    updatedAt: '2026-08-17T11:00:00.000Z'
  },
  {
    id: 'item-006',
    productCode: 'PS-NIT-GLOVE-L',
    description: 'Nitrile Examination Gloves Powder-Free Blue Large Box of 100',
    materialType: 'PS',
    category: 'Gloves & PPE',
    status: 'Active',
    unit: 'Box',
    createdAt: '2026-08-17T13:30:00.000Z',
    updatedAt: '2026-08-17T13:30:00.000Z'
  },
  {
    id: 'item-007',
    productCode: 'PS-LUB-SYN-VG46',
    description: 'Fully Synthetic Hydraulic Oil ISO VG 46 High Thermal Stability Drum',
    materialType: 'PS',
    category: 'Lubricant & Oil',
    status: 'Active',
    unit: 'Drum (208L)',
    createdAt: '2026-08-18T14:00:00.000Z',
    updatedAt: '2026-08-18T14:00:00.000Z'
  },
  {
    id: 'item-008',
    productCode: 'PS-TAPE-KAPT-25',
    description: 'High-Temperature Polyimide Kapton Tape 25mm Width x 33m Length',
    materialType: 'PS',
    category: 'Tape',
    status: 'Active',
    unit: 'Roll',
    createdAt: '2026-08-18T15:20:00.000Z',
    updatedAt: '2026-08-18T15:20:00.000Z'
  },
  {
    id: 'item-009',
    productCode: 'PS-SAND-GRIT-320',
    description: 'Silicon Carbide Waterproof Sandpaper Sheet 230mm x 280mm Grit 320',
    materialType: 'PS',
    category: 'Abrasive',
    status: 'Active',
    unit: 'Pack (50)',
    createdAt: '2026-08-19T08:45:00.000Z',
    updatedAt: '2026-08-19T08:45:00.000Z'
  },
  {
    id: 'item-010',
    productCode: 'PS-SOLV-IPA-99',
    description: 'High Purity Isopropyl Alcohol 99.9% Electronic Grade Gallon',
    materialType: 'PS',
    category: 'Chemical & Solvent',
    status: 'Inactive',
    unit: 'Gallon',
    createdAt: '2026-08-19T10:00:00.000Z',
    updatedAt: '2026-08-19T10:00:00.000Z'
  }
];

export const INITIAL_REGISTRATIONS: ReferenceRegistration[] = [
  {
    id: 'ref-001',
    masterItemId: 'item-001',
    productCode: 'RM-SS-304-001',
    materialType: 'RM',
    category: 'Sheet Metal',
    registrationDate: '2026-08-20',
    registeredBy: 'Juan Dela Cruz',
    supplier: 'Apex Metal Alloys Inc.',
    specification: 'ASTM A240 / ASME SA240 standard. Chemical composition: Cr 18.2%, Ni 8.1%, C <= 0.07%. Surface roughness Ra <= 0.4um. Mill test certificate attached. Verified non-magnetic and passivated.',
    remarks: 'Approved as gold standard visual reference for batch acceptance testing in stamping line.',
    revision: 'Rev 01',
    customFields: {
      storageLocation: 'Room 3 - Rack B-04',
      countryOfOrigin: 'Japan',
      isHazardous: false,
      shelfLifeMonths: 60
    },
    photos: [
      {
        id: 'photo-1',
        fileName: 'stainless_steel_sample_grain.png',
        fileSize: 45200,
        dataUrl: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300" viewBox="0 0 400 300"><rect width="400" height="300" fill="%23cbd5e1"/><rect x="40" y="40" width="320" height="220" fill="%2394a3b8" rx="8"/><line x1="60" y1="80" x2="340" y2="80" stroke="%23f8fafc" stroke-width="3"/><line x1="60" y1="120" x2="340" y2="120" stroke="%23f8fafc" stroke-width="2"/><line x1="60" y1="160" x2="340" y2="160" stroke="%23f8fafc" stroke-width="2"/><line x1="60" y1="200" x2="340" y2="200" stroke="%23f8fafc" stroke-width="3"/><text x="200" y="240" font-family="sans-serif" font-size="14" fill="%230f172a" text-anchor="middle" font-weight="bold">RM-SS-304-001 MASTER SPECIMEN</text></svg>',
        caption: 'Top surface 2B finish specular inspection with micrometer gauge calibration',
        uploadedAt: '2026-08-20T08:30:00.000Z'
      }
    ],
    attachments: [
      {
        id: 'att-1',
        fileName: 'Mill_Test_Cert_EN10204_3.1.pdf',
        fileSize: 245800,
        fileType: 'application/pdf',
        uploadedAt: '2026-08-20T08:35:00.000Z'
      }
    ],
    wordFormGenerated: true,
    wordFormLastGeneratedAt: '2026-08-20T08:40:00.000Z',
    createdAt: '2026-08-20T08:30:00.000Z',
    updatedAt: '2026-08-20T08:40:00.000Z'
  },
  {
    id: 'ref-002',
    masterItemId: 'item-003',
    productCode: 'RM-POLY-HDPE-NAT',
    materialType: 'RM',
    category: 'Resin & Polymer',
    registrationDate: '2026-08-19',
    registeredBy: 'Maria Santos',
    supplier: 'Petrochem Global Solutions',
    specification: 'Melt Flow Index (MFI) 0.35 g/10min at 190C/2.16kg. Density 0.954 g/cm3. Tensile strength yield 26 MPa. ISO 1183 and ASTM D1238 compliant.',
    remarks: 'Lot #PG-20260815 physical pellet sample registered for color index and moisture analysis testing.',
    revision: 'Rev 01',
    customFields: {
      storageLocation: 'Desiccator Cabinet C-1',
      countryOfOrigin: 'Singapore',
      isHazardous: false,
      shelfLifeMonths: 24
    },
    photos: [
      {
        id: 'photo-2',
        fileName: 'hdpe_pellet_sample.png',
        fileSize: 38400,
        dataUrl: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300" viewBox="0 0 400 300"><rect width="400" height="300" fill="%23f1f5f9"/><circle cx="120" cy="120" r="30" fill="%23e2e8f0" stroke="%2394a3b8" stroke-width="2"/><circle cx="200" cy="110" r="28" fill="%23e2e8f0" stroke="%2394a3b8" stroke-width="2"/><circle cx="280" cy="130" r="32" fill="%23e2e8f0" stroke="%2394a3b8" stroke-width="2"/><circle cx="160" cy="180" r="30" fill="%23e2e8f0" stroke="%2394a3b8" stroke-width="2"/><circle cx="240" cy="190" r="29" fill="%23e2e8f0" stroke="%2394a3b8" stroke-width="2"/><text x="200" y="260" font-family="sans-serif" font-size="14" fill="%23334155" text-anchor="middle" font-weight="bold">HDPE Virgin Pellets - Natural</text></svg>',
        caption: 'Pellet size uniformity inspection under stereo microscope',
        uploadedAt: '2026-08-19T10:15:00.000Z'
      }
    ],
    attachments: [
      {
        id: 'att-2',
        fileName: 'TDS_HDPE_Natural_Injection.pdf',
        fileSize: 189200,
        fileType: 'application/pdf',
        uploadedAt: '2026-08-19T10:20:00.000Z'
      }
    ],
    wordFormGenerated: false,
    createdAt: '2026-08-19T10:15:00.000Z',
    updatedAt: '2026-08-19T10:20:00.000Z'
  },
  {
    id: 'ref-003',
    masterItemId: 'item-006',
    productCode: 'PS-NIT-GLOVE-L',
    materialType: 'PS',
    category: 'Gloves & PPE',
    registrationDate: '2026-08-18',
    registeredBy: 'Juan Dela Cruz',
    supplier: 'SafetyPro Supplies Ltd.',
    specification: 'Thickness palm 0.10mm, finger 0.14mm. Tensile strength >= 14 MPa before aging. Pinhole AQL 1.5. EN 455 & ASTM D6319 certified.',
    remarks: 'Approved standard reference sample for Cleanroom Class 10,000 operators.',
    revision: 'Rev 01',
    customFields: {
      storageLocation: 'Supply Reference Room R1',
      countryOfOrigin: 'Malaysia',
      isHazardous: false,
      shelfLifeMonths: 36
    },
    photos: [
      {
        id: 'photo-3',
        fileName: 'nitrile_glove_specimen.png',
        fileSize: 41200,
        dataUrl: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300" viewBox="0 0 400 300"><rect width="400" height="300" fill="%230284c7" rx="10"/><text x="200" y="140" font-family="sans-serif" font-size="22" fill="%23ffffff" text-anchor="middle" font-weight="bold">NITRILE GLOVE L</text><text x="200" y="180" font-family="sans-serif" font-size="14" fill="%23e0f2fe" text-anchor="middle">AQL 1.5 - Powder Free</text></svg>',
        caption: 'Visual inspection of cuff beading and micro-textured fingertip grip',
        uploadedAt: '2026-08-18T14:30:00.000Z'
      }
    ],
    attachments: [],
    wordFormGenerated: true,
    wordFormLastGeneratedAt: '2026-08-18T15:00:00.000Z',
    createdAt: '2026-08-18T14:30:00.000Z',
    updatedAt: '2026-08-18T15:00:00.000Z'
  }
];

export const INITIAL_AUDIT_LOGS: AuditLogEntry[] = [
  {
    id: 'audit-001',
    timestamp: '2026-08-15T08:00:00.000Z',
    user: 'System Admin',
    action: 'IMPORT',
    entityType: 'MASTER_ITEM',
    details: 'Initial Master Reference List imported from Excel template (10 items loaded; inventory data excluded by design policy)'
  },
  {
    id: 'audit-002',
    timestamp: '2026-08-18T14:30:00.000Z',
    user: 'Juan Dela Cruz',
    action: 'CREATE',
    entityType: 'REFERENCE',
    entityIdentifier: 'PS-NIT-GLOVE-L',
    details: 'Registered reference sample for PS-NIT-GLOVE-L with specification and photo'
  },
  {
    id: 'audit-003',
    timestamp: '2026-08-19T10:15:00.000Z',
    user: 'Maria Santos',
    action: 'CREATE',
    entityType: 'REFERENCE',
    entityIdentifier: 'RM-POLY-HDPE-NAT',
    details: 'Registered reference sample for RM-POLY-HDPE-NAT with MFI specifications and TDS'
  },
  {
    id: 'audit-004',
    timestamp: '2026-08-20T08:30:00.000Z',
    user: 'Juan Dela Cruz',
    action: 'CREATE',
    entityType: 'REFERENCE',
    entityIdentifier: 'RM-SS-304-001',
    details: 'Registered reference sample for RM-SS-304-001 with mill test certificate and high-resolution photo'
  },
  {
    id: 'audit-005',
    timestamp: '2026-08-20T08:40:00.000Z',
    user: 'Juan Dela Cruz',
    action: 'GENERATE_FORM',
    entityType: 'REFERENCE',
    entityIdentifier: 'RM-SS-304-001',
    details: 'Generated and saved official Word Reference Form (DOCX) Rev 01'
  }
];
