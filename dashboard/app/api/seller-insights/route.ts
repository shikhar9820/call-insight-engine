import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

// Disable caching to always get fresh data
export const dynamic = 'force-dynamic'
export const revalidate = 0

interface SellerMetrics {
  company_id: string
  company_name: string
  total_calls: number
  first_call_date: string
  latest_call_date: string
  avg_sentiment_score: number
  sentiment_trend: 'improving' | 'declining' | 'stable'
  avg_churn_risk: number
  resolution_rate: number
  avg_call_duration: number
  top_issues: Array<{ category: string; count: number }>
  risk_level: 'low' | 'medium' | 'high'
  health_score: number
  days_since_last_call: number
  sticky_issues: string[]
  risk_signals: {
    deactivation_intent: number
    refund_requested: number
    escalation_threatened: number
    payment_dispute: number
  }
}

function calculateHealthScore(
  sentimentTrend: string,
  resolutionRate: number,
  avgChurnRisk: number,
  stickyIssuesCount: number
): number {
  let score = 50 // Base score

  // Sentiment trend contribution (max 25 points)
  if (sentimentTrend === 'improving') score += 25
  else if (sentimentTrend === 'stable') score += 15
  else if (sentimentTrend === 'declining') score -= 10

  // Resolution rate contribution (max 25 points)
  score += resolutionRate * 0.25

  // Churn risk penalty (max -25 points)
  score -= avgChurnRisk * 25

  // Sticky issues penalty (-5 per sticky issue, max -20)
  score -= Math.min(stickyIssuesCount * 5, 20)

  return Math.max(0, Math.min(100, Math.round(score)))
}

function determineSentimentTrend(calls: any[]): 'improving' | 'declining' | 'stable' {
  if (calls.length < 2) return 'stable'

  const sortedCalls = [...calls].sort(
    (a, b) => new Date(a.call_start_time || a.created_at).getTime() -
              new Date(b.call_start_time || b.created_at).getTime()
  )

  const sentimentValues: Record<string, number> = {
    'positive': 1,
    'neutral': 0,
    'negative': -1,
    'frustrated': -1.5,
    'angry': -2
  }

  // Get first half and second half average sentiments
  const midpoint = Math.floor(sortedCalls.length / 2)
  const firstHalf = sortedCalls.slice(0, midpoint)
  const secondHalf = sortedCalls.slice(midpoint)

  const getAvgSentiment = (callsGroup: any[]) => {
    const scores = callsGroup
      .filter(c => c.call_insights?.[0]?.sentiment_end)
      .map(c => sentimentValues[c.call_insights[0].sentiment_end.toLowerCase()] || 0)
    return scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0
  }

  const firstAvg = getAvgSentiment(firstHalf)
  const secondAvg = getAvgSentiment(secondHalf)
  const diff = secondAvg - firstAvg

  if (diff > 0.3) return 'improving'
  if (diff < -0.3) return 'declining'
  return 'stable'
}

