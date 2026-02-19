'use client'

import { ReactNode, useState } from 'react'
import { HelpCircle } from 'lucide-react'

interface StatsCardProps {
  title: string
  value: string | number
  subtitle?: string
  icon: ReactNode
  trend?: {
    value: number
    isPositive: boolean
  }
  variant?: 'default' | 'danger' | 'warning' | 'success'
  tooltip?: string
}

export default function StatsCard({
  title,
  value,
  subtitle,
  icon,
  trend,
  variant = 'default',
  tooltip
}: StatsCardProps) {
  const [showTooltip, setShowTooltip] = useState(false)

  const variantStyles = {
    default: 'bg-white border-gray-200',
    danger: 'bg-red-50 border-red-200',
    warning: 'bg-amber-50 border-amber-200',
    success: 'bg-green-50 border-green-200'
  }

  const iconStyles = {
    default: 'bg-blue-100 text-blue-600',
    danger: 'bg-red-100 text-red-600',
    warning: 'bg-amber-100 text-amber-600',
    success: 'bg-green-100 text-green-600'
  }

  return (
    <div className={`rounded-xl border p-6 shadow-sm ${variantStyles[variant]} relative`}>
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-1">
            <p className="text-sm font-medium text-gray-500">{title}</p>
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
          <p className="mt-2 text-3xl font-bold text-gray-900">{value}</p>
          {subtitle && (
            <p className="mt-1 text-sm text-gray-500">{subtitle}</p>
          )}
          {trend && (
            <p className={`mt-1 text-sm ${trend.isPositive ? 'text-green-600' : 'text-red-600'}`}>
              {trend.isPositive ? '+' : ''}{trend.value}% vs last week
            </p>
          )}
        </div>
        <div className={`rounded-full p-3 ${iconStyles[variant]}`}>
          {icon}
        </div>
      </div>
    </div>
  )
}
