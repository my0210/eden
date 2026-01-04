import { SupabaseClient } from '@supabase/supabase-js';
import { PrimeScorecard, PrimeDomain, PRIME_DOMAINS } from '@/lib/prime-scorecard/types';
import { domainDisplay } from '@/lib/prime-scorecard/metrics';
import { GoalContext, ProtocolContext, GoalConstraints } from '@/lib/coaching/types';

// ============================================================================
// Types
// ============================================================================

// Focus from onboarding goals
export type EdenFocus = {
  primary: string | null;
  secondary: string | null;
};

// Essentials from onboarding
export type EdenEssentials = {
  age: number | null;
  dob: string | null;
  sex_at_birth: string | null;
  height: number | null;
  weight: number | null;
  units: string | null;
};

// Scorecard summary for context (not the full object)
export type EdenScorecardContext = {
  prime_score: number | null;
  prime_confidence: number;
  domain_scores: Record<PrimeDomain, number | null>;
  domain_confidence: Record<PrimeDomain, number>;
  evidence_summary: {
    total_metrics: number;
    domains_with_data: number;
    freshest_timestamp: string | null;
  };
  how_calculated: Record<PrimeDomain, string[]>;
  generated_at: string;
  scoring_revision: string;
};

// Uploads summary
export type EdenUploadsContext = {
  apple_health: {
    uploaded: boolean;
    status: string | null;
    uploaded_at: string | null;
  };
  photos: {
    count: number;
  };
};

// Main context type - REFACTORED to remove legacy fields
export type EdenContext = {
  // Core data
  essentials: EdenEssentials;
  focus: EdenFocus;
  scorecard: EdenScorecardContext | null;
  uploads: EdenUploadsContext;
  
  // Coaching data (new)
  goal: GoalContext | null;
  protocol: ProtocolContext | null;
  
  // Simplified from safety_rails (only privacy_ack needed)
  privacy_ack: boolean;
  
  // Flags
  hasScorecard: boolean;
  hasActiveGoal: boolean;
  isFirstChat: boolean;
};

export type EdenContextResult = {
  edenContext: EdenContext;
  rawScorecard: PrimeScorecard | null;
};

// ============================================================================
// Main Function
// ============================================================================

/**
 * Build Eden context for the coach - READ-ONLY, no DB writes.
 * Includes Prime Scorecard + focus + active goal/protocol.
 */
