import { requireAuth } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import type { 
  EdenMetricCategory, 
  EdenMetricDefinition, 
  CategoryWithMetrics,
  MetricWithValue 
} from '@/lib/types/eden'
import AppleHealthUpload from './AppleHealthUpload'
import EdenCoachChat from './EdenCoachChat'

// Category icons and colors
const categoryConfig: Record<string, { icon: string; color: string; bgColor: string }> = {
  heart: { 
    icon: '❤️', 
    color: 'text-red-600', 
    bgColor: 'bg-red-50 border-red-200' 
  },
  frame: { 
    icon: '🦴', 
    color: 'text-amber-600', 
    bgColor: 'bg-amber-50 border-amber-200' 
  },
  metabolism: { 
    icon: '🔥', 
    color: 'text-orange-600', 
    bgColor: 'bg-orange-50 border-orange-200' 
  },
  recovery: { 
    icon: '😴', 
    color: 'text-blue-600', 
    bgColor: 'bg-blue-50 border-blue-200' 
  },
  mind: { 
    icon: '🧠', 
    color: 'text-purple-600', 
    bgColor: 'bg-purple-50 border-purple-200' 
  },
}

async function getEdenMetrics(userId: string): Promise<{ categories: CategoryWithMetrics[], error: string | null }> {
  const supabase = await createClient()
  
  // Fetch all categories ordered by sort_order
  const { data: categories, error: categoriesError } = await supabase
    .from('eden_metric_categories')
    .select('*')
    .order('sort_order', { ascending: true })
  
  if (categoriesError) {
    console.error('Error fetching categories:', categoriesError)
    return { 
      categories: [], 
      error: `Categories error: ${categoriesError.message}. This might be an RLS policy issue.` 
    }
  }
  
  if (!categories || categories.length === 0) {
    return { 
      categories: [], 
      error: 'No categories found. Check if eden_metric_categories table has data and RLS policies allow reading.' 
    }
  }
  
  // Fetch all metric definitions
  const { data: definitions, error: definitionsError } = await supabase
    .from('eden_metric_definitions')
    .select('*')
    .order('display_order', { ascending: true })
  
  if (definitionsError) {
    console.error('Error fetching definitions:', definitionsError)
    return { 
      categories: [], 
      error: `Definitions error: ${definitionsError.message}` 
    }
  }
  
  // Fetch latest values for this user
  // We need to get the most recent value for each metric
  const { data: values, error: valuesError } = await supabase
    .from('eden_metric_values')
    .select('*')
    .eq('user_id', userId)
    .order('measured_at', { ascending: false })
  
  if (valuesError) {
    console.error('Error fetching values:', valuesError)
    // Continue without values - we'll show "No data yet"
  }
  
  // Create a map of metric_id to latest value
  const latestValues = new Map<string, { value: number; measuredAt: string }>()
  if (values) {
    for (const v of values) {
      // Only keep the first (most recent) value for each metric
      if (!latestValues.has(v.metric_id)) {
        latestValues.set(v.metric_id, {
          value: v.value,
          measuredAt: v.measured_at,
        })
      }
    }
  }
  
  // Build the result structure
  const result: CategoryWithMetrics[] = (categories as EdenMetricCategory[]).map(category => {
    const categoryMetrics = (definitions as EdenMetricDefinition[])
      .filter(def => def.category_code === category.category_code)
      .map(def => {
        const latest = latestValues.get(def.id)
        return {
          ...def,
          latestValue: latest?.value ?? null,
          measuredAt: latest?.measuredAt ?? null,
        } as MetricWithValue
      })
    
    return {
      ...category,
      metrics: categoryMetrics,
    }
  })
  
  return { categories: result, error: null }
}

function formatValue(value: number | null, unit: string): string {
  if (value === null) return 'No data yet'
  
  // Format the number based on the unit
  if (unit === '%') {
    return `${value.toFixed(1)}%`
  } else if (unit === 'bpm' || unit === 'mmHg' || unit === 'mg/dL') {
    return `${Math.round(value)} ${unit}`
  } else if (unit === 'hours' || unit === 'hrs') {
    return `${value.toFixed(1)} hrs`
  } else if (unit === 'kg') {
    return `${value.toFixed(1)} kg`
  } else if (unit === 'lbs') {
    return `${value.toFixed(1)} lbs`
  } else if (unit === 'score' || unit === 'points') {
    return `${Math.round(value)}`
  } else if (unit) {
    return `${value} ${unit}`
  }
  return `${value}`
}

