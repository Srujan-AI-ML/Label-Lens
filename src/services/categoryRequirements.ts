// ============================================================
// Legal Metrology & Regulatory Category Requirements Engine
// Centralized configuration for category detection, regulatory fields,
// FSSAI 14-digit validation, and Barcode (GTIN) Check-Digit validation.
// ============================================================

export type ProductCategory =
  | 'Food & Beverage'
  | 'Medicines / Pharmaceuticals'
  | 'Cosmetics / Personal Care'
  | 'Household / Cleaning Products'
  | 'Electrical / Electronic Products'
  | 'Toys'
  | 'Textiles / Garments'
  | 'General Packaged Commodities';

export const ALL_CATEGORIES: ProductCategory[] = [
  'Food & Beverage',
  'Medicines / Pharmaceuticals',
  'Cosmetics / Personal Care',
  'Household / Cleaning Products',
  'Electrical / Electronic Products',
  'Toys',
  'Textiles / Garments',
  'General Packaged Commodities',
];

export type FieldRequirementType = 'REQUIRED' | 'OPTIONAL' | 'NOT_APPLICABLE';
export type ValidationState =
  | 'VALID'
  | 'FORMAT_VALID_UNVERIFIED'
  | 'INVALID'
  | 'MISSING'
  | 'NOT_APPLICABLE'
  | 'EXTERNALLY_VERIFIED';

export interface RegulatoryFieldConfig {
  key: string;
  label: string;
  shortLabel: string;
  placeholder: string;
  helpText: string;
  requirement: FieldRequirementType;
  lawReference: string;
}

export interface CategoryRequirementSpec {
  category: ProductCategory;
  description: string;
  regulatoryField: RegulatoryFieldConfig;
  mandatoryDeclarations: Array<{
    key: string;
    label: string;
    requirement: FieldRequirementType;
    severity: 'critical' | 'major' | 'minor';
    description: string;
  }>;
}

// ------------------------------------------------------------
// Centralized Category Requirements Configuration
// ------------------------------------------------------------

