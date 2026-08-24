import { FormTemplate, FormType, SystemFieldOption, MasterItem, ReferenceRegistration, AppConfig } from '../types';

export const SYSTEM_FORM_FIELDS: SystemFieldOption[] = [
  // --- 1. Material Master Data ---
  {
    key: 'productCode',
    tag: '{{productCode}}',
    label: 'Material / Product Code',
    category: 'Material Data',
    sampleValue: 'RM-SS-304-001',
    isRequired: true,
    description: 'Unique identifier code for the material (e.g., RM-SS-304-001)'
  },
  {
    key: 'description',
    tag: '{{description}}',
    label: 'Material Description',
    category: 'Material Data',
    sampleValue: 'Stainless Steel Sheet 304 Grade 2B Finish 1.5mm',
    isRequired: true,
    description: 'Full official description and dimensions of the material'
  },
  {
    key: 'materialType',
    tag: '{{materialType}}',
    label: 'Material Type (Full Name)',
    category: 'Material Data',
    sampleValue: 'Raw Material (RM)',
    description: 'Classification: Raw Material (RM) or Production Supply (PS)'
  },
  {
    key: 'materialTypeCode',
    tag: '{{materialTypeCode}}',
    label: 'Material Type Code',
    category: 'Material Data',
    sampleValue: 'RM',
    description: 'Short two-letter classification code: RM or PS'
  },
  {
    key: 'category',
    tag: '{{category}}',
    label: 'Material Category',
    category: 'Material Data',
    sampleValue: 'Sheet Metal',
    description: 'Sub-category classification (e.g. Sheet Metal, Box, Tape, Resin)'
  },
  {
    key: 'unit',
    tag: '{{unit}}',
    label: 'Stocking / Reference Unit',
    category: 'Material Data',
    sampleValue: 'Sheet (1220x2440mm)',
    description: 'Unit of measurement (e.g. Sheet, Box, Roll, Drum, Piece)'
  },
  {
    key: 'itemStatus',
    tag: '{{itemStatus}}',
    label: 'Item Master Status',
    category: 'Material Data',
    sampleValue: 'Active',
    description: 'Lifecycle status of the material master (Active / Inactive)'
  },

  // --- 2. Sample Registration & Inspection ---
  {
    key: 'registrationId',
    tag: '{{registrationId}}',
    label: 'Reference Registration ID',
    category: 'Registration & Inspection',
    sampleValue: 'REF-REG-2026-0841',
    description: 'System internal tracking identifier for the reference registration'
  },
  {
    key: 'proofSerial',
    tag: '{{proofSerial}}',
    label: 'Inspection Proof Serial / Number',
    category: 'Registration & Inspection',
    sampleValue: 'IP-RMSS304001-948201',
    description: 'Unique traceable inspection verification slip number'
  },
  {
    key: 'revision',
    tag: '{{revision}}',
    label: 'Sample Revision',
    category: 'Registration & Inspection',
    sampleValue: 'Rev 01',
    isRequired: true,
    description: 'Revision or version code of the physical standard sample'
  },
  {
    key: 'registrationDate',
    tag: '{{registrationDate}}',
    label: 'Registration / Inspection Date',
    category: 'Registration & Inspection',
    sampleValue: '2026-08-20',
    isRequired: true,
    description: 'Date the reference sample was inspected and registered'
  },
  {
    key: 'registeredBy',
    tag: '{{registeredBy}}',
    label: 'Registered By / Inspector Name',
    category: 'Registration & Inspection',
    sampleValue: 'Juan Dela Cruz',
    isRequired: true,
    description: 'Name of the Quality Inspector or Engineer who registered the specimen'
  },
  {
    key: 'registeredById',
    tag: '{{registeredById}}',
    label: 'Inspector / Employee ID',
    category: 'Registration & Inspection',
    sampleValue: 'EMP-QA881',
    description: 'Employee ID or badge number of the registered QA inspector'
  },
  {
    key: 'supplier',
    tag: '{{supplier}}',
    label: 'Supplier / Manufacturer',
    category: 'Registration & Inspection',
    sampleValue: 'Apex Metal Alloys Inc.',
    description: 'Vendor, supplier, or authorized manufacturing source'
  },
  {
    key: 'specification',
    tag: '{{specification}}',
    label: 'Technical Specification',
    category: 'Registration & Inspection',
    sampleValue: 'ASTM A240 standard. Chemical: Cr 18.2%, Ni 8.1%. Ra <= 0.4um. Mill test cert attached.',
    description: 'Full technical criteria, dimensions, tolerances, and physical specs'
  },
  {
    key: 'remarks',
    tag: '{{remarks}}',
    label: 'Remarks / Inspection Notes',
    category: 'Registration & Inspection',
    sampleValue: 'Approved as visual gold standard for batch acceptance testing in stamping line.',
    description: 'Special inspection notes, storage instructions, or QA remarks'
  },
  {
    key: 'inspectionResult',
    tag: '{{inspectionResult}}',
    label: 'Inspection Status / Verdict',
    category: 'Registration & Inspection',
    sampleValue: 'VERIFIED & CONFORMANT',
    description: 'Formal quality verification disposition'
  },

  // --- 3. Sign-off & Signatures ---
  {
    key: 'checkedBy',
    tag: '{{checkedBy}}',
    label: 'Checked / Verified By',
    category: 'Sign-off & Approval',
    sampleValue: 'JD. Stone (QA Supervisor)',
    description: 'Name of the QA Supervisor or Lead Engineer'
  },
  {
    key: 'approvedBy',
    tag: '{{approvedBy}}',
    label: 'Approved By (Authorized Admin)',
    category: 'Sign-off & Approval',
    sampleValue: 'Maria Santos (QA Admin)',
    description: 'Name of authorizing Quality Manager / Administrator'
  },
  {
    key: 'approvalDate',
    tag: '{{approvalDate}}',
    label: 'Approval Date',
    category: 'Sign-off & Approval',
    sampleValue: '2026-08-20',
    description: 'Date of management approval and sign-off'
  },
  {
    key: 'inspectorSignature',
    tag: '{{inspectorSignature}}',
    label: 'Inspector Signature Line',
    category: 'Sign-off & Approval',
    sampleValue: '___________________________ (Sign & Date)',
    description: 'Physical or digital sign-off area for inspector'
  },
  {
    key: 'adminSignature',
    tag: '{{adminSignature}}',
    label: 'Admin / Manager Signature Line',
    category: 'Sign-off & Approval',
    sampleValue: '___________________________ (Sign & Date)',
    description: 'Physical or digital sign-off area for quality manager'
  },

  // --- 4. System & Company Meta ---
  {
    key: 'companyName',
    tag: '{{companyName}}',
    label: 'Company / Organization Name',
    category: 'System & Meta',
    sampleValue: 'Precision Industrial Manufacturing Corp.',
    description: 'Organization name from system settings'
  },
  {
    key: 'department',
    tag: '{{department}}',
    label: 'Quality Department',
    category: 'System & Meta',
    sampleValue: 'Quality Assurance & Materials Engineering',
    description: 'QA department or laboratory unit'
  },
  {
    key: 'todayDate',
    tag: '{{todayDate}}',
    label: 'Current Generation Date',
    category: 'System & Meta',
    sampleValue: new Date().toISOString().split('T')[0],
    description: 'Current date when the form is generated'
  },
  {
    key: 'todayDateTime',
    tag: '{{todayDateTime}}',
    label: 'Generation Timestamp (Date & Time)',
    category: 'System & Meta',
    sampleValue: new Date().toLocaleString(),
    description: 'Full timestamp of form printing or export'
  },
  {
    key: 'printTimestamp',
    tag: '{{printTimestamp}}',
    label: 'Print Timestamp',
    category: 'System & Meta',
    sampleValue: new Date().toLocaleTimeString(),
    description: 'Exact time when the slip was printed'
  },
  {
    key: 'photosCount',
    tag: '{{photosCount}}',
    label: 'Attached Photos Count',
    category: 'Photos',
    sampleValue: '1',
    description: 'Number of sample specimen photos attached'
  },
  {
    key: 'primaryPhotoUrl',
    tag: '{{primaryPhotoUrl}}',
    label: 'Primary Specimen Photo (Data URL/Image)',
    category: 'Photos',
    sampleValue: 'data:image/png;base64,...',
    description: 'Image src data url for the primary sample photo'
  }
];

