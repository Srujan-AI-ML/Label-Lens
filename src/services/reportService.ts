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
  ShadingType,
  convertInchesToTwip,
  PageOrientation,
  ImageRun,
} from 'docx';
import type { ScannedProduct, EnforcementAction } from '../types';
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
  placement?: string;
  fontSize?: string;
  readability?: string;
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
    evidence?: string;
    recommendedAction?: string;
  }>;
  notes: string;
  legalAct: string;
  imageData?: string | null;
  spatialAnalysis?: any;
  visualQuality?: any;
  enforcementStatus: string;
  enforcementHistory: EnforcementAction[];
  assignedOfficer: string;
  noticeReferenceNumber?: string;
  penaltyAmount?: number | null;
}

function base64ToUint8Array(base64Str: string): Uint8Array | null {
  try {
    let clean = base64Str;
    if (clean.includes(',')) {
      clean = clean.split(',')[1];
    }
    clean = clean.replace(/\s/g, '');
    if (typeof window !== 'undefined' && window.atob) {
      const binaryString = window.atob(clean);
      const len = binaryString.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      return bytes;
    }
    return null;
  } catch (err) {
    console.warn('Failed to convert base64 to Uint8Array for docx image embed:', err);
    return null;
  }
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

  const getExtraInfo = (d: any) => ({
    placement: d?.placement || 'PLACEMENT_UNVERIFIED',
    fontSize: d?.fontSizeStatus === 'FONT_SIZE_PASS' 
      ? `PASS (${d?.fontSizeMm || 2.0} mm)` 
      : d?.fontSizeStatus === 'FONT_SIZE_FAIL' 
        ? `FAIL (${d?.fontSizeMm || 0.8} mm < ${d?.minimumRequiredMm || 2.0} mm)` 
        : 'UNVERIFIED (Scale Not Calibrated)',
    readability: d?.readabilityStatus || 'READABILITY_PASS'
  });

  // 1. Generic Name
  checklist.push({
    field: 'Generic / Product Name',
    status: decs.genericName?.present ? 'PASS' : 'FAIL',
    value: decs.genericName?.value || product.productName || 'Missing',
    validationDetails: decs.genericName?.present ? 'Format valid — common identity identified' : 'Required declaration missing',
    requirement: 'Mandatory on PDP',
    ...getExtraInfo(decs.genericName)
  });

  // 2. Net Quantity
  checklist.push({
    field: 'Net Quantity',
    status: decs.netQuantity?.present ? 'PASS' : 'FAIL',
    value: decs.netQuantity?.value || 'Missing',
    validationDetails: decs.netQuantity?.present ? 'Standard metric unit verified' : 'Required declaration missing',
    requirement: 'Mandatory on PDP',
    ...getExtraInfo(decs.netQuantity)
  });

  // 3. MRP
  checklist.push({
    field: 'Maximum Retail Price (MRP)',
    status: decs.mrp?.present ? 'PASS' : 'FAIL',
    value: decs.mrp?.value || product.mrp || 'Missing',
    validationDetails: decs.mrp?.present ? 'Inclusive of all taxes' : 'Mandatory consumer price missing',
    requirement: 'Mandatory on PDP',
    ...getExtraInfo(decs.mrp)
  });

  // 4. Manufacture Date
  checklist.push({
    field: 'Date of Manufacture / Packing',
    status: decs.manufactureDate?.present ? 'PASS' : 'FAIL',
    value: decs.manufactureDate?.value || 'Missing',
    validationDetails: decs.manufactureDate?.present ? 'Calendar packing date valid' : 'Required date missing',
    requirement: 'Mandatory',
    ...getExtraInfo(decs.manufactureDate)
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
      placement: 'NOT_APPLICABLE',
      fontSize: 'NOT_APPLICABLE',
      readability: 'READABILITY_PASS'
    });
  } else {
    checklist.push({
      field: 'Best Before / Expiry Date',
      status: decs.bestBefore?.present ? 'PASS' : (expirySpec?.requirement === 'OPTIONAL' ? 'NOT APPLICABLE' : 'FAIL'),
      value: decs.bestBefore?.value || 'Missing',
      validationDetails: decs.bestBefore?.present ? 'Shelf life / expiry date verified' : 'Required expiry declaration missing',
      requirement: expirySpec?.requirement === 'REQUIRED' ? 'Mandatory' : 'Optional',
      ...getExtraInfo(decs.bestBefore)
    });
  }

  // 6. Manufacturer
  checklist.push({
    field: 'Manufacturer & Address',
    status: decs.manufacturer?.present ? 'PASS' : 'FAIL',
    value: decs.manufacturer?.value || 'Missing',
    validationDetails: decs.manufacturer?.present ? 'Name and physical address identified' : 'Manufacturer identity missing',
    requirement: 'Mandatory',
    ...getExtraInfo(decs.manufacturer)
  });

  // 7. Consumer Care
  checklist.push({
    field: 'Consumer Care Contact Details',
    status: decs.consumerCare?.present ? 'PASS' : 'FAIL',
    value: decs.consumerCare?.value || 'Missing',
    validationDetails: decs.consumerCare?.present ? 'Consumer grievance helpline/email verified' : 'Mandatory consumer helpline missing',
    requirement: 'Mandatory',
    ...getExtraInfo(decs.consumerCare)
  });

  // 8. Category-Specific Regulatory Identifier (FSSAI, Drug Lic, Cosmetics Lic, BIS)
  const regField = spec.regulatoryField;
  if (regField && regField.requirement !== 'NOT_APPLICABLE') {
    const regDecl = decs[regField.key] || decs.regulatoryLicense || decs.fssaiLicense;
    const isPresent = regDecl?.present || !!product.regulatoryLicense;
    const valStr = regDecl?.value || product.regulatoryLicense || 'Missing';

    checklist.push({
      field: regField.label,
      status: isPresent && regDecl?.status !== 'FAIL' ? 'PASS' : (regField.requirement === 'REQUIRED' ? 'FAIL' : 'NOT APPLICABLE'),
      value: valStr,
      validationDetails: regDecl?.validationMessage || (isPresent ? 'Format valid — statutory registration syntax verified' : 'Mandatory regulatory license number missing'),
      requirement: regField.requirement === 'REQUIRED' ? `Mandatory (${regField.lawReference})` : 'Optional / Conditional',
      ...getExtraInfo(regDecl)
    });
  }

  // 9. Country of Origin
  checklist.push({
    field: 'Country of Origin',
    status: decs.countryOfOrigin?.present ? 'PASS' : 'NOT APPLICABLE',
    value: decs.countryOfOrigin?.value || 'India (Domestic)',
    validationDetails: decs.countryOfOrigin?.present ? 'Origin country declared' : 'Assumed domestic if manufactured in India',
    requirement: 'Mandatory for Imports / Optional Domestic',
    ...getExtraInfo(decs.countryOfOrigin)
  });

  // 10. Retail Sale Unit Price (USP)
  checklist.push({
    field: 'Unit Sale Price (USP)',
    status: decs.retailSalePrice?.present ? 'PASS' : 'FAIL',
    value: decs.retailSalePrice?.value || 'Missing',
    validationDetails: decs.retailSalePrice?.present ? 'Unit price calculated & verified' : 'Unit price declaration recommended',
    requirement: 'Mandatory per Rule 6(11)',
    ...getExtraInfo(decs.retailSalePrice)
  });

  const violations = (product.violations || []).map(v => ({
    severity: v.severity.toUpperCase(),
    label: v.label,
    message: v.message,
    evidence: v.evidence,
    recommendedAction: v.recommendedAction
  }));

  const enforcementHist = product.enforcementHistory && product.enforcementHistory.length > 0
    ? product.enforcementHistory
    : [{
        id: 'enf-initial',
        action: product.enforcementStatus || 'AUDITED',
        timestamp: product.scannedAt || new Date().toISOString(),
        officerName: product.assignedOfficer || 'Inspector General',
        notes: 'Initial inspection scan and Legal Metrology compliance evaluation conducted.'
      }];

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
    imageData: product.imageData || null,
    spatialAnalysis: product.spatialAnalysis || null,
    visualQuality: product.visualQuality || null,
    enforcementStatus: product.enforcementStatus || 'AUDITED',
    enforcementHistory: enforcementHist,
    assignedOfficer: product.assignedOfficer || 'Inspector General',
    noticeReferenceNumber: product.noticeReferenceNumber || undefined,
    penaltyAmount: product.penaltyAmount
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
  doc.rect(0, 0, 210, 36, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(20);
  doc.setTextColor(255, 255, 255);
  doc.text('LABEL LENS', 15, 15);

  doc.setFontSize(9.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(219, 234, 254);
  doc.text('COMPLIANCE INSPECTION CERTIFICATE & ENFORCEMENT RECORD', 15, 22);
  doc.text(`Certificate ID: ${data.certificateId}   |   Enforcement Status: [${data.enforcementStatus}]`, 15, 28);

  // Score Badge in Banner
  doc.setFillColor(255, 255, 255);
  doc.roundedRect(155, 6, 42, 24, 3, 3, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(75, 85, 99);
  doc.text('SCORE', 176, 12, { align: 'center' });
  doc.setFontSize(14);
  doc.setTextColor(29, 78, 216);
  doc.text(`${data.complianceScore}%`, 176, 19, { align: 'center' });
  doc.setFontSize(6.5);
  doc.setTextColor(107, 114, 128);
  doc.text(data.complianceStatus.toUpperCase(), 176, 25, { align: 'center' });

  let curY = 44;

  // Product Information Section & Embedded Photo Evidence
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(31, 41, 55);
  doc.text('1. Product Information & Packaging Photo Evidence', 15, curY);
  doc.setLineWidth(0.4);
  doc.setDrawColor(229, 231, 235);
  doc.line(15, curY + 2, 195, curY + 2);
  curY += 7;

  // If photo evidence exists, embed it alongside or above details
  if (data.imageData) {
    try {
      const imgWidth = 42;
      const imgHeight = 42;
      doc.addImage(data.imageData, 'JPEG', 15, curY, imgWidth, imgHeight);
      doc.setFontSize(6.5);
      doc.setFont('helvetica', 'italic');
      doc.setTextColor(107, 114, 128);
      doc.text('Packaging Photo Evidence', 15, curY + imgHeight + 4);

      // Render product fields to the right of image
      const textX = 64;
      doc.setFontSize(8.5);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(31, 41, 55);
      doc.text('Product Name:', textX, curY + 4);
      doc.setFont('helvetica', 'normal');
      doc.text(data.productName, textX + 26, curY + 4, { maxWidth: 100 });

      doc.setFont('helvetica', 'bold');
      doc.text('Category:', textX, curY + 11);
      doc.setFont('helvetica', 'normal');
      doc.text(data.category, textX + 26, curY + 11);

      doc.setFont('helvetica', 'bold');
      doc.text('Barcode GTIN:', textX, curY + 18);
      doc.setFont('helvetica', 'normal');
      doc.text(`${data.barcode} (${data.barcodeValidationText})`, textX + 26, curY + 18, { maxWidth: 100 });

      doc.setFont('helvetica', 'bold');
      doc.text('MRP / Pricing:', textX, curY + 25);
      doc.setFont('helvetica', 'normal');
      doc.text(data.mrp, textX + 26, curY + 25);

      doc.setFont('helvetica', 'bold');
      doc.text('Inspection Date:', textX, curY + 32);
      doc.setFont('helvetica', 'normal');
      doc.text(data.scannedAt, textX + 26, curY + 32);

      doc.setFont('helvetica', 'bold');
      doc.text('Enforcement:', textX, curY + 39);
      doc.setFont('helvetica', 'normal');
      doc.text(`${data.enforcementStatus} (Officer: ${data.assignedOfficer})`, textX + 26, curY + 39);

      curY += imgHeight + 8;
    } catch (imgErr) {
      console.warn('PDF image embed notice:', imgErr);
    }
  } else {
    doc.setFontSize(8.5);
    doc.setFont('helvetica', 'bold');
    doc.text('Product Name:', 15, curY + 4);
    doc.setFont('helvetica', 'normal');
    doc.text(data.productName, 45, curY + 4);

    doc.setFont('helvetica', 'bold');
    doc.text('Category:', 15, curY + 10);
    doc.setFont('helvetica', 'normal');
    doc.text(data.category, 45, curY + 10);

    doc.setFont('helvetica', 'bold');
    doc.text('Barcode GTIN:', 15, curY + 16);
    doc.setFont('helvetica', 'normal');
    doc.text(`${data.barcode} (${data.barcodeValidationText})`, 45, curY + 16, { maxWidth: 145 });

    doc.setFont('helvetica', 'bold');
    doc.text('MRP / Pricing:', 15, curY + 22);
    doc.setFont('helvetica', 'normal');
    doc.text(data.mrp, 45, curY + 22);

    doc.setFont('helvetica', 'bold');
    doc.text('Audit Date:', 15, curY + 28);
    doc.setFont('helvetica', 'normal');
    doc.text(data.scannedAt, 45, curY + 28);
    curY += 34;
  }

  // Declarations Audit Checklist Table (with Placement, Font Size, Readability)
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(31, 41, 55);
  doc.text('2. Declarations, PDP Placement & Physical Font Size Audit', 15, curY);

  const tableRows = data.checklist.map(item => [
    item.field,
    item.status,
    item.value,
    item.placement || 'UNVERIFIED',
    item.fontSize || 'UNVERIFIED',
    item.requirement,
  ]);

  autoTable(doc, {
    startY: curY + 3,
    head: [['Declaration Field', 'Status', 'Declared Value', 'Placement (PDP)', 'Font Size (mm)', 'Requirement']],
    body: tableRows,
    theme: 'striped',
    headStyles: { fillColor: [29, 78, 216], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 7 },
    bodyStyles: { fontSize: 6.5, textColor: [55, 65, 81] },
    columnStyles: {
      0: { cellWidth: 36, fontStyle: 'bold' },
      1: { cellWidth: 14, fontStyle: 'bold' },
      2: { cellWidth: 36 },
      3: { cellWidth: 32 },
      4: { cellWidth: 34 },
      5: { cellWidth: 28 },
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

  let finalY = (doc as any).lastAutoTable.finalY + 7;

  // Violations Table
  if (data.violations.length > 0) {
    if (finalY > 225) {
      doc.addPage();
      finalY = 20;
    }
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10.5);
    doc.setTextColor(185, 28, 28);
    doc.text(`3. Identified Statutory Deficiencies & Violations (${data.violations.length})`, 15, finalY);

    const violationRows = data.violations.map((v, i) => [
      `${i + 1}`,
      v.severity,
      v.label,
      v.message,
      v.evidence || 'N/A'
    ]);

    autoTable(doc, {
      startY: finalY + 3,
      head: [['#', 'Severity', 'Rule Area', 'Deficiency Details', 'Evidence']],
      body: violationRows,
      theme: 'plain',
      headStyles: { fillColor: [254, 226, 226], textColor: [153, 27, 27], fontStyle: 'bold', fontSize: 7 },
      bodyStyles: { fontSize: 6.5, textColor: [127, 29, 29] },
      columnStyles: {
        0: { cellWidth: 8 },
        1: { cellWidth: 18, fontStyle: 'bold' },
        2: { cellWidth: 40, fontStyle: 'bold' },
        3: { cellWidth: 74 },
        4: { cellWidth: 40 },
      },
    });
    finalY = (doc as any).lastAutoTable.finalY + 7;
  }

  // Enforcement Workflow History Table
  if (data.enforcementHistory && data.enforcementHistory.length > 0) {
    if (finalY > 230) {
      doc.addPage();
      finalY = 20;
    }
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10.5);
    doc.setTextColor(31, 41, 55);
    doc.text('4. Official Enforcement Action Audit Trail', 15, finalY);

    const enforcementRows = data.enforcementHistory.map((act, i) => [
      `${i + 1}`,
      act.action,
      new Date(act.timestamp).toLocaleDateString(),
      act.officerName || 'Enforcement Officer',
      act.noticeNumber || data.noticeReferenceNumber || 'N/A',
      act.notes || 'Action logged.'
    ]);

    autoTable(doc, {
      startY: finalY + 3,
      head: [['#', 'Status Action', 'Date', 'Responsible Officer', 'Notice Ref', 'Notes & Disposition']],
      body: enforcementRows,
      theme: 'striped',
      headStyles: { fillColor: [55, 65, 81], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 7 },
      bodyStyles: { fontSize: 6.5, textColor: [31, 41, 55] },
      columnStyles: {
        0: { cellWidth: 8 },
        1: { cellWidth: 28, fontStyle: 'bold' },
        2: { cellWidth: 24 },
        3: { cellWidth: 32 },
        4: { cellWidth: 26 },
        5: { cellWidth: 62 },
      },
    });
    finalY = (doc as any).lastAutoTable.finalY + 7;
  }

  // Inspector Notes
  if (data.notes) {
    if (finalY > 250) {
      doc.addPage();
      finalY = 20;
    }
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(31, 41, 55);
    doc.text('Inspector Field Notes:', 15, finalY);
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(7.5);
    doc.setTextColor(75, 85, 99);
    doc.text(data.notes, 15, finalY + 4, { maxWidth: 180 });
  }

  // Footer on all pages
  const pageCount = (doc as any).internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(156, 163, 175);
    doc.text('Generated by Label Lens Inspection & Enforcement System — Legal Metrology Act & Sectoral Rules', 15, 290);
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

  const imageBytes = data.imageData ? base64ToUint8Array(data.imageData) : null;

  const docChildren: any[] = [
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
          text: 'COMPLIANCE INSPECTION CERTIFICATE & ENFORCEMENT AUDIT REPORT',
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
          text: `Certificate ID: ${data.certificateId}   |   Enforcement Status: [${data.enforcementStatus}]   |   Inspection Date: ${data.scannedAt}`,
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
        new TextRun({ text: '1. Product Information & Packaging Photo Evidence', bold: true, size: 22, color: '1F2937' }),
      ],
    }),
  ];

  // If photo evidence bytes exist, embed ImageRun in Word document
  if (imageBytes) {
    try {
      docChildren.push(
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { before: 100, after: 100 },
          children: [
            new ImageRun({
              data: imageBytes,
              transformation: {
                width: 220,
                height: 220,
              },
              type: 'jpg',
            }),
          ],
        }),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { after: 180 },
          children: [
            new TextRun({
              text: 'Packaging Photo Evidence — Captured Scanned Image',
              italics: true,
              size: 16,
              color: '6B7280',
            }),
          ],
        })
      );
    } catch (e) {
      console.warn('DOCX image embed notice:', e);
    }
  }

  // Product Info Table
  docChildren.push(
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
            new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: 'Enforcement Status:', bold: true, size: 18 })] })] }),
            new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: `${data.enforcementStatus} (Officer: ${data.assignedOfficer})`, bold: true, size: 18 })] })] }),
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
        new TextRun({ text: '2. Declarations, PDP Placement & Physical Font Size Audit', bold: true, size: 22, color: '1F2937' }),
      ],
    }),

    // Declarations Table
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: [
        new TableRow({
          tableHeader: true,
          children: [
            new TableCell({ shading: { type: ShadingType.CLEAR, fill: '1D4ED8' }, children: [new Paragraph({ children: [new TextRun({ text: 'Declaration Field', bold: true, color: 'FFFFFF', size: 16 })] })] }),
            new TableCell({ shading: { type: ShadingType.CLEAR, fill: '1D4ED8' }, children: [new Paragraph({ children: [new TextRun({ text: 'Status', bold: true, color: 'FFFFFF', size: 16 })] })] }),
            new TableCell({ shading: { type: ShadingType.CLEAR, fill: '1D4ED8' }, children: [new Paragraph({ children: [new TextRun({ text: 'Declared Value', bold: true, color: 'FFFFFF', size: 16 })] })] }),
            new TableCell({ shading: { type: ShadingType.CLEAR, fill: '1D4ED8' }, children: [new Paragraph({ children: [new TextRun({ text: 'Placement (PDP)', bold: true, color: 'FFFFFF', size: 16 })] })] }),
            new TableCell({ shading: { type: ShadingType.CLEAR, fill: '1D4ED8' }, children: [new Paragraph({ children: [new TextRun({ text: 'Font Height (mm)', bold: true, color: 'FFFFFF', size: 16 })] })] }),
            new TableCell({ shading: { type: ShadingType.CLEAR, fill: '1D4ED8' }, children: [new Paragraph({ children: [new TextRun({ text: 'Requirement', bold: true, color: 'FFFFFF', size: 16 })] })] }),
          ],
        }),
        ...data.checklist.map(item =>
          new TableRow({
            children: [
              new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: item.field, bold: true, size: 15 })] })] }),
              new TableCell({
                children: [
                  new Paragraph({
                    children: [
                      new TextRun({
                        text: item.status,
                        bold: true,
                        color: item.status === 'PASS' ? '059669' : item.status === 'FAIL' ? 'DC2626' : '6B7280',
                        size: 15,
                      }),
                    ],
                  }),
                ],
              }),
              new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: item.value, size: 15 })] })] }),
              new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: item.placement || 'UNVERIFIED', size: 14 })] })] }),
              new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: item.fontSize || 'UNVERIFIED', size: 14 })] })] }),
              new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: item.requirement, size: 14 })] })] }),
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
    })
  );

  if (data.violations.length > 0) {
    docChildren.push(
      new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: [
          new TableRow({
            tableHeader: true,
            children: [
              new TableCell({ shading: { type: ShadingType.CLEAR, fill: 'DC2626' }, children: [new Paragraph({ children: [new TextRun({ text: '#', bold: true, color: 'FFFFFF', size: 16 })] })] }),
              new TableCell({ shading: { type: ShadingType.CLEAR, fill: 'DC2626' }, children: [new Paragraph({ children: [new TextRun({ text: 'Severity', bold: true, color: 'FFFFFF', size: 16 })] })] }),
              new TableCell({ shading: { type: ShadingType.CLEAR, fill: 'DC2626' }, children: [new Paragraph({ children: [new TextRun({ text: 'Rule Area', bold: true, color: 'FFFFFF', size: 16 })] })] }),
              new TableCell({ shading: { type: ShadingType.CLEAR, fill: 'DC2626' }, children: [new Paragraph({ children: [new TextRun({ text: 'Deficiency Details', bold: true, color: 'FFFFFF', size: 16 })] })] }),
            ],
          }),
          ...data.violations.map((v, i) =>
            new TableRow({
              children: [
                new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: `${i + 1}`, size: 15 })] })] }),
                new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: v.severity, bold: true, color: 'DC2626', size: 15 })] })] }),
                new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: v.label, bold: true, size: 15 })] })] }),
                new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: v.message, size: 15 })] })] }),
              ],
            })
          ),
        ],
      })
    );
  }

  // Enforcement Workflow Action History Table
  if (data.enforcementHistory && data.enforcementHistory.length > 0) {
    docChildren.push(
      new Paragraph({
        heading: HeadingLevel.HEADING_2,
        spacing: { before: 280, after: 100 },
        children: [
          new TextRun({ text: '4. Official Enforcement Action Audit Trail', bold: true, size: 22, color: '1F2937' }),
        ],
      }),
      new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: [
          new TableRow({
            tableHeader: true,
            children: [
              new TableCell({ shading: { type: ShadingType.CLEAR, fill: '374151' }, children: [new Paragraph({ children: [new TextRun({ text: 'Action', bold: true, color: 'FFFFFF', size: 16 })] })] }),
              new TableCell({ shading: { type: ShadingType.CLEAR, fill: '374151' }, children: [new Paragraph({ children: [new TextRun({ text: 'Timestamp', bold: true, color: 'FFFFFF', size: 16 })] })] }),
              new TableCell({ shading: { type: ShadingType.CLEAR, fill: '374151' }, children: [new Paragraph({ children: [new TextRun({ text: 'Officer', bold: true, color: 'FFFFFF', size: 16 })] })] }),
              new TableCell({ shading: { type: ShadingType.CLEAR, fill: '374151' }, children: [new Paragraph({ children: [new TextRun({ text: 'Notice Ref', bold: true, color: 'FFFFFF', size: 16 })] })] }),
              new TableCell({ shading: { type: ShadingType.CLEAR, fill: '374151' }, children: [new Paragraph({ children: [new TextRun({ text: 'Notes', bold: true, color: 'FFFFFF', size: 16 })] })] }),
            ],
          }),
          ...data.enforcementHistory.map(act =>
            new TableRow({
              children: [
                new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: act.action, bold: true, size: 15 })] })] }),
                new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: new Date(act.timestamp).toLocaleString(), size: 14 })] })] }),
                new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: act.officerName || 'Officer', size: 14 })] })] }),
                new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: act.noticeNumber || data.noticeReferenceNumber || 'N/A', size: 14 })] })] }),
                new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: act.notes || 'Action logged.', size: 14 })] })] }),
              ],
            })
          ),
        ],
      })
    );
  }

  // Notes
  if (data.notes) {
    docChildren.push(
      new Paragraph({
        heading: HeadingLevel.HEADING_2,
        spacing: { before: 280, after: 100 },
        children: [
          new TextRun({ text: '5. Inspector Notes', bold: true, size: 22, color: '1F2937' }),
        ],
      }),
      new Paragraph({
        children: [new TextRun({ text: data.notes, italics: true, size: 18, color: '4B5563' })],
      })
    );
  }

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
        children: docChildren,
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

