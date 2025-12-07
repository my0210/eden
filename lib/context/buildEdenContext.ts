import { SupabaseClient } from '@supabase/supabase-js';
import { getUserSnapshot, UserSnapshot } from './getUserSnapshot';

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

export type EdenContext = {
  profile: Record<string, unknown> | null;
  persona: Record<string, unknown> | null;
  snapshot: UserSnapshot | null;
  plan: EdenPlanContext;
  profileComplete: boolean;
  hasPlan: boolean;
};

export type EdenContextResult = {
  edenContext: EdenContext;
  profile: Record<string, unknown> | null;
  snapshot: UserSnapshot | null;
  activePlan: Record<string, unknown> | null;
};

export async function buildEdenContext(
  supabase: SupabaseClient,
  userId: string
): Promise<EdenContextResult> {
  // 1) profile
  const { data: profile, error: profileError } = await supabase
    .from('eden_user_profile')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();

  if (profileError) {
    console.error('buildEdenContext: profileError', profileError);
  }

  // 2) snapshot
  let snapshot: UserSnapshot | null = null;
  try {
    snapshot = await getUserSnapshot(supabase, userId);
  } catch (e) {
    console.error('buildEdenContext: getUserSnapshot failed', e);
  }

  // 3) persona (optional, may not exist yet)
  let persona: Record<string, unknown> | null = null;
  try {
    const { data: personaRow } = await supabase
      .from('eden_user_personas')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();

    persona = personaRow ?? null;
  } catch (e) {
    // Table may not exist yet, treat as null.
    console.warn('buildEdenContext: persona table missing or query failed', e);
  }

  // 4) active plan + actions
  const today = new Date().toISOString().slice(0, 10); // yyyy-mm-dd

  let activePlan: Record<string, unknown> | null = null;
  let actions: EdenPlanContextAction[] = [];

  try {
    const { data: plans, error: planError } = await supabase
      .from('eden_plans')
      .select('id, user_id, start_date, end_date, status, focus_summary')
      .eq('user_id', userId)
      .eq('status', 'active')
      .lte('start_date', today)
      .gte('end_date', today)
      .order('start_date', { ascending: false })
      .limit(1);

    if (planError) {
      console.error('buildEdenContext: planError', planError);
    }

    activePlan = plans?.[0] ?? null;

    if (activePlan) {
      const { data: actionsData, error: actionsError } = await supabase
        .from('eden_plan_actions')
        .select('title, description, metric_code, target_value, cadence')
        .eq('plan_id', activePlan.id as string)
        .order('priority', { ascending: true });

      if (actionsError) {
        console.error('buildEdenContext: actionsError', actionsError);
      }

      actions = (actionsData ?? []) as EdenPlanContextAction[];
    }
  } catch (e) {
    console.error('buildEdenContext: plan query failed', e);
  }

  // Check if profile is complete enough for coaching
  const profileComplete = !!(
    profile &&
    (profile.age || profile.age === 0) &&
    profile.sex_at_birth &&
    profile.primary_goal
  );

  const hasPlan = !!activePlan;

  const edenContext: EdenContext = {
    profile: profile ?? null,
    persona,
    snapshot: snapshot ?? null,
    plan: activePlan
      ? {
          id: activePlan.id as string,
          focusSummary: (activePlan.focus_summary as string) ?? null,
          startDate: (activePlan.start_date as string) ?? null,
          endDate: (activePlan.end_date as string) ?? null,
          actions,
        }
      : null,
    profileComplete,
    hasPlan,
  };

  return {
    edenContext,
    profile: profile ?? null,
    snapshot: snapshot ?? null,
    activePlan,
  };
}

