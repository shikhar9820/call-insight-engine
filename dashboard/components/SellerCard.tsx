'use client'

import { TrendingUp, TrendingDown, Minus, Phone, AlertTriangle, CheckCircle, Clock } from 'lucide-react'

interface SellerMetrics {
  company_id: string
  company_name: string
  total_calls: number
  first_call_date: string
  latest_call_date: string
  avg_sentiment_score: number
  sentiment_trend: 'improving' | 'declining' | 'stable'
  avg_churn_risk: number
  resolution_rate: number
  avg_call_duration: number
  top_issues: Array<{ category: string; count: number }>
  risk_level: 'low' | 'medium' | 'high'
  health_score: number
  days_since_last_call: number
  sticky_issues: string[]
  risk_signals: {
    deactivation_intent: number
    refund_requested: number
    escalation_threatened: number
    payment_dispute: number
  }
}

interface SellerCardProps {
  seller: SellerMetrics
  onClick: () => void
}

function HealthScoreGauge({ score }: { score: number }) {
  const getColor = () => {
    if (score >= 70) return 'text-green-500'
    if (score >= 40) return 'text-yellow-500'
    return 'text-red-500'
  }

  const getBgColor = () => {
    if (score >= 70) return 'bg-green-100'
    if (score >= 40) return 'bg-yellow-100'
    return 'bg-red-100'
  }

  return (
    <div className={`flex items-center justify-center w-16 h-16 rounded-full ${getBgColor()}`}>
      <span className={`text-xl font-bold ${getColor()}`}>{score}</span>
    </div>
  )
}

function SentimentTrendIcon({ trend }: { trend: 'improving' | 'declining' | 'stable' }) {
  if (trend === 'improving') {
    return <TrendingUp className="h-4 w-4 text-green-500" />
  }
  if (trend === 'declining') {
    return <TrendingDown className="h-4 w-4 text-red-500" />
  }
  return <Minus className="h-4 w-4 text-gray-400" />
}

function RiskBadge({ level }: { level: 'low' | 'medium' | 'high' }) {
  const colors = {
    low: 'bg-green-100 text-green-700',
    medium: 'bg-yellow-100 text-yellow-700',
    high: 'bg-red-100 text-red-700'
  }

  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${colors[level]}`}>
      {level.charAt(0).toUpperCase() + level.slice(1)} Risk
    </span>
  )
}

export default function SellerCard({ seller, onClick }: SellerCardProps) {
  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    })
  }

  const totalRiskSignals =
    seller.risk_signals.deactivation_intent +
    seller.risk_signals.refund_requested +
    seller.risk_signals.escalation_threatened +
    seller.risk_signals.payment_dispute

  return (
    <div
      onClick={onClick}
      className="bg-white rounded-xl shadow-sm border hover:shadow-md transition-shadow cursor-pointer p-5"
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1 min-w-0">
          {seller.company_name && seller.company_name.toLowerCase() !== 'unknown' && seller.company_name.trim() !== '' ? (
            <h3 className="font-semibold text-gray-900 truncate" title={seller.company_name}>
              {seller.company_name}
            </h3>
          ) : null}
          <p className={`text-xs text-gray-500 truncate ${!seller.company_name || seller.company_name.toLowerCase() === 'unknown' ? 'font-semibold text-gray-900 text-sm' : ''}`} title={seller.company_id}>
            ID: {seller.company_id}
          </p>
        </div>
        <HealthScoreGauge score={seller.health_score} />
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-3 gap-3 mb-4">
        <div className="text-center">
          <div className="flex items-center justify-center gap-1 text-gray-600">
            <Phone className="h-3.5 w-3.5" />
            <span className="text-lg font-semibold">{seller.total_calls}</span>
          </div>
          <p className="text-xs text-gray-500">Calls</p>
        </div>
        <div className="text-center">
          <div className="flex items-center justify-center gap-1 text-gray-600">
            <CheckCircle className="h-3.5 w-3.5" />
            <span className="text-lg font-semibold">{seller.resolution_rate}%</span>
          </div>
          <p className="text-xs text-gray-500">Resolved</p>
        </div>
        <div className="text-center">
          <div className="flex items-center justify-center gap-1 text-gray-600">
            <SentimentTrendIcon trend={seller.sentiment_trend} />
            <span className="text-lg font-semibold capitalize">{seller.sentiment_trend}</span>
          </div>
          <p className="text-xs text-gray-500">Trend</p>
        </div>
      </div>

      {/* Risk & Churn */}
      <div className="flex items-center justify-between mb-3">
        <RiskBadge level={seller.risk_level} />
        <div className="text-right">
          <span className="text-sm text-gray-500">Churn Risk: </span>
          <span className={`font-semibold ${
            seller.avg_churn_risk >= 0.7 ? 'text-red-600' :
            seller.avg_churn_risk >= 0.4 ? 'text-yellow-600' : 'text-green-600'
          }`}>
            {Math.round(seller.avg_churn_risk * 100)}%
          </span>
        </div>
      </div>

      {/* Top Issues */}
      {seller.top_issues.length > 0 && (
        <div className="mb-3">
          <p className="text-xs text-gray-500 mb-1">Top Issues:</p>
          <div className="flex flex-wrap gap-1">
            {seller.top_issues.slice(0, 3).map((issue, idx) => (
              <span
                key={idx}
                className="px-2 py-0.5 bg-gray-100 text-gray-700 rounded text-xs"
              >
                {issue.category} ({issue.count})
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Sticky Issues Warning */}
      {seller.sticky_issues.length > 0 && (
        <div className="mb-3 p-2 bg-orange-50 rounded-lg">
          <div className="flex items-center gap-1 text-orange-700">
            <AlertTriangle className="h-3.5 w-3.5" />
            <span className="text-xs font-medium">Recurring Issues:</span>
          </div>
          <p className="text-xs text-orange-600 mt-0.5">
            {seller.sticky_issues.slice(0, 2).join(', ')}
          </p>
        </div>
      )}

      {/* Risk Signals */}
      {totalRiskSignals > 0 && (
        <div className="mb-3 flex flex-wrap gap-1">
          {seller.risk_signals.deactivation_intent > 0 && (
            <span className="px-1.5 py-0.5 bg-red-100 text-red-700 rounded text-xs">
              Deactivation x{seller.risk_signals.deactivation_intent}
            </span>
          )}
          {seller.risk_signals.escalation_threatened > 0 && (
            <span className="px-1.5 py-0.5 bg-orange-100 text-orange-700 rounded text-xs">
              Escalation x{seller.risk_signals.escalation_threatened}
            </span>
          )}
          {seller.risk_signals.payment_dispute > 0 && (
            <span className="px-1.5 py-0.5 bg-yellow-100 text-yellow-700 rounded text-xs">
              Payment x{seller.risk_signals.payment_dispute}
            </span>
          )}
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between text-xs text-gray-500 pt-3 border-t">
        <div className="flex items-center gap-1">
          <Clock className="h-3 w-3" />
          <span>
            {seller.days_since_last_call === 0
              ? 'Today'
              : seller.days_since_last_call === 1
              ? 'Yesterday'
              : `${seller.days_since_last_call} days ago`}
          </span>
        </div>
        <span>
          {formatDate(seller.first_call_date)} - {formatDate(seller.latest_call_date)}
        </span>
      </div>
    </div>
  )
}
