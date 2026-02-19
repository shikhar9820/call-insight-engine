'use client'

import { useState, useEffect } from 'react'
import { BookOpen, AlertTriangle, ChevronDown, ChevronUp, Building, MapPin, FileText } from 'lucide-react'

interface Issue {
  id: string
  category: string
  subcategory?: string
  description: string
  severity: string
  sop_guidance: string
  calls?: {
    ucid: string
    company_name: string
    company_id: string
    city: string
  }
}

interface SOPAlert {
  call_id: string
  ucid: string
  company_name: string
  city: string
  churn_risk: number
  deactivation_intent: boolean
  sop_alert: {
    level: string
    message: string
    reference: string
  }
  sop_recommendations: Array<{
    issue_category: string
    sop_guidance: string
    reference: string
  }>
}

interface SOPData {
  critical_issues_with_sop: Issue[]
  high_risk_sop_alerts: SOPAlert[]
  available_sops: string[]
}

export default function SOPRecommendations() {
  const [data, setData] = useState<SOPData | null>(null)
  const [loading, setLoading] = useState(true)
  const [expandedIssues, setExpandedIssues] = useState<Set<string>>(new Set())
  const [expandedAlerts, setExpandedAlerts] = useState<Set<string>>(new Set())

  useEffect(() => {
    fetchSOPData()
  }, [])

  const fetchSOPData = async () => {
    try {
      const res = await fetch('/api/sop-recommendations')
      const json = await res.json()
      setData(json)
    } catch (error) {
      console.error('Error fetching SOP data:', error)
    } finally {
      setLoading(false)
    }
  }

  const toggleIssue = (id: string) => {
    setExpandedIssues(prev => {
      const newSet = new Set(prev)
      if (newSet.has(id)) {
        newSet.delete(id)
      } else {
        newSet.add(id)
      }
      return newSet
    })
  }

  const toggleAlert = (id: string) => {
    setExpandedAlerts(prev => {
      const newSet = new Set(prev)
      if (newSet.has(id)) {
        newSet.delete(id)
      } else {
        newSet.add(id)
      }
      return newSet
    })
  }

  const severityColors: Record<string, string> = {
    critical: 'bg-red-100 text-red-800 border-red-300',
    high: 'bg-orange-100 text-orange-800 border-orange-300',
    medium: 'bg-yellow-100 text-yellow-800 border-yellow-300',
    low: 'bg-green-100 text-green-800 border-green-300'
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

  if (loading) {
    return (
      <div className="animate-pulse space-y-4">
        <div className="h-8 bg-gray-200 rounded w-1/3" />
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-24 bg-gray-200 rounded" />
          ))}
        </div>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="text-center py-8 text-gray-500">
        <BookOpen className="mx-auto h-12 w-12 text-gray-300" />
        <p className="mt-2">No SOP data available</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* High Risk SOP Alerts */}
      <div className="bg-red-50 border border-red-200 rounded-xl p-4">
        <h3 className="text-lg font-semibold text-red-700 mb-4 flex items-center gap-2">
          <AlertTriangle className="h-5 w-5" />
          High Risk Calls - SOP Guidance Required
        </h3>

        <div className="space-y-3">
          {data.high_risk_sop_alerts?.slice(0, 5).map(alert => (
            <div key={alert.call_id} className="bg-white rounded-lg border border-red-200 overflow-hidden">
              <div
                className="p-3 cursor-pointer hover:bg-red-50 transition-colors"
                onClick={() => toggleAlert(alert.call_id)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className={`px-2 py-1 rounded text-xs font-bold ${
                      alert.churn_risk >= 80 ? 'bg-red-600 text-white' : 'bg-orange-500 text-white'
                    }`}>
                      {alert.churn_risk}% Risk
                    </span>
                    <div>
                      <span className="font-medium text-gray-900">{alert.company_name || 'Unknown'}</span>
                      {alert.city && (
                        <span className="text-sm text-gray-500 ml-2 flex items-center gap-1 inline-flex">
                          <MapPin className="h-3 w-3" /> {alert.city}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {alert.deactivation_intent && (
                      <span className="px-2 py-0.5 bg-red-100 text-red-700 rounded text-xs">DEACT INTENT</span>
                    )}
                    {expandedAlerts.has(alert.call_id) ? (
                      <ChevronUp className="h-5 w-5 text-gray-400" />
                    ) : (
                      <ChevronDown className="h-5 w-5 text-gray-400" />
                    )}
                  </div>
                </div>
              </div>

              {expandedAlerts.has(alert.call_id) && (
                <div className="px-3 pb-3 border-t border-red-100">
                  {/* SOP Alert Message */}
                  <div className="mt-3 p-3 bg-red-50 rounded-lg border border-red-200">
                    <div className="flex items-start gap-2">
                      <BookOpen className="h-5 w-5 text-red-600 mt-0.5" />
                      <div>
                        <p className="font-medium text-red-800">Recommended Action:</p>
                        <p className="text-sm text-red-700 mt-1">{alert.sop_alert?.message}</p>
                        <p className="text-xs text-red-600 mt-2">Reference: {alert.sop_alert?.reference}</p>
                      </div>
                    </div>
                  </div>

                  {/* SOP Recommendations from RAG */}
                  {alert.sop_recommendations && alert.sop_recommendations.length > 0 && (
                    <div className="mt-3">
                      <p className="text-sm font-medium text-gray-700 mb-2">Detailed SOP Guidance:</p>
                      <div className="space-y-2">
                        {alert.sop_recommendations.map((rec, idx) => (
                          <div key={idx} className="p-2 bg-blue-50 rounded border border-blue-200">
                            <span className="text-xs font-medium text-blue-700">
                              {categoryLabels[rec.issue_category] || rec.issue_category}:
                            </span>
                            <p className="text-xs text-gray-600 mt-1 whitespace-pre-wrap">
                              {rec.sop_guidance?.slice(0, 300)}...
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Critical Issues with SOP */}
      <div className="bg-white border rounded-xl p-4">
        <h3 className="text-lg font-semibold text-gray-700 mb-4 flex items-center gap-2">
          <FileText className="h-5 w-5" />
          Issue Resolution Guide (SOP)
        </h3>

        <div className="space-y-2">
          {data.critical_issues_with_sop?.slice(0, 10).map(issue => (
            <div key={issue.id} className="border rounded-lg overflow-hidden">
              <div
                className="p-3 cursor-pointer hover:bg-gray-50 transition-colors flex items-center justify-between"
                onClick={() => toggleIssue(issue.id)}
              >
                <div className="flex items-center gap-3">
                  <span className={`px-2 py-0.5 rounded text-xs font-medium border ${severityColors[issue.severity]}`}>
                    {issue.severity?.toUpperCase()}
                  </span>
                  <span className="px-2 py-0.5 bg-gray-100 text-gray-700 rounded text-xs">
                    {categoryLabels[issue.category] || issue.category}
                  </span>
                  <span className="text-sm text-gray-600 truncate max-w-md">
                    {issue.description?.slice(0, 60)}...
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  {issue.calls?.company_name && (
                    <span className="text-xs text-gray-500 flex items-center gap-1">
                      <Building className="h-3 w-3" />
                      {issue.calls.company_name?.slice(0, 20)}
                    </span>
                  )}
                  {expandedIssues.has(issue.id) ? (
                    <ChevronUp className="h-5 w-5 text-gray-400" />
                  ) : (
                    <ChevronDown className="h-5 w-5 text-gray-400" />
                  )}
                </div>
              </div>

              {expandedIssues.has(issue.id) && (
                <div className="px-3 pb-3 border-t bg-gray-50">
                  <div className="mt-3">
                    <p className="text-sm font-medium text-gray-700">Issue Description:</p>
                    <p className="text-sm text-gray-600 mt-1">{issue.description}</p>
                  </div>

                  <div className="mt-3 p-3 bg-blue-50 rounded-lg border border-blue-200">
                    <div className="flex items-start gap-2">
                      <BookOpen className="h-5 w-5 text-blue-600 mt-0.5" />
                      <div>
                        <p className="font-medium text-blue-800">SOP Guidance:</p>
                        <div className="text-sm text-blue-700 mt-1 whitespace-pre-wrap">
                          {issue.sop_guidance}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Available SOPs Reference */}
      <div className="bg-gray-50 border rounded-xl p-4">
        <h4 className="font-medium text-gray-700 mb-3">Available SOP Categories:</h4>
        <div className="flex flex-wrap gap-2">
          {data.available_sops?.map(sop => (
            <span key={sop} className="px-3 py-1 bg-white border rounded-full text-sm text-gray-600">
              {categoryLabels[sop] || sop}
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}
