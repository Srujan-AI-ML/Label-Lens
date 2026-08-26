// ============================================================
// Legal Metrology Compliance Checking Service
// Validates extracted label text against the Legal Metrology
// (Packaged Commodities) Rules, 2011
// ============================================================

import type {
  ComplianceDeclarations,
  ComplianceDeclaration,
  Violation,
  ComplianceStatus,
  ScannedProduct,
} from '../types';

// ---- Helpers ------------------------------------------------

function makeDeclaration(
  present: boolean,
  value: string | null,
  confidence: 'high' | 'medium' | 'low' = 'high'
): ComplianceDeclaration {
  return { present, value, confidence };
}

function firstMatch(text: string, patterns: RegExp[]): string | null {
  for (const re of patterns) {
    const m = text.match(re);
    if (m) return m[1] ? m[1].trim() : m[0].trim();
  }
  return null;
}

// ---- Declaration Extractors ---------------------------------

function extractGenericName(text: string): ComplianceDeclaration {
  // Common product type words appearing in labels
  const patterns = [
    /(?:product|commodity|item|type)\s*[:\-]?\s*([A-Za-z ]{3,40})/i,
    /^([A-Z][A-Z ]{2,30})$/m,  // ALL CAPS heading line
  ];
  const value = firstMatch(text, patterns);
  if (value) return makeDeclaration(true, value, 'medium');

  // Heuristic: first significant title line
  const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 2 && l.length < 60);
  if (lines.length > 0) return makeDeclaration(true, lines[0], 'low');
  return makeDeclaration(false, null);
}

function extractManufacturer(text: string): ComplianceDeclaration {
  const patterns = [
    /(?:manufactured|mfd|packed|marketed|imported|distributed|dist)\s+by\s*[:\-]?\s*([^\n]{5,120})/i,
    /(?:manufacturer|packer|importer|distributor)\s*[:\-]\s*([^\n]{5,120})/i,
    /(?:mfr|mfg)\s*[:\-]\s*([^\n]{5,120})/i,
  ];
  const value = firstMatch(text, patterns);
  if (value) return makeDeclaration(true, value.trim(), 'high');
  return makeDeclaration(false, null);
}

function extractNetQuantity(text: string): ComplianceDeclaration {
  const patterns = [
    /(?:net\s*(?:qty|quantity|wt|weight|vol|volume|content))\s*[:\-]?\s*([\d.,]+\s*(?:kg|g|gm|gms|mg|l|lt|ltr|litre|ml|pieces?|pcs?|nos?|number|unit|pack|oz|ounce|lbs?|pound))/i,
    /(?:net)\s*([\d.,]+\s*(?:kg|g|gm|gms|mg|l|lt|ltr|litre|ml|pcs?|nos?|oz|lbs?))\b/i,
    /([\d.,]+\s*(?:kg|g|gm|gms|mg|l|lt|ltr|litre|ml|pcs?|nos?|oz|lbs?))\s*net/i,
    // standalone unit pattern
    /\b([\d.,]+\s*(?:kg|gm|gms|ml|ltr|litre|pcs|nos|oz|lbs?))\b/i,
  ];
  const value = firstMatch(text, patterns);
  if (value) return makeDeclaration(true, value.trim(), 'high');
  return makeDeclaration(false, null);
}

