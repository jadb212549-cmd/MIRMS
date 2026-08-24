import { FormTemplate } from '../types';
import { renderHtmlTemplateWithData } from './templateDefaults';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';

export const pdfService = {
  /**
   * Parses PDF file bytes to extract interactive form field names.
   */
  async parsePdfFormFields(base64Content: string): Promise<string[]> {
    try {
      const cleanBase64 = base64Content.includes(',') ? base64Content.split(',')[1] : base64Content;
      const pdfBytes = Uint8Array.from(atob(cleanBase64), c => c.charCodeAt(0));
      const pdfDoc = await PDFDocument.load(pdfBytes);
      const form = pdfDoc.getForm();
      const fields = form.getFields();
      return fields.map(f => f.getName());
    } catch (err) {
      console.warn('Failed to parse PDF form fields (interactive AcroForms):', err);
      return [];
    }
  },

  /**
   * Generates filled PDF based on template mapping (either form fields or coordinates)
   */
  async fillPdfTemplate(
    template: FormTemplate,
    dataDict: Record<string, string>
  ): Promise<string> {
    if (!template.fileContent) {
      throw new Error('Template has no PDF content.');
    }

    const cleanBase64 = template.fileContent.includes(',') ? template.fileContent.split(',')[1] : template.fileContent;
    const pdfBytes = Uint8Array.from(atob(cleanBase64), c => c.charCodeAt(0));

    const pdfDoc = await PDFDocument.load(pdfBytes);
    
    // 1. Fill interactive form fields if mapping is defined
    try {
      const form = pdfDoc.getForm();
      Object.entries(template.fieldMappings).forEach(([placeholder, systemKey]) => {
        const val = dataDict[systemKey] || '';
        const cleanPlaceholder = placeholder.replace(/[{}]/g, '').trim();
        
        try {
          const field = form.getField(cleanPlaceholder);
          if (field) {
            const fieldType = field.constructor.name;
            if (fieldType === 'PDFTextField' || typeof (field as any).setText === 'function') {
              (field as any).setText(val);
            } else if (fieldType === 'PDFCheckBox' || typeof (field as any).check === 'function') {
              if (val.toLowerCase() === 'true' || val === '1' || val === 'yes' || val === 'checked') {
                (field as any).check();
              } else {
                (field as any).uncheck();
              }
            }
          }
        } catch (e) {
          // ignore if field isn't in form
        }
      });
    } catch (err) {
      console.warn('AcroForm field filling skipped or unsupported:', err);
    }

    // 2. Map coordinates (Cartesian coordinate stamping)
    if (template.pdfCoordinateMappings && Object.keys(template.pdfCoordinateMappings).length > 0) {
      const pages = pdfDoc.getPages();
      const helveticaFont = await pdfDoc.embedFont(StandardFonts.Helvetica);

      for (const [key, mapping] of Object.entries(template.pdfCoordinateMappings)) {
        const val = dataDict[mapping.systemKey] || '';
        if (!val) continue;

        const pageNum = mapping.page || 1;
        if (pageNum < 1 || pageNum > pages.length) continue;

        const page = pages[pageNum - 1];
        const x = mapping.x;
        const y = mapping.y;
        const size = mapping.fontSize || 10;
        let color = rgb(0.1, 0.1, 0.1);

        if (mapping.textColor) {
          try {
            const hex = mapping.textColor.replace('#', '');
            const r = parseInt(hex.substring(0, 2), 16) / 255;
            const g = parseInt(hex.substring(2, 4), 16) / 255;
            const b = parseInt(hex.substring(4, 6), 16) / 255;
            color = rgb(r, g, b);
          } catch (e) {
            // keep default
          }
        }

        page.drawText(val, {
          x,
          y,
          size,
          font: helveticaFont,
          color,
        });
      }
    }

    const filledPdfBytes = await pdfDoc.save();
    
    // Convert bytes back to base64
    let binary = '';
    const len = filledPdfBytes.byteLength;
    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(filledPdfBytes[i]);
    }
    return btoa(binary);
  },

  /**
   * Downloads a PDF file from a base64 string.
   */
  downloadPdfFromBase64(base64Data: string, fileName: string): void {
    try {
      const cleanBase64 = base64Data.includes(',') ? base64Data.split(',')[1] : base64Data;
      const byteCharacters = atob(cleanBase64);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);

      const a = document.createElement('a');
      a.href = url;
      a.download = fileName.endsWith('.pdf') ? fileName : `${fileName}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Failed to download PDF from base64:', err);
      throw new Error('Invalid PDF file content');
    }
  },

  /**
   * Renders HTML content into a print view window styled for PDF export.
   * Invokes window.print() so the user can Save as PDF or print directly.
   */
  exportHtmlToPdf(htmlContent: string, documentTitle: string = 'Material_Form_Export'): void {
    const printWindow = window.open('', '_blank', 'width=850,height=1100');
    if (!printWindow) {
      alert('Please allow popups to export PDF documents.');
      return;
    }

    const styledDoc = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <title>${documentTitle}</title>
          <style>
            @page {
              size: A4 portrait;
              margin: 12mm;
            }
            body {
              font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
              color: #111827;
              background: #ffffff;
              margin: 0;
              padding: 0;
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
            }
            .pdf-container {
              width: 100%;
              box-sizing: border-box;
            }
            @media print {
              body {
                background: #ffffff;
              }
              .no-print {
                display: none !important;
              }
            }
          </style>
        </head>
        <body>
          <div class="pdf-container">
            ${htmlContent}
          </div>
          <script>
            window.onload = function() {
              setTimeout(function() {
                window.print();
              }, 300);
            };
          </script>
        </body>
      </html>
    `;

    printWindow.document.open();
    printWindow.document.write(styledDoc);
    printWindow.document.close();
  },

  /**
   * Exports a FormTemplate (PDF, HTML, DOCX, TXT) as a PDF file or PDF print view.
   */
  async exportTemplateAsPdf(
    template: FormTemplate,
    sampleDict: Record<string, string>,
    customTitle?: string
  ): Promise<void> {
    const title = customTitle || template.name.replace(/\s+/g, '_');

    if (template.fileType === 'pdf' && template.fileContent) {
      try {
        const filledBase64 = await this.fillPdfTemplate(template, sampleDict);
        this.downloadPdfFromBase64(filledBase64, `${title}.pdf`);
      } catch (err) {
        console.error('Failed to generate mapped PDF:', err);
        // Fallback to basic downloading
        this.downloadPdfFromBase64(template.fileContent, `${title}.pdf`);
      }
      return;
    }

    if (template.fileContent) {
      const renderedHtml = renderHtmlTemplateWithData(
        template.fileContent,
        sampleDict,
        template.fieldMappings,
        template.customCss
      );
      this.exportHtmlToPdf(renderedHtml, title);
    } else {
      throw new Error('Template has no content to export as PDF.');
    }
  }
};
