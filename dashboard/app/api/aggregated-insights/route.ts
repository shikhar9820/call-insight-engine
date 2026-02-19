import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import * as fs from 'fs'
import * as path from 'path'

export const dynamic = 'force-dynamic'
export const revalidate = 0

// Load GLID-MCAT mapping
let GLID_MCAT_MAP: Record<string, string> | null = null

function loadMcatMapping(): Record<string, string> {
  if (GLID_MCAT_MAP) return GLID_MCAT_MAP
  try {
    const mappingPath = path.join(process.cwd(), 'public', 'glid_mcat_mapping.json')
    const mappingData = fs.readFileSync(mappingPath, 'utf-8')
    GLID_MCAT_MAP = JSON.parse(mappingData)
    return GLID_MCAT_MAP!
  } catch {
    return {}
  }
}

function getMcatForGlid(glid: string | null): string {
  const mapping = loadMcatMapping()
  if (!glid) return 'Unknown'
  return mapping[glid] || 'Other'
}

// City Tier Classification
const TIER_1_CITIES = new Set([
  'Mumbai', 'Delhi', 'Bangalore', 'Bengaluru', 'Hyderabad', 'Chennai',
  'Kolkata', 'Pune', 'Ahmedabad', 'New Delhi'
])

const TIER_2_CITIES = new Set([
  'Jaipur', 'Lucknow', 'Kanpur', 'Nagpur', 'Indore', 'Thane', 'Bhopal',
  'Visakhapatnam', 'Patna', 'Vadodara', 'Ghaziabad', 'Ludhiana', 'Agra',
  'Nashik', 'Faridabad', 'Meerut', 'Rajkot', 'Varanasi', 'Srinagar',
  'Coimbatore', 'Kochi', 'Chandigarh', 'Guwahati', 'Noida', 'Dehradun'
])

function getCityTier(city: string | null): string {
  if (!city) return 'Unknown'
  const cityClean = city.trim()
  if (TIER_1_CITIES.has(cityClean) || TIER_1_CITIES.has(cityClean.charAt(0).toUpperCase() + cityClean.slice(1).toLowerCase())) {
    return 'Tier 1'
  }
  if (TIER_2_CITIES.has(cityClean) || TIER_2_CITIES.has(cityClean.charAt(0).toUpperCase() + cityClean.slice(1).toLowerCase())) {
    return 'Tier 2'
  }
  return 'Tier 3'
}

// Category labels for display
const categoryLabels: Record<string, string> = {
  buylead_relevance: 'BuyLead Relevance',
  buylead_availability: 'BuyLead Availability',
  buylead_roi: 'BuyLead ROI',
  payment: 'Payment Issues',
  subscription: 'Subscription',
  deactivation: 'Deactivation',
  technical: 'Technical Issues',
  catalog: 'Catalog',
  employee: 'Employee Behavior',
  pns: 'PNS',
  enquiry: 'Enquiry Quality',
  other: 'Other'
}