function extractManufactureDate(text: string): ComplianceDeclaration {
  const patterns = [
    /(?:mfg|mfd|manufactured|packing|packed|mfg\.?\s*date|manufacture\s*date)\s*[:\-]?\s*((?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*[\s/\-\.,]*\d{2,4}|\d{1,2}[\s/\-\.]\d{2,4}|\d{2}[\s/\-\.]\d{2,4})/i,
    /mfg\s*[:\-]?\s*(\d{2}[\/\-\.]\d{4})/i,
  ];
  const value = firstMatch(text, patterns);
  if (value) return makeDeclaration(true, value.trim(), 'high');
  return makeDeclaration(false, null);
}

function extractMRP(text: string): ComplianceDeclaration {
  const patterns = [
    /(?:m\.?r\.?p\.?|maximum\s+retail\s+price)\s*[:\-\(]?\s*(?:rs\.?|₹|inr)?\s*([\d,]+(?:\.\d{1,2})?)/i,
    /(?:rs\.?|₹)\s*([\d,]+(?:\.\d{1,2})?)\s*(?:m\.?r\.?p|mrp)/i,
    /(?:price|rate)\s*[:\-]?\s*(?:rs\.?|₹)\s*([\d,]+(?:\.\d{1,2})?)/i,
    /mrp\s*([\d,]+(?:\.\d{1,2})?)/i,
  ];
  const value = firstMatch(text, patterns);
  if (value) {
    // Format as ₹ amount
    const cleaned = value.replace(/[^\d.,]/g, '');
    return makeDeclaration(true, `₹${cleaned}`, 'high');
  }
  return makeDeclaration(false, null);
}

function extractConsumerCare(text: string): ComplianceDeclaration {
  const phonePattern = /(?:consumer\s*care|helpline|toll.?free|customer\s*care|complaint)[^\n]*\n?[^\n]*([\d\-\+\(\)\s]{7,15})/i;
  const emailPattern = /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/;
  const standalonePhone = /(?<!\d)(\+91[-\s]?)?[6-9]\d{9}(?!\d)/;

  const phoneMatch = text.match(phonePattern) || text.match(standalonePhone);
  const emailMatch = text.match(emailPattern);

  if (phoneMatch || emailMatch) {
    const val = [
      phoneMatch ? phoneMatch[0].trim() : null,
      emailMatch ? emailMatch[0] : null,
    ]
      .filter(Boolean)
      .join(', ');
    return makeDeclaration(true, val, 'high');
  }
  // Check for "consumer care" text without number — partial
  if (/consumer\s*care|helpline/i.test(text)) {
    return makeDeclaration(true, 'Consumer care section found (no number extracted)', 'low');
  }
  return makeDeclaration(false, null);
}

function extractBestBefore(text: string): ComplianceDeclaration {
  const patterns = [
    /(?:best\s*before|use\s*by|expiry|exp\.?|best\s*before\s*end|bbe)\s*[:\-]?\s*([\d]{1,2}[\s\/\-\.][\d]{1,2}[\s\/\-\.]?[\d]{2,4}|(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*[\s\/\-,.]*\d{2,4})/i,
    /(?:exp|expiry)\s*[:\-]?\s*(\d{2}[\/\-\.]\d{2,4})/i,
  ];
  const value = firstMatch(text, patterns);
  if (value) return makeDeclaration(true, value.trim(), 'high');

  // "shelf life" mention — partial
  if (/shelf\s*life/i.test(text)) {
    return makeDeclaration(true, 'Shelf life mentioned', 'medium');
  }
  return makeDeclaration(false, null);
}

function extractCountryOfOrigin(text: string): ComplianceDeclaration {
  const patterns = [
    /(?:country\s*of\s*origin|made\s*in|product\s*of|manufactured\s*in)\s*[:\-]?\s*([A-Za-z ]{3,30})/i,
    /(?:origin)\s*[:\-]\s*([A-Za-z ]{3,20})/i,
  ];
  const value = firstMatch(text, patterns);
  if (value) return makeDeclaration(true, value.trim(), 'high');

  // "India" appearing alone is common on domestic products
  if (/\bindia\b/i.test(text)) {
    return makeDeclaration(true, 'India (inferred)', 'low');
  }
  return makeDeclaration(false, null, 'medium'); // Not always mandatory
}

function extractFSSAI(text: string): ComplianceDeclaration {
  const patterns = [
    /(?:fssai|food\s*safety|lic\.?\s*no\.?|licence\s*no\.?|license\s*no\.?)\s*[:\-]?\s*(\d{14})/i,
    /\b(\d{14})\b/, // standalone 14-digit number
  ];
  const value = firstMatch(text, patterns);
  if (value) return makeDeclaration(true, value.trim(), 'high');

  // FSSAI mention without number
  if (/fssai/i.test(text)) {
    return makeDeclaration(true, 'FSSAI mentioned (license number not extracted)', 'low');
  }
  return makeDeclaration(false, null);
}

function extractRetailSalePrice(text: string): ComplianceDeclaration {
  const patterns = [
    /(?:retail\s*(?:sale\s*)?price|rsp|unit\s*price)\s*[:\-]?\s*(?:rs\.?|₹)?\s*([\d,]+(?:\.\d{1,2})?)/i,
    /(?:rs\.?|₹)\s*([\d,]+(?:\.\d{1,2})?)\s*(?:per\s*(?:unit|piece|pc|no))/i,
    /(?:inclusive|incl\.?)\s*of\s*(?:all\s*)?tax/i,
  ];
  const value = firstMatch(text, patterns);
  if (value) return makeDeclaration(true, value.trim(), 'high');

  // If MRP is present with "inclusive of all taxes", this is satisfied
  if (/incl(?:usive)?\s*of\s*(?:all\s*)?tax/i.test(text) || /all\s*taxes?\s*incl/i.test(text)) {
    return makeDeclaration(true, 'MRP inclusive of all taxes (inferred)', 'medium');
  }

  return makeDeclaration(false, null);
}

// ---- Main Compliance Analyser -------------------------------

export function analyseCompliance(
  rawText: string,
  productName?: string
): {
  declarations: ComplianceDeclarations;
  violations: Violation[];
  complianceScore: number;
  complianceStatus: ComplianceStatus;
} {
  const text = rawText;

  const declarations: ComplianceDeclarations = {
    genericName: extractGenericName(text),
    manufacturer: extractManufacturer(text),
    netQuantity: extractNetQuantity(text),
    manufactureDate: extractManufactureDate(text),
    mrp: extractMRP(text),
    consumerCare: extractConsumerCare(text),
    bestBefore: extractBestBefore(text),
    countryOfOrigin: extractCountryOfOrigin(text),
    fssaiLicense: extractFSSAI(text),
    retailSalePrice: extractRetailSalePrice(text),
  };

  if ((!declarations.genericName.present || !declarations.genericName.value) && productName && productName.trim()) {
    declarations.genericName = makeDeclaration(true, productName.trim(), 'high');
  }

  const violations: Violation[] = [];

  // Mandatory checks (critical = must have)
  const criticalChecks: Array<{
    key: keyof ComplianceDeclarations;
    label: string;
    msg: string;
  }> = [
    { key: 'manufacturer', label: 'Manufacturer / Packer Details', msg: 'Name and address of manufacturer/packer/importer is missing.' },
    { key: 'netQuantity', label: 'Net Quantity', msg: 'Net quantity (weight/volume/count) declaration is missing.' },
    { key: 'mrp', label: 'MRP (Maximum Retail Price)', msg: 'MRP inclusive of all taxes is missing.' },
    { key: 'manufactureDate', label: 'Date of Manufacture / Packing', msg: 'Month and year of manufacture/packing/import is missing.' },
    { key: 'consumerCare', label: 'Consumer Care Details', msg: 'Consumer care contact (phone/email) is missing.' },
    { key: 'genericName', label: 'Generic / Common Name', msg: 'Generic or common name of the product is missing.' },
    { key: 'bestBefore', label: 'Best Before / Expiry Date', msg: 'Best before or expiry date is missing.' },
  ];

  // Major checks
  const majorChecks: Array<{
    key: keyof ComplianceDeclarations;
    label: string;
    msg: string;
  }> = [
    { key: 'fssaiLicense', label: 'FSSAI License Number', msg: 'FSSAI 14-digit license number is missing (required for food products).' },
    { key: 'retailSalePrice', label: 'Retail Sale Price Declaration', msg: 'Retail sale price per unit or "MRP inclusive of all taxes" not stated.' },
  ];

  // Minor checks
  const minorChecks: Array<{
    key: keyof ComplianceDeclarations;
    label: string;
    msg: string;
  }> = [
    { key: 'countryOfOrigin', label: 'Country of Origin', msg: 'Country of origin is not stated (required for imported goods).' },
  ];

  criticalChecks.forEach(c => {
    if (!declarations[c.key].present) {
      violations.push({ field: c.key, label: c.label, message: c.msg, severity: 'critical' });
    }
  });
  majorChecks.forEach(c => {
    if (!declarations[c.key].present) {
      violations.push({ field: c.key, label: c.label, message: c.msg, severity: 'major' });
    }
  });
  minorChecks.forEach(c => {
    if (!declarations[c.key].present) {
      violations.push({ field: c.key, label: c.label, message: c.msg, severity: 'minor' });
    }
  });

  // Score: critical=12pts each (84 total), major=6pts each (12 total), minor=4pts (4 total) → 100
  const criticalScore = criticalChecks.filter(c => declarations[c.key].present).length * 12;
  const majorScore = majorChecks.filter(c => declarations[c.key].present).length * 6;
  const minorScore = minorChecks.filter(c => declarations[c.key].present).length * 4;
  const complianceScore = Math.min(100, criticalScore + majorScore + minorScore);

  // Status
  let complianceStatus: ComplianceStatus;

  if (complianceScore === 100) {
    complianceStatus = 'Compliant';
  } else if (complianceScore === 0) {
    complianceStatus = 'Non-Compliant';
  } else {
    complianceStatus = 'Partially Compliant';
  }

  return { declarations, violations, complianceScore, complianceStatus };
}

// ---- Validation Template -----------------------------------

interface ValidationResult {
  isValid: boolean;
  errorMsg: string | null;
}

export function validateProductSpecifics(data: {
  productName: string;
  barcode: string;
  netQuantity: string;
  mrp: string;
  mfgDate: string;
  expiryDate: string;
  fssaiLicense: string;
}): ValidationResult {
  if (!data.productName.trim()) {
    return { isValid: false, errorMsg: 'Product Common / Generic Name is required.' };
  }

  if (data.barcode.trim()) {
    const cleanBarcode = data.barcode.trim().replace(/\s/g, '');
    if (!/^\d{8,14}$/.test(cleanBarcode)) {
      return { isValid: false, errorMsg: 'Barcode must be numeric and between 8 and 14 digits.' };
    }
  }

  if (!data.netQuantity.trim()) {
    return { isValid: false, errorMsg: 'Net Quantity is required.' };
  } else {
    const num = parseFloat(data.netQuantity.trim());
    if (isNaN(num) || num <= 0) {
      return { isValid: false, errorMsg: 'Net Quantity must be a valid positive number.' };
    }
  }

  if (!data.mrp.trim()) {
    return { isValid: false, errorMsg: 'MRP is required.' };
  } else {
    const cleanMrp = data.mrp.trim().replace(/[^\d.]/g, '');
    const num = parseFloat(cleanMrp);
    if (isNaN(num) || num <= 0) {
      return { isValid: false, errorMsg: 'MRP must be a valid positive number.' };
    }
  }

  if (!data.mfgDate.trim()) {
    return { isValid: false, errorMsg: 'Mfg Date is required.' };
  } else {
    const mfg = new Date(data.mfgDate);
    if (isNaN(mfg.getTime())) {
      return { isValid: false, errorMsg: 'Mfg Date must be a valid calendar date selection.' };
    }
    if (mfg > new Date()) {
      return { isValid: false, errorMsg: 'Mfg Date cannot be in the future.' };
    }
  }

  if (!data.expiryDate.trim()) {
    return { isValid: false, errorMsg: 'Expiry / Best Before Date is required.' };
  } else {
    const exp = new Date(data.expiryDate);
    const mfg = new Date(data.mfgDate);
    if (isNaN(exp.getTime())) {
      return { isValid: false, errorMsg: 'Expiry Date must be a valid calendar date selection.' };
    }
    if (!isNaN(mfg.getTime()) && exp < mfg) {
      return { isValid: false, errorMsg: 'Expiry / Best Before date must be after the Manufacture date.' };
    }
  }

  if (data.fssaiLicense.trim()) {
    const cleanLic = data.fssaiLicense.trim().replace(/\s/g, '');
    if (!/^\d{14}$/.test(cleanLic)) {
      return { isValid: false, errorMsg: 'FSSAI License must be exactly 14 digits.' };
    }
  }

  return { isValid: true, errorMsg: null };
}

// Build a full ScannedProduct object
export function buildScanResult(
  rawText: string,
  productName: string,
  barcode?: string,
  imageData?: string
): Omit<ScannedProduct, 'id'> {
  const { declarations, violations, complianceScore, complianceStatus } = analyseCompliance(rawText, productName);
  return {
    productName,
    barcode,
    scannedAt: new Date().toISOString(),
    rawExtractedText: rawText,
    complianceScore,
    complianceStatus,
    declarations,
    violations,
    imageData,
  };
}