// Required fields per form type for validation
export const REQUIRED_FIELDS_BY_TYPE: Record<FormType, string[]> = {
  material_reference_sheet: ['productCode', 'description', 'revision', 'registeredBy', 'registrationDate'],
  inspection_proof_slip: ['productCode', 'revision', 'registeredBy', 'registrationDate']
};

export const DEFAULT_INSPECTION_SLIP_HTML = `
<div class="proof-container">
  <div class="header">
    <div class="company-name">{{companyName}}</div>
    <div class="doc-title">QA Inspection Proof Slip</div>
    <div class="sub-title">STANDARD REFERENCE SAMPLE VERIFICATION</div>
    <div class="meta-bar">
      <span>PROOF #: <strong>{{proofSerial}}</strong></span>
      <span>DATE: <strong>{{registrationDate}}</strong></span>
    </div>
  </div>

  <div class="product-box">
    <div class="product-header">
      <div>
        <div class="code-label">MATERIAL CODE</div>
        <div class="code-val">{{productCode}}</div>
      </div>
      <div class="rev-badge">{{revision}}</div>
    </div>
    <div class="desc-box">
      <div class="desc-val">{{description}}</div>
    </div>
  </div>

  <div class="info-grid">
    <div class="info-item">
      <span class="info-label">CATEGORY:</span>
      <span class="info-val">{{category}}</span>
    </div>
    <div class="info-item">
      <span class="info-label">TYPE:</span>
      <span class="info-val">{{materialType}}</span>
    </div>
    <div class="info-item">
      <span class="info-label">UNIT:</span>
      <span class="info-val">{{unit}}</span>
    </div>
    <div class="info-item">
      <span class="info-label">SUPPLIER:</span>
      <span class="info-val">{{supplier}}</span>
    </div>
  </div>

  <div class="spec-box">
    <div class="spec-title">SPECIFICATION CRITERIA</div>
    <div class="spec-val">{{specification}}</div>
  </div>

  {{#remarks}}
  <div class="remarks-box">
    <div class="spec-title">INSPECTION REMARKS</div>
    <div class="spec-val">{{remarks}}</div>
  </div>
  {{/remarks}}

  <div class="verdict-banner">
    <span class="verdict-tag">STATUS:</span>
    <span class="verdict-text">{{inspectionResult}}</span>
  </div>

  <div class="sign-grid">
    <div class="sign-card">
      <div class="sign-role">INSPECTED & REGISTERED BY:</div>
      <div class="sign-name">{{registeredBy}}</div>
      <div class="sign-id">ID: {{registeredById}}</div>
      <div class="sign-line">{{inspectorSignature}}</div>
    </div>
    <div class="sign-card">
      <div class="sign-role">VERIFIED / QA ADMIN:</div>
      <div class="sign-name">{{approvedBy}}</div>
      <div class="sign-id">ID: {{checkedById}}</div>
      <div class="sign-line">{{adminSignature}}</div>
    </div>
  </div>

  <div class="footer">
    <span>Department: {{department}}</span>
    <span>Printed: {{todayDateTime}}</span>
  </div>
</div>
`;

