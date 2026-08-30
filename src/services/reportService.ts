// ============================================================
// Unified Report Generation Service (PDF & DOCX)
// Ensures 100% data consistency between PDF Certificate and
// Microsoft Word (.docx) Editable Report
// ============================================================

import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  Table,
  TableRow,
  TableCell,
  WidthType,
  AlignmentType,
  HeadingLevel,
  BorderStyle,
  ShadingType,
  convertInchesToTwip,
} from 'docx';
import type { ScannedProduct } from '../types';
import {
  CATEGORY_REQUIREMENTS,
  normalizeCategory,
  validateBarcodeGTIN,
  validateFSSAI,
  validateCategoryLicense,
} from './categoryRequirements';

export interface AuditChecklistItem {
  field: string;
  status: 'PASS' | 'FAIL' | 'NOT APPLICABLE';
  value: string;
  validationDetails: string;
  requirement: string;
}

export interface UnifiedReportData {
  certificateId: string;
  productName: string;
  category: string;
  barcode: string;
  barcodeValidationText: string;
  mrp: string;
  scannedAt: string;
  complianceScore: number;
  complianceStatus: string;
  checklist: AuditChecklistItem[];
  violations: Array<{
    severity: string;
    label: string;
    message: string;
  }>;
  notes: string;
  legalAct: string;
}

