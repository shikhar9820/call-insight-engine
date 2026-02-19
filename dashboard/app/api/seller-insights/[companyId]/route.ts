import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

// Disable caching to always get fresh data
export const dynamic = 'force-dynamic'
export const revalidate = 0

interface CallTimelineEntry {
  call_id: string
  ucid: string
  date: string
  duration_seconds: number
  employee_name: string
  sentiment_start: string
  sentiment_end: string
  sentiment_trajectory: string
  churn_risk_score: number
  resolution_status: string
  call_purpose: string
  issues: Array<{
    category: string
    subcategory: string
    description: string
    severity: string
  }>
  risk_signals: string[]
  topics: string[]
  key_quotes: any
  executive_tone: string
  recording_url: string | null
}

// Behavioral data from seller profile tables
interface BehavioralProfile {
  vintage_months: number | null
  highest_service: string | null
  bl_active_days: number | null
  pns_calls_received: number | null
  pns_calls_answered: number | null
  pns_response_rate: number | null
  location_preference: string | null
  category_rank: number | null
  category_count: number | null
  repeat_30d: string | null
  repeat_60d: string | null
}

interface MonthlyMetrics {
  data_month: string
  pns_defaulter_count: number
  fresh_lead_consumption: number
  wrong_product_count: number
  cqs_score: number | null
  ba_rank: number | null
  cc_rank: number | null
  negative_cities_count: number
  pref_city: number
  pref_state: number
  pref_country: number
}

// Seller Behavior Classification based on SOP
type SellerBehaviorType = 'high_potential' | 'dormant_at_risk' | 'misconfigured' | 'moderate' | 'unknown'

interface SellerBehaviorClassification {
  type: SellerBehaviorType
  label: string
  description: string
  confidence: 'high' | 'medium' | 'low'
  factors: {
    positive: string[]
    negative: string[]
  }
  recommended_actions: string[]
}

interface HistoricalTrend {
  metric: string
  label: string
  current_value: number | null
  previous_value: number | null
  trend: 'up' | 'down' | 'stable'
  higher_is_better: boolean
  change_percent: number | null
  history: Array<{ month: string; value: number | null }>
}

interface InterlinkedInsight {
  signal: string
  impact: string
  severity: 'critical' | 'warning' | 'info'
  recommendation: string
}

interface EngagementPattern {
  best_day_of_week: string | null
  best_time_of_day: string | null
  avg_response_time: string | null
  avg_call_duration_minutes: number | null
  response_rate: number | null
  preferred_channel: string
  call_outcome_by_time: Array<{ time_slot: string; success_rate: number }>
}

interface SellerCategory {
  mcat_id: number
  mcat_name: string
}

interface SellerProfile {
  company_id: string
  company_name: string
  total_calls: number
  date_range: {
    first_call: string
    latest_call: string
  }
  communication_fingerprint: {
    avg_call_duration: number
    preferred_language: string
    tone_consistency: string
    responsiveness_pattern: string
  }
  health_metrics: {
    health_score: number
    sentiment_trend: 'improving' | 'declining' | 'stable'
    avg_churn_risk: number
    resolution_rate: number
  }
  issue_analysis: {
    total_issues: number
    recurring_issues: Array<{ category: string; count: number; first_seen: string; last_seen: string }>
    resolved_issues: number
    sticky_issues: string[]
  }
  risk_assessment: {
    risk_level: 'low' | 'medium' | 'high'
    churn_probability: number
    escalation_history: number
    deactivation_mentions: number
    payment_disputes: number
  }
  engagement_metrics: {
    days_since_last_call: number
    avg_calls_per_month: number
    call_frequency_trend: 'increasing' | 'decreasing' | 'stable'
  }
  call_timeline: CallTimelineEntry[]
  recommendations: string[]
  // New behavioral data
  behavioral_profile: BehavioralProfile | null
  monthly_metrics: MonthlyMetrics[]
  top_categories: SellerCategory[]
  behavioral_insights: {
    pns_health: 'good' | 'moderate' | 'poor' | 'unknown'
    lead_engagement: 'active' | 'moderate' | 'inactive' | 'unknown'
    service_tier: string | null
    tenure_status: 'new' | 'established' | 'veteran' | 'unknown'
    has_prior_tickets: boolean  // Indicates multiple tickets, NOT that previous was unresolved
    cqs_trend: 'improving' | 'declining' | 'stable' | 'unknown'
    roi_risk: 'low' | 'moderate' | 'high' | 'unknown'
    category_visibility: 'good' | 'moderate' | 'poor' | 'unknown'
    product_issues: 'none' | 'some' | 'many' | 'unknown'
  }
  // New behavioral enhancements
  behavior_classification: SellerBehaviorClassification
  historical_trends: HistoricalTrend[]
  interlinked_insights: InterlinkedInsight[]
  engagement_patterns: EngagementPattern
}

function calculateToneConsistency(calls: any[]): string {
  const tones = calls
    .map(c => c.call_insights?.[0]?.executive_tone)
    .filter(Boolean)

  if (tones.length < 2) return 'insufficient_data'

  const uniqueTones = new Set(tones)
  const consistency = 1 - (uniqueTones.size - 1) / tones.length

  if (consistency >= 0.8) return 'consistent'
  if (consistency >= 0.5) return 'variable'
  return 'inconsistent'
}