export const DEFAULT_INSPECTION_SLIP_CSS = `
.proof-container {
  width: 100%;
  max-width: 440px;
  margin: 0 auto;
  border: 2px solid #0f172a;
  border-radius: 8px;
  padding: 16px;
  box-sizing: border-box;
  background: #ffffff;
  color: #0f172a;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
  font-size: 11px;
  line-height: 1.35;
}
.header {
  text-align: center;
  border-bottom: 2px solid #0f172a;
  padding-bottom: 8px;
}
.company-name {
  font-size: 9px;
  font-weight: 800;
  letter-spacing: 1.5px;
  text-transform: uppercase;
  color: #475569;
}
.doc-title {
  font-size: 14px;
  font-weight: 900;
  text-transform: uppercase;
  color: #0f172a;
  margin: 2px 0;
}
.sub-title {
  font-size: 9px;
  color: #64748b;
  font-family: monospace;
  letter-spacing: 0.5px;
}
.meta-bar {
  display: flex;
  justify-content: space-between;
  font-family: monospace;
  font-size: 9px;
  padding: 4px 6px;
  background: #f8fafc;
  border-radius: 4px;
  border: 1px dashed #cbd5e1;
  margin-top: 6px;
}
.product-box {
  background: #f1f5f9;
  border: 1px solid #cbd5e1;
  border-radius: 6px;
  padding: 8px 10px;
  margin: 10px 0;
}
.product-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
}
.code-label {
  font-size: 8px;
  font-weight: 800;
  text-transform: uppercase;
  color: #64748b;
  font-family: monospace;
}
.code-val {
  font-size: 16px;
  font-weight: 900;
  font-family: monospace;
  color: #0f172a;
}
.rev-badge {
  background: #0f172a;
  color: #fff;
  font-family: monospace;
  font-weight: 800;
  font-size: 9px;
  padding: 2px 6px;
  border-radius: 4px;
}
.desc-box {
  margin-top: 6px;
  padding-top: 6px;
  border-top: 1px solid #e2e8f0;
}
.desc-val {
  font-size: 11px;
  font-weight: 700;
  color: #0f172a;
}
.info-grid {
  border-top: 1px solid #cbd5e1;
  border-bottom: 1px solid #cbd5e1;
  padding: 6px 0;
  margin: 8px 0;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 4px 10px;
  font-size: 10px;
}
.info-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.info-label {
  color: #64748b;
  font-family: monospace;
  font-size: 9px;
}
.info-val {
  font-weight: 700;
  color: #0f172a;
}
.spec-box, .remarks-box {
  margin: 6px 0;
  padding: 6px 8px;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 4px;
}
.spec-title {
  font-size: 8px;
  font-weight: 800;
  text-transform: uppercase;
  color: #64748b;
  font-family: monospace;
}
.spec-val {
  font-size: 9.5px;
  font-family: monospace;
  white-space: pre-wrap;
  color: #1e293b;
  margin-top: 2px;
}
.verdict-banner {
  margin: 8px 0;
  padding: 5px 8px;
  background: #ecfdf5;
  border: 1px solid #a7f3d0;
  border-radius: 4px;
  display: flex;
  align-items: center;
  gap: 6px;
}
.verdict-tag {
  font-size: 8px;
  font-weight: 800;
  font-family: monospace;
  color: #047857;
}
.verdict-text {
  font-size: 10px;
  font-weight: 900;
  font-family: monospace;
  color: #065f46;
}
.sign-grid {
  margin-top: 10px;
  padding-top: 8px;
  border-top: 2px solid #0f172a;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
  font-size: 9px;
}
.sign-card {
  border: 1px solid #cbd5e1;
  border-radius: 4px;
  padding: 6px 8px;
  background: #f8fafc;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  min-height: 52px;
}
.sign-role {
  font-size: 8px;
  font-weight: 800;
  text-transform: uppercase;
  color: #64748b;
  font-family: monospace;
}
.sign-name {
  font-weight: 700;
  color: #0f172a;
  margin-top: 2px;
}
.sign-id {
  font-size: 8px;
  font-family: monospace;
  color: #64748b;
}
.sign-line {
  font-family: monospace;
  font-size: 8px;
  color: #94a3b8;
  margin-top: 4px;
}
.footer {
  margin-top: 10px;
  padding-top: 6px;
  border-top: 1px dashed #cbd5e1;
  display: flex;
  justify-content: space-between;
  font-size: 8px;
  font-family: monospace;
  color: #64748b;
}
`;