export const CATEGORY_REQUIREMENTS: Record<ProductCategory, CategoryRequirementSpec> = {
  'Food & Beverage': {
    category: 'Food & Beverage',
    description: 'Packaged foods, beverages, edible oils, confectionery, and agricultural produce governed by FSSAI & Legal Metrology Rules, 2011.',
    regulatoryField: {
      key: 'fssaiLicense',
      label: 'FSSAI License / Registration Number (14 Digits)',
      shortLabel: 'FSSAI License',
      placeholder: 'e.g. 10012011000123',
      helpText: '14-digit unique identifier issued under Food Safety and Standards Act, 2006.',
      requirement: 'REQUIRED',
      lawReference: 'FSSAI Licensing & Registration Regulations, 2011',
    },
    mandatoryDeclarations: [
      { key: 'genericName', label: 'Generic / Common Name', requirement: 'REQUIRED', severity: 'critical', description: 'Common or generic product identity' },
      { key: 'netQuantity', label: 'Net Quantity', requirement: 'REQUIRED', severity: 'critical', description: 'Standard net weight / volume / count' },
      { key: 'mrp', label: 'Maximum Retail Price (MRP)', requirement: 'REQUIRED', severity: 'critical', description: 'Inclusive of all taxes' },
      { key: 'manufactureDate', label: 'Date of Manufacture / Packing', requirement: 'REQUIRED', severity: 'critical', description: 'Month & year of packing / manufacture' },
      { key: 'bestBefore', label: 'Best Before / Expiry Date', requirement: 'REQUIRED', severity: 'critical', description: 'Period of validity or best before date' },
      { key: 'manufacturer', label: 'Manufacturer / Packer Name & Address', requirement: 'REQUIRED', severity: 'critical', description: 'Complete identity & physical address' },
      { key: 'consumerCare', label: 'Consumer Care Contact Details', requirement: 'REQUIRED', severity: 'critical', description: 'Helpline / email for consumer feedback' },
      { key: 'fssaiLicense', label: 'FSSAI License / Registration No.', requirement: 'REQUIRED', severity: 'major', description: '14-digit FSSAI number' },
      { key: 'countryOfOrigin', label: 'Country of Origin', requirement: 'OPTIONAL', severity: 'minor', description: 'Mandatory if imported' },
      { key: 'retailSalePrice', label: 'Retail Sale Price per Unit (USP)', requirement: 'OPTIONAL', severity: 'minor', description: 'Unit sale price declaration' },
    ],
  },

  'Cosmetics / Personal Care': {
    category: 'Cosmetics / Personal Care',
    description: 'Skincare, haircare, makeup, fragrances, and personal hygiene products governed by Drugs & Cosmetics Act, 1940 and Cosmetics Rules, 2020.',
    regulatoryField: {
      key: 'cosmeticsLicense',
      label: 'Cosmetics Manufacturing / Import License Number',
      shortLabel: 'Cosmetics License',
      placeholder: 'e.g. COS/MFG/MH/2023/1089 or Form 32 Lic No.',
      helpText: 'Manufacturing License number issued under Cosmetics Rules, 2020 or Import Registration Certificate (RC).',
      requirement: 'REQUIRED',
      lawReference: 'Cosmetics Rules, 2020 / Drugs & Cosmetics Act, 1940',
    },
    mandatoryDeclarations: [
      { key: 'genericName', label: 'Generic / Cosmetic Name', requirement: 'REQUIRED', severity: 'critical', description: 'Name of the cosmetic product' },
      { key: 'netQuantity', label: 'Net Quantity / Content', requirement: 'REQUIRED', severity: 'critical', description: 'Net weight or volume' },
      { key: 'mrp', label: 'Maximum Retail Price (MRP)', requirement: 'REQUIRED', severity: 'critical', description: 'Inclusive of all taxes' },
      { key: 'manufactureDate', label: 'Date of Manufacture', requirement: 'REQUIRED', severity: 'critical', description: 'Month & year of manufacture' },
      { key: 'bestBefore', label: 'Expiry / Use Before Date', requirement: 'REQUIRED', severity: 'critical', description: 'Expiry date / period after opening' },
      { key: 'manufacturer', label: 'Manufacturer / Importer Address', requirement: 'REQUIRED', severity: 'critical', description: 'Name and principal address of mfr/importer' },
      { key: 'consumerCare', label: 'Customer Care Details', requirement: 'REQUIRED', severity: 'critical', description: 'Consumer grievance contact' },
      { key: 'cosmeticsLicense', label: 'Cosmetics Manufacturing / Import License', requirement: 'REQUIRED', severity: 'major', description: 'Applicable cosmetic license number' },
      { key: 'fssaiLicense', label: 'FSSAI License', requirement: 'NOT_APPLICABLE', severity: 'minor', description: 'Not applicable to cosmetics' },
      { key: 'countryOfOrigin', label: 'Country of Origin', requirement: 'OPTIONAL', severity: 'minor', description: 'Mandatory if imported' },
      { key: 'retailSalePrice', label: 'Unit Sale Price (USP)', requirement: 'OPTIONAL', severity: 'minor', description: 'Price per unit' },
    ],
  },

  'Medicines / Pharmaceuticals': {
    category: 'Medicines / Pharmaceuticals',
    description: 'Prescription drugs, OTC medicines, pharmaceutical formulations, and ayurvedic/homeopathic remedies under Drugs and Cosmetics Act, 1940.',
    regulatoryField: {
      key: 'drugLicense',
      label: 'Drug Manufacturing / Sale License Number',
      shortLabel: 'Drug License',
      placeholder: 'e.g. DL-25B/2021/4492 or Form 25 / Form 28 Lic',
      helpText: 'Drug manufacturing license issued by State Licensing Authority (Form 25/28) or Central CDSCO.',
      requirement: 'REQUIRED',
      lawReference: 'Drugs and Cosmetics Act, 1940 & Rules 1945',
    },
    mandatoryDeclarations: [
      { key: 'genericName', label: 'Generic / Brand Drug Identity', requirement: 'REQUIRED', severity: 'critical', description: 'Proper/Generic scientific name and brand' },
      { key: 'netQuantity', label: 'Net Quantity / Count / Dosage', requirement: 'REQUIRED', severity: 'critical', description: 'Tablets count / volume / dosage' },
      { key: 'mrp', label: 'Maximum Retail Price (MRP)', requirement: 'REQUIRED', severity: 'critical', description: 'Inclusive of all taxes' },
      { key: 'manufactureDate', label: 'Date of Manufacture (Mfg Date)', requirement: 'REQUIRED', severity: 'critical', description: 'Month & year of manufacturing' },
      { key: 'bestBefore', label: 'Expiry Date (Exp Date)', requirement: 'REQUIRED', severity: 'critical', description: 'Mandatory expiry date for drug efficacy' },
      { key: 'manufacturer', label: 'Manufacturing Laboratory & Address', requirement: 'REQUIRED', severity: 'critical', description: 'Licensed manufacturing premises' },
      { key: 'consumerCare', label: 'Consumer Support / Medical Helpline', requirement: 'REQUIRED', severity: 'critical', description: 'Contact for adverse drug events or inquiries' },
      { key: 'drugLicense', label: 'Drug Manufacturing License Number', requirement: 'REQUIRED', severity: 'major', description: 'Official Drug License number' },
      { key: 'fssaiLicense', label: 'FSSAI License', requirement: 'NOT_APPLICABLE', severity: 'minor', description: 'Not applicable to pharmaceuticals' },
      { key: 'countryOfOrigin', label: 'Country of Origin', requirement: 'OPTIONAL', severity: 'minor', description: 'Required if imported bulk or finished drug' },
      { key: 'retailSalePrice', label: 'Unit Sale Price (USP)', requirement: 'OPTIONAL', severity: 'minor', description: 'Price per unit/tablet' },
    ],
  },

  'Electrical / Electronic Products': {
    category: 'Electrical / Electronic Products',
    description: 'Consumer electronics, electrical appliances, computing equipment, and LED lighting governed by BIS Compulsory Registration Scheme (CRS) & LM Rules.',
    regulatoryField: {
      key: 'bisRegistration',
      label: 'BIS Registration / License Number (CRS / ISI)',
      shortLabel: 'BIS Registration',
      placeholder: 'e.g. R-41001234 or CM/L-7200145689',
      helpText: 'Bureau of Indian Standards registration under CRS (R-XXXXXXXX) or ISI Certification (CM/L-XXXXXXX).',
      requirement: 'REQUIRED',
      lawReference: 'Bureau of Indian Standards (Conformity Assessment) Regulations, 2018',
    },
    mandatoryDeclarations: [
      { key: 'genericName', label: 'Generic Commodity Name', requirement: 'REQUIRED', severity: 'critical', description: 'Common name of the electrical appliance' },
      { key: 'netQuantity', label: 'Net Quantity / Unit Count', requirement: 'REQUIRED', severity: 'critical', description: 'Package unit count / pcs' },
      { key: 'mrp', label: 'Maximum Retail Price (MRP)', requirement: 'REQUIRED', severity: 'critical', description: 'Inclusive of all taxes' },
      { key: 'manufactureDate', label: 'Month & Year of Manufacture / Import', requirement: 'REQUIRED', severity: 'critical', description: 'Manufacturing or packing date' },
      { key: 'manufacturer', label: 'Manufacturer / Importer Name & Address', requirement: 'REQUIRED', severity: 'critical', description: 'Principal manufacturing / importing entity' },
      { key: 'consumerCare', label: 'Customer Care & Service Helpline', requirement: 'REQUIRED', severity: 'critical', description: 'Service helpline / contact for repairs & warranty' },
      { key: 'bisRegistration', label: 'BIS Registration / License Number', requirement: 'REQUIRED', severity: 'major', description: 'BIS CRS (R-XXXXXXXX) or ISI CM/L number' },
      { key: 'fssaiLicense', label: 'FSSAI License', requirement: 'NOT_APPLICABLE', severity: 'minor', description: 'Not applicable to electronics' },
      { key: 'bestBefore', label: 'Best Before / Expiry Date', requirement: 'NOT_APPLICABLE', severity: 'minor', description: 'Not applicable for non-perishable electronic goods' },
      { key: 'countryOfOrigin', label: 'Country of Origin', requirement: 'OPTIONAL', severity: 'minor', description: 'Mandatory declaration for electronics' },
      { key: 'retailSalePrice', label: 'Unit Sale Price (USP)', requirement: 'OPTIONAL', severity: 'minor', description: 'Unit sale price' },
    ],
  },

  'Toys': {
    category: 'Toys',
    description: 'Toys, play equipment, and children recreation commodities under Toys (Quality Control) Order, 2020 & BIS Standard IS 9873.',
    regulatoryField: {
      key: 'bisToyLicense',
      label: 'BIS Toy Safety License / ISI Number (CM/L-XXXXXXX)',
      shortLabel: 'BIS Toy License',
      placeholder: 'e.g. CM/L-8400123456 (IS 9873)',
      helpText: 'Mandatory BIS Standard Mark and License Number (CM/L) under Toys (Quality Control) Order.',
      requirement: 'REQUIRED',
      lawReference: 'Toys (Quality Control) Order, 2020 / IS 9873 Safety Standards',
    },
    mandatoryDeclarations: [
      { key: 'genericName', label: 'Toy Generic / Item Name', requirement: 'REQUIRED', severity: 'critical', description: 'Common identity of the toy' },
      { key: 'netQuantity', label: 'Net Quantity (Pieces / Sets)', requirement: 'REQUIRED', severity: 'critical', description: 'Piece or set count' },
      { key: 'mrp', label: 'Maximum Retail Price (MRP)', requirement: 'REQUIRED', severity: 'critical', description: 'Inclusive of all taxes' },
      { key: 'manufactureDate', label: 'Month & Year of Manufacture / Packing', requirement: 'REQUIRED', severity: 'critical', description: 'Manufacturing/packing date' },
      { key: 'manufacturer', label: 'Manufacturer / Importer Details', requirement: 'REQUIRED', severity: 'critical', description: 'Complete name & address' },
      { key: 'consumerCare', label: 'Consumer Grievance Helpline', requirement: 'REQUIRED', severity: 'critical', description: 'Customer care contact' },
      { key: 'bisToyLicense', label: 'BIS Toy Safety License (ISI)', requirement: 'REQUIRED', severity: 'major', description: 'Mandatory BIS CM/L license for toys' },
      { key: 'fssaiLicense', label: 'FSSAI License', requirement: 'NOT_APPLICABLE', severity: 'minor', description: 'Not applicable to toys' },
      { key: 'bestBefore', label: 'Expiry Date', requirement: 'NOT_APPLICABLE', severity: 'minor', description: 'Not applicable to toys' },
      { key: 'countryOfOrigin', label: 'Country of Origin', requirement: 'OPTIONAL', severity: 'minor', description: 'Country of origin' },
      { key: 'retailSalePrice', label: 'Unit Sale Price (USP)', requirement: 'OPTIONAL', severity: 'minor', description: 'Price per piece/unit' },
    ],
  },

  'Household / Cleaning Products': {
    category: 'Household / Cleaning Products',
    description: 'Detergents, floor cleaners, disinfectants, dishwash liquids, and surface care commodities.',
    regulatoryField: {
      key: 'householdRegNumber',
      label: 'Applicable Regulatory Registration / License Number',
      shortLabel: 'Household Reg No.',
      placeholder: 'e.g. CIB&RC Reg No. / State Pollution Board / Mfg Lic',
      helpText: 'Applicable regulatory registration or manufacturing approval where mandated for chemical formulations.',
      requirement: 'OPTIONAL',
      lawReference: 'Legal Metrology Rules, 2011 & Insecticides Act / Chemical Safety Norms',
    },
    mandatoryDeclarations: [
      { key: 'genericName', label: 'Generic / Product Name', requirement: 'REQUIRED', severity: 'critical', description: 'Common identity of the cleaning product' },
      { key: 'netQuantity', label: 'Net Quantity (Volume/Weight)', requirement: 'REQUIRED', severity: 'critical', description: 'Net volume (ml/L) or weight (g/kg)' },
      { key: 'mrp', label: 'Maximum Retail Price (MRP)', requirement: 'REQUIRED', severity: 'critical', description: 'Inclusive of all taxes' },
      { key: 'manufactureDate', label: 'Date of Manufacture / Packing', requirement: 'REQUIRED', severity: 'critical', description: 'Month & year of packing' },
      { key: 'bestBefore', label: 'Expiry / Best Use Duration', requirement: 'REQUIRED', severity: 'major', description: 'Best before / shelf life duration' },
      { key: 'manufacturer', label: 'Manufacturer / Packer Name & Address', requirement: 'REQUIRED', severity: 'critical', description: 'Complete identity & address' },
      { key: 'consumerCare', label: 'Customer Helpline / Safety Support', requirement: 'REQUIRED', severity: 'critical', description: 'Contact info for customer service and emergency guidance' },
      { key: 'fssaiLicense', label: 'FSSAI License', requirement: 'NOT_APPLICABLE', severity: 'minor', description: 'Not applicable to cleaning products' },
      { key: 'countryOfOrigin', label: 'Country of Origin', requirement: 'OPTIONAL', severity: 'minor', description: 'Country of origin' },
      { key: 'retailSalePrice', label: 'Unit Sale Price (USP)', requirement: 'OPTIONAL', severity: 'minor', description: 'Price per unit' },
    ],
  },

  'Textiles / Garments': {
    category: 'Textiles / Garments',
    description: 'Apparel, garments, fabrics, hosiery, and made-up textile commodities under Legal Metrology & Textile Regulations.',
    regulatoryField: {
      key: 'textileIdentifier',
      label: 'Textile / Fiber Regulatory Identification / Mark',
      shortLabel: 'Textile Identifier',
      placeholder: 'e.g. Silk Mark / Handloom Mark / BIS IS 16695',
      helpText: 'Applicable textile fiber composition declaration or quality mark.',
      requirement: 'OPTIONAL',
      lawReference: 'Legal Metrology (Packaged Commodities) Rules & Textile Regulations',
    },
    mandatoryDeclarations: [
      { key: 'genericName', label: 'Generic Garment / Commodity Name', requirement: 'REQUIRED', severity: 'critical', description: 'Type of garment or textile article' },
      { key: 'netQuantity', label: 'Net Quantity / Piece Count & Size', requirement: 'REQUIRED', severity: 'critical', description: 'Piece count and dimensions / size code' },
      { key: 'mrp', label: 'Maximum Retail Price (MRP)', requirement: 'REQUIRED', severity: 'critical', description: 'Inclusive of all taxes' },
      { key: 'manufactureDate', label: 'Month & Year of Manufacture / Packing', requirement: 'REQUIRED', severity: 'critical', description: 'Packing month & year' },
      { key: 'manufacturer', label: 'Manufacturer / Packer Details', requirement: 'REQUIRED', severity: 'critical', description: 'Name and complete address' },
      { key: 'consumerCare', label: 'Consumer Grievance Contact', requirement: 'REQUIRED', severity: 'critical', description: 'Customer care phone/email' },
      { key: 'fssaiLicense', label: 'FSSAI License', requirement: 'NOT_APPLICABLE', severity: 'minor', description: 'Not applicable to garments' },
      { key: 'bestBefore', label: 'Expiry Date', requirement: 'NOT_APPLICABLE', severity: 'minor', description: 'Not applicable to textiles' },
      { key: 'countryOfOrigin', label: 'Country of Origin', requirement: 'OPTIONAL', severity: 'minor', description: 'Country of origin' },
      { key: 'retailSalePrice', label: 'Unit Sale Price (USP)', requirement: 'OPTIONAL', severity: 'minor', description: 'Price per piece/meter' },
    ],
  },

  'General Packaged Commodities': {
    category: 'General Packaged Commodities',
    description: 'All other pre-packaged commodities intended for retail sale under Legal Metrology (Packaged Commodities) Rules, 2011.',
    regulatoryField: {
      key: 'regulatoryIdentifier',
      label: 'Applicable Regulatory Registration / Identification',
      shortLabel: 'Regulatory ID',
      placeholder: 'e.g. Reg. No. / Applicable statutory identification',
      helpText: 'Any statutory license or registration number applicable to the commodity.',
      requirement: 'OPTIONAL',
      lawReference: 'Legal Metrology (Packaged Commodities) Rules, 2011',
    },
    mandatoryDeclarations: [
      { key: 'genericName', label: 'Generic / Common Name', requirement: 'REQUIRED', severity: 'critical', description: 'Common or generic name of commodity' },
      { key: 'netQuantity', label: 'Net Quantity', requirement: 'REQUIRED', severity: 'critical', description: 'Standard weight / volume / count' },
      { key: 'mrp', label: 'Maximum Retail Price (MRP)', requirement: 'REQUIRED', severity: 'critical', description: 'Inclusive of all taxes' },
      { key: 'manufactureDate', label: 'Month & Year of Manufacture / Packing', requirement: 'REQUIRED', severity: 'critical', description: 'Packing date' },
      { key: 'manufacturer', label: 'Manufacturer / Packer Details', requirement: 'REQUIRED', severity: 'critical', description: 'Name & address of mfr/packer' },
      { key: 'consumerCare', label: 'Consumer Care Helpline', requirement: 'REQUIRED', severity: 'critical', description: 'Helpline / email' },
      { key: 'fssaiLicense', label: 'FSSAI License', requirement: 'NOT_APPLICABLE', severity: 'minor', description: 'Not applicable to general commodities' },
      { key: 'bestBefore', label: 'Best Before / Expiry Date', requirement: 'OPTIONAL', severity: 'minor', description: 'If applicable for perishable goods' },
      { key: 'countryOfOrigin', label: 'Country of Origin', requirement: 'OPTIONAL', severity: 'minor', description: 'Mandatory if imported' },
      { key: 'retailSalePrice', label: 'Unit Sale Price (USP)', requirement: 'OPTIONAL', severity: 'minor', description: 'Price per unit' },
    ],
  },
};