function calculateCallFrequencyTrend(calls: any[]): 'increasing' | 'decreasing' | 'stable' {
  if (calls.length < 4) return 'stable'

  const sortedCalls = [...calls].sort(
    (a, b) => new Date(a.call_start_time || a.created_at).getTime() -
              new Date(b.call_start_time || b.created_at).getTime()
  )

  // Split into first half and second half
  const midpoint = Math.floor(sortedCalls.length / 2)
  const firstHalf = sortedCalls.slice(0, midpoint)
  const secondHalf = sortedCalls.slice(midpoint)

  // Calculate time span for each half
  const getTimeSpan = (callsGroup: any[]) => {
    if (callsGroup.length < 2) return 1
    const first = new Date(callsGroup[0].call_start_time || callsGroup[0].created_at).getTime()
    const last = new Date(callsGroup[callsGroup.length - 1].call_start_time || callsGroup[callsGroup.length - 1].created_at).getTime()
    return Math.max(1, (last - first) / (1000 * 60 * 60 * 24 * 30)) // months
  }

  const firstRate = firstHalf.length / getTimeSpan(firstHalf)
  const secondRate = secondHalf.length / getTimeSpan(secondHalf)

  const diff = secondRate - firstRate
  if (diff > 0.5) return 'increasing'
  if (diff < -0.5) return 'decreasing'
  return 'stable'
}

function calculateBehavioralInsights(
  profileData: any,
  metricsData: any[]
): SellerProfile['behavioral_insights'] {
  // PNS Health: based on response rate
  // Definition: PNS (Preferred Number Service) - calls answered vs received on seller's preferred number
  let pnsHealth: 'good' | 'moderate' | 'poor' | 'unknown' = 'unknown'
  if (profileData?.pns_response_rate !== null && profileData?.pns_response_rate !== undefined) {
    const rate = profileData.pns_response_rate
    if (rate >= 0.7) pnsHealth = 'good'
    else if (rate >= 0.4) pnsHealth = 'moderate'
    else pnsHealth = 'poor'
  }

  // Lead Engagement: based on fresh_lead_consumption (cons_0_4_hrs) from latest month
  // Definition: Leads consumed within 0-4hrs - higher = active seller, better ROI chances
  let leadEngagement: 'active' | 'moderate' | 'inactive' | 'unknown' = 'unknown'
  const latestMetrics = metricsData[metricsData.length - 1]
  if (latestMetrics?.fresh_lead_consumption !== null && latestMetrics?.fresh_lead_consumption !== undefined) {
    const consumption = latestMetrics.fresh_lead_consumption
    if (consumption >= 10) leadEngagement = 'active'
    else if (consumption >= 3) leadEngagement = 'moderate'
    else leadEngagement = 'inactive'
  }

  // Tenure Status: based on vintage_months
  // Definition: Customer since in IndiaMART
  let tenureStatus: 'new' | 'established' | 'veteran' | 'unknown' = 'unknown'
  if (profileData?.vintage_months !== null && profileData?.vintage_months !== undefined) {
    const months = profileData.vintage_months
    if (months >= 60) tenureStatus = 'veteran'
    else if (months >= 12) tenureStatus = 'established'
    else tenureStatus = 'new'
  }

  // Prior Tickets: Flag to know if seller raised tickets within 30/60 days
  // NOTE: This only indicates multiple tickets, NOT that previous issues were unresolved
  // Actual resolution status is determined per-call from Gemini's transcript analysis
  const hasPriorTickets = profileData?.repeat_30d === 'Yes' || profileData?.repeat_60d === 'Yes'

  // CQS Trend: Catalog Quality Score - overall catalog health
  let cqsTrend: 'improving' | 'declining' | 'stable' | 'unknown' = 'unknown'
  if (metricsData.length >= 2) {
    const octData = metricsData.find(m => m.data_month === 'Oct')
    const novData = metricsData.find(m => m.data_month === 'Nov')
    if (octData?.cqs_score && novData?.cqs_score) {
      const diff = novData.cqs_score - octData.cqs_score
      if (diff > 5) cqsTrend = 'improving'
      else if (diff < -5) cqsTrend = 'declining'
      else cqsTrend = 'stable'
    }
  }

  // ROI Risk: based on pns_defaulter_count (Preferred Number Service calls not answered - higher = lower ROI)
  let roiRisk: 'low' | 'moderate' | 'high' | 'unknown' = 'unknown'
  if (latestMetrics?.pns_defaulter_count !== null && latestMetrics?.pns_defaulter_count !== undefined) {
    const defaulterCount = latestMetrics.pns_defaulter_count
    if (defaulterCount === 0) roiRisk = 'low'
    else if (defaulterCount <= 2) roiRisk = 'moderate'
    else roiRisk = 'high'
  }

  // Category Visibility: based on ba_rank (1 txn in 6mo) and cc_rank (no consumption)
  // Higher ba_rank/cc_rank = poor category visibility, less BuyLead flow
  let categoryVisibility: 'good' | 'moderate' | 'poor' | 'unknown' = 'unknown'
  if (latestMetrics?.ba_rank !== null && latestMetrics?.cc_rank !== null) {
    const baRank = latestMetrics.ba_rank || 0
    const ccRank = latestMetrics.cc_rank || 0
    const totalLowVisibility = baRank + ccRank
    if (totalLowVisibility === 0) categoryVisibility = 'good'
    else if (totalLowVisibility <= 5) categoryVisibility = 'moderate'
    else categoryVisibility = 'poor'
  }

  // Product Issues: based on wrong_product_count (blni_wrng_product)
  // Definition: Irrelevant BuyLead marked as wrong product - indicates catalog/expectation mismatch
  let productIssues: 'none' | 'some' | 'many' | 'unknown' = 'unknown'
  if (latestMetrics?.wrong_product_count !== null && latestMetrics?.wrong_product_count !== undefined) {
    const wrongCount = latestMetrics.wrong_product_count
    if (wrongCount === 0) productIssues = 'none'
    else if (wrongCount <= 3) productIssues = 'some'
    else productIssues = 'many'
  }

  return {
    pns_health: pnsHealth,
    lead_engagement: leadEngagement,
    service_tier: profileData?.highest_service || null,
    tenure_status: tenureStatus,
    has_prior_tickets: hasPriorTickets,
    cqs_trend: cqsTrend,
    roi_risk: roiRisk,
    category_visibility: categoryVisibility,
    product_issues: productIssues
  }
}

