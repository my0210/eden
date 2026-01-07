/**
 * Domain Protocol Template Types
 * 
 * Defines the structure for evidence-based protocol templates.
 * Templates provide structure; AI personalization fills in the specifics.
 */

import { PrimeDomain } from '@/lib/prime-scorecard/types'

// ============================================================================
// Template Structure
// ============================================================================

export interface DomainTemplate {
  /** Template identifier (e.g., 'heart', 'frame') */
  id: PrimeDomain
  
  /** Current template version */
  version: number
  
  /** Human-readable name */
  name: string
  
  /** 1-line description for UI preview */
  preview: string
  
  /** Core focus areas for this domain */
  focusAreas: string[]
  
  /** Default phases/milestones structure */
  phases: TemplatePhase[]
  
  /** Action templates that get personalized */
  actionTemplates: ActionTemplate[]
  
  /** Questions to ask before generating personalized protocol */
  setupQuestions: SetupQuestion[]
  
  /** Optional modules that can be unlocked */
  optionalModules?: OptionalModule[]
  
  /** Constraints and safety considerations */
  safety: SafetyConfig
}

// ============================================================================
// Phase/Milestone Structure
// ============================================================================

export interface TemplatePhase {
  /** Phase number (1, 2, 3...) */
  number: number
  
  /** Phase name (e.g., "Foundation", "Build", "Consolidate") */
  name: string
  
  /** Duration in weeks */
  durationWeeks: number
  
  /** What this phase focuses on */
  focus: string
  
  /** How to know when phase is complete */
  successCriteria: string
}

// ============================================================================
// Action Templates
// ============================================================================

export interface ActionTemplate {
  /** Unique identifier within template */
  id: string
  
  /** Action title (may include {placeholders} for personalization) */
  title: string
  
  /** Description template */
  description: string
  
  /** Type of action */
  type: 'action' | 'habit'
  
  /** Default schedule */
  defaultSchedule: ActionSchedule
  
  /** What metric this impacts */
  targetMetric?: string
  
  /** Success criteria template */
  successCriteria?: string
  
  /** Fallback if user can't complete */
  fallback?: string
  
  /** Which phases this action applies to (empty = all) */
  phases?: number[]
  
  /** Personalization hints for AI */
  personalizationHints?: string[]
  
  /** Prerequisites (e.g., equipment needed) */
  prerequisites?: string[]
}

export interface ActionSchedule {
  /** How often per week */
  frequency: 'daily' | '6x' | '5x' | '4x' | '3x' | '2x' | 'weekly' | 'once'
  
  /** Numeric count for target_count field */
  targetCount: number
  
  /** Suggested days (for non-daily) */
  suggestedDays?: string[]
  
  /** Best time of day */
  preferredTime?: 'morning' | 'afternoon' | 'evening' | 'flexible'
}

// ============================================================================
// Setup Questions
// ============================================================================

export interface SetupQuestion {
  /** Unique identifier */
  id: string
  
  /** Question text */
  question: string
  
  /** Question type */
  type: 'single_choice' | 'multi_choice' | 'text' | 'number' | 'boolean'
  
  /** Options for choice questions */
  options?: { value: string; label: string }[]
  
  /** How this affects protocol generation */
  impactsPersonalization: string
  
  /** Is this question required? */
  required: boolean
}

// ============================================================================
// Optional Modules
// ============================================================================

export interface OptionalModule {
  /** Module identifier */
  id: string
  
  /** Module name */
  name: string
  
  /** Description */
  description: string
  
  /** Screening requirements before enabling */
  screening: ScreeningRequirement[]
  
  /** Additional actions if module is enabled */
  actions: ActionTemplate[]
}

export interface ScreeningRequirement {
  /** Requirement type */
  type: 'no_condition' | 'min_score' | 'has_data' | 'user_confirms'
  
  /** For 'no_condition': condition to NOT have */
  condition?: string
  
  /** For 'min_score': domain and minimum score */
  domain?: PrimeDomain
  minScore?: number
  
  /** For 'has_data': what data is needed */
  dataType?: string
  
  /** Human-readable requirement */
  description: string
}

// ============================================================================
// Safety Configuration
// ============================================================================

export interface SafetyConfig {
  /** Conditions where this domain protocol should be modified or avoided */
  contraindications: string[]
  
  /** Maximum recommended intensity for beginners */
  beginnerIntensityCap?: string
  
  /** Warning signs to watch for */
  warningSignals: string[]
  
  /** When to recommend consulting a professional */
  seekProfessionalIf: string[]
}

// ============================================================================
// Personalization Context
// ============================================================================

export interface PersonalizationContext {
  /** User's answers to setup questions */
  setupAnswers: Record<string, unknown>
  
  /** User's current domain score */
  currentScore: number | null
  
  /** User's available time per week (hours) */
  timeBudgetHours: number
  
  /** User's experience level */
  experienceLevel: 'beginner' | 'intermediate' | 'advanced'
  
  /** Equipment available */
  equipment: string[]
  
  /** Constraints (injuries, limitations) */
  constraints: string[]
  
  /** User's stated preferences */
  preferences: string[]
}

// ============================================================================
// Generated Protocol Structure
// ============================================================================

export interface PersonalizedProtocol {
  /** Template used */
  templateId: PrimeDomain
  templateVersion: number
  
  /** Personalization applied */
  personalization: PersonalizationContext
  
  /** Generated focus summary */
  focusSummary: string
  
  /** Personalized phases */
  phases: PersonalizedPhase[]
  
  /** Personalized actions for first phase */
  actions: PersonalizedAction[]
  
  /** Optional modules enabled */
  enabledModules: string[]
}

export interface PersonalizedPhase {
  number: number
  name: string
  durationWeeks: number
  focus: string
  successCriteria: string
  targetDate?: string
}

export interface PersonalizedAction {
  templateId: string
  title: string
  description: string
  type: 'action' | 'habit'
  targetCount: number
  targetValue?: string
  successCriteria?: string
  fallback?: string
  phase: number
}

