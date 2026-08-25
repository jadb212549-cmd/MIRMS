import React, { useState, useEffect, useRef } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import {
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  ZoomOut,
  Download,
  RotateCw,
  FileText,
  AlertCircle
} from 'lucide-react';

// Configure pdf.js worker URL (local import to support offline environments)
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl;

interface PdfViewerProps {
  base64?: string;
  url?: string;
  fileName?: string;
  className?: string;
  height?: string;
}

export const PdfViewer: React.FC<PdfViewerProps> = ({
  base64,
  url,
  fileName = 'document.pdf',
  className = '',
  height = '600px'
}) => {
  const [pdfDoc, setPdfDoc] = useState<pdfjsLib.PDFDocumentProxy | null>(null);
  const [pageNum, setPageNum] = useState<number>(1);
  const [numPages, setNumPages] = useState<number>(0);
  const [scale, setScale] = useState<number>(1.2);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [rotation, setRotation] = useState<number>(0);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const renderTaskRef = useRef<any>(null);

  // Load PDF Document
  useEffect(() => {
    let isCancelled = false;
    setIsLoading(true);
    setError(null);
    setPdfDoc(null);
    setPageNum(1);

    const loadPdf = async () => {
      try {
        let pdfData: Uint8Array | null = null;

        if (base64) {
          const cleanBase64 = base64.includes(',') ? base64.split(',')[1] : base64;
          const binaryString = atob(cleanBase64);
          const len = binaryString.length;
          const bytes = new Uint8Array(len);
          for (let i = 0; i < len; i++) {
            bytes[i] = binaryString.charCodeAt(i);
          }
          pdfData = bytes;
        }

        const loadingTask = pdfjsLib.getDocument(
          pdfData ? { data: pdfData } : { url: url || '' }
        );

        const doc = await loadingTask.promise;
        if (isCancelled) return;

        setPdfDoc(doc);
        setNumPages(doc.numPages);
        setIsLoading(false);
      } catch (err: any) {
        console.error('PdfViewer loading error:', err);
        if (!isCancelled) {
          setError(err.message || 'Failed to parse and render PDF file');
          setIsLoading(false);
        }
      }
    };

    if (base64 || url) {
      loadPdf();
    } else {
      setError('No PDF content provided.');
      setIsLoading(false);
    }

    return () => {
      isCancelled = true;
    };
  }, [base64, url]);

  // Render current page onto Canvas
  useEffect(() => {
    if (!pdfDoc || pageNum < 1 || pageNum > numPages) return;

    let isSubscribed = true;

    const renderPage = async () => {
      try {
        const page = await pdfDoc.getPage(pageNum);
        if (!isSubscribed || !canvasRef.current) return;

        const viewport = page.getViewport({ scale, rotation });
        const canvas = canvasRef.current;
        const context = canvas.getContext('2d');

        if (!context) return;

        canvas.height = viewport.height;
        canvas.width = viewport.width;

        // Cancel previous render task if active
        if (renderTaskRef.current) {
          renderTaskRef.current.cancel();
        }

        const renderContext = {
          canvasContext: context,
          viewport: viewport,
          canvas: canvas
        };

        const renderTask = page.render(renderContext);
        renderTaskRef.current = renderTask;

        await renderTask.promise;
      } catch (err: any) {
        if (err.name !== 'RenderingCancelledException') {
          console.error('Error rendering page:', err);
        }
      }
    };

    renderPage();

    return () => {
      isSubscribed = false;
      if (renderTaskRef.current) {
        renderTaskRef.current.cancel();
      }
    };
  }, [pdfDoc, pageNum, scale, rotation, numPages]);

  const handlePrev = () => setPageNum(p => Math.max(p - 1, 1));
  const handleNext = () => setPageNum(p => Math.min(p + 1, numPages));
  const handleZoomIn = () => setScale(s => Math.min(s + 0.2, 3.0));
  const handleZoomOut = () => setScale(s => Math.max(s - 0.2, 0.5));
  const handleRotate = () => setRotation(r => (r + 90) % 360);

  const handleDownload = () => {
    if (!base64 && !url) return;
    try {
      if (base64) {
        const cleanBase64 = base64.includes(',') ? base64.split(',')[1] : base64;
        const binaryString = atob(cleanBase64);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }
        const blob = new Blob([bytes], { type: 'application/pdf' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = fileName.endsWith('.pdf') ? fileName : `${fileName}.pdf`;
        link.click();
        URL.revokeObjectURL(link.href);
      }
    } catch (e) {
      console.error('Download PDF error:', e);
    }
  };

  return (
    <div className={`bg-[#181818] border border-[#2D2D2D] rounded-xl flex flex-col overflow-hidden shadow-xl ${className}`}>
      {/* PDF Controls Header Bar */}
      <div className="bg-[#121212] border-b border-[#262626] px-4 py-2.5 flex flex-wrap items-center justify-between gap-3 text-xs font-mono text-gray-300">
        <div className="flex items-center gap-2">
          <FileText className="w-4 h-4 text-red-400" />
          <span className="font-bold text-white truncate max-w-[200px]" title={fileName}>
            {fileName}
          </span>
          <span className="px-1.5 py-0.5 rounded text-[10px] bg-red-500/10 text-red-400 border border-red-500/20">
            PDF
          </span>
        </div>

        {/* Page Navigation */}
        <div className="flex items-center gap-1.5 bg-[#1E1E1E] border border-[#333] rounded-lg px-2 py-1">
          <button
            type="button"
            onClick={handlePrev}
            disabled={pageNum <= 1 || isLoading}
            className="p-1 hover:text-white disabled:opacity-30 disabled:hover:text-gray-400 transition-colors cursor-pointer"
            title="Previous Page"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="px-2 text-gray-200">
            Page {pageNum} of {numPages || 1}
          </span>
          <button
            type="button"
            onClick={handleNext}
            disabled={pageNum >= numPages || isLoading}
            className="p-1 hover:text-white disabled:opacity-30 disabled:hover:text-gray-400 transition-colors cursor-pointer"
            title="Next Page"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        {/* Zoom & View Controls */}
        <div className="flex items-center gap-1.5">
          <div className="flex items-center bg-[#1E1E1E] border border-[#333] rounded-lg px-2 py-1 gap-1">
            <button
              type="button"
              onClick={handleZoomOut}
              disabled={isLoading || scale <= 0.5}
              className="p-1 hover:text-white disabled:opacity-30 cursor-pointer"
              title="Zoom Out"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <span className="w-12 text-center text-[11px] text-gray-300">
              {Math.round(scale * 100)}%
            </span>
            <button
              type="button"
              onClick={handleZoomIn}
              disabled={isLoading || scale >= 3.0}
              className="p-1 hover:text-white disabled:opacity-30 cursor-pointer"
              title="Zoom In"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
          </div>

          <button
            type="button"
            onClick={handleRotate}
            disabled={isLoading}
            className="p-1.5 bg-[#1E1E1E] hover:bg-[#282828] border border-[#333] rounded-lg text-gray-300 hover:text-white transition-colors cursor-pointer"
            title="Rotate 90°"
          >
            <RotateCw className="w-3.5 h-3.5" />
          </button>

          <button
            type="button"
            onClick={handleDownload}
            disabled={isLoading}
            className="flex items-center gap-1 px-2.5 py-1.5 bg-red-600 hover:bg-red-500 text-white rounded-lg font-sans text-xs font-semibold transition-colors cursor-pointer shadow-xs"
            title="Download PDF"
          >
            <Download className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Download</span>
          </button>
        </div>
      </div>

      {/* Main Canvas Scroll Area */}
      <div
        className="flex-1 bg-[#1A1A1A] p-6 overflow-auto flex justify-center items-start min-h-[300px]"
        style={{ maxHeight: height }}
      >
        {isLoading && (
          <div className="flex flex-col items-center justify-center p-12 text-gray-400">
            <div className="w-8 h-8 border-2 border-red-500 border-t-transparent rounded-full animate-spin mb-3"></div>
            <p className="text-xs font-mono">Rendering PDF pages...</p>
          </div>
        )}

        {error && (
          <div className="flex flex-col items-center justify-center p-8 bg-red-500/10 border border-red-500/20 rounded-xl text-center max-w-md my-auto">
            <AlertCircle className="w-8 h-8 text-red-400 mb-2" />
            <h4 className="text-sm font-bold text-red-200">Unable to Render PDF</h4>
            <p className="text-xs text-red-300/80 mt-1">{error}</p>
          </div>
        )}

        <canvas
          ref={canvasRef}
          className={`bg-white shadow-2xl rounded-sm transition-all ${
            isLoading || error ? 'hidden' : 'block'
          }`}
        />
      </div>
    </div>
  );
};