// ============================================
// SELLER BEHAVIOR CLASSIFICATION (Based on SOP)
// ============================================
function classifySellerBehavior(
  profileData: any,
  metricsData: any[],
  behavioralInsights: SellerProfile['behavioral_insights']
): SellerBehaviorClassification {
  const latestMetrics = metricsData[metricsData.length - 1] || {}

  const positiveFactors: string[] = []
  const negativeFactors: string[] = []

  // Evaluate PNS Defaulter Count (Low = good)
  const pnsDefaulterCount = latestMetrics.pns_defaulter_count || 0
  if (pnsDefaulterCount === 0) {
    positiveFactors.push('No PNS defaults - High responsiveness')
  } else if (pnsDefaulterCount >= 3) {
    negativeFactors.push(`High PNS defaulter count (${pnsDefaulterCount}) - Low responsiveness`)
  }

  // Evaluate Fresh Lead Consumption (High = good)
  const freshLeadConsumption = latestMetrics.fresh_lead_consumption || 0
  if (freshLeadConsumption >= 10) {
    positiveFactors.push(`Strong fresh lead consumption (${freshLeadConsumption}) - Active engagement`)
  } else if (freshLeadConsumption < 3) {
    negativeFactors.push(`Low fresh lead consumption (${freshLeadConsumption}) - Inactive`)
  }

  // Evaluate Category Visibility (Low ba_rank + cc_rank = good)
  const baRank = latestMetrics.ba_rank || 0
  const ccRank = latestMetrics.cc_rank || 0
  if (baRank === 0 && ccRank === 0) {
    positiveFactors.push('Good category visibility - All categories active')
  } else if (baRank + ccRank > 5) {
    negativeFactors.push(`Poor category visibility (${baRank + ccRank} dormant categories)`)
  }

  // Evaluate Geographic Reach
  const negCities = latestMetrics.negative_cities_count || 0
  const prefCity = latestMetrics.pref_city || 0
  const prefState = latestMetrics.pref_state || 0
  const prefCountry = latestMetrics.pref_country || 0
  const totalPrefGeo = prefCity + prefState + prefCountry

  if (totalPrefGeo >= 10 && negCities <= 2) {
    positiveFactors.push(`Wide geographic reach (${totalPrefGeo} preferred areas)`)
  } else if (negCities > 10 && totalPrefGeo < 5) {
    negativeFactors.push(`Restricted market reach (${negCities} blocked cities)`)
  }

  // PNS Response Rate
  if (profileData?.pns_response_rate >= 0.7) {
    positiveFactors.push(`Strong PNS response rate (${Math.round(profileData.pns_response_rate * 100)}%)`)
  } else if (profileData?.pns_response_rate !== null && profileData?.pns_response_rate < 0.4) {
    negativeFactors.push(`Low PNS response rate (${Math.round((profileData?.pns_response_rate || 0) * 100)}%)`)
  }

  // Classify based on SOP patterns
  let type: SellerBehaviorType = 'moderate'
  let label = 'Moderate Seller'
  let description = 'Seller shows average engagement levels'
  let confidence: 'high' | 'medium' | 'low' = 'medium'
  let recommendedActions: string[] = []

  // HIGH-POTENTIAL: Low PNS defaulter, High fresh consumption, Low dormant categories, Wide geography
  if (
    pnsDefaulterCount <= 1 &&
    freshLeadConsumption >= 8 &&
    (baRank + ccRank) <= 3 &&
    totalPrefGeo >= 5
  ) {
    type = 'high_potential'
    label = 'High-Potential Seller'
    description = 'Engaged, responsive, and ROI-positive. Recommend scaling categories or geography.'
    confidence = positiveFactors.length >= 4 ? 'high' : 'medium'
    recommendedActions = [
      'Discuss category expansion opportunities',
      'Suggest geographic reach expansion',
      'Consider for premium upsell',
      'Recommend for case study/testimonial'
    ]
  }
  // DORMANT/AT-RISK: High PNS defaulter, Low fresh consumption, High dormant categories, High negative cities
  else if (
    pnsDefaulterCount >= 3 ||
    (freshLeadConsumption < 3 && (baRank + ccRank) > 5) ||
    (negCities > 10 && totalPrefGeo < 5)
  ) {
    type = 'dormant_at_risk'
    label = 'Dormant / At-Risk Seller'
    description = 'Requires immediate intervention, coaching, or corrective nudges.'
    confidence = negativeFactors.length >= 3 ? 'high' : 'medium'
    recommendedActions = [
      'Schedule urgent intervention call',
      'Review and address pain points',
      'Offer platform training/coaching',
      'Consider retention incentives if high-value'
    ]
  }
  // MISCONFIGURED: Good responsiveness but poor category/geography setup
  else if (
    (profileData?.pns_response_rate >= 0.5 || pnsDefaulterCount <= 1) &&
    ((baRank + ccRank) > 5 || (negCities > 5 && totalPrefGeo < 5))
  ) {
    type = 'misconfigured'
    label = 'Misconfigured Seller'
    description = 'Issue is configuration, not intent. Recommend category & geography optimization.'
    confidence = 'medium'
    recommendedActions = [
      'Review category mappings together',
      'Optimize product categorization',
      'Expand geographic preferences',
      'Remove unnecessary city restrictions'
    ]
  }

  return {
    type,
    label,
    description,
    confidence,
    factors: {
      positive: positiveFactors,
      negative: negativeFactors
    },
    recommended_actions: recommendedActions
  }
}

