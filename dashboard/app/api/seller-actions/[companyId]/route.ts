import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

// Disable caching to always get fresh data
export const dynamic = 'force-dynamic'
export const revalidate = 0

interface ActionItem {
  id: string
  category: 'geography' | 'categories' | 'leads' | 'profile'
  priority: 'high' | 'medium' | 'low'
  title: string
  description: string
  impact: string
  howToFix: string
  metric?: {
    current: number | string
    target?: number | string
    unit?: string
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ companyId: string }> }
) {
  try {
    const { companyId } = await params

    // Fetch seller profile data
    const { data: profile, error: profileError } = await supabase
      .from('seller_profiles')
      .select('*')
      .eq('glid', companyId)
      .single()

    if (profileError && profileError.code !== 'PGRST116') {
      console.error('Profile fetch error:', profileError)
    }

    // Fetch latest monthly metrics
    const { data: metrics, error: metricsError } = await supabase
      .from('seller_monthly_metrics')
      .select('*')
      .eq('glid', companyId)
      .order('month_year', { ascending: false })
      .limit(2)

    if (metricsError) {
      console.error('Metrics fetch error:', metricsError)
    }

    // Fetch call insights for this seller
    const { data: calls, error: callsError } = await supabase
      .from('call_insights')
      .select('*')
      .eq('glid', companyId)
      .order('call_date', { ascending: false })
      .limit(10)

    if (callsError) {
      console.error('Calls fetch error:', callsError)
    }

    const latestMetrics = metrics?.[0] || {}
    const previousMetrics = metrics?.[1] || {}

    // Calculate overall health score
    const healthScore = calculateHealthScore(latestMetrics, calls || [])

    // Generate action items based on data
    const actionItems = generateActionItems(profile, latestMetrics, previousMetrics, calls || [])

    // Calculate category health
    const categoryHealth = {
      total: (latestMetrics.ba_rank || 0) + (latestMetrics.cc_rank || 0) + 5, // Estimate total
      active: Math.max(5 - (latestMetrics.ba_rank || 0) - (latestMetrics.cc_rank || 0), 1),
      lowActivity: latestMetrics.ba_rank || 0,
      zeroConsumption: latestMetrics.cc_rank || 0
    }

    // Geographic status
    const geoPreference = profile?.geo_preference || latestMetrics.geo_preference || 'Local'
    const geographicStatus = {
      currentPreference: geoPreference,
      blockedCities: latestMetrics.blocked_cities || 0,
      canExpand: geoPreference === 'Local' || geoPreference === 'Regional',
      expansionPotential: getExpansionPotential(geoPreference, latestMetrics)
    }

    // Lead engagement
    const leadEngagement = {
      freshConsumption: latestMetrics.fresh_consumption || 0,
      pnsResponseRate: calculatePNSRate(latestMetrics),
      cqsScore: latestMetrics.cqs_score || 0
    }

    const response = {
      glid: companyId,
      companyName: profile?.company_name || `Seller ${companyId}`,
      overallScore: healthScore,
      actionItems,
      categoryHealth,
      geographicStatus,
      leadEngagement
    }

    return NextResponse.json(response)

  } catch (error) {
    console.error('Error in seller-actions API:', error)
    return NextResponse.json(
      { error: 'Failed to fetch seller actions' },
      { status: 500 }
    )
  }
}

function calculateHealthScore(metrics: Record<string, unknown>, calls: Record<string, unknown>[]): number {
  let score = 50 // Base score

  // Fresh consumption bonus
  const freshConsumption = (metrics.fresh_consumption as number) || 0
  if (freshConsumption >= 20) score += 15
  else if (freshConsumption >= 10) score += 10
  else if (freshConsumption >= 5) score += 5

  // PNS defaulter penalty
  const pnsDefaulter = (metrics.pns_defaulter as number) || 0
  if (pnsDefaulter >= 3) score -= 15
  else if (pnsDefaulter >= 1) score -= 5

  // Category health penalty
  const baRank = (metrics.ba_rank as number) || 0
  const ccRank = (metrics.cc_rank as number) || 0
  score -= Math.min(baRank * 3, 15)
  score -= Math.min(ccRank * 5, 20)

  // CQS bonus
  const cqsScore = (metrics.cqs_score as number) || 0
  if (cqsScore >= 80) score += 10
  else if (cqsScore >= 60) score += 5

  // Call resolution bonus
  const resolvedCalls = calls.filter(c => c.resolution_status === 'resolved').length
  const resolutionRate = calls.length > 0 ? (resolvedCalls / calls.length) * 100 : 50
  score += Math.round(resolutionRate * 0.1)

  return Math.max(0, Math.min(100, Math.round(score)))
}

