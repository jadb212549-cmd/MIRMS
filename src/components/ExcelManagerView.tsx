import React, { useState } from 'react';
import { MasterItem, ReferenceRegistration, ExcelImportRow, AppConfig } from '../types';
import { FileSpreadsheet, Upload, Download, CheckCircle2, AlertTriangle, XCircle, Database, ShieldCheck, ArrowRight, RefreshCw, FileText, Layers } from 'lucide-react';
import { excelService } from '../services/excelService';
import { tauriBridge } from '../services/tauriService';
import { db } from '../services/db';

interface ExcelManagerViewProps {
  masterItems: MasterItem[];
  registrations: ReferenceRegistration[];
  onRefreshData: () => Promise<void>;
  onNavigateTab?: (tab: any) => void;
  config?: AppConfig;
  onConfigChange?: (newConfig: Partial<AppConfig>) => Promise<void>;
}

export const ExcelManagerView: React.FC<ExcelManagerViewProps> = ({
  masterItems,
  registrations,
  onRefreshData,
  onNavigateTab
}) => {
  const [importResult, setImportResult] = useState<{
    rows: ExcelImportRow[];
    totalRows: number;
    validRowsCount: number;
    existingCount: number;
    newCount: number;
    ignoredColumns: string[];
    detectedColumns: string[];
  } | null>(null);

  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isCommitting, setIsCommitting] = useState(false);

  const handleSelectExcelFile = async () => {
    setErrorMessage(null);
    setSuccessMessage(null);
    setIsLoading(true);

    try {
      const fileRes = await tauriBridge.pickExcelFile();
      if (!fileRes || !fileRes.fileData) {
        setIsLoading(false);
        return;
      }

      const parsed = await excelService.parseAndValidateExcel(fileRes.fileData as ArrayBuffer);
      setImportResult(parsed);
    } catch (err: any) {
      console.error('Excel parse error:', err);
      setErrorMessage(err.message || 'Failed to read and parse Excel file.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleConfirmImport = async () => {
    if (!importResult) return;
    setIsCommitting(true);
    setErrorMessage(null);

    try {
      const validRows = importResult.rows.filter((r) => r.isValid);
      const rowsToImport = validRows.map((r) => ({
        productCode: r.productCode,
        description: r.description,
        materialType: r.materialType || 'RM',
        category: r.category,
        status: r.status,
        unit: r.unit || undefined
      }));

      const res = await db.bulkImportMasterItems(rowsToImport, 'Excel Import');
      await onRefreshData();

      setSuccessMessage(
        `Successfully imported ${res.importedCount} new master items and updated ${res.updatedCount} existing items. Inventory data was completely ignored as per architectural mandate.`
      );
      setImportResult(null);
    } catch (err: any) {
      console.error('Commit error:', err);
      setErrorMessage(err.message || 'Failed to commit master items to SQLite database.');
    } finally {
      setIsCommitting(false);
    }
  };

  return (
    <div className="space-y-6 select-none">
      {/* Overview Card */}
      <div className="bg-[#141414] rounded-xl border border-[#222] p-6 shadow-xs">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className="p-3 bg-[#1A1A1A] border border-[#2A2A2A] text-green-400 rounded-xl shrink-0">
              <FileSpreadsheet className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-base font-bold text-gray-100">
                Excel Master Material Reference Import & Export
              </h2>
              <p className="text-xs text-gray-400 mt-1 max-w-2xl leading-relaxed">
                Load master items from Excel spreadsheets into the local SQLite database. The Excel workbook is used strictly as a reference list of materials (Product Code, Description, Category, Status, and Unit).
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => excelService.generateSampleTemplate()}
              className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-gray-200 bg-[#222] hover:bg-[#2A2A2A] rounded-lg transition-colors border border-[#333]"
            >
              <Download className="w-4 h-4 text-gray-400" />
              <span>Download Master Template</span>
            </button>
            <button
              onClick={handleSelectExcelFile}
              disabled={isLoading}
              className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm transition-colors disabled:opacity-50"
            >
              <Upload className="w-4 h-4" />
              <span>{isLoading ? 'Reading File...' : 'Select Excel Workbook (.xlsx)'}</span>
            </button>
          </div>
        </div>

        {/* Feedback Messages */}
        {errorMessage && (
          <div className="mt-4 p-3 bg-red-500/10 border border-red-500/20 text-red-400 text-xs rounded-lg flex items-start gap-2">
            <XCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{errorMessage}</span>
          </div>
        )}

        {successMessage && (
          <div className="mt-4 p-3 bg-green-500/10 border border-green-500/20 text-green-400 text-xs rounded-lg flex items-start gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-green-400" />
            <div>
              <div className="font-bold">Import Completed Successfully</div>
              <p className="mt-0.5">{successMessage}</p>
            </div>
          </div>
        )}
      </div>

      {/* Import Preview Stage */}
      {importResult && (
        <div className="bg-[#141414] rounded-xl border border-[#222] shadow-md overflow-hidden">
          {/* Preview Header Bar */}
          <div className="bg-[#0A0A0A] border-b border-[#222] p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-gray-100">
                  Excel Import Verification & Duplicate Detection
                </h3>
                <span className="text-xs px-2 py-0.5 rounded font-mono font-semibold bg-[#222] text-blue-400 border border-blue-900/40">
                  {importResult.totalRows} Rows Evaluated
                </span>
              </div>
              <p className="text-xs text-gray-500 mt-1">
                Review verified master rows before committing changes to SQLite.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={() => setImportResult(null)}
                className="px-3 py-1.5 text-xs font-semibold text-gray-400 hover:text-gray-200 bg-[#1A1A1A] hover:bg-[#252525] rounded-lg border border-[#333] transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmImport}
                disabled={isCommitting || importResult.validRowsCount === 0}
                className="flex items-center gap-1.5 px-4 py-1.5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm transition-colors disabled:opacity-50"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>
                  {isCommitting
                    ? 'Saving to SQLite...'
                    : `Confirm Import (${importResult.newCount} New, ${importResult.existingCount} Updates)`}
                </span>
              </button>
            </div>
          </div>

          {/* Validation Metrics Banner */}
          <div className="p-4 bg-[#0E0E0E] border-b border-[#222] grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <div className="bg-[#161616] p-3 rounded-lg border border-[#222]">
              <span className="text-gray-500 text-[11px] block font-mono">Valid Rows</span>
              <strong className="text-green-400 text-sm font-bold font-mono">{importResult.validRowsCount}</strong>
            </div>
            <div className="bg-[#161616] p-3 rounded-lg border border-[#222]">
              <span className="text-gray-500 text-[11px] block font-mono">New Items to Insert</span>
              <strong className="text-blue-400 text-sm font-bold font-mono">{importResult.newCount}</strong>
            </div>
            <div className="bg-[#161616] p-3 rounded-lg border border-[#222]">
              <span className="text-gray-500 text-[11px] block font-mono">Existing Items to Update</span>
              <strong className="text-amber-400 text-sm font-bold font-mono">{importResult.existingCount}</strong>
            </div>
            <div className="bg-[#161616] p-3 rounded-lg border border-[#222]">
              <span className="text-gray-500 text-[11px] block font-mono">Invalid / Error Rows</span>
              <strong className="text-red-400 text-sm font-bold font-mono">
                {importResult.totalRows - importResult.validRowsCount}
              </strong>
            </div>
          </div>

          {/* Ignored Columns Notification (Requirement 1) */}
          {importResult.ignoredColumns.length > 0 && (
            <div className="p-3 bg-amber-500/10 border-b border-amber-500/20 text-amber-300 text-xs flex items-start gap-2.5">
              <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold">Zero-Inventory Policy Active: </span>
                <span>
                  The following inventory columns were detected and <strong>automatically ignored</strong>:{' '}
                  <code className="bg-[#222] px-1.5 py-0.5 rounded text-amber-300 font-mono border border-amber-500/30">
                    {importResult.ignoredColumns.join(', ')}
                  </code>. No stock levels will be stored or tracked.
                </span>
              </div>
            </div>
          )}

          {/* Preview Table */}
          <div className="overflow-x-auto max-h-96">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="sticky top-0 bg-[#0A0A0A] border-b border-[#222] text-gray-500 font-mono font-medium uppercase text-[10px] tracking-wider">
                <tr>
                  <th className="py-2.5 px-3 w-16">Row</th>
                  <th className="py-2.5 px-3 w-36">Product Code</th>
                  <th className="py-2.5 px-3">Description</th>
                  <th className="py-2.5 px-3 w-28">Category</th>
                  <th className="py-2.5 px-3 w-24">Status</th>
                  <th className="py-2.5 px-3 w-24">Unit (Ref)</th>
                  <th className="py-2.5 px-3 w-48">Validation & Duplicate State</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#222] font-mono text-[11px]">
                {importResult.rows.map((row) => (
                  <tr
                    key={row.rowNumber}
                    className={!row.isValid ? 'bg-red-500/5' : row.isExisting ? 'bg-amber-500/5' : 'hover:bg-[#1A1A1A]'}
                  >
                    <td className="py-2 px-3 text-gray-500 font-mono">#{row.rowNumber}</td>
                    <td className="py-2 px-3 font-bold text-blue-400 font-mono">{row.productCode || '-'}</td>
                    <td className="py-2 px-3 text-gray-200 font-sans text-xs">{row.description || '-'}</td>
                    <td className="py-2 px-3">
                      <span
                        className={`text-[10px] font-mono font-semibold px-1.5 py-0.5 rounded ${
                          row.category === 'RM' ? 'bg-[#222] text-blue-400 border border-blue-900/40' : 'bg-[#222] text-purple-400 border border-purple-900/40'
                        }`}
                      >
                        {row.category}
                      </span>
                    </td>
                    <td className="py-2 px-3 font-sans text-gray-300">{row.status}</td>
                    <td className="py-2 px-3 font-sans text-gray-400">{row.unit || '-'}</td>
                    <td className="py-2 px-3 font-sans">
                      {!row.isValid ? (
                        <span className="text-red-400 font-bold flex items-center gap-1 text-[11px]">
                          <XCircle className="w-3.5 h-3.5" /> {row.errors.join(', ')}
                        </span>
                      ) : row.isExisting ? (
                        <span className="text-amber-400 font-semibold flex items-center gap-1 text-[11px]">
                          <RefreshCw className="w-3.5 h-3.5" /> Existing Item (Will Update)
                        </span>
                      ) : (
                        <span className="text-green-400 font-semibold flex items-center gap-1 text-[11px]">
                          <CheckCircle2 className="w-3.5 h-3.5" /> New Master Item
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Export Options Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Export 1: Master Items */}
        <div className="bg-[#141414] rounded-xl border border-[#222] p-5 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="p-2 bg-[#1A1A1A] border border-[#2A2A2A] text-blue-400 rounded-lg">
                <Database className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-gray-100">
                  Export Master Reference Items List
                </h3>
                <p className="text-xs text-gray-500 font-mono">
                  Total {masterItems.length} master items in database
                </p>
              </div>
            </div>
            <p className="text-xs text-gray-400 mt-3 leading-relaxed">
              Produces a clean Excel (.xlsx) file containing Product Codes, Descriptions, Categories, Status, and Units. Zero inventory columns.
            </p>
          </div>

          <button
            onClick={() => excelService.exportMasterItems(masterItems)}
            className="mt-4 flex items-center justify-center gap-2 w-full py-2 px-3 text-xs font-semibold text-gray-200 bg-[#222] hover:bg-[#2A2A2A] rounded-lg transition-colors border border-[#333] cursor-pointer"
          >
            <Download className="w-4 h-4 text-green-400" />
            <span>Export Master Items (.xlsx)</span>
          </button>
        </div>

        {/* Export 2: Registered References */}
        <div className="bg-[#141414] rounded-xl border border-[#222] p-5 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="p-2 bg-[#1A1A1A] border border-[#2A2A2A] text-green-400 rounded-lg">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-gray-100">
                  Export Registered QA Samples
                </h3>
                <p className="text-xs text-gray-500 font-mono">
                  Total {registrations.length} registered sample references
                </p>
              </div>
            </div>
            <p className="text-xs text-gray-400 mt-3 leading-relaxed">
              Produces a full Excel (.xlsx) quality reference sheet including Registration Dates, QA Inspectors, Revisions, and Specifications.
            </p>
          </div>

          <button
            onClick={() => excelService.exportRegistrations(registrations, masterItems)}
            className="mt-4 flex items-center justify-center gap-2 w-full py-2 px-3 text-xs font-semibold text-gray-200 bg-[#222] hover:bg-[#2A2A2A] rounded-lg transition-colors border border-[#333] cursor-pointer"
          >
            <Download className="w-4 h-4 text-green-400" />
            <span>Export QA Samples (.xlsx)</span>
          </button>
        </div>

        {/* Export 3: Categories Master List */}
        <div className="bg-[#141414] rounded-xl border border-[#222] p-5 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="p-2 bg-[#1A1A1A] border border-[#2A2A2A] text-amber-400 rounded-lg">
                <Layers className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-gray-100">
                  Export Material Categories List
                </h3>
                <p className="text-xs text-gray-500 font-mono">
                  Configured classification categories
                </p>
              </div>
            </div>
            <p className="text-xs text-gray-400 mt-3 leading-relaxed">
              Produces an Excel (.xlsx) listing all configured specimen categories, active usage status, and associated master items & registration counts.
            </p>
          </div>

          <button
            onClick={async () => {
              const cats = await db.getCategories();
              excelService.exportCategories(cats, masterItems, registrations);
            }}
            className="mt-4 flex items-center justify-center gap-2 w-full py-2 px-3 text-xs font-semibold text-gray-200 bg-[#222] hover:bg-[#2A2A2A] rounded-lg transition-colors border border-[#333] cursor-pointer"
          >
            <Download className="w-4 h-4 text-amber-400" />
            <span>Export Categories (.xlsx)</span>
          </button>
        </div>
      </div>
    </div>
  );
};
