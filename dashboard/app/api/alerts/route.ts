import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

// Disable caching to always get fresh data
export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const limit = parseInt(searchParams.get('limit') || '50')

    // Get high risk calls with full details including recording URL
    const { data: alerts, error } = await supabase
      .from('call_insights')
      .select(`
        *,
        calls (
          id,
          ucid,
          call_start_time,
          employee_name,
          employee_id,
          customer_mobile,
          company_name,
          company_id,
          call_duration_seconds,
          call_direction,
          call_recording_url,
          vertical_name
        ),
        call_transcripts (
          id,
          transcript,
          translation
        )
      `)
      .or('churn_risk_score.gte.0.7,deactivation_intent.eq.true,escalation_threatened.eq.true,legal_threat.eq.true')
      .order('churn_risk_score', { ascending: false })
      .limit(limit)

    if (error) throw error

    // Categorize alerts
    const categorizedAlerts = (alerts || []).map(alert => {
      const alertTypes: string[] = []

      if (alert.churn_risk_score >= 0.7) alertTypes.push('HIGH_CHURN_RISK')
      if (alert.deactivation_intent) alertTypes.push('DEACTIVATION_INTENT')
      if (alert.deactivation_confirmed) alertTypes.push('DEACTIVATION_CONFIRMED')
      if (alert.escalation_threatened) alertTypes.push('ESCALATION_THREAT')
      if (alert.legal_threat) alertTypes.push('LEGAL_THREAT')
      if (alert.refund_requested) alertTypes.push('REFUND_REQUEST')
      if (alert.payment_dispute) alertTypes.push('PAYMENT_DISPUTE')

      return {
        ...alert,
        alert_types: alertTypes,
        severity: alert.legal_threat ? 'critical'
          : alert.deactivation_confirmed ? 'critical'
          : alert.churn_risk_score >= 0.8 ? 'high'
          : 'medium'
      }
    })

    return NextResponse.json({
      alerts: categorizedAlerts,
      summary: {
        total: categorizedAlerts.length,
        critical: categorizedAlerts.filter(a => a.severity === 'critical').length,
        high: categorizedAlerts.filter(a => a.severity === 'high').length,
        medium: categorizedAlerts.filter(a => a.severity === 'medium').length
      }
    })
  } catch (error) {
    console.error('Error fetching alerts:', error)
    return NextResponse.json({ error: 'Failed to fetch alerts' }, { status: 500 })
  }
}
