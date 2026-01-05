/**
 * Coaching System - Main exports
 */

// Types
export * from './types'

// Memory system
export {
  getMemory,
  getOrCreateMemory,
  applyMemoryPatches,
  updateConfirmed,
  addNotableEvent,
  addStatedFact,
  setBaselineSnapshot,
  clearMemory,
  removeStatedFact,
  removeInferredPattern,
  type UserMemory,
  type MemoryPatches,
  type ConfirmedData,
  type StatedFact,
  type InferredPattern,
  type NotableEvent,
} from './memory'

// Memory context building
export {
  buildMemoryContext,
  buildShortContext,
  buildWelcomeContext,
  hasActiveGoal,
  getUserName,
} from './buildMemoryContext'

// Extraction from chat
export {
  extractFromChat,
  detectGoalIntent,
  detectProgressMention,
  type ExtractionResult,
  type GoalData,
} from './extractFromChat'

// Memory initialization
export { initializeMemory } from './initializeMemory'

// Protocol generation
export {
  generateProtocolForGoal,
  type ProtocolGenerationResult,
} from './generateProtocol'

// Protocol versioning (kept for trust/accountability)
export {
  getVersionChain,
  createNewVersion,
  calculateChanges,
  getProtocolWithDetails,
  type VersionChainEntry,
} from './protocolVersioning'

// Decision logging (kept for trust/accountability)
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

// Protocol adaptation
export {
  adaptProtocol,
  type AdaptationContext,
  type AdaptationResult,
} from './adaptProtocol'