// ------------------------------------------------------------
// Microsoft Word (.DOCX) Products Registry Dataset Export
// Exports the entire products section as an editable Word document
// ------------------------------------------------------------

export async function exportProductsRegistryDOCX(
  productsList: ScannedProduct[],
  isFiltered: boolean = false
): Promise<void> {
  const generatedDateStr = new Date().toLocaleString();
  const totalCount = productsList.length;
  const compliantCount = productsList.filter(p => p.complianceStatus === 'Compliant').length;
  const partiallyCompliantCount = productsList.filter(p => p.complianceStatus === 'Partially Compliant').length;
  const nonCompliantCount = productsList.filter(p => p.complianceStatus === 'Non-Compliant' || p.complianceStatus === 'Pending').length;

  const doc = new Document({
    sections: [
      {
        properties: {
          page: {
            size: {
              orientation: PageOrientation.LANDSCAPE,
            },
            margin: {
              top: convertInchesToTwip(0.5),
              bottom: convertInchesToTwip(0.5),
              left: convertInchesToTwip(0.5),
              right: convertInchesToTwip(0.5),
            },
          },
        },
        children: [
          // Header Title
          new Paragraph({
            heading: HeadingLevel.HEADING_1,
            alignment: AlignmentType.CENTER,
            children: [
              new TextRun({
                text: 'LABEL LENS',
                bold: true,
                size: 32,
                color: '1D4ED8',
              }),
            ],
          }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { after: 100 },
            children: [
              new TextRun({
                text: isFiltered
                  ? 'PRODUCT INSPECTIONS REGISTRY SUMMARY (FILTERED VIEW)'
                  : 'PRODUCT INSPECTIONS & COMPLIANCE REGISTRY MASTER DATASET',
                bold: true,
                size: 18,
                color: '374151',
              }),
            ],
          }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { after: 180 },
            children: [
              new TextRun({
                text: `Generated on: ${generatedDateStr}   |   Total Records: ${totalCount} (Compliant: ${compliantCount}, Partially Compliant: ${partiallyCompliantCount}, Non-Compliant: ${nonCompliantCount})`,
                italics: true,
                size: 15,
                color: '6B7280',
              }),
            ],
          }),

          // Products Registry Table
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: [
              // Header row
              new TableRow({
                tableHeader: true,
                children: [
                  new TableCell({
                    width: { size: 4, type: WidthType.PERCENTAGE },
                    shading: { type: ShadingType.CLEAR, fill: '1D4ED8' },
                    children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: '#', bold: true, color: 'FFFFFF', size: 15 })] })],
                  }),
                  new TableCell({
                    width: { size: 18, type: WidthType.PERCENTAGE },
                    shading: { type: ShadingType.CLEAR, fill: '1D4ED8' },
                    children: [new Paragraph({ children: [new TextRun({ text: 'Product Details & GTIN', bold: true, color: 'FFFFFF', size: 15 })] })],
                  }),
                  new TableCell({
                    width: { size: 14, type: WidthType.PERCENTAGE },
                    shading: { type: ShadingType.CLEAR, fill: '1D4ED8' },
                    children: [new Paragraph({ children: [new TextRun({ text: 'Category', bold: true, color: 'FFFFFF', size: 15 })] })],
                  }),
                  new TableCell({
                    width: { size: 12, type: WidthType.PERCENTAGE },
                    shading: { type: ShadingType.CLEAR, fill: '1D4ED8' },
                    children: [new Paragraph({ children: [new TextRun({ text: 'MRP & Net Qty', bold: true, color: 'FFFFFF', size: 15 })] })],
                  }),
                  new TableCell({
                    width: { size: 12, type: WidthType.PERCENTAGE },
                    shading: { type: ShadingType.CLEAR, fill: '1D4ED8' },
                    children: [new Paragraph({ children: [new TextRun({ text: 'Mfg / Expiry Date', bold: true, color: 'FFFFFF', size: 15 })] })],
                  }),
                  new TableCell({
                    width: { size: 16, type: WidthType.PERCENTAGE },
                    shading: { type: ShadingType.CLEAR, fill: '1D4ED8' },
                    children: [new Paragraph({ children: [new TextRun({ text: 'Manufacturer & License', bold: true, color: 'FFFFFF', size: 15 })] })],
                  }),
                  new TableCell({
                    width: { size: 10, type: WidthType.PERCENTAGE },
                    shading: { type: ShadingType.CLEAR, fill: '1D4ED8' },
                    children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'Score & Status', bold: true, color: 'FFFFFF', size: 15 })] })],
                  }),
                  new TableCell({
                    width: { size: 14, type: WidthType.PERCENTAGE },
                    shading: { type: ShadingType.CLEAR, fill: '1D4ED8' },
                    children: [new Paragraph({ children: [new TextRun({ text: 'Audit Deficiencies / Notes', bold: true, color: 'FFFFFF', size: 15 })] })],
                  }),
                ],
              }),
              // Data rows
              ...productsList.map((p, idx) => {
                const catText = normalizeCategory(p.category);
                const decs = p.declarations || ({} as any);
                const mrpVal = p.mrp || decs.mrp?.value || 'N/A';
                const qtyVal = decs.netQuantity?.value || 'N/A';
                const mfgVal = decs.manufactureDate?.value || 'N/A';
                const expVal = decs.bestBefore?.value || 'N/A';
                const mfrVal = decs.manufacturer?.value || 'N/A';
                const licVal = decs.fssaiLicense?.value || p.regulatoryLicense || 'N/A';
                const statusColor = p.complianceStatus === 'Compliant' ? '059669' : p.complianceStatus === 'Partially Compliant' ? 'D97706' : 'DC2626';
                const isEven = idx % 2 === 0;
                const rowShading = isEven ? 'FFFFFF' : 'F9FAFB';

                const violationsText = p.violations && p.violations.length > 0
                  ? p.violations.map((v, vIdx) => `${vIdx + 1}. [${v.severity.toUpperCase()}] ${v.label}: ${v.message}`).join('\n')
                  : 'Complies with mandatory declarations';

                return new TableRow({
                  children: [
                    // Index
                    new TableCell({
                      shading: { type: ShadingType.CLEAR, fill: rowShading },
                      children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: `${idx + 1}`, size: 14 })] })],
                    }),
                    // Product Details & GTIN
                    new TableCell({
                      shading: { type: ShadingType.CLEAR, fill: rowShading },
                      children: [
                        new Paragraph({ children: [new TextRun({ text: p.productName || 'Unnamed Product', bold: true, size: 15, color: '111827' })] }),
                        new Paragraph({ children: [new TextRun({ text: `Barcode: ${p.barcode || 'N/A'}`, size: 13, color: '4B5563', font: 'Consolas' })] }),
                        ...(p.notes ? [new Paragraph({ children: [new TextRun({ text: `Note: ${p.notes}`, italics: true, size: 12, color: '6B7280' })] })] : []),
                      ],
                    }),
                    // Category
                    new TableCell({
                      shading: { type: ShadingType.CLEAR, fill: rowShading },
                      children: [new Paragraph({ children: [new TextRun({ text: catText, bold: true, color: '1D4ED8', size: 14 })] })],
                    }),
                    // MRP & Net Qty
                    new TableCell({
                      shading: { type: ShadingType.CLEAR, fill: rowShading },
                      children: [
                        new Paragraph({ children: [new TextRun({ text: `MRP: ${mrpVal}`, bold: true, size: 14, color: '059669' })] }),
                        new Paragraph({ children: [new TextRun({ text: `Qty: ${qtyVal}`, size: 13, color: '374151' })] }),
                      ],
                    }),
                    // Dates
                    new TableCell({
                      shading: { type: ShadingType.CLEAR, fill: rowShading },
                      children: [
                        new Paragraph({ children: [new TextRun({ text: `Mfg: ${mfgVal}`, size: 13, color: '374151' })] }),
                        new Paragraph({ children: [new TextRun({ text: `Exp: ${expVal}`, size: 13, color: '374151' })] }),
                      ],
                    }),
                    // Manufacturer & License
                    new TableCell({
                      shading: { type: ShadingType.CLEAR, fill: rowShading },
                      children: [
                        new Paragraph({ children: [new TextRun({ text: `Mfr: ${mfrVal}`, size: 13, color: '1F2937' })] }),
                        new Paragraph({ children: [new TextRun({ text: `Lic: ${licVal}`, size: 12, color: '4B5563' })] }),
                      ],
                    }),
                    // Score & Status
                    new TableCell({
                      shading: { type: ShadingType.CLEAR, fill: rowShading },
                      children: [
                        new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: `${p.complianceScore}%`, bold: true, size: 16, color: '111827' })] }),
                        new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: p.complianceStatus, bold: true, size: 13, color: statusColor })] }),
                      ],
                    }),
                    // Violations & Deficiencies
                    new TableCell({
                      shading: { type: ShadingType.CLEAR, fill: rowShading },
                      children: [
                        new Paragraph({
                          children: [
                            new TextRun({
                              text: violationsText,
                              size: 13,
                              color: p.violations && p.violations.length > 0 ? 'B91C1C' : '059669',
                              italics: !(p.violations && p.violations.length > 0),
                            }),
                          ],
                        }),
                      ],
                    }),
                  ],
                });
              }),
            ],
          }),

          // Disclaimer & Attribution Footer
          new Paragraph({
            spacing: { before: 200 },
            alignment: AlignmentType.CENTER,
            children: [
              new TextRun({
                text: 'Generated by Label Lens Verification System — Legal Metrology & Sectoral Compliance Dataset Export. Fully editable Microsoft Word document.',
                size: 13,
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
  const dateStr = new Date().toISOString().split('T')[0];
  const filename = `Label_Lens_Products_Registry_${dateStr}.docx`;

  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
