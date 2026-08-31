// ============================================================
// Legal Metrology Compliance Checker — Core Types
// ============================================================

import type { ValidationState } from './services/categoryRequirements';

export type ComplianceStatus = 'Compliant' | 'Non-Compliant' | 'Partially Compliant' | 'Pending';
export type ViolationSeverity = 'critical' | 'major' | 'minor';
export type ConfidenceLevel = 'high' | 'medium' | 'low';

// Placement / PDP Compliance States
export type PlacementStatus = 
  | 'PLACEMENT_VALID'
  | 'PLACEMENT_INVALID'
  | 'PLACEMENT_UNVERIFIED'
  | 'NOT_APPLICABLE';

// Physical Font Size Compliance States
export type FontSizeStatus =
  | 'FONT_SIZE_PASS'
  | 'FONT_SIZE_FAIL'
  | 'FONT_SIZE_UNVERIFIED'
  | 'NOT_APPLICABLE';

// Visual Contrast & Readability States
export type ReadabilityStatus =
  | 'READABILITY_PASS'
  | 'READABILITY_FAIL'
  | 'READABILITY_UNVERIFIED';

// Role-Based Access Control
export type UserRole = 'ADMIN' | 'ENFORCEMENT_OFFICER' | 'INSPECTOR' | 'MERCHANT';

// Enforcement Lifecycle Statuses
export type EnforcementStatus = 
  | 'AUDITED'
  | 'NOTICE_ISSUED'
  | 'COMPOUNDED'
  | 'PROSECUTION_FILED'
  | 'COMPLIANT_CLOSED';

// Normalized 0..1000 bounding box coordinates
export interface BoundingBox {
  ymin: number;
  xmin: number;
  ymax: number;
  xmax: number;
}

// Timestamped Enforcement Action Record
export interface EnforcementAction {
  id: string;
  action: EnforcementStatus;
  timestamp: string;          // ISO Date
  officerId?: string;
  officerName?: string;
  noticeNumber?: string;
  courtCaseNumber?: string;
  penaltyAmount?: number;
  notes?: string;
}

// Spatial & Visual Evidence for a declaration
export interface DeclarationSpatialEvidence {
  boundingBox?: BoundingBox | null;
  onPackage?: boolean;
  onPDP?: boolean;
  placementStatus?: PlacementStatus;
  placementReason?: string;
  fontSizeStatus?: FontSizeStatus;
  estimatedHeightPx?: number;
  measuredHeightMm?: number | null;
  minimumRequiredMm?: number;
  fontScaleMethod?: string;
  readabilityStatus?: ReadabilityStatus;
  readabilityNotes?: string;
}

// Individual declaration result
export interface ComplianceDeclaration {
  present: boolean;
  value: string | null;
  confidence: ConfidenceLevel;
  status?: 'PASS' | 'FAIL' | 'NOT_APPLICABLE';
  validationStatus?: ValidationState | string;
  validationMessage?: string;
  requirement?: 'REQUIRED' | 'OPTIONAL' | 'NOT_APPLICABLE';
  
  // Spatial, Font Size & Readability Extensions
  placement?: PlacementStatus;
  placementReason?: string;
  fontSizeStatus?: FontSizeStatus;
  fontSizeMm?: number | null;
  minimumRequiredMm?: number;
  fontScaleMethod?: string;
  readabilityStatus?: ReadabilityStatus;
  readabilityNotes?: string;
  boundingBox?: BoundingBox | null;
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
  evidence?: string;
  recommendedAction?: string;
}

// Visual Quality Extraction from AI
export interface VisualQualitySummary {
  contrastRatio?: 'high' | 'medium' | 'low';
  clarity?: 'clear' | 'blurry' | 'partially_occluded';
  lighting?: 'adequate' | 'glare' | 'dark';
  overallReadability?: ReadabilityStatus;
  readabilityNotes?: string;
}

// Spatial Packaging Analysis
export interface SpatialAnalysisSummary {
  packagingBox?: BoundingBox | null;
  pdpBox?: BoundingBox | null;
  overallPlacement?: PlacementStatus;
  overallPlacementNotes?: string;
  scaleCalibrationMethod?: string;
  pixelsPerMm?: number | null;
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
  
  // Spatial & Readability Evidence
  spatialAnalysis?: SpatialAnalysisSummary;
  visualQuality?: VisualQualitySummary;
  photoEvidenceNotes?: string;

  // Enforcement Workflow Lifecycle
  enforcementStatus?: EnforcementStatus;
  enforcementHistory?: EnforcementAction[];
  assignedOfficer?: string;
  noticeReferenceNumber?: string;
  penaltyAmount?: number;
}

// User Profile with RBAC
export interface UserProfile {
  id: string;
  username: string;
  email?: string;
  picture?: string;
  role: UserRole;
  department?: string;
}

// Dashboard summary stats
export interface ComplianceStats {
  total: number;
  compliant: number;
  partiallyCompliant: number;
  nonCompliant: number;
  averageScore: number;
  
  // Enforcement metrics
  totalAudited?: number;
  noticesIssued?: number;
  compoundedCases?: number;
  prosecutionCases?: number;
  pendingEnforcement?: number;
}