function formatDate(dateString: string | null): string {
  if (!dateString) return ''
  const date = new Date(dateString)
  const now = new Date()
  const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24))
  
  if (diffDays === 0) return 'Today'
  if (diffDays === 1) return 'Yesterday'
  if (diffDays < 7) return `${diffDays} days ago`
  
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export default async function DashboardPage() {
  const user = await requireAuth()
  const { categories: categoriesWithMetrics, error } = await getEdenMetrics(user.id)
  const displayName = user.email?.split('@')[0] || 'there'

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-6xl px-4 py-8 lg:py-10 space-y-8">
        
        {/* Hero Section */}
        <section className="lg:grid lg:grid-cols-[minmax(0,2fr)_minmax(0,1.3fr)] lg:gap-8 lg:items-start">
          {/* Left: Welcome text */}
          <div>
            <div className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700 border border-emerald-100">
              <span className="text-sm">🧬</span>
              <span>Primespan Coach</span>
            </div>
            <h1 className="mt-4 text-2xl sm:text-3xl font-semibold text-slate-900">
              Welcome, {displayName}
            </h1>
            <p className="mt-2 text-sm text-slate-600 max-w-2xl">
              This is your current Eden health snapshot. Eden uses these metrics to guide your training, recovery, and lifestyle decisions.
            </p>
          </div>

          {/* Right: Today at a glance card */}
          <div className="mt-6 lg:mt-0 rounded-2xl border border-slate-200 bg-white shadow-sm p-4 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Today at a glance</p>
              <span className="text-xs text-slate-400">Updated recently</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {categoriesWithMetrics.map((category) => {
                const config = categoryConfig[category.category_code] || { icon: '📊', color: 'text-slate-600' }
                const metricsWithData = category.metrics.filter(m => m.latestValue !== null).length
                return (
                  <div
                    key={category.category_code}
                    className="inline-flex items-center gap-1.5 rounded-full bg-slate-50 px-2.5 py-1 text-xs border border-slate-100"
                  >
                    <span>{config.icon}</span>
                    <span className="text-slate-700 font-medium">{category.name}</span>
                    <span className="text-slate-400">·</span>
                    <span className="text-slate-500">{metricsWithData} tracked</span>
                  </div>
                )
              })}
            </div>
            <p className="text-xs text-slate-500">
              Eden reads these signals to decide what to focus on with you.
            </p>
          </div>
        </section>

        {/* Apple Health Upload Section */}
        <section>
          <div className="rounded-2xl border border-slate-200 bg-gradient-to-r from-emerald-50 to-sky-50 p-4 sm:p-5 shadow-sm">
            <AppleHealthUpload userId={user.id} />
          </div>
        </section>

        {/* Error message */}
        {error && (
          <div className="rounded-2xl bg-red-50 border border-red-200 p-4">
            <p className="text-red-800 text-sm font-medium">Error loading metrics</p>
            <p className="text-red-600 text-sm mt-1">{error}</p>
            <p className="text-red-500 text-xs mt-2">
              Make sure RLS policies are configured in Supabase to allow authenticated users to read the tables.
            </p>
          </div>
        )}

        {/* Metrics Grid Section */}
        <section className="space-y-4">
          <div className="flex items-baseline justify-between flex-wrap gap-2">
            <h2 className="text-lg font-semibold text-slate-900">Your Eden metrics</h2>
            <p className="text-xs text-slate-500">
              Heart · Frame · Metabolism · Recovery · Mind
            </p>
          </div>

          {categoriesWithMetrics.length === 0 && !error ? (
            <div className="rounded-2xl bg-white border border-slate-200 p-8 text-center shadow-sm">
              <p className="text-slate-500 text-sm">No metrics configured yet.</p>
            </div>
          ) : categoriesWithMetrics.length > 0 ? (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {categoriesWithMetrics.map((category) => {
                const config = categoryConfig[category.category_code] || {
                  icon: '📊',
                  color: 'text-slate-600',
                  bgColor: 'bg-slate-50 border-slate-200',
                }

                return (
                  <div
                    key={category.category_code}
                    className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm flex flex-col"
                  >
                    {/* Category Header */}
                    <div className="flex items-center gap-2 mb-3 pb-3 border-b border-slate-100">
                      <span className="text-xl">{config.icon}</span>
                      <h3 className={`text-sm font-semibold ${config.color}`}>
                        {category.name}
                      </h3>
                    </div>

                    {/* Metrics List */}
                    <div className="flex flex-col gap-2 flex-1">
                      {category.metrics.length === 0 ? (
                        <p className="text-slate-400 text-xs">No metrics in this category</p>
                      ) : (
                        category.metrics.map((metric) => (
                          <div
                            key={metric.id}
                            className="flex justify-between items-start py-1.5 hover:bg-slate-50 rounded-lg px-1 -mx-1 transition-colors"
                          >
                            <div className="flex-1 min-w-0">
                              <p className="text-sm text-slate-800 truncate">
                                {metric.name}
                              </p>
                              {metric.measuredAt && (
                                <p className="text-xs text-slate-400 mt-0.5">
                                  {formatDate(metric.measuredAt)}
                                </p>
                              )}
                            </div>
                            <div className="ml-3 flex-shrink-0 text-right">
                              <p
                                className={`text-sm font-medium ${
                                  metric.latestValue !== null ? config.color : 'text-slate-400'
                                }`}
                              >
                                {formatValue(metric.latestValue, metric.unit)}
                              </p>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          ) : null}
        </section>

        {/* Chat with Eden Section */}
        <section className="space-y-3">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Chat with Eden</h2>
            <p className="text-sm text-slate-600">
              Use the coach to interpret your metrics and decide what to focus on next.
            </p>
          </div>
          <EdenCoachChat />
        </section>

      </div>
    </main>
  )
}