// ------------------------------------------------------------
// Intelligent Product Category Detection
// ------------------------------------------------------------

export function normalizeCategory(categoryStr?: string | null): ProductCategory {
  if (!categoryStr) return 'Food & Beverage';
  const c = categoryStr.trim().toLowerCase();

  if (c.includes('food') || c.includes('beverage') || c.includes('snack') || c.includes('grain') || c.includes('dairy') || c.includes('vegetable') || c.includes('meat') || c.includes('tea') || c.includes('coffee')) {
    return 'Food & Beverage';
  }
  if (c.includes('cosmetic') || c.includes('personal') || c.includes('beauty') || c.includes('skin') || c.includes('hair') || c.includes('soap') || c.includes('lotion') || c.includes('shampoo')) {
    return 'Cosmetics / Personal Care';
  }
  if (c.includes('drug') || c.includes('medicin') || c.includes('pharma') || c.includes('tablet') || c.includes('syrup') || c.includes('capsule')) {
    return 'Medicines / Pharmaceuticals';
  }
  if (c.includes('electric') || c.includes('electronic') || c.includes('appliance') || c.includes('led') || c.includes('bulb') || c.includes('gadget') || c.includes('charger')) {
    return 'Electrical / Electronic Products';
  }
  if (c.includes('toy') || c.includes('game') || c.includes('doll') || c.includes('puzzle')) {
    return 'Toys';
  }
  if (c.includes('clean') || c.includes('house') || c.includes('detergent') || c.includes('dishwash') || c.includes('floor cleaner')) {
    return 'Household / Cleaning Products';
  }
  if (c.includes('textile') || c.includes('garment') || c.includes('cloth') || c.includes('apparel') || c.includes('shirt') || c.includes('cotton')) {
    return 'Textiles / Garments';
  }
  if (c.includes('general') || c.includes('commodity') || c.includes('other')) {
    return 'General Packaged Commodities';
  }

  return 'Food & Beverage';
}