// ============================================
// HISTORICAL TRENDS ANALYSIS
// ============================================
function calculateHistoricalTrends(metricsData: any[]): HistoricalTrend[] {
  if (metricsData.length === 0) return []

  // Sort months in chronological order (Jan=0, Feb=1, ..., Dec=11)
  const monthOrder: Record<string, number> = {
    'Jan': 0, 'Feb': 1, 'Mar': 2, 'Apr': 3, 'May': 4, 'Jun': 5,
    'Jul': 6, 'Aug': 7, 'Sep': 8, 'Oct': 9, 'Nov': 10, 'Dec': 11
  }

  const sortedMetrics = [...metricsData].sort((a, b) => {
    const monthA = monthOrder[a.data_month] ?? 99
    const monthB = monthOrder[b.data_month] ?? 99
    return monthA - monthB
  })

  const trends: HistoricalTrend[] = []
  const latestMetrics = sortedMetrics[sortedMetrics.length - 1]
  const previousMetrics = sortedMetrics.length >= 2 ? sortedMetrics[sortedMetrics.length - 2] : null

  const metricsToTrack = [
    { key: 'fresh_lead_consumption', label: 'Fresh Lead Consumption', higherIsBetter: true },
    { key: 'pns_defaulter_count', label: 'PNS Defaulter Count', higherIsBetter: false },
    { key: 'cqs_score', label: 'CQS Score', higherIsBetter: true },
    { key: 'ba_rank', label: 'Low-Activity Categories', higherIsBetter: false },
    { key: 'cc_rank', label: 'Zero-Consumption Categories', higherIsBetter: false },
    { key: 'negative_cities_count', label: 'Blocked Cities', higherIsBetter: false }
  ]

  metricsToTrack.forEach(({ key, label, higherIsBetter }) => {
    const currentValue = latestMetrics?.[key] ?? null
    const previousValue = previousMetrics?.[key] ?? null

    let trend: 'up' | 'down' | 'stable' = 'stable'
    let changePercent: number | null = null

    if (currentValue !== null && previousValue !== null) {
      const diff = currentValue - previousValue

      if (previousValue !== 0) {
        // Normal case: calculate percentage change
        changePercent = Math.round((diff / previousValue) * 100)
        if (Math.abs(changePercent) > 10) {
          trend = diff > 0 ? 'up' : 'down'
        }
      } else if (currentValue !== 0) {
        // Previous was 0, current is non-zero: this is a significant change
        // Show as 100% increase (or use the absolute value as indicator)
        changePercent = 100
        trend = 'up'
      }
      // If both are 0, trend stays 'stable' with null changePercent
    }

    // Build history array (using sorted metrics)
    const history = sortedMetrics.map(m => ({
      month: m.data_month,
      value: m[key] ?? null
    }))

    trends.push({
      metric: key,
      label,
      current_value: currentValue,
      previous_value: previousValue,
      trend,
      higher_is_better: higherIsBetter,
      change_percent: changePercent,
      history
    })
  })

  return trends
}

// ============================================
// INTERLINKED BEHAVIORAL INSIGHTS (Based on SOP)
// ============================================
function generateInterlinkedInsights(
  profileData: any,
  metricsData: any[],
  behavioralInsights: SellerProfile['behavioral_insights']
): InterlinkedInsight[] {
  const insights: InterlinkedInsight[] = []
  const latestMetrics = metricsData[metricsData.length - 1] || {}

  const pnsDefaulterCount = latestMetrics.pns_defaulter_count || 0
  const freshLeadConsumption = latestMetrics.fresh_lead_consumption || 0
  const baRank = latestMetrics.ba_rank || 0
  const ccRank = latestMetrics.cc_rank || 0
  const negCities = latestMetrics.negative_cities_count || 0
  const prefCity = latestMetrics.pref_city || 0
  const prefState = latestMetrics.pref_state || 0

  // SOP Logic: High pns_defaulter_count = Low responsiveness + Low intent
  if (pnsDefaulterCount >= 3) {
    insights.push({
      signal: `High PNS Defaulter Count (${pnsDefaulterCount})`,
      impact: 'Directly lowers ROI even if lead volume is high. Reduces effectiveness of fresh lead consumption.',
      severity: 'critical',
      recommendation: 'Address responsiveness urgently. Check if seller has app notifications enabled and is available during business hours.'
    })
  }

  // SOP Logic: High cc_rank + Low fresh consumption = Category clutter
  if (ccRank > 3 && freshLeadConsumption < 5) {
    insights.push({
      signal: `Category Clutter Detected (${ccRank} zero-consumption categories)`,
      impact: 'Categories are dormant or irrelevant. Either mis-added or lack of intent.',
      severity: 'warning',
      recommendation: 'Review categories together - prune irrelevant ones or activate with targeted products.'
    })
  }

  // SOP Logic: High ba_rank = Low visibility, needs activation
  if (baRank > 3) {
    insights.push({
      signal: `Low Category Visibility (${baRank} single-transaction categories)`,
      impact: 'Seller is present but not actively working on these categories. Low buyer exposure.',
      severity: 'warning',
      recommendation: 'Focus on top 3-5 performing categories. Consider category pruning or reactivation.'
    })
  }

  // SOP Logic: High negative cities + Low preferred geography = Over-restriction
  if (negCities > 10 && (prefCity + prefState) < 5) {
    insights.push({
      signal: `Geographic Over-Restriction (${negCities} blocked cities)`,
      impact: 'Severely restricted market reach leads to reduced lead inflow.',
      severity: 'warning',
      recommendation: 'Review blocked cities - many may be valid markets. Suggest expanding to nearby regions.'
    })
  }

  // SOP Logic: High preferred geography + High fresh consumption = Healthy expansion
  if ((prefCity + prefState) >= 10 && freshLeadConsumption >= 8) {
    insights.push({
      signal: 'Healthy Expansion Mindset',
      impact: 'Strong correlation between wide market reach and consistent lead flow.',
      severity: 'info',
      recommendation: 'Maintain current approach. Consider premium category features or visibility boosts.'
    })
  }

  // SOP Logic: Good responsiveness + Poor category consumption = Misconfiguration
  if (pnsDefaulterCount <= 1 && (baRank + ccRank) > 5) {
    insights.push({
      signal: 'Configuration Issue Detected',
      impact: 'Seller is responsive but categories are misconfigured. Lost revenue opportunity.',
      severity: 'warning',
      recommendation: 'Schedule catalog review session. Help optimize product-category mapping.'
    })
  }

  return insights
}

