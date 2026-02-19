import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

// Disable caching
export const dynamic = 'force-dynamic'
export const revalidate = 0

// SOP mapping for issues that don't have RAG recommendations
const DEFAULT_SOP_GUIDANCE: Record<string, string> = {
  'buylead_relevance': `
**BuyLead Relevance SOP:**
1. Check if categories are mapped correctly in Seller Panel
2. Review "Recommended Products" section
3. Ensure Catalog Quality Score (CQS) > 80%
4. Verify product descriptions, photos, and prices are complete
5. If still irrelevant, escalate to category mapping team
  `,
  'buylead_availability': `
**BuyLead Availability SOP:**
1. Check total approved BuyLeads in seller's categories
2. If < 10 leads available, explain low demand in category
3. Suggest adding more product categories
4. Guide seller to "Recommended Products" to expand catalog
5. Ask seller to check again next day after changes
  `,
  'buylead_roi': `
**BuyLead ROI SOP:**
1. Review seller's consumption pattern and conversion rate
2. Check if seller is using filters effectively
3. Verify seller is contacting leads promptly (within 1 hour)
4. Suggest GST-verified and membership leads for better quality
5. If persistent, discuss plan upgrade or category optimization
  `,
  'payment': `
**Payment Issue SOP:**
1. Verify payment status in backend system
2. Check for any pending refund requests
3. If double charge, initiate refund ticket immediately
4. For EMI issues, connect with finance team
5. Document all payment disputes with transaction IDs
  `,
  'subscription': `
**Subscription SOP:**
1. Explain current plan benefits clearly
2. For upgrade requests, show comparison of plans
3. For downgrade, check if any pending dues
4. For renewal issues, verify auto-renewal settings
5. For cancellation, follow Deactivation SOP
  `,
  'deactivation': `
**Deactivation SOP (CRITICAL):**
1. FIRST: Understand the root cause of deactivation request
2. Offer resolution for underlying issues
3. If service-related: Offer complimentary extension (max 1-2 months)
4. If BuyLead concern: Offer free leads (min 25, max 50)
5. If still wants to deactivate: Process as per policy
6. Document reason in ticket for retention analysis
  `,
  'technical': `
**Technical Issues SOP:**
1. Ask seller to log out and log in again
2. Try alternate browser (Chrome/Firefox)
3. On mobile: Reinstall or update the app
4. Clear cache and cookies
5. If persists: Raise technical support ticket
  `,
  'catalog': `
**Catalog Issues SOP:**
1. Check product visibility in search
2. Verify catalog quality score (target > 80%)
3. Ensure all required fields are filled
4. Check if products are in correct categories
5. For visibility issues, raise mapping ticket
  `,
  'employee': `
**Employee Complaint SOP:**
1. Apologize for any inconvenience caused
2. Document the specific complaint
3. Assure customer of internal review
4. Do NOT promise disciplinary action
5. Escalate to team lead if serious
  `
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const callId = searchParams.get('call_id')
    const limit = parseInt(searchParams.get('limit') || '20')

    // If specific call_id requested
    if (callId) {
      const { data: insight, error } = await supabase
        .from('call_insights')
        .select('raw_summary, calls(ucid, company_name)')
        .eq('call_id', callId)
        .single()

      if (error) throw error

      const rawSummary = typeof insight.raw_summary === 'string'
        ? JSON.parse(insight.raw_summary)
        : insight.raw_summary

      const sopRecommendations = rawSummary?.sop_recommendations || []
      const sopAlert = rawSummary?.sop_alert || null
      const issues = rawSummary?.issues || []

      // Enrich issues with SOP guidance
      const enrichedIssues = issues.map((issue: any) => ({
        ...issue,
        sop_guidance: sopRecommendations.find((s: any) => s.issue_category === issue.category)?.sop_guidance
          || DEFAULT_SOP_GUIDANCE[issue.category]
          || 'No specific SOP available for this issue category.'
      }))

      const callData = Array.isArray(insight.calls) ? insight.calls[0] : insight.calls

      return NextResponse.json({
        call_id: callId,
        ucid: callData?.ucid,
        company_name: callData?.company_name,
        sop_alert: sopAlert,
        issues_with_sop: enrichedIssues
      })
    }

    // Get all critical issues with SOP recommendations
    const { data: issues, error } = await supabase
      .from('call_issues')
      .select(`
        id,
        category,
        subcategory,
        description,
        severity,
        call_id,
        calls(ucid, company_name, company_id, city)
      `)
      .in('severity', ['critical', 'high'])
      .order('created_at', { ascending: false })
      .limit(limit)

    if (error) throw error

    // Add SOP guidance to each issue
    const issuesWithSOP = issues?.map(issue => ({
      ...issue,
      sop_guidance: DEFAULT_SOP_GUIDANCE[issue.category] || 'Refer to general escalation procedure.'
    }))

    // Get SOP alerts for high-risk calls
    const { data: alerts, error: alertsError } = await supabase
      .from('call_insights')
      .select(`
        call_id,
        churn_risk_score,
        deactivation_intent,
        raw_summary,
        calls(ucid, company_name, city)
      `)
      .or('deactivation_intent.eq.true,churn_risk_score.gte.0.8')
      .order('churn_risk_score', { ascending: false })
      .limit(10)

    if (alertsError) throw alertsError

    // Extract SOP alerts from raw_summary
    const sopAlerts = alerts?.map(alert => {
      const rawSummary = typeof alert.raw_summary === 'string'
        ? JSON.parse(alert.raw_summary)
        : alert.raw_summary

      const alertCallData = Array.isArray(alert.calls) ? alert.calls[0] : alert.calls

      // Get issues and generate CLEAN SOP recommendations (prefer DEFAULT_SOP_GUIDANCE)
      const issues = rawSummary?.issues || []
      const cleanSOPRecommendations = issues.map((issue: any) => {
        const category = issue.category || 'other'
        return {
          issue_category: category,
          sop_guidance: DEFAULT_SOP_GUIDANCE[category] || 'Refer to general escalation procedure.',
          reference: `SOP - ${category.replace(/_/g, ' ').toUpperCase()}`
        }
      }).filter((rec: any, index: number, self: any[]) =>
        // Remove duplicates by category
        index === self.findIndex(r => r.issue_category === rec.issue_category)
      )

      return {
        call_id: alert.call_id,
        ucid: alertCallData?.ucid,
        company_name: alertCallData?.company_name,
        city: alertCallData?.city,
        churn_risk: Math.round((alert.churn_risk_score || 0) * 100),
        deactivation_intent: alert.deactivation_intent,
        sop_alert: rawSummary?.sop_alert || {
          level: 'high',
          message: 'High churn risk detected. Follow Deactivation SOP - attempt retention before processing.',
          reference: 'Ticket SOP - Deactivation'
        },
        sop_recommendations: cleanSOPRecommendations
      }
    })

    return NextResponse.json({
      critical_issues_with_sop: issuesWithSOP,
      high_risk_sop_alerts: sopAlerts,
      available_sops: Object.keys(DEFAULT_SOP_GUIDANCE)
    })

  } catch (error) {
    console.error('Error fetching SOP recommendations:', error)
    return NextResponse.json({ error: 'Failed to fetch SOP recommendations' }, { status: 500 })
  }
}
