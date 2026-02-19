'use client'

import { AlertTriangle, AlertOctagon, Copy, Check } from 'lucide-react'
import { useState } from 'react'

interface CriticalIssue {
  ucid: string
  company: string
  category: string
  subcategory: string
  description: string
  severity: string
  mentioned_by: string
}

interface CriticalIssuesListProps {
  issues: CriticalIssue[]
  loading?: boolean
  title?: string
}

const categoryLabels: Record<string, string> = {
  buylead_relevance: 'Buylead Relevance',
  buylead_availability: 'Buylead Availability',
  buylead_accessibility: 'Buylead Access',
  buylead_roi: 'Buylead ROI',
  technical: 'Technical',
  subscription: 'Subscription',
  payment: 'Payment',
  catalog: 'Catalog',
  employee: 'Employee',
  pns: 'PNS',
  enquiry: 'Enquiry',
  deactivation: 'Deactivation',
  other: 'Other'
}

export default function CriticalIssuesList({ issues, loading, title = "Critical & High Priority Issues" }: CriticalIssuesListProps) {
  const [copiedUcid, setCopiedUcid] = useState<string | null>(null)

  const copyUcid = async (ucid: string) => {
    await navigator.clipboard.writeText(ucid)
    setCopiedUcid(ucid)
    setTimeout(() => setCopiedUcid(null), 2000)
  }

  if (loading) {
    return (
      <div className="animate-pulse space-y-3">
        {[1, 2, 3, 4, 5].map(i => (
          <div key={i} className="h-20 bg-gray-200 rounded" />
        ))}
      </div>
    )
  }

  if (!issues.length) {
    return (
      <div className="text-center py-8 text-gray-500">
        <AlertTriangle className="mx-auto h-12 w-12 text-gray-300" />
        <p className="mt-2">No critical issues found</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-gray-500">{title}</h3>
        <span className="text-xs text-gray-400">{issues.length} issues</span>
      </div>

      <div className="space-y-2 max-h-[500px] overflow-y-auto pr-2">
        {issues.map((issue, index) => (
          <div
            key={`${issue.ucid}-${index}`}
            className={`p-3 rounded-lg border ${
              issue.severity === 'critical'
                ? 'bg-red-50 border-red-200'
                : 'bg-orange-50 border-orange-200'
            }`}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2">
                {issue.severity === 'critical' ? (
                  <AlertOctagon className="h-4 w-4 text-red-500 flex-shrink-0" />
                ) : (
                  <AlertTriangle className="h-4 w-4 text-orange-500 flex-shrink-0" />
                )}
                <div>
                  <div className="flex items-center gap-2">
                    <code className="text-xs font-mono bg-white px-1.5 py-0.5 rounded border">
                      {issue.ucid.slice(0, 8)}...
                    </code>
                    <button
                      onClick={() => copyUcid(issue.ucid)}
                      className="text-gray-400 hover:text-gray-600"
                      title="Copy full UCID"
                    >
                      {copiedUcid === issue.ucid ? (
                        <Check className="h-3 w-3 text-green-500" />
                      ) : (
                        <Copy className="h-3 w-3" />
                      )}
                    </button>
                    <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${
                      issue.severity === 'critical'
                        ? 'bg-red-100 text-red-700'
                        : 'bg-orange-100 text-orange-700'
                    }`}>
                      {issue.severity.toUpperCase()}
                    </span>
                  </div>
                  {issue.company && issue.company !== 'Unknown' && (
                    <p className="text-xs text-gray-500 mt-0.5">{issue.company}</p>
                  )}
                </div>
              </div>
              <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                issue.mentioned_by === 'customer'
                  ? 'bg-blue-100 text-blue-700'
                  : 'bg-gray-100 text-gray-700'
              }`}>
                {issue.mentioned_by}
              </span>
            </div>

            <div className="mt-2 ml-6">
              <span className="inline-block px-2 py-0.5 rounded bg-white border text-xs font-medium text-gray-700">
                {categoryLabels[issue.category] || issue.category}
                {issue.subcategory && ` / ${issue.subcategory}`}
              </span>
              <p className="text-sm text-gray-700 mt-1 line-clamp-2">
                {issue.description}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