// ============================================
// ENGAGEMENT PATTERNS ANALYSIS
// ============================================
function analyzeEngagementPatterns(calls: any[]): EngagementPattern {
  const dayCount: Record<string, { total: number; resolved: number }> = {}
  const timeSlotCount: Record<string, { total: number; resolved: number }> = {}

  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
  const timeSlots = ['Morning (9-12)', 'Afternoon (12-15)', 'Evening (15-18)', 'Late (18+)']

  calls.forEach(call => {
    const callTime = new Date(call.call_start_time || call.created_at)
    const dayName = days[callTime.getDay()]
    const hour = callTime.getHours()

    let timeSlot = 'Late (18+)'
    if (hour >= 9 && hour < 12) timeSlot = 'Morning (9-12)'
    else if (hour >= 12 && hour < 15) timeSlot = 'Afternoon (12-15)'
    else if (hour >= 15 && hour < 18) timeSlot = 'Evening (15-18)'

    const isResolved = call.call_insights?.[0]?.resolution_status === 'resolved'

    if (!dayCount[dayName]) dayCount[dayName] = { total: 0, resolved: 0 }
    dayCount[dayName].total++
    if (isResolved) dayCount[dayName].resolved++

    if (!timeSlotCount[timeSlot]) timeSlotCount[timeSlot] = { total: 0, resolved: 0 }
    timeSlotCount[timeSlot].total++
    if (isResolved) timeSlotCount[timeSlot].resolved++
  })

  // Find best day (most calls with best resolution rate)
  let bestDay: string | null = null
  let bestDayScore = 0
  Object.entries(dayCount).forEach(([day, { total, resolved }]) => {
    const rate = total > 0 ? resolved / total : 0
    // Score = total calls * (1 + resolution rate) - prioritize days with more activity
    const score = total * (1 + rate)
    if (score > bestDayScore) {
      bestDayScore = score
      bestDay = day
    }
  })

  // Find best time slot (most calls with best resolution rate)
  let bestTime: string | null = null
  let bestTimeScore = 0
  Object.entries(timeSlotCount).forEach(([slot, { total, resolved }]) => {
    const rate = total > 0 ? resolved / total : 0
    const score = total * (1 + rate)
    if (score > bestTimeScore) {
      bestTimeScore = score
      bestTime = slot
    }
  })

  // Calculate average call duration
  const totalDuration = calls.reduce((sum, call) => sum + (call.call_duration_seconds || 0), 0)
  const avgDurationMins = calls.length > 0 ? Math.round((totalDuration / calls.length) / 60 * 10) / 10 : null

  // Calculate response/resolution rate
  const resolvedCalls = calls.filter(c => c.call_insights?.[0]?.resolution_status === 'resolved').length
  const responseRate = calls.length > 0 ? Math.round((resolvedCalls / calls.length) * 100) : null

  // Build outcome by time
  const callOutcomeByTime = timeSlots.map(slot => ({
    time_slot: slot,
    success_rate: timeSlotCount[slot]?.total > 0
      ? Math.round((timeSlotCount[slot].resolved / timeSlotCount[slot].total) * 100)
      : 0
  }))

  return {
    best_day_of_week: bestDay,
    best_time_of_day: bestTime,
    avg_response_time: null, // Would need more data
    avg_call_duration_minutes: avgDurationMins,
    response_rate: responseRate,
    preferred_channel: 'Phone',
    call_outcome_by_time: callOutcomeByTime
  }
}

