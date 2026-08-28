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

export function normalizeOCRText(rawText: string): string {
  if (!rawText) return '';
  let text = rawText;

  // Rupee symbol normalization: Fix OCR interpreting ₹ as '3' in MRP / Price contexts
  text = text.replace(/(m\.?r\.?p\.?|max(?:imum)?\s*retail\s*price|price)\s*[:\-\(]?\s*(?:rs\.?|inr)?\s*3\s+([\d,]+(?:\.\d{1,2})?)/gi, '$1: ₹ $2');
  text = text.replace(/(m\.?r\.?p\.?|max(?:imum)?\s*retail\s*price|price)\s*[:\-\(]?\s*(?:rs\.?|inr)?\s*3([\d,]{2,}(?:\.\d{1,2})?)/gi, (match, prefix, numStr) => {
    if (numStr.length >= 4 && numStr.startsWith('3')) {
      const trimmed = numStr.substring(1);
      return `${prefix}: ₹ ${trimmed}`;
    }
    return `${prefix}: ₹ ${numStr}`;
  });

  text = text.replace(/(unit\s*(?:sale\s*)?price|usp)\s*[:\-]?\s*(?:rs\.?|inr)?\s*3\s*0\.(\d+)/gi, '$1: ₹0.$2');
  text = text.replace(/(unit\s*(?:sale\s*)?price|usp)\s*[:\-]?\s*(?:rs\.?|inr)?\s*3(\d+\.\d+)/gi, '$1: ₹$2');
  text = text.replace(/\(3(\d+\.\d+\s*\/\s*100\s*g)\)/gi, '(₹$1)');
  text = text.replace(/\b(?:in\s*r|rs\.?)\b/gi, '₹');

  return text;
}

// ---- Declaration Extractors ---------------------------------

function cleanProductNameString(raw: string): string {
  return raw
    .replace(/^(?:a\s+be\b|he\s*-\s*nn\b|[\W_]+)/gi, '')
    .replace(/\b(?:1\s*kg\s*pack|net\s*wt:?\s*\d+\s*\w+|barcode|gtin)\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractGenericName(text: string): ComplianceDeclaration {
  // 1. Explicit tag check (Product Name:, Commodity:, Item Name:)
  const explicitPattern = /(?:product(?:\s*name)?|commodity|item(?:\s*name)?|product\s*identity|common\s*name)\s*[:\-]\s*([^\n\r]{3,60})/i;
  const expMatch = text.match(explicitPattern);
  if (expMatch && expMatch[1]) {
    const clean = cleanProductNameString(expMatch[1]);
    if (clean.length > 2) return makeDeclaration(true, clean, 'high');
  }

  // 2. Candidate Scoring engine across all lines
  const lines = text.split(/[\r\n]+/).map(l => l.trim()).filter(l => l.length >= 3);
  let bestCandidate: string | null = null;
  let highestScore = -999;

  const knownBrands = [
    'ORGANIC INDIA', 'BRITANNIA', 'PARLE', 'MAGGI', 'AMUL', 'NESTLE',
    'DABUR', 'HALDIRAM', 'LAYS', 'CADBURY', 'PATANJALI', 'TATA', 'FORTUNE',
    'HALDIRAMS', 'MOTHER DAIRY', 'EPIGAMIA', 'RAW', 'PAPER BOAT', 'MUNCH',
    'GOOD DAY', 'PARLE-G', 'SUNFEAST', 'MARICO', 'SAFFOLA', 'SLURRP FARM'
  ];

  const productKeywords = [
    'BASMATI RICE', 'ORGANIC BASMATI RICE', 'RICE', 'COOKIES', 'BISCUITS',
    'NOODLES', 'BUTTER', 'MILK', 'ATTA', 'FLOUR', 'OIL', 'GHEE', 'SPICES',
    'TEA', 'COFFEE', 'JUICE', 'SNACKS', 'SALT', 'SUGAR', 'PULSES', 'DAL',
    'HONEY', 'OATS', 'CHIPS', 'CHOCOLATE', 'PASTA', 'VERMICELLI', 'RAVA'
  ];

  const excludePatterns = [
    /\b(?:manufactured|mfd|packed|marketed|imported|distributed|mfr|pvt|ltd|limited|inc|llc|corp)\b/i,
    /\b(?:nutrition|ingredients|mrp|rs\.|₹|net\s*wt|net\s*qty|net\s*quantity|batch|lot|fssai|lic|licence|license)\b/i,
    /\b(?:consumer|care|helpline|customer|feedback|complaint|email|phone|tel|call)\b/i,
    /\b(?:best\s*before|use\s*by|mfg|pkd|packed|expiry|exp|date|shelf\s*life)\b/i,
    /\b(?:country\s*of\s*origin|made\s*in|product\s*of|origin)\b/i,
    /\b(?:store\s*in|keep\s*in|storage|directions|instructions|warning|allergen|contains|table|per\s*100|serving|energy|protein|fat|carbohydrate|kcal)\b/i,
    /\b(?:veg|non-veg|green\s*dot|100%|rules|2011|pack|barcode|gtin|unit\s*sale)\b/i,
    /^[A-Za-z]\s+be\b/i,
    /^[\d\W_]+$/
  ];

  lines.forEach((line, index) => {
    if (excludePatterns.some(p => p.test(line))) return;

    let score = 0;
    const upperLine = line.toUpperCase();

    if (index < 5) score += (5 - index) * 5;
    if (knownBrands.some(b => upperLine.includes(b))) score += 50;
    if (productKeywords.some(p => upperLine.includes(p))) score += 40;
    if (line.length >= 8 && line.length <= 50) score += 20;

    const alphaCount = (line.match(/[a-zA-Z]/g) || []).length;
    if (alphaCount / line.length < 0.6) score -= 40;

    if (score > highestScore) {
      highestScore = score;
      bestCandidate = line;
    }
  });

  if (lines.length >= 2) {
    const combinedCandidate = `${lines[0]} ${lines[1]}`.trim();
    if (!excludePatterns.some(p => p.test(combinedCandidate))) {
      const upperCombined = combinedCandidate.toUpperCase();
      let combinedScore = 30;
      if (knownBrands.some(b => upperCombined.includes(b))) combinedScore += 50;
      if (productKeywords.some(p => upperCombined.includes(p))) combinedScore += 40;

      if (combinedScore > highestScore) {
        highestScore = combinedScore;
        bestCandidate = combinedCandidate;
      }
    }
  }

  if (bestCandidate && highestScore > 10) {
    const cleaned = cleanProductNameString(bestCandidate);
    return makeDeclaration(true, cleaned, highestScore > 50 ? 'high' : 'medium');
  }

  return makeDeclaration(false, null, 'low');
}

function extractManufacturer(text: string): ComplianceDeclaration {
  const pattern = /(?:manufactured\s*(?:&|and)?\s*packed\s*by|manufactured\s*by|mfd\.?\s*by|packed\s*by|marketed\s*by|imported\s*by|distributed\s*by|dist\.?\s*by|manufacturer\s*address|packer\s*address|manufacturer|packer|importer)\s*[:\-]?\s*([^\n\r]+(?:\n[^\n\r]+){0,3})/i;
  const match = text.match(pattern);
  if (match && match[1]) {
    let block = match[1].trim();
    const stopKeywords = [
      /\b(?:net\s*(?:qty|wt|weight|quantity)|mrp|m\.r\.p|fssai|lic\.?\s*no|consumer\s*care|helpline|best\s*before|use\s*by|mfg\s*date|date\s*of|pkd|batch|for\s*feedback|customer\s*care|email|phone|country\s*of\s*origin|unit\s*sale)\b/i
    ];
    for (const kw of stopKeywords) {
      const idx = block.search(kw);
      if (idx > 0) {
        block = block.substring(0, idx).trim();
      }
    }
    const cleaned = block.replace(/[\r\n]+/g, ', ').replace(/\s*,\s*/g, ', ').replace(/,+$/, '').trim();

    const validAddressIndicators = /\b(?:pvt|ltd|limited|inc|corp|llc|industries|products|foods|enterprises|plot|street|road|industrial|area|phase|village|city|state|pin|india|dist|sector|building|floor|crossing|mumbai|delhi|bangalore|hyderabad|chennai|kolkata|pune|ahmedabad|goa|karnataka|maharashtra|tamil|uttar|haryana|gujarat)\b/i;
    const invalidIndicators = /\b(?:protein|fat|carbohydrate|sugar|kcal|barcode|gtin|mrp|exp|mfg)\b/i;

    if (cleaned.length >= 5 && validAddressIndicators.test(cleaned) && !invalidIndicators.test(cleaned)) {
      return makeDeclaration(true, cleaned, 'high');
    }
  }
  return makeDeclaration(false, null, 'low');
}

function extractNetQuantity(text: string): ComplianceDeclaration {
  const explicit = /(?:net\s*(?:qty|quantity|wt|weight|vol|volume|content|contents)|quantity|weight|volume)\s*[:\-]?\s*([\d.,]+\s*(?:kg|g|gm|gms|gram|grams|mg|l|lt|ltr|litre|litres|ml|pieces?|pcs?|nos?|number|units?|count))\b/i;
  const match = text.match(explicit);
  if (match && match[1]) {
    return makeDeclaration(true, match[1].trim(), 'high');
  }

  const lines = text.split(/[\r\n]+/).map(l => l.trim());
  const nutritionalWords = /energy|protein|fat|sugar|carbohydrate|sodium|per\s*100|serving|nutrient/i;
  for (const line of lines) {
    if (nutritionalWords.test(line)) continue;
    const standalone = /\b([\d.,]+\s*(?:kg|g|gm|gms|mg|l|lt|ltr|litre|ml|pcs|units))\b/i;
    const m = line.match(standalone);
    if (m && m[1]) {
      return makeDeclaration(true, m[1].trim(), 'medium');
    }
  }
  return makeDeclaration(false, null, 'low');
}

function extractManufactureDate(text: string): ComplianceDeclaration {
  const patterns = [
    /(?:mfg(?:\.|\s*date)?|mfd(?:\.|\s*date)?|manufacture\s*date|date\s*of\s*mfg|date\s*of\s*manufacture|date\s*of\s*packing|packing\s*date|packed\s*on|pkd|packed|dom)\s*[:\-]?\s*([0-9A-Za-z\s\/\-\.]{3,25})/i,
    /\b(?:mfg|mfd|pkd)\s*[:\-\s]?\s*(\d{1,2}[\/\-\.]\d{2,4}|\d{4}[\/\-\.]\d{1,2}[\/\-\.]\d{1,2}|\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})/i
  ];
  const value = firstMatch(text, patterns);
  if (value) {
    const dateMatch = value.match(/(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4}|\d{1,2}[\/\-\.]\d{2,4}|\d{4}[\/\-\.]\d{1,2}[\/\-\.]\d{1,2}|(?:(?:\d{1,2}[\s\/\-\.]*)?(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*[\s\/\-,.]*\d{2,4}))/i);
    if (dateMatch) {
      return makeDeclaration(true, dateMatch[0].trim(), 'high');
    }
    return makeDeclaration(true, value.trim(), 'medium');
  }
  return makeDeclaration(false, null, 'low');
}

function extractBestBefore(text: string): ComplianceDeclaration {
  const patterns = [
    /(?:best\s*b[e|o]?fore?|use\s*by|expiry\s*date|exp\.?\s*date|expiry|bbe|best\s*by|use\s*before|valid\s*up\s*to)\s*[:\-]?\s*([0-9A-Za-z\s\/\-\.]{3,25})/i,
    /\b(?:exp|expiry)\s*[:\-\s]?\s*(\d{1,2}[\/\-\.]\d{2,4}|\d{4}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4}|\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})/i,
    /(?:best\s*before\s*([0-9]+\s*(?:months?|days?|years?|weeks?)(?:\s*from\s*(?:mfg|mfd|pkd|packing|manufacture|date))?))/i
  ];
  const value = firstMatch(text, patterns);
  if (value) {
    const dateMatch = value.match(/(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4}|\d{1,2}[\/\-\.]\d{2,4}|\d{4}[\/\-\.]\d{1,2}[\/\-\.]\d{1,2}|(?:(?:\d{1,2}[\s\/\-\.]*)?(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*[\s\/\-,.]*\d{2,4})|\d+\s*months?)/i);
    if (dateMatch) {
      return makeDeclaration(true, dateMatch[0].trim(), 'high');
    }
    return makeDeclaration(true, value.trim(), 'medium');
  }
  return makeDeclaration(false, null, 'low');
}

function extractMRP(text: string): ComplianceDeclaration {
  const patterns = [
    /(?:m\.?r\.?p\.?|max(?:imum)?\s*retail\s*price|retail\s*price)\s*[:\-\(]?\s*(?:rs\.?|₹|inr)?\s*([\d,]+(?:\.\d{1,2})?)/i,
    /(?:rs\.?|₹|inr)\s*([\d,]+(?:\.\d{1,2})?)\s*(?:m\.?r\.?p|inclusive|incl)/i,
    /mrp\s*[:\-\s]?\s*(?:rs\.?|₹|inr)?\s*([\d,]+(?:\.\d{1,2})?)/i
  ];
  let value = firstMatch(text, patterns);
  if (value) {
    let num = value.replace(/[^\d.,]/g, '');
    if (num.length >= 5 && num.startsWith('3') && num.includes('.')) {
      const rest = num.substring(1);
      if (parseFloat(rest) > 0 && parseFloat(rest) < 50000) {
        num = rest;
      }
    }
    if (num && !isNaN(parseFloat(num)) && parseFloat(num) > 0) {
      return makeDeclaration(true, `₹${num}`, 'high');
    }
  }
  return makeDeclaration(false, null, 'low');
}

function extractConsumerCare(text: string): ComplianceDeclaration {
  const careSectionPattern = /(?:consumer\s*care|helpline|customer\s*care|feedback|complaint|customer\s*support)[^\n\r]*[\r\n]?[^\n\r]*/i;
  const section = text.match(careSectionPattern);

  const phonePattern = /(?:toll\s*free\s*[:\-]?\s*)?(?:1800[-\s]?\d{2,3}[-\s]?\d{4,5}|1800\d{6,7}|(?<!\d)(?:\+91[-\s]?)?[6-9]\d{9}(?!\d)|\d{3,4}[-\s]\d{7,8})/;
  const emailPattern = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/;

  if (section) {
    const phoneMatch = section[0].match(phonePattern);
    const emailMatch = section[0].match(emailPattern);
    if (phoneMatch || emailMatch) {
      const parts = [
        phoneMatch ? phoneMatch[0].trim() : null,
        emailMatch ? emailMatch[0].trim() : null
      ].filter(Boolean);
      return makeDeclaration(true, parts.join(' / '), 'high');
    }
  }

  const emailMatch = text.match(emailPattern);
  const tollFreeMatch = text.match(/(?:1800[-\s]?\d{2,3}[-\s]?\d{4,5}|1800\d{6,7})/);
  if (emailMatch || tollFreeMatch) {
    const parts = [
      tollFreeMatch ? tollFreeMatch[0].trim() : null,
      emailMatch ? emailMatch[0].trim() : null
    ].filter(Boolean);
    return makeDeclaration(true, parts.join(' / '), 'high');
  }

  return makeDeclaration(false, null, 'low');
}

function extractFSSAI(text: string): ComplianceDeclaration {
  const pattern = /(?:fssai(?:[^\d\n\r]{0,20})|lic\.?\s*(?:no\.?)?(?:[^\d\n\r]{0,10}))(\d{14})/i;
  const m = text.match(pattern);
  if (m && m[1]) {
    return makeDeclaration(true, m[1].trim(), 'high');
  }
  const standalone = /\b(100\d{11}|200\d{11}|115\d{11}|124\d{11})\b/;
  const m2 = text.match(standalone);
  if (m2 && m2[1]) {
    return makeDeclaration(true, m2[1].trim(), 'medium');
  }
  return makeDeclaration(false, null, 'low');
}

function extractCountryOfOrigin(text: string): ComplianceDeclaration {
  const patterns = [
    /(?:country\s*of\s*origin|made\s*in|product\s*of|manufactured\s*in)\s*[:\-]?\s*([A-Za-z ]{3,30})/i,
    /(?:origin)\s*[:\-]\s*([A-Za-z ]{3,20})/i
  ];
  const value = firstMatch(text, patterns);
  if (value) {
    const clean = value.replace(/\(inferred\)/i, '').trim();
    return makeDeclaration(true, clean, 'high');
  }
  if (/\bindia\b/i.test(text)) {
    return makeDeclaration(true, 'India', 'medium');
  }
  return makeDeclaration(false, null, 'low');
}

function extractRetailSalePrice(text: string): ComplianceDeclaration {
  const patterns = [
    /(?:unit\s*(?:sale\s*)?price|usp|unit\s*price)\s*[:\-]?\s*([^\n\r]{3,40})/i,
    /((?:rs\.?|₹)\s*[\d,]+(?:\.\d{1,3})?\s*(?:per|\/)\s*(?:g|gm|gram|kg|ml|l|unit|piece|pc|no)[^\n\r]*)/i
  ];
  const match = text.match(/(?:unit\s*(?:sale\s*)?price|usp|unit\s*price)\s*[:\-]?\s*([^\n\r]{3,40})/i);
  if (match && match[1]) {
    let clean = match[1].trim();
    if (/^3\s*0\./.test(clean)) clean = clean.replace(/^3\s*0\./, '₹0.');
    return makeDeclaration(true, clean, 'high');
  }

  const value = firstMatch(text, patterns);
  if (value) {
    let clean = value.trim();
    if (/^3\s*0\./.test(clean)) clean = clean.replace(/^3\s*0\./, '₹0.');
    return makeDeclaration(true, clean, 'high');
  }
  return makeDeclaration(false, null, 'low');
}

// ---- Main Compliance Analyser -------------------------------

export interface FormSpecificsOverride {
  productName?: string;
  netQuantity?: string;
  quantityUnit?: string;
  mrp?: string;
  manufactureDate?: string;
  expiryDate?: string;
  manufacturer?: string;
  consumerCare?: string;
  fssaiLicense?: string;
  countryOfOrigin?: string;
  unitPrice?: string;
}

export function analyseCompliance(
  rawText: string,
  productNameOrOverrides?: string | FormSpecificsOverride
): {
  declarations: ComplianceDeclarations;
  violations: Violation[];
  complianceScore: number;
  complianceStatus: ComplianceStatus;
} {
  const text = normalizeOCRText(rawText);

  let productName = typeof productNameOrOverrides === 'string' ? productNameOrOverrides : productNameOrOverrides?.productName;
  let formValues: FormSpecificsOverride | undefined = typeof productNameOrOverrides === 'object' ? productNameOrOverrides : undefined;

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

  // Form value overrides: If user entered or scanned valid form values, update declaration state
  if (formValues) {
    if (formValues.productName && formValues.productName.trim() && formValues.productName !== 'Could not identify product') {
      declarations.genericName = makeDeclaration(true, formValues.productName.trim(), 'high');
    }
    if (formValues.mrp && formValues.mrp.trim() !== '') {
      const cleanNum = formValues.mrp.replace(/[^\d.,]/g, '');
      if (cleanNum && !isNaN(parseFloat(cleanNum)) && parseFloat(cleanNum) > 0) {
        declarations.mrp = makeDeclaration(true, `₹${cleanNum}`, 'high');
      }
    }
    if (formValues.netQuantity && formValues.netQuantity.trim() !== '') {
      const val = `${formValues.netQuantity.trim()} ${formValues.quantityUnit || ''}`.trim();
      declarations.netQuantity = makeDeclaration(true, val, 'high');
    }
    if (formValues.manufactureDate && formValues.manufactureDate.trim() !== '') {
      declarations.manufactureDate = makeDeclaration(true, formValues.manufactureDate.trim(), 'high');
    }
    if (formValues.expiryDate && formValues.expiryDate.trim() !== '') {
      declarations.bestBefore = makeDeclaration(true, formValues.expiryDate.trim(), 'high');
    }
    if (formValues.manufacturer && formValues.manufacturer.trim() !== '') {
      declarations.manufacturer = makeDeclaration(true, formValues.manufacturer.trim(), 'high');
    }
    if (formValues.consumerCare && formValues.consumerCare.trim() !== '') {
      declarations.consumerCare = makeDeclaration(true, formValues.consumerCare.trim(), 'high');
    }
    if (formValues.fssaiLicense && formValues.fssaiLicense.trim() !== '') {
      declarations.fssaiLicense = makeDeclaration(true, formValues.fssaiLicense.trim(), 'high');
    }
    if (formValues.countryOfOrigin && formValues.countryOfOrigin.trim() !== '') {
      declarations.countryOfOrigin = makeDeclaration(true, formValues.countryOfOrigin.trim(), 'high');
    }
    if (formValues.unitPrice && formValues.unitPrice.trim() !== '') {
      declarations.retailSalePrice = makeDeclaration(true, formValues.unitPrice.trim(), 'high');
    }
  } else if ((!declarations.genericName.present || !declarations.genericName.value) && productName && productName.trim() && productName !== 'Could not identify product') {
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

  // Readability & Font Size Compliance Check (Legal Metrology Rules 2011, Rule 13)
  let qtyValueGrams = 250;
  if (declarations.netQuantity.present && declarations.netQuantity.value) {
    const qtyText = declarations.netQuantity.value;
    const match = qtyText.match(/([\d.,]+)\s*([a-zA-Z]+)/);
    if (match) {
      const val = parseFloat(match[1]);
      const unit = match[2].toLowerCase();
      if (['kg', 'l', 'lt', 'ltr', 'litre'].includes(unit)) {
        qtyValueGrams = val * 1000;
      } else if (['g', 'gm', 'gms', 'ml'].includes(unit)) {
        qtyValueGrams = val;
      } else if (['lbs', 'pound', 'lb'].includes(unit)) {
        qtyValueGrams = val * 453.6;
      } else if (['oz', 'ounce'].includes(unit)) {
        qtyValueGrams = val * 28.35;
      }
    }
  }

  let minHeightMm = 1.0;
  if (qtyValueGrams > 1000) {
    minHeightMm = 4.0;
  } else if (qtyValueGrams > 200) {
    minHeightMm = 2.0;
  } else if (qtyValueGrams > 50) {
    minHeightMm = 1.5;
  }

  const unreadableDeclarations = Object.keys(declarations).filter(key => {
    const dec = declarations[key as keyof ComplianceDeclarations];
    return dec.present && dec.confidence === 'low';
  });

  if (unreadableDeclarations.length > 0) {
    violations.push({
      field: 'netQuantity',
      label: 'Readability / Font Size Check',
      message: `Font size warning: Under Legal Metrology Rules, package requires minimum numeral/letter height of ${minHeightMm} mm. Small or low-readability text detected for: ${unreadableDeclarations.map(k => k.replace(/([A-Z])/g, ' $1').trim()).join(', ')}.`,
      severity: 'minor',
    });
  }

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
