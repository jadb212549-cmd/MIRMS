import React from 'react';
import { ReferenceRegistration, MasterItem, AppConfig, PhotoAttachment, PrintLayoutType, PhotoCategory } from '../types';
import { Star, Printer, Layers, Image as ImageIcon, ShieldCheck } from 'lucide-react';

interface PrintableReferenceCardProps {
  registration: ReferenceRegistration;
  masterItem: MasterItem;
  config: AppConfig;
  overrideLayout?: PrintLayoutType;
  selectedPhotoIds?: string[];
}

const CATEGORY_LABEL_MAP: Record<PhotoCategory, string> = {
  SPECIMEN_PRIMARY: 'Primary Standard',
  DEFECT_LIMIT: 'Tolerance / Limit Sample',
  SURFACE_FINISH: 'Surface Texture',
  DIMENSION_CHECK: 'Dimension Check',
  PACKAGING_LABEL: 'Packaging Spec',
  OTHER: 'Inspection Evidence'
};

export const PrintableReferenceCard: React.FC<PrintableReferenceCardProps> = ({
  registration,
  masterItem,
  config,
  overrideLayout,
  selectedPhotoIds
}) => {
  const activeLayout = overrideLayout || registration.printLayout || 'HERO_SINGLE';

  // Filter photos to print
  const allPhotos: PhotoAttachment[] = registration.photos || [];
  const printPhotos = allPhotos.filter((p) => {
    if (selectedPhotoIds && selectedPhotoIds.length > 0) {
      return selectedPhotoIds.includes(p.id);
    }
    if (registration.selectedPrintPhotoIds && registration.selectedPrintPhotoIds.length > 0) {
      return registration.selectedPrintPhotoIds.includes(p.id);
    }
    return p.includeInPrint !== false;
  });

  // Sort photos: primary first, then orderIndex
  const sortedPhotos = [...printPhotos].sort((a, b) => {
    if (a.isPrimary && !b.isPrimary) return -1;
    if (!a.isPrimary && b.isPrimary) return 1;
    return (a.orderIndex ?? 0) - (b.orderIndex ?? 0);
  });

  // Pick photos according to layout
  let displayedPhotos: PhotoAttachment[] = [];
  if (activeLayout === 'SPECS_ONLY') {
    displayedPhotos = [];
  } else if (activeLayout === 'HERO_SINGLE') {
    displayedPhotos = sortedPhotos.slice(0, 1);
  } else if (activeLayout === 'DUAL_COMPARISON') {
    displayedPhotos = sortedPhotos.slice(0, 2);
  } else if (activeLayout === 'GRID_FOUR') {
    displayedPhotos = sortedPhotos.slice(0, 4);
  } else {
    // ALL_PHOTOS
    displayedPhotos = sortedPhotos;
  }

  return (
    <div className="bg-white border-2 border-slate-900 rounded-lg p-5 max-w-2xl mx-auto text-slate-900 shadow-sm print:border-black print:m-0 print:p-4 print:max-w-none print:w-full">
      {/* Header */}
      <div className="border-b-2 border-slate-900 pb-3 flex items-start justify-between">
        <div>
          <div className="text-[10px] font-bold tracking-widest text-slate-600 uppercase">
            {config.companyName || 'PRECISION INDUSTRIAL CORP.'}
          </div>
          <div className="text-base font-black tracking-tight text-slate-900 mt-0.5">
            APPROVED MATERIAL REFERENCE SPECIMEN
          </div>
          <div className="text-[10px] text-slate-500 font-mono">
            QC Department • Physical Sample Catalog & Inspection Standard
          </div>
        </div>
        <div className="text-right">
          <div className="text-xs font-mono font-black text-rose-700 bg-rose-50 px-2.5 py-1 rounded border border-rose-300 inline-block">
            {registration.revision || 'Rev 01'}
          </div>
          <div className="text-[10px] text-slate-500 mt-1 font-mono">
            Date: {registration.registrationDate}
          </div>
        </div>
      </div>

      {/* Main Barcode & Code Grid */}
      <div className="my-3 grid grid-cols-3 gap-3 items-center">
        <div className="col-span-2">
          <div className="text-[10px] font-bold text-slate-500 uppercase">Product Code</div>
          <div className="text-xl font-mono font-black tracking-tight text-slate-900">
            {registration.productCode}
          </div>
          <div className="text-xs font-semibold text-slate-800 mt-0.5">
            {masterItem.description}
          </div>
        </div>

        <div className="text-center p-2 bg-slate-50 border border-slate-300 rounded">
          <div className="text-[10px] font-bold text-slate-500 uppercase">Category</div>
          <div className="text-xs font-black text-slate-900 mt-0.5">
            {masterItem.category === 'RM' ? 'RAW MATERIAL' : 'PROD SUPPLY'}
          </div>
          <div className="text-[10px] text-slate-600 mt-0.5 font-mono">
            Unit: {masterItem.unit || 'Standard'}
          </div>
        </div>
      </div>

      {/* Visual Reference Specimen Photos Section */}
      {displayedPhotos.length > 0 && (
        <div className="my-3 border border-slate-300 rounded-lg p-2.5 bg-slate-50/70">
          <div className="flex items-center justify-between mb-2 pb-1 border-b border-slate-200">
            <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1">
              <ImageIcon className="w-3 h-3 text-blue-600" />
              Approved Visual Reference Standard ({displayedPhotos.length} {displayedPhotos.length === 1 ? 'Photo' : 'Photos'} Printed)
            </span>
            <span className="text-[9px] font-mono text-slate-500">
              Layout: {activeLayout.replace('_', ' ')}
            </span>
          </div>

          {/* Render layouts */}
          {activeLayout === 'HERO_SINGLE' && (
            <div className="space-y-1">
              <div className="relative border border-slate-300 rounded bg-white overflow-hidden max-h-56 flex items-center justify-center">
                <img
                  src={displayedPhotos[0].dataUrl}
                  alt={displayedPhotos[0].fileName}
                  className="max-h-56 w-full object-contain bg-slate-100"
                />
                <div className="absolute top-1.5 left-1.5 bg-slate-900/85 text-white text-[9px] font-mono px-1.5 py-0.5 rounded flex items-center gap-1">
                  <Star className="w-2.5 h-2.5 fill-amber-400 text-amber-400" />
                  {CATEGORY_LABEL_MAP[displayedPhotos[0].photoCategory || 'SPECIMEN_PRIMARY']}
                </div>
              </div>
              {displayedPhotos[0].caption && (
                <p className="text-[11px] text-slate-700 font-medium italic text-center">
                  "{displayedPhotos[0].caption}"
                </p>
              )}
            </div>
          )}

          {activeLayout === 'DUAL_COMPARISON' && (
            <div className="grid grid-cols-2 gap-2">
              {displayedPhotos.map((photo, idx) => (
                <div key={photo.id} className="border border-slate-300 rounded bg-white p-1 space-y-1">
                  <div className="relative h-36 bg-slate-100 rounded overflow-hidden flex items-center justify-center">
                    <img
                      src={photo.dataUrl}
                      alt={photo.fileName}
                      className="h-full w-full object-cover"
                    />
                    <div className="absolute top-1 left-1 bg-slate-900/85 text-white text-[8px] font-mono px-1.5 py-0.5 rounded">
                      #{idx + 1} {CATEGORY_LABEL_MAP[photo.photoCategory || (idx === 0 ? 'SPECIMEN_PRIMARY' : 'DEFECT_LIMIT')]}
                    </div>
                  </div>
                  {photo.caption && (
                    <p className="text-[10px] text-slate-800 font-medium truncate text-center">
                      {photo.caption}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}

          {(activeLayout === 'GRID_FOUR' || activeLayout === 'ALL_PHOTOS') && (
            <div className={`grid gap-2 ${displayedPhotos.length > 2 ? 'grid-cols-2 sm:grid-cols-2' : 'grid-cols-2'}`}>
              {displayedPhotos.map((photo, idx) => (
                <div key={photo.id} className="border border-slate-300 rounded bg-white p-1 space-y-1">
                  <div className="relative h-28 bg-slate-100 rounded overflow-hidden flex items-center justify-center">
                    <img
                      src={photo.dataUrl}
                      alt={photo.fileName}
                      className="h-full w-full object-cover"
                    />
                    <div className="absolute top-1 left-1 bg-slate-900/85 text-white text-[8px] font-mono px-1 py-0.5 rounded">
                      #{idx + 1} {photo.photoCategory ? CATEGORY_LABEL_MAP[photo.photoCategory] : 'Photo'}
                    </div>
                  </div>
                  {photo.caption && (
                    <p className="text-[9px] text-slate-800 font-medium truncate text-center">
                      {photo.caption}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Attributes & Quality Specs */}
      <div className="border-t border-b border-slate-300 py-2.5 text-xs space-y-1.5">
        <div className="grid grid-cols-2 gap-2">
          <div>
            <span className="text-slate-500 text-[11px]">Supplier / Manufacturer: </span>
            <span className="font-semibold text-slate-800">{registration.supplier || 'N/A'}</span>
          </div>
          <div>
            <span className="text-slate-500 text-[11px]">Registered Inspector: </span>
            <span className="font-semibold text-slate-800">{registration.registeredBy}</span>
          </div>
        </div>

        {registration.specification && (
          <div>
            <span className="text-slate-500 text-[11px] block font-medium">Key Specifications & Tolerances:</span>
            <p className="text-[11px] text-slate-800 font-sans whitespace-pre-wrap bg-slate-50 p-2 rounded border border-slate-200 mt-0.5">
              {registration.specification}
            </p>
          </div>
        )}

        {registration.remarks && (
          <div>
            <span className="text-slate-500 text-[11px] block font-medium">Inspection Remarks:</span>
            <p className="text-[11px] text-slate-700 italic bg-slate-50 p-1.5 rounded border border-slate-200 mt-0.5">
              {registration.remarks}
            </p>
          </div>
        )}
      </div>

      {/* Sign-off Stamps */}
      <div className="mt-4 pt-2 grid grid-cols-2 gap-6 text-center text-[10px]">
        <div className="border-t border-slate-400 pt-1">
          <div className="font-bold text-slate-800 uppercase">QA Specialist Verification</div>
          <div className="text-slate-600 font-medium mt-0.5">{registration.registeredBy}</div>
        </div>
        <div className="border-t border-slate-400 pt-1">
          <div className="font-bold text-slate-800 uppercase">Quality Control Manager Sign-off</div>
          <div className="text-slate-600 font-medium mt-0.5">Physical Sample Approved</div>
        </div>
      </div>
    </div>
  );
};