export async function GET() {
  GLID_MCAT_MAP = null // Reset cache

  try {
    // Fetch all data in parallel (with higher limit to avoid Supabase's default 1000 limit)
    const [callsRes, insightsRes, issuesRes, sellersRes, metricsRes] = await Promise.all([
      supabase.from('calls').select('id, company_id, company_name, city, call_duration_seconds').limit(10000),
      supabase.from('call_insights').select('*').limit(10000),
      supabase.from('call_issues').select('*').limit(10000),
      supabase.from('seller_profiles').select('glid, highest_service').limit(10000),
      supabase.from('seller_monthly_metrics').select('glid, data_month, fresh_lead_consumption, pns_defaulter_count, cqs_score, ba_rank, cc_rank').limit(10000)
    ])

    if (callsRes.error) throw callsRes.error
    if (insightsRes.error) throw insightsRes.error
    if (issuesRes.error) throw issuesRes.error

    // Seller data is optional - don't throw on error
    const sellers = sellersRes.data || []
    const metrics = metricsRes.data || []

    const calls = callsRes.data || []
    const insights = insightsRes.data || []
    const issues = issuesRes.data || []

    // Create lookup maps
    const insightsByCallId: Record<string, any> = {}
    insights.forEach(i => { insightsByCallId[i.call_id] = i })

    const issuesByCallId: Record<string, any[]> = {}
    issues.forEach(i => {
      if (!issuesByCallId[i.call_id]) issuesByCallId[i.call_id] = []
      issuesByCallId[i.call_id].push(i)
    })

    // === EXECUTIVE SUMMARY ===
    const totalCalls = calls.length
    const highRiskCalls = insights.filter(i => (i.churn_risk_score || 0) >= 0.7).length
    const deactivationIntents = insights.filter(i => i.deactivation_intent).length
    const resolvedCalls = insights.filter(i => i.resolution_status === 'resolved').length
    const criticalIssues = issues.filter(i => i.severity === 'critical').length
    const avgChurnRisk = insights.length > 0
      ? insights.reduce((sum, i) => sum + (i.churn_risk_score || 0), 0) / insights.length
      : 0

    // Risk signals count
    const riskSignalsTotal = insights.reduce((sum, i) => {
      return sum +
        (i.deactivation_intent ? 1 : 0) +
        (i.legal_threat ? 1 : 0) +
        (i.escalation_threatened ? 1 : 0) +
        (i.refund_requested ? 1 : 0) +
        (i.payment_dispute ? 1 : 0)
    }, 0)

    // === CROSS-DIMENSIONAL ANALYSIS ===
    // Combine Industry + Tier + Risk
    const crossAnalysis: Record<string, {
      industry: string
      tier: string
      totalCalls: number
      highRiskCalls: number
      deactivations: number
      topIssue: string
      topIssueCount: number
      avgChurnRisk: number
      riskScores: number[]
      issues: Record<string, number>
    }> = {}

    calls.forEach(call => {
      const insight = insightsByCallId[call.id]
      const callIssues = issuesByCallId[call.id] || []
      const industry = getMcatForGlid(call.company_id)
      const tier = getCityTier(call.city)
      const key = `${industry}__${tier}`

      if (!crossAnalysis[key]) {
        crossAnalysis[key] = {
          industry,
          tier,
          totalCalls: 0,
          highRiskCalls: 0,
          deactivations: 0,
          topIssue: '',
          topIssueCount: 0,
          avgChurnRisk: 0,
          riskScores: [],
          issues: {}
        }
      }

      const entry = crossAnalysis[key]
      entry.totalCalls++

      if (insight) {
        const churnRisk = insight.churn_risk_score || 0
        entry.riskScores.push(churnRisk)
        if (churnRisk >= 0.7) entry.highRiskCalls++
        if (insight.deactivation_intent) entry.deactivations++
      }

      callIssues.forEach(issue => {
        const cat = issue.category || 'other'
        entry.issues[cat] = (entry.issues[cat] || 0) + 1
      })
    })

    // Calculate averages and top issues
    Object.values(crossAnalysis).forEach(entry => {
      entry.avgChurnRisk = entry.riskScores.length > 0
        ? entry.riskScores.reduce((a, b) => a + b, 0) / entry.riskScores.length
        : 0

      // Find top issue
      let maxCount = 0
      Object.entries(entry.issues).forEach(([cat, count]) => {
        if (count > maxCount) {
          maxCount = count
          entry.topIssue = cat
          entry.topIssueCount = count
        }
      })
    })

    // === GENERATE ACTIONABLE INSIGHTS ===
    const actionableInsights: Array<{
      id: string
      type: 'critical' | 'warning' | 'info' | 'success'
      title: string
      description: string
      metric: string
      recommendation: string
      priority: number
    }> = []

    // 1. High deactivation rate insight
    const deactivationRate = totalCalls > 0 ? (deactivationIntents / totalCalls) * 100 : 0
    if (deactivationRate > 10) {
      actionableInsights.push({
        id: 'high-deactivation',
        type: 'critical',
        title: 'High Deactivation Intent Rate',
        description: `${deactivationRate.toFixed(1)}% of calls show deactivation intent, significantly above the 5% threshold.`,
        metric: `${deactivationIntents} of ${totalCalls} calls`,
        recommendation: 'Prioritize proactive outreach to at-risk customers. Review pricing and value proposition messaging.',
        priority: 1
      })
    }

    // 2. Resolution rate insight
    const resolutionRate = totalCalls > 0 ? (resolvedCalls / totalCalls) * 100 : 0
    if (resolutionRate < 70) {
      actionableInsights.push({
        id: 'low-resolution',
        type: 'warning',
        title: 'Low Resolution Rate',
        description: `Only ${resolutionRate.toFixed(1)}% of issues are being resolved on the call.`,
        metric: `${resolvedCalls} resolved of ${totalCalls}`,
        recommendation: 'Enhance executive training on first-call resolution. Empower executives with more authority to resolve issues.',
        priority: 2
      })
    } else if (resolutionRate >= 80) {
      actionableInsights.push({
        id: 'good-resolution',
        type: 'success',
        title: 'Strong Resolution Rate',
        description: `${resolutionRate.toFixed(1)}% resolution rate indicates effective issue handling.`,
        metric: `${resolvedCalls} resolved`,
        recommendation: 'Document and share best practices from top-performing executives.',
        priority: 5
      })
    }

    // 3. Top issue category insights
    const issueCategories: Record<string, number> = {}
    issues.forEach(i => {
      const cat = i.category || 'other'
      issueCategories[cat] = (issueCategories[cat] || 0) + 1
    })

    const sortedIssues = Object.entries(issueCategories).sort((a, b) => b[1] - a[1])
    if (sortedIssues.length > 0) {
      const [topCat, topCount] = sortedIssues[0]
      const topCatPercent = issues.length > 0 ? (topCount / issues.length) * 100 : 0

      if (topCatPercent > 25) {
        actionableInsights.push({
          id: 'dominant-issue',
          type: 'warning',
          title: `${categoryLabels[topCat] || topCat} Dominates Issues`,
          description: `${topCatPercent.toFixed(1)}% of all issues are related to ${categoryLabels[topCat] || topCat}.`,
          metric: `${topCount} issues`,
          recommendation: `Focus product/process improvements on ${categoryLabels[topCat] || topCat}. Consider dedicated task force.`,
          priority: 2
        })
      }
    }

    // 4. High-risk industry insight
    const industryRisk: Record<string, { total: number; highRisk: number; rate: number }> = {}
    Object.values(crossAnalysis).forEach(entry => {
      if (entry.industry !== 'Unknown' && entry.industry !== 'Other') {
        if (!industryRisk[entry.industry]) {
          industryRisk[entry.industry] = { total: 0, highRisk: 0, rate: 0 }
        }
        industryRisk[entry.industry].total += entry.totalCalls
        industryRisk[entry.industry].highRisk += entry.highRiskCalls
      }
    })

    Object.entries(industryRisk).forEach(([industry, data]) => {
      data.rate = data.total > 0 ? (data.highRisk / data.total) * 100 : 0
    })

    const riskiestIndustries = Object.entries(industryRisk)
      .filter(([_, data]) => data.total >= 3) // At least 3 calls
      .sort((a, b) => b[1].rate - a[1].rate)
      .slice(0, 3)

    if (riskiestIndustries.length > 0 && riskiestIndustries[0][1].rate > 40) {
      const [industry, data] = riskiestIndustries[0]
      actionableInsights.push({
        id: 'high-risk-industry',
        type: 'critical',
        title: `High Risk in ${industry}`,
        description: `${data.rate.toFixed(1)}% of calls from ${industry} sellers are high-risk.`,
        metric: `${data.highRisk} of ${data.total} calls`,
        recommendation: `Develop industry-specific retention strategy for ${industry} segment.`,
        priority: 1
      })
    }

    // 5. Tier-based insight
    const tierStats: Record<string, { total: number; highRisk: number }> = {}
    Object.values(crossAnalysis).forEach(entry => {
      if (!tierStats[entry.tier]) tierStats[entry.tier] = { total: 0, highRisk: 0 }
      tierStats[entry.tier].total += entry.totalCalls
      tierStats[entry.tier].highRisk += entry.highRiskCalls
    })

    const tierRiskRates = Object.entries(tierStats)
      .map(([tier, data]) => ({
        tier,
        rate: data.total > 0 ? (data.highRisk / data.total) * 100 : 0,
        ...data
      }))
      .sort((a, b) => b.rate - a.rate)

    if (tierRiskRates.length > 0) {
      const highestRiskTier = tierRiskRates[0]
      if (highestRiskTier.rate > 30) {
        actionableInsights.push({
          id: 'tier-risk',
          type: 'warning',
          title: `${highestRiskTier.tier} Cities Show Higher Risk`,
          description: `${highestRiskTier.rate.toFixed(1)}% high-risk rate in ${highestRiskTier.tier} cities.`,
          metric: `${highestRiskTier.highRisk} of ${highestRiskTier.total} calls`,
          recommendation: `Review service quality and response times in ${highestRiskTier.tier} markets.`,
          priority: 3
        })
      }
    }

    // 6. Sentiment trend insight
    const negativeEndCount = insights.filter(i =>
      ['frustrated', 'angry', 'disappointed'].includes(i.sentiment_end?.toLowerCase() || '')
    ).length
    const negativeEndRate = insights.length > 0 ? (negativeEndCount / insights.length) * 100 : 0

    if (negativeEndRate > 20) {
      actionableInsights.push({
        id: 'negative-sentiment',
        type: 'warning',
        title: 'High Negative Call Endings',
        description: `${negativeEndRate.toFixed(1)}% of calls end with customer in negative sentiment.`,
        metric: `${negativeEndCount} calls`,
        recommendation: 'Train executives on de-escalation and empathy. Review call closing procedures.',
        priority: 2
      })
    }

    // Sort by priority
    actionableInsights.sort((a, b) => a.priority - b.priority)

    // === FORMAT CROSS-ANALYSIS FOR OUTPUT ===
    const crossAnalysisOutput = Object.values(crossAnalysis)
      .filter(e => e.totalCalls >= 2 && e.industry !== 'Unknown' && e.industry !== 'Other')
      .map(e => ({
        industry: e.industry,
        tier: e.tier,
        totalCalls: e.totalCalls,
        highRiskCalls: e.highRiskCalls,
        riskRate: e.totalCalls > 0 ? Math.round((e.highRiskCalls / e.totalCalls) * 100) : 0,
        avgChurnRisk: Math.round(e.avgChurnRisk * 100),
        deactivations: e.deactivations,
        topIssue: categoryLabels[e.topIssue] || e.topIssue,
        topIssueCount: e.topIssueCount
      }))
      .sort((a, b) => b.riskRate - a.riskRate)
      .slice(0, 20)

    // === ISSUE TRENDS ===
    const issueTrends = sortedIssues.slice(0, 8).map(([cat, count]) => {
      // Calculate risk association for each issue category
      const issuesInCat = issues.filter(i => i.category === cat)
      const highRiskIssues = issuesInCat.filter(i => {
        const insight = insightsByCallId[i.call_id]
        return insight && (insight.churn_risk_score || 0) >= 0.7
      }).length

      return {
        category: categoryLabels[cat] || cat,
        categoryKey: cat,
        count,
        percentage: issues.length > 0 ? Math.round((count / issues.length) * 100) : 0,
        highRiskAssociation: issuesInCat.length > 0 ? Math.round((highRiskIssues / issuesInCat.length) * 100) : 0
      }
    })

    // === BEHAVIORAL AGGREGATION ===
    let behavioralAggregation = null

    if (sellers.length > 0) {
      // Group metrics by GLID to get latest month data
      const latestMetricsByGlid: Record<string, any> = {}
      metrics.forEach(m => {
        if (!latestMetricsByGlid[m.glid] || m.data_month > latestMetricsByGlid[m.glid].data_month) {
          latestMetricsByGlid[m.glid] = m
        }
      })

      // Calculate health scores and classify behavior for each seller
      const sellerAnalysis: Array<{
        glid: string
        behaviorType: string
        healthScore: number
        riskLevel: 'high' | 'medium' | 'low'
      }> = []

      // Get unique GLIDs that have calls
      const glidsWithCalls = new Set(calls.map(c => c.company_id).filter(Boolean))

      sellers.forEach(seller => {
        if (!glidsWithCalls.has(seller.glid)) return

        const latestMetrics = latestMetricsByGlid[seller.glid] || {}
        const sellerInsights = insights.filter(i => {
          const call = calls.find(c => c.id === i.call_id)
          return call && call.company_id === seller.glid
        })

        // Calculate health score
        const avgChurnRiskForSeller = sellerInsights.length > 0
          ? sellerInsights.reduce((sum, i) => sum + (i.churn_risk_score || 0), 0) / sellerInsights.length
          : 0.5
        const resolvedForSeller = sellerInsights.filter(i => i.resolution_status === 'resolved').length
        const resolutionRateForSeller = sellerInsights.length > 0
          ? (resolvedForSeller / sellerInsights.length) * 100
          : 50

        let healthScore = 50
        healthScore += resolutionRateForSeller * 0.25
        healthScore -= avgChurnRiskForSeller * 25
        healthScore = Math.max(0, Math.min(100, Math.round(healthScore)))

        // Determine risk level
        let riskLevel: 'high' | 'medium' | 'low' = 'low'
        if (avgChurnRiskForSeller >= 0.7 || healthScore < 30) riskLevel = 'high'
        else if (avgChurnRiskForSeller >= 0.4 || healthScore < 60) riskLevel = 'medium'

        // Determine behavior type
        const freshConsumption = latestMetrics.fresh_lead_consumption || 0
        const pnsDefaulter = latestMetrics.pns_defaulter_count || 0
        const baRank = latestMetrics.ba_rank || 0
        const ccRank = latestMetrics.cc_rank || 0

        let behaviorType = 'active'
        if (freshConsumption >= 10 && pnsDefaulter <= 1 && healthScore >= 50) {
          behaviorType = 'high_potential'
        } else if (pnsDefaulter >= 3 || healthScore < 30) {
          behaviorType = 'dormant_at_risk'
        } else if (baRank > 5 || ccRank > 3) {
          behaviorType = 'misconfigured'
        }

        sellerAnalysis.push({
          glid: seller.glid,
          behaviorType,
          healthScore,
          riskLevel
        })
      })

      // Aggregate behavior breakdown
      const behaviorCounts: Record<string, { count: number; totalHealth: number }> = {}
      sellerAnalysis.forEach(s => {
        if (!behaviorCounts[s.behaviorType]) {
          behaviorCounts[s.behaviorType] = { count: 0, totalHealth: 0 }
        }
        behaviorCounts[s.behaviorType].count++
        behaviorCounts[s.behaviorType].totalHealth += s.healthScore
      })

      const behaviorBreakdown = Object.entries(behaviorCounts).map(([type, data]) => ({
        type,
        count: data.count,
        percentage: sellerAnalysis.length > 0 ? Math.round((data.count / sellerAnalysis.length) * 100) : 0,
        avgHealthScore: data.count > 0 ? Math.round(data.totalHealth / data.count) : 0
      }))

      // Risk distribution
      const riskDistribution = {
        high: sellerAnalysis.filter(s => s.riskLevel === 'high').length,
        medium: sellerAnalysis.filter(s => s.riskLevel === 'medium').length,
        low: sellerAnalysis.filter(s => s.riskLevel === 'low').length
      }

      // Top issue categories
      const issueCounts: Record<string, number> = {}
      issues.forEach(i => {
        const cat = categoryLabels[i.category] || i.category
        issueCounts[cat] = (issueCounts[cat] || 0) + 1
      })
      const topIssueCategories = Object.entries(issueCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([category, count]) => ({
          category,
          count,
          percentage: issues.length > 0 ? Math.round((count / issues.length) * 100) : 0
        }))

      // Average health and resolution rate
      const avgHealthScore = sellerAnalysis.length > 0
        ? Math.round(sellerAnalysis.reduce((sum, s) => sum + s.healthScore, 0) / sellerAnalysis.length)
        : 0
      const avgResolutionRate = resolvedCalls > 0 && totalCalls > 0
        ? Math.round((resolvedCalls / totalCalls) * 100)
        : 0

      behavioralAggregation = {
        totalSellers: sellerAnalysis.length,
        behaviorBreakdown,
        avgHealthScore,
        avgResolutionRate,
        engagementMetrics: [],
        topIssueCategories,
        riskDistribution
      }
    }

    // === RESPONSE ===
    return NextResponse.json({
      executiveSummary: {
        totalCalls,
        highRiskCalls,
        highRiskRate: totalCalls > 0 ? Math.round((highRiskCalls / totalCalls) * 100) : 0,
        deactivationIntents,
        deactivationRate: totalCalls > 0 ? Math.round((deactivationIntents / totalCalls) * 100) : 0,
        resolvedCalls,
        resolutionRate: totalCalls > 0 ? Math.round((resolvedCalls / totalCalls) * 100) : 0,
        criticalIssues,
        avgChurnRisk: Math.round(avgChurnRisk * 100),
        riskSignalsTotal,
        healthScore: calculateHealthScore(resolutionRate, deactivationRate, avgChurnRisk * 100, negativeEndRate)
      },
      actionableInsights,
      crossAnalysis: crossAnalysisOutput,
      issueTrends,
      tierBreakdown: tierRiskRates.map(t => ({
        ...t,
        rate: Math.round(t.rate)
      })),
      topRiskIndustries: riskiestIndustries.slice(0, 5).map(([industry, data]) => ({
        industry,
        totalCalls: data.total,
        highRiskCalls: data.highRisk,
        riskRate: Math.round(data.rate)
      })),
      behavioralAggregation
    })

  } catch (error) {
    console.error('Error in aggregated insights:', error)
    return NextResponse.json({ error: 'Failed to generate insights' }, { status: 500 })
  }
}

// Calculate overall health score (0-100)
function calculateHealthScore(
  resolutionRate: number,
  deactivationRate: number,
  avgChurnRisk: number,
  negativeEndRate: number
): number {
  // Weighted scoring
  const resolutionScore = Math.min(resolutionRate, 100) * 0.35
  const deactivationScore = Math.max(0, 100 - deactivationRate * 5) * 0.25
  const churnScore = Math.max(0, 100 - avgChurnRisk) * 0.25
  const sentimentScore = Math.max(0, 100 - negativeEndRate * 2) * 0.15

  return Math.round(resolutionScore + deactivationScore + churnScore + sentimentScore)
}