function generateRecommendations(profile: Partial<SellerProfile>): string[] {
  const recommendations: string[] = []

  // Health score based
  if ((profile.health_metrics?.health_score || 0) < 40) {
    recommendations.push('URGENT: Schedule a senior executive call to address accumulated issues')
  }

  // Sentiment trend based
  if (profile.health_metrics?.sentiment_trend === 'declining') {
    recommendations.push('Proactively reach out to understand recent dissatisfaction')
  }

  // Sticky issues based
  if ((profile.issue_analysis?.sticky_issues?.length || 0) > 0) {
    const issues = profile.issue_analysis?.sticky_issues?.join(', ')
    recommendations.push(`Escalate recurring issues to specialist team: ${issues}`)
  }

  // Resolution rate based
  if ((profile.health_metrics?.resolution_rate || 0) < 50) {
    recommendations.push('Review pending issues and ensure proper follow-up tracking')
  }

  // Engagement based
  if ((profile.engagement_metrics?.days_since_last_call || 0) > 30) {
    recommendations.push('Re-engagement call needed - no contact in over 30 days')
  }

  // Churn risk based
  if ((profile.risk_assessment?.churn_probability || 0) > 0.6) {
    recommendations.push('High churn risk - consider offering retention incentives')
  }

  // Deactivation mentions
  if ((profile.risk_assessment?.deactivation_mentions || 0) >= 2) {
    recommendations.push('Multiple deactivation mentions - escalate to retention team')
  }

  // === BEHAVIORAL-BASED RECOMMENDATIONS ===

  // PNS Health - Definition: Higher response rate = better platform usage
  if (profile.behavioral_insights?.pns_health === 'poor') {
    recommendations.push('Low PNS response rate - guide seller on responding to buyer calls promptly to improve ROI')
  }

  // Lead Engagement - Definition: Fresh leads (0-4hrs) consumption indicates active seller
  if (profile.behavioral_insights?.lead_engagement === 'inactive') {
    recommendations.push('Low fresh lead consumption - discuss lead quality and help optimize category preferences')
  }

  // CQS Trend - Catalog Quality Score declining
  if (profile.behavioral_insights?.cqs_trend === 'declining') {
    recommendations.push('CQS score declining - review catalog quality, product descriptions, and specifications')
  }

  // ROI Risk - Based on PNS defaulter count (not responding to buyer calls)
  if (profile.behavioral_insights?.roi_risk === 'high') {
    recommendations.push('HIGH ROI RISK: Seller not responding to buyer calls - address PNS defaulter status urgently')
  }

  // Category Visibility - Based on ba_rank (1 txn in 6mo) and cc_rank (no consumption)
  if (profile.behavioral_insights?.category_visibility === 'poor') {
    recommendations.push('Poor category visibility - review category mappings and suggest adding products to A-rank categories')
  }

  // Product Issues - Irrelevant BuyLeads marked as wrong product
  if (profile.behavioral_insights?.product_issues === 'many') {
    recommendations.push('Multiple wrong product complaints - verify product listings match actual offerings')
  }

  // Service tier + Issues
  if (profile.behavioral_profile?.highest_service?.includes('TrustSEAL') &&
      (profile.health_metrics?.health_score || 0) < 50) {
    recommendations.push('Premium TrustSEAL seller facing issues - prioritize for immediate senior attention')
  }

  // Veteran seller with issues
  if (profile.behavioral_insights?.tenure_status === 'veteran' &&
      profile.health_metrics?.sentiment_trend === 'declining') {
    recommendations.push('Long-term seller (veteran) showing dissatisfaction - assign senior CSD for relationship recovery')
  }

  // New seller struggling
  if (profile.behavioral_insights?.tenure_status === 'new' &&
      (profile.risk_assessment?.churn_probability || 0) > 0.5) {
    recommendations.push('New seller at risk - provide onboarding support and platform guidance')
  }

  // Multiple tickets in short period - may need attention
  if (profile.behavioral_insights?.has_prior_tickets) {
    recommendations.push('Multiple tickets raised within 30/60 days - review ticket history for patterns')
  }

  // Location preference opportunity
  if (profile.behavioral_profile?.location_preference === 'Local' &&
      profile.behavioral_insights?.lead_engagement === 'inactive') {
    recommendations.push('Local preference seller with low engagement - suggest expanding to Regional for more leads')
  }

  // Positive cases - Champion recommendation hidden
  // if ((profile.health_metrics?.health_score || 0) >= 80) {
  //   recommendations.push('Champion seller - consider for case study or testimonial')
  // }

  if (profile.health_metrics?.sentiment_trend === 'improving' &&
      (profile.health_metrics?.resolution_rate || 0) >= 80) {
    recommendations.push('Strong improvement trajectory - maintain current engagement approach')
  }

  return recommendations.length > 0 ? recommendations : ['Continue regular engagement and monitoring']
}

