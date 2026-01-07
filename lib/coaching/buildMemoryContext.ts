/**
 * Build LLM Context from Memory
 * 
 * Generates context on-demand from structured memory.
 * Never stores narrative - always fresh from facts.
 */

import { UserMemory, ConfirmedData } from './memory'

// ============================================================================
// Main Context Builder
// ============================================================================

/**
 * Build context string for LLM from structured memory
 */
export function buildMemoryContext(memory: UserMemory): string {
  const parts: string[] = []
  const confirmed = memory.confirmed

  // Basic info
  const primeCheck = confirmed.prime_check
  if (primeCheck) {
    const infoParts: string[] = []
    if (primeCheck.name) infoParts.push(primeCheck.name)
    if (primeCheck.age) infoParts.push(`${primeCheck.age}yo`)
    if (primeCheck.sex) infoParts.push(primeCheck.sex)
    if (primeCheck.location) infoParts.push(`in ${primeCheck.location}`)
    
    if (infoParts.length > 0) {
      parts.push(`About: ${infoParts.join(', ')}`)
    }

    // Physical stats
    const statParts: string[] = []
    if (primeCheck.height) statParts.push(`${primeCheck.height}cm`)
    if (primeCheck.weight) statParts.push(`${primeCheck.weight}kg`)
    if (statParts.length > 0) {
      parts.push(`Physical: ${statParts.join(', ')}`)
    }

    // Self-ratings if available
    if (primeCheck.self_ratings && Object.keys(primeCheck.self_ratings).length > 0) {
      const ratings = Object.entries(primeCheck.self_ratings)
        .map(([domain, score]) => `${domain}: ${score}/10`)
        .join(', ')
      parts.push(`Self-rated: ${ratings}`)
    }

    // Stated goals from onboarding
    if (primeCheck.stated_goals?.length) {
      parts.push(`Wants to: ${primeCheck.stated_goals.join(', ')}`)
    }
  }

  // Apple Health data with trends
  const ah = confirmed.apple_health
  if (ah?.current) {
    const healthParts: string[] = []
    
    if (ah.current.rhr !== undefined) {
      let rhrStr = `RHR: ${ah.current.rhr}bpm`
      if (ah.baseline?.rhr && ah.baseline.rhr !== ah.current.rhr) {
        const diff = ah.current.rhr - ah.baseline.rhr
        rhrStr += ` (${diff > 0 ? '+' : ''}${diff} from baseline)`
      }
      healthParts.push(rhrStr)
    }
    
    if (ah.current.sleep_avg !== undefined) {
      let sleepStr = `Sleep: ${ah.current.sleep_avg}h avg`
      if (ah.baseline?.sleep_avg && ah.baseline.sleep_avg !== ah.current.sleep_avg) {
        const diff = (ah.current.sleep_avg - ah.baseline.sleep_avg).toFixed(1)
        sleepStr += ` (${Number(diff) > 0 ? '+' : ''}${diff}h)`
      }
      healthParts.push(sleepStr)
    }

    if (ah.current.steps_avg !== undefined) {
      healthParts.push(`Steps: ${Math.round(ah.current.steps_avg).toLocaleString()} avg`)
    }

    if (healthParts.length > 0) {
      parts.push(`Health metrics: ${healthParts.join(', ')}`)
    }
  }

  // Labs summary
  const labs = confirmed.labs
  if (labs?.current) {
    const labFlags: string[] = []
    
    if (labs.current.vitamin_d?.status === 'low') {
      labFlags.push('Vitamin D low')
    }
    if (labs.current.cholesterol?.status === 'borderline' || labs.current.cholesterol?.status === 'high') {
      labFlags.push(`Cholesterol ${labs.current.cholesterol.status}`)
    }
    
    if (labFlags.length > 0) {
      parts.push(`Labs: ${labFlags.join(', ')}`)
    }
  }

  // Body composition
  const photos = confirmed.body_photos
  if (photos?.current) {
    const photoParts: string[] = []
    if (photos.current.body_fat_estimate) {
      let bfStr = `~${photos.current.body_fat_estimate}% body fat`
      if (photos.baseline?.body_fat_estimate) {
        const diff = photos.current.body_fat_estimate - photos.baseline.body_fat_estimate
        if (diff !== 0) {
          bfStr += ` (${diff > 0 ? '+' : ''}${diff}% from baseline)`
        }
      }
      photoParts.push(bfStr)
    }
    if (photos.current.posture_notes) {
      photoParts.push(photos.current.posture_notes)
    }
    if (photoParts.length > 0) {
      parts.push(`Body: ${photoParts.join(', ')}`)
    }
  }

  // Domain selection (from onboarding Step 6)
  const domainSelection = confirmed.domain_selection
  if (domainSelection?.primary) {
    parts.push('')
    parts.push('Focus areas chosen during onboarding:')
    parts.push(`- Primary: ${domainSelection.primary.toUpperCase()}`)
    if (domainSelection.secondary) {
      parts.push(`- Secondary: ${domainSelection.secondary.toUpperCase()}`)
    }
    if (domainSelection.time_budget_hours) {
      parts.push(`- Time budget: ${domainSelection.time_budget_hours} hours/week`)
    }
    if (domainSelection.reasoning?.primary) {
      parts.push(`- Why ${domainSelection.primary}: ${domainSelection.reasoning.primary}`)
    }
  }

  // Current protocol/goal
  const protocol = confirmed.protocol
  if (protocol?.goal_title) {
    parts.push('')
    parts.push(`Current goal: ${protocol.goal_title}`)
    
    const progressParts: string[] = []
    if (protocol.current_week && protocol.duration_weeks) {
      progressParts.push(`Week ${protocol.current_week}/${protocol.duration_weeks}`)
    }
    if (protocol.current_phase && protocol.total_phases) {
      progressParts.push(`Phase ${protocol.current_phase}/${protocol.total_phases}`)
    }
    if (protocol.actions_done !== undefined && protocol.actions_total) {
      progressParts.push(`${protocol.actions_done}/${protocol.actions_total} actions this week`)
    }
    
    if (progressParts.length > 0) {
      parts.push(`Progress: ${progressParts.join(', ')}`)
    }
  }

  // Stated facts from conversations
  if (memory.stated.length > 0) {
    parts.push('')
    parts.push('From our conversations:')
    memory.stated.slice(0, 10).forEach(s => {
      parts.push(`- ${s.fact}`)
    })
  }

  // Inferred patterns (if any)
  if (memory.inferred.length > 0) {
    parts.push('')
    parts.push('Patterns I\'ve noticed:')
    memory.inferred.slice(0, 5).forEach(p => {
      parts.push(`- ${p.pattern}`)
    })
  }

  // Recent notable events
  if (memory.notable_events.length > 0) {
    parts.push('')
    parts.push('Recent:')
    memory.notable_events.slice(0, 5).forEach(e => {
      const date = new Date(e.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
      parts.push(`- ${date}: ${e.description}`)
    })
  }

  return parts.join('\n')
}

/**
 * Build a shorter context summary for suggestions or quick reference
 */
export function buildShortContext(memory: UserMemory): string {
  const parts: string[] = []
  const confirmed = memory.confirmed

  // Name and goal only
  if (confirmed.prime_check?.name) {
    parts.push(`User: ${confirmed.prime_check.name}`)
  }
  
  if (confirmed.protocol?.goal_title) {
    parts.push(`Goal: ${confirmed.protocol.goal_title}`)
    if (confirmed.protocol.current_week && confirmed.protocol.duration_weeks) {
      parts.push(`Week ${confirmed.protocol.current_week}/${confirmed.protocol.duration_weeks}`)
    }
  } else {
    parts.push('No active goal yet')
  }

  // Last few stated facts
  if (memory.stated.length > 0) {
    parts.push(`Key facts: ${memory.stated.slice(0, 3).map(s => s.fact).join('; ')}`)
  }

  return parts.join('\n')
}

/**
 * Check if user has an active goal
 */
export function hasActiveGoal(memory: UserMemory): boolean {
  return !!memory.confirmed.protocol?.goal_id
}

/**
 * Check if user has selected focus domains (from onboarding)
 */
export function hasDomainSelection(memory: UserMemory): boolean {
  return !!memory.confirmed.domain_selection?.primary
}

/**
 * Get selected domains
 */
export function getDomainSelection(memory: UserMemory): { primary: string; secondary?: string | null } | null {
  const ds = memory.confirmed.domain_selection
  if (!ds?.primary) return null
  return { primary: ds.primary, secondary: ds.secondary }
}

/**
 * Get the user's name from memory
 */
export function getUserName(memory: UserMemory): string | null {
  return memory.confirmed.prime_check?.name || null
}

/**
 * Build welcome context - more detailed for first impression
 */
export function buildWelcomeContext(memory: UserMemory): string {
  const parts: string[] = []
  const confirmed = memory.confirmed
  const primeCheck = confirmed.prime_check

  if (primeCheck) {
    // Identity
    if (primeCheck.name) parts.push(`Name: ${primeCheck.name}`)
    if (primeCheck.age) parts.push(`Age: ${primeCheck.age}`)
    if (primeCheck.sex) parts.push(`Sex: ${primeCheck.sex}`)
    if (primeCheck.location) parts.push(`Location: ${primeCheck.location}`)
    if (primeCheck.occupation) parts.push(`Work: ${primeCheck.occupation}`)
    
    // Physical
    if (primeCheck.height) parts.push(`Height: ${primeCheck.height}cm`)
    if (primeCheck.weight) parts.push(`Weight: ${primeCheck.weight}kg`)
  }

  // Health snapshot
  const ah = confirmed.apple_health?.current
  if (ah) {
    parts.push('')
    parts.push('Health data:')
    if (ah.rhr) parts.push(`- Resting heart rate: ${ah.rhr}bpm`)
    if (ah.sleep_avg) parts.push(`- Average sleep: ${ah.sleep_avg}h`)
    if (ah.steps_avg) parts.push(`- Average steps: ${Math.round(ah.steps_avg).toLocaleString()}`)
  }

  // Labs
  const labs = confirmed.labs?.current
  if (labs) {
    const labNotes: string[] = []
    if (labs.vitamin_d) labNotes.push(`Vitamin D: ${labs.vitamin_d.value} ${labs.vitamin_d.unit} (${labs.vitamin_d.status})`)
    if (labs.cholesterol) labNotes.push(`Cholesterol: ${labs.cholesterol.value} ${labs.cholesterol.unit} (${labs.cholesterol.status})`)
    if (labNotes.length > 0) {
      parts.push('')
      parts.push('Lab results:')
      labNotes.forEach(n => parts.push(`- ${n}`))
    }
  }

  // Body composition
  const photos = confirmed.body_photos?.current
  if (photos) {
    parts.push('')
    parts.push('Body assessment:')
    if (photos.body_fat_estimate) parts.push(`- Estimated body fat: ~${photos.body_fat_estimate}%`)
    if (photos.posture_notes) parts.push(`- Posture: ${photos.posture_notes}`)
    if (photos.analysis_notes) parts.push(`- Notes: ${photos.analysis_notes}`)
  }

  // Stated from onboarding
  if (primeCheck?.stated_goals?.length) {
    parts.push('')
    parts.push('Goals mentioned during onboarding:')
    primeCheck.stated_goals.forEach(g => parts.push(`- "${g}"`))
  }

  // Any constraints/facts from chat
  if (memory.stated.length > 0) {
    parts.push('')
    parts.push('Important facts shared:')
    memory.stated.forEach(s => parts.push(`- ${s.fact}`))
  }

  return parts.join('\n')
}