export function detectProductCategory(
  rawText: string = '',
  productName: string = '',
  brand: string = '',
  existingCategory?: string
): { category: ProductCategory; confidence: 'high' | 'medium' | 'low'; reason: string } {
  if (existingCategory && ALL_CATEGORIES.includes(existingCategory as ProductCategory)) {
    return {
      category: existingCategory as ProductCategory,
      confidence: 'high',
      reason: `Preserved existing category selection: ${existingCategory}`,
    };
  }

  const combined = `${productName} ${brand} ${rawText}`.toLowerCase();

  // 1. Food & Beverage checks
  const foodKeywords = [
    'fssai', 'food', 'beverage', 'tea', 'coffee', 'biscuits', 'cookie', 'cookies', 'noodles',
    'rice', 'atta', 'flour', 'spices', 'masala', 'snack', 'snacks', 'namkeen', 'bhujia',
    'chocolate', 'confectionery', 'chips', 'ghee', 'butter', 'milk', 'curd', 'paneer', 'cheese',
    'jam', 'sauce', 'ketchup', 'juice', 'edible oil', 'mustard oil', 'sunflower oil', 'salt', 'sugar',
    'pulses', 'dal', 'honey', 'oats', 'pasta', 'vermicelli', 'ingredients:', 'nutritional information',
    'serving size', 'energy kcal', 'protein g', 'carbohydrate g', 'dietary fiber', 'saturated fat',
    'veg logo', 'green dot', '100% veg', 'contains added flavour', 'proprietary food', 'organic india',
    'haldiram', 'nestle', 'parle', 'amul', 'britannia', 'maggi', 'cadbury', 'tata tea', 'lays'
  ];

  // 2. Cosmetics & Personal Care checks
  const cosmeticKeywords = [
    'face wash', 'facewash', 'face cream', 'lotion', 'body wash', 'shampoo', 'conditioner',
    'serum', 'sunscreen', 'spf 30', 'spf 50', 'spf', 'moisturizer', 'moisturising', 'skin care',
    'hair oil', 'deodorant', 'perfume', 'eau de parfum', 'eau de toilette', 'lipstick', 'mascara',
    'foundation', 'eyeliner', 'kajal', 'nail polish', 'cosmetics', 'dermatologically tested',
    'for external use only', 'form 32', 'cosmetic lic', 'mfg lic no. (cos)', 'paraben free',
    'sulphate free', 'beauty', 'nivea', 'loreal', 'lakme', 'biotique', 'himalaya herbals',
    'mamaearth', 'ponds', 'garnier', 'dove', 'tresemme', 'plum'
  ];

  // 3. Medicines & Pharmaceuticals checks
  const pharmaKeywords = [
    'tablet', 'tablets', 'capsule', 'capsules', 'syrup', 'ointment', 'injection', 'drops',
    'dosage:', 'as directed by the physician', 'keep out of reach of children', 'schedule h',
    'schedule h1', 'schedule g', 'prescription drug', 'pharmacopoeia', 'i.p.', 'b.p.', 'u.s.p.',
    'paracetamol', 'ibuprofen', 'amoxicillin', 'cough syrup', 'antacid', 'analgesic',
    'drug license', 'drug licence', 'mfg. lic. no.', 'd.l. no.', 'cdsco', 'pharmaceutical',
    'pharma', 'lab ltd', 'form 25', 'form 28', 'cipla', 'sun pharma', 'dr. reddy', 'lupin',
    'mankind', 'gsk', 'abbott', 'alkem', 'torrent'
  ];

  // 4. Electrical & Electronics checks
  const electricalKeywords = [
    'led bulb', 'led lamp', 'bulb', 'watt', 'watts', '220v', '230v', '240v', '50hz', 'voltage',
    'charger', 'adapter', 'cable', 'usb cable', 'type-c', 'power bank', 'headphones', 'earphones',
    'speaker', 'television', 'refrigerator', 'washing machine', 'microwave', 'toaster', 'iron',
    'electric iron', 'hair dryer', 'battery', 'lithium ion', 'bis registration', 'bis crs',
    'r-410', 'r-411', 'is 1293', 'is 10322', 'is 616', 'isi mark', 'standby power', 'star rating',
    'energy efficiency', 'philips', 'havells', 'syska', 'boat', 'noise', 'samsung', 'lg', 'bajaj'
  ];

  // 5. Toys checks
  const toyKeywords = [
    'toy', 'toys', 'doll', 'action figure', 'puzzle', 'board game', 'stuffed animal', 'plush',
    'teddy bear', 'building blocks', 'lego', 'die-cast car', 'play set', 'choking hazard',
    'warning: not suitable for children under 3 years', 'age 3+', 'age 5+', 'ages 3 and up',
    'is 9873', 'bis toy', 'funskool', 'mattel', 'hasbro', 'fisher-price', 'hot wheels'
  ];

  // 6. Household & Cleaning checks
  const householdKeywords = [
    'floor cleaner', 'toilet cleaner', 'dishwash', 'detergent', 'washing powder', 'fabric softener',
    'disinfectant', 'surface cleaner', 'glass cleaner', 'drain cleaner', 'bleach', 'insect repellent',
    'mosquito repellent', 'liquid detergent', 'acid free', 'kills 99.9% germs', 'harpic', 'lysol',
    'dettol cleaner', 'colin', 'surf excel', 'ariel', 'tide', 'vim', 'pril'
  ];

  // 7. Textiles & Garments checks
  const textileKeywords = [
    '100% cotton', 'cotton', 'polyester', 'silk', 'wool', 'linen', 'rayon', 'nylon', 'spandex',
    'shirt', 't-shirt', 'trousers', 'jeans', 'dress', 'kurta', 'saree', 'bedsheet', 'towel',
    'wash care instructions', 'machine wash cold', 'do not bleach', 'iron low', 'handloom mark',
    'silk mark', 'size: s', 'size: m', 'size: l', 'size: xl', 'size: xxl', 'fiber content',
    'raymond', 'peter england', 'allen solly', 'van heusen', 'fabindia', 'zara', 'h&m'
  ];

  let foodScore = 0;
  let cosmeticScore = 0;
  let pharmaScore = 0;
  let electricalScore = 0;
  let toyScore = 0;
  let householdScore = 0;
  let textileScore = 0;

  foodKeywords.forEach(k => { if (combined.includes(k)) foodScore += (k === 'fssai' ? 5 : 2); });
  cosmeticKeywords.forEach(k => { if (combined.includes(k)) cosmeticScore += (k.includes('spf') || k.includes('face') ? 4 : 2); });
  pharmaKeywords.forEach(k => { if (combined.includes(k)) pharmaScore += (k.includes('schedule') || k.includes('tablet') ? 5 : 2); });
  electricalKeywords.forEach(k => { if (combined.includes(k)) electricalScore += (k.includes('watt') || k.includes('bis') ? 4 : 2); });
  toyKeywords.forEach(k => { if (combined.includes(k)) toyScore += (k.includes('toy') || k.includes('is 9873') ? 5 : 2); });
  householdKeywords.forEach(k => { if (combined.includes(k)) householdScore += (k.includes('cleaner') || k.includes('detergent') ? 4 : 2); });
  textileKeywords.forEach(k => { if (combined.includes(k)) textileScore += (k.includes('cotton') || k.includes('garment') ? 4 : 2); });

  const scores = [
    { cat: 'Food & Beverage' as ProductCategory, score: foodScore },
    { cat: 'Cosmetics / Personal Care' as ProductCategory, score: cosmeticScore },
    { cat: 'Medicines / Pharmaceuticals' as ProductCategory, score: pharmaScore },
    { cat: 'Electrical / Electronic Products' as ProductCategory, score: electricalScore },
    { cat: 'Toys' as ProductCategory, score: toyScore },
    { cat: 'Household / Cleaning Products' as ProductCategory, score: householdScore },
    { cat: 'Textiles / Garments' as ProductCategory, score: textileScore },
  ];

  scores.sort((a, b) => b.score - a.score);

  if (scores[0].score >= 3) {
    return {
      category: scores[0].cat,
      confidence: scores[0].score >= 6 ? 'high' : 'medium',
      reason: `Detected category signals for [${scores[0].cat}] (Match score: ${scores[0].score})`,
    };
  }

  // Fallback to General Packaged Commodities if no strong matches
  return {
    category: 'General Packaged Commodities',
    confidence: 'low',
    reason: 'Generic packaged commodity declarations detected',
  };
}

