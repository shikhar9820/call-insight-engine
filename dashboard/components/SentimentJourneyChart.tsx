'use client'

interface SentimentData {
  journeys: Array<{ journey: string; count: number }>
  startDistribution: Record<string, number>
  endDistribution: Record<string, number>
}

interface SentimentJourneyChartProps {
  data: SentimentData | null
  loading?: boolean
}

const sentimentColors: Record<string, { bg: string; text: string; border: string }> = {
  happy: { bg: 'bg-green-100', text: 'text-green-700', border: 'border-green-300' },
  satisfied: { bg: 'bg-emerald-100', text: 'text-emerald-700', border: 'border-emerald-300' },
  neutral: { bg: 'bg-gray-100', text: 'text-gray-700', border: 'border-gray-300' },
  confused: { bg: 'bg-blue-100', text: 'text-blue-700', border: 'border-blue-300' },
  anxious: { bg: 'bg-purple-100', text: 'text-purple-700', border: 'border-purple-300' },
  frustrated: { bg: 'bg-orange-100', text: 'text-orange-700', border: 'border-orange-300' },
  disappointed: { bg: 'bg-amber-100', text: 'text-amber-700', border: 'border-amber-300' },
  angry: { bg: 'bg-red-100', text: 'text-red-700', border: 'border-red-300' }
}

export default function SentimentJourneyChart({ data, loading }: SentimentJourneyChartProps) {
  if (loading || !data) {
    return (
      <div className="animate-pulse space-y-4">
        <div className="h-32 bg-gray-200 rounded" />
      </div>
    )
  }

  const maxJourneyCount = Math.max(...data.journeys.map(j => j.count), 1)

  // Determine if journey is positive, negative, or neutral
  const getJourneyType = (journey: string) => {
    const [start, end] = journey.split(' → ')
    const negatives = ['angry', 'frustrated', 'disappointed', 'anxious']
    const positives = ['happy', 'satisfied']

    const startNeg = negatives.includes(start)
    const endNeg = negatives.includes(end)
    const startPos = positives.includes(start)
    const endPos = positives.includes(end)

    if (startNeg && endPos) return 'improvement'
    if (startPos && endNeg) return 'deterioration'
    if (startNeg && !endNeg) return 'improvement'
    if (!startNeg && endNeg) return 'deterioration'
    return 'stable'
  }

  const journeyTypeColors = {
    improvement: 'bg-green-500',
    deterioration: 'bg-red-500',
    stable: 'bg-blue-500'
  }

  return (
    <div className="space-y-6">
      {/* Sentiment Journey Flows */}
      <div>
        <h4 className="text-sm font-medium text-gray-500 mb-3">Top Sentiment Journeys</h4>
        <div className="space-y-2">
          {data.journeys.slice(0, 8).map((journey, index) => {
            const [start, end] = journey.journey.split(' → ')
            const startColor = sentimentColors[start] || sentimentColors.neutral
            const endColor = sentimentColors[end] || sentimentColors.neutral
            const journeyType = getJourneyType(journey.journey)
            const width = (journey.count / maxJourneyCount) * 100

            return (
              <div key={journey.journey} className="flex items-center gap-2">
                <div className="flex items-center gap-1 min-w-[200px]">
                  <span className={`px-2 py-0.5 rounded text-xs font-medium ${startColor.bg} ${startColor.text}`}>
                    {start}
                  </span>
                  <span className={`text-lg ${journeyType === 'improvement' ? 'text-green-500' : journeyType === 'deterioration' ? 'text-red-500' : 'text-gray-400'}`}>
                    →
                  </span>
                  <span className={`px-2 py-0.5 rounded text-xs font-medium ${endColor.bg} ${endColor.text}`}>
                    {end}
                  </span>
                </div>
                <div className="flex-1 h-4 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className={`h-full ${journeyTypeColors[journeyType]} transition-all duration-500`}
                    style={{ width: `${width}%` }}
                  />
                </div>
                <span className="text-sm font-medium text-gray-600 min-w-[30px] text-right">
                  {journey.count}
                </span>
              </div>
            )
          })}
        </div>
      </div>

      {/* Start vs End Distribution */}
      <div className="grid grid-cols-2 gap-4 pt-4 border-t">
        <div>
          <h4 className="text-sm font-medium text-gray-500 mb-2">Call Start Sentiment</h4>
          <div className="flex flex-wrap gap-2">
            {Object.entries(data.startDistribution)
              .sort((a, b) => b[1] - a[1])
              .map(([sentiment, count]) => {
                const colors = sentimentColors[sentiment] || sentimentColors.neutral
                return (
                  <span
                    key={sentiment}
                    className={`px-2 py-1 rounded-full text-xs font-medium ${colors.bg} ${colors.text}`}
                  >
                    {sentiment}: {count}
                  </span>
                )
              })}
          </div>
        </div>
        <div>
          <h4 className="text-sm font-medium text-gray-500 mb-2">Call End Sentiment</h4>
          <div className="flex flex-wrap gap-2">
            {Object.entries(data.endDistribution)
              .sort((a, b) => b[1] - a[1])
              .map(([sentiment, count]) => {
                const colors = sentimentColors[sentiment] || sentimentColors.neutral
                return (
                  <span
                    key={sentiment}
                    className={`px-2 py-1 rounded-full text-xs font-medium ${colors.bg} ${colors.text}`}
                  >
                    {sentiment}: {count}
                  </span>
                )
              })}
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 pt-2 text-xs">
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 rounded bg-green-500" />
          Improvement
        </span>
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 rounded bg-red-500" />
          Deterioration
        </span>
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 rounded bg-blue-500" />
          Stable
        </span>
      </div>
    </div>
  )
}
