import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

// Disable caching to always get fresh data
export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET() {
  try {
    // Get all insights with call info (with higher limit to avoid Supabase's default 1000 limit)
    const { data: insights, error: insightsError } = await supabase
      .from('call_insights')
      .select(`
        *,
        calls (
          ucid,
          call_duration_seconds,
          employee_name,
          company_name,
          module
        )
      `)
      .order('created_at', { ascending: false })
      .limit(10000)

    if (insightsError) throw insightsError

    // Get all issues (with higher limit to get accurate count)
    const { data: issues, error: issuesError } = await supabase
      .from('call_issues')
      .select(`
        *,
        calls (ucid, company_name)
      `)
      .order('created_at', { ascending: false })
      .limit(10000)

    if (issuesError) throw issuesError

    // Get actual total count of issues
    const { count: totalIssuesCount, error: countError } = await supabase
      .from('call_issues')
      .select('*', { count: 'exact', head: true })

    if (countError) console.error('Error getting issues count:', countError)

    // === PATTERN ANALYSIS ===

    // 1. Issue Category Distribution
    const categoryDistribution: Record<string, number> = {}
    const categoryBySeverity: Record<string, Record<string, number>> = {}

    issues?.forEach(issue => {
      const cat = issue.category || 'other'
      const sev = issue.severity || 'medium'
      categoryDistribution[cat] = (categoryDistribution[cat] || 0) + 1

      if (!categoryBySeverity[cat]) categoryBySeverity[cat] = {}
      categoryBySeverity[cat][sev] = (categoryBySeverity[cat][sev] || 0) + 1
    })

    // Sort by count
    const topCategories = Object.entries(categoryDistribution)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([category, count]) => ({
        category,
        count,
        severityBreakdown: categoryBySeverity[category] || {}
      }))

    // 2. Severity Distribution
    const severityDistribution: Record<string, number> = {}
    issues?.forEach(issue => {
      const sev = issue.severity || 'medium'
      severityDistribution[sev] = (severityDistribution[sev] || 0) + 1
    })

    // 3. Sentiment Journey Analysis
    const sentimentJourneys: Record<string, number> = {}
    const sentimentStart: Record<string, number> = {}
    const sentimentEnd: Record<string, number> = {}

    insights?.forEach(insight => {
      const start = insight.sentiment_start || 'neutral'
      const end = insight.sentiment_end || 'neutral'
      const journey = `${start} → ${end}`

      sentimentJourneys[journey] = (sentimentJourneys[journey] || 0) + 1
      sentimentStart[start] = (sentimentStart[start] || 0) + 1
      sentimentEnd[end] = (sentimentEnd[end] || 0) + 1
    })

    // 4. Resolution Analysis
    const resolutionStatus: Record<string, number> = {}
    const purposeFulfilled = { yes: 0, no: 0, unclear: 0 }

    insights?.forEach(insight => {
      const status = insight.resolution_status || 'unknown'
      resolutionStatus[status] = (resolutionStatus[status] || 0) + 1

      if (insight.purpose_fulfilled === true) purposeFulfilled.yes++
      else if (insight.purpose_fulfilled === false) purposeFulfilled.no++
      else purposeFulfilled.unclear++
    })

    // 5. Risk Signals Summary
    const riskSignals = {
      deactivation_intent: insights?.filter(i => i.deactivation_intent).length || 0,
      deactivation_confirmed: insights?.filter(i => i.deactivation_confirmed).length || 0,
      refund_requested: insights?.filter(i => i.refund_requested).length || 0,
      escalation_threatened: insights?.filter(i => i.escalation_threatened).length || 0,
      legal_threat: insights?.filter(i => i.legal_threat).length || 0,
      payment_dispute: insights?.filter(i => i.payment_dispute).length || 0,
      competitor_mentioned: insights?.filter(i => i.competitor_mentioned).length || 0
    }

    // 6. Executive Tone Distribution
    const executiveTones: Record<string, number> = {}
    insights?.forEach(insight => {
      const tone = insight.executive_tone || 'unknown'
      executiveTones[tone] = (executiveTones[tone] || 0) + 1
    })

    // 7. Top Critical Issues with UCIDs
    const criticalIssues = issues
      ?.filter(i => i.severity === 'critical' || i.severity === 'high')
      .slice(0, 20)
      .map(issue => ({
        ucid: issue.calls?.ucid || 'N/A',
        company: issue.calls?.company_name || 'Unknown',
        category: issue.category,
        subcategory: issue.subcategory,
        description: issue.description,
        severity: issue.severity,
        mentioned_by: issue.mentioned_by
      })) || []

    // 8. High Churn Risk Calls with Details
    const highChurnCalls = insights
      ?.filter(i => (i.churn_risk_score || 0) >= 0.6)
      .sort((a, b) => (b.churn_risk_score || 0) - (a.churn_risk_score || 0))
      .slice(0, 15)
      .map(insight => ({
        ucid: insight.calls?.ucid || 'N/A',
        company: insight.calls?.company_name || 'Unknown',
        employee: insight.calls?.employee_name || 'Unknown',
        churn_risk: insight.churn_risk_score,
        sentiment: `${insight.sentiment_start} → ${insight.sentiment_end}`,
        resolution: insight.resolution_status,
        deactivation_intent: insight.deactivation_intent,
        key_signals: [
          insight.deactivation_intent && 'Deactivation Intent',
          insight.refund_requested && 'Refund Requested',
          insight.escalation_threatened && 'Escalation Threat',
          insight.legal_threat && 'Legal Threat',
          insight.payment_dispute && 'Payment Dispute'
        ].filter(Boolean)
      })) || []

    // 9. Call Purpose Distribution
    const callPurposes: Record<string, number> = {}
    insights?.forEach(insight => {
      const purpose = insight.call_purpose || 'other'
      callPurposes[purpose] = (callPurposes[purpose] || 0) + 1
    })

    // 10. Topics Analysis
    const topicsCount: Record<string, number> = {}
    insights?.forEach(insight => {
      try {
        const topics = typeof insight.topics === 'string'
          ? JSON.parse(insight.topics)
          : insight.topics
        if (Array.isArray(topics)) {
          topics.forEach((topic: string) => {
            const t = topic.toLowerCase().trim()
            topicsCount[t] = (topicsCount[t] || 0) + 1
          })
        }
      } catch {}
    })

    const topTopics = Object.entries(topicsCount)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 15)
      .map(([topic, count]) => ({ topic, count }))

    // 11. Key Quotes from high-risk calls
    const keyQuotes = insights
      ?.filter(i => (i.churn_risk_score || 0) >= 0.5)
      .slice(0, 10)
      .map(insight => {
        try {
          const quotes = typeof insight.key_quotes === 'string'
            ? JSON.parse(insight.key_quotes)
            : insight.key_quotes
          return {
            ucid: insight.calls?.ucid?.slice(0, 8) || 'N/A',
            company: insight.calls?.company_name || 'Unknown',
            churn_risk: insight.churn_risk_score,
            main_complaint: quotes?.main_complaint || null,
            customer_ask: quotes?.customer_ask || null,
            notable: quotes?.notable_statement || null
          }
        } catch {
          return null
        }
      })
      .filter(q => q && (q.main_complaint || q.customer_ask)) || []

    // 12. Follow-up Required Analysis
    const followUpAnalysis = {
      required: insights?.filter(i => i.follow_up_required).length || 0,
      by_executive: insights?.filter(i => i.follow_up_owner === 'executive').length || 0,
      by_customer: insights?.filter(i => i.follow_up_owner === 'customer').length || 0,
      pending: insights?.filter(i => i.follow_up_required && i.resolution_status !== 'resolved').length || 0
    }

    return NextResponse.json({
      summary: {
        total_calls: insights?.length || 0,
        total_issues: totalIssuesCount || issues?.length || 0,
        critical_issues: issues?.filter(i => i.severity === 'critical').length || 0,
        high_risk_calls: insights?.filter(i => (i.churn_risk_score || 0) >= 0.7).length || 0
      },
      categoryDistribution: topCategories,
      severityDistribution,
      sentimentAnalysis: {
        journeys: Object.entries(sentimentJourneys)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 10)
          .map(([journey, count]) => ({ journey, count })),
        startDistribution: sentimentStart,
        endDistribution: sentimentEnd
      },
      resolutionAnalysis: {
        statusDistribution: resolutionStatus,
        purposeFulfilled
      },
      riskSignals,
      executiveTones,
      criticalIssues,
      highChurnCalls,
      callPurposes,
      topTopics,
      keyQuotes,
      followUpAnalysis
    })
  } catch (error) {
    console.error('Error fetching patterns:', error)
    return NextResponse.json({ error: 'Failed to fetch patterns' }, { status: 500 })
  }
}
