'use client'

interface Topic {
  topic: string
  count: number
}

interface TopicsCloudProps {
  topics: Topic[]
  loading?: boolean
}

export default function TopicsCloud({ topics, loading }: TopicsCloudProps) {
  if (loading) {
    return (
      <div className="animate-pulse flex flex-wrap gap-2">
        {[1, 2, 3, 4, 5, 6, 7, 8].map(i => (
          <div key={i} className="h-8 w-20 bg-gray-200 rounded-full" />
        ))}
      </div>
    )
  }

  if (!topics.length) {
    return (
      <div className="text-center py-4 text-gray-500">
        <p>No topics extracted</p>
      </div>
    )
  }

  const maxCount = Math.max(...topics.map(t => t.count))
  const minCount = Math.min(...topics.map(t => t.count))

  const getSize = (count: number) => {
    if (maxCount === minCount) return 'text-sm'
    const ratio = (count - minCount) / (maxCount - minCount)
    if (ratio > 0.8) return 'text-lg font-semibold'
    if (ratio > 0.5) return 'text-base font-medium'
    return 'text-sm'
  }

  const getColor = (count: number) => {
    if (maxCount === minCount) return 'bg-blue-100 text-blue-700'
    const ratio = (count - minCount) / (maxCount - minCount)
    if (ratio > 0.8) return 'bg-blue-500 text-white'
    if (ratio > 0.5) return 'bg-blue-200 text-blue-800'
    if (ratio > 0.3) return 'bg-blue-100 text-blue-700'
    return 'bg-gray-100 text-gray-600'
  }

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-medium text-gray-500">Discussion Topics</h3>
      <div className="flex flex-wrap gap-2">
        {topics.map((topic, index) => (
          <span
            key={topic.topic}
            className={`px-3 py-1 rounded-full ${getSize(topic.count)} ${getColor(topic.count)} transition-transform hover:scale-105 cursor-default`}
            title={`${topic.count} mentions`}
          >
            {topic.topic}
            <span className="ml-1 opacity-70 text-xs">({topic.count})</span>
          </span>
        ))}
      </div>
    </div>
  )
}
