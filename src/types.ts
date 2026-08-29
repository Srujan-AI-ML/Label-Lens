// ============================================================
// Legal Metrology Compliance Checker — Core Types
// ============================================================

export type ComplianceStatus = 'Compliant' | 'Non-Compliant' | 'Partially Compliant' | 'Pending';
export type ViolationSeverity = 'critical' | 'major' | 'minor';
export type ConfidenceLevel = 'high' | 'medium' | 'low';

// Individual declaration result
export interface ComplianceDeclaration {
  present: boolean;
  value: string | null;
  confidence: ConfidenceLevel;
}

// All 10 mandatory declarations per Legal Metrology Rules 2011
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
}

// A single compliance violation
export interface Violation {
  field: keyof ComplianceDeclarations;
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
  category?: string;                    // Food / Cosmetic / Drug / Other
  notes?: string;                       // Inspector notes
}

// Dashboard summary stats
export interface ComplianceStats {
  total: number;
  compliant: number;
  partiallyCompliant: number;
  nonCompliant: number;
  averageScore: number;
}