export const COMPACT_INSPECTION_SLIP_HTML = `
<div class="proof-compact-container">
  <div class="proof-compact-header">
    <div class="proof-logo-text">{{companyName}}</div>
    <div class="proof-badge-stamp">VERIFIED REFERENCE</div>
  </div>
  <div class="proof-main-code">{{productCode}} <span class="proof-rev">{{revision}}</span></div>
  <div class="proof-desc">{{description}}</div>
  
  <table class="proof-table">
    <tr>
      <td class="lbl">TYPE:</td>
      <td class="val">{{materialType}}</td>
      <td class="lbl">CAT:</td>
      <td class="val">{{category}}</td>
    </tr>
    <tr>
      <td class="lbl">DATE:</td>
      <td class="val">{{registrationDate}}</td>
      <td class="lbl">INSPECTOR:</td>
      <td class="val">{{registeredBy}}</td>
    </tr>
    <tr>
      <td class="lbl">SERIAL:</td>
      <td class="val" colspan="3">{{proofSerial}}</td>
    </tr>
  </table>

  <div class="proof-spec-preview">
    <strong>SPECS:</strong> {{specification}}
  </div>

  <div class="proof-sign-row">
    <div>
      <div class="lbl">INSPECTOR SIGNATURE:</div>
      <div class="sig-line">{{registeredBy}} ({{registeredById}})</div>
    </div>
    <div>
      <div class="lbl">AUTHORIZED QA:</div>
      <div class="sig-line">{{approvedBy}}</div>
    </div>
  </div>
</div>
`;

export const COMPACT_INSPECTION_SLIP_CSS = `
.proof-compact-container {
  width: 100%;
  max-width: 380px;
  margin: 0 auto;
  border: 1.5px solid #000;
  padding: 12px;
  font-family: 'Courier New', Courier, monospace;
  font-size: 10px;
  background: #fff;
  color: #000;
}
.proof-compact-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-bottom: 1.5px solid #000;
  padding-bottom: 4px;
  margin-bottom: 6px;
}
.proof-logo-text {
  font-size: 8.5px;
  font-weight: bold;
  text-transform: uppercase;
}
.proof-badge-stamp {
  font-size: 8px;
  font-weight: bold;
  border: 1px solid #000;
  padding: 1px 4px;
}
.proof-main-code {
  font-size: 15px;
  font-weight: bold;
  letter-spacing: 0.5px;
}
.proof-rev {
  font-size: 10px;
  border: 1px solid #000;
  padding: 0 4px;
  margin-left: 6px;
}
.proof-desc {
  font-size: 10px;
  margin: 4px 0 8px 0;
  font-family: sans-serif;
}
.proof-table {
  width: 100%;
  border-collapse: collapse;
  margin-bottom: 6px;
}
.proof-table td {
  padding: 2px 4px;
  border: 1px solid #ccc;
  font-size: 9px;
}
.proof-table .lbl {
  font-weight: bold;
  background: #f2f2f2;
  width: 20%;
}
.proof-spec-preview {
  font-size: 9px;
  background: #fafafa;
  border: 1px solid #eee;
  padding: 4px;
  margin-bottom: 6px;
  max-height: 45px;
  overflow: hidden;
}
.proof-sign-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
  border-top: 1px dashed #000;
  padding-top: 6px;
  font-size: 8.5px;
}
.sig-line {
  border-bottom: 1px solid #999;
  padding-top: 4px;
  font-weight: bold;
}
`;

