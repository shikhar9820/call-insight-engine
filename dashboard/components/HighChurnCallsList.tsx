'use client'

import { TrendingUp, AlertTriangle, Copy, Check, ExternalLink } from 'lucide-react'
import { useState } from 'react'

interface HighChurnCall {
  ucid: string
  company: string
  employee: string
  churn_risk: number
  sentiment: string
  resolution: string
  deactivation_intent: boolean
  key_signals: string[]
}

interface HighChurnCallsListProps {
  calls: HighChurnCall[]
  loading?: boolean
}

export default function HighChurnCallsList({ calls, loading }: HighChurnCallsListProps) {
  const [copiedUcid, setCopiedUcid] = useState<string | null>(null)

  const copyUcid = async (ucid: string) => {
    await navigator.clipboard.writeText(ucid)
    setCopiedUcid(ucid)
    setTimeout(() => setCopiedUcid(null), 2000)
  }

  const getRiskColor = (risk: number) => {
    if (risk >= 0.8) return 'bg-red-500'
    if (risk >= 0.7) return 'bg-orange-500'
    return 'bg-amber-500'
  }

  const getRiskLabel = (risk: number) => {
    if (risk >= 0.8) return 'Critical'
    if (risk >= 0.7) return 'High'
    return 'Elevated'
  }

  if (loading) {
    return (
      <div className="animate-pulse space-y-3">
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="h-24 bg-gray-200 rounded" />
        ))}
      </div>
    )
  }

  if (!calls.length) {
    return (
      <div className="text-center py-8 text-gray-500">
        <TrendingUp className="mx-auto h-12 w-12 text-gray-300" />
        <p className="mt-2">No high churn risk calls</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-gray-500">High Churn Risk Calls</h3>
        <span className="text-xs text-gray-400">{calls.length} calls</span>
      </div>

      <div className="space-y-2 max-h-[400px] overflow-y-auto pr-2">
        {calls.map((call, index) => (
          <div
            key={`${call.ucid}-${index}`}
            className="p-3 rounded-lg border bg-white hover:shadow-sm transition-shadow"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <code className="text-xs font-mono bg-gray-100 px-1.5 py-0.5 rounded">
                    {call.ucid.slice(0, 8)}...
                  </code>
                  <button
                    onClick={() => copyUcid(call.ucid)}
                    className="text-gray-400 hover:text-gray-600"
                    title="Copy full UCID"
                  >
                    {copiedUcid === call.ucid ? (
                      <Check className="h-3 w-3 text-green-500" />
                    ) : (
                      <Copy className="h-3 w-3" />
                    )}
                  </button>
                  {call.deactivation_intent && (
                    <span className="px-1.5 py-0.5 rounded text-xs font-medium bg-red-100 text-red-700">
                      DEACTIVATION INTENT
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 mt-1 text-sm">
                  <span className="text-gray-700">{call.company || 'Unknown Company'}</span>
                  {call.employee && call.employee !== 'Unknown' && (
                    <>
                      <span className="text-gray-300">•</span>
                      <span className="text-gray-500">{call.employee}</span>
                    </>
                  )}
                </div>
              </div>

              <div className="text-right">
                <div className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-white text-xs font-bold ${getRiskColor(call.churn_risk)}`}>
                  <TrendingUp className="h-3 w-3" />
                  {Math.round(call.churn_risk * 100)}%
                </div>
                <p className="text-xs text-gray-500 mt-0.5">{getRiskLabel(call.churn_risk)} Risk</p>
              </div>
            </div>

            <div className="mt-2 flex items-center gap-3 text-xs">
              <span className="text-gray-500">
                Sentiment: <span className="text-gray-700">{call.sentiment}</span>
              </span>
              <span className="text-gray-300">|</span>
              <span className={`px-1.5 py-0.5 rounded ${
                call.resolution === 'resolved'
                  ? 'bg-green-100 text-green-700'
                  : call.resolution === 'partial'
                  ? 'bg-yellow-100 text-yellow-700'
                  : 'bg-red-100 text-red-700'
              }`}>
                {call.resolution || 'unresolved'}
              </span>
            </div>

            {call.key_signals.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1">
                {call.key_signals.map((signal, i) => (
                  <span
                    key={i}
                    className="px-1.5 py-0.5 rounded text-xs bg-red-50 text-red-600 border border-red-200"
                  >
                    ⚠️ {signal}
                  </span>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
