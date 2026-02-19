import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

// Disable caching to always get fresh data
export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET() {
  try {
    // Get total calls count
    const { count: totalCalls, error: callsError } = await supabase
      .from('calls')
      .select('*', { count: 'exact', head: true })

    if (callsError) throw callsError

    // Get all insights for aggregation (with higher limit to avoid Supabase's default 1000 limit)
    const { data: insights, error: insightsError } = await supabase
      .from('call_insights')
      .select('churn_risk_score, deactivation_intent, resolution_status')
      .limit(10000)

    if (insightsError) throw insightsError

    const processedCalls = insights?.length || 0
    const highRiskCalls = insights?.filter(i => (i.churn_risk_score || 0) >= 0.7).length || 0
    const deactivationIntents = insights?.filter(i => i.deactivation_intent).length || 0
    const resolvedCalls = insights?.filter(i => i.resolution_status === 'resolved').length || 0

    const avgChurnRisk = processedCalls > 0
      ? insights!.reduce((sum, i) => sum + (i.churn_risk_score || 0), 0) / processedCalls
      : 0

    const resolutionRate = processedCalls > 0
      ? (resolvedCalls / processedCalls) * 100
      : 0

    return NextResponse.json({
      total_calls: totalCalls || 0,
      processed_calls: processedCalls,
      high_risk_calls: highRiskCalls,
      deactivation_intents: deactivationIntents,
      resolved_calls: resolvedCalls,
      resolution_rate: Math.round(resolutionRate * 10) / 10,
      avg_churn_risk: Math.round(avgChurnRisk * 100) / 100
    })
  } catch (error) {
    console.error('Error fetching stats:', error)
    return NextResponse.json({ error: 'Failed to fetch stats' }, { status: 500 })
  }
}
