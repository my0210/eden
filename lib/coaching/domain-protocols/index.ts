/**
 * Domain Protocol Templates
 * 
 * Evidence-based protocol templates for each Prime domain.
 * Templates provide structure; AI personalization fills in specifics.
 */

export * from './types'

import { DomainTemplate } from './types'
import { PrimeDomain } from '@/lib/prime-scorecard/types'

import { heartTemplate } from './heart'
import { frameTemplate } from './frame'
import { metabolismTemplate } from './metabolism'
import { recoveryTemplate } from './recovery'
import { mindTemplate } from './mind'

/**
 * All domain templates indexed by domain
 */
export const domainTemplates: Record<PrimeDomain, DomainTemplate> = {
  heart: heartTemplate,
  frame: frameTemplate,
  metabolism: metabolismTemplate,
  recovery: recoveryTemplate,
  mind: mindTemplate,
}

/**
 * Get template for a specific domain
 */
export function getTemplate(domain: PrimeDomain): DomainTemplate {
  return domainTemplates[domain]
}

/**
 * Get current template version for a domain
 */
export function getTemplateVersion(domain: PrimeDomain): number {
  return domainTemplates[domain].version
}

/**
 * Get setup questions for a domain
 */
export function getSetupQuestions(domain: PrimeDomain) {
  return domainTemplates[domain].setupQuestions
}

/**
 * Get action templates for a domain and phase
 */
export function getActionTemplatesForPhase(domain: PrimeDomain, phase: number) {
  const template = domainTemplates[domain]
  return template.actionTemplates.filter(
    a => !a.phases || a.phases.length === 0 || a.phases.includes(phase)
  )
}

// Re-export individual templates for direct import
export { heartTemplate } from './heart'
export { frameTemplate } from './frame'
export { metabolismTemplate } from './metabolism'
export { recoveryTemplate } from './recovery'
export { mindTemplate } from './mind'

