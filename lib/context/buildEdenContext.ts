import { SupabaseClient } from '@supabase/supabase-js';
import { PrimeScorecard, PrimeDomain, PRIME_DOMAINS } from '@/lib/prime-scorecard/types';
import { domainDisplay, expectedMetricsByDomain } from '@/lib/prime-scorecard/metrics';

export type EdenPlanContextAction = {
  title: string;
  description: string | null;
  metric_code: string | null;
  target_value: string | null;
  cadence: string | null;
};

export type EdenPlanContext = {
  id: string;
  focusSummary: string | null;
  startDate: string | null;
  endDate: string | null;
  actions: EdenPlanContextAction[];
} | null;

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

// Safety rails from onboarding
export type EdenSafetyRails = {
  diagnoses: string | null;
  meds: string | null;
  injuries_limitations: string | null;
  red_lines: string | null;
  doctor_restrictions: string | null;
  privacy_ack: boolean;
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

export type EdenContext = {
  // v2: Onboarding-derived data (single source of truth)
  focus: EdenFocus;
  essentials: EdenEssentials;
  safety_rails: EdenSafetyRails;
  scorecard: EdenScorecardContext | null;
  uploads: EdenUploadsContext;
  
  // Legacy (kept for compatibility)
  profile: Record<string, unknown> | null;
  persona: Record<string, unknown> | null;
  plan: EdenPlanContext;
  hasPlan: boolean;
  
  // Computed flags
  hasScorecard: boolean;
  isFirstChat: boolean;
};

export type EdenContextResult = {
  edenContext: EdenContext;
  profile: Record<string, unknown> | null;
  activePlan: Record<string, unknown> | null;
  rawScorecard: PrimeScorecard | null;
};

/**
 * Build Eden context for the coach - READ-ONLY, no DB writes.
 * Now includes Prime Scorecard + focus as the single source of truth.
 */
export async function buildEdenContext(
  supabase: SupabaseClient,
  userId: string
): Promise<EdenContextResult> {
  // 1) Load eden_user_state (goals_json, identity_json, safety_json)
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

  // Extract safety rails
  const safety = userState?.safety_json ?? {};
  const safety_rails: EdenSafetyRails = {
    diagnoses: safety.diagnoses ?? null,
    meds: safety.meds ?? null,
    injuries_limitations: safety.injuries_limitations ?? null,
    red_lines: safety.red_lines ?? null,
    doctor_restrictions: safety.doctor_restrictions ?? null,
    privacy_ack: safety.privacy_ack ?? false,
  };

  // 2) Load latest scorecard (prefer latest_scorecard_id, fallback to newest)
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
    // Count metrics with values
    const metricsWithValues = rawScorecard.evidence.filter(
      e => e.value_raw !== undefined && e.subscore !== undefined
    );
    const domainsWithData = PRIME_DOMAINS.filter(
      d => rawScorecard!.domain_scores[d] !== null
    ).length;

    // Find freshest timestamp
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
    // Apple Health import status
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

    // Photo count
    const { count: photoCount } = await supabase
      .from('eden_user_photos')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId);

    uploadsContext.photos.count = photoCount ?? 0;
  } catch (e) {
    console.error('buildEdenContext: uploads query failed', e);
  }

  // 4) Check if this is first chat (no messages yet)
  let isFirstChat = true;
  try {
    const { count: messageCount } = await supabase
      .from('eden_messages')
      .select('id', { count: 'exact', head: true })
      .eq('conversation_id', (await supabase
        .from('eden_conversations')
        .select('id')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      ).data?.id ?? '00000000-0000-0000-0000-000000000000');

    isFirstChat = (messageCount ?? 0) === 0;
  } catch (e) {
    // Ignore - default to true
  }

  // 5) Legacy profile (for compatibility)
  const { data: profile, error: profileError } = await supabase
    .from('eden_user_profile')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();

  if (profileError) {
    console.error('buildEdenContext: profileError', profileError);
  }

  // 6) Persona (optional)
  let persona: Record<string, unknown> | null = null;
  try {
    const { data: personaRow } = await supabase
      .from('eden_user_personas')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();

    persona = personaRow ?? null;
  } catch (e) {
    // Table may not exist yet
  }

  // 7) Active plan
  const today = new Date().toISOString().slice(0, 10);
  let activePlan: Record<string, unknown> | null = null;
  let actions: EdenPlanContextAction[] = [];

  try {
    const { data: plans } = await supabase
      .from('eden_plans')
      .select('id, user_id, start_date, end_date, status, focus_summary')
      .eq('user_id', userId)
      .eq('status', 'active')
      .lte('start_date', today)
      .gte('end_date', today)
      .order('start_date', { ascending: false })
      .limit(1);

    activePlan = plans?.[0] ?? null;

    if (activePlan) {
      const { data: actionsData } = await supabase
        .from('eden_plan_actions')
        .select('title, description, metric_code, target_value, cadence')
        .eq('plan_id', activePlan.id as string)
        .order('priority', { ascending: true });

      actions = (actionsData ?? []) as EdenPlanContextAction[];
    }
  } catch (e) {
    console.error('buildEdenContext: plan query failed', e);
  }

  const hasPlan = !!activePlan;

  const edenContext: EdenContext = {
    // v2 data
    focus,
    essentials,
    safety_rails,
    scorecard: scorecardContext,
    uploads: uploadsContext,
    
    // Legacy
    profile: profile ?? null,
    persona,
    plan: activePlan
      ? {
          id: activePlan.id as string,
          focusSummary: (activePlan.focus_summary as string) ?? null,
          startDate: (activePlan.start_date as string) ?? null,
          endDate: (activePlan.end_date as string) ?? null,
          actions,
        }
      : null,
    hasPlan,
    
    // Flags
    hasScorecard: !!scorecardContext,
    isFirstChat,
  };

  return {
    edenContext,
    profile: profile ?? null,
    activePlan,
    rawScorecard,
  };
}

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

  // Safety Rails (only mention if significant)
  const safetyNotes: string[] = [];
  if (ctx.safety_rails.diagnoses && ctx.safety_rails.diagnoses !== 'none') {
    safetyNotes.push(`Diagnoses: ${ctx.safety_rails.diagnoses}`);
  }
  if (ctx.safety_rails.meds && ctx.safety_rails.meds !== 'none') {
    safetyNotes.push(`Medications: ${ctx.safety_rails.meds}`);
  }
  if (ctx.safety_rails.injuries_limitations && ctx.safety_rails.injuries_limitations !== 'none') {
    safetyNotes.push(`Injuries/Limitations: ${ctx.safety_rails.injuries_limitations}`);
  }
  if (ctx.safety_rails.red_lines && ctx.safety_rails.red_lines !== 'none') {
    safetyNotes.push(`Red lines: ${ctx.safety_rails.red_lines}`);
  }
  if (ctx.safety_rails.doctor_restrictions && ctx.safety_rails.doctor_restrictions !== 'none') {
    safetyNotes.push(`Doctor restrictions: ${ctx.safety_rails.doctor_restrictions}`);
  }

  if (safetyNotes.length > 0) {
    parts.push(`**Safety Rails**: ${safetyNotes.join('; ')}`);
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
        // Show what's missing
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

  // Weekly plan
  if (ctx.plan && ctx.hasPlan) {
    const actionTitles = ctx.plan.actions.map(a => a.title).join('; ');
    parts.push(`**This week's focus**: ${ctx.plan.focusSummary || 'No summary'}. Actions: ${actionTitles || 'none'}`);
  }

  return parts.join('\n');
}