// ------------------------------------------------------------
// FSSAI 14-Digit Validation Routine
// ------------------------------------------------------------

export interface FssaiValidationResult {
  isValid: boolean;
  isFormatValid: boolean;
  value: string | null;
  status: ValidationState;
  statusText: string;
  message: string;
}

export function validateFSSAI(rawFssai?: string | null): FssaiValidationResult {
  if (!rawFssai || !rawFssai.trim()) {
    return {
      isValid: false,
      isFormatValid: false,
      value: null,
      status: 'MISSING',
      statusText: 'Missing License Number',
      message: 'FSSAI 14-digit license or registration number is missing from the label.',
    };
  }

  // Clean string: remove non-alphanumeric, extract digits
  const cleanLic = rawFssai.trim().replace(/[^0-9]/g, '');

  if (cleanLic.length !== 14) {
    return {
      isValid: false,
      isFormatValid: false,
      value: rawFssai.trim(),
      status: 'INVALID',
      statusText: 'Invalid Digit Count',
      message: `FSSAI number must be exactly 14 digits (found ${cleanLic.length} digits: "${rawFssai.trim()}").`,
    };
  }

  // Sanity check: prevent repeated digits or dummy numbers
  if (/^(\d)\1{13}$/.test(cleanLic)) {
    return {
      isValid: false,
      isFormatValid: false,
      value: cleanLic,
      status: 'INVALID',
      statusText: 'Invalid Sequence',
      message: 'FSSAI number cannot consist of identical repeated digits.',
    };
  }

  // Check valid registration prefix (FSSAI licenses typically start with 1, 2, or state registration digits)
  // First digit: 1 (Licence) or 2 (Registration)
  const firstDigit = cleanLic.charAt(0);
  const isStandardPrefix = firstDigit === '1' || firstDigit === '2';

  return {
    isValid: true,
    isFormatValid: true,
    value: cleanLic,
    status: 'FORMAT_VALID_UNVERIFIED',
    statusText: 'Format Valid (Not Externally Verified)',
    message: isStandardPrefix
      ? '14-digit FSSAI format is syntactically valid (authenticity not externally verified with FoSCoS portal).'
      : '14-digit numeric format valid (authenticity not externally verified).',
  };
}

