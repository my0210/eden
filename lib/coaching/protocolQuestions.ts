/**
 * Protocol Questions for Coach
 * 
 * Questions the coach should ask before generating a personalized protocol.
 * These are extracted from domain templates and formatted for use in chat.
 */

import { PrimeDomain } from '@/lib/prime-scorecard/types'
import { getSetupQuestions, domainTemplates } from './domain-protocols'
import { SetupQuestion } from './domain-protocols/types'

// ============================================================================
// Types
// ============================================================================

export interface FormattedQuestion {
  id: string
  question: string
  type: SetupQuestion['type']
  options?: Array<{ value: string; label: string }>
  required: boolean
  domain: PrimeDomain
  impactsPersonalization: string
}

export interface QuestionFlow {
  domain: PrimeDomain
  questions: FormattedQuestion[]
  conversationalIntro: string
  conversationalOutro: string
}

// ============================================================================
// Get Questions for Domain
// ============================================================================

/**
 * Get all questions for a domain formatted for coach use
 */
export function getQuestionsForDomain(domain: PrimeDomain): QuestionFlow {
  const questions = getSetupQuestions(domain)
  const template = domainTemplates[domain]

  const formattedQuestions: FormattedQuestion[] = questions.map(q => ({
    id: q.id,
    question: q.question,
    type: q.type,
    options: q.options,
    required: q.required,
    domain,
    impactsPersonalization: q.impactsPersonalization,
  }))

  return {
    domain,
    questions: formattedQuestions,
    conversationalIntro: getConversationalIntro(domain, template.name),
    conversationalOutro: getConversationalOutro(domain),
  }
}

/**
 * Get conversational intro for asking questions
 */
function getConversationalIntro(domain: PrimeDomain, domainName: string): string {
  const intros: Record<PrimeDomain, string> = {
    heart: `Great! Let's set up your ${domainName} protocol. I have a few questions to personalize your cardio plan.`,
    frame: `Let's build your ${domainName} protocol. First, I need to understand your current setup and experience.`,
    metabolism: `Time to create your ${domainName} protocol. A few questions about your eating habits will help me personalize this.`,
    recovery: `Let's optimize your ${domainName}. I'll ask about your sleep patterns to create the right plan for you.`,
    mind: `Let's work on your ${domainName} protocol. Understanding your focus challenges will help me tailor this.`,
  }
  return intros[domain]
}

/**
 * Get conversational outro after questions
 */
function getConversationalOutro(domain: PrimeDomain): string {
  const outros: Record<PrimeDomain, string> = {
    heart: `Perfect! I have everything I need to create your personalized cardio protocol. Let me generate your first week's plan.`,
    frame: `Got it! I'll create a strength program tailored to your situation. Let me put together your first week.`,
    metabolism: `Thanks! I'll design a nutrition-focused protocol that fits your lifestyle. Here's your first week.`,
    recovery: `Excellent! I'll create a sleep optimization plan based on your patterns. Let me set up your first week.`,
    mind: `Great! I'll build a focus protocol addressing your specific challenges. Here's what your first week looks like.`,
  }
  return outros[domain]
}

// ============================================================================
// Question Formatting for Chat
// ============================================================================

/**
 * Format a question for chat display
 */
export function formatQuestionForChat(question: FormattedQuestion): string {
  let formatted = question.question

  if (question.type === 'single_choice' || question.type === 'multi_choice') {
    const options = question.options || []
    if (options.length > 0) {
      formatted += '\n\n'
      formatted += options.map((opt, i) => `${i + 1}. ${opt.label}`).join('\n')
    }
  }

  if (question.type === 'boolean') {
    formatted += '\n\n(yes/no)'
  }

  return formatted
}

/**
 * Parse user response to a question
 */
