/**
 * Coaching System - Main exports
 */

// Types
export * from './types'

// Goal extraction
export { 
  extractGoalFromConversation, 
  detectGoalIntent,
  type GoalExtractionResult,
  type ConversationContext,
} from './extractGoalFromConversation'

// Constraint extraction
export {
  extractConstraintsFromMessage,
  mergeConstraints,
  type ConstraintExtractionResult,
} from './extractConstraintsFromChat'

// Protocol generation
export {
  generateProtocolForGoal,
  type ProtocolGenerationResult,
} from './generateProtocol'

// Protocol versioning
export {
  getVersionChain,
  createNewVersion,
  calculateChanges,
  getProtocolWithDetails,
  type VersionChainEntry,
} from './protocolVersioning'

// Decision logging
export {
  createDecision,
  getDecisionsForProtocol,
  getDecisionsForGoal,
  getPendingReevaluations,
  recordDecisionOutcome,
  formatDecisionForDisplay,
  buildWeeklyReviewContext,
  buildMilestoneReviewContext,
  type DecisionInput,
} from './decisionLogging'

// Prompts
export {
  PROTOCOL_GENERATION_PROMPT,
  PROTOCOL_ADAPTATION_PROMPT,
  CHECKIN_PROMPT,
} from './prompts'

// Check-in engine
export {
  shouldTriggerCheckIn,
  generateCheckInMessage,
  createCheckIn,
  getRecentCheckIns,
  type CheckInContext,
} from './checkInEngine'

// Protocol adaptation
export {
  adaptProtocol,
  type AdaptationContext,
  type AdaptationResult,
} from './adaptProtocol'

// Decision evaluation
export {
  evaluateDecision,
  processPendingReevaluations,
  runReevaluationJob,
  type EvaluationContext,
  type EvaluationResult,
} from './decisionEvaluator'

