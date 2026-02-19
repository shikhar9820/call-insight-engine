'use client'

import { MessageSquareQuote, Copy, Check, TrendingUp } from 'lucide-react'
import { useState } from 'react'

interface KeyQuote {
  ucid: string
  company: string
  churn_risk: number
  main_complaint: string | null
  customer_ask: string | null
  notable: string | null
}

interface KeyQuotesSectionProps {
  quotes: KeyQuote[]
  loading?: boolean
}

export default function KeyQuotesSection({ quotes, loading }: KeyQuotesSectionProps) {
  const [copiedUcid, setCopiedUcid] = useState<string | null>(null)

  const copyUcid = async (ucid: string) => {
    await navigator.clipboard.writeText(ucid)
    setCopiedUcid(ucid)
    setTimeout(() => setCopiedUcid(null), 2000)
  }

  if (loading) {
    return (
      <div className="animate-pulse space-y-4">
        {[1, 2, 3].map(i => (
          <div key={i} className="h-32 bg-gray-200 rounded" />
        ))}
      </div>
    )
  }

  if (!quotes.length) {
    return (
      <div className="text-center py-8 text-gray-500">
        <MessageSquareQuote className="mx-auto h-12 w-12 text-gray-300" />
        <p className="mt-2">No key quotes extracted</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-gray-500">Key Customer Quotes</h3>
        <span className="text-xs text-gray-400">From high-risk calls</span>
      </div>

      <div className="space-y-4 max-h-[500px] overflow-y-auto pr-2">
        {quotes.map((quote, index) => (
          <div
            key={`${quote.ucid}-${index}`}
            className="p-4 rounded-lg border bg-gradient-to-r from-white to-gray-50"
          >
            {/* Header */}
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <code className="text-xs font-mono bg-gray-100 px-1.5 py-0.5 rounded">
                  {quote.ucid}
                </code>
                <button
                  onClick={() => copyUcid(quote.ucid)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  {copiedUcid === quote.ucid ? (
                    <Check className="h-3 w-3 text-green-500" />
                  ) : (
                    <Copy className="h-3 w-3" />
                  )}
                </button>
                {quote.company && quote.company !== 'Unknown' && (
                  <span className="text-xs text-gray-500">{quote.company}</span>
                )}
              </div>
              <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-100 text-red-700 text-xs font-medium">
                <TrendingUp className="h-3 w-3" />
                {Math.round((quote.churn_risk || 0) * 100)}% risk
              </div>
            </div>

            {/* Quotes */}
            <div className="space-y-3">
              {quote.main_complaint && (
                <div className="relative">
                  <div className="absolute left-0 top-0 bottom-0 w-1 bg-red-400 rounded-full" />
                  <div className="pl-4">
                    <span className="text-xs font-medium text-red-600 uppercase tracking-wide">
                      Main Complaint
                    </span>
                    <p className="text-sm text-gray-700 mt-1 italic">
                      "{quote.main_complaint}"
                    </p>
                  </div>
                </div>
              )}

              {quote.customer_ask && (
                <div className="relative">
                  <div className="absolute left-0 top-0 bottom-0 w-1 bg-blue-400 rounded-full" />
                  <div className="pl-4">
                    <span className="text-xs font-medium text-blue-600 uppercase tracking-wide">
                      Customer Ask
                    </span>
                    <p className="text-sm text-gray-700 mt-1 italic">
                      "{quote.customer_ask}"
                    </p>
                  </div>
                </div>
              )}

              {quote.notable && (
                <div className="relative">
                  <div className="absolute left-0 top-0 bottom-0 w-1 bg-amber-400 rounded-full" />
                  <div className="pl-4">
                    <span className="text-xs font-medium text-amber-600 uppercase tracking-wide">
                      Notable Statement
                    </span>
                    <p className="text-sm text-gray-700 mt-1 italic">
                      "{quote.notable}"
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