export function buildUnifiedReportData(product: ScannedProduct): UnifiedReportData {
  const cat = normalizeCategory(product.category);
  const spec = CATEGORY_REQUIREMENTS[cat] || CATEGORY_REQUIREMENTS['General Packaged Commodities'];
  const decs = product.declarations || ({} as any);

  // Barcode validation info
  let barcodeValidationText = 'Not Detected / Optional';
  if (product.barcode && product.barcode.trim()) {
    const bRes = validateBarcodeGTIN(product.barcode);
    barcodeValidationText = bRes.message;
  }

  // Audit Checklist items dynamically tailored to category
  const checklist: AuditChecklistItem[] = [];

  // 1. Generic Name
  checklist.push({
    field: 'Generic / Product Name',
    status: decs.genericName?.present ? 'PASS' : 'FAIL',
    value: decs.genericName?.value || product.productName || 'Missing',
    validationDetails: decs.genericName?.present ? 'Format valid — common identity identified' : 'Required declaration missing',
    requirement: 'Mandatory',
  });

  // 2. Net Quantity
  checklist.push({
    field: 'Net Quantity',
    status: decs.netQuantity?.present ? 'PASS' : 'FAIL',
    value: decs.netQuantity?.value || 'Missing',
    validationDetails: decs.netQuantity?.present ? 'Standard metric unit verified' : 'Required declaration missing',
    requirement: 'Mandatory',
  });

  // 3. MRP
  checklist.push({
    field: 'Maximum Retail Price (MRP)',
    status: decs.mrp?.present ? 'PASS' : 'FAIL',
    value: decs.mrp?.value || product.mrp || 'Missing',
    validationDetails: decs.mrp?.present ? 'Inclusive of all taxes' : 'Mandatory consumer price missing',
    requirement: 'Mandatory',
  });

  // 4. Manufacture Date
  checklist.push({
    field: 'Date of Manufacture / Packing',
    status: decs.manufactureDate?.present ? 'PASS' : 'FAIL',
    value: decs.manufactureDate?.value || 'Missing',
    validationDetails: decs.manufactureDate?.present ? 'Calendar packing date valid' : 'Required date missing',
    requirement: 'Mandatory',
  });

  // 5. Best Before / Expiry Date
  const expirySpec = spec.mandatoryDeclarations.find(d => d.key === 'bestBefore');
  if (expirySpec?.requirement === 'NOT_APPLICABLE') {
    checklist.push({
      field: 'Best Before / Expiry Date',
      status: 'NOT APPLICABLE',
      value: decs.bestBefore?.value || 'N/A',
      validationDetails: 'Not statutory requirement for non-perishable commodity',
      requirement: 'Not Applicable',
    });
  } else {
    checklist.push({
      field: 'Best Before / Expiry Date',
      status: decs.bestBefore?.present ? 'PASS' : (expirySpec?.requirement === 'OPTIONAL' ? 'NOT APPLICABLE' : 'FAIL'),
      value: decs.bestBefore?.value || 'Missing',
      validationDetails: decs.bestBefore?.present ? 'Shelf life / expiry date verified' : 'Required expiry declaration missing',
      requirement: expirySpec?.requirement === 'REQUIRED' ? 'Mandatory' : 'Optional',
    });
  }

  // 6. Manufacturer
  checklist.push({
    field: 'Manufacturer & Address',
    status: decs.manufacturer?.present ? 'PASS' : 'FAIL',
    value: decs.manufacturer?.value || 'Missing',
    validationDetails: decs.manufacturer?.present ? 'Name and physical address identified' : 'Manufacturer identity missing',
    requirement: 'Mandatory',
  });

  // 7. Consumer Care
  checklist.push({
    field: 'Consumer Care Contact Details',
    status: decs.consumerCare?.present ? 'PASS' : 'FAIL',
    value: decs.consumerCare?.value || 'Missing',
    validationDetails: decs.consumerCare?.present ? 'Consumer grievance helpline/email verified' : 'Mandatory consumer helpline missing',
    requirement: 'Mandatory',
  });

  // 8. Category-Specific Regulatory Identifier (FSSAI, Drug Lic, Cosmetics Lic, BIS)
  if (cat === 'Food & Beverage') {
    const fssaiVal = decs.fssaiLicense?.value || product.regulatoryLicense || null;
    const fVal = validateFSSAI(fssaiVal);
    checklist.push({
      field: 'FSSAI License / Registration No.',
      status: fVal.isValid ? 'PASS' : 'FAIL',
      value: fssaiVal || 'Missing',
      validationDetails: fVal.message,
      requirement: 'Required for Food & Beverage',
    });
  } else {
    // Non-food category: FSSAI is Not Applicable
    checklist.push({
      field: 'FSSAI License Number',
      status: 'NOT APPLICABLE',
      value: 'N/A',
      validationDetails: `FSSAI is not applicable to category: ${cat}`,
      requirement: 'Not Applicable',
    });

    // Add sectoral requirement
    if (spec.regulatoryField.key) {
      const regVal = decs[spec.regulatoryField.key]?.value || decs.regulatoryLicense?.value || product.regulatoryLicense || null;
      const regCheck = validateCategoryLicense(cat, regVal);
      const isReq = spec.regulatoryField.requirement === 'REQUIRED';

      checklist.push({
        field: spec.regulatoryField.label,
        status: regCheck.isValid ? (regVal ? 'PASS' : (isReq ? 'FAIL' : 'NOT APPLICABLE')) : 'FAIL',
        value: regVal || 'Not Provided',
        validationDetails: regCheck.message,
        requirement: isReq ? `Mandatory for ${cat}` : 'Applicable / Recommended',
      });
    }
  }

  // 9. Country of Origin
  checklist.push({
    field: 'Country of Origin',
    status: decs.countryOfOrigin?.present ? 'PASS' : 'FAIL',
    value: decs.countryOfOrigin?.value || 'Missing',
    validationDetails: decs.countryOfOrigin?.present ? 'Country of origin stated' : 'Required if imported or manufactured abroad',
    requirement: 'Mandatory if Imported',
  });

  // 10. Unit Sale Price (USP)
  checklist.push({
    field: 'Unit Sale Price (USP)',
    status: decs.retailSalePrice?.present ? 'PASS' : 'FAIL',
    value: decs.retailSalePrice?.value || 'Missing',
    validationDetails: decs.retailSalePrice?.present ? 'Unit price calculated & verified' : 'Unit price declaration recommended',
    requirement: 'Mandatory per Rule 6(11)',
  });

  const violations = (product.violations || []).map(v => ({
    severity: v.severity.toUpperCase(),
    label: v.label,
    message: v.message,
  }));

  return {
    certificateId: product.id,
    productName: product.productName,
    category: cat,
    barcode: product.barcode || 'Not Detected',
    barcodeValidationText,
    mrp: product.mrp || decs.mrp?.value || 'Not Set',
    scannedAt: new Date(product.scannedAt).toLocaleString(),
    complianceScore: product.complianceScore,
    complianceStatus: product.complianceStatus,
    checklist,
    violations,
    notes: product.notes || '',
    legalAct: `${cat} Statutory Compliance & Legal Metrology (Packaged Commodities) Rules, 2011`,
  };
}

