'use client'

import { useState } from 'react'
import { ChevronDown, ChevronUp, Phone, Clock, TrendingUp, TrendingDown, Minus, Copy, Check, Play, BookOpen, X } from 'lucide-react'
import { format } from 'date-fns'

interface CallIssue {
  category: string
  subcategory?: string
  description: string
  severity: string
}

interface Call {
  id: string
  ucid: string
  call_start_time: string
  employee_name: string | null
  customer_mobile: string | null
  company_name: string | null
  call_duration_seconds: number | null
  call_direction: string | null
  call_recording_url?: string | null
  call_insights: Array<{
    churn_risk_score: number | null
    sentiment_trajectory: string | null
    sentiment_start: string | null
    sentiment_end: string | null
    call_purpose: string | null
    resolution_status: string | null
    deactivation_intent: boolean | null
    topics: string[]
    issues?: CallIssue[]
    raw_summary?: any
  }>
}

// SOP guidance mapping
const SOP_GUIDANCE: Record<string, string> = {
  'buylead_relevance': `**BuyLead Relevance SOP:**
1. Check if categories are mapped correctly in Seller Panel
2. Review "Recommended Products" section
3. Ensure Catalog Quality Score (CQS) > 80%
4. Verify product descriptions, photos, and prices are complete
5. If still irrelevant, escalate to category mapping team`,
  'buylead_availability': `**BuyLead Availability SOP:**
1. Check total approved BuyLeads in seller's categories
2. If < 10 leads available, explain low demand in category
3. Suggest adding more product categories
4. Guide seller to "Recommended Products" to expand catalog
5. Ask seller to check again next day after changes`,
  'buylead_roi': `**BuyLead ROI SOP:**
1. Review seller's consumption pattern and conversion rate
2. Check if seller is using filters effectively
3. Verify seller is contacting leads promptly (within 1 hour)
4. Suggest GST-verified and membership leads for better quality
5. If persistent, discuss plan upgrade or category optimization`,
  'payment': `**Payment Issue SOP:**
1. Verify payment status in backend system
2. Check for any pending refund requests
3. If double charge, initiate refund ticket immediately
4. For EMI issues, connect with finance team
5. Document all payment disputes with transaction IDs`,
  'subscription': `**Subscription SOP:**
1. Explain current plan benefits clearly
2. For upgrade requests, show comparison of plans
3. For downgrade, check if any pending dues
4. For renewal issues, verify auto-renewal settings
5. For cancellation, follow Deactivation SOP`,
  'deactivation': `**Deactivation SOP (CRITICAL):**
1. FIRST: Understand the root cause of deactivation request
2. Offer resolution for underlying issues
3. If service-related: Offer complimentary extension (max 1-2 months)
4. If BuyLead concern: Offer free leads (min 25, max 50)
5. If still wants to deactivate: Process as per policy
6. Document reason in ticket for retention analysis`,
  'technical': `**Technical Issues SOP:**
1. Ask seller to log out and log in again
2. Try alternate browser (Chrome/Firefox)
3. On mobile: Reinstall or update the app
4. Clear cache and cookies
5. If persists: Raise technical support ticket`,
  'catalog': `**Catalog Issues SOP:**
1. Check product visibility in search
2. Verify catalog quality score (target > 80%)
3. Ensure all required fields are filled
4. Check if products are in correct categories
5. For visibility issues, raise mapping ticket`,
  'employee': `**Employee Complaint SOP:**
1. Apologize for any inconvenience caused
2. Document the specific complaint
3. Assure customer of internal review
4. Do NOT promise disciplinary action
5. Escalate to team lead if serious`,
  'pns': `**PNS (Preferred Number Service) SOP:**
1. Check PNS response rate in seller profile
2. Review missed call patterns
3. Ensure seller has app notifications enabled
4. Suggest setting business hours properly
5. If persistent defaulter, warn about service impact`,
  'enquiry': `**Enquiry SOP:**
1. Verify enquiry visibility in seller panel
2. Check spam/junk folder settings
3. Ensure email notifications are enabled
4. Review enquiry quality and relevance
5. Guide on quick response best practices`,
  'other': `**General Escalation SOP:**
1. Listen to the complete concern
2. Document all details accurately
3. Check if issue falls under any specific category
4. If unclear, escalate to team lead
5. Set clear expectations on resolution timeline`
}