export async function buildEdenContext(
  supabase: SupabaseClient,
  userId: string
): Promise<EdenContextResult> {
  // 1) Load eden_user_state
  const { data: userState, error: stateError } = await supabase
    .from('eden_user_state')
    .select('goals_json, identity_json, safety_json, latest_scorecard_id')
    .eq('user_id', userId)
    .maybeSingle();

  if (stateError) {
    console.error('buildEdenContext: stateError', stateError);
  }

  // Extract focus
  const focus: EdenFocus = {
    primary: userState?.goals_json?.focus_primary ?? null,
    secondary: userState?.goals_json?.focus_secondary ?? null,
  };

  // Extract essentials
  const identity = userState?.identity_json ?? {};
  const essentials: EdenEssentials = {
    age: identity.age ?? null,
    dob: identity.dob ?? null,
    sex_at_birth: identity.sex_at_birth ?? null,
    height: identity.height ?? null,
    weight: identity.weight ?? null,
    units: identity.units ?? null,
  };

  // Extract privacy_ack (simplified from safety_rails)
  const safety = userState?.safety_json ?? {};
  const privacy_ack = safety.privacy_ack ?? false;

  // 2) Load latest scorecard
  let rawScorecard: PrimeScorecard | null = null;
  let scorecardContext: EdenScorecardContext | null = null;

  if (userState?.latest_scorecard_id) {
    const { data: scorecardRow } = await supabase
      .from('eden_user_scorecards')
      .select('scorecard_json')
      .eq('id', userState.latest_scorecard_id)
      .maybeSingle();

    if (scorecardRow?.scorecard_json) {
      rawScorecard = scorecardRow.scorecard_json as PrimeScorecard;
    }
  }

  // Fallback to newest if no latest_scorecard_id
  if (!rawScorecard) {
    const { data: scorecardRow } = await supabase
      .from('eden_user_scorecards')
      .select('scorecard_json')
      .eq('user_id', userId)
      .order('generated_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (scorecardRow?.scorecard_json) {
      rawScorecard = scorecardRow.scorecard_json as PrimeScorecard;
    }
  }

  // Build scorecard context summary
  if (rawScorecard) {
    const metricsWithValues = rawScorecard.evidence.filter(
      e => e.value_raw !== undefined && e.subscore !== undefined
    );
    const domainsWithData = PRIME_DOMAINS.filter(
      d => rawScorecard!.domain_scores[d] !== null
    ).length;

    let freshestTimestamp: string | null = null;
    for (const e of rawScorecard.evidence) {
      if (e.measured_at && e.value_raw !== undefined) {
        if (!freshestTimestamp || e.measured_at > freshestTimestamp) {
          freshestTimestamp = e.measured_at;
        }
      }
    }

    scorecardContext = {
      prime_score: rawScorecard.prime_score,
      prime_confidence: rawScorecard.prime_confidence,
      domain_scores: rawScorecard.domain_scores,
      domain_confidence: rawScorecard.domain_confidence,
      evidence_summary: {
        total_metrics: metricsWithValues.length,
        domains_with_data: domainsWithData,
        freshest_timestamp: freshestTimestamp,
      },
      how_calculated: rawScorecard.how_calculated,
      generated_at: rawScorecard.generated_at,
      scoring_revision: rawScorecard.scoring_revision,
    };
  }

  // 3) Load uploads summary
  let uploadsContext: EdenUploadsContext = {
    apple_health: { uploaded: false, status: null, uploaded_at: null },
    photos: { count: 0 },
  };

  try {
    const { data: ahImport } = await supabase
      .from('apple_health_imports')
      .select('status, uploaded_at')
      .eq('user_id', userId)
      .order('uploaded_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (ahImport) {
      uploadsContext.apple_health = {
        uploaded: true,
        status: ahImport.status,
        uploaded_at: ahImport.uploaded_at,
      };
    }

    const { count: photoCount } = await supabase
      .from('eden_user_photos')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId);

    uploadsContext.photos.count = photoCount ?? 0;
  } catch (e) {
    console.error('buildEdenContext: uploads query failed', e);
  }

  // 4) Check if first chat
  let isFirstChat = true;
  try {
    const { data: conversation } = await supabase
      .from('eden_conversations')
      .select('id')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (conversation) {
      const { count: messageCount } = await supabase
        .from('eden_messages')
        .select('id', { count: 'exact', head: true })
        .eq('conversation_id', conversation.id);

      isFirstChat = (messageCount ?? 0) === 0;
    }
  } catch (e) {
    // Ignore - default to true
  }

  // 5) Load active goal
  let goalContext: GoalContext | null = null;
  let protocolContext: ProtocolContext | null = null;

  try {
    const { data: activeGoal } = await supabase
      .from('eden_goals')
      .select('*')
      .eq('user_id', userId)
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (activeGoal) {
      goalContext = {
        id: activeGoal.id,
        goal_type: activeGoal.goal_type,
        target_description: activeGoal.target_description,
        domain: activeGoal.domain,
        baseline_value: activeGoal.baseline_value,
        target_value: activeGoal.target_value,
        duration_weeks: activeGoal.duration_weeks,
        started_at: activeGoal.started_at,
        constraints: (activeGoal.constraints_json || {}) as GoalConstraints,
      };

      // 6) Load active protocol for this goal
      const { data: activeProtocol } = await supabase
        .from('eden_protocols')
        .select('*')
        .eq('goal_id', activeGoal.id)
        .eq('status', 'active')
        .order('version', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (activeProtocol) {
        // Get current milestone
        const { data: currentMilestone } = await supabase
          .from('eden_milestones')
          .select('title, target_date, success_criteria')
          .eq('protocol_id', activeProtocol.id)
          .eq('status', 'current')
          .limit(1)
          .maybeSingle();

        // Calculate weekly adherence
        const weekStart = getWeekStart(new Date());
        const weekEnd = getWeekEnd(new Date());

        // Count completed actions this week
        const { count: actionsCompleted } = await supabase
          .from('eden_protocol_actions')
          .select('id', { count: 'exact', head: true })
          .eq('protocol_id', activeProtocol.id)
          .not('completed_at', 'is', null)
          .gte('completed_at', weekStart.toISOString())
          .lte('completed_at', weekEnd.toISOString());

        // Count total actions for current week
        const currentWeekNumber = Math.ceil(
          (Date.now() - new Date(activeProtocol.effective_from).getTime()) / 
          (7 * 24 * 60 * 60 * 1000)
        );
        
        const { count: actionsTotal } = await supabase
          .from('eden_protocol_actions')
          .select('id', { count: 'exact', head: true })
          .eq('protocol_id', activeProtocol.id)
          .or(`week_number.is.null,week_number.eq.${currentWeekNumber}`);

        // Count habit completions this week
        const { data: habits } = await supabase
          .from('eden_habits')
          .select('id')
          .eq('protocol_id', activeProtocol.id)
          .eq('is_active', true);

        const habitIds = (habits ?? []).map(h => h.id);
        let habitDaysCompleted = 0;
        let habitDaysTarget = 0;

        if (habitIds.length > 0) {
          // Target = habits * days in week so far
          const daysSoFar = Math.min(
            7,
            Math.ceil((Date.now() - weekStart.getTime()) / (24 * 60 * 60 * 1000))
          );
          habitDaysTarget = habitIds.length * daysSoFar;

          const { count: logsCount } = await supabase
            .from('eden_habit_logs')
            .select('id', { count: 'exact', head: true })
            .in('habit_id', habitIds)
            .eq('completed', true)
            .gte('logged_date', weekStart.toISOString().slice(0, 10))
            .lte('logged_date', weekEnd.toISOString().slice(0, 10));

          habitDaysCompleted = logsCount ?? 0;
        }

        protocolContext = {
          id: activeProtocol.id,
          version: activeProtocol.version,
          focus_summary: activeProtocol.focus_summary,
          current_phase: activeProtocol.current_phase,
          total_phases: activeProtocol.total_phases,
          current_milestone: currentMilestone ? {
            title: currentMilestone.title,
            target_date: currentMilestone.target_date,
            success_criteria: currentMilestone.success_criteria,
          } : null,
          weekly_adherence: {
            actions_completed: actionsCompleted ?? 0,
            actions_total: actionsTotal ?? 0,
            habit_days_completed: habitDaysCompleted,
            habit_days_target: habitDaysTarget,
          },
        };
      }
    }
  } catch (e) {
    console.error('buildEdenContext: goal/protocol query failed', e);
  }

  const edenContext: EdenContext = {
    essentials,
    focus,
    scorecard: scorecardContext,
    uploads: uploadsContext,
    goal: goalContext,
    protocol: protocolContext,
    privacy_ack,
    hasScorecard: !!scorecardContext,
    hasActiveGoal: !!goalContext,
    isFirstChat,
  };

  return {
    edenContext,
    rawScorecard,
  };
}