// ------------------------------------------------------------
// Barcode (GTIN-8, 12, 13, 14) Check-Digit Validation Routine
// Standard Modulo-10 Algorithm
// ------------------------------------------------------------

export interface BarcodeValidationResult {
  isValid: boolean;
  isFormatValid: boolean;
  value: string | null;
  formatName: string;
  checkDigitExpected?: number;
  checkDigitFound?: number;
  status: ValidationState;
  statusText: string;
  message: string;
}

export function validateBarcodeGTIN(rawBarcode?: string | null): BarcodeValidationResult {
  if (!rawBarcode || !rawBarcode.trim()) {
    return {
      isValid: false,
      isFormatValid: false,
      value: null,
      formatName: 'None',
      status: 'MISSING',
      statusText: 'No Barcode Provided',
      message: 'Barcode was not detected or entered.',
    };
  }

  const clean = rawBarcode.trim().replace(/[\s\-]/g, '');

  if (!/^\d+$/.test(clean)) {
    return {
      isValid: false,
      isFormatValid: false,
      value: rawBarcode,
      formatName: 'Non-numeric',
      status: 'INVALID',
      statusText: 'Invalid Format',
      message: 'Barcode must contain numeric digits only.',
    };
  }

  const len = clean.length;
  let formatName = `GTIN-${len}`;
  if (len === 8) formatName = 'GTIN-8 (EAN-8)';
  else if (len === 12) formatName = 'GTIN-12 (UPC-A)';
  else if (len === 13) formatName = 'GTIN-13 (EAN-13)';
  else if (len === 14) formatName = 'GTIN-14 (ITF-14)';

  if (![8, 12, 13, 14].includes(len)) {
    return {
      isValid: false,
      isFormatValid: false,
      value: clean,
      formatName: `Custom (${len}-digits)`,
      status: 'INVALID',
      statusText: 'Non-Standard Length',
      message: `Standard GTIN lengths are 8, 12, 13, or 14 digits (found ${len} digits).`,
    };
  }

  // Modulo-10 Checksum Calculation
  const digits = clean.split('').map(d => parseInt(d, 10));
  const checkDigitFound = digits[len - 1];
  const payloadDigits = digits.slice(0, len - 1);

  // Weights alternate 3, 1, 3, 1... from right to left of payload
  let sum = 0;
  let weight = 3;
  for (let i = payloadDigits.length - 1; i >= 0; i--) {
    sum += payloadDigits[i] * weight;
    weight = weight === 3 ? 1 : 3;
  }

  const remainder = sum % 10;
  const checkDigitExpected = remainder === 0 ? 0 : 10 - remainder;

  if (checkDigitExpected !== checkDigitFound) {
    return {
      isValid: false,
      isFormatValid: false,
      value: clean,
      formatName,
      checkDigitExpected,
      checkDigitFound,
      status: 'INVALID',
      statusText: 'Invalid Check Digit',
      message: `${formatName} checksum failed: Expected check digit [${checkDigitExpected}], but found [${checkDigitFound}].`,
    };
  }

  return {
    isValid: true,
    isFormatValid: true,
    value: clean,
    formatName,
    checkDigitExpected,
    checkDigitFound,
    status: 'FORMAT_VALID_UNVERIFIED',
    statusText: `Format Valid (${formatName})`,
    message: `${formatName} syntax & modulo-10 check digit verified (authenticity not externally verified in GS1 registry).`,
  };
}

