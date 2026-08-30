// ============================================================
// Legal Metrology Compliance Checker — Core Types
// ============================================================

import type { ValidationState } from './services/categoryRequirements';

export type ComplianceStatus = 'Compliant' | 'Non-Compliant' | 'Partially Compliant' | 'Pending';
export type ViolationSeverity = 'critical' | 'major' | 'minor';
export type ConfidenceLevel = 'high' | 'medium' | 'low';

// Individual declaration result
export interface ComplianceDeclaration {
  present: boolean;
  value: string | null;
  confidence: ConfidenceLevel;
  status?: 'PASS' | 'FAIL' | 'NOT_APPLICABLE';
  validationStatus?: ValidationState | string;
  validationMessage?: string;
  requirement?: 'REQUIRED' | 'OPTIONAL' | 'NOT_APPLICABLE';
}

// All mandatory & category-specific declarations per Legal Metrology Rules 2011 & sectoral laws
export interface ComplianceDeclarations {
  genericName: ComplianceDeclaration;          // Common/generic product name
  manufacturer: ComplianceDeclaration;         // Name & address of mfr/packer/importer
  netQuantity: ComplianceDeclaration;          // Net weight/volume/count
  manufactureDate: ComplianceDeclaration;      // Month & year of manufacture
  mrp: ComplianceDeclaration;                  // MRP inclusive of all taxes
  consumerCare: ComplianceDeclaration;         // Consumer helpline details
  bestBefore: ComplianceDeclaration;           // Best before / use by date
  countryOfOrigin: ComplianceDeclaration;      // Country of origin (imports)
  fssaiLicense: ComplianceDeclaration;         // FSSAI 14-digit license number
  retailSalePrice: ComplianceDeclaration;      // Retail sale price per unit

  // Category-specific declarations
  cosmeticsLicense?: ComplianceDeclaration;    // Cosmetics Manufacturing / Import License
  drugLicense?: ComplianceDeclaration;         // Drug Manufacturing / Sale License
  bisRegistration?: ComplianceDeclaration;     // BIS Registration / License Number
  bisToyLicense?: ComplianceDeclaration;       // BIS Toy Safety License
  householdRegNumber?: ComplianceDeclaration;  // Household chemical reg number
  textileIdentifier?: ComplianceDeclaration;   // Textile / fiber / quality identifier
  regulatoryIdentifier?: ComplianceDeclaration;// General commodity statutory identifier
  [key: string]: ComplianceDeclaration | undefined;
}

// A single compliance violation
export interface Violation {
  field: string;
  label: string;
  message: string;
  severity: ViolationSeverity;
}

// A scanned product with its compliance report
export interface ScannedProduct {
  id: string;
  productName: string;
  barcode?: string;
  scannedAt: string;                    // ISO date string
  rawExtractedText: string;             // Full text extracted from label
  complianceScore: number;              // 0-100
  complianceStatus: ComplianceStatus;
  declarations: ComplianceDeclarations;
  violations: Violation[];
  imageData?: string;                   // base64 thumbnail (optional)
  mrp?: string | null;                  // Maximum Retail Price
  category?: string;                    // Food & Beverage / Cosmetics / Medicines / etc.
  notes?: string;                       // Inspector notes
  regulatoryLicense?: string | null;    // Stored category-specific license value
}

// Dashboard summary stats
export interface ComplianceStats {
  total: number;
  compliant: number;
  partiallyCompliant: number;
  nonCompliant: number;
  averageScore: number;
}