// ------------------------------------------------------------
// PDF Certificate Export (jsPDF)
// ------------------------------------------------------------

export function exportComplianceReportPDF(product: ScannedProduct): void {
  const data = buildUnifiedReportData(product);

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

  // Top Banner
  doc.setFillColor(29, 78, 216);
  doc.rect(0, 0, 210, 40, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(22);
  doc.setTextColor(255, 255, 255);
  doc.text('LABEL LENS', 15, 18);

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(219, 234, 254);
  doc.text('COMPLIANCE INSPECTION CERTIFICATE', 15, 25);
  doc.text(`Certificate ID: ${data.certificateId}`, 15, 30);

  // Score Badge in Banner
  doc.setFillColor(255, 255, 255);
  doc.roundedRect(155, 8, 42, 24, 3, 3, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(75, 85, 99);
  doc.text('SCORE', 176, 14, { align: 'center' });
  doc.setFontSize(15);
  doc.setTextColor(29, 78, 216);
  doc.text(`${data.complianceScore}%`, 176, 21, { align: 'center' });
  doc.setFontSize(6.5);
  doc.setTextColor(107, 114, 128);
  doc.text(data.complianceStatus.toUpperCase(), 176, 26, { align: 'center' });

  // Product Information Section
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(31, 41, 55);
  doc.text('Product Information & Classification', 15, 48);
  doc.setLineWidth(0.4);
  doc.setDrawColor(229, 231, 235);
  doc.line(15, 50, 195, 50);

  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'bold');
  doc.text('Product Name:', 15, 57);
  doc.setFont('helvetica', 'normal');
  doc.text(data.productName, 45, 57);

  doc.setFont('helvetica', 'bold');
  doc.text('Category:', 15, 63);
  doc.setFont('helvetica', 'normal');
  doc.text(data.category, 45, 63);

  doc.setFont('helvetica', 'bold');
  doc.text('Barcode GTIN:', 15, 69);
  doc.setFont('helvetica', 'normal');
  doc.text(`${data.barcode} (${data.barcodeValidationText})`, 45, 69, { maxWidth: 145 });

  doc.setFont('helvetica', 'bold');
  doc.text('MRP / Pricing:', 15, 75);
  doc.setFont('helvetica', 'normal');
  doc.text(data.mrp, 45, 75);

  doc.setFont('helvetica', 'bold');
  doc.text('Audit Date:', 15, 81);
  doc.setFont('helvetica', 'normal');
  doc.text(data.scannedAt, 45, 81);

  // Declarations Audit Checklist Table
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(31, 41, 55);
  doc.text('Sectoral & Legal Metrology Declaration Audit', 15, 92);

  const tableRows = data.checklist.map(item => [
    item.field,
    item.status,
    item.value,
    item.validationDetails,
    item.requirement,
  ]);

  autoTable(doc, {
    startY: 96,
    head: [['Declaration Field', 'Status', 'Declared Value', 'Validation Notes', 'Statutory Requirement']],
    body: tableRows,
    theme: 'striped',
    headStyles: { fillColor: [29, 78, 216], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 7.5 },
    bodyStyles: { fontSize: 7, textColor: [55, 65, 81] },
    columnStyles: {
      0: { cellWidth: 40, fontStyle: 'bold' },
      1: { cellWidth: 18, fontStyle: 'bold' },
      2: { cellWidth: 40 },
      3: { cellWidth: 50 },
      4: { cellWidth: 32 },
    },
    didParseCell: (cellData) => {
      if (cellData.column.index === 1) {
        if (cellData.cell.raw === 'PASS') {
          cellData.cell.styles.textColor = [16, 185, 129];
        } else if (cellData.cell.raw === 'FAIL') {
          cellData.cell.styles.textColor = [239, 68, 68];
        } else {
          cellData.cell.styles.textColor = [107, 114, 128];
        }
      }
    },
  });

  let finalY = (doc as any).lastAutoTable.finalY + 8;

  // Violations Table
  if (data.violations.length > 0) {
    if (finalY > 230) {
      doc.addPage();
      finalY = 20;
    }
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10.5);
    doc.setTextColor(185, 28, 28);
    doc.text(`Identified Statutory Deficiencies & Violations (${data.violations.length})`, 15, finalY);

    const violationRows = data.violations.map((v, i) => [
      `${i + 1}`,
      v.severity,
      v.label,
      v.message,
    ]);

    autoTable(doc, {
      startY: finalY + 4,
      head: [['#', 'Severity', 'Rule Area', 'Deficiency Details']],
      body: violationRows,
      theme: 'plain',
      headStyles: { fillColor: [254, 226, 226], textColor: [153, 27, 27], fontStyle: 'bold', fontSize: 7.5 },
      bodyStyles: { fontSize: 7, textColor: [127, 29, 29] },
      columnStyles: {
        0: { cellWidth: 8 },
        1: { cellWidth: 20, fontStyle: 'bold' },
        2: { cellWidth: 45, fontStyle: 'bold' },
        3: { cellWidth: 107 },
      },
    });
    finalY = (doc as any).lastAutoTable.finalY + 8;
  }

  // Inspector Notes
  if (data.notes) {
    if (finalY > 245) {
      doc.addPage();
      finalY = 20;
    }
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.setTextColor(31, 41, 55);
    doc.text('Inspector Field Notes:', 15, finalY);
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(8);
    doc.setTextColor(75, 85, 99);
    doc.text(data.notes, 15, finalY + 4.5, { maxWidth: 180 });
  }

  // Footer on all pages
  const pageCount = (doc as any).internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(156, 163, 175);
    doc.text('Generated by Label Lens Verification System — Legal Metrology & Sectoral Compliance', 15, 290);
    doc.text(`Page ${i} of ${pageCount}`, 195, 290, { align: 'right' });
  }

  const safeName = data.productName.replace(/[^a-zA-Z0-9]/g, '_');
  doc.save(`Label_Lens_${safeName}_Certificate.pdf`);
}

