import * as XLSX from 'xlsx';
import { MasterItem, ReferenceRegistration, ExcelImportRow, ItemCategory, ItemStatus, MaterialType } from '../types';
import { db } from './db';
import { tauriBridge } from './tauriService';

export const excelService = {
  /**
   * Parses an Excel buffer, strictly ignoring any Inventory Level / Stock columns,
   * validating fields, and detecting duplicates against existing Master Items.
   */
  async parseAndValidateExcel(buffer: ArrayBuffer): Promise<{
    rows: ExcelImportRow[];
    totalRows: number;
    validRowsCount: number;
    existingCount: number;
    newCount: number;
    ignoredColumns: string[];
    detectedColumns: string[];
  }> {
    const workbook = XLSX.read(buffer, { type: 'array' });
    const firstSheetName = workbook.SheetNames[0];
    if (!firstSheetName) {
      throw new Error('The selected Excel file contains no worksheets.');
    }

    const sheet = workbook.Sheets[firstSheetName];
    const rawRows: any[] = XLSX.utils.sheet_to_json(sheet, { defval: '' });

    if (rawRows.length === 0) {
      throw new Error('The selected Excel sheet has no data rows.');
    }

    const existingMasterItems = await db.getMasterItems();
    const existingCodeMap = new Map<string, MasterItem>();
    existingMasterItems.forEach((item) => {
      existingCodeMap.set(item.productCode.trim().toLowerCase(), item);
    });

    const headers = Object.keys(rawRows[0] || {});
    const ignoredColumns: string[] = [];
    const detectedColumns: string[] = [...headers];

    // Helper to find header key matching candidate names
    const findHeader = (candidates: string[]): string | undefined => {
      return headers.find((h) => {
        const clean = h.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
        return candidates.some((c) => clean === c.toLowerCase().replace(/[^a-z0-9]/g, ''));
      });
    };

    const codeHeader = findHeader(['productcode', 'product_code', 'itemcode', 'materialcode', 'code', 'partnumber', 'part_no', 'itemno']);
    const descHeader = findHeader(['description', 'materialdescription', 'itemdescription', 'itemname', 'name', 'details']);
    const materialTypeHeader = findHeader(['materialtype', 'material_type', 'rmps', 'rm_ps', 'type', 'itemtype']);
    const catHeader = findHeader(['category', 'itemcategory', 'group', 'class', 'classification']);
    const statusHeader = findHeader(['status', 'activestatus', 'state', 'activeinactive', 'isactive']);
    const unitHeader = findHeader(['unit', 'uom', 'unitofmeasure', 'measure', 'packaging', 'pkg']);

    // Check for ignored inventory columns to notify user
    headers.forEach((h) => {
      const lower = h.toLowerCase();
      if (
        lower.includes('inventory') ||
        lower.includes('stock') ||
        lower.includes('qty') ||
        lower.includes('quantity') ||
        lower.includes('balance') ||
        lower.includes('onhand') ||
        lower.includes('warehouse') ||
        lower.includes('reorder')
      ) {
        ignoredColumns.push(h);
      }
    });

    const parsedRows: ExcelImportRow[] = [];
    let validRowsCount = 0;
    let existingCount = 0;
    let newCount = 0;

    rawRows.forEach((row, index) => {
      const rowNum = index + 2; // Excel 1-based index with header at row 1
      const errors: string[] = [];

      // 1. Product Code
      const rawCode = codeHeader ? String(row[codeHeader] || '').trim() : String(row['Product Code'] || row['Code'] || Object.values(row)[0] || '').trim();
      if (!rawCode) {
        errors.push('Missing Product Code');
      }

      // 2. Description
      const rawDesc = descHeader ? String(row[descHeader] || '').trim() : String(row['Description'] || row['Desc'] || Object.values(row)[1] || '').trim();
      if (!rawDesc) {
        errors.push('Missing Description');
      }

      // 3. Material Type (RM or PS)
      let materialType: MaterialType = 'RM';
      const rawMatType = materialTypeHeader ? String(row[materialTypeHeader] || '').trim().toUpperCase() : '';
      if (rawMatType.includes('PS') || rawMatType.includes('PRODUCTION') || rawMatType.includes('SUPPLY') || rawMatType.includes('SUPPLIES')) {
        materialType = 'PS';
      } else if (rawMatType.includes('RM') || rawMatType.includes('RAW') || rawMatType.includes('MATERIAL')) {
        materialType = 'RM';
      } else if (rawCode.toUpperCase().startsWith('PS-') || rawCode.toUpperCase().startsWith('PS_')) {
        materialType = 'PS';
      } else {
        materialType = 'RM';
      }

      // 4. Dynamic Category (Box, Tape, Corrugated, Sheet Metal, etc.)
      let category = 'Box';
      const rawCat = catHeader ? String(row[catHeader] || '').trim() : '';
      if (rawCat && rawCat.toUpperCase() !== 'RM' && rawCat.toUpperCase() !== 'PS') {
        category = rawCat;
      } else if (materialType === 'PS') {
        category = 'Packaging';
      } else {
        category = 'Sheet Metal';
      }

      // 5. Status (Active or Inactive)
      let status: ItemStatus = 'Active';
      const rawStatus = statusHeader ? String(row[statusHeader] || '').trim().toLowerCase() : '';
      if (rawStatus === 'inactive' || rawStatus === 'i' || rawStatus === '0' || rawStatus === 'false' || rawStatus === 'disabled' || rawStatus === 'n') {
        status = 'Inactive';
      } else {
        status = 'Active';
      }

      // 6. Unit (Reference information only)
      const rawUnit = unitHeader ? String(row[unitHeader] || '').trim() : String(row['Unit'] || row['UOM'] || '').trim();

      const isExisting = rawCode ? existingCodeMap.has(rawCode.toLowerCase()) : false;
      const existingItem = rawCode ? existingCodeMap.get(rawCode.toLowerCase()) : undefined;

      const isValid = errors.length === 0;
      if (isValid) {
        validRowsCount++;
        if (isExisting) existingCount++;
        else newCount++;
      }

      parsedRows.push({
        rowNumber: rowNum,
        productCode: rawCode,
        description: rawDesc,
        materialType,
        category,
        status,
        unit: rawUnit || (materialType === 'RM' ? 'Unit' : 'Piece'),
        isValid,
        errors,
        isExisting,
        existingId: existingItem?.id
      });
    });

    return {
      rows: parsedRows,
      totalRows: parsedRows.length,
      validRowsCount,
      existingCount,
      newCount,
      ignoredColumns,
      detectedColumns
    };
  },

  /**
   * Generates a sample Excel template for users to download and populate
   */
  generateSampleTemplate(): void {
    const templateData = [
      {
        'Product Code': 'RM-SS-304-SHEET',
        'Description': 'Stainless Steel Sheet 304 2B Finish 1.5mm',
        'Material Type': 'RM',
        'Category': 'Sheet Metal',
        'Status': 'Active',
        'Unit': 'Sheet'
      },
      {
        'Product Code': 'RM-AL-6061-BAR',
        'Description': 'Aluminum Alloy Bar 6061-T6 50mm Square',
        'Material Type': 'RM',
        'Category': 'Bar Stock',
        'Status': 'Active',
        'Unit': 'Length'
      },
      {
        'Product Code': 'PS-BOX-CORR-01',
        'Description': 'Corrugated Shipping Box Double Wall 12x12x12',
        'Material Type': 'PS',
        'Category': 'Box',
        'Status': 'Active',
        'Unit': 'Piece'
      },
      {
        'Product Code': 'PS-TAPE-ACRYL-48',
        'Description': 'Heavy Duty Acrylic Packaging Tape 48mm Clear',
        'Material Type': 'PS',
        'Category': 'Tape',
        'Status': 'Active',
        'Unit': 'Roll'
      },
      {
        'Product Code': 'PS-OIL-SYN-46',
        'Description': 'Synthetic Industrial Lubricant ISO VG 46',
        'Material Type': 'PS',
        'Category': 'Lubricant & Oil',
        'Status': 'Active',
        'Unit': 'Drum'
      }
    ];

    const worksheet = XLSX.utils.json_to_sheet(templateData);
    // Set column widths
    worksheet['!cols'] = [
      { wch: 22 }, // Product Code
      { wch: 45 }, // Description
      { wch: 16 }, // Material Type
      { wch: 20 }, // Category
      { wch: 14 }, // Status
      { wch: 14 }  // Unit
    ];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Master Reference Items');

    const wbout = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
    const blob = new Blob([wbout], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    tauriBridge.saveFileBlob(blob, 'Master_Material_Reference_Template.xlsx');
  },

  /**
   * Exports Master Items list to clean Excel (.xlsx) with ZERO inventory columns
   */
  exportMasterItems(items: MasterItem[], filename = 'Master_Material_Reference_List.xlsx'): void {
    const exportRows = items.map((item) => ({
      'Product Code': item.productCode,
      'Description': item.description,
      'Material Type': item.materialType === 'RM' ? 'Raw Material (RM)' : 'Production Supply (PS)',
      'Category': item.category || (item.materialType === 'RM' ? 'Sheet Metal' : 'Packaging'),
      'Status': item.status,
      'Unit (Ref)': item.unit || '-',
      'Created Date': item.createdAt ? item.createdAt.split('T')[0] : '-',
      'Last Modified': item.updatedAt ? item.updatedAt.split('T')[0] : '-'
    }));

    const worksheet = XLSX.utils.json_to_sheet(exportRows);
    worksheet['!cols'] = [
      { wch: 24 },
      { wch: 55 },
      { wch: 26 },
      { wch: 22 },
      { wch: 14 },
      { wch: 16 },
      { wch: 16 },
      { wch: 16 }
    ];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Master Items');

    const wbout = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
    const blob = new Blob([wbout], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    tauriBridge.saveFileBlob(blob, filename);
  },

  /**
   * Exports Registered Samples report to Excel (.xlsx)
   */
  exportRegistrations(
    registrations: ReferenceRegistration[],
    masterItems: MasterItem[],
    filename = 'Registered_Material_References_Report.xlsx'
  ): void {
    const masterMap = new Map(masterItems.map((m) => [m.productCode.toLowerCase(), m]));

    const exportRows = registrations.map((r) => {
      const master = masterMap.get(r.productCode.toLowerCase());
      return {
        'Product Code': r.productCode,
        'Description': master?.description || '-',
        'Category': master?.category === 'RM' ? 'Raw Material' : 'Production Supply',
        'Revision': r.revision,
        'Registration Date': r.registrationDate,
        'Registered By': r.registeredBy,
        'Supplier / Source': r.supplier || '-',
        'Specifications': r.specification || '-',
        'Remarks / Quality Notes': r.remarks || '-',
        'Photos Count': r.photos?.length || 0,
        'Attachments Count': r.attachments?.length || 0,
        'Word Form Status': r.wordFormGenerated ? 'Generated' : 'Pending',
        'Created Timestamp': r.createdAt
      };
    });

    const worksheet = XLSX.utils.json_to_sheet(exportRows);
    worksheet['!cols'] = [
      { wch: 22 },
      { wch: 45 },
      { wch: 18 },
      { wch: 12 },
      { wch: 16 },
      { wch: 20 },
      { wch: 24 },
      { wch: 40 },
      { wch: 35 },
      { wch: 14 },
      { wch: 16 },
      { wch: 16 },
      { wch: 22 }
    ];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Registered Samples');

    const wbout = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
    const blob = new Blob([wbout], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    tauriBridge.saveFileBlob(blob, filename);
  },

  /**
   * Exports Complete Revision Audit History Log to Excel (.xlsx) for Quality Auditing & Compliance
   */
  exportRevisionAuditHistory(
    registrations: ReferenceRegistration[],
    masterItems: MasterItem[],
    filename = `Material_Reference_Revision_Audit_Log_${new Date().toISOString().split('T')[0]}.xlsx`
  ): void {
    const masterMap = new Map(masterItems.map((m) => [m.productCode.toLowerCase(), m]));

    const exportRows: any[] = [];

    registrations.forEach((reg) => {
      const master = masterMap.get(reg.productCode.toLowerCase());
      const versions = reg.versions || [];

      if (versions.length === 0) {
        // Fallback for baseline without explicit versions array
        exportRows.push({
          'Product Code': reg.productCode,
          'Description': master?.description || '-',
          'Category': master?.category || reg.category || 'RM',
          'Version Number': reg.currentVersionNumber || 1,
          'Revision Code': reg.revision,
          'Audit Status': reg.status || 'APPROVED',
          'Submitted By': reg.registeredBy,
          'Submitted Date': reg.registrationDate,
          'Approved By': reg.registeredBy,
          'Approved Date': reg.registrationDate,
          'Rejected By': '-',
          'Rejected Date': '-',
          'Revision Notes / Justification': 'Original baseline registration',
          'Supplier': reg.supplier || '-',
          'Specifications': reg.specification || '-',
          'Quality Remarks': reg.remarks || '-',
          'Photos Count': reg.photos?.length || 0,
          'Attachments Count': reg.attachments?.length || 0
        });
      } else {
        versions.forEach((ver) => {
          exportRows.push({
            'Product Code': ver.productCode || reg.productCode,
            'Description': master?.description || '-',
            'Category': master?.category || ver.category || reg.category || 'RM',
            'Version Number': ver.versionNumber,
            'Revision Code': ver.revisionCode,
            'Audit Status': ver.status,
            'Submitted By': ver.submittedBy || ver.registeredBy,
            'Submitted Date': ver.submittedAt ? new Date(ver.submittedAt).toLocaleDateString() : ver.registrationDate,
            'Approved By': ver.approvedBy || '-',
            'Approved Date': ver.approvedAt ? new Date(ver.approvedAt).toLocaleDateString() : '-',
            'Rejected By': ver.rejectedBy || '-',
            'Rejected Date': ver.rejectedAt ? new Date(ver.rejectedAt).toLocaleDateString() : '-',
            'Revision Notes / Justification': ver.revisionNotes || ver.changeSummary || 'Baseline reference registration',
            'Supplier': ver.supplier || reg.supplier || '-',
            'Specifications': ver.specification || '-',
            'Quality Remarks': ver.remarks || '-',
            'Photos Count': ver.photos?.length || 0,
            'Attachments Count': ver.attachments?.length || 0
          });
        });
      }
    });

    const worksheet = XLSX.utils.json_to_sheet(exportRows);
    worksheet['!cols'] = [
      { wch: 20 }, // Product Code
      { wch: 40 }, // Description
      { wch: 14 }, // Category
      { wch: 16 }, // Version Number
      { wch: 16 }, // Revision Code
      { wch: 18 }, // Audit Status
      { wch: 20 }, // Submitted By
      { wch: 16 }, // Submitted Date
      { wch: 20 }, // Approved By
      { wch: 16 }, // Approved Date
      { wch: 20 }, // Rejected By
      { wch: 16 }, // Rejected Date
      { wch: 45 }, // Revision Notes
      { wch: 24 }, // Supplier
      { wch: 45 }, // Specifications
      { wch: 35 }, // Quality Remarks
      { wch: 14 }, // Photos Count
      { wch: 16 }  // Attachments Count
    ];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Revision Audit Trail');

    const wbout = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
    const blob = new Blob([wbout], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    tauriBridge.saveFileBlob(blob, filename);
  },

  /**
   * Exports configured item categories to Excel (.xlsx) with usage metrics
   */
  exportCategories(
    categories: string[],
    masterItems: MasterItem[],
    registrations: ReferenceRegistration[],
    filename = `Material_Categories_List_${new Date().toISOString().split('T')[0]}.xlsx`
  ): void {
    const exportRows = categories.map((cat, idx) => {
      const trimmed = cat.trim();
      const masterCount = masterItems.filter((m) => m.category && m.category.trim().toLowerCase() === trimmed.toLowerCase()).length;
      const regCount = registrations.filter((r) => r.category && r.category.trim().toLowerCase() === trimmed.toLowerCase()).length;
      return {
        'No.': idx + 1,
        'Category Name': trimmed,
        'Associated Master Items': masterCount,
        'Associated Sample Registrations': regCount,
        'Total Active References': masterCount + regCount,
        'Usage Status': masterCount + regCount > 0 ? 'Active / In Use' : 'Unused'
      };
    });

    const worksheet = XLSX.utils.json_to_sheet(exportRows);
    worksheet['!cols'] = [
      { wch: 8 },  // No.
      { wch: 32 }, // Category Name
      { wch: 26 }, // Master items count
      { wch: 30 }, // Regs count
      { wch: 24 }, // Total Active
      { wch: 18 }  // Usage Status
    ];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Categories');

    const wbout = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
    const blob = new Blob([wbout], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    tauriBridge.saveFileBlob(blob, filename);
  },

  /**
   * Parses an Excel buffer for Category lists, extracting distinct Category Names
   */
  async parseCategoriesExcel(buffer: ArrayBuffer): Promise<string[]> {
    const workbook = XLSX.read(buffer, { type: 'array' });
    const firstSheetName = workbook.SheetNames[0];
    if (!firstSheetName) {
      throw new Error('The selected Excel file contains no worksheets.');
    }

    const sheet = workbook.Sheets[firstSheetName];
    const rawRows: any[] = XLSX.utils.sheet_to_json(sheet, { defval: '' });

    if (rawRows.length === 0) {
      throw new Error('The selected Excel sheet contains no data rows.');
    }

    const headers = Object.keys(rawRows[0] || {});
    // Find header key that matches Category Name (ignoring spaces/caps/special characters)
    const categoryNameHeader = headers.find((h) => {
      const clean = h.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
      return ['categoryname', 'category', 'name', 'categories', 'itemcategory', 'group', 'class', 'classification'].includes(clean);
    }) || headers.find((h) => h.toLowerCase().includes('category')) || headers[1] || headers[0];

    if (!categoryNameHeader) {
      throw new Error('Could not identify the category name column in the Excel file.');
    }

    const categoriesList: string[] = [];
    rawRows.forEach((row) => {
      const val = String(row[categoryNameHeader] || '').trim();
      if (val && val !== 'Category Name') { // Skip header names if they end up as data
        categoriesList.push(val);
      }
    });

    // Return unique categories, preserving casing
    const uniqueList: string[] = [];
    const seen = new Set<string>();
    categoriesList.forEach((cat) => {
      const lower = cat.toLowerCase();
      if (!seen.has(lower)) {
        seen.add(lower);
        uniqueList.push(cat);
      }
    });

    return uniqueList;
  }
};