export function parseQuestionResponse(
  question: FormattedQuestion,
  response: string
): unknown {
  const normalized = response.toLowerCase().trim()

  if (question.type === 'boolean') {
    const yesWords = ['yes', 'yeah', 'yep', 'y', 'true', 'sure', 'absolutely', 'definitely']
    const noWords = ['no', 'nope', 'n', 'false', 'not', 'nah']
    
    if (yesWords.some(w => normalized.includes(w))) return true
    if (noWords.some(w => normalized.includes(w))) return false
    return null
  }

  if (question.type === 'single_choice') {
    const options = question.options || []
    
    // Try to match by number
    const numMatch = normalized.match(/^(\d+)/)
    if (numMatch) {
      const idx = parseInt(numMatch[1], 10) - 1
      if (idx >= 0 && idx < options.length) {
        return options[idx].value
      }
    }

    // Try to match by value or label
    for (const opt of options) {
      if (normalized.includes(opt.value.toLowerCase()) ||
          normalized.includes(opt.label.toLowerCase())) {
        return opt.value
      }
    }

    return null
  }

  if (question.type === 'multi_choice') {
    const options = question.options || []
    const selected: string[] = []

    // Try to match multiple numbers
    const numMatches = normalized.match(/\d+/g) || []
    for (const num of numMatches) {
      const idx = parseInt(num, 10) - 1
      if (idx >= 0 && idx < options.length) {
        selected.push(options[idx].value)
      }
    }

    if (selected.length > 0) return selected

    // Try to match by value or label
    for (const opt of options) {
      if (normalized.includes(opt.value.toLowerCase()) ||
          normalized.includes(opt.label.toLowerCase())) {
        selected.push(opt.value)
      }
    }

    return selected.length > 0 ? selected : null
  }

  if (question.type === 'number') {
    const numMatch = normalized.match(/(\d+(?:\.\d+)?)/)
    return numMatch ? parseFloat(numMatch[1]) : null
  }

  // Text type - return as is
  return response.trim() || null
}

// ============================================================================
// Question Flow State
// ============================================================================

export interface QuestionFlowState {
  domain: PrimeDomain
  currentQuestionIndex: number
  answers: Record<string, unknown>
  isComplete: boolean
}

/**
 * Create initial question flow state
 */
export function createQuestionFlowState(domain: PrimeDomain): QuestionFlowState {
  return {
    domain,
    currentQuestionIndex: 0,
    answers: {},
    isComplete: false,
  }
}

/**
 * Get current question in flow
 */
export function getCurrentQuestion(state: QuestionFlowState): FormattedQuestion | null {
  const flow = getQuestionsForDomain(state.domain)
  if (state.currentQuestionIndex >= flow.questions.length) {
    return null
  }
  return flow.questions[state.currentQuestionIndex]
}

/**
 * Record answer and advance to next question
 */
export function recordAnswer(
  state: QuestionFlowState,
  questionId: string,
  answer: unknown
): QuestionFlowState {
  const flow = getQuestionsForDomain(state.domain)
  const newAnswers = { ...state.answers, [questionId]: answer }
  const nextIndex = state.currentQuestionIndex + 1
  const isComplete = nextIndex >= flow.questions.length

  return {
    ...state,
    answers: newAnswers,
    currentQuestionIndex: nextIndex,
    isComplete,
  }
}

/**
 * Check if all required questions are answered
 */
export function areRequiredQuestionsAnswered(state: QuestionFlowState): boolean {
  const flow = getQuestionsForDomain(state.domain)
  const requiredQuestions = flow.questions.filter(q => q.required)
  
  return requiredQuestions.every(q => {
    const answer = state.answers[q.id]
    return answer !== null && answer !== undefined && answer !== ''
  })
}

// ============================================================================
// System Prompt Addition
// ============================================================================

/**
 * Get system prompt addition for protocol question gathering
 */
export function getProtocolQuestionPrompt(domain: PrimeDomain): string {
  const flow = getQuestionsForDomain(domain)
  const questions = flow.questions

  return `You are gathering information to create a personalized ${domain} protocol.

QUESTIONS TO ASK (in order):
${questions.map((q, i) => `${i + 1}. ${q.question} (${q.type}${q.required ? ', required' : ''})`).join('\n')}

RULES:
- Ask ONE question at a time
- Wait for the user's response before moving to the next
- Be conversational, not robotic
- If the user's answer is unclear, gently clarify
- Once all required questions are answered, you can generate the protocol
- Store answers exactly as provided for protocol generation

INTRO: ${flow.conversationalIntro}
OUTRO: ${flow.conversationalOutro}`
}

// ============================================================================
// Export all questions summary
// ============================================================================

/**
 * Get a summary of all domain questions (for reference)
 */
export function getAllDomainQuestionsSummary(): Record<PrimeDomain, string[]> {
  const summary: Record<PrimeDomain, string[]> = {
    heart: [],
    frame: [],
    metabolism: [],
    recovery: [],
    mind: [],
  }

  for (const domain of Object.keys(summary) as PrimeDomain[]) {
    const flow = getQuestionsForDomain(domain)
    summary[domain] = flow.questions.map(q => q.question)
  }

  return summary
}

