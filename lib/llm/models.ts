/**
 * Centralized LLM model configuration
 * 
 * This file defines which OpenAI models to use for different tasks.
 * Update models here for easy management across the codebase.
 */

export const LLM_MODELS = {
  // Max intelligence for complex reasoning (Chat Completions API)
  // GPT-5.2 Thinking variant - best for protocol generation, adaptation, decision evaluation
  REASONING: 'gpt-5.2',
  
  // Standard high-quality (Chat Completions API)
  // GPT-4o - excellent for most tasks, great vision support
  STANDARD: 'gpt-4o',
  
  // Fast suggestions (Chat Completions API)
  // Could upgrade to gpt-5.2-chat-latest later for faster responses
  SUGGESTIONS: 'gpt-4o',
  
  // Vision tasks (Chat Completions API)
  // GPT-4o has excellent vision capabilities
  VISION: 'gpt-4o',
  
  // File-heavy tasks (Responses API)
  // Could test gpt-5.2-pro later for better PDF analysis
  FILE_ANALYSIS: 'gpt-4o',
} as const

export const LLM_API_TYPES = {
  CHAT_COMPLETIONS: 'chat.completions.create',
  RESPONSES: 'responses.create',
} as const