export const DEFAULT_MATERIAL_SHEET_HTML = `
<div class="sheet-container">
  <div class="sheet-header">
    <div class="sheet-title-box">
      <div class="sheet-company">{{companyName}}</div>
      <div class="sheet-main-title">MATERIAL REFERENCE & SAMPLE SPECIFICATION SHEET</div>
      <div class="sheet-sub">Quality Assurance & Technical Reference Registry</div>
    </div>
    <div class="sheet-badge-box">
      <div class="sheet-badge-title">MATERIAL CODE</div>
      <div class="sheet-badge-code">{{productCode}}</div>
      <div class="sheet-badge-rev">{{revision}}</div>
    </div>
  </div>

  <table class="sheet-table">
    <thead>
      <tr>
        <th colspan="4">1. MATERIAL IDENTIFICATION & CLASSIFICATION</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td class="label-col">Material Code</td>
        <td class="val-col font-bold">{{productCode}}</td>
        <td class="label-col">Material Type</td>
        <td class="val-col">{{materialType}}</td>
      </tr>
      <tr>
        <td class="label-col">Description</td>
        <td class="val-col" colspan="3">{{description}}</td>
      </tr>
      <tr>
        <td class="label-col">Category</td>
        <td class="val-col">{{category}}</td>
        <td class="label-col">Reference Unit</td>
        <td class="val-col">{{unit}}</td>
      </tr>
      <tr>
        <td class="label-col">Master Status</td>
        <td class="val-col">{{itemStatus}}</td>
        <td class="label-col">Registration ID</td>
        <td class="val-col font-mono">{{registrationId}}</td>
      </tr>
    </tbody>
  </table>

  <table class="sheet-table">
    <thead>
      <tr>
        <th colspan="4">2. QA REGISTRATION & SOURCE SPECIFICATIONS</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td class="label-col">Registered By</td>
        <td class="val-col">{{registeredBy}} ({{registeredById}})</td>
        <td class="label-col">Registration Date</td>
        <td class="val-col">{{registrationDate}}</td>
      </tr>
      <tr>
        <td class="label-col">Supplier / Source</td>
        <td class="val-col" colspan="3">{{supplier}}</td>
      </tr>
      <tr>
        <td class="label-col">Technical Specification</td>
        <td class="val-col" colspan="3">{{specification}}</td>
      </tr>
      <tr>
        <td class="label-col">Remarks / Quality Notes</td>
        <td class="val-col" colspan="3">{{remarks}}</td>
      </tr>
      <tr>
        <td class="label-col">Inspection Status</td>
        <td class="val-col font-bold" colspan="3">{{inspectionResult}}</td>
      </tr>
    </tbody>
  </table>

  <table class="sheet-table sign-table">
    <thead>
      <tr>
        <th colspan="2">3. QUALITY AUTHORIZATION & SIGN-OFF</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td style="width: 50%;">
          <div class="sign-block">
            <div class="sign-title">PREPARED BY (QA INSPECTOR):</div>
            <div class="sign-person">{{registeredBy}}</div>
            <div class="sign-meta">ID: {{registeredById}} • Date: {{registrationDate}}</div>
            <div class="sign-underline">{{inspectorSignature}}</div>
          </div>
        </td>
        <td style="width: 50%;">
          <div class="sign-block">
            <div class="sign-title">CHECKED & APPROVED BY (QA ADMIN):</div>
            <div class="sign-person">{{approvedBy}}</div>
            <div class="sign-meta">Date: {{approvalDate}} • Department: {{department}}</div>
            <div class="sign-underline">{{adminSignature}}</div>
          </div>
        </td>
      </tr>
    </tbody>
  </table>

  <div class="sheet-footer">
    <span>Document Ref: MRS-{{productCode}}-{{revision}}</span>
    <span>Generated: {{todayDateTime}}</span>
    <span>Page 1 of 1</span>
  </div>
</div>
`;

export const DEFAULT_MATERIAL_SHEET_CSS = `
.sheet-container {
  width: 100%;
  max-width: 800px;
  margin: 0 auto;
  background: #ffffff;
  color: #0f172a;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
  font-size: 11px;
  line-height: 1.4;
  padding: 24px;
  border: 1px solid #cbd5e1;
  box-sizing: border-box;
}
.sheet-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  border-bottom: 2px solid #0f172a;
  padding-bottom: 12px;
  margin-bottom: 16px;
}
.sheet-company {
  font-size: 10px;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 1px;
  color: #64748b;
}
.sheet-main-title {
  font-size: 16px;
  font-weight: 900;
  color: #0f172a;
  margin: 3px 0;
}
.sheet-sub {
  font-size: 10px;
  color: #64748b;
}
.sheet-badge-box {
  text-align: right;
  background: #f1f5f9;
  border: 1px solid #cbd5e1;
  padding: 8px 12px;
  border-radius: 6px;
}
.sheet-badge-title {
  font-size: 8px;
  font-weight: 800;
  color: #64748b;
}
.sheet-badge-code {
  font-size: 14px;
  font-weight: 900;
  font-family: monospace;
  color: #0f172a;
}
.sheet-badge-rev {
  display: inline-block;
  background: #0f172a;
  color: #fff;
  font-size: 9px;
  font-weight: bold;
  padding: 1px 6px;
  border-radius: 3px;
  margin-top: 2px;
}
.sheet-table {
  width: 100%;
  border-collapse: collapse;
  margin-bottom: 14px;
}
.sheet-table th {
  background: #0f172a;
  color: #ffffff;
  text-align: left;
  font-size: 9px;
  font-weight: 800;
  letter-spacing: 0.5px;
  padding: 5px 8px;
  text-transform: uppercase;
}
.sheet-table td {
  border: 1px solid #cbd5e1;
  padding: 6px 8px;
  font-size: 10.5px;
}
.label-col {
  background: #f8fafc;
  font-weight: 700;
  color: #475569;
  width: 22%;
}
.val-col {
  color: #0f172a;
}
.font-bold {
  font-weight: 700;
}
.font-mono {
  font-family: monospace;
}
.sign-table td {
  padding: 12px;
  background: #f8fafc;
}
.sign-block {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.sign-title {
  font-size: 8.5px;
  font-weight: 800;
  color: #64748b;
  text-transform: uppercase;
}
.sign-person {
  font-size: 11px;
  font-weight: 700;
  color: #0f172a;
}
.sign-meta {
  font-size: 9px;
  color: #64748b;
  font-family: monospace;
}
.sign-underline {
  margin-top: 8px;
  font-family: monospace;
  font-size: 9px;
  color: #94a3b8;
}
.sheet-footer {
  margin-top: 14px;
  padding-top: 8px;
  border-top: 1px solid #cbd5e1;
  display: flex;
  justify-content: space-between;
  font-size: 8.5px;
  font-family: monospace;
  color: #64748b;
}
`;