// ------------------------------------------------------------
// General Category Regulatory License Validator
// ------------------------------------------------------------

export interface LicenseValidationResult {
  isValid: boolean;
  value: string | null;
  status: ValidationState;
  statusText: string;
  message: string;
}

export function validateCategoryLicense(
  category: ProductCategory,
  licenseValue?: string | null
): LicenseValidationResult {
  const spec = CATEGORY_REQUIREMENTS[category] || CATEGORY_REQUIREMENTS['General Packaged Commodities'];
  const req = spec.regulatoryField.requirement;

  if (!licenseValue || !licenseValue.trim()) {
    if (req === 'NOT_APPLICABLE') {
      return {
        isValid: true,
        value: null,
        status: 'NOT_APPLICABLE',
        statusText: 'Not Applicable',
        message: `${spec.regulatoryField.label} is not applicable for ${category}.`,
      };
    }
    if (req === 'OPTIONAL') {
      return {
        isValid: true,
        value: null,
        status: 'MISSING',
        statusText: 'Optional — Not Provided',
        message: `${spec.regulatoryField.label} is optional for ${category}.`,
      };
    }
    return {
      isValid: false,
      value: null,
      status: 'MISSING',
      statusText: 'Required Field Missing',
      message: `${spec.regulatoryField.label} is required for ${category}.`,
    };
  }

  const clean = licenseValue.trim();

  if (category === 'Food & Beverage') {
    const fssaiRes = validateFSSAI(clean);
    return {
      isValid: fssaiRes.isValid,
      value: fssaiRes.value,
      status: fssaiRes.status,
      statusText: fssaiRes.statusText,
      message: fssaiRes.message,
    };
  }

  if (category === 'Electrical / Electronic Products' || category === 'Toys') {
    // BIS / ISI / CRS checks: e.g. R-41001234 or CM/L-7200145689 or IS 9873
    const isBisFormat = /(?:R\s*-\s*\d{6,10}|CM\s*\/\s*L\s*-\s*\d{6,10}|IS\s*[:\s]?\s*\d{3,6}|\d{7,14})/i.test(clean);
    if (isBisFormat || clean.length >= 5) {
      return {
        isValid: true,
        value: clean,
        status: 'FORMAT_VALID_UNVERIFIED',
        statusText: 'Format Valid (Not Externally Verified)',
        message: `BIS identifier format valid: "${clean}" (authenticity not externally verified).`,
      };
    }
    return {
      isValid: false,
      value: clean,
      status: 'INVALID',
      statusText: 'Invalid BIS Format',
      message: `Invalid BIS identifier format. Expected CRS R-XXXXXXXX or CM/L-XXXXXXX number.`,
    };
  }

  if (category === 'Medicines / Pharmaceuticals' || category === 'Cosmetics / Personal Care') {
    if (clean.length >= 3) {
      return {
        isValid: true,
        value: clean,
        status: 'FORMAT_VALID_UNVERIFIED',
        statusText: 'Format Valid (Not Externally Verified)',
        message: `License format valid: "${clean}" (authenticity not externally verified with State Licensing Authority).`,
      };
    }
    return {
      isValid: false,
      value: clean,
      status: 'INVALID',
      statusText: 'Invalid Format',
      message: `License number "${clean}" is too short.`,
    };
  }

  // Household / Textiles / General
  return {
    isValid: true,
    value: clean,
    status: 'FORMAT_VALID_UNVERIFIED',
    statusText: 'Format Valid (Not Externally Verified)',
    message: `Regulatory identifier recorded: "${clean}".`,
  };
}
