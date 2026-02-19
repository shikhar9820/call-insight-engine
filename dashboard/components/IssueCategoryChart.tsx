'use client'

interface CategoryData {
  category: string
  count: number
  severityBreakdown: Record<string, number>
}

interface IssueCategoryChartProps {
  data: CategoryData[]
  loading?: boolean
}

const categoryLabels: Record<string, string> = {
  buylead_relevance: 'Buylead Relevance',
  buylead_availability: 'Buylead Availability',
  buylead_accessibility: 'Buylead Accessibility',
  buylead_roi: 'Buylead ROI',
  technical: 'Technical Issues',
  subscription: 'Subscription',
  payment: 'Payment',
  catalog: 'Catalog',
  employee: 'Employee Issues',
  pns: 'PNS',
  enquiry: 'Enquiry',
  deactivation: 'Deactivation',
  other: 'Other'
}

const severityColors: Record<string, string> = {
  critical: 'bg-red-500',
  high: 'bg-orange-500',
  medium: 'bg-yellow-500',
  low: 'bg-green-500'
}

export default function IssueCategoryChart({ data, loading }: IssueCategoryChartProps) {
  if (loading) {
    return (
      <div className="animate-pulse space-y-3">
        {[1, 2, 3, 4, 5].map(i => (
          <div key={i} className="h-8 bg-gray-200 rounded" />
        ))}
      </div>
    )
  }

  const maxCount = Math.max(...data.map(d => d.count), 1)

  return (
    <div className="space-y-3">
      {data.map((item, index) => {
        const percentage = (item.count / maxCount) * 100
        const label = categoryLabels[item.category] || item.category

        return (
          <div key={item.category} className="group">
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm font-medium text-gray-700 truncate max-w-[200px]">
                {label}
              </span>
              <span className="text-sm font-semibold text-gray-900">{item.count}</span>
            </div>
            <div className="relative h-6 bg-gray-100 rounded-full overflow-hidden">
              {/* Stacked severity bars */}
              <div className="absolute inset-0 flex">
                {['critical', 'high', 'medium', 'low'].map(severity => {
                  const count = item.severityBreakdown[severity] || 0
                  const width = (count / item.count) * percentage
                  return (
                    <div
                      key={severity}
                      className={`${severityColors[severity]} h-full transition-all duration-500`}
                      style={{ width: `${width}%` }}
                      title={`${severity}: ${count}`}
                    />
                  )
                })}
              </div>
            </div>
            {/* Severity breakdown on hover */}
            <div className="hidden group-hover:flex gap-3 mt-1 text-xs text-gray-500">
              {Object.entries(item.severityBreakdown).map(([sev, count]) => (
                <span key={sev} className="flex items-center gap-1">
                  <span className={`w-2 h-2 rounded-full ${severityColors[sev]}`} />
                  {sev}: {count}
                </span>
              ))}
            </div>
          </div>
        )
      })}

      {/* Legend */}
      <div className="flex items-center gap-4 mt-4 pt-4 border-t text-xs">
        {Object.entries(severityColors).map(([severity, color]) => (
          <span key={severity} className="flex items-center gap-1">
            <span className={`w-3 h-3 rounded ${color}`} />
            <span className="capitalize">{severity}</span>
          </span>
        ))}
      </div>
    </div>
  )
}