// ------------------------------------------------------------
// Microsoft Word (.DOCX) Editable Report Export (docx npm)
// ------------------------------------------------------------

export async function exportComplianceReportDOCX(product: ScannedProduct): Promise<void> {
  const data = buildUnifiedReportData(product);

  const doc = new Document({
    sections: [
      {
        properties: {
          page: {
            margin: {
              top: convertInchesToTwip(0.75),
              bottom: convertInchesToTwip(0.75),
              left: convertInchesToTwip(0.75),
              right: convertInchesToTwip(0.75),
            },
          },
        },
        children: [
          // Header
          new Paragraph({
            heading: HeadingLevel.HEADING_1,
            alignment: AlignmentType.CENTER,
            children: [
              new TextRun({
                text: 'LABEL LENS',
                bold: true,
                size: 36,
                color: '1D4ED8',
              }),
            ],
          }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { after: 120 },
            children: [
              new TextRun({
                text: 'COMPLIANCE INSPECTION CERTIFICATE & AUDIT REPORT',
                bold: true,
                size: 20,
                color: '4B5563',
              }),
            ],
          }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { after: 240 },
            children: [
              new TextRun({
                text: `Certificate ID: ${data.certificateId}   |   Inspection Date: ${data.scannedAt}`,
                italics: true,
                size: 16,
                color: '6B7280',
              }),
            ],
          }),

          // Score Summary Box (Table)
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: [
              new TableRow({
                children: [
                  new TableCell({
                    shading: { type: ShadingType.CLEAR, fill: 'EFF6FF' },
                    children: [
                      new Paragraph({
                        alignment: AlignmentType.CENTER,
                        children: [
                          new TextRun({ text: 'COMPLIANCE SCORE: ', bold: true, size: 24, color: '1E40AF' }),
                          new TextRun({ text: `${data.complianceScore}%`, bold: true, size: 28, color: '1D4ED8' }),
                          new TextRun({ text: `   [${data.complianceStatus.toUpperCase()}]`, bold: true, size: 22, color: data.complianceScore === 100 ? '059669' : data.complianceScore === 0 ? 'DC2626' : 'D97706' }),
                        ],
                      }),
                    ],
                  }),
                ],
              }),
            ],
          }),

          // Product Details Heading
          new Paragraph({
            heading: HeadingLevel.HEADING_2,
            spacing: { before: 240, after: 100 },
            children: [
              new TextRun({ text: '1. Product Information & Classification', bold: true, size: 22, color: '1F2937' }),
            ],
          }),

          // Product Info Table
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: [
              new TableRow({
                children: [
                  new TableCell({ width: { size: 25, type: WidthType.PERCENTAGE }, children: [new Paragraph({ children: [new TextRun({ text: 'Product Identity:', bold: true, size: 18 })] })] }),
                  new TableCell({ width: { size: 75, type: WidthType.PERCENTAGE }, children: [new Paragraph({ children: [new TextRun({ text: data.productName, size: 18 })] })] }),
                ],
              }),
              new TableRow({
                children: [
                  new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: 'Product Category:', bold: true, size: 18 })] })] }),
                  new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: data.category, bold: true, color: '1D4ED8', size: 18 })] })] }),
                ],
              }),
              new TableRow({
                children: [
                  new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: 'Barcode GTIN:', bold: true, size: 18 })] })] }),
                  new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: `${data.barcode} (${data.barcodeValidationText})`, size: 18 })] })] }),
                ],
              }),
              new TableRow({
                children: [
                  new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: 'MRP (Price):', bold: true, size: 18 })] })] }),
                  new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: data.mrp, bold: true, color: '059669', size: 18 })] })] }),
                ],
              }),
              new TableRow({
                children: [
                  new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: 'Governing Act:', bold: true, size: 18 })] })] }),
                  new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: data.legalAct, italics: true, size: 18 })] })] }),
                ],
              }),
            ],
          }),

          // Checklist Heading
          new Paragraph({
            heading: HeadingLevel.HEADING_2,
            spacing: { before: 280, after: 100 },
            children: [
              new TextRun({ text: '2. Sectoral & Legal Metrology Declaration Audit', bold: true, size: 22, color: '1F2937' }),
            ],
          }),

          // Declarations Table
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: [
              new TableRow({
                tableHeader: true,
                children: [
                  new TableCell({ shading: { type: ShadingType.CLEAR, fill: '1D4ED8' }, children: [new Paragraph({ children: [new TextRun({ text: 'Declaration Field', bold: true, color: 'FFFFFF', size: 17 })] })] }),
                  new TableCell({ shading: { type: ShadingType.CLEAR, fill: '1D4ED8' }, children: [new Paragraph({ children: [new TextRun({ text: 'Status', bold: true, color: 'FFFFFF', size: 17 })] })] }),
                  new TableCell({ shading: { type: ShadingType.CLEAR, fill: '1D4ED8' }, children: [new Paragraph({ children: [new TextRun({ text: 'Declared Value', bold: true, color: 'FFFFFF', size: 17 })] })] }),
                  new TableCell({ shading: { type: ShadingType.CLEAR, fill: '1D4ED8' }, children: [new Paragraph({ children: [new TextRun({ text: 'Validation Notes', bold: true, color: 'FFFFFF', size: 17 })] })] }),
                  new TableCell({ shading: { type: ShadingType.CLEAR, fill: '1D4ED8' }, children: [new Paragraph({ children: [new TextRun({ text: 'Requirement', bold: true, color: 'FFFFFF', size: 17 })] })] }),
                ],
              }),
              ...data.checklist.map(item =>
                new TableRow({
                  children: [
                    new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: item.field, bold: true, size: 16 })] })] }),
                    new TableCell({
                      children: [
                        new Paragraph({
                          children: [
                            new TextRun({
                              text: item.status,
                              bold: true,
                              color: item.status === 'PASS' ? '059669' : item.status === 'FAIL' ? 'DC2626' : '6B7280',
                              size: 16,
                            }),
                          ],
                        }),
                      ],
                    }),
                    new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: item.value, size: 16 })] })] }),
                    new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: item.validationDetails, italics: true, size: 15 })] })] }),
                    new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: item.requirement, size: 15 })] })] }),
                  ],
                })
              ),
            ],
          }),

          // Violations Section
          new Paragraph({
            heading: HeadingLevel.HEADING_2,
            spacing: { before: 280, after: 100 },
            children: [
              new TextRun({
                text: `3. Statutory Violations & Deficiencies (${data.violations.length})`,
                bold: true,
                size: 22,
                color: data.violations.length > 0 ? 'DC2626' : '059669',
              }),
            ],
          }),

          ...(data.violations.length > 0
            ? [
                new Table({
                  width: { size: 100, type: WidthType.PERCENTAGE },
                  rows: [
                    new TableRow({
                      tableHeader: true,
                      children: [
                        new TableCell({ shading: { type: ShadingType.CLEAR, fill: 'FEE2E2' }, children: [new Paragraph({ children: [new TextRun({ text: '#', bold: true, color: '991B1B', size: 16 })] })] }),
                        new TableCell({ shading: { type: ShadingType.CLEAR, fill: 'FEE2E2' }, children: [new Paragraph({ children: [new TextRun({ text: 'Severity', bold: true, color: '991B1B', size: 16 })] })] }),
                        new TableCell({ shading: { type: ShadingType.CLEAR, fill: 'FEE2E2' }, children: [new Paragraph({ children: [new TextRun({ text: 'Rule Area', bold: true, color: '991B1B', size: 16 })] })] }),
                        new TableCell({ shading: { type: ShadingType.CLEAR, fill: 'FEE2E2' }, children: [new Paragraph({ children: [new TextRun({ text: 'Deficiency Details', bold: true, color: '991B1B', size: 16 })] })] }),
                      ],
                    }),
                    ...data.violations.map((v, i) =>
                      new TableRow({
                        children: [
                          new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: `${i + 1}`, size: 16 })] })] }),
                          new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: v.severity, bold: true, color: 'DC2626', size: 16 })] })] }),
                          new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: v.label, bold: true, size: 16 })] })] }),
                          new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: v.message, size: 16 })] })] }),
                        ],
                      })
                    ),
                  ],
                }),
              ]
            : [
                new Paragraph({
                  children: [
                    new TextRun({
                      text: 'No rule violations detected. All applicable mandatory packaging declarations are present and valid.',
                      color: '059669',
                      italics: true,
                      size: 18,
                    }),
                  ],
                }),
              ]),

          // Inspector Notes Section
          new Paragraph({
            heading: HeadingLevel.HEADING_2,
            spacing: { before: 280, after: 100 },
            children: [
              new TextRun({ text: '4. Inspector Field Notes & Observations', bold: true, size: 22, color: '1F2937' }),
            ],
          }),
          new Paragraph({
            spacing: { after: 200 },
            children: [
              new TextRun({
                text: data.notes || 'No custom inspector observations entered for this product scan.',
                italics: !data.notes,
                size: 18,
                color: data.notes ? '111827' : '6B7280',
              }),
            ],
          }),

          // Disclaimer & Attribution Footer
          new Paragraph({
            spacing: { before: 300 },
            alignment: AlignmentType.CENTER,
            children: [
              new TextRun({
                text: 'Generated by Label Lens Verification System. Valid for regulatory review under Legal Metrology Rules, 2011 & sectoral statutes.',
                size: 14,
                color: '9CA3AF',
                italics: true,
              }),
            ],
          }),
        ],
      },
    ],
  });

  const blob = await Packer.toBlob(doc);
  const safeName = data.productName.replace(/[^a-zA-Z0-9]/g, '_');
  const filename = `Label_Lens_${safeName}_Editable_Report.docx`;

  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