export async function GET(
  request: NextRequest,
  { params }: { params: { companyId: string } }
) {
  try {
    const companyId = params.companyId

    // Fetch all calls for this seller with insights
    const { data: calls, error: callsError } = await supabase
      .from('calls')
      .select(`
        *,
        call_insights (
          id,
          churn_risk_score,
          deactivation_intent,
          deactivation_confirmed,
          refund_requested,
          escalation_threatened,
          payment_dispute,
          legal_threat,
          sentiment_start,
          sentiment_end,
          sentiment_trajectory,
          call_purpose,
          resolution_status,
          issues,
          topics,
          key_quotes,
          executive_tone,
          follow_up_required,
          follow_up_owner
        )
      `)
      .eq('company_id', companyId)
      .order('call_start_time', { ascending: true })

    if (callsError) throw callsError

    if (!calls || calls.length === 0) {
      return NextResponse.json({ error: 'Seller not found' }, { status: 404 })
    }

    // Fetch behavioral data from new tables
    const [profileResult, metricsResult, categoriesResult] = await Promise.all([
      supabase
        .from('seller_profiles')
        .select('*')
        .eq('glid', companyId)
        .single(),
      supabase
        .from('seller_monthly_metrics')
        .select('*')
        .eq('glid', companyId)
        .order('data_month', { ascending: true }),
      supabase
        .from('seller_categories')
        .select('mcat_id, mcat_name')
        .eq('glid', companyId)
        .limit(5)
    ])

    const sellerProfileData = profileResult.data
    const monthlyMetricsData = metricsResult.data || []
    const categoriesData = categoriesResult.data || []

    // Sort calls chronologically
    const sortedCalls = [...calls].sort(
      (a, b) => new Date(a.call_start_time || a.created_at).getTime() -
                new Date(b.call_start_time || b.created_at).getTime()
    )

    const firstCall = sortedCalls[0]
    const latestCall = sortedCalls[sortedCalls.length - 1]

    // Aggregate insights
    const insights = calls
      .map(c => c.call_insights?.[0])
      .filter(Boolean)

    // Calculate metrics
    const churnScores = insights
      .map(i => i.churn_risk_score)
      .filter((s): s is number => s !== null && s !== undefined)
    const avgChurnRisk = churnScores.length > 0
      ? churnScores.reduce((a, b) => a + b, 0) / churnScores.length
      : 0

    const resolvedCount = insights.filter(i => i.resolution_status === 'resolved').length
    const resolutionRate = insights.length > 0
      ? (resolvedCount / insights.length) * 100
      : 0

    const durations = calls
      .map(c => c.call_duration_seconds)
      .filter((d): d is number => d !== null && d !== undefined)
    const avgDuration = durations.length > 0
      ? durations.reduce((a, b) => a + b, 0) / durations.length
      : 0

    // Sentiment trend
    const determineSentimentTrend = (): 'improving' | 'declining' | 'stable' => {
      if (sortedCalls.length < 2) return 'stable'

      const sentimentValues: Record<string, number> = {
        'positive': 1, 'neutral': 0, 'negative': -1, 'frustrated': -1.5, 'angry': -2
      }

      const midpoint = Math.floor(sortedCalls.length / 2)
      const firstHalf = sortedCalls.slice(0, midpoint)
      const secondHalf = sortedCalls.slice(midpoint)

      const getAvgSentiment = (callsGroup: any[]) => {
        const scores = callsGroup
          .filter(c => c.call_insights?.[0]?.sentiment_end)
          .map(c => sentimentValues[c.call_insights[0].sentiment_end.toLowerCase()] || 0)
        return scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0
      }

      const diff = getAvgSentiment(secondHalf) - getAvgSentiment(firstHalf)
      if (diff > 0.3) return 'improving'
      if (diff < -0.3) return 'declining'
      return 'stable'
    }

    // Issue analysis with subcategory tracking
    const issueOccurrences: Record<string, {
      count: number
      first_seen: string
      last_seen: string
      subcategories: Array<{ subcategory: string; call_date: string; call_number: number }>
    }> = {}
    let totalIssues = 0

    sortedCalls.forEach((call, callIndex) => {
      const insight = call.call_insights?.[0]
      if (!insight?.issues) return

      let issues = insight.issues
      if (typeof issues === 'string') {
        try { issues = JSON.parse(issues) } catch { return }
      }

      if (Array.isArray(issues)) {
        totalIssues += issues.length

        // Track categories already counted for THIS call - count each category only once per call
        const categoriesCountedThisCall = new Set<string>()

        issues.forEach((issue: any) => {
          const cat = issue.category || 'other'
          const subcat = issue.subcategory || 'general'
          const callDate = call.call_start_time || call.created_at

          if (!issueOccurrences[cat]) {
            issueOccurrences[cat] = {
              count: 0,
              first_seen: callDate,
              last_seen: callDate,
              subcategories: []
            }
          }

          // Only increment count once per category per call
          if (!categoriesCountedThisCall.has(cat)) {
            issueOccurrences[cat].count++
            categoriesCountedThisCall.add(cat)
          }

          issueOccurrences[cat].last_seen = callDate
          // Still track ALL subcategories for hover tooltip
          issueOccurrences[cat].subcategories.push({
            subcategory: subcat,
            call_date: callDate,
            call_number: callIndex + 1
          })
        })
      }
    })

    const recurringIssues = Object.entries(issueOccurrences)
      .filter(([_, data]) => data.count >= 2)
      .sort((a, b) => b[1].count - a[1].count)
      .map(([category, data]) => ({
        category,
        count: data.count,
        first_seen: data.first_seen,
        last_seen: data.last_seen,
        subcategories: data.subcategories
      }))

    // Find sticky issues (appearing in 3+ consecutive calls)
    const findStickyIssues = (): string[] => {
      const issueStreaks: Record<string, number[]> = {}

      sortedCalls.forEach((call, index) => {
        const insight = call.call_insights?.[0]
        if (!insight?.issues) return

        let issues = insight.issues
        if (typeof issues === 'string') {
          try { issues = JSON.parse(issues) } catch { return }
        }

        if (Array.isArray(issues)) {
          issues.forEach((issue: any) => {
            const category = issue.category || 'unknown'
            if (!issueStreaks[category]) issueStreaks[category] = []
            issueStreaks[category].push(index)
          })
        }
      })

      const stickyIssues: string[] = []
      Object.entries(issueStreaks).forEach(([category, indices]) => {
        if (indices.length >= 3) {
          stickyIssues.push(category)
        }
      })

      return stickyIssues
    }

    // Risk assessment
    const escalationCount = insights.filter(i => i.escalation_threatened).length
    const deactivationCount = insights.filter(i => i.deactivation_intent).length
    const paymentDisputeCount = insights.filter(i => i.payment_dispute).length

    // Health score calculation
    const sentimentTrend = determineSentimentTrend()
    const stickyIssues = findStickyIssues()

    let healthScore = 50
    if (sentimentTrend === 'improving') healthScore += 25
    else if (sentimentTrend === 'stable') healthScore += 15
    else if (sentimentTrend === 'declining') healthScore -= 10
    healthScore += resolutionRate * 0.25
    healthScore -= avgChurnRisk * 25
    healthScore -= Math.min(stickyIssues.length * 5, 20)
    healthScore = Math.max(0, Math.min(100, Math.round(healthScore)))

    // Risk level
    let riskLevel: 'low' | 'medium' | 'high' = 'low'
    if (avgChurnRisk >= 0.7 || healthScore < 30) riskLevel = 'high'
    else if (avgChurnRisk >= 0.4 || healthScore < 60) riskLevel = 'medium'

    // Days since last call
    const lastCallDate = new Date(latestCall.call_start_time || latestCall.created_at)
    const daysSinceLastCall = Math.floor(
      (Date.now() - lastCallDate.getTime()) / (1000 * 60 * 60 * 24)
    )

    // Calculate calls per month
    const firstCallDate = new Date(firstCall.call_start_time || firstCall.created_at)
    const monthsSpan = Math.max(1, (lastCallDate.getTime() - firstCallDate.getTime()) / (1000 * 60 * 60 * 24 * 30))
    const avgCallsPerMonth = calls.length / monthsSpan

    // Build call timeline
    const callTimeline: CallTimelineEntry[] = sortedCalls.map(call => {
      const insight = call.call_insights?.[0]

      let issues = insight?.issues || []
      if (typeof issues === 'string') {
        try { issues = JSON.parse(issues) } catch { issues = [] }
      }

      let topics = insight?.topics || []
      if (typeof topics === 'string') {
        try { topics = JSON.parse(topics) } catch { topics = [] }
      }

      const riskSignals: string[] = []
      if (insight?.deactivation_intent) riskSignals.push('Deactivation Intent')
      if (insight?.refund_requested) riskSignals.push('Refund Requested')
      if (insight?.escalation_threatened) riskSignals.push('Escalation Threatened')
      if (insight?.payment_dispute) riskSignals.push('Payment Dispute')
      if (insight?.legal_threat) riskSignals.push('Legal Threat')

      return {
        call_id: call.id,
        ucid: call.ucid,
        date: call.call_start_time || call.created_at,
        duration_seconds: call.call_duration_seconds || 0,
        employee_name: call.employee_name || 'Unknown',
        sentiment_start: insight?.sentiment_start || 'unknown',
        sentiment_end: insight?.sentiment_end || 'unknown',
        sentiment_trajectory: insight?.sentiment_trajectory || 'unknown',
        churn_risk_score: insight?.churn_risk_score || 0,
        resolution_status: insight?.resolution_status || 'unknown',
        call_purpose: insight?.call_purpose || 'unknown',
        issues: Array.isArray(issues) ? issues.map((i: any) => ({
          category: i.category || 'other',
          subcategory: i.subcategory || '',
          description: i.description || '',
          severity: i.severity || 'medium'
        })) : [],
        risk_signals: riskSignals,
        topics: Array.isArray(topics) ? topics : [],
        key_quotes: insight?.key_quotes || null,
        executive_tone: insight?.executive_tone || 'unknown',
        recording_url: call.call_recording_url || null
      }
    })

    // Build profile
    const profile: SellerProfile = {
      company_id: companyId,
      company_name: firstCall.company_name || 'Unknown',
      total_calls: calls.length,
      date_range: {
        first_call: firstCall.call_start_time || firstCall.created_at,
        latest_call: latestCall.call_start_time || latestCall.created_at
      },
      communication_fingerprint: {
        avg_call_duration: Math.round(avgDuration),
        preferred_language: 'Hindi/English', // Could be enhanced with actual language detection
        tone_consistency: calculateToneConsistency(calls),
        responsiveness_pattern: daysSinceLastCall < 14 ? 'active' : daysSinceLastCall < 30 ? 'moderate' : 'inactive'
      },
      health_metrics: {
        health_score: healthScore,
        sentiment_trend: sentimentTrend,
        avg_churn_risk: Math.round(avgChurnRisk * 100) / 100,
        resolution_rate: Math.round(resolutionRate)
      },
      issue_analysis: {
        total_issues: totalIssues,
        recurring_issues: recurringIssues,
        resolved_issues: resolvedCount,
        sticky_issues: stickyIssues
      },
      risk_assessment: {
        risk_level: riskLevel,
        churn_probability: Math.round(avgChurnRisk * 100) / 100,
        escalation_history: escalationCount,
        deactivation_mentions: deactivationCount,
        payment_disputes: paymentDisputeCount
      },
      engagement_metrics: {
        days_since_last_call: daysSinceLastCall,
        avg_calls_per_month: Math.round(avgCallsPerMonth * 10) / 10,
        call_frequency_trend: calculateCallFrequencyTrend(calls)
      },
      call_timeline: callTimeline,
      recommendations: [],
      // Behavioral data
      behavioral_profile: sellerProfileData ? {
        vintage_months: sellerProfileData.vintage_months,
        highest_service: sellerProfileData.highest_service,
        bl_active_days: sellerProfileData.bl_active_days,
        pns_calls_received: sellerProfileData.pns_calls_received,
        pns_calls_answered: sellerProfileData.pns_calls_answered,
        pns_response_rate: sellerProfileData.pns_response_rate,
        location_preference: sellerProfileData.location_preference,
        category_rank: sellerProfileData.category_rank,
        category_count: sellerProfileData.category_count,
        repeat_30d: sellerProfileData.repeat_30d,
        repeat_60d: sellerProfileData.repeat_60d
      } : null,
      monthly_metrics: monthlyMetricsData.map(m => ({
        data_month: m.data_month,
        pns_defaulter_count: m.pns_defaulter_count || 0,
        fresh_lead_consumption: m.fresh_lead_consumption || 0,
        wrong_product_count: m.wrong_product_count || 0,
        cqs_score: m.cqs_score,
        ba_rank: m.ba_rank,
        cc_rank: m.cc_rank,
        negative_cities_count: m.negative_cities_count || 0,
        pref_city: m.pref_city || 0,
        pref_state: m.pref_state || 0,
        pref_country: m.pref_country || 0
      })),
      top_categories: categoriesData.map(c => ({
        mcat_id: c.mcat_id,
        mcat_name: c.mcat_name
      })),
      behavioral_insights: calculateBehavioralInsights(sellerProfileData, monthlyMetricsData),
      // New behavioral enhancements
      behavior_classification: classifySellerBehavior(
        sellerProfileData,
        monthlyMetricsData,
        calculateBehavioralInsights(sellerProfileData, monthlyMetricsData)
      ),
      historical_trends: calculateHistoricalTrends(monthlyMetricsData),
      interlinked_insights: generateInterlinkedInsights(
        sellerProfileData,
        monthlyMetricsData,
        calculateBehavioralInsights(sellerProfileData, monthlyMetricsData)
      ),
      engagement_patterns: analyzeEngagementPatterns(calls)
    }

    // Generate recommendations
    profile.recommendations = generateRecommendations(profile)

    return NextResponse.json(profile)
  } catch (error) {
    console.error('Error fetching seller profile:', error)
    return NextResponse.json({ error: 'Failed to fetch seller profile' }, { status: 500 })
  }
}
