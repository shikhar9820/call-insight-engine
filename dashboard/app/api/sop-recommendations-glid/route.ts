import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export const dynamic = 'force-dynamic'
export const revalidate = 0

type SopRec = {
  issue_category?: string
  category?: string
  sop_guidance?: string
  guidance?: string
  text?: string
  source?: string
}

type SeverityLabel = 'critical' | 'high' | 'medium' | 'low'

type SeverityCounts = {
  critical: number
  high: number
  medium: number
  low: number
}

type AggregatedRec = {
  issue_category: string
  count: number
  last_seen: string | null
  sop_guidance: string | null
  source?: string | null
  max_severity: SeverityLabel | null
  severity_counts: SeverityCounts
}

const SEVERITY_ORDER: Record<SeverityLabel, number> = {
  critical: 4,
  high: 3,
  medium: 2,
  low: 1
}

const SEVERITY_WEIGHT: Record<SeverityLabel, number> = {
  critical: 3,
  high: 2,
  medium: 1,
  low: 0.5
}

function parseRawSummary(raw: unknown): any | null {
  if (!raw) return null
  if (typeof raw === 'string') {
    try {
      return JSON.parse(raw)
    } catch {
      return null
    }
  }
  return raw
}

function toIso(value: string | null | undefined): string | null {
  if (!value) return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date.toISOString()
}

function normalizeSeverity(value: unknown): SeverityLabel | null {
  if (typeof value !== 'string') return null
  const label = value.trim().toLowerCase() as SeverityLabel
  return SEVERITY_ORDER[label] ? label : null
}

function initSeverityCounts(): SeverityCounts {
  return { critical: 0, high: 0, medium: 0, low: 0 }
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const companyId = searchParams.get('company_id')

    if (!companyId) {
      return NextResponse.json({ error: 'company_id is required' }, { status: 400 })
    }

    const { data, error } = await supabase
      .from('calls')
      .select(`
        id,
        company_id,
        ucid,
        call_start_time,
        created_at,
        call_insights(raw_summary)
      `)
      .eq('company_id', companyId)

    if (error) throw error

    const calls = data || []
    const totalCalls = calls.length

    let firstCall: string | null = null
    let lastCall: string | null = null
    let callsWithRag = 0

    const aggregated = new Map<string, AggregatedRec>()

    for (const call of calls) {
      const callTime = toIso(call.call_start_time || call.created_at)
      if (callTime) {
        if (!firstCall || callTime < firstCall) firstCall = callTime
        if (!lastCall || callTime > lastCall) lastCall = callTime
      }

      const insights = Array.isArray(call.call_insights) ? call.call_insights : []
      if (!insights.length) continue

      const seenCats = new Set<string>()
      let hasRag = false

      for (const insight of insights) {
        const raw = parseRawSummary(insight?.raw_summary)
        const recs = Array.isArray(raw?.sop_recommendations) ? raw.sop_recommendations : []
        const issues = Array.isArray(raw?.issues) ? raw.issues : []

        if (!recs.length) continue
        hasRag = true

        const issueSeverityByCategory = new Map<string, { label: SeverityLabel; rank: number }>()
        for (const issue of issues) {
          const category = issue?.category
          const severityLabel = normalizeSeverity(issue?.severity)
          if (!category || !severityLabel) continue

          const rank = SEVERITY_ORDER[severityLabel]
          const existing = issueSeverityByCategory.get(category)
          if (!existing || rank > existing.rank) {
            issueSeverityByCategory.set(category, { label: severityLabel, rank })
          }
        }

        for (const rec of recs as SopRec[]) {
          const category = rec.issue_category || rec.category
          if (!category) continue

          const severityInfo = issueSeverityByCategory.get(category)

          if (!seenCats.has(category)) {
            seenCats.add(category)
            const existing = aggregated.get(category)
            if (existing) {
              existing.count += 1
              if (severityInfo) {
                existing.severity_counts[severityInfo.label] += 1
                if (!existing.max_severity || severityInfo.rank > SEVERITY_ORDER[existing.max_severity]) {
                  existing.max_severity = severityInfo.label
                }
              }
            } else {
              const severityCounts = initSeverityCounts()
              if (severityInfo) {
                severityCounts[severityInfo.label] = 1
              }

              aggregated.set(category, {
                issue_category: category,
                count: 1,
                last_seen: null,
                sop_guidance: null,
                source: null,
                max_severity: severityInfo ? severityInfo.label : null,
                severity_counts: severityCounts
              })
            }
          }

          const entry = aggregated.get(category)
          if (!entry) continue

          if (callTime && (!entry.last_seen || callTime > entry.last_seen)) {
            entry.last_seen = callTime
            entry.sop_guidance = rec.sop_guidance || rec.guidance || rec.text || null
            entry.source = rec.source || null
          }
        }
      }

      if (hasRag) callsWithRag += 1
    }

    const cumulativeSop = Array.from(aggregated.values())
      .map(entry => {
        const severityScore =
          entry.severity_counts.critical * SEVERITY_WEIGHT.critical +
          entry.severity_counts.high * SEVERITY_WEIGHT.high +
          entry.severity_counts.medium * SEVERITY_WEIGHT.medium +
          entry.severity_counts.low * SEVERITY_WEIGHT.low

        return { ...entry, severity_score: severityScore }
      })
      .sort((a, b) => {
        if (b.severity_score !== a.severity_score) return b.severity_score - a.severity_score
        if (b.count !== a.count) return b.count - a.count
        return a.issue_category.localeCompare(b.issue_category)
      })
      .map(({ severity_score, ...rest }) => rest)

    return NextResponse.json({
      company_id: companyId,
      total_calls: totalCalls,
      calls_with_rag: callsWithRag,
      date_range: {
        first_call: firstCall,
        last_call: lastCall
      },
      cumulative_sop: cumulativeSop
    })
  } catch (error) {
    console.error('Error fetching cumulative SOP for GLID:', error)
    return NextResponse.json({ error: 'Failed to fetch cumulative SOP' }, { status: 500 })
  }
}
