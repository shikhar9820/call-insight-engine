import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

// Disable caching to always get fresh data
export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const sortBy = searchParams.get('sortBy') || 'created_at'
    const sortOrder = searchParams.get('sortOrder') || 'desc'
    const riskFilter = searchParams.get('risk') // 'high', 'medium', 'low'
    const searchQuery = searchParams.get('search')

    const offset = (page - 1) * limit

    // Build query
    let query = supabase
      .from('calls')
      .select(`
        *,
        call_recording_url,
        call_insights (
          id,
          churn_risk_score,
          deactivation_intent,
          sentiment_start,
          sentiment_end,
          sentiment_trajectory,
          call_purpose,
          resolution_status,
          issues,
          topics,
          raw_summary
        )
      `, { count: 'exact' })

    // Apply search filter
    if (searchQuery) {
      query = query.or(`ucid.ilike.%${searchQuery}%,employee_name.ilike.%${searchQuery}%,company_name.ilike.%${searchQuery}%`)
    }

    // Apply sorting and pagination
    query = query
      .order(sortBy, { ascending: sortOrder === 'asc' })
      .range(offset, offset + limit - 1)

    const { data: calls, count, error } = await query

    if (error) throw error

    // Filter by risk level in memory (since it's in the joined table)
    let filteredCalls = calls || []
    if (riskFilter) {
      filteredCalls = filteredCalls.filter(call => {
        const insight = call.call_insights?.[0]
        const risk = insight?.churn_risk_score || 0

        if (riskFilter === 'high') return risk >= 0.7
        if (riskFilter === 'medium') return risk >= 0.4 && risk < 0.7
        if (riskFilter === 'low') return risk < 0.4
        return true
      })
    }

    return NextResponse.json({
      calls: filteredCalls,
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit)
      }
    })
  } catch (error) {
    console.error('Error fetching calls:', error)
    return NextResponse.json({ error: 'Failed to fetch calls' }, { status: 500 })
  }
}