// Initial default templates seeded in the database
export const INITIAL_FORM_TEMPLATES: FormTemplate[] = [
  // 1. Material Reference Sheet - Default Built-In (DOCX / Print)
  {
    id: 'tpl-mat-ref-default',
    name: 'Standard Technical Material Reference Document (Default)',
    description: 'Official comprehensive technical reference document layout with full specifications, custom fields, and sign-off blocks.',
    formType: 'material_reference_sheet',
    version: '1.0.0',
    isActive: true,
    fileType: 'docx',
    fileName: 'Official_Material_Reference_Template_v2.docx',
    fieldMappings: {
      '{{productCode}}': 'productCode',
      '{{description}}': 'description',
      '{{materialType}}': 'materialType',
      '{{materialTypeCode}}': 'materialTypeCode',
      '{{category}}': 'category',
      '{{unit}}': 'unit',
      '{{itemStatus}}': 'itemStatus',
      '{{revision}}': 'revision',
      '{{registeredBy}}': 'registeredBy',
      '{{registeredById}}': 'registeredById',
      '{{registrationDate}}': 'registrationDate',
      '{{registrationId}}': 'registrationId',
      '{{supplier}}': 'supplier',
      '{{specification}}': 'specification',
      '{{remarks}}': 'remarks',
      '{{inspectionResult}}': 'inspectionResult',
      '{{checkedBy}}': 'checkedBy',
      '{{approvedBy}}': 'approvedBy',
      '{{approvalDate}}': 'approvalDate',
      '{{inspectorSignature}}': 'inspectorSignature',
      '{{adminSignature}}': 'adminSignature',
      '{{companyName}}': 'companyName',
      '{{department}}': 'department',
      '{{todayDate}}': 'todayDate',
      '{{todayDateTime}}': 'todayDateTime'
    },
    createdAt: '2026-08-15T08:00:00.000Z',
    updatedAt: '2026-08-20T08:00:00.000Z',
    createdBy: 'System Administrator',
    isBuiltIn: true
  },
  // 2. Material Reference Sheet - Clean Tabular Specification Sheet (HTML / Export)
  {
    id: 'tpl-mat-ref-html-std',
    name: 'ISO-Compliant Clean Tabular Reference Sheet',
    description: 'Structured, print-optimized A4 technical sheet with high-contrast borders and clear section hierarchy.',
    formType: 'material_reference_sheet',
    version: '1.2.0',
    isActive: false,
    fileType: 'html',
    fileName: 'ISO_Material_Reference_Sheet.html',
    fileContent: DEFAULT_MATERIAL_SHEET_HTML,
    customCss: DEFAULT_MATERIAL_SHEET_CSS,
    fieldMappings: {
      '{{productCode}}': 'productCode',
      '{{description}}': 'description',
      '{{materialType}}': 'materialType',
      '{{category}}': 'category',
      '{{unit}}': 'unit',
      '{{itemStatus}}': 'itemStatus',
      '{{revision}}': 'revision',
      '{{registeredBy}}': 'registeredBy',
      '{{registeredById}}': 'registeredById',
      '{{registrationDate}}': 'registrationDate',
      '{{registrationId}}': 'registrationId',
      '{{supplier}}': 'supplier',
      '{{specification}}': 'specification',
      '{{remarks}}': 'remarks',
      '{{inspectionResult}}': 'inspectionResult',
      '{{approvedBy}}': 'approvedBy',
      '{{approvalDate}}': 'approvalDate',
      '{{inspectorSignature}}': 'inspectorSignature',
      '{{adminSignature}}': 'adminSignature',
      '{{companyName}}': 'companyName',
      '{{department}}': 'department',
      '{{todayDateTime}}': 'todayDateTime'
    },
    createdAt: '2026-08-16T10:00:00.000Z',
    updatedAt: '2026-08-20T10:00:00.000Z',
    createdBy: 'System Administrator',
    isBuiltIn: false
  },

  // 3. Inspection Proof Slip - Default Built-In (Official Verification Card)
  {
    id: 'tpl-insp-slip-default',
    name: 'Official Compact Inspection Proof Slip (Default)',
    description: 'Standard dual-signoff inspection proof slip with material classification, verification serial number, and timestamp.',
    formType: 'inspection_proof_slip',
    version: '1.0.0',
    isActive: true,
    fileType: 'html',
    fileName: 'Official_Inspection_Proof_Slip.html',
    fileContent: DEFAULT_INSPECTION_SLIP_HTML,
    customCss: DEFAULT_INSPECTION_SLIP_CSS,
    fieldMappings: {
      '{{companyName}}': 'companyName',
      '{{proofSerial}}': 'proofSerial',
      '{{registrationDate}}': 'registrationDate',
      '{{productCode}}': 'productCode',
      '{{revision}}': 'revision',
      '{{description}}': 'description',
      '{{category}}': 'category',
      '{{materialType}}': 'materialType',
      '{{unit}}': 'unit',
      '{{supplier}}': 'supplier',
      '{{specification}}': 'specification',
      '{{remarks}}': 'remarks',
      '{{inspectionResult}}': 'inspectionResult',
      '{{registeredBy}}': 'registeredBy',
      '{{registeredById}}': 'registeredById',
      '{{approvedBy}}': 'approvedBy',
      '{{checkedById}}': 'checkedById',
      '{{inspectorSignature}}': 'inspectorSignature',
      '{{adminSignature}}': 'adminSignature',
      '{{department}}': 'department',
      '{{todayDateTime}}': 'todayDateTime'
    },
    createdAt: '2026-08-15T08:00:00.000Z',
    updatedAt: '2026-08-21T09:00:00.000Z',
    createdBy: 'System Administrator',
    isBuiltIn: true
  },
  // 4. Inspection Proof Slip - High-Density Monospace QA Card
  {
    id: 'tpl-insp-slip-compact',
    name: 'High-Density Monospace QA Verification Card',
    description: 'Compact stamp-sized receipt-style card with boxed borders for fast label printer or standard adhesive slip printing.',
    formType: 'inspection_proof_slip',
    version: '1.1.0',
    isActive: false,
    fileType: 'html',
    fileName: 'Monospace_Compact_Proof_Card.html',
    fileContent: COMPACT_INSPECTION_SLIP_HTML,
    customCss: COMPACT_INSPECTION_SLIP_CSS,
    fieldMappings: {
      '{{companyName}}': 'companyName',
      '{{proofSerial}}': 'proofSerial',
      '{{registrationDate}}': 'registrationDate',
      '{{productCode}}': 'productCode',
      '{{revision}}': 'revision',
      '{{description}}': 'description',
      '{{category}}': 'category',
      '{{materialType}}': 'materialType',
      '{{specification}}': 'specification',
      '{{registeredBy}}': 'registeredBy',
      '{{registeredById}}': 'registeredById',
      '{{approvedBy}}': 'approvedBy'
    },
    createdAt: '2026-08-17T11:00:00.000Z',
    updatedAt: '2026-08-21T11:00:00.000Z',
    createdBy: 'System Administrator',
    isBuiltIn: false
  }
];

