'use client'

import { useState, useEffect } from 'react'
import {
  Play,
  BookOpen,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  MapPin,
  Clock,
  ExternalLink,
  Copy,
  Check
} from 'lucide-react'

interface SOPRecommendation {
  issue_category: string
  sop_guidance: string
  source?: string
}

interface SOPAlert {
  level: string
  message: string
  reference: string
}

interface CallWithSOP {
  call_id: string
  ucid: string
  company_id: string | null  // GLID
  company_name: string | null
  city: string | null
  call_recording_url: string | null
  call_duration_seconds: number | null
  churn_risk_score: number | null
  deactivation_intent: boolean
  issues: Array<{
    category: string
    description: string
    severity: string
  }>
  sop_recommendations: SOPRecommendation[]
  sop_alert: SOPAlert | null
}

export default function CallsWithSOP() {
  const [calls, setCalls] = useState<CallWithSOP[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedCall, setExpandedCall] = useState<string | null>(null)
  const [copiedId, setCopiedId] = useState<string | null>(null)

  useEffect(() => {
    fetchCalls()
  }, [])

  const fetchCalls = async () => {
    try {
      const res = await fetch('/api/calls-with-sop')
      const data = await res.json()
      setCalls(data.calls || [])
    } catch (error) {
      console.error('Error fetching calls:', error)
    } finally {
      setLoading(false)
    }
  }

  const copyToClipboard = async (text: string, id: string) => {
    await navigator.clipboard.writeText(text)
    setCopiedId(id)
    setTimeout(() => setCopiedId(null), 2000)
  }

  const formatDuration = (seconds: number | null) => {
    if (!seconds) return '-'
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
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
    pns: 'PNS',
    enquiry: 'Enquiry',
    other: 'Other'
  }

  const severityColors: Record<string, string> = {
    critical: 'bg-red-100 text-red-800',
    high: 'bg-orange-100 text-orange-800',
    medium: 'bg-yellow-100 text-yellow-800',
    low: 'bg-green-100 text-green-800'
  }

  if (loading) {
    return (
      <div className="animate-pulse space-y-4">
        {[1, 2, 3].map(i => (
          <div key={i} className="h-32 bg-gray-200 rounded-lg" />
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold">Calls with SOP Recommendations</h3>
        <span className="text-sm text-gray-500">{calls.length} calls</span>
      </div>

      {calls.map(call => (
        <div
          key={call.call_id}
          className={`border rounded-lg overflow-hidden ${
            call.churn_risk_score && call.churn_risk_score >= 0.7
              ? 'border-red-300 bg-red-50'
              : 'border-gray-200 bg-white'
          }`}
        >
          {/* Header Row */}
          <div
            className="p-4 cursor-pointer hover:bg-gray-50"
            onClick={() => setExpandedCall(expandedCall === call.call_id ? null : call.call_id)}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                {/* Risk Badge */}
                <span className={`px-3 py-1 rounded-full text-sm font-bold ${
                  call.churn_risk_score && call.churn_risk_score >= 0.7
                    ? 'bg-red-600 text-white'
                    : call.churn_risk_score && call.churn_risk_score >= 0.4
                    ? 'bg-orange-500 text-white'
                    : 'bg-green-500 text-white'
                }`}>
                  {call.churn_risk_score ? `${Math.round(call.churn_risk_score * 100)}%` : 'N/A'}
                </span>

                {/* Call Info */}
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{call.company_name || 'Unknown Company'}</span>
                    {call.company_id && (
                      <span className="px-2 py-0.5 bg-gray-100 text-gray-600 text-xs rounded font-mono">
                        GLID: {call.company_id}
                      </span>
                    )}
                    {call.deactivation_intent && (
                      <span className="px-2 py-0.5 bg-red-100 text-red-700 text-xs rounded">
                        DEACT INTENT
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 text-sm text-gray-500">
                    {call.city && (
                      <span className="flex items-center gap-1">
                        <MapPin className="h-3 w-3" /> {call.city}
                      </span>
                    )}
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" /> {formatDuration(call.call_duration_seconds)}
                    </span>
                    <code className="text-xs bg-gray-100 px-1 rounded">
                      UCID: {call.ucid?.slice(0, 8)}...
                    </code>
                    <button
                      onClick={(e) => { e.stopPropagation(); copyToClipboard(call.ucid, call.call_id) }}
                      className="text-gray-400 hover:text-gray-600"
                    >
                      {copiedId === call.call_id ? <Check className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3" />}
                    </button>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3">
                {/* Recording Link */}
                {call.call_recording_url && (
                  <a
                    href={call.call_recording_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="flex items-center gap-1 px-3 py-1.5 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700"
                  >
                    <Play className="h-4 w-4" />
                    Play Recording
                    <ExternalLink className="h-3 w-3" />
                  </a>
                )}

                {/* SOP Count Badge */}
                {call.sop_recommendations && call.sop_recommendations.length > 0 && (
                  <span className="flex items-center gap-1 px-2 py-1 bg-purple-100 text-purple-700 rounded text-sm">
                    <BookOpen className="h-4 w-4" />
                    {call.sop_recommendations.length} SOPs
                  </span>
                )}

                {/* Expand Icon */}
                {expandedCall === call.call_id ? (
                  <ChevronUp className="h-5 w-5 text-gray-400" />
                ) : (
                  <ChevronDown className="h-5 w-5 text-gray-400" />
                )}
              </div>
            </div>
          </div>

          {/* Expanded Content */}
          {expandedCall === call.call_id && (
            <div className="border-t bg-white p-4 space-y-4">
              {/* SOP Alert */}
              {call.sop_alert && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="h-5 w-5 text-red-600 mt-0.5" />
                    <div>
                      <p className="font-medium text-red-800">SOP Alert</p>
                      <p className="text-sm text-red-700">{call.sop_alert.message}</p>
                      <p className="text-xs text-red-600 mt-1">Reference: {call.sop_alert.reference}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Issues Detected */}
              {call.issues && call.issues.length > 0 && (
                <div>
                  <h4 className="font-medium text-gray-700 mb-2">Issues Detected:</h4>
                  <div className="flex flex-wrap gap-2">
                    {call.issues.map((issue, idx) => (
                      <div key={idx} className="flex items-center gap-2 px-2 py-1 bg-gray-100 rounded">
                        <span className={`px-1.5 py-0.5 rounded text-xs ${severityColors[issue.severity] || 'bg-gray-200'}`}>
                          {issue.severity}
                        </span>
                        <span className="text-sm">{categoryLabels[issue.category] || issue.category}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* SOP Recommendations */}
              {call.sop_recommendations && call.sop_recommendations.length > 0 && (
                <div>
                  <h4 className="font-medium text-gray-700 mb-3 flex items-center gap-2">
                    <BookOpen className="h-5 w-5 text-blue-600" />
                    Action Steps:
                  </h4>
                  <div className="grid gap-3 md:grid-cols-2">
                    {call.sop_recommendations.map((sop, idx) => (
                      <div key={idx} className="p-3 bg-gradient-to-br from-blue-50 to-white border border-blue-200 rounded-lg">
                        <div className="font-semibold text-blue-800 mb-2 text-sm">
                          {sop.title || categoryLabels[sop.issue_category] || sop.issue_category}
                        </div>
                        {sop.steps && sop.steps.length > 0 ? (
                          <ul className="text-xs text-gray-700 space-y-1">
                            {sop.steps.slice(0, 4).map((step: string, stepIdx: number) => (
                              <li key={stepIdx} className="flex items-start gap-1">
                                <span className="text-blue-500 mt-0.5">•</span>
                                <span>{step.replace(/^\d+\.\s*/, '')}</span>
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <p className="text-xs text-gray-600">{sop.sop_guidance?.slice(0, 150)}...</p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Full Recording Link */}
              {call.call_recording_url && (
                <div className="pt-3 border-t">
                  <p className="text-sm text-gray-500 mb-1">Recording URL:</p>
                  <div className="flex items-center gap-2">
                    <code className="text-xs bg-gray-100 px-2 py-1 rounded flex-1 overflow-hidden text-ellipsis">
                      {call.call_recording_url}
                    </code>
                    <button
                      onClick={() => copyToClipboard(call.call_recording_url!, `url-${call.call_id}`)}
                      className="px-2 py-1 text-gray-500 hover:text-gray-700"
                    >
                      {copiedId === `url-${call.call_id}` ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      ))}

      {calls.length === 0 && (
        <div className="text-center py-12 text-gray-500">
          <BookOpen className="mx-auto h-12 w-12 text-gray-300" />
          <p className="mt-4">No calls with SOP recommendations found</p>
        </div>
      )}
    </div>
  )
}