function generateActionItems(
  profile: Record<string, unknown> | null,
  currentMetrics: Record<string, unknown>,
  previousMetrics: Record<string, unknown>,
  calls: Record<string, unknown>[]
): ActionItem[] {
  const actions: ActionItem[] = []

  // Check geographic expansion opportunity
  const geoPreference = (profile?.geo_preference as string) || (currentMetrics.geo_preference as string) || 'Local'
  if (geoPreference === 'Local') {
    actions.push({
      id: 'geo-expand-regional',
      category: 'geography',
      priority: 'high',
      title: 'Expand to Regional Market',
      description: 'Your business is currently limited to local buyers only. Expanding to regional markets can significantly increase your lead volume.',
      impact: 'Potential 40-60% increase in buyer inquiries from nearby cities and states.',
      howToFix: '1. Go to Seller Panel > Settings > Geographic Preferences\n2. Change from "Local" to "Regional"\n3. Review and confirm the expanded service areas\n4. Update your delivery/shipping terms if needed',
      metric: {
        current: 'Local',
        target: 'Regional'
      }
    })
  } else if (geoPreference === 'Regional') {
    actions.push({
      id: 'geo-expand-national',
      category: 'geography',
      priority: 'medium',
      title: 'Consider National Expansion',
      description: 'You\'re serving regional markets. Going national can open up pan-India opportunities.',
      impact: 'Access to buyers from all states, potential 2-3x lead volume increase.',
      howToFix: '1. Go to Seller Panel > Settings > Geographic Preferences\n2. Change from "Regional" to "National"\n3. Ensure you can handle logistics across India\n4. Consider partnering with logistics providers',
      metric: {
        current: 'Regional',
        target: 'National'
      }
    })
  }

  // Check blocked cities
  const blockedCities = (currentMetrics.blocked_cities as number) || 0
  if (blockedCities > 3) {
    actions.push({
      id: 'unblock-cities',
      category: 'geography',
      priority: 'medium',
      title: 'Review Blocked Cities',
      description: `You have ${blockedCities} cities blocked. This limits your potential buyer reach.`,
      impact: 'Each unblocked city can bring new buyer inquiries from that region.',
      howToFix: '1. Go to Seller Panel > Settings > Blocked Cities\n2. Review each blocked city\n3. Unblock cities where you can now serve\n4. Consider logistics partnerships for difficult locations',
      metric: {
        current: blockedCities,
        target: 0,
        unit: ' cities blocked'
      }
    })
  }

  // Check low-activity categories
  const baRank = (currentMetrics.ba_rank as number) || 0
  if (baRank > 0) {
    actions.push({
      id: 'low-activity-categories',
      category: 'categories',
      priority: baRank >= 3 ? 'high' : 'medium',
      title: 'Activate Low-Activity Categories',
      description: `You have ${baRank} categories with only 1 transaction in last 6 months. These need attention.`,
      impact: 'Active categories attract more relevant leads and improve your visibility.',
      howToFix: '1. Go to Seller Panel > Products > Categories\n2. Identify categories with low activity\n3. Add more products or update existing ones\n4. If not relevant, consider removing the category',
      metric: {
        current: baRank,
        target: 0,
        unit: ' low-activity categories'
      }
    })
  }

  // Check zero-consumption categories
  const ccRank = (currentMetrics.cc_rank as number) || 0
  if (ccRank > 0) {
    actions.push({
      id: 'zero-consumption-categories',
      category: 'categories',
      priority: 'high',
      title: 'Fix Zero-Consumption Categories',
      description: `You have ${ccRank} categories with no lead consumption. These categories are not generating business.`,
      impact: 'Either activate these categories or remove them to focus on what works.',
      howToFix: '1. Go to Seller Panel > Products > Categories\n2. Find categories with zero consumption\n3. Option A: Add quality products with good images and descriptions\n4. Option B: Remove irrelevant categories to streamline your catalog',
      metric: {
        current: ccRank,
        target: 0,
        unit: ' zero-consumption categories'
      }
    })
  }

  // Check CQS score - 80 is industry benchmark for good visibility
  const cqsScore = (currentMetrics.cqs_score as number) || 0
  if (cqsScore > 0 && cqsScore < 70) {
    actions.push({
      id: 'improve-cqs',
      category: 'profile',
      priority: cqsScore < 50 ? 'high' : 'medium',
      title: 'Improve Catalog Quality Score',
      description: `Your catalog quality score is ${cqsScore}. A higher score means better visibility in search results.`,
      impact: 'Sellers with higher CQS typically get more visibility in buyer searches.',
      howToFix: '1. Add high-quality product images (multiple angles)\n2. Write detailed product descriptions\n3. Include specifications and features\n4. Add competitive pricing\n5. Respond to buyer queries promptly',
      metric: {
        current: cqsScore,
        target: '70+',
        unit: ' (benchmark)'
      }
    })
  }

  // Check PNS defaulter
  const pnsDefaulter = (currentMetrics.pns_defaulter as number) || 0
  if (pnsDefaulter >= 2) {
    actions.push({
      id: 'improve-pns',
      category: 'leads',
      priority: 'high',
      title: 'Improve Call Answer Rate',
      description: `You've missed ${pnsDefaulter} PNS calls this month. Missing buyer calls means lost business.`,
      impact: 'Each missed call is a potential lost sale. Answering calls can increase conversions by 50%.',
      howToFix: '1. Keep your registered phone accessible during business hours\n2. Set up call forwarding if you\'re busy\n3. Consider adding alternate contact numbers\n4. Check your PNS settings in Seller Panel',
      metric: {
        current: pnsDefaulter,
        target: 0,
        unit: ' missed calls'
      }
    })
  }

  // Check fresh lead consumption - directional guidance only (no arbitrary targets)
  const freshConsumption = (currentMetrics.fresh_consumption as number) || 0
  const prevFreshConsumption = (previousMetrics.fresh_consumption as number) || 0

  // Only suggest if consumption is very low or declining significantly
  if (freshConsumption === 0) {
    actions.push({
      id: 'zero-consumption',
      category: 'leads',
      priority: 'high',
      title: 'Start Consuming Leads',
      description: 'You have not consumed any leads this month. Check your Lead Manager for available buyer inquiries.',
      impact: 'Leads are potential customers actively looking for your products/services.',
      howToFix: '1. Login to Seller Panel > Lead Manager\n2. Review available buyer inquiries\n3. Respond to relevant leads within 24 hours\n4. Contact your Account Manager if you need help with lead consumption',
      metric: {
        current: 0,
        unit: ' leads consumed'
      }
    })
  } else if (freshConsumption < prevFreshConsumption * 0.5 && prevFreshConsumption >= 5) {
    // Only flag if significant decline (50%+) from a meaningful baseline
    actions.push({
      id: 'consumption-declining',
      category: 'leads',
      priority: 'medium',
      title: 'Lead Consumption Declining',
      description: `Your lead consumption dropped significantly from ${prevFreshConsumption} to ${freshConsumption} this month.`,
      impact: 'Consistent lead engagement helps maintain business momentum.',
      howToFix: '1. Review your Lead Manager for pending inquiries\n2. Set daily reminders to check new leads\n3. Improve response time to buyer queries\n4. Check if your categories and geography settings are optimal',
      metric: {
        current: freshConsumption,
        unit: ' leads (down from ' + prevFreshConsumption + ')'
      }
    })
  }

  // Sort by priority
  const priorityOrder = { high: 0, medium: 1, low: 2 }
  actions.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority])

  return actions
}

function getExpansionPotential(geoPreference: string, metrics: Record<string, unknown>): string {
  const freshConsumption = (metrics.fresh_consumption as number) || 0

  if (geoPreference === 'Local') {
    if (freshConsumption >= 10) {
      return 'You have strong local performance. Expanding to Regional can multiply your leads significantly.'
    }
    return 'Consider expanding to Regional markets once you establish strong local presence.'
  } else if (geoPreference === 'Regional') {
    if (freshConsumption >= 15) {
      return 'Your regional business is thriving. National expansion could open pan-India opportunities.'
    }
    return 'Build stronger regional presence before considering national expansion.'
  }
  return 'You are already serving national markets. Focus on category and product optimization.'
}

function calculatePNSRate(metrics: Record<string, unknown>): string {
  const pnsDefaulter = (metrics.pns_defaulter as number) || 0
  const freshConsumption = (metrics.fresh_consumption as number) || 1

  // Estimate total PNS calls as roughly 2x fresh consumption
  const estimatedCalls = freshConsumption * 2
  const answered = Math.max(estimatedCalls - pnsDefaulter, 0)
  const rate = estimatedCalls > 0 ? Math.round((answered / estimatedCalls) * 100) : 100

  return `${rate}%`
}
