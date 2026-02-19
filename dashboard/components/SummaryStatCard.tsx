'use client'

import { useState } from 'react'
import { HelpCircle } from 'lucide-react'

interface SummaryStatCardProps {
  label: string
  value: string | number
  tooltip?: string
  variant?: 'default' | 'red' | 'orange' | 'amber' | 'green' | 'blue' | 'purple'
}

export default function SummaryStatCard({
  label,
  value,
  tooltip,
  variant = 'default'
}: SummaryStatCardProps) {
  const [showTooltip, setShowTooltip] = useState(false)

  const variantStyles = {
    default: {
      bg: 'bg-white',
      border: 'border-gray-200',
      text: 'text-gray-900'
    },
    red: {
      bg: 'bg-red-50',
      border: 'border-red-200',
      text: 'text-red-600'
    },
    orange: {
      bg: 'bg-orange-50',
      border: 'border-orange-200',
      text: 'text-orange-600'
    },
    amber: {
      bg: 'bg-amber-50',
      border: 'border-amber-200',
      text: 'text-amber-600'
    },
    green: {
      bg: 'bg-green-50',
      border: 'border-green-200',
      text: 'text-green-600'
    },
    blue: {
      bg: 'bg-blue-50',
      border: 'border-blue-200',
      text: 'text-blue-600'
    },
    purple: {
      bg: 'bg-purple-50',
      border: 'border-purple-200',
      text: 'text-purple-600'
    }
  }

  const styles = variantStyles[variant]

  return (
    <div className={`${styles.bg} rounded-xl shadow-sm border ${styles.border} p-4`}>
      <div className="flex items-center gap-1">
        <p className="text-sm text-gray-500">{label}</p>
        {tooltip && (
          <div
            className="relative"
            onMouseEnter={() => setShowTooltip(true)}
            onMouseLeave={() => setShowTooltip(false)}
          >
            <HelpCircle
              className="h-3.5 w-3.5 text-gray-400 hover:text-gray-600 cursor-help transition-colors"
            />
            {showTooltip && (
              <div className="absolute z-50 bottom-full left-1/2 -translate-x-1/2 mb-2 pointer-events-none">
                <div className="bg-gray-900 text-white text-xs rounded-lg py-2 px-3 shadow-lg w-56 whitespace-normal">
                  {tooltip}
                  <div className="absolute top-full left-1/2 -translate-x-1/2 w-0 h-0 border-4 border-t-gray-900 border-l-transparent border-r-transparent border-b-transparent" />
                </div>
              </div>
            )}
          </div>
        )}
      </div>
      <p className={`text-3xl font-bold ${styles.text}`}>{value}</p>
    </div>
  )
}
