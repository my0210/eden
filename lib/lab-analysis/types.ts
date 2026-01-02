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

// Explanations for each marker (what it measures + why it matters)
export const MARKER_EXPLANATIONS: Record<LabMarkerKey, { measures: string; matters: string }> = {
  apob: {
    measures: 'Number of atherogenic (artery-clogging) lipoprotein particles in your blood.',
    matters: 'Best single predictor of cardiovascular risk. Lower is better for heart health.',
  },
  hba1c: {
    measures: 'Average blood sugar over the past 2-3 months.',
    matters: 'Key marker for diabetes risk and metabolic health. Reflects long-term glucose control.',
  },
  hscrp: {
    measures: 'Systemic inflammation levels in your body.',
    matters: 'High levels linked to heart disease, metabolic dysfunction, and chronic disease risk.',
  },
  ldl: {
    measures: '"Bad" cholesterol that carries fat to arteries.',
    matters: 'Elevated LDL contributes to plaque buildup. ApoB is more accurate for risk.',
  },
  hdl: {
    measures: '"Good" cholesterol that removes fat from arteries.',
    matters: 'Higher levels are protective. Exercise and healthy fats can raise HDL.',
  },
  triglycerides: {
    measures: 'Fat circulating in your bloodstream.',
    matters: 'High levels indicate metabolic issues, often from excess carbs or alcohol.',
  },
  total_cholesterol: {
    measures: 'Sum of all cholesterol types (LDL + HDL + others).',
    matters: 'Less useful alone. Ratio to HDL or ApoB is more informative.',
  },
  fasting_glucose: {
    measures: 'Blood sugar level after 8+ hours without eating.',
    matters: 'Elevated fasting glucose is an early sign of insulin resistance.',
  },
  fasting_insulin: {
    measures: 'Insulin level after 8+ hours without eating.',
    matters: 'High fasting insulin often precedes high glucose—early metabolic warning sign.',
  },
  alt: {
    measures: 'Liver enzyme released when liver cells are damaged.',
    matters: 'Elevated ALT can indicate fatty liver disease or liver stress.',
  },
  ast: {
    measures: 'Enzyme found in liver, heart, and muscles.',
    matters: 'Elevated levels may indicate liver or muscle damage. Often checked with ALT.',
  },
  ggt: {
    measures: 'Liver enzyme involved in detoxification.',
    matters: 'Elevated GGT is linked to liver disease, metabolic syndrome, and alcohol use.',
  },
  egfr: {
    measures: 'How well your kidneys filter waste from blood.',
    matters: 'Lower values indicate reduced kidney function. Important for overall health.',
  },
  creatinine: {
    measures: 'Waste product from muscle metabolism filtered by kidneys.',
    matters: 'Used to calculate eGFR. High levels may indicate kidney issues.',
  },
  vitamin_d: {
    measures: 'Hormone-like vitamin essential for bones and immune function.',
    matters: 'Deficiency is common and linked to fatigue, weak bones, and immune issues.',
  },
  vitamin_b12: {
    measures: 'Vitamin essential for nerve function and red blood cells.',
    matters: 'Deficiency causes fatigue, numbness, and cognitive issues. Common in vegans.',
  },
  tsh: {
    measures: 'Thyroid-stimulating hormone that controls metabolism.',
    matters: 'High TSH suggests underactive thyroid; low TSH suggests overactive.',
  },
}