function findStickyIssues(calls: any[]): string[] {
  // Find issues that appear in 3+ consecutive calls
  const sortedCalls = [...calls].sort(
    (a, b) => new Date(a.call_start_time || a.created_at).getTime() -
              new Date(b.call_start_time || b.created_at).getTime()
  )

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

  // Find categories with 3+ occurrences in consecutive calls
  const stickyIssues: string[] = []
  Object.entries(issueStreaks).forEach(([category, indices]) => {
    if (indices.length >= 3) {
      // Check for consecutive occurrences
      let maxConsecutive = 1
      let currentConsecutive = 1
      for (let i = 1; i < indices.length; i++) {
        if (indices[i] - indices[i - 1] === 1) {
          currentConsecutive++
          maxConsecutive = Math.max(maxConsecutive, currentConsecutive)
        } else {
          currentConsecutive = 1
        }
      }
      if (maxConsecutive >= 3 || indices.length >= 3) {
        stickyIssues.push(category)
      }
    }
  })

  return stickyIssues
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const searchQuery = searchParams.get('search')
    const riskFilter = searchParams.get('risk') // 'high', 'medium', 'low', 'at-risk' (champion hidden)
    const minCalls = parseInt(searchParams.get('minCalls') || '1')
    const sortBy = searchParams.get('sortBy') || 'health_score'
    const sortOrder = searchParams.get('sortOrder') || 'asc'

    // Fetch all calls with insights
    const { data: allCalls, error: callsError } = await supabase
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
          sentiment_start,
          sentiment_end,
          sentiment_trajectory,
          call_purpose,
          resolution_status,
          issues,
          topics,
          executive_tone
        )
      `)
      .not('company_id', 'is', null)
      .order('created_at', { ascending: false })
      .limit(10000)

    if (callsError) throw callsError

    // Group calls by company_id
    const sellerCallsMap: Record<string, any[]> = {}
    allCalls?.forEach(call => {
      const companyId = call.company_id
      if (!companyId) return
      if (!sellerCallsMap[companyId]) sellerCallsMap[companyId] = []
      sellerCallsMap[companyId].push(call)
    })

    // Filter sellers with multiple calls
    const multiCallSellers = Object.entries(sellerCallsMap)
      .filter(([_, calls]) => calls.length >= minCalls)

    // Calculate metrics for each seller
    const sellerMetrics: SellerMetrics[] = multiCallSellers.map(([companyId, calls]) => {
      // Sort calls by date
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

      // Average churn risk
      const churnScores = insights
        .map(i => i.churn_risk_score)
        .filter((s): s is number => s !== null && s !== undefined)
      const avgChurnRisk = churnScores.length > 0
        ? churnScores.reduce((a, b) => a + b, 0) / churnScores.length
        : 0

      // Resolution rate
      const resolvedCount = insights.filter(i => i.resolution_status === 'resolved').length
      const resolutionRate = insights.length > 0
        ? (resolvedCount / insights.length) * 100
        : 0

      // Average call duration
      const durations = calls
        .map(c => c.call_duration_seconds)
        .filter((d): d is number => d !== null && d !== undefined)
      const avgDuration = durations.length > 0
        ? durations.reduce((a, b) => a + b, 0) / durations.length
        : 0

      // Top issues - count each category only once per call
      const issueCategories: Record<string, number> = {}
      insights.forEach(insight => {
        let issues = insight.issues
        if (typeof issues === 'string') {
          try { issues = JSON.parse(issues) } catch { return }
        }
        if (Array.isArray(issues)) {
          // Track categories already counted for THIS call
          const categoriesCountedThisCall = new Set<string>()
          issues.forEach((issue: any) => {
            const cat = issue.category || 'other'
            // Only count each category once per call
            if (!categoriesCountedThisCall.has(cat)) {
              issueCategories[cat] = (issueCategories[cat] || 0) + 1
              categoriesCountedThisCall.add(cat)
            }
          })
        }
      })

      const topIssues = Object.entries(issueCategories)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([category, count]) => ({ category, count }))

      // Risk signals count
      const riskSignals = {
        deactivation_intent: insights.filter(i => i.deactivation_intent).length,
        refund_requested: insights.filter(i => i.refund_requested).length,
        escalation_threatened: insights.filter(i => i.escalation_threatened).length,
        payment_dispute: insights.filter(i => i.payment_dispute).length
      }

      // Sentiment trend
      const sentimentTrend = determineSentimentTrend(calls)

      // Sticky issues
      const stickyIssues = findStickyIssues(calls)

      // Calculate sentiment score (for sorting)
      const sentimentValues: Record<string, number> = {
        'positive': 100, 'neutral': 60, 'negative': 30, 'frustrated': 20, 'angry': 10
      }
      const sentimentScores = insights
        .map(i => sentimentValues[i.sentiment_end?.toLowerCase()] || 50)
      const avgSentimentScore = sentimentScores.length > 0
        ? sentimentScores.reduce((a, b) => a + b, 0) / sentimentScores.length
        : 50

      // Health score
      const healthScore = calculateHealthScore(
        sentimentTrend,
        resolutionRate,
        avgChurnRisk,
        stickyIssues.length
      )

      // Risk level
      let riskLevel: 'low' | 'medium' | 'high' = 'low'
      if (avgChurnRisk >= 0.7 || healthScore < 30) riskLevel = 'high'
      else if (avgChurnRisk >= 0.4 || healthScore < 60) riskLevel = 'medium'

      // Days since last call
      const lastCallDate = new Date(latestCall.call_start_time || latestCall.created_at)
      const daysSinceLastCall = Math.floor(
        (Date.now() - lastCallDate.getTime()) / (1000 * 60 * 60 * 24)
      )

      return {
        company_id: companyId,
        company_name: firstCall.company_name || 'Unknown',
        total_calls: calls.length,
        first_call_date: firstCall.call_start_time || firstCall.created_at,
        latest_call_date: latestCall.call_start_time || latestCall.created_at,
        avg_sentiment_score: Math.round(avgSentimentScore),
        sentiment_trend: sentimentTrend,
        avg_churn_risk: Math.round(avgChurnRisk * 100) / 100,
        resolution_rate: Math.round(resolutionRate),
        avg_call_duration: Math.round(avgDuration),
        top_issues: topIssues,
        risk_level: riskLevel,
        health_score: healthScore,
        days_since_last_call: daysSinceLastCall,
        sticky_issues: stickyIssues,
        risk_signals: riskSignals
      }
    })

    // Apply search filter
    let filteredSellers = sellerMetrics
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      filteredSellers = filteredSellers.filter(s =>
        s.company_id.toLowerCase().includes(query) ||
        s.company_name.toLowerCase().includes(query)
      )
    }

    // Apply risk filter
    if (riskFilter) {
      if (riskFilter === 'at-risk') {
        // Declining engagement + negative sentiment + unresolved issues
        filteredSellers = filteredSellers.filter(s =>
          s.sentiment_trend === 'declining' &&
          s.health_score < 40 &&
          s.resolution_rate < 50
        )
      // Champion filter hidden
      // } else if (riskFilter === 'champion') {
      //   filteredSellers = filteredSellers.filter(s =>
      //     s.sentiment_trend === 'improving' &&
      //     s.health_score >= 70 &&
      //     s.resolution_rate >= 70
      //   )
      } else {
        filteredSellers = filteredSellers.filter(s => s.risk_level === riskFilter)
      }
    }

    // Sort
    filteredSellers.sort((a, b) => {
      const aVal = a[sortBy as keyof SellerMetrics]
      const bVal = b[sortBy as keyof SellerMetrics]

      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return sortOrder === 'asc' ? aVal - bVal : bVal - aVal
      }
      return 0
    })

    // Pagination
    const total = filteredSellers.length
    const offset = (page - 1) * limit
    const paginatedSellers = filteredSellers.slice(offset, offset + limit)

    // Summary stats
    const summary = {
      total_sellers: multiCallSellers.length,
      at_risk_sellers: sellerMetrics.filter(s =>
        s.sentiment_trend === 'declining' && s.health_score < 40
      ).length,
      champion_sellers: 0, // Hidden - was: sellerMetrics.filter(s => s.sentiment_trend === 'improving' && s.health_score >= 70).length
      avg_health_score: Math.round(
        sellerMetrics.reduce((sum, s) => sum + s.health_score, 0) / sellerMetrics.length
      ),
      sellers_with_sticky_issues: sellerMetrics.filter(s => s.sticky_issues.length > 0).length
    }

    return NextResponse.json({
      sellers: paginatedSellers,
      summary,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    })
  } catch (error) {
    console.error('Error fetching seller insights:', error)
    return NextResponse.json({ error: 'Failed to fetch seller insights' }, { status: 500 })
  }
}