const categoryLabels: Record<string, string> = {
  buylead_relevance: 'BuyLead Relevance',
  buylead_availability: 'BuyLead Availability',
  buylead_roi: 'BuyLead ROI',
  buylead_accessibility: 'BuyLead Access',
  payment: 'Payment',
  subscription: 'Subscription',
  deactivation: 'Deactivation',
  technical: 'Technical',
  catalog: 'Catalog',
  employee: 'Employee',
  pns: 'Preferred Number Service',
  enquiry: 'Enquiry',
  other: 'Other'
}

interface CallsTableProps {
  calls: Call[]
  loading?: boolean
  onCallClick?: (call: Call) => void
}

export default function CallsTable({ calls, loading, onCallClick }: CallsTableProps) {
  const [sortField, setSortField] = useState<string>('call_start_time')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')
  const [copiedUcid, setCopiedUcid] = useState<string | null>(null)
  const [sopModalCall, setSopModalCall] = useState<Call | null>(null)
  const [playingAudio, setPlayingAudio] = useState<string | null>(null)

  const handlePlayRecording = (e: React.MouseEvent, recordingUrl: string) => {
    e.stopPropagation()
    if (playingAudio === recordingUrl) {
      setPlayingAudio(null)
    } else {
      setPlayingAudio(recordingUrl)
      // Open in new window for playback
      window.open(recordingUrl, '_blank', 'width=400,height=200')
    }
  }

  const handleShowSOP = (e: React.MouseEvent, call: Call) => {
    e.stopPropagation()
    setSopModalCall(call)
  }

  const getIssuesFromCall = (call: Call): CallIssue[] => {
    const insight = call.call_insights?.[0]
    if (!insight) return []

    // Try to get issues from raw_summary first
    if (insight.raw_summary) {
      const rawSummary = typeof insight.raw_summary === 'string'
        ? JSON.parse(insight.raw_summary)
        : insight.raw_summary
      if (rawSummary?.issues) return rawSummary.issues
    }

    // Fall back to issues array
    return insight.issues || []
  }

  const copyUcid = async (e: React.MouseEvent, ucid: string) => {
    e.stopPropagation()
    await navigator.clipboard.writeText(ucid)
    setCopiedUcid(ucid)
    setTimeout(() => setCopiedUcid(null), 2000)
  }

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortOrder('desc')
    }
  }

  const getRiskBadge = (score: number | null) => {
    if (score === null) return { style: 'bg-gray-100 text-gray-600', label: 'N/A' }
    if (score >= 0.7) return { style: 'bg-red-100 text-red-700', label: 'High' }
    if (score >= 0.4) return { style: 'bg-amber-100 text-amber-700', label: 'Medium' }
    return { style: 'bg-green-100 text-green-700', label: 'Low' }
  }

  const getSentimentIcon = (trajectory: string | null) => {
    if (trajectory === 'improving') return <TrendingUp className="h-4 w-4 text-green-500" />
    if (trajectory === 'declining') return <TrendingDown className="h-4 w-4 text-red-500" />
    return <Minus className="h-4 w-4 text-gray-400" />
  }

  const formatDuration = (seconds: number | null) => {
    if (!seconds) return '-'
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  if (loading) {
    return (
      <div className="animate-pulse">
        <div className="h-10 bg-gray-200 rounded mb-2" />
        {[1, 2, 3, 4, 5].map(i => (
          <div key={i} className="h-16 bg-gray-100 rounded mb-2" />
        ))}
      </div>
    )
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              UCID
            </th>
            <th
              className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
              onClick={() => handleSort('call_start_time')}
            >
              <div className="flex items-center gap-1">
                Time
                {sortField === 'call_start_time' && (
                  sortOrder === 'asc' ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />
                )}
              </div>
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Company
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Duration
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Risk
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Sentiment
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Purpose
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Status
            </th>
            <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
              Actions
            </th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {calls.map(call => {
            const insight = call.call_insights?.[0]
            const risk = getRiskBadge(insight?.churn_risk_score ?? null)
            const hasDeactivationIntent = insight?.deactivation_intent

            return (
              <tr
                key={call.id}
                className={`hover:bg-gray-50 cursor-pointer ${hasDeactivationIntent ? 'bg-red-50' : ''}`}
                onClick={() => onCallClick?.(call)}
              >
                <td className="px-4 py-4 whitespace-nowrap">
                  <div className="flex items-center gap-2">
                    <code className="text-xs font-mono bg-gray-100 px-1.5 py-0.5 rounded border">
                      {call.ucid?.slice(0, 8) || 'N/A'}...
                    </code>
                    <button
                      onClick={(e) => copyUcid(e, call.ucid)}
                      className="text-gray-400 hover:text-gray-600"
                      title="Copy full UCID"
                    >
                      {copiedUcid === call.ucid ? (
                        <Check className="h-3 w-3 text-green-500" />
                      ) : (
                        <Copy className="h-3 w-3" />
                      )}
                    </button>
                    {hasDeactivationIntent && (
                      <span className="px-1 py-0.5 bg-red-100 text-red-700 text-xs rounded">
                        DEACT
                      </span>
                    )}
                  </div>
                </td>
                <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-600">
                  {call.call_start_time
                    ? format(new Date(call.call_start_time), 'dd MMM HH:mm')
                    : '-'
                  }
                </td>
                <td className="px-4 py-4">
                  <div className="text-sm font-medium text-gray-900">{call.company_name || '-'}</div>
                  <div className="text-xs text-gray-500">{call.employee_name || 'Unknown'}</div>
                </td>
                <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-600">
                  <div className="flex items-center gap-1">
                    <Clock className="h-4 w-4" />
                    {formatDuration(call.call_duration_seconds)}
                  </div>
                </td>
                <td className="px-4 py-4 whitespace-nowrap">
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${risk.style}`}>
                    {risk.label}
                    {insight?.churn_risk_score !== null && (
                      <span className="ml-1">({Math.round((insight?.churn_risk_score || 0) * 100)}%)</span>
                    )}
                  </span>
                </td>
                <td className="px-4 py-4 whitespace-nowrap">
                  <div className="flex flex-col">
                    <div className="flex items-center gap-1">
                      {getSentimentIcon(insight?.sentiment_trajectory ?? null)}
                      <span className="text-sm text-gray-600 capitalize">
                        {insight?.sentiment_trajectory || '-'}
                      </span>
                    </div>
                    {insight?.sentiment_start && insight?.sentiment_end && (
                      <span className="text-xs text-gray-400">
                        {insight.sentiment_start} → {insight.sentiment_end}
                      </span>
                    )}
                  </div>
                </td>
                <td className="px-4 py-4 text-sm text-gray-600 max-w-xs truncate capitalize">
                  {insight?.call_purpose || '-'}
                </td>
                <td className="px-4 py-4 whitespace-nowrap">
                  <span className={`px-2 py-1 rounded text-xs font-medium ${
                    insight?.resolution_status === 'resolved'
                      ? 'bg-green-100 text-green-700'
                      : insight?.resolution_status === 'partial'
                      ? 'bg-yellow-100 text-yellow-700'
                      : insight?.resolution_status === 'unresolved'
                      ? 'bg-red-100 text-red-700'
                      : 'bg-gray-100 text-gray-600'
                  }`}>
                    {insight?.resolution_status || 'N/A'}
                  </span>
                </td>
                <td className="px-4 py-4 whitespace-nowrap">
                  <div className="flex items-center justify-center gap-2">
                    {/* Play Recording Button */}
                    {call.call_recording_url && (
                      <button
                        onClick={(e) => handlePlayRecording(e, call.call_recording_url!)}
                        className="p-1.5 rounded-full bg-green-100 text-green-600 hover:bg-green-200 transition-colors"
                        title="Play Recording"
                      >
                        <Play className="h-4 w-4" />
                      </button>
                    )}
                    {/* SOP Guide Button */}
                    <button
                      onClick={(e) => handleShowSOP(e, call)}
                      className="p-1.5 rounded-full bg-blue-100 text-blue-600 hover:bg-blue-200 transition-colors"
                      title="View SOP Guidance"
                    >
                      <BookOpen className="h-4 w-4" />
                    </button>
                  </div>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>

      {!calls.length && (
        <div className="text-center py-12 text-gray-500">
          <Phone className="mx-auto h-12 w-12 text-gray-300" />
          <p className="mt-4">No calls found</p>
        </div>
      )}

      {/* SOP Guidance Modal */}
      {sopModalCall && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[80vh] overflow-hidden">
            {/* Modal Header */}
            <div className="bg-blue-600 text-white px-6 py-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <BookOpen className="h-5 w-5" />
                <h3 className="font-semibold">SOP Guidance</h3>
              </div>
              <button
                onClick={() => setSopModalCall(null)}
                className="p-1 hover:bg-blue-700 rounded"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-6 overflow-y-auto max-h-[calc(80vh-80px)]">
              {/* Call Info */}
              <div className="mb-4 p-3 bg-gray-50 rounded-lg">
                <p className="text-sm text-gray-600">
                  <span className="font-medium">Company:</span> {sopModalCall.company_name || 'Unknown'}
                </p>
                <p className="text-sm text-gray-600">
                  <span className="font-medium">UCID:</span> {sopModalCall.ucid}
                </p>
              </div>

              {/* Issues and SOP */}
              {(() => {
                const issues = getIssuesFromCall(sopModalCall)
                if (issues.length === 0) {
                  return (
                    <div className="text-center py-8 text-gray-500">
                      <BookOpen className="mx-auto h-10 w-10 text-gray-300 mb-2" />
                      <p>No issues detected for this call</p>
                      <p className="text-sm mt-1">SOP guidance not required</p>
                    </div>
                  )
                }

                // Get unique categories from issues
                const uniqueCategories = [...new Set(issues.map(i => i.category))]

                return (
                  <div className="space-y-4">
                    <h4 className="font-medium text-gray-700">
                      Detected Issues ({issues.length})
                    </h4>

                    {uniqueCategories.map(category => {
                      const categoryIssues = issues.filter(i => i.category === category)
                      const sopGuidance = SOP_GUIDANCE[category] || SOP_GUIDANCE['other']

                      return (
                        <div key={category} className="border rounded-lg overflow-hidden">
                          {/* Issue Category Header */}
                          <div className="bg-gray-100 px-4 py-2 border-b">
                            <span className="font-medium text-gray-700">
                              {categoryLabels[category] || category}
                            </span>
                            <span className="ml-2 text-xs text-gray-500">
                              ({categoryIssues.length} issue{categoryIssues.length > 1 ? 's' : ''})
                            </span>
                          </div>

                          {/* Issues List */}
                          <div className="p-3 space-y-2 bg-white">
                            {categoryIssues.map((issue, idx) => (
                              <div key={idx} className="flex items-start gap-2">
                                <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${
                                  issue.severity === 'critical' ? 'bg-red-100 text-red-700' :
                                  issue.severity === 'high' ? 'bg-orange-100 text-orange-700' :
                                  issue.severity === 'medium' ? 'bg-yellow-100 text-yellow-700' :
                                  'bg-green-100 text-green-700'
                                }`}>
                                  {issue.severity}
                                </span>
                                <p className="text-sm text-gray-600">{issue.description}</p>
                              </div>
                            ))}
                          </div>

                          {/* SOP Guidance */}
                          <div className="p-3 bg-blue-50 border-t border-blue-100">
                            <div className="flex items-start gap-2">
                              <BookOpen className="h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0" />
                              <div className="text-sm text-blue-800 whitespace-pre-line">
                                {sopGuidance}
                              </div>
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )
              })()}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
