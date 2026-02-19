'use client'

import {
  AlertTriangle,
  LogOut,
  DollarSign,
  PhoneOff,
  Scale,
  CreditCard,
  Building,
  TrendingUp
} from 'lucide-react'

interface RiskSignals {
  deactivation_intent: number
  deactivation_confirmed: number
  refund_requested: number
  escalation_threatened: number
  legal_threat: number
  payment_dispute: number
  competitor_mentioned: number
}

interface RiskSignalsCardProps {
  signals: RiskSignals | null
  loading?: boolean
}

const signalConfig = [
  {
    key: 'deactivation_intent',
    label: 'Deactivation Intent',
    icon: LogOut,
    color: 'text-red-500',
    bgColor: 'bg-red-50',
    borderColor: 'border-red-200',
    description: 'Customer expressed intent to deactivate'
  },
  {
    key: 'deactivation_confirmed',
    label: 'Deactivation Confirmed',
    icon: PhoneOff,
    color: 'text-red-700',
    bgColor: 'bg-red-100',
    borderColor: 'border-red-300',
    description: 'Customer confirmed deactivation decision'
  },
  {
    key: 'legal_threat',
    label: 'Legal Threat',
    icon: Scale,
    color: 'text-purple-600',
    bgColor: 'bg-purple-50',
    borderColor: 'border-purple-200',
    description: 'Customer threatened legal action'
  },
  {
    key: 'escalation_threatened',
    label: 'Escalation Threatened',
    icon: TrendingUp,
    color: 'text-orange-500',
    bgColor: 'bg-orange-50',
    borderColor: 'border-orange-200',
    description: 'Customer threatened to escalate issue'
  },
  {
    key: 'refund_requested',
    label: 'Refund Requested',
    icon: DollarSign,
    color: 'text-amber-500',
    bgColor: 'bg-amber-50',
    borderColor: 'border-amber-200',
    description: 'Customer requested a refund'
  },
  {
    key: 'payment_dispute',
    label: 'Payment Dispute',
    icon: CreditCard,
    color: 'text-rose-500',
    bgColor: 'bg-rose-50',
    borderColor: 'border-rose-200',
    description: 'Issues related to payment'
  },
  {
    key: 'competitor_mentioned',
    label: 'Competitor Mentioned',
    icon: Building,
    color: 'text-blue-500',
    bgColor: 'bg-blue-50',
    borderColor: 'border-blue-200',
    description: 'Customer mentioned competitor'
  }
]

export default function RiskSignalsCard({ signals, loading }: RiskSignalsCardProps) {
  if (loading || !signals) {
    return (
      <div className="animate-pulse grid grid-cols-2 gap-3">
        {[1, 2, 3, 4, 5, 6].map(i => (
          <div key={i} className="h-20 bg-gray-200 rounded" />
        ))}
      </div>
    )
  }

  const totalSignals = Object.values(signals).reduce((a, b) => a + b, 0)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-gray-500">Risk Signals Detected</h3>
        <span className="px-2 py-0.5 rounded-full bg-red-100 text-red-700 text-xs font-medium">
          {totalSignals} total signals
        </span>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
        {signalConfig.map(config => {
          const count = signals[config.key as keyof RiskSignals] || 0
          const Icon = config.icon

          return (
            <div
              key={config.key}
              className={`p-3 rounded-lg border ${config.bgColor} ${config.borderColor} ${
                count > 0 ? '' : 'opacity-60'
              }`}
            >
              <div className="flex items-start justify-between">
                <Icon className={`h-5 w-5 ${config.color}`} />
                <span className={`text-2xl font-bold ${config.color}`}>
                  {count}
                </span>
              </div>
              <p className="text-xs font-medium text-gray-700 mt-2">
                {config.label}
              </p>
              <p className="text-xs text-gray-500 mt-0.5 line-clamp-1">
                {config.description}
              </p>
            </div>
          )
        })}
      </div>

      {/* Summary Bar */}
      <div className="pt-3 border-t">
        <div className="flex items-center gap-2 text-xs text-gray-500">
          <AlertTriangle className="h-4 w-4 text-amber-500" />
          <span>
            {signals.deactivation_intent + signals.deactivation_confirmed} deactivation signals, {' '}
            {signals.legal_threat + signals.escalation_threatened} escalation signals
          </span>
        </div>
      </div>
    </div>
  )
}
