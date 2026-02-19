import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export const dynamic = 'force-dynamic'
export const revalidate = 0

// Clean SOP guidance - always use this instead of raw RAG text
const CLEAN_SOP: Record<string, { title: string; steps: string[] }> = {
  buylead_relevance: {
    title: "BuyLead Relevance Issue",
    steps: [
      "1. Check if categories are correctly mapped in Seller Panel",
      "2. Review 'Recommended Products' section",
      "3. Verify Catalog Quality Score (CQS) > 80%",
      "4. Ensure product descriptions, photos, prices are complete",
      "5. If still irrelevant, escalate to category mapping team"
    ]
  },
  buylead_availability: {
    title: "BuyLead Availability Issue",
    steps: [
      "1. Check total approved BuyLeads in seller's categories",
      "2. If < 10 leads available, explain low demand in category",
      "3. Suggest adding more product categories",
      "4. Guide to 'Recommended Products' to expand catalog",
      "5. Ask seller to check again after changes"
    ]
  },
  buylead_roi: {
    title: "BuyLead ROI/Conversion Issue",
    steps: [
      "1. Review seller's consumption pattern and conversion rate",
      "2. Check if seller is using filters effectively",
      "3. Verify seller contacts leads within 1 hour",
      "4. Suggest GST-verified and membership leads",
      "5. Discuss plan upgrade or category optimization"
    ]
  },
  payment: {
    title: "Payment Issue",
    steps: [
      "1. Verify payment status in backend system",
      "2. Check for pending refund requests",
      "3. If double charge, initiate refund ticket immediately",
      "4. For EMI issues, connect with finance team",
      "5. Document all disputes with transaction IDs"
    ]
  },
  deactivation: {
    title: "Deactivation Request (CRITICAL)",
    steps: [
      "1. FIRST: Understand root cause of deactivation request",
      "2. Offer resolution for underlying issues",
      "3. If service-related: Offer complimentary extension (max 1-2 months)",
      "4. If BuyLead concern: Offer free leads (min 25, max 50)",
      "5. If still wants to deactivate: Process as per policy",
      "6. Document reason for retention analysis"
    ]
  },
  employee: {
    title: "Employee Complaint",
    steps: [
      "1. Apologize for any inconvenience caused",
      "2. Document the specific complaint details",
      "3. Assure customer of internal review",
      "4. Do NOT promise disciplinary action",
      "5. Escalate to team lead if serious"
    ]
  },
  technical: {
    title: "Technical Issue",
    steps: [
      "1. Ask seller to log out and log in again",
      "2. Try alternate browser (Chrome/Firefox)",
      "3. On mobile: Reinstall or update the app",
      "4. Clear cache and cookies",
      "5. If persists: Raise technical support ticket"
    ]
  },
  pns: {
    title: "PNS (Calls) Issue",
    steps: [
      "1. Check if number is mapped under PNS settings",
      "2. Verify TrueCaller not blocking IM numbers",
      "3. For spam: Guide to press #1 during call to block",
      "4. Set time slots for office/non-office hours",
      "5. If persists: Raise internal ticket to PNS team"
    ]
  },
  catalog: {
    title: "Catalog Issue",
    steps: [
      "1. Check product visibility in search",
      "2. Verify catalog quality score (target > 80%)",
      "3. Ensure all required fields are filled",
      "4. Check if products are in correct categories",
      "5. For visibility issues, raise mapping ticket"
    ]
  },
  subscription: {
    title: "Subscription Issue",
    steps: [
      "1. Explain current plan benefits clearly",
      "2. For upgrade requests, show comparison of plans",
      "3. For downgrade, check if any pending dues",
      "4. For renewal issues, verify auto-renewal settings",
      "5. For cancellation, follow Deactivation SOP"
    ]
  }
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const limit = parseInt(searchParams.get('limit') || '50')
    const highRiskOnly = searchParams.get('high_risk') === 'true'

    // Build query
    let query = supabase
      .from('call_insights')
      .select(`
        call_id,
        churn_risk_score,
        deactivation_intent,
        raw_summary,
        calls(ucid, company_id, company_name, city, call_recording_url, call_duration_seconds)
      `)
      .order('churn_risk_score', { ascending: false })
      .limit(limit)

    // Filter for high risk if requested
    if (highRiskOnly) {
      query = query.or('churn_risk_score.gte.0.7,deactivation_intent.eq.true')
    }

    const { data, error } = await query

    if (error) throw error

    // Transform data
    const calls = data?.map(item => {
      const rawSummary = typeof item.raw_summary === 'string'
        ? JSON.parse(item.raw_summary)
        : item.raw_summary || {}

      const callData = Array.isArray(item.calls) ? item.calls[0] : item.calls
      const issues = rawSummary.issues || []

      // Generate CLEAN SOP recommendations from issues (ignore raw stored data)
      const seenCategories = new Set<string>()
      const cleanSOPRecommendations = issues
        .filter((issue: any) => {
          const cat = issue.category
          if (seenCategories.has(cat)) return false
          seenCategories.add(cat)
          return true
        })
        .map((issue: any) => {
          const category = issue.category || 'other'
          const sopData = CLEAN_SOP[category]

          if (sopData) {
            return {
              issue_category: category,
              title: sopData.title,
              steps: sopData.steps,
              sop_guidance: sopData.steps.join('\n')
            }
          } else {
            return {
              issue_category: category,
              title: `${category.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())} Issue`,
              steps: [],
              sop_guidance: 'Refer to general escalation procedure.'
            }
          }
        })

      return {
        call_id: item.call_id,
        ucid: callData?.ucid || '',
        company_id: callData?.company_id || null,  // GLID
        company_name: callData?.company_name,
        city: callData?.city,
        call_recording_url: callData?.call_recording_url,
        call_duration_seconds: callData?.call_duration_seconds,
        churn_risk_score: item.churn_risk_score,
        deactivation_intent: item.deactivation_intent,
        issues: issues,
        sop_recommendations: cleanSOPRecommendations,
        sop_alert: rawSummary.sop_alert || null
      }
    }).filter(call =>
      // Only include calls that have issues (and thus SOP recommendations)
      call.issues && call.issues.length > 0
    )

    return NextResponse.json({ calls })

  } catch (error) {
    console.error('Error fetching calls with SOP:', error)
    return NextResponse.json({ error: 'Failed to fetch calls' }, { status: 500 })
  }
}
