import React, { useState, useEffect, useRef } from 'react';
import { ReferenceRegistration, MasterItem, AppConfig, FormTemplate } from '../types';
import { 
  X, 
  Printer, 
  ShieldCheck, 
  Clock, 
  User, 
  CheckCircle2, 
  FileText,
  Building,
  Tag,
  Check,
  Eye,
  Layers,
  LayoutTemplate
} from 'lucide-react';
import { userService, AppUser } from '../services/userService';
import { db } from '../services/db';
import { buildSystemDataDictionary, renderHtmlTemplateWithData } from '../services/templateDefaults';

interface InspectionProofModalProps {
  isOpen: boolean;
  onClose: () => void;
  registration: ReferenceRegistration;
  masterItem?: MasterItem;
  config: AppConfig;
}

export const InspectionProofModal: React.FC<InspectionProofModalProps> = ({
  isOpen,
  onClose,
  registration,
  masterItem,
  config
}) => {
  const [adminUsers, setAdminUsers] = useState<AppUser[]>([]);
  const [selectedAdminId, setSelectedAdminId] = useState<string>('');
  const [activeTemplate, setActiveTemplate] = useState<FormTemplate | null>(null);
  const [printTimestamp, setPrintTimestamp] = useState<{ date: string; time: string; full: string }>({
    date: '',
    time: '',
    full: ''
  });
  const [isPrinting, setIsPrinting] = useState(false);

  const printAreaRef = useRef<HTMLDivElement>(null);

  const currentUser = userService.getCurrentUser();
  const printedByName = currentUser 
    ? `${currentUser.shortName} (${currentUser.fullName})` 
    : registration?.registeredBy || 'QA Inspector';

  useEffect(() => {
    if (isOpen) {
      const admins = userService.getAdminUsers();
      setAdminUsers(admins);
      if (admins.length > 0) {
        setSelectedAdminId(admins[0].idNumber);
      }

      db.getActiveFormTemplate('inspection_proof_slip').then(tpl => {
        setActiveTemplate(tpl);
      }).catch(err => {
        console.warn('Failed to load active inspection proof template:', err);
      });

      // Generate current print timestamp
      const now = new Date();
      const dateStr = now.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: '2-digit'
      });
      const timeStr = now.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: true
      });
      setPrintTimestamp({
        date: dateStr,
        time: timeStr,
        full: `${dateStr} ${timeStr}`
      });
    }
  }, [isOpen, registration]);

  if (!isOpen || !registration) return null;

  const selectedAdmin = adminUsers.find(a => a.idNumber === selectedAdminId) || adminUsers[0];
  const proofSerial = `IP-${(registration.productCode || 'REF').replace(/[^a-zA-Z0-9]/g, '')}-${Date.now().toString().slice(-6)}`;
  
  const displayMaterialType = (registration.materialType || masterItem?.materialType || (masterItem?.category === 'RM' || masterItem?.category === 'PS' ? masterItem.category : 'RM')) === 'PS'
    ? 'PRODUCTION SUPPLY (PS)'
    : 'RAW MATERIAL (RM)';

  const displayCategory = registration.category || masterItem?.category || 'Standard';
  const displayDesc = masterItem?.description || registration.specification || 'Approved Quality Reference Sample';
  const displayUnit = masterItem?.unit || 'Piece / Unit';

  // Build system data dictionary for template substitution
  const systemDataDict = buildSystemDataDictionary(
    registration,
    masterItem,
    config,
    selectedAdmin ? `${selectedAdmin.shortName} (${selectedAdmin.fullName})` : undefined
  );
  systemDataDict.proofSerial = proofSerial;
  if (printTimestamp.full) {
    systemDataDict.todayDateTime = printTimestamp.full;
    systemDataDict.printTimestamp = printTimestamp.time;
  }

  const customRenderedHtml = activeTemplate && activeTemplate.fileContent
    ? renderHtmlTemplateWithData(
        activeTemplate.fileContent,
        systemDataDict,
        activeTemplate.fieldMappings,
        activeTemplate.customCss
      )
    : null;

  const handlePrint = () => {
    setIsPrinting(true);
    
    // Update live timestamp
    const now = new Date();
    const dateStr = now.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: '2-digit'
    });
    const timeStr = now.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true
    });
    const fullTime = `${dateStr} ${timeStr}`;
    
    setPrintTimestamp({
      date: dateStr,
      time: timeStr,
      full: fullTime
    });

    const printContent = printAreaRef.current;
    if (!printContent) {
      window.print();
      setIsPrinting(false);
      return;
    }

    try {
      // Create dedicated hidden iframe for clean printing without modal interference
      const iframe = document.createElement('iframe');
      iframe.style.position = 'fixed';
      iframe.style.right = '0';
      iframe.style.bottom = '0';
      iframe.style.width = '0';
      iframe.style.height = '0';
      iframe.style.border = '0';
      document.body.appendChild(iframe);

      const doc = iframe.contentWindow?.document;
      if (doc) {
        doc.open();

        if (activeTemplate && activeTemplate.fileContent) {
          const printableHtml = renderHtmlTemplateWithData(
            activeTemplate.fileContent,
            { ...systemDataDict, todayDateTime: fullTime, printTimestamp: timeStr },
            activeTemplate.fieldMappings,
            activeTemplate.customCss
          );
          doc.write(`
            <!DOCTYPE html>
            <html>
              <head>
                <title>Inspection Proof - ${registration.productCode}</title>
                <style>
                  @page {
                    size: auto;
                    margin: 8mm;
                  }
                  body {
                    margin: 0;
                    padding: 0;
                    background: #fff;
                    color: #0f172a;
                  }
                </style>
              </head>
              <body>
                ${printableHtml}
              </body>
            </html>
          `);
        } else {
          doc.write(`
          <!DOCTYPE html>
          <html>
            <head>
              <title>Inspection Proof - ${registration.productCode}</title>
              <style>
                @page {
                  size: auto;
                  margin: 10mm;
                }
                body {
                  margin: 0;
                  padding: 0;
                  background: #fff;
                  color: #0f172a;
                  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
                  font-size: 11px;
                  line-height: 1.35;
                }
                .proof-container {
                  width: 100%;
                  max-width: 420px;
                  margin: 0 auto;
                  border: 2px solid #0f172a;
                  border-radius: 6px;
                  padding: 14px;
                  box-sizing: border-box;
                  background: #fff;
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
                  font-size: 13px;
                  font-weight: 900;
                  text-transform: uppercase;
                  color: #0f172a;
                  margin: 2px 0;
                }
                .sub-title {
                  font-size: 9px;
                  color: #64748b;
                  font-family: monospace;
                }
                .meta-bar {
                  display: flex;
                  justify-content: space-between;
                  font-family: monospace;
                  font-size: 9px;
                  padding: 4px 6px;
                  background: #f8fafc;
                  border-bottom: 1px dashed #cbd5e1;
                  margin-top: 4px;
                }
                .product-box {
                  background: #f1f5f9;
                  border: 1px solid #cbd5e1;
                  border-radius: 4px;
                  padding: 8px;
                  margin: 8px 0;
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
                  margin: 6px 0;
                  display: grid;
                  grid-template-columns: 1fr 1fr;
                  gap: 4px 8px;
                  font-size: 10px;
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
                .spec-box {
                  margin: 6px 0;
                  padding: 6px;
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
                  font-size: 9px;
                  font-family: monospace;
                  white-space: pre-wrap;
                  color: #1e293b;
                  margin-top: 2px;
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
                  padding: 6px;
                  background: #f8fafc;
                  display: flex;
                  flex-direction: column;
                  justify-content: space-between;
                  min-height: 55px;
                }
                .sign-role {
                  font-weight: 800;
                  font-size: 8px;
                  color: #334155;
                  font-family: monospace;
                }
                .sign-name {
                  font-weight: 800;
                  font-size: 9px;
                  color: #0f172a;
                }
                .sign-line {
                  border-top: 1px solid #cbd5e1;
                  margin-top: 8px;
                  padding-top: 2px;
                  text-align: center;
                  font-size: 8px;
                  color: #64748b;
                  font-family: monospace;
                }
                .footer-notice {
                  margin-top: 8px;
                  padding-top: 4px;
                  border-top: 1px dashed #94a3b8;
                  text-align: center;
                  font-size: 8px;
                  color: #64748b;
                  font-family: monospace;
                }
              </style>
            </head>
            <body>
              <div class="proof-container">
                <div class="header">
                  <div class="company-name">${config.companyName || 'PRECISION INDUSTRIAL CORP.'}</div>
                  <div class="doc-title">MATERIAL INSPECTION PROOF</div>
                  <div class="sub-title">Quality Assurance • Reference Specimen Voucher</div>
                </div>

                <div class="meta-bar">
                  <div><strong>PROOF ID:</strong> ${proofSerial}</div>
                  <div><strong>PRINTED:</strong> ${fullTime}</div>
                </div>

                <div class="product-box">
                  <div class="product-header">
                    <div>
                      <div class="code-label">PRODUCT CODE</div>
                      <div class="code-val">${registration.productCode}</div>
                    </div>
                    <div style="text-align: right;">
                      <span class="rev-badge">${registration.revision || 'Rev 01'}</span>
                      <div style="font-size: 8px; font-weight: bold; margin-top: 2px; font-family: monospace; color: #475569;">
                        ${displayMaterialType} • ${displayCategory}
                      </div>
                    </div>
                  </div>
                  <div class="desc-box">
                    <div class="code-label">DESCRIPTION</div>
                    <div class="desc-val">${displayDesc}</div>
                  </div>
                </div>

                <div class="info-grid">
                  <div><span class="info-label">SUPPLIER: </span><span class="info-val">${registration.supplier || 'N/A / Internal'}</span></div>
                  <div><span class="info-label">REF UNIT: </span><span class="info-val">${displayUnit}</span></div>
                  <div><span class="info-label">REG DATE: </span><span class="info-val">${registration.registrationDate || '-'}</span></div>
                  <div><span class="info-label">REGISTERED BY: </span><span class="info-val">${registration.registeredBy || '-'}</span></div>
                </div>

                ${registration.specification ? `
                  <div class="spec-box">
                    <div class="spec-title">SPECIFICATIONS & ACCEPTANCE CRITERIA</div>
                    <div class="spec-val">${registration.specification}</div>
                  </div>
                ` : ''}

                ${registration.remarks ? `
                  <div class="spec-box">
                    <div class="spec-title">QUALITY REMARKS / NOTES</div>
                    <div class="spec-val" style="font-style: italic;">${registration.remarks}</div>
                  </div>
                ` : ''}

                <div class="sign-grid">
                  <div class="sign-card">
                    <div>
                      <div class="sign-role">PRINTED BY</div>
                      <div class="sign-name">${printedByName}</div>
                      <div style="font-size: 8px; color: #64748b; font-family: monospace;">${fullTime}</div>
                    </div>
                    <div class="sign-line">Operator Signature</div>
                  </div>

                  <div class="sign-card">
                    <div>
                      <div class="sign-role">CHECKED BY (ADMIN)</div>
                      <div class="sign-name">${selectedAdmin ? `${selectedAdmin.shortName} (${selectedAdmin.fullName})` : 'Sys Admin'}</div>
                      <div style="font-size: 8px; color: #64748b; font-family: monospace;">ID: ${selectedAdmin?.idNumber || 'ADMIN'} • Role: Admin</div>
                    </div>
                    <div class="sign-line">Admin Sign-Off Line</div>
                  </div>
                </div>

                <div class="footer-notice">
                  *** OFFICIAL QA RECORD • VERIFIED SPECIMEN PROOF ***
                </div>
              </div>
            </body>
          </html>
        `);
        }
        doc.close();

        setTimeout(() => {
          iframe.contentWindow?.focus();
          iframe.contentWindow?.print();
          setTimeout(() => {
            document.body.removeChild(iframe);
            setIsPrinting(false);
          }, 1000);
        }, 250);
      } else {
        window.print();
        setIsPrinting(false);
      }
    } catch (e) {
      console.warn('Fallback to standard window.print()', e);
      window.print();
      setIsPrinting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-[#141414] rounded-2xl shadow-2xl border border-[#333] w-full max-w-4xl overflow-hidden my-4 flex flex-col max-h-[92vh]">
        {/* Modal Header */}
        <div className="bg-[#0A0A0A] text-white px-5 py-3.5 flex items-center justify-between border-b border-[#252525] shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-emerald-500/10 border border-emerald-500/30 rounded-lg text-emerald-400">
              <Printer className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold font-mono text-white">
                  Print Inspection Proof
                </h3>
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 font-mono">
                  Official Specimen Slip
                </span>
              </div>
              <p className="text-[11px] text-gray-400 mt-0.5">
                Specimen receipt voucher without photos for official quality logs & physical attachments.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="p-1.5 text-gray-400 hover:text-white hover:bg-[#222] rounded-lg transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content Split: Configuration Toolbar + Receipt Slip Preview */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 grid grid-cols-1 lg:grid-cols-12 gap-6 bg-[#0E0E0E]">
          {/* Left Controls (5 cols on lg) */}
          <div className="lg:col-span-5 space-y-4">
            <div className="bg-[#181818] p-4 rounded-xl border border-[#2A2A2A] space-y-4">
              <h4 className="text-xs font-mono font-bold text-gray-300 uppercase tracking-wider flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-blue-400" />
                Proof Sign-off Authority
              </h4>

              {/* Checked By Admin Dropdown */}
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-gray-200 font-mono flex items-center justify-between">
                  <span>Checked By (Admin) <span className="text-red-400">*</span></span>
                  <span className="text-[10px] text-purple-400 font-normal">Admin Dropdown</span>
                </label>
                <select
                  value={selectedAdminId}
                  onChange={(e) => setSelectedAdminId(e.target.value)}
                  className="w-full text-xs px-3 py-2.5 bg-[#121212] border border-[#3A3A3A] text-white rounded-lg focus:outline-hidden focus:border-blue-500 font-medium cursor-pointer"
                >
                  {adminUsers.map((admin) => (
                    <option key={admin.idNumber} value={admin.idNumber}>
                      {admin.shortName} — {admin.fullName} ({admin.idNumber})
                    </option>
                  ))}
                  {adminUsers.length === 0 && (
                    <option value="ADMIN123">Sys Admin (System Administrator)</option>
                  )}
                </select>
                <p className="text-[11px] text-gray-400">
                  Selects the registered Administrator who verified and checked the reference item.
                </p>
              </div>

              {/* Printed By Info */}
              <div className="p-3 bg-[#121212] rounded-lg border border-[#262626] space-y-1 text-xs">
                <div className="text-[11px] font-mono text-gray-400 uppercase">Printed By (Logged In User)</div>
                <div className="font-semibold text-cyan-300 flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5" />
                  {printedByName}
                </div>
                <div className="text-[10px] text-gray-500">
                  ID: {currentUser?.idNumber || 'AUTH'} • Role: {currentUser?.role || 'user'}
                </div>
              </div>

              {/* Print Date & Time Details */}
              <div className="p-3 bg-[#121212] rounded-lg border border-[#262626] space-y-1 text-xs">
                <div className="text-[11px] font-mono text-gray-400 uppercase">Print Timestamp</div>
                <div className="font-mono text-gray-200 flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-amber-400" />
                  {printTimestamp.full || 'Current System Time'}
                </div>
              </div>

              {/* Format specs */}
              <div className="text-[11px] text-gray-400 bg-blue-500/10 border border-blue-500/20 rounded-lg p-3 space-y-1">
                <div className="font-semibold text-blue-300 flex items-center gap-1">
                  <FileText className="w-3.5 h-3.5" /> Specimen Proof Slip
                </div>
                <p className="text-[10px] text-gray-300 leading-relaxed">
                  Compact receipt slip designed for physical specimen tags, bin labels, and audit binders. No photos are included to conserve space and ink.
                </p>
              </div>
            </div>

            {/* Print Trigger Button */}
            <div className="space-y-2">
              <button
                type="button"
                onClick={handlePrint}
                disabled={isPrinting}
                className="w-full py-3 px-4 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl shadow-lg flex items-center justify-center gap-2 transition-colors cursor-pointer text-sm disabled:opacity-50"
              >
                <Printer className="w-4 h-4" />
                <span>{isPrinting ? 'Preparing Print...' : 'Print Inspection Proof'}</span>
              </button>

              <p className="text-[11px] text-center text-gray-500 font-mono">
                Standard format for laser, inkjet, and receipt slip printers
              </p>
            </div>
          </div>

          {/* Right Preview of Receipt Slip (7 cols on lg) */}
          <div className="lg:col-span-7 flex flex-col items-center justify-start overflow-x-auto pb-4">
            <div className="w-full flex items-center justify-between mb-2">
              <div className="text-[11px] font-mono text-gray-400 flex items-center gap-1.5">
                <Eye className="w-3.5 h-3.5 text-emerald-400" />
                <span>Inspection Proof Slip Preview</span>
              </div>
              {activeTemplate && (
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                  Template: <strong className="font-semibold text-white">{activeTemplate.name}</strong>
                  {activeTemplate.isBuiltIn && <span className="text-gray-400">(Built-in)</span>}
                </span>
              )}
            </div>

            {/* Visual Container */}
            <div className="w-full flex justify-center py-2">
              {activeTemplate && !activeTemplate.isBuiltIn && customRenderedHtml ? (
                <div 
                  ref={printAreaRef}
                  id="inspection-proof-print-container"
                  className="bg-white text-slate-900 rounded-md border-2 border-slate-800 shadow-2xl p-4 w-full max-w-[440px] select-all overflow-x-auto"
                  dangerouslySetInnerHTML={{ __html: customRenderedHtml }}
                />
              ) : (
              <div 
                ref={printAreaRef}
                id="inspection-proof-print-container"
                className="bg-white text-slate-900 rounded-md border-2 border-slate-800 shadow-2xl p-4 w-full max-w-[420px] text-[11px] leading-tight font-sans select-all transition-all"
              >
                {/* Top Receipt Header */}
                <div className="text-center pb-2 border-b-2 border-slate-800">
                  <div className="text-[9px] font-bold tracking-widest text-slate-600 uppercase font-mono">
                    {config.companyName || 'PRECISION INDUSTRIAL CORP.'}
                  </div>
                  <div className="text-xs font-black tracking-tight text-slate-900 uppercase mt-0.5">
                    MATERIAL INSPECTION PROOF
                  </div>
                  <div className="text-[9px] font-mono font-medium text-slate-500">
                    Quality Assurance • Reference Specimen Voucher
                  </div>
                </div>

                {/* Proof Serial & Live Print Timestamp Bar */}
                <div className="py-1.5 border-b border-dashed border-slate-400 flex items-center justify-between text-[9px] font-mono bg-slate-50 px-1 mt-1">
                  <div>
                    <span className="text-slate-500 font-semibold">PROOF ID: </span>
                    <span className="font-bold text-slate-800">{proofSerial}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 font-semibold">PRINTED: </span>
                    <span className="font-bold text-slate-800">{printTimestamp.full || '2026-08-21'}</span>
                  </div>
                </div>

                {/* Primary Identification Box */}
                <div className="my-2 p-2 bg-slate-100 rounded border border-slate-300">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="text-[8px] font-bold uppercase tracking-wider text-slate-500 font-mono">
                        PRODUCT CODE
                      </div>
                      <div className="text-base font-black font-mono text-slate-900 tracking-tight">
                        {registration.productCode}
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="inline-block font-mono font-bold text-[9px] px-1.5 py-0.5 rounded bg-slate-900 text-white">
                        {registration.revision || 'Rev 01'}
                      </span>
                      <div className="text-[8px] font-bold text-slate-600 uppercase mt-0.5 font-mono">
                        {displayMaterialType} • {displayCategory}
                      </div>
                    </div>
                  </div>

                  <div className="mt-1.5 pt-1.5 border-t border-slate-200">
                    <div className="text-[8px] font-bold uppercase text-slate-500 font-mono">DESCRIPTION</div>
                    <div className="text-[11px] font-bold text-slate-900 leading-snug">
                      {displayDesc}
                    </div>
                  </div>
                </div>

                {/* Specimen Key Metadata Table */}
                <div className="border-t border-b border-slate-300 py-1.5 space-y-1 text-[10px]">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <span className="text-slate-500 font-medium font-mono text-[9px]">SUPPLIER: </span>
                      <span className="font-bold text-slate-800 truncate block">
                        {registration.supplier || 'N/A / Internal'}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-500 font-medium font-mono text-[9px]">REF UNIT: </span>
                      <span className="font-bold text-slate-800">
                        {displayUnit}
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <span className="text-slate-500 font-medium font-mono text-[9px]">REG DATE: </span>
                      <span className="font-mono font-semibold text-slate-800">
                        {registration.registrationDate || '-'}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-500 font-medium font-mono text-[9px]">REGISTERED BY: </span>
                      <span className="font-semibold text-slate-800">
                        {registration.registeredBy || '-'}
                      </span>
                    </div>
                  </div>

                  {masterItem?.status && (
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <span className="text-slate-500 font-medium font-mono text-[9px]">MASTER STATUS: </span>
                        <span className="font-semibold text-slate-800">
                          {masterItem.status}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-500 font-medium font-mono text-[9px]">ATTACHMENTS: </span>
                        <span className="font-mono text-slate-800">
                          {registration.attachments?.length || 0} Files Attached
                        </span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Technical Specifications & Criteria */}
                {registration.specification && (
                  <div className="my-1.5">
                    <div className="text-[8px] font-bold uppercase text-slate-500 font-mono tracking-wider">
                      SPECIFICATIONS & ACCEPTANCE CRITERIA
                    </div>
                    <div className="text-[9px] text-slate-800 bg-slate-50 p-1.5 rounded border border-slate-200 font-mono whitespace-pre-wrap leading-tight mt-0.5 max-h-24 overflow-hidden">
                      {registration.specification}
                    </div>
                  </div>
                )}

                {/* Quality Remarks if any */}
                {registration.remarks && (
                  <div className="my-1">
                    <div className="text-[8px] font-bold uppercase text-slate-500 font-mono">
                      QUALITY REMARKS / INSTRUCTIONS
                    </div>
                    <div className="text-[9px] text-slate-700 italic bg-slate-50 p-1 rounded border border-slate-200 mt-0.5">
                      {registration.remarks}
                    </div>
                  </div>
                )}

                {/* Custom Fields if any */}
                {registration.customFields && Object.keys(registration.customFields).length > 0 && (
                  <div className="my-1.5 border-t border-dotted border-slate-300 pt-1">
                    <div className="text-[8px] font-bold uppercase text-slate-500 font-mono mb-0.5">
                      ADDITIONAL ATTRIBUTES
                    </div>
                    <div className="grid grid-cols-2 gap-1 text-[9px]">
                      {Object.entries(registration.customFields).map(([key, val]) => (
                        <div key={key} className="truncate">
                          <span className="text-slate-500 font-mono">{key}: </span>
                          <span className="font-semibold text-slate-800">{String(val)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Bottom Sign-off / Verification Section */}
                <div className="mt-3 pt-2 border-t-2 border-slate-800 grid grid-cols-2 gap-3 text-[9px]">
                  {/* Printed By Column */}
                  <div className="border border-slate-300 rounded p-1.5 bg-slate-50 flex flex-col justify-between">
                    <div>
                      <div className="font-bold text-slate-800 uppercase text-[8px] font-mono flex items-center gap-0.5">
                        <CheckCircle2 className="w-2.5 h-2.5 text-emerald-600" />
                        PRINTED BY
                      </div>
                      <div className="font-bold text-slate-900 mt-0.5 truncate text-[9px]">
                        {printedByName}
                      </div>
                      <div className="text-[8px] text-slate-500 font-mono">
                        {printTimestamp.full || 'Date & Time Logged'}
                      </div>
                    </div>
                    <div className="mt-2 pt-1 border-t border-slate-300 text-center text-[8px] text-slate-500 font-mono">
                      Operator Signature
                    </div>
                  </div>

                  {/* Checked By Admin Column */}
                  <div className="border border-slate-300 rounded p-1.5 bg-slate-50 flex flex-col justify-between">
                    <div>
                      <div className="font-bold text-slate-800 uppercase text-[8px] font-mono flex items-center gap-0.5">
                        <ShieldCheck className="w-2.5 h-2.5 text-blue-600" />
                        CHECKED BY (ADMIN)
                      </div>
                      <div className="font-bold text-slate-900 mt-0.5 truncate text-[9px]">
                        {selectedAdmin ? `${selectedAdmin.shortName} (${selectedAdmin.fullName})` : 'Sys Admin'}
                      </div>
                      <div className="text-[8px] text-slate-500 font-mono">
                        ID: {selectedAdmin?.idNumber || 'ADMIN123'} • Role: Admin
                      </div>
                    </div>
                    <div className="mt-2 pt-1 border-t border-slate-300 text-center text-[8px] text-slate-500 font-mono">
                      Admin Sign-Off Line
                    </div>
                  </div>
                </div>

                {/* Footer Tear-off / Verification Note */}
                <div className="mt-2 pt-1 border-t border-dashed border-slate-400 text-center text-[8px] text-slate-500 font-mono">
                  *** OFFICIAL QA RECORD • VERIFIED SPECIMEN PROOF ***
                </div>
              </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
