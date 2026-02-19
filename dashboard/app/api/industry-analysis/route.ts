import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import * as fs from 'fs'
import * as path from 'path'

export const dynamic = 'force-dynamic'
export const revalidate = 0

// Load GLID-MCAT mapping (cached per-request)
let GLID_MCAT_MAP: Record<string, string> | null = null

function loadMcatMapping(): Record<string, string> {
  if (GLID_MCAT_MAP) return GLID_MCAT_MAP

  try {
    const mappingPath = path.join(process.cwd(), 'public', 'glid_mcat_mapping.json')
    const mappingData = fs.readFileSync(mappingPath, 'utf-8')
    GLID_MCAT_MAP = JSON.parse(mappingData)
    console.log(`Loaded ${Object.keys(GLID_MCAT_MAP!).length} GLID-MCAT mappings`)
    return GLID_MCAT_MAP!
  } catch (e) {
    console.log('Could not load MCAT mapping:', e)
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
  'Aurangabad', 'Dhanbad', 'Amritsar', 'Allahabad', 'Ranchi', 'Howrah',
  'Coimbatore', 'Jabalpur', 'Gwalior', 'Vijayawada', 'Jodhpur', 'Madurai',
  'Raipur', 'Kota', 'Chandigarh', 'Guwahati', 'Solapur', 'Hubli', 'Mysore',
  'Tiruchirappalli', 'Bareilly', 'Aligarh', 'Tiruppur', 'Moradabad', 'Jalandhar',
  'Bhubaneswar', 'Salem', 'Warangal', 'Guntur', 'Bhiwandi', 'Saharanpur',
  'Gorakhpur', 'Bikaner', 'Amravati', 'Noida', 'Jamshedpur', 'Bhilai',
  'Cuttack', 'Firozabad', 'Kochi', 'Nellore', 'Bhavnagar', 'Dehradun',
  'Durgapur', 'Asansol', 'Rourkela', 'Nanded', 'Kolhapur', 'Ajmer',
  'Akola', 'Gulbarga', 'Jamnagar', 'Ujjain', 'Loni', 'Siliguri', 'Jhansi',
  'Ulhasnagar', 'Jammu', 'Sangli', 'Mangalore', 'Erode', 'Belgaum',
  'Ambattur', 'Tirunelveli', 'Malegaon', 'Gaya', 'Udaipur', 'Kakinada'
])

function getCityTier(city: string | null): string {
  if (!city) return 'Unknown'
  const cityClean = city.trim()
  // Check with various capitalizations
  if (TIER_1_CITIES.has(cityClean) || TIER_1_CITIES.has(cityClean.charAt(0).toUpperCase() + cityClean.slice(1).toLowerCase())) {
    return 'Tier 1'
  }
  if (TIER_2_CITIES.has(cityClean) || TIER_2_CITIES.has(cityClean.charAt(0).toUpperCase() + cityClean.slice(1).toLowerCase())) {
    return 'Tier 2'
  }
  return 'Tier 3'
}