// ============================================================================
// Helper Functions
// ============================================================================

function getWeekStart(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Monday
  d.setDate(diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function getWeekEnd(date: Date): Date {
  const d = getWeekStart(date);
  d.setDate(d.getDate() + 6);
  d.setHours(23, 59, 59, 999);
  return d;
}

// ============================================================================
// Context Summary for Coach
// ============================================================================

/**
 * Generate a natural language summary of the context for the coach.
 */
export function summarizeContextForCoach(ctx: EdenContext): string {
  const parts: string[] = [];

  // Essentials
  const essentialBits: string[] = [];
  if (ctx.essentials.age) essentialBits.push(`${ctx.essentials.age} years old`);
  else if (ctx.essentials.dob) essentialBits.push(`DOB: ${ctx.essentials.dob}`);
  if (ctx.essentials.sex_at_birth) essentialBits.push(ctx.essentials.sex_at_birth);
  if (ctx.essentials.height) {
    const heightStr = ctx.essentials.units === 'imperial' 
      ? `${Math.floor(ctx.essentials.height / 12)}'${ctx.essentials.height % 12}"`
      : `${ctx.essentials.height}cm`;
    essentialBits.push(heightStr);
  }
  if (ctx.essentials.weight) {
    const weightStr = ctx.essentials.units === 'imperial'
      ? `${ctx.essentials.weight}lbs`
      : `${ctx.essentials.weight}kg`;
    essentialBits.push(weightStr);
  }

  if (essentialBits.length > 0) {
    parts.push(`**Essentials**: ${essentialBits.join(', ')}`);
  } else {
    parts.push(`**Essentials**: Unknown`);
  }

  // Focus
  if (ctx.focus.primary) {
    let focusStr = `Primary: ${ctx.focus.primary}`;
    if (ctx.focus.secondary) focusStr += `, Secondary: ${ctx.focus.secondary}`;
    parts.push(`**Focus**: ${focusStr}`);
  } else {
    parts.push(`**Focus**: Not specified`);
  }

  // Prime Scorecard
  if (ctx.scorecard) {
    const sc = ctx.scorecard;
    const scoreStr = sc.prime_score !== null ? `${sc.prime_score}` : 'Not calculated';
    const confLabel = sc.prime_confidence >= 80 ? 'High' : sc.prime_confidence >= 50 ? 'Medium' : sc.prime_confidence >= 20 ? 'Low' : 'Very Low';
    
    parts.push(`**Prime Scorecard**: Score ${scoreStr}, ${confLabel} confidence (${sc.prime_confidence}%)`);
    parts.push(`  - Based on ${sc.evidence_summary.total_metrics} metrics across ${sc.evidence_summary.domains_with_data}/5 domains`);
    
    // Domain breakdown
    for (const domain of PRIME_DOMAINS) {
      const domScore = sc.domain_scores[domain];
      const domConf = sc.domain_confidence[domain];
      const howCalc = sc.how_calculated[domain];
      const domLabel = domainDisplay[domain].label;
      
      if (domScore !== null) {
        parts.push(`  - ${domLabel}: ${domScore} (${domConf}% confidence)`);
      } else {
        const missing = howCalc.find(h => h.startsWith('Missing:'));
        if (missing) {
          parts.push(`  - ${domLabel}: No data yet. ${missing}`);
        } else {
          parts.push(`  - ${domLabel}: No data yet`);
        }
      }
    }
  } else {
    parts.push(`**Prime Scorecard**: Not generated yet`);
  }

  // Uploads
  const uploadBits: string[] = [];
  if (ctx.uploads.apple_health.uploaded) {
    uploadBits.push(`Apple Health: ${ctx.uploads.apple_health.status}`);
  }
  if (ctx.uploads.photos.count > 0) {
    uploadBits.push(`${ctx.uploads.photos.count} photo(s)`);
  }
  if (uploadBits.length > 0) {
    parts.push(`**Uploads**: ${uploadBits.join(', ')}`);
  } else {
    parts.push(`**Uploads**: None yet`);
  }

  // Active Goal
  if (ctx.goal) {
    const g = ctx.goal;
    parts.push(`**Active Goal**: ${g.target_description}`);
    parts.push(`  - Type: ${g.goal_type}${g.domain ? ` (${g.domain})` : ''}`);
    parts.push(`  - Duration: ${g.duration_weeks} weeks${g.started_at ? `, started ${g.started_at.slice(0, 10)}` : ''}`);
    
    if (g.baseline_value !== null && g.target_value !== null) {
      parts.push(`  - Target: ${g.baseline_value} → ${g.target_value}`);
    }
    
    // Constraints
    const constraints = g.constraints;
    const constraintNotes: string[] = [];
    if (constraints.injuries?.length) constraintNotes.push(`Injuries: ${constraints.injuries.join(', ')}`);
    if (constraints.time_restrictions?.length) constraintNotes.push(`Time: ${constraints.time_restrictions.join(', ')}`);
    if (constraints.equipment_limitations?.length) constraintNotes.push(`Equipment: ${constraints.equipment_limitations.join(', ')}`);
    if (constraints.red_lines?.length) constraintNotes.push(`Won't do: ${constraints.red_lines.join(', ')}`);
    if (constraints.other?.length) constraintNotes.push(`Other: ${constraints.other.join(', ')}`);
    
    if (constraintNotes.length > 0) {
      parts.push(`  - Constraints: ${constraintNotes.join('; ')}`);
    }
  }

  // Protocol Status
  if (ctx.protocol) {
    const p = ctx.protocol;
    parts.push(`**Current Protocol** (v${p.version}): ${p.focus_summary || 'No summary'}`);
    parts.push(`  - Phase ${p.current_phase}/${p.total_phases}`);
    
    if (p.current_milestone) {
      parts.push(`  - Current milestone: "${p.current_milestone.title}"${p.current_milestone.target_date ? ` (target: ${p.current_milestone.target_date})` : ''}`);
    }
    
    const adh = p.weekly_adherence;
    if (adh.actions_total > 0 || adh.habit_days_target > 0) {
      parts.push(`  - This week: ${adh.actions_completed}/${adh.actions_total} actions, ${adh.habit_days_completed}/${adh.habit_days_target} habit completions`);
    }
  }

  return parts.join('\n');
}
