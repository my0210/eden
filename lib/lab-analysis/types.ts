/**
 * Lab Analysis Types
 * Types for AI-powered lab report extraction and validation
 */

// Known lab markers we extract
export type LabMarkerKey = 
  // Core metabolic markers
  | 'apob'
  | 'hba1c'
  | 'hscrp'
  // Lipid panel
  | 'ldl'
  | 'hdl'
  | 'triglycerides'
  | 'total_cholesterol'
  // Glucose/Insulin
  | 'fasting_glucose'
  | 'fasting_insulin'
  // Liver
  | 'alt'
  | 'ast'
  | 'ggt'
  // Kidney
  | 'egfr'
  | 'creatinine'
  // Vitamins
  | 'vitamin_d'
  | 'vitamin_b12'
  // Thyroid
  | 'tsh'

// A single extracted lab value
export interface ExtractedLabValue {
  marker_key: LabMarkerKey | string  // Allow unknown markers
  value: number
  unit: string
  reference_range?: string  // e.g., "<100", "70-100", "3.5-5.0"
  flag?: 'normal' | 'high' | 'low' | 'critical'  // If flagged on the report
  confidence: 'high' | 'medium' | 'low'  // AI confidence in extraction
}

// Validation result for a lab upload
export interface LabValidationResult {
  is_valid: boolean
  rejection_reason?: 
    | 'not_lab_report'
    | 'unreadable'
    | 'no_values_found'
    | 'incomplete_image'
  user_message?: string
}

// Raw AI analysis output
export interface RawLabAnalysis {
  validation: LabValidationResult
  lab_info?: {
    lab_provider?: string  // "LabCorp", "Quest", etc.
    test_date?: string     // YYYY-MM-DD or YYYY-MM
    patient_name?: string  // May be present but we don't store
    report_type?: string   // "Comprehensive Metabolic Panel", etc.
  }
  extracted_values: ExtractedLabValue[]
  analysis_notes?: string  // Any relevant notes from AI
}

// Normalized lab values for storage and scoring
export interface NormalizedLabValues {
  // Core metabolic (existing drivers)
  apob_mg_dl?: number
  hba1c_percent?: number
  hscrp_mg_l?: number
  
  // Lipid panel
  ldl_mg_dl?: number
  hdl_mg_dl?: number
  triglycerides_mg_dl?: number
  total_cholesterol_mg_dl?: number
  
  // Glucose/Insulin
  fasting_glucose_mg_dl?: number
  fasting_insulin_uiu_ml?: number
  
  // Liver
  alt_u_l?: number
  ast_u_l?: number
  ggt_u_l?: number
  
  // Kidney
  egfr?: number
  creatinine_mg_dl?: number
  
  // Vitamins
  vitamin_d_ng_ml?: number
  vitamin_b12_pg_ml?: number
  
  // Thyroid
  tsh_miu_l?: number
}

// Complete API response
export interface LabAnalysisResponse {
  success: boolean
  upload_id?: string
  validation: LabValidationResult
  lab_info?: {
    lab_provider?: string
    test_date?: string
  }
  extracted_values?: ExtractedLabValue[]
  normalized_values?: NormalizedLabValues
  markers_found: number
  error?: string
}

// Unit conversion helpers
export const STANDARD_UNITS: Record<LabMarkerKey, string> = {
  apob: 'mg/dL',
  hba1c: '%',
  hscrp: 'mg/L',
  ldl: 'mg/dL',
  hdl: 'mg/dL',
  triglycerides: 'mg/dL',
  total_cholesterol: 'mg/dL',
  fasting_glucose: 'mg/dL',
  fasting_insulin: 'μIU/mL',
  alt: 'U/L',
  ast: 'U/L',
  ggt: 'U/L',
  egfr: 'mL/min/1.73m²',
  creatinine: 'mg/dL',
  vitamin_d: 'ng/mL',
  vitamin_b12: 'pg/mL',
  tsh: 'mIU/L'
}

// Display names for UI
export const MARKER_DISPLAY_NAMES: Record<LabMarkerKey, string> = {
  apob: 'ApoB',
  hba1c: 'HbA1c',
  hscrp: 'hs-CRP',
  ldl: 'LDL Cholesterol',
  hdl: 'HDL Cholesterol',
  triglycerides: 'Triglycerides',
  total_cholesterol: 'Total Cholesterol',
  fasting_glucose: 'Fasting Glucose',
  fasting_insulin: 'Fasting Insulin',
  alt: 'ALT',
  ast: 'AST',
  ggt: 'GGT',
  egfr: 'eGFR',
  creatinine: 'Creatinine',
  vitamin_d: 'Vitamin D',
  vitamin_b12: 'Vitamin B12',
  tsh: 'TSH'
}

