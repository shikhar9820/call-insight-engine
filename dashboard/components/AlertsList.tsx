'use client'

import { useState } from 'react'
import { AlertTriangle, Phone, User, Building, Clock, ChevronRight, Copy, Check, Play, FileText, MapPin, X } from 'lucide-react'
import { format } from 'date-fns'

interface Alert {
  id: string
  churn_risk_score: number
  deactivation_intent: boolean
  escalation_threatened: boolean
  legal_threat: boolean
  call_purpose: string | null
  alert_types: string[]
  severity: 'critical' | 'high' | 'medium'
  calls: {
    ucid: string
    call_start_time: string
    employee_name: string
    customer_mobile: string
    company_name: string
    company_id: string
    call_duration_seconds: number
    call_recording_url: string
    vertical_name: string
  }
  call_transcripts?: Array<{
    id: string
    transcript: string
    translation: string
  }>
}

interface AlertsListProps {
  alerts: Alert[]
  loading?: boolean
}

export default function AlertsList({ alerts, loading }: AlertsListProps) {
  const [copiedUcid, setCopiedUcid] = useState<string | null>(null)
  const [showTranscript, setShowTranscript] = useState<Alert | null>(null)

  const copyUcid = async (e: React.MouseEvent, ucid: string) => {
    e.stopPropagation()
    await navigator.clipboard.writeText(ucid)
    setCopiedUcid(ucid)
    setTimeout(() => setCopiedUcid(null), 2000)
  }

  const openRecording = (e: React.MouseEvent, url: string) => {
    e.stopPropagation()
    if (url) window.open(url, '_blank')
  }

  const openTranscript = (e: React.MouseEvent, alert: Alert) => {
    e.stopPropagation()
    setShowTranscript(alert)
  }
  const severityStyles = {
    critical: 'border-l-4 border-l-red-500 bg-red-50',
    high: 'border-l-4 border-l-orange-500 bg-orange-50',
    medium: 'border-l-4 border-l-yellow-500 bg-yellow-50'
  }

  const severityBadge = {
    critical: 'bg-red-100 text-red-800',
    high: 'bg-orange-100 text-orange-800',
    medium: 'bg-yellow-100 text-yellow-800'
  }

  const alertTypeLabels: Record<string, string> = {
    'HIGH_CHURN_RISK': 'High Churn Risk',
    'DEACTIVATION_INTENT': 'Deactivation Intent',
    'DEACTIVATION_CONFIRMED': 'Deactivation Confirmed',
    'ESCALATION_THREAT': 'Escalation Threat',
    'LEGAL_THREAT': 'Legal Threat',
    'REFUND_REQUEST': 'Refund Request',
    'PAYMENT_DISPUTE': 'Payment Dispute'
  }

  if (loading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map(i => (
          <div key={i} className="animate-pulse bg-gray-100 rounded-lg h-32" />
        ))}
      </div>
    )
  }

  if (!alerts.length) {
    return (
      <div className="text-center py-12 text-gray-500">
        <AlertTriangle className="mx-auto h-12 w-12 text-gray-300" />
        <p className="mt-4">No alerts found</p>
      </div>
    )
  }

  return (
    <>
      <div className="space-y-4">
        {alerts.map(alert => (
          <div
            key={alert.id}
            className={`rounded-lg p-4 ${severityStyles[alert.severity]} hover:shadow-md transition-shadow`}
          >
            <div className="flex items-start justify-between">
              <div className="flex-1">
                {/* UCID + GLID Header */}
                <div className="flex items-center gap-3 mb-2 flex-wrap">
                  <div className="flex items-center gap-2">
                    <code className="text-xs font-mono bg-white px-2 py-1 rounded border font-bold">
                      {alert.calls?.ucid?.slice(0, 8) || 'N/A'}...
                    </code>
                    <button
                      onClick={(e) => copyUcid(e, alert.calls?.ucid)}
                      className="text-gray-400 hover:text-gray-600"
                      title="Copy full UCID"
                    >
                      {copiedUcid === alert.calls?.ucid ? (
                        <Check className="h-3 w-3 text-green-500" />
                      ) : (
                        <Copy className="h-3 w-3" />
                      )}
                    </button>
                  </div>
                  {alert.calls?.company_id && (
                    <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs font-medium">
                      GLID: {alert.calls.company_id}
                    </span>
                  )}
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${severityBadge[alert.severity]}`}>
                    {alert.severity.toUpperCase()}
                  </span>
                  <span className="text-sm font-bold text-gray-700">
                    {Math.round((alert.churn_risk_score || 0) * 100)}% Risk
                  </span>
                </div>

                <div className="flex flex-wrap gap-2 mb-3">
                  {alert.alert_types.map(type => (
                    <span key={type} className="px-2 py-0.5 bg-white rounded text-xs text-gray-600 border">
                      {alertTypeLabels[type] || type}
                    </span>
                  ))}
                </div>

                <div className="grid grid-cols-2 gap-4 text-sm text-gray-600">
                  <div className="flex items-center gap-1">
                    <Building className="h-4 w-4" />
                    <span className="font-medium">{alert.calls?.company_name || 'Unknown'}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <User className="h-4 w-4" />
                    <span>{alert.calls?.employee_name || 'Unknown'}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Phone className="h-4 w-4" />
                    <span>{alert.calls?.customer_mobile || 'N/A'}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Clock className="h-4 w-4" />
                    <span>
                      {alert.calls?.call_start_time
                        ? format(new Date(alert.calls.call_start_time), 'dd MMM, HH:mm')
                        : 'N/A'
                      }
                    </span>
                  </div>
                </div>

                {alert.call_purpose && (
                  <p className="mt-2 text-sm text-gray-700">
                    <strong>Purpose:</strong> <span className="capitalize">{alert.call_purpose}</span>
                  </p>
                )}

                {/* Recording and Transcript Buttons */}
                <div className="mt-3 pt-3 border-t border-gray-200 flex gap-2">
                  {alert.calls?.call_recording_url && (
                    <button
                      onClick={(e) => openRecording(e, alert.calls.call_recording_url)}
                      className="flex items-center gap-1 px-3 py-1.5 bg-green-600 text-white rounded-lg text-xs font-medium hover:bg-green-700 transition-colors"
                    >
                      <Play className="h-3 w-3" />
                      Play Recording
                    </button>
                  )}
                  {alert.call_transcripts && alert.call_transcripts.length > 0 && (
                    <button
                      onClick={(e) => openTranscript(e, alert)}
                      className="flex items-center gap-1 px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-medium hover:bg-blue-700 transition-colors"
                    >
                      <FileText className="h-3 w-3" />
                      View Transcript
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Transcript Modal */}
      {showTranscript && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b bg-gray-50">
              <div>
                <h3 className="text-lg font-semibold">Call Transcript</h3>
                <p className="text-sm text-gray-500">
                  UCID: {showTranscript.calls?.ucid?.slice(0, 16)}... |
                  GLID: {showTranscript.calls?.company_id || 'N/A'}
                </p>
              </div>
              <button
                onClick={() => setShowTranscript(null)}
                className="p-2 hover:bg-gray-200 rounded-full"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="p-4 overflow-y-auto max-h-[70vh]">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div>
                  <h4 className="font-medium text-gray-700 mb-2 flex items-center gap-2">
                    <span className="px-2 py-0.5 bg-purple-100 text-purple-700 rounded text-xs">Original</span>
                    Transcript
                  </h4>
                  <div className="bg-gray-50 rounded-lg p-4 text-sm whitespace-pre-wrap max-h-[50vh] overflow-y-auto">
                    {showTranscript.call_transcripts?.[0]?.transcript || 'No transcript available'}
                  </div>
                </div>
                <div>
                  <h4 className="font-medium text-gray-700 mb-2 flex items-center gap-2">
                    <span className="px-2 py-0.5 bg-green-100 text-green-700 rounded text-xs">English</span>
                    Translation
                  </h4>
                  <div className="bg-gray-50 rounded-lg p-4 text-sm whitespace-pre-wrap max-h-[50vh] overflow-y-auto">
                    {showTranscript.call_transcripts?.[0]?.translation || 'No translation available'}
                  </div>
                </div>
              </div>
            </div>
            <div className="p-4 border-t bg-gray-50 flex justify-end gap-2">
              {showTranscript.calls?.call_recording_url && (
                <button
                  onClick={(e) => openRecording(e, showTranscript.calls.call_recording_url)}
                  className="flex items-center gap-1 px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700"
                >
                  <Play className="h-4 w-4" />
                  Play Recording
                </button>
              )}
              <button
                onClick={() => setShowTranscript(null)}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-300"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