export async function GET(request: NextRequest) {
  // Force reload mapping on each request in dev
  GLID_MCAT_MAP = null

  try {
    // Fetch calls with insights (with higher limit to avoid Supabase's default 1000 limit)
    const { data: callsData, error: callsError } = await supabase
      .from('calls')
      .select('id, company_id, company_name, city')
      .limit(10000)

    if (callsError) throw callsError

    const { data: insightsData, error: insightsError } = await supabase
      .from('call_insights')
      .select('call_id, churn_risk_score, deactivation_intent, raw_summary')
      .limit(10000)

    if (insightsError) throw insightsError

    // Create insights lookup
    const insightsMap: Record<string, any> = {}
    insightsData?.forEach(insight => {
      insightsMap[insight.call_id] = insight
    })

    // Merge data
    const mergedCalls = callsData?.map(call => ({
      ...call,
      ...insightsMap[call.id]
    })) || []

    // Analyze by Tier
    const tierStats: Record<string, {
      total: number
      highRisk: number
      deactivation: number
      issues: Record<string, number>
      cities: Set<string>
    }> = {}

    // Analyze by City
    const cityStats: Record<string, {
      total: number
      highRisk: number
      tier: string
      issues: Record<string, number>
    }> = {}

    // Analyze by Industry/MCAT
    const mcatStats: Record<string, {
      total: number
      highRisk: number
      deactivation: number
      issues: Record<string, number>
      cities: Set<string>
      tiers: Record<string, number>
    }> = {}

    // Analyze by Issue patterns
    const industryFromIssues: Record<string, {
      total: number
      highRisk: number
      cities: Set<string>
    }> = {}

    for (const call of mergedCalls) {
      const city = call.city
      const tier = getCityTier(city)
      const churnScore = call.churn_risk_score || 0
      const isHighRisk = churnScore >= 0.7
      const mcat = getMcatForGlid(call.company_id)

      // Tier stats
      if (!tierStats[tier]) {
        tierStats[tier] = { total: 0, highRisk: 0, deactivation: 0, issues: {}, cities: new Set() }
      }
      tierStats[tier].total++
      if (isHighRisk) tierStats[tier].highRisk++
      if (call.deactivation_intent) tierStats[tier].deactivation++
      if (city) tierStats[tier].cities.add(city)

      // City stats
      if (city) {
        if (!cityStats[city]) {
          cityStats[city] = { total: 0, highRisk: 0, tier, issues: {} }
        }
        cityStats[city].total++
        if (isHighRisk) cityStats[city].highRisk++
      }

      // MCAT/Industry stats
      if (!mcatStats[mcat]) {
        mcatStats[mcat] = { total: 0, highRisk: 0, deactivation: 0, issues: {}, cities: new Set(), tiers: {} }
      }
      mcatStats[mcat].total++
      if (isHighRisk) mcatStats[mcat].highRisk++
      if (call.deactivation_intent) mcatStats[mcat].deactivation++
      if (city) mcatStats[mcat].cities.add(city)
      mcatStats[mcat].tiers[tier] = (mcatStats[mcat].tiers[tier] || 0) + 1

      // Parse issues
      let rawSummary = call.raw_summary
      if (typeof rawSummary === 'string') {
        try {
          rawSummary = JSON.parse(rawSummary)
        } catch { rawSummary = {} }
      }

      const issues = rawSummary?.issues || []
      for (const issue of issues) {
        if (typeof issue === 'object' && issue.category) {
          const cat = issue.category

          // Add to tier issues
          tierStats[tier].issues[cat] = (tierStats[tier].issues[cat] || 0) + 1

          // Add to city issues
          if (city) {
            cityStats[city].issues[cat] = (cityStats[city].issues[cat] || 0) + 1
          }

          // Add to MCAT issues
          mcatStats[mcat].issues[cat] = (mcatStats[mcat].issues[cat] || 0) + 1

          // Track issue patterns
          if (!industryFromIssues[cat]) {
            industryFromIssues[cat] = { total: 0, highRisk: 0, cities: new Set() }
          }
          industryFromIssues[cat].total++
          if (isHighRisk) industryFromIssues[cat].highRisk++
          if (city) industryFromIssues[cat].cities.add(city)
        }
      }
    }

    // Format tier results
    const byTier = Object.entries(tierStats)
      .map(([tier, stats]) => ({
        tier,
        totalCalls: stats.total,
        highRiskCalls: stats.highRisk,
        deactivationIntents: stats.deactivation,
        uniqueCities: stats.cities.size,
        riskRate: stats.total > 0 ? Math.round(stats.highRisk / stats.total * 100 * 10) / 10 : 0,
        topIssues: Object.entries(stats.issues)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 5)
          .map(([category, count]) => ({ category, count }))
      }))
      .sort((a, b) => {
        const order = { 'Tier 1': 1, 'Tier 2': 2, 'Tier 3': 3, 'Unknown': 4 }
        return (order[a.tier as keyof typeof order] || 5) - (order[b.tier as keyof typeof order] || 5)
      })

    // Format city results
    const byCity = Object.entries(cityStats)
      .map(([city, stats]) => ({
        city,
        tier: stats.tier,
        totalCalls: stats.total,
        highRiskCalls: stats.highRisk,
        riskRate: stats.total > 0 ? Math.round(stats.highRisk / stats.total * 100 * 10) / 10 : 0,
        topIssues: Object.entries(stats.issues)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 3)
          .map(([category, count]) => ({ category, count }))
      }))
      .sort((a, b) => b.totalCalls - a.totalCalls)
      .slice(0, 20)

    // Format issue pattern results
    const issuePatterns = Object.entries(industryFromIssues)
      .map(([category, stats]) => ({
        category,
        totalOccurrences: stats.total,
        highRiskAssociation: stats.highRisk,
        uniqueCities: stats.cities.size,
        riskRate: stats.total > 0 ? Math.round(stats.highRisk / stats.total * 100 * 10) / 10 : 0
      }))
      .sort((a, b) => b.totalOccurrences - a.totalOccurrences)

    // Format MCAT/Industry results
    const byIndustry = Object.entries(mcatStats)
      .filter(([mcat]) => mcat !== 'Unknown' && mcat !== 'Other')
      .map(([mcat, stats]) => ({
        industry: mcat,
        totalCalls: stats.total,
        highRiskCalls: stats.highRisk,
        deactivationIntents: stats.deactivation,
        uniqueCities: stats.cities.size,
        cityNames: Array.from(stats.cities).slice(0, 10), // Return up to 10 city names
        riskRate: stats.total > 0 ? Math.round(stats.highRisk / stats.total * 100 * 10) / 10 : 0,
        topIssues: Object.entries(stats.issues)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 3)
          .map(([category, count]) => ({ category, count })),
        tierDistribution: stats.tiers
      }))
      .sort((a, b) => b.totalCalls - a.totalCalls)
      .slice(0, 25)

    // Count mapped vs unmapped
    const mappedCalls = Object.entries(mcatStats)
      .filter(([mcat]) => mcat !== 'Unknown' && mcat !== 'Other')
      .reduce((sum, [, stats]) => sum + stats.total, 0)

    return NextResponse.json({
      byTier,
      byCity,
      byIndustry,
      issuePatterns,
      summary: {
        totalCalls: mergedCalls.length,
        totalCities: Object.keys(cityStats).length,
        totalIndustries: byIndustry.length,
        mappedCalls,
        unmappedCalls: mergedCalls.length - mappedCalls,
        tier1Calls: tierStats['Tier 1']?.total || 0,
        tier2Calls: tierStats['Tier 2']?.total || 0,
        tier3Calls: tierStats['Tier 3']?.total || 0
      }
    })

  } catch (error) {
    console.error('Error in industry analysis:', error)
    return NextResponse.json({ error: 'Failed to analyze' }, { status: 500 })
  }
}
