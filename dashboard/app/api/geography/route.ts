import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

// Disable caching to always get fresh data
export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET() {
  try {
    // Get all calls with city and insights (with higher limit to avoid Supabase's default 1000 limit)
    const { data: calls, error: callsError } = await supabase
      .from('calls')
      .select(`
        id,
        city,
        customer_type,
        vertical_name,
        company_id,
        call_insights (
          churn_risk_score,
          deactivation_intent,
          resolution_status,
          call_purpose
        )
      `)
      .not('city', 'is', null)
      .limit(10000)

    if (callsError) throw callsError

    // Get all issues with city info
    const { data: issues, error: issuesError } = await supabase
      .from('call_issues')
      .select(`
        category,
        severity,
        calls (city, customer_type)
      `)
      .limit(10000)

    if (issuesError) throw issuesError

    // === GEOGRAPHIC ANALYSIS ===

    // 1. Calls by City
    const callsByCity: Record<string, number> = {}
    const churnByCity: Record<string, { total: number; sum: number }> = {}
    const deactivationByCity: Record<string, number> = {}

    calls?.forEach(call => {
      const city = call.city
      if (!city) return

      callsByCity[city] = (callsByCity[city] || 0) + 1

      const insight = call.call_insights?.[0]
      if (insight) {
        if (!churnByCity[city]) {
          churnByCity[city] = { total: 0, sum: 0 }
        }
        churnByCity[city].total++
        churnByCity[city].sum += insight.churn_risk_score || 0

        if (insight.deactivation_intent) {
          deactivationByCity[city] = (deactivationByCity[city] || 0) + 1
        }
      }
    })

    // 2. Issues by City
    const issuesByCity: Record<string, number> = {}
    const criticalIssuesByCity: Record<string, number> = {}
    const categoryByCity: Record<string, Record<string, number>> = {}

    issues?.forEach(issue => {
      // calls is an object (single related record)
      const callData = issue.calls as { city?: string; customer_type?: string } | null
      const city = callData?.city
      if (!city) return

      issuesByCity[city] = (issuesByCity[city] || 0) + 1

      if (issue.severity === 'critical' || issue.severity === 'high') {
        criticalIssuesByCity[city] = (criticalIssuesByCity[city] || 0) + 1
      }

      if (!categoryByCity[city]) {
        categoryByCity[city] = {}
      }
      const cat = issue.category || 'other'
      categoryByCity[city][cat] = (categoryByCity[city][cat] || 0) + 1
    })

    // 3. Top Cities by Calls
    const topCitiesByCalls = Object.entries(callsByCity)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 15)
      .map(([city, count]) => ({
        city,
        calls: count,
        issues: issuesByCity[city] || 0,
        criticalIssues: criticalIssuesByCity[city] || 0,
        avgChurnRisk: churnByCity[city]
          ? Math.round((churnByCity[city].sum / churnByCity[city].total) * 100)
          : 0,
        deactivationIntents: deactivationByCity[city] || 0
      }))

    // 4. Top Cities by Churn Risk
    const topCitiesByChurn = Object.entries(churnByCity)
      .filter(([_, data]) => data.total >= 2) // At least 2 calls
      .map(([city, data]) => ({
        city,
        avgChurnRisk: Math.round((data.sum / data.total) * 100),
        calls: data.total,
        deactivationIntents: deactivationByCity[city] || 0
      }))
      .sort((a, b) => b.avgChurnRisk - a.avgChurnRisk)
      .slice(0, 10)

    // 5. Top Cities by Issues
    const topCitiesByIssues = Object.entries(issuesByCity)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([city, count]) => ({
        city,
        issues: count,
        criticalIssues: criticalIssuesByCity[city] || 0,
        topCategory: categoryByCity[city]
          ? Object.entries(categoryByCity[city]).sort((a, b) => b[1] - a[1])[0]?.[0] || 'N/A'
          : 'N/A'
      }))

    // 6. Customer Type Distribution
    const customerTypeByCity: Record<string, Record<string, number>> = {}
    calls?.forEach(call => {
      const city = call.city
      const type = call.customer_type
      if (!city || !type) return

      if (!customerTypeByCity[city]) {
        customerTypeByCity[city] = {}
      }
      customerTypeByCity[city][type] = (customerTypeByCity[city][type] || 0) + 1
    })

    // 7. Problem Cities (high issues + high churn)
    const problemCities = topCitiesByCalls
      .filter(city => city.avgChurnRisk >= 50 || city.criticalIssues >= 2)
      .sort((a, b) => (b.avgChurnRisk + b.criticalIssues * 10) - (a.avgChurnRisk + a.criticalIssues * 10))
      .slice(0, 10)

    // 8. Summary Stats
    const totalCities = Object.keys(callsByCity).length
    const totalCallsWithCity = Object.values(callsByCity).reduce((a, b) => a + b, 0)

    return NextResponse.json({
      summary: {
        totalCities,
        totalCallsWithCity,
        avgChurnRiskOverall: calls?.length
          ? Math.round(calls.reduce((sum, c) => sum + (c.call_insights?.[0]?.churn_risk_score || 0), 0) / calls.length * 100)
          : 0
      },
      topCitiesByCalls,
      topCitiesByChurn,
      topCitiesByIssues,
      problemCities,
      callsByCity,
      issuesByCity
    })
  } catch (error) {
    console.error('Error fetching geography data:', error)
    return NextResponse.json({ error: 'Failed to fetch geography data' }, { status: 500 })
  }
}