/**
 * Builds a key-value dictionary of all available system data for a given reference registration.
 */
export function buildSystemDataDictionary(
  registration?: ReferenceRegistration,
  masterItem?: MasterItem,
  config?: AppConfig,
  customAdminName?: string
): Record<string, string> {
  const reg = registration || {
    id: 'ref-sample-001',
    masterItemId: 'item-sample',
    productCode: 'RM-SS-304-001',
    materialType: 'RM',
    category: 'Sheet Metal',
    registrationDate: new Date().toISOString().split('T')[0],
    registeredBy: 'Juan Dela Cruz',
    supplier: 'Apex Metal Alloys Inc.',
    specification: 'ASTM A240 standard. Chemical composition: Cr 18.2%, Ni 8.1%, C <= 0.07%. Surface roughness Ra <= 0.4um. Mill test certificate attached. Verified non-magnetic and passivated.',
    remarks: 'Approved standard reference sample for batch acceptance testing in stamping line.',
    revision: 'Rev 01',
    customFields: {},
    photos: [],
    attachments: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  const master = masterItem || {
    id: 'item-sample',
    productCode: reg.productCode || 'RM-SS-304-001',
    description: 'Stainless Steel Sheet 304 Grade 2B Finish 1.5mm',
    materialType: (reg.materialType || 'RM') as any,
    category: reg.category || 'Sheet Metal',
    status: 'Active',
    unit: 'Sheet (1220x2440mm)',
    createdAt: '2026-08-15',
    updatedAt: '2026-08-20'
  };

  const cfg = config || {
    companyName: 'Precision Industrial Manufacturing Corp.',
    appName: 'Material Reference & Sample Tracking System',
    defaultRegisteredBy: 'Juan Dela Cruz'
  };

  const matTypeCode = reg.materialType || master.materialType || (master.category === 'PS' ? 'PS' : 'RM');
  const matTypeFull = matTypeCode === 'PS' ? 'Production Supply (PS)' : 'Raw Material (RM)';
  const proofSerial = `IP-${(reg.productCode || 'REF').replace(/[^a-zA-Z0-9]/g, '')}-${(reg.id || '000000').slice(-6)}`;
  const empId = `EMP-${reg.registeredBy ? reg.registeredBy.replace(/[^a-zA-Z0-9]/g, '').slice(0, 4).toUpperCase() : 'QA01'}`;
  const now = new Date();
  const dateStr = reg.registrationDate || now.toISOString().split('T')[0];
  const timeStr = now.toLocaleTimeString();

  const primaryPhoto = (reg.photos || []).find(p => p.isPrimary) || (reg.photos || [])[0];

  const dict: Record<string, string> = {
    productCode: reg.productCode || master.productCode || 'RM-SS-304-001',
    description: master.description || reg.specification || 'Standard Reference Specimen',
    materialType: matTypeFull,
    materialTypeCode: matTypeCode,
    category: reg.category || master.category || 'General',
    unit: master.unit || 'Piece',
    itemStatus: master.status || 'Active',
    itemCreatedAt: master.createdAt ? master.createdAt.split('T')[0] : '2026-08-15',
    registrationId: reg.id || 'REF-001',
    proofSerial: proofSerial,
    revision: reg.revision || 'Rev 01',
    registrationDate: dateStr,
    registeredBy: reg.registeredBy || cfg.defaultRegisteredBy || 'QA Inspector',
    registeredById: empId,
    supplier: reg.supplier || 'Standard Approved Vendor',
    specification: reg.specification || 'Conforms to manufacturer technical specifications and ISO 9001 quality criteria.',
    remarks: reg.remarks || 'Standard QA reference specimen on active archive.',
    inspectionResult: 'VERIFIED & CONFORMANT',
    checkedBy: 'JD. Stone (QA Supervisor)',
    checkedById: 'ADM-001',
    approvedBy: customAdminName || 'Maria Santos (QA Admin)',
    approvalDate: dateStr,
    inspectorSignature: '___________________________ (Sign & Date)',
    adminSignature: '___________________________ (Sign & Date)',
    companyName: cfg.companyName || 'Precision Industrial Manufacturing Corp.',
    department: 'Quality Assurance & Materials Engineering',
    todayDate: dateStr,
    todayDateTime: `${dateStr} ${timeStr}`,
    printTimestamp: timeStr,
    photosCount: String((reg.photos || []).length),
    primaryPhotoUrl: primaryPhoto?.dataUrl || `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300" viewBox="0 0 400 300"><rect width="400" height="300" fill="%231E1E1E" rx="8" stroke="%23333333" stroke-width="2"/><rect x="130" y="70" width="140" height="110" fill="none" stroke="%23555555" stroke-width="2" rx="4"/><circle cx="170" cy="110" r="15" fill="none" stroke="%23555555" stroke-width="2"/><path d="M135 175 L180 135 L215 165 L245 140 L265 175" fill="none" stroke="%23555555" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/><text x="200" y="215" font-family="sans-serif" font-size="12" fill="%23888888" text-anchor="middle" font-weight="bold">NO SPECIMEN PHOTO UPLOADED</text><text x="200" y="235" font-family="sans-serif" font-size="10" fill="%23555555" text-anchor="middle">Standard Quality Reference Sample</text></svg>`
  };

  // Map custom dynamic fields
  if (reg.customFields) {
    Object.entries(reg.customFields).forEach(([k, v]) => {
      const strVal = typeof v === 'boolean' ? (v ? 'YES' : 'NO') : String(v ?? '');
      dict[k] = strVal;
    });
  }

  return dict;
}

/**
 * Extracts all placeholder tokens like {{tagName}} from a template string.
 */
export function extractPlaceholdersFromContent(content: string): string[] {
  if (!content) return [];
  const regex = /\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g;
  const matches = new Set<string>();
  let match;
  while ((match = regex.exec(content)) !== null) {
    matches.add(`{{${match[1]}}}`);
  }
  return Array.from(matches);
}

/**
 * Validates whether all required system fields are mapped for a specific form type.
 */
export function validateTemplateMappings(
  mappings: Record<string, string>,
  formType: FormType
): { isValid: boolean; missingRequired: string[]; mappedCount: number } {
  const required = REQUIRED_FIELDS_BY_TYPE[formType] || [];
  const mappedSystemKeys = new Set(Object.values(mappings));

  const missingRequired = required.filter(reqKey => !mappedSystemKeys.has(reqKey));
  return {
    isValid: missingRequired.length === 0,
    missingRequired,
    mappedCount: Object.keys(mappings).length
  };
}

/**
 * Renders an HTML template string by substituting all placeholders with the provided data dictionary and field mappings.
 */
export function renderHtmlTemplateWithData(
  templateHtml: string,
  dataDict: Record<string, string>,
  fieldMappings: Record<string, string> = {},
  customCss?: string
): string {
  if (!templateHtml) return '';

  let rendered = templateHtml;

  // 1. Process conditional blocks like {{#remarks}} ... {{/remarks}}
  rendered = rendered.replace(/\{\{#([a-zA-Z0-9_]+)\}\}([\s\S]*?)\{\{\/\1\}\}/g, (_, fieldKey, blockContent) => {
    // Find mapped system key or direct key
    const directTag = `{{${fieldKey}}}`;
    const sysKey = fieldMappings[directTag] || fieldKey;
    const val = dataDict[sysKey] || dataDict[fieldKey];
    if (val && val.trim().length > 0 && val !== 'None' && val !== 'N/A') {
      return blockContent;
    }
    return '';
  });

  // 2. Map all placeholders using configured fieldMappings and fallback direct matches
  const placeholders = extractPlaceholdersFromContent(rendered);

  placeholders.forEach((tag) => {
    const rawKey = tag.replace(/[\{\}\s]/g, '');
    const mappedSystemKey = fieldMappings[tag] || rawKey;
    const value = dataDict[mappedSystemKey] !== undefined ? dataDict[mappedSystemKey] : (dataDict[rawKey] || '');
    
    const escapedValue = String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

    const tagRegex = new RegExp(`\\{\\{\\s*${rawKey}\\s*\\}\\}`, 'g');
    rendered = rendered.replace(tagRegex, escapedValue);
  });

  if (customCss) {
    return `<style>${customCss}</style>\n${rendered}`;
  }
  return rendered;
}

export const SYSTEM_FIELD_OPTIONS = SYSTEM_FORM_FIELDS;
export const DEFAULT_TEMPLATES = INITIAL_FORM_TEMPLATES;

