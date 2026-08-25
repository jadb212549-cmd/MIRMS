import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  Table,
  TableRow,
  TableCell,
  WidthType,
  BorderStyle,
  AlignmentType,
  HeadingLevel,
  ShadingType
} from 'docx';
import JSZip from 'jszip';
import { MasterItem, ReferenceRegistration, AppConfig } from '../types';
import { tauriBridge } from './tauriService';
import { db } from './db';

export const wordService = {
  /**
   * Processes a DOCX template's base64 content and replaces placeholders using JSZip.
   */
  async processDocxTemplate(
    base64Content: string,
    replacements: Record<string, string>
  ): Promise<Blob> {
    const binaryString = atob(base64Content);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }

    const zip = await JSZip.loadAsync(bytes.buffer);

    // XML replacement logic per paragraph node
    const replacePlaceholdersInXml = (xmlStr: string): string => {
      let updated = xmlStr;
      updated = updated.replace(/<w:p(?:\s+[^>]*>|>)([\s\S]*?)<\/w:p>/g, (pMatch) => {
        const tMatches: string[] = [];
        pMatch.replace(/<w:t(?:\s+[^>]*>|>)([\s\S]*?)<\/w:t>/g, (_, tContent) => {
          tMatches.push(tContent);
          return '';
        });

        const fullText = tMatches.join('');
        if (!fullText.includes('{{')) return pMatch;

        let subText = fullText;
        Object.entries(replacements).forEach(([key, val]) => {
          const tagPattern = new RegExp(`\\{\\{\\s*${key}\\s*\\}\\}`, 'gi');
          const safeVal = (val ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
          subText = subText.replace(tagPattern, safeVal);
        });

        if (subText === fullText) return pMatch;

        let firstReplaced = false;
        return pMatch.replace(/<w:t(?:\s+[^>]*>|>)([\s\S]*?)<\/w:t>/g, () => {
          if (!firstReplaced) {
            firstReplaced = true;
            return `<w:t xml:space="preserve">${subText}</w:t>`;
          }
          return `<w:t xml:space="preserve"></w:t>`;
        });
      });
      return updated;
    };

    const fileKeys = Object.keys(zip.files).filter(k => 
      k.startsWith('word/document') || k.startsWith('word/header') || k.startsWith('word/footer')
    );

    for (const fileKey of fileKeys) {
      const zipFile = zip.file(fileKey);
      if (zipFile) {
        const rawXml = await zipFile.async('text');
        const processedXml = replacePlaceholdersInXml(rawXml);
        zip.file(fileKey, processedXml);
      }
    }

    return await zip.generateAsync({
      type: 'blob',
      mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    });
  },

  /**
   * Generates a comprehensive, professional Microsoft Word (.docx) document
   * for the specified reference registration and master item.
   */
  async generateReferenceForm(
    registration: ReferenceRegistration,
    masterItem: MasterItem,
    config: AppConfig
  ): Promise<Blob> {
    // Check if an active custom template exists for Material Reference Sheet
    let activeTemplateContent = config.wordTemplateContent;
    let activeTemplateMappings: Record<string, string> = {};
    let activeTemplateName = config.wordTemplateName || 'Official_Template.docx';

    try {
      const activeTemplate = await db.getActiveFormTemplate('material_reference_sheet');
      if (activeTemplate && activeTemplate.fileType === 'docx' && activeTemplate.fileContent) {
        activeTemplateContent = activeTemplate.fileContent;
        activeTemplateMappings = activeTemplate.fieldMappings || {};
        activeTemplateName = activeTemplate.fileName || activeTemplate.name || activeTemplateName;
      }
    } catch (e) {
      console.warn('Could not query active form template for docx generation:', e);
    }

    // If a custom Word template (.docx base64) was uploaded, process it using JSZip
    if (activeTemplateContent) {
      try {
        // Build key-value replacements dictionary
        const replacements: Record<string, string> = {
          productCode: registration.productCode || masterItem.productCode || '',
          description: masterItem.description || '',
          materialType: (registration.materialType || masterItem.materialType || (masterItem.category === 'PS' ? 'PS' : 'RM')) === 'PS' ? 'Production Supply (PS)' : 'Raw Material (RM)',
          materialTypeCode: registration.materialType || masterItem.materialType || (masterItem.category === 'PS' ? 'PS' : 'RM'),
          category: registration.category || masterItem.category || 'Standard',
          unit: masterItem.unit || 'Piece',
          itemStatus: masterItem.status || 'Active',
          itemCreatedAt: masterItem.createdAt ? masterItem.createdAt.split('T')[0] : '2026-08-15',
          revision: registration.revision || 'Rev 01',
          registeredBy: registration.registeredBy || 'Inspector',
          registeredById: `EMP-${registration.registeredBy ? registration.registeredBy.replace(/[^a-zA-Z0-9]/g, '').slice(0, 4).toUpperCase() : 'QA01'}`,
          registrationDate: registration.registrationDate || new Date().toISOString().split('T')[0],
          registrationId: registration.id,
          proofId: `IP-${registration.productCode.replace(/[^a-zA-Z0-9]/g, '')}-${registration.id.slice(-6)}`,
          supplier: registration.supplier || 'N/A',
          lotReference: registration.lotReference || 'N/A',
          specification: registration.specification || 'N/A',
          remarks: registration.remarks || 'None',
          photosCount: String(registration.photos?.length || 0),
          photosList: (registration.photos || []).map(p => p.caption || p.fileName).join(', ') || 'None',
          attachmentsCount: String(registration.attachments?.length || 0),
          checkedBy: 'JD. Stone (System Admin)',
          checkedById: 'ADM-001',
          approvedBy: 'Quality Assurance Director',
          approvalDate: registration.registrationDate || new Date().toISOString().split('T')[0],
          inspectorSignature: '___________________________ (Sign & Date)',
          adminSignature: '___________________________ (Sign & Date)',
          companyName: config.companyName || 'Precision Industrial Manufacturing Corp.',
          department: 'Quality Assurance & Materials Engineering',
          todayDate: new Date().toISOString().split('T')[0],
          todayDateTime: new Date().toISOString().replace('T', ' ').slice(0, 19),
          currentYear: String(new Date().getFullYear()),
          documentTitle: 'MATERIAL REFERENCE & SAMPLE SPECIFICATION FORM',
          templateName: activeTemplateName
        };

        // Apply custom mappings if configured in the template
        if (Object.keys(activeTemplateMappings).length > 0) {
          Object.entries(activeTemplateMappings).forEach(([tplTag, sysKey]) => {
            const cleanTagKey = tplTag.replace(/[\{\}\s]/g, '');
            if (replacements[sysKey] !== undefined) {
              replacements[cleanTagKey] = replacements[sysKey];
            }
          });
        }

        // Custom fields mapping
        if (registration.customFields) {
          Object.entries(registration.customFields).forEach(([k, v]) => {
            const valStr = typeof v === 'boolean' ? (v ? 'YES' : 'NO') : String(v ?? '');
            replacements[k] = valStr;
            replacements[k.toLowerCase()] = valStr;
          });
        }
        
        return await this.processDocxTemplate(activeTemplateContent, replacements);
      } catch (err) {
        console.warn('Failed to parse uploaded word template content, falling back to built-in template:', err);
      }
    }

    const primaryColor = '0F172A'; // Slate 900
    const headerBgColor = 'F1F5F9'; // Slate 100
    const accentColor = '0284C7'; // Sky 600

    const matTypeDisplay = (registration.materialType || masterItem.materialType || (masterItem.category === 'PS' ? 'PS' : 'RM')) === 'PS'
      ? 'Production Supply (PS)'
      : 'Raw Material (RM)';
    const categoryDisplay = registration.category || masterItem.category || 'General';

    // Build custom fields & custom placeholder rows
    const customFieldRows: TableRow[] = [];
    const processedKeys = new Set<string>();

    if (config.customFields && config.customFields.length > 0) {
      config.customFields.forEach((cf) => {
        processedKeys.add(cf.key.toLowerCase());
        const val = registration.customFields?.[cf.key];
        const displayVal =
          val !== undefined && val !== null && val !== ''
            ? typeof val === 'boolean'
              ? val
                ? 'YES'
                : 'NO'
              : String(val)
            : cf.defaultValue || 'N/A';

        customFieldRows.push(
          new TableRow({
            children: [
              new TableCell({
                width: { size: 35, type: WidthType.PERCENTAGE },
                shading: { type: ShadingType.CLEAR, fill: 'F8FAFC' },
                children: [
                  new Paragraph({
                    children: [
                      new TextRun({
                        text: cf.label,
                        bold: true,
                        size: 20
                      })
                    ]
                  })
                ]
              }),
              new TableCell({
                width: { size: 65, type: WidthType.PERCENTAGE },
                children: [
                  new Paragraph({
                    children: [
                      new TextRun({
                        text: displayVal,
                        size: 20
                      })
                    ]
                  })
                ]
              })
            ]
          })
        );
      });
    }

    // Also include any custom defined placeholders that have values or default values
    if (config.wordDocPlaceholders && config.wordDocPlaceholders.length > 0) {
      config.wordDocPlaceholders.forEach((ph) => {
        if (!ph.isCustom) return;
        const cleanTag = ph.tag.replace(/^\{\{|\}\}$/g, '');
        if (processedKeys.has(cleanTag.toLowerCase())) return;
        processedKeys.add(cleanTag.toLowerCase());

        const rawVal = registration.customFields?.[cleanTag] ?? (ph.customFieldKey ? registration.customFields?.[ph.customFieldKey] : undefined);
        const displayVal = rawVal !== undefined && rawVal !== null && rawVal !== ''
          ? typeof rawVal === 'boolean'
            ? rawVal ? 'YES' : 'NO'
            : String(rawVal)
          : ph.defaultValue || ph.sampleValue || 'N/A';

        customFieldRows.push(
          new TableRow({
            children: [
              new TableCell({
                width: { size: 35, type: WidthType.PERCENTAGE },
                shading: { type: ShadingType.CLEAR, fill: 'F8FAFC' },
                children: [
                  new Paragraph({
                    children: [
                      new TextRun({
                        text: ph.label || cleanTag,
                        bold: true,
                        size: 20
                      })
                    ]
                  })
                ]
              }),
              new TableCell({
                width: { size: 65, type: WidthType.PERCENTAGE },
                children: [
                  new Paragraph({
                    children: [
                      new TextRun({
                        text: displayVal,
                        size: 20
                      })
                    ]
                  })
                ]
              })
            ]
          })
        );
      });
    }

    const doc = new Document({
      sections: [
        {
          properties: {
            page: {
              margin: {
                top: 1000,
                bottom: 1000,
                left: 1200,
                right: 1200
              }
            }
          },
          children: [
            // Header table with Title and metadata
            new Table({
              width: { size: 100, type: WidthType.PERCENTAGE },
              rows: [
                new TableRow({
                  children: [
                    new TableCell({
                      width: { size: 70, type: WidthType.PERCENTAGE },
                      children: [
                        new Paragraph({
                          children: [
                            new TextRun({
                              text: config.companyName || 'PRECISION INDUSTRIAL CORP.',
                              bold: true,
                              size: 20,
                              color: accentColor
                            })
                          ]
                        }),
                        new Paragraph({
                          heading: HeadingLevel.HEADING_1,
                          children: [
                            new TextRun({
                              text: 'MATERIAL REFERENCE & SAMPLE SPECIFICATION FORM',
                              bold: true,
                              size: 26,
                              color: primaryColor
                            })
                          ]
                        })
                      ]
                    }),
                    new TableCell({
                      width: { size: 30, type: WidthType.PERCENTAGE },
                      shading: { type: ShadingType.CLEAR, fill: headerBgColor },
                      children: [
                        new Paragraph({
                          alignment: AlignmentType.RIGHT,
                          children: [
                            new TextRun({
                              text: `Doc Ref: REF-${registration.productCode}`,
                              bold: true,
                              size: 18
                            })
                          ]
                        }),
                        new Paragraph({
                          alignment: AlignmentType.RIGHT,
                          children: [
                            new TextRun({
                              text: `Revision: ${registration.revision || 'Rev 01'}`,
                              bold: true,
                              size: 18,
                              color: 'DC2626'
                            })
                          ]
                        }),
                        new Paragraph({
                          alignment: AlignmentType.RIGHT,
                          children: [
                            new TextRun({
                              text: `Date: ${registration.registrationDate || new Date().toISOString().split('T')[0]}`,
                              size: 18
                            })
                          ]
                        })
                      ]
                    })
                  ]
                })
              ]
            }),

            new Paragraph({ text: '', spacing: { before: 200, after: 200 } }),

            // Section 1: Master Item Baseline Data
            new Paragraph({
              heading: HeadingLevel.HEADING_2,
              children: [
                new TextRun({
                  text: '1. MASTER ITEM REFERENCE DETAILS',
                  bold: true,
                  size: 22,
                  color: primaryColor
                })
              ]
            }),

            new Table({
              width: { size: 100, type: WidthType.PERCENTAGE },
              rows: [
                new TableRow({
                  children: [
                    new TableCell({
                      width: { size: 25, type: WidthType.PERCENTAGE },
                      shading: { type: ShadingType.CLEAR, fill: headerBgColor },
                      children: [new Paragraph({ children: [new TextRun({ text: 'Product Code:', bold: true, size: 20 })] })]
                    }),
                    new TableCell({
                      width: { size: 25, type: WidthType.PERCENTAGE },
                      children: [new Paragraph({ children: [new TextRun({ text: masterItem.productCode, bold: true, size: 20 })] })]
                    }),
                    new TableCell({
                      width: { size: 25, type: WidthType.PERCENTAGE },
                      shading: { type: ShadingType.CLEAR, fill: headerBgColor },
                      children: [new Paragraph({ children: [new TextRun({ text: 'Material Type:', bold: true, size: 20 })] })]
                    }),
                    new TableCell({
                      width: { size: 25, type: WidthType.PERCENTAGE },
                      children: [new Paragraph({ children: [new TextRun({ text: matTypeDisplay, size: 20 })] })]
                    })
                  ]
                }),
                new TableRow({
                  children: [
                    new TableCell({
                      width: { size: 25, type: WidthType.PERCENTAGE },
                      shading: { type: ShadingType.CLEAR, fill: headerBgColor },
                      children: [new Paragraph({ children: [new TextRun({ text: 'Category:', bold: true, size: 20 })] })]
                    }),
                    new TableCell({
                      width: { size: 25, type: WidthType.PERCENTAGE },
                      children: [new Paragraph({ children: [new TextRun({ text: categoryDisplay, size: 20 })] })]
                    }),
                    new TableCell({
                      width: { size: 25, type: WidthType.PERCENTAGE },
                      shading: { type: ShadingType.CLEAR, fill: headerBgColor },
                      children: [new Paragraph({ children: [new TextRun({ text: 'Unit:', bold: true, size: 20 })] })]
                    }),
                    new TableCell({
                      width: { size: 25, type: WidthType.PERCENTAGE },
                      children: [new Paragraph({ children: [new TextRun({ text: masterItem.unit || 'Piece', size: 20 })] })]
                    })
                  ]
                }),
                new TableRow({
                  children: [
                    new TableCell({
                      width: { size: 25, type: WidthType.PERCENTAGE },
                      shading: { type: ShadingType.CLEAR, fill: headerBgColor },
                      children: [new Paragraph({ children: [new TextRun({ text: 'Description:', bold: true, size: 20 })] })]
                    }),
                    new TableCell({
                      width: { size: 75, type: WidthType.PERCENTAGE },
                      columnSpan: 3,
                      children: [new Paragraph({ children: [new TextRun({ text: masterItem.description, size: 20 })] })]
                    })
                  ]
                }),
                new TableRow({
                  children: [
                    new TableCell({
                      width: { size: 25, type: WidthType.PERCENTAGE },
                      shading: { type: ShadingType.CLEAR, fill: headerBgColor },
                      children: [new Paragraph({ children: [new TextRun({ text: 'Status:', bold: true, size: 20 })] })]
                    }),
                    new TableCell({
                      width: { size: 25, type: WidthType.PERCENTAGE },
                      children: [new Paragraph({ children: [new TextRun({ text: masterItem.status, size: 20 })] })]
                    }),
                    new TableCell({
                      width: { size: 25, type: WidthType.PERCENTAGE },
                      shading: { type: ShadingType.CLEAR, fill: headerBgColor },
                      children: [new Paragraph({ children: [new TextRun({ text: 'Unit (Ref):', bold: true, size: 20 })] })]
                    }),
                    new TableCell({
                      width: { size: 25, type: WidthType.PERCENTAGE },
                      children: [new Paragraph({ children: [new TextRun({ text: masterItem.unit || 'N/A', size: 20 })] })]
                    })
                  ]
                })
              ]
            }),

            new Paragraph({ text: '', spacing: { before: 200, after: 200 } }),

            // Section 2: Reference Registration Details
            new Paragraph({
              heading: HeadingLevel.HEADING_2,
              children: [
                new TextRun({
                  text: '2. REFERENCE REGISTRATION & SAMPLING DATA',
                  bold: true,
                  size: 22,
                  color: primaryColor
                })
              ]
            }),

            new Table({
              width: { size: 100, type: WidthType.PERCENTAGE },
              rows: [
                new TableRow({
                  children: [
                    new TableCell({
                      width: { size: 25, type: WidthType.PERCENTAGE },
                      shading: { type: ShadingType.CLEAR, fill: headerBgColor },
                      children: [new Paragraph({ children: [new TextRun({ text: 'Registered By:', bold: true, size: 20 })] })]
                    }),
                    new TableCell({
                      width: { size: 25, type: WidthType.PERCENTAGE },
                      children: [new Paragraph({ children: [new TextRun({ text: registration.registeredBy, bold: true, size: 20 })] })]
                    }),
                    new TableCell({
                      width: { size: 25, type: WidthType.PERCENTAGE },
                      shading: { type: ShadingType.CLEAR, fill: headerBgColor },
                      children: [new Paragraph({ children: [new TextRun({ text: 'Registration Date:', bold: true, size: 20 })] })]
                    }),
                    new TableCell({
                      width: { size: 25, type: WidthType.PERCENTAGE },
                      children: [new Paragraph({ children: [new TextRun({ text: registration.registrationDate, size: 20 })] })]
                    })
                  ]
                }),
                new TableRow({
                  children: [
                    new TableCell({
                      width: { size: 25, type: WidthType.PERCENTAGE },
                      shading: { type: ShadingType.CLEAR, fill: headerBgColor },
                      children: [new Paragraph({ children: [new TextRun({ text: 'Supplier / Source:', bold: true, size: 20 })] })]
                    }),
                    new TableCell({
                      width: { size: 75, type: WidthType.PERCENTAGE },
                      columnSpan: 3,
                      children: [new Paragraph({ children: [new TextRun({ text: registration.supplier || 'N/A', size: 20 })] })]
                    })
                  ]
                }),
                new TableRow({
                  children: [
                    new TableCell({
                      width: { size: 25, type: WidthType.PERCENTAGE },
                      shading: { type: ShadingType.CLEAR, fill: headerBgColor },
                      children: [new Paragraph({ children: [new TextRun({ text: 'Technical Specification:', bold: true, size: 20 })] })]
                    }),
                    new TableCell({
                      width: { size: 75, type: WidthType.PERCENTAGE },
                      columnSpan: 3,
                      children: [
                        new Paragraph({
                          children: [new TextRun({ text: registration.specification || 'No technical specification recorded.', size: 20 })]
                        })
                      ]
                    })
                  ]
                }),
                new TableRow({
                  children: [
                    new TableCell({
                      width: { size: 25, type: WidthType.PERCENTAGE },
                      shading: { type: ShadingType.CLEAR, fill: headerBgColor },
                      children: [new Paragraph({ children: [new TextRun({ text: 'Remarks / Notes:', bold: true, size: 20 })] })]
                    }),
                    new TableCell({
                      width: { size: 75, type: WidthType.PERCENTAGE },
                      columnSpan: 3,
                      children: [
                        new Paragraph({
                          children: [new TextRun({ text: registration.remarks || 'None', size: 20 })]
                        })
                      ]
                    })
                  ]
                })
              ]
            }),

            new Paragraph({ text: '', spacing: { before: 200, after: 200 } }),

            // Section 3: Custom Field Attributes
            new Paragraph({
              heading: HeadingLevel.HEADING_2,
              children: [
                new TextRun({
                  text: '3. EXTENDED MATERIAL ATTRIBUTES & LOCATION',
                  bold: true,
                  size: 22,
                  color: primaryColor
                })
              ]
            }),

            new Table({
              width: { size: 100, type: WidthType.PERCENTAGE },
              rows: customFieldRows.length > 0 ? customFieldRows : [
                new TableRow({
                  children: [
                    new TableCell({
                      width: { size: 100, type: WidthType.PERCENTAGE },
                      children: [new Paragraph({ children: [new TextRun({ text: 'Standard attributes applied.', size: 20 })] })]
                    })
                  ]
                })
              ]
            }),

            new Paragraph({ text: '', spacing: { before: 200, after: 200 } }),

            // Section 4: Attached Verification Evidence
            new Paragraph({
              heading: HeadingLevel.HEADING_2,
              children: [
                new TextRun({
                  text: '4. ATTACHED SPECIMEN PHOTOS & REFERENCE CERTIFICATES',
                  bold: true,
                  size: 22,
                  color: primaryColor
                })
              ]
            }),

            new Paragraph({
              children: [
                new TextRun({
                  text: `Attached Photos: ${registration.photos?.length || 0} file(s) recorded in system archive.\n`,
                  size: 20
                }),
                new TextRun({
                  text: `Attached Documents: ${registration.attachments?.length || 0} document(s) filed under Application Data/references/.\n`,
                  size: 20
                })
              ]
            }),

            ...(registration.photos || []).map(
              (p, idx) =>
                new Paragraph({
                  children: [
                    new TextRun({
                      text: `  • Photo #${idx + 1}: ${p.fileName} ${p.caption ? `— "${p.caption}"` : ''} (Uploaded: ${p.uploadedAt.split('T')[0]})\n`,
                      size: 18,
                      italics: true
                    })
                  ]
                })
            ),

            new Paragraph({ text: '', spacing: { before: 300, after: 300 } }),

            // Section 5: Approvals and Sign-off Table
            new Table({
              width: { size: 100, type: WidthType.PERCENTAGE },
              rows: [
                new TableRow({
                  children: [
                    new TableCell({
                      width: { size: 33, type: WidthType.PERCENTAGE },
                      shading: { type: ShadingType.CLEAR, fill: headerBgColor },
                      children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'REGISTERED BY (QA/QC)', bold: true, size: 20 })] })]
                    }),
                    new TableCell({
                      width: { size: 33, type: WidthType.PERCENTAGE },
                      shading: { type: ShadingType.CLEAR, fill: headerBgColor },
                      children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'VERIFIED BY (Supervisor)', bold: true, size: 20 })] })]
                    }),
                    new TableCell({
                      width: { size: 34, type: WidthType.PERCENTAGE },
                      shading: { type: ShadingType.CLEAR, fill: headerBgColor },
                      children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'APPROVED BY (Quality Mgr)', bold: true, size: 20 })] })]
                    })
                  ]
                }),
                new TableRow({
                  children: [
                    new TableCell({
                      children: [
                        new Paragraph({ children: [new TextRun({ text: `\n\nName: ${registration.registeredBy}`, size: 18 })] }),
                        new Paragraph({ children: [new TextRun({ text: `Date: ${registration.registrationDate}`, size: 18 })] }),
                        new Paragraph({ children: [new TextRun({ text: 'Sign: ___________________', size: 18 })] })
                      ]
                    }),
                    new TableCell({
                      children: [
                        new Paragraph({ children: [new TextRun({ text: '\n\nName: ___________________', size: 18 })] }),
                        new Paragraph({ children: [new TextRun({ text: 'Date: ___________________', size: 18 })] }),
                        new Paragraph({ children: [new TextRun({ text: 'Sign: ___________________', size: 18 })] })
                      ]
                    }),
                    new TableCell({
                      children: [
                        new Paragraph({ children: [new TextRun({ text: '\n\nName: ___________________', size: 18 })] }),
                        new Paragraph({ children: [new TextRun({ text: 'Date: ___________________', size: 18 })] }),
                        new Paragraph({ children: [new TextRun({ text: 'Sign: ___________________', size: 18 })] })
                      ]
                    })
                  ]
                })
              ]
            })
          ]
        }
      ]
    });

    const blob = await Packer.toBlob(doc);
    return blob;
  },

  /**
   * Generates and downloads the Word document, updating registration status in database.
   */
  async generateAndSave(
    registration: ReferenceRegistration,
    masterItem: MasterItem,
    config: AppConfig,
    author = 'User'
  ): Promise<void> {
    const blob = await this.generateReferenceForm(registration, masterItem, config);
    const filename = `${registration.productCode}_Reference_Form_${registration.revision.replace(/\s+/g, '')}.docx`;

    // Download or save file
    tauriBridge.saveFileBlob(blob, filename);

    // Update registration record in DB
    await db.updateRegistration(
      registration.id,
      {
        wordFormGenerated: true,
        wordFormLastGeneratedAt: new Date().toISOString()
      },
      author
    );

    await db.logAudit({
      user: author,
      action: 'GENERATE_FORM',
      entityType: 'REFERENCE',
      entityId: registration.id,
      entityIdentifier: registration.productCode,
      details: `Generated official Word Reference Form (${filename})`
    });
  },

  /**
   * Retrieves the raw uploaded Word template (.docx) Blob without substitutions.
   */
  async getRawTemplateBlob(config: AppConfig): Promise<Blob | null> {
    let activeTemplateContent = config.wordTemplateContent;
    try {
      const activeTemplate = await db.getActiveFormTemplate('material_reference_sheet');
      if (activeTemplate && activeTemplate.fileType === 'docx' && activeTemplate.fileContent) {
        activeTemplateContent = activeTemplate.fileContent;
      }
    } catch (e) {
      console.warn('Could not query active form template:', e);
    }

    if (activeTemplateContent) {
      try {
        const binaryString = atob(activeTemplateContent);
        const len = binaryString.length;
        const bytes = new Uint8Array(len);
        for (let i = 0; i < len; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }
        return new Blob([bytes.buffer], {
          type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
        });
      } catch (err) {
        console.warn('Failed to parse raw template base64:', err);
      }
    }
    return null;
  },

  /**
   * Generates a preview Word document (.docx) Blob, supporting populated or raw template tags modes.
   */
  async getPreviewDocxBlob(
    registration: ReferenceRegistration | null,
    masterItem: MasterItem | null,
    config: AppConfig,
    mode: 'populated' | 'tags'
  ): Promise<Blob> {
    if (mode === 'tags') {
      const rawBlob = await this.getRawTemplateBlob(config);
      if (rawBlob) return rawBlob;
    }

    if (registration && masterItem) {
      return await this.generateReferenceForm(registration, masterItem, config);
    }

    const dummyReg: ReferenceRegistration = {
      id: 'SAMPLE-001',
      masterItemId: 'ITEM-001',
      productCode: 'SAMPLE-SPEC-01',
      materialType: 'RM',
      category: 'Standard',
      revision: 'Rev 01',
      registeredBy: config.defaultRegisteredBy || 'QA Inspector',
      registrationDate: new Date().toISOString().split('T')[0],
      supplier: 'Precision Industrial Supplier Corp.',
      specification: 'Standard sample physical and chemical QA specification parameters verified.',
      remarks: 'Certified for baseline production reference testing.',
      status: 'APPROVED',
      hasPendingRevision: false,
      revisionHistory: [],
      photos: [],
      attachments: [],
      customFields: {},
      wordFormGenerated: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    const dummyMaster: MasterItem = {
      id: 'ITEM-001',
      productCode: 'SAMPLE-SPEC-01',
      description: 'Standard Baseline Industrial Specimen Material Sample',
      materialType: 'RM',
      category: 'Raw Material',
      unit: 'Piece',
      status: 'Active',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    return await this.generateReferenceForm(dummyReg, dummyMaster, config);
  }
};
