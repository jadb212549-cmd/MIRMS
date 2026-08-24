import { FormTemplate } from '../types';
import { renderHtmlTemplateWithData } from './templateDefaults';

export const pdfService = {
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
          <div className="pdf-container">
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
  exportTemplateAsPdf(
    template: FormTemplate,
    sampleDict: Record<string, string>,
    customTitle?: string
  ): void {
    const title = customTitle || template.name.replace(/\s+/g, '_');

    if (template.fileType === 'pdf' && template.fileContent) {
      // Direct PDF download or viewing
      this.downloadPdfFromBase64(template.fileContent, `${title}.pdf`);
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
