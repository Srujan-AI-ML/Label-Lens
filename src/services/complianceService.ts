// ============================================================
// Legal Metrology & Sectoral Regulatory Compliance Checking Service
// Validates extracted label text against Legal Metrology Rules, 2011
// and category-specific statutory requirements (FSSAI, CDSCO, BIS, etc.)
// ============================================================

import type {
  ComplianceDeclarations,
  ComplianceDeclaration,
  Violation,
  ComplianceStatus,
  ScannedProduct,
} from '../types';
import {
  type ProductCategory,
  normalizeCategory,
  CATEGORY_REQUIREMENTS,
  validateFSSAI,
  validateBarcodeGTIN,
  validateCategoryLicense,
} from './categoryRequirements';

// ---- Helpers ------------------------------------------------

function makeDeclaration(
  present: boolean,
  value: string | null,
  confidence: 'high' | 'medium' | 'low' = 'high',
  status?: 'PASS' | 'FAIL' | 'NOT_APPLICABLE',
  validationStatus?: string,
  validationMessage?: string,
  requirement?: 'REQUIRED' | 'OPTIONAL' | 'NOT_APPLICABLE'
): ComplianceDeclaration {
  return {
    present,
    value,
    confidence,
    status: status || (present ? 'PASS' : 'FAIL'),
    validationStatus,
    validationMessage,
    requirement: requirement || (present ? 'REQUIRED' : 'OPTIONAL'),
  };
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

// ---- Semantic Declaration Extractors ---------------------------------

function cleanProductNameString(raw: string): string {
  return raw
    .replace(/^(?:a\s+be\b|he\s*-\s*nn\b|[\W_]+)/gi, '')
    .replace(/\b(?:1\s*kg\s*pack|net\s*wt:?\s*\d+\s*\w+|barcode|gtin)\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractGenericName(text: string): ComplianceDeclaration {
  // 1. Explicit tag check
  const explicitPattern = /(?:product(?:\s*name)?|commodity|item(?:\s*name)?|product\s*identity|common\s*name|generic\s*name)\s*[:\-]\s*([^\n\r]{3,60})/i;
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
    'GOOD DAY', 'PARLE-G', 'SUNFEAST', 'MARICO', 'SAFFOLA', 'SLURRP FARM',
    'NIVEA', 'LOREAL', 'HIMALAYA', 'DETTOL', 'HARPIC', 'PHILIPS', 'HAVELLS',
    'SYSKA', 'BOAT', 'CIPLA', 'SUN PHARMA', 'LUPIN', 'MANKIND'
  ];

  const productKeywords = [
    'BASMATI RICE', 'ORGANIC BASMATI RICE', 'RICE', 'COOKIES', 'BISCUITS',
    'NOODLES', 'BUTTER', 'MILK', 'ATTA', 'FLOUR', 'OIL', 'GHEE', 'SPICES',
    'TEA', 'COFFEE', 'JUICE', 'SNACKS', 'SALT', 'SUGAR', 'PULSES', 'DAL',
    'HONEY', 'OATS', 'CHIPS', 'CHOCOLATE', 'PASTA', 'VERMICELLI', 'RAVA',
    'FACE WASH', 'FACE CREAM', 'BODY LOTION', 'SHAMPOO', 'SUNSCREEN', 'SERUM',
    'TABLETS', 'CAPSULES', 'SYRUP', 'OINTMENT', 'LED BULB', 'ELECTRIC IRON',
    'FLOOR CLEANER', 'DISHWASH', 'DETERGENT', 'COTTON SHIRT', 'TOY CAR'
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
  const pattern = /(?:manufactured\s*(?:&|and)?\s*(?:packed|marketed)?\s*by|mfd\.?\s*(?:&|and)?\s*pkd\.?\s*by|mfd\.?\s*by|mfg\.?\s*by|packed\s*by|marketed\s*by|imported\s*by|distributed\s*by|dist\.?\s*by|manufacturer\s*address|packer\s*address|manufacturer|packer|importer)\s*[:\-]?\s*([^\n\r]+(?:\n[^\n\r]+){0,3})/i;
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

    const validAddressIndicators = /\b(?:pvt|ltd|limited|inc|corp|llc|industries|products|foods|laboratories|enterprises|plot|street|road|industrial|area|phase|village|city|state|pin|india|dist|sector|building|floor|crossing|mumbai|delhi|bangalore|hyderabad|chennai|kolkata|pune|ahmedabad|goa|karnataka|maharashtra|tamil|uttar|haryana|gujarat)\b/i;
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
    /(?:best\s*b[e|o]?fore?|use\s*by|expiry\s*date|exp\.?\s*date|expires\s*on|expiry|bbe|best\s*by|use\s*before|valid\s*till|valid\s*until|valid\s*up\s*to)\s*[:\-]?\s*([0-9A-Za-z\s\/\-\.]{3,25})/i,
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
    /(?:m\.?r\.?p\.?|max(?:imum)?\s*retail\s*price|maximum\s*retail\s*selling\s*price|retail\s*price)\s*[:\-\(]?\s*(?:rs\.?|₹|inr)?\s*([\d,]+(?:\.\d{1,2})?)/i,
    /(?:rs\.?|₹|inr)\s*([\d,]+(?:\.\d{1,2})?)\s*(?:m\.?r\.?p|inclusive|incl)/i,
    /mrp\s*[:\-\s]?\s*(?:rs\.?|₹|inr)?\s*([\d,]+(?:\.\d{1,2})?)/i
  ];
  const value = firstMatch(text, patterns);
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
    const lic = m[1].trim();
    const valRes = validateFSSAI(lic);
    return makeDeclaration(
      valRes.isValid,
      lic,
      'high',
      valRes.isValid ? 'PASS' : 'FAIL',
      valRes.status,
      valRes.message,
      'REQUIRED'
    );
  }
  const standalone = /\b(100\d{11}|200\d{11}|115\d{11}|124\d{11})\b/;
  const m2 = text.match(standalone);
  if (m2 && m2[1]) {
    const lic = m2[1].trim();
    const valRes = validateFSSAI(lic);
    return makeDeclaration(
      valRes.isValid,
      lic,
      'medium',
      valRes.isValid ? 'PASS' : 'FAIL',
      valRes.status,
      valRes.message,
      'REQUIRED'
    );
  }
  return makeDeclaration(false, null, 'low', 'FAIL', 'MISSING', 'FSSAI License number is missing from the food label.', 'REQUIRED');
}

function extractSectoralLicense(text: string, category: ProductCategory): ComplianceDeclaration {
  const spec = CATEGORY_REQUIREMENTS[category] || CATEGORY_REQUIREMENTS['General Packaged Commodities'];
  const req = spec.regulatoryField.requirement;

  if (category === 'Food & Beverage') {
    return extractFSSAI(text);
  }

  if (req === 'NOT_APPLICABLE') {
    return makeDeclaration(true, null, 'high', 'NOT_APPLICABLE', 'NOT_APPLICABLE', `${spec.regulatoryField.label} is not applicable for ${category}.`, 'NOT_APPLICABLE');
  }

  let extractedVal: string | null = null;

  if (category === 'Cosmetics / Personal Care') {
    const cosPattern = /(?:mfg\.?\s*lic\.?\s*(?:no\.?)?\s*\(?cos\)?|cosmetic\s*lic\.?\s*(?:no\.?)?|form\s*32\s*(?:lic\.?\s*no\.?)?|rc\s*no\.?)\s*[:\-]?\s*([A-Za-z0-9\/\-\.]{4,35})/i;
    const m = text.match(cosPattern);
    if (m && m[1]) extractedVal = m[1].trim();
  } else if (category === 'Medicines / Pharmaceuticals') {
    const drugPattern = /(?:drug\s*lic\.?\s*(?:no\.?)?|mfg\.?\s*lic\.?\s*(?:no\.?)?|d\.?l\.?\s*no\.?|form\s*25\s*(?:no\.?)?|form\s*28\s*(?:no\.?)?)\s*[:\-]?\s*([A-Za-z0-9\/\-\.]{4,35})/i;
    const m = text.match(drugPattern);
    if (m && m[1]) extractedVal = m[1].trim();
  } else if (category === 'Electrical / Electronic Products' || category === 'Toys') {
    const bisPattern = /(?:bis\s*(?:reg\.?\s*no\.?|registration|lic\.?\s*no\.?)?|is\s*[:\s]?\s*\d{3,6}|isi\s*mark|cm\s*\/\s*l\s*-\s*\d{6,10}|r\s*-\s*\d{6,10})\s*[:\-]?\s*([A-Za-z0-9\/\-\.]{4,30})/i;
    const m = text.match(bisPattern);
    if (m && m[1]) extractedVal = m[1].trim();
  } else {
    const genPattern = /(?:reg\.?\s*no\.?|lic\.?\s*no\.?|license\s*no\.?)\s*[:\-]?\s*([A-Za-z0-9\/\-\.]{4,30})/i;
    const m = text.match(genPattern);
    if (m && m[1]) extractedVal = m[1].trim();
  }

  if (extractedVal) {
    const valRes = validateCategoryLicense(category, extractedVal);
    return makeDeclaration(
      valRes.isValid,
      extractedVal,
      'high',
      valRes.isValid ? 'PASS' : 'FAIL',
      valRes.status,
      valRes.message,
      req
    );
  }

  if (req === 'REQUIRED') {
    return makeDeclaration(false, null, 'low', 'FAIL', 'MISSING', `${spec.regulatoryField.label} is missing.`, 'REQUIRED');
  }

  return makeDeclaration(true, null, 'high', 'NOT_APPLICABLE', 'NOT_APPLICABLE', `${spec.regulatoryField.label} is optional/not required.`, req);
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
  regulatoryLicense?: string;
  countryOfOrigin?: string;
  unitPrice?: string;
  category?: string;
  barcode?: string;
}

export function analyseCompliance(
  rawText: string,
  productNameOrOverrides?: string | FormSpecificsOverride,
  categoryOverride?: string
): {
  declarations: ComplianceDeclarations;
  violations: Violation[];
  complianceScore: number;
  complianceStatus: ComplianceStatus;
  category: ProductCategory;
} {
  const text = normalizeOCRText(rawText);

  const formValues: FormSpecificsOverride | undefined = typeof productNameOrOverrides === 'object' ? productNameOrOverrides : undefined;
  const productName = typeof productNameOrOverrides === 'string' ? productNameOrOverrides : formValues?.productName;

  const resolvedCategory = normalizeCategory(categoryOverride || formValues?.category);
  const spec = CATEGORY_REQUIREMENTS[resolvedCategory] || CATEGORY_REQUIREMENTS['General Packaged Commodities'];

  const declarations: ComplianceDeclarations = {
    genericName: extractGenericName(text),
    manufacturer: extractManufacturer(text),
    netQuantity: extractNetQuantity(text),
    manufactureDate: extractManufactureDate(text),
    mrp: extractMRP(text),
    consumerCare: extractConsumerCare(text),
    bestBefore: extractBestBefore(text),
    countryOfOrigin: extractCountryOfOrigin(text),
    fssaiLicense: resolvedCategory === 'Food & Beverage'
      ? extractFSSAI(text)
      : makeDeclaration(true, null, 'high', 'NOT_APPLICABLE', 'NOT_APPLICABLE', 'FSSAI License is not applicable for this category.', 'NOT_APPLICABLE'),
    retailSalePrice: extractRetailSalePrice(text),
  };

  // Extract Sectoral License (Drug, Cosmetic, BIS, etc.)
  const sectoralDecl = extractSectoralLicense(text, resolvedCategory);
  if (spec.regulatoryField.key && spec.regulatoryField.key !== 'fssaiLicense') {
    declarations[spec.regulatoryField.key] = sectoralDecl;
    declarations.regulatoryLicense = sectoralDecl;
  }

  // Form value overrides: If user entered or scanned valid form values, update declaration state
  if (formValues) {
    if (formValues.productName !== undefined) {
      if (formValues.productName.trim() && formValues.productName !== 'Could not identify product') {
        declarations.genericName = makeDeclaration(true, formValues.productName.trim(), 'high', 'PASS');
      } else {
        declarations.genericName = makeDeclaration(false, null, 'low', 'FAIL');
      }
    }
    if (formValues.mrp !== undefined) {
      const cleanNum = formValues.mrp.replace(/[^\d.,]/g, '');
      if (cleanNum && !isNaN(parseFloat(cleanNum)) && parseFloat(cleanNum) > 0) {
        declarations.mrp = makeDeclaration(true, `₹${cleanNum}`, 'high', 'PASS');
      } else {
        declarations.mrp = makeDeclaration(false, null, 'low', 'FAIL');
      }
    }
    if (formValues.netQuantity !== undefined) {
      if (formValues.netQuantity.trim() !== '') {
        const val = `${formValues.netQuantity.trim()} ${formValues.quantityUnit || ''}`.trim();
        declarations.netQuantity = makeDeclaration(true, val, 'high', 'PASS');
      } else {
        declarations.netQuantity = makeDeclaration(false, null, 'low', 'FAIL');
      }
    }
    if (formValues.manufactureDate !== undefined) {
      if (formValues.manufactureDate.trim() !== '') {
        declarations.manufactureDate = makeDeclaration(true, formValues.manufactureDate.trim(), 'high', 'PASS');
      } else {
        declarations.manufactureDate = makeDeclaration(false, null, 'low', 'FAIL');
      }
    }
    if (formValues.expiryDate !== undefined) {
      if (formValues.expiryDate.trim() !== '') {
        declarations.bestBefore = makeDeclaration(true, formValues.expiryDate.trim(), 'high', 'PASS');
      } else {
        // Only fail bestBefore if required for this category
        const expiryReq = spec.mandatoryDeclarations.find(d => d.key === 'bestBefore')?.requirement;
        if (expiryReq === 'NOT_APPLICABLE') {
          declarations.bestBefore = makeDeclaration(true, null, 'high', 'NOT_APPLICABLE', 'NOT_APPLICABLE', 'Expiry date is not applicable for this commodity.', 'NOT_APPLICABLE');
        } else if (expiryReq === 'OPTIONAL') {
          declarations.bestBefore = makeDeclaration(true, null, 'high', 'PASS', 'OPTIONAL', 'Expiry date is optional.', 'OPTIONAL');
        } else {
          declarations.bestBefore = makeDeclaration(false, null, 'low', 'FAIL');
        }
      }
    }
    if (formValues.manufacturer !== undefined) {
      if (formValues.manufacturer.trim() !== '') {
        declarations.manufacturer = makeDeclaration(true, formValues.manufacturer.trim(), 'high', 'PASS');
      } else {
        declarations.manufacturer = makeDeclaration(false, null, 'low', 'FAIL');
      }
    }
    if (formValues.consumerCare !== undefined) {
      if (formValues.consumerCare.trim() !== '') {
        declarations.consumerCare = makeDeclaration(true, formValues.consumerCare.trim(), 'high', 'PASS');
      } else {
        declarations.consumerCare = makeDeclaration(false, null, 'low', 'FAIL');
      }
    }

    // Category-specific regulatory license override
    const activeLicVal = formValues.regulatoryLicense !== undefined ? formValues.regulatoryLicense : formValues.fssaiLicense;

    if (resolvedCategory === 'Food & Beverage') {
      const fssaiInput = formValues.fssaiLicense !== undefined ? formValues.fssaiLicense : formValues.regulatoryLicense;
      if (fssaiInput && fssaiInput.trim()) {
        const valRes = validateFSSAI(fssaiInput);
        declarations.fssaiLicense = makeDeclaration(
          valRes.isValid,
          valRes.value,
          'high',
          valRes.isValid ? 'PASS' : 'FAIL',
          valRes.status,
          valRes.message,
          'REQUIRED'
        );
      } else {
        declarations.fssaiLicense = makeDeclaration(false, null, 'low', 'FAIL', 'MISSING', 'FSSAI License number is missing from the food product.', 'REQUIRED');
      }
    } else {
      declarations.fssaiLicense = makeDeclaration(true, null, 'high', 'NOT_APPLICABLE', 'NOT_APPLICABLE', 'FSSAI License is not applicable for this category.', 'NOT_APPLICABLE');

      if (spec.regulatoryField.key) {
        if (activeLicVal && activeLicVal.trim()) {
          const valRes = validateCategoryLicense(resolvedCategory, activeLicVal);
          const decl = makeDeclaration(
            valRes.isValid,
            activeLicVal.trim(),
            'high',
            valRes.isValid ? 'PASS' : 'FAIL',
            valRes.status,
            valRes.message,
            spec.regulatoryField.requirement
          );
          declarations[spec.regulatoryField.key] = decl;
          declarations.regulatoryLicense = decl;
        } else {
          const isReq = spec.regulatoryField.requirement === 'REQUIRED';
          const decl = makeDeclaration(
            !isReq,
            null,
            'low',
            isReq ? 'FAIL' : 'NOT_APPLICABLE',
            isReq ? 'MISSING' : 'NOT_APPLICABLE',
            isReq ? `${spec.regulatoryField.label} is missing.` : 'Not required.',
            spec.regulatoryField.requirement
          );
          declarations[spec.regulatoryField.key] = decl;
          declarations.regulatoryLicense = decl;
        }
      }
    }

    if (formValues.countryOfOrigin !== undefined) {
      if (formValues.countryOfOrigin.trim() !== '') {
        declarations.countryOfOrigin = makeDeclaration(true, formValues.countryOfOrigin.trim(), 'high', 'PASS');
      } else {
        declarations.countryOfOrigin = makeDeclaration(false, null, 'low', 'FAIL');
      }
    }
    if (formValues.unitPrice !== undefined) {
      if (formValues.unitPrice.trim() !== '') {
        declarations.retailSalePrice = makeDeclaration(true, formValues.unitPrice.trim(), 'high', 'PASS');
      } else {
        declarations.retailSalePrice = makeDeclaration(false, null, 'low', 'FAIL');
      }
    }
  } else if ((!declarations.genericName.present || !declarations.genericName.value) && productName && productName.trim() && productName !== 'Could not identify product') {
    declarations.genericName = makeDeclaration(true, productName.trim(), 'high', 'PASS');
  }

  // Handle Best Before requirement when non-applicable for non-perishable categories
  const bestBeforeSpec = spec.mandatoryDeclarations.find(d => d.key === 'bestBefore');
  if (bestBeforeSpec?.requirement === 'NOT_APPLICABLE') {
    declarations.bestBefore = makeDeclaration(true, declarations.bestBefore?.value || null, 'high', 'NOT_APPLICABLE', 'NOT_APPLICABLE', 'Expiry date is not mandatory for non-perishable commodity.', 'NOT_APPLICABLE');
  }

  // Build Violations List strictly from applicable rules for this category
  const violations: Violation[] = [];

  spec.mandatoryDeclarations.forEach(item => {
    if (item.requirement === 'NOT_APPLICABLE') return;

    const decl = declarations[item.key] || (item.key === spec.regulatoryField.key ? declarations.regulatoryLicense : undefined);

    if (item.requirement === 'REQUIRED') {
      if (!decl || !decl.present || decl.status === 'FAIL') {
        violations.push({
          field: item.key,
          label: item.label,
          message: decl?.validationMessage || `${item.label} (${item.description}) is missing or invalid.`,
          severity: item.severity,
        });
      }
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
    return dec && dec.present && dec.confidence === 'low';
  });

  if (unreadableDeclarations.length > 0) {
    violations.push({
      field: 'netQuantity',
      label: 'Readability / Font Size Check',
      message: `Font size warning: Under Legal Metrology Rules, package requires minimum numeral/letter height of ${minHeightMm} mm. Small or low-readability text detected for: ${unreadableDeclarations.map(k => k.replace(/([A-Z])/g, ' $1').trim()).join(', ')}.`,
      severity: 'minor',
    });
  }

  // Dynamic Compliance Score Calculation
  const applicableMandatory = spec.mandatoryDeclarations.filter(d => d.requirement === 'REQUIRED');
  const applicableOptional = spec.mandatoryDeclarations.filter(d => d.requirement === 'OPTIONAL');

  let earnedScore = 0;
  let totalPossible = 0;

  applicableMandatory.forEach(item => {
    const weight = item.severity === 'critical' ? 12 : 8;
    totalPossible += weight;
    const decl = declarations[item.key] || (item.key === spec.regulatoryField.key ? declarations.regulatoryLicense : undefined);
    if (decl && decl.present && decl.status !== 'FAIL') {
      earnedScore += weight;
    }
  });

  applicableOptional.forEach(item => {
    const weight = 3;
    totalPossible += weight;
    const decl = declarations[item.key];
    if (decl && decl.present && decl.status !== 'FAIL') {
      earnedScore += weight;
    }
  });

  const complianceScore = totalPossible > 0 ? Math.min(100, Math.round((earnedScore / totalPossible) * 100)) : 100;

  // Status
  let complianceStatus: ComplianceStatus;
  if (complianceScore === 100) {
    complianceStatus = 'Compliant';
  } else if (complianceScore === 0) {
    complianceStatus = 'Non-Compliant';
  } else {
    complianceStatus = 'Partially Compliant';
  }

  return { declarations, violations, complianceScore, complianceStatus, category: resolvedCategory };
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
  regulatoryLicense?: string;
  category?: string;
}): ValidationResult {
  if (!data.productName.trim()) {
    return { isValid: false, errorMsg: 'Product Common / Generic Name is required.' };
  }

  if (data.barcode && data.barcode.trim()) {
    const bcodeRes = validateBarcodeGTIN(data.barcode);
    if (!bcodeRes.isValid) {
      return { isValid: false, errorMsg: bcodeRes.message };
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

  const cat = normalizeCategory(data.category);
  const isExpiryRequired = cat === 'Food & Beverage' || cat === 'Medicines / Pharmaceuticals' || cat === 'Cosmetics / Personal Care' || cat === 'Household / Cleaning Products';

  if (isExpiryRequired && data.expiryDate.trim()) {
    const exp = new Date(data.expiryDate);
    const mfg = new Date(data.mfgDate);
    if (isNaN(exp.getTime())) {
      return { isValid: false, errorMsg: 'Expiry Date must be a valid calendar date selection.' };
    }
    if (!isNaN(mfg.getTime()) && exp < mfg) {
      return { isValid: false, errorMsg: 'Expiry / Best Before date must be after the Manufacture date.' };
    }
  }

  if (cat === 'Food & Beverage') {
    const licToCheck = data.fssaiLicense?.trim() || data.regulatoryLicense?.trim();
    if (licToCheck) {
      const fssaiRes = validateFSSAI(licToCheck);
      if (!fssaiRes.isValid) {
        return { isValid: false, errorMsg: fssaiRes.message };
      }
    }
  }

  return { isValid: true, errorMsg: null };
}

// Build a full ScannedProduct object
export function buildScanResult(
  rawText: string,
  productNameOrOverrides: string | FormSpecificsOverride,
  barcode?: string,
  imageData?: string,
  categoryOverride?: string
): Omit<ScannedProduct, 'id'> {
  const { declarations, violations, complianceScore, complianceStatus, category } = analyseCompliance(
    rawText,
    productNameOrOverrides,
    categoryOverride
  );

  const productName = typeof productNameOrOverrides === 'string'
    ? productNameOrOverrides
    : (productNameOrOverrides?.productName || 'Inspected Commodity');

  const mrpVal = typeof productNameOrOverrides === 'object' && productNameOrOverrides.mrp !== undefined
    ? (productNameOrOverrides.mrp.trim() ? (productNameOrOverrides.mrp.startsWith('₹') ? productNameOrOverrides.mrp : `₹${productNameOrOverrides.mrp.replace(/[^\d.,]/g, '')}`) : null)
    : (declarations.mrp?.value || null);

  const regLic = typeof productNameOrOverrides === 'object'
    ? (productNameOrOverrides.regulatoryLicense || productNameOrOverrides.fssaiLicense || null)
    : null;

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
    mrp: mrpVal,
    category,
    regulatoryLicense: regLic,
  };
}

/**
 * Automatically calculate Unit Sale Price (USP) from MRP, Net Quantity, and Quantity Unit.
 */
export function calculateUnitSalePrice(
  mrpStr: string,
  qtyStr: string,
  unitStr: string
): string {
  if (!mrpStr || !qtyStr || !unitStr) return '';

  const cleanPrice = parseFloat(mrpStr.replace(/[^\d.]/g, ''));
  const cleanQty = parseFloat(qtyStr.replace(/[^\d.]/g, ''));

  if (isNaN(cleanPrice) || isNaN(cleanQty) || cleanPrice <= 0 || cleanQty <= 0) {
    return '';
  }

  const unit = unitStr.trim().toLowerCase();
  let baseQty = cleanQty;
  let standardUnitName = 'gram';

  if (unit === 'kg') {
    baseQty = cleanQty * 1000;
    standardUnitName = 'gram';
  } else if (unit === 'g' || unit === 'gm' || unit === 'gram' || unit === 'grams') {
    baseQty = cleanQty;
    standardUnitName = 'gram';
  } else if (unit === 'l' || unit === 'liter' || unit === 'litre' || unit === 'liters' || unit === 'litres') {
    baseQty = cleanQty * 1000;
    standardUnitName = 'ml';
  } else if (unit === 'ml' || unit === 'milliliter' || unit === 'millilitre') {
    baseQty = cleanQty;
    standardUnitName = 'ml';
  } else if (unit === 'pcs' || unit === 'pc' || unit === 'piece' || unit === 'pieces') {
    baseQty = cleanQty;
    standardUnitName = 'piece';
  } else if (unit === 'units' || unit === 'unit') {
    baseQty = cleanQty;
    standardUnitName = 'unit';
  } else {
    baseQty = cleanQty;
    standardUnitName = unit;
  }

  if (baseQty <= 0) return '';

  const pricePerUnit = cleanPrice / baseQty;

  let formattedNumber: string;
  if (pricePerUnit >= 1) {
    formattedNumber = pricePerUnit.toFixed(2);
  } else if (pricePerUnit >= 0.01) {
    const fixed3 = parseFloat(pricePerUnit.toFixed(3));
    const fixed2 = parseFloat(pricePerUnit.toFixed(2));
    if (fixed3 !== fixed2) {
      formattedNumber = pricePerUnit.toFixed(3);
    } else {
      formattedNumber = pricePerUnit.toFixed(2);
    }
  } else {
    formattedNumber = parseFloat(pricePerUnit.toFixed(4)).toString();
  }

  return `₹${formattedNumber} per ${standardUnitName}`;
}
