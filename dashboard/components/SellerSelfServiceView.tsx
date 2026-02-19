'use client'

import { useEffect, useState } from 'react'
import {
  CheckCircle2,
  AlertCircle,
  MapPin,
  ShoppingBag,
  TrendingUp,
  Target,
  ArrowRight,
  Lightbulb,
  Globe,
  Package,
  Phone,
  Star,
  ChevronRight,
  RefreshCw,
  X
} from 'lucide-react'

interface ActionItem {
  id: string
  category: 'geography' | 'categories' | 'leads' | 'profile'
  priority: 'high' | 'medium' | 'low'
  title: string
  description: string
  impact: string
  howToFix: string
  metric?: {
    current: number | string
    target?: number | string
    unit?: string
  }
}

interface SellerActionData {
  glid: string
  companyName: string
  overallScore: number
  actionItems: ActionItem[]
  categoryHealth: {
    total: number
    active: number
    lowActivity: number
    zeroConsumption: number
  }
  geographicStatus: {
    currentPreference: string
    blockedCities: number
    canExpand: boolean
    expansionPotential: string
  }
  leadEngagement: {
    freshConsumption: number
    pnsResponseRate: string
    cqsScore: number
  }
}

interface SellerSelfServiceViewProps {
  companyId: string
  onClose?: () => void
}

export default function SellerSelfServiceView({ companyId, onClose }: SellerSelfServiceViewProps) {
  const [data, setData] = useState<SellerActionData | null>(null)
  const [loading, setLoading] = useState(true)
  const [expandedAction, setExpandedAction] = useState<string | null>(null)

  useEffect(() => {
    fetchSellerActions()
  }, [companyId])

  const fetchSellerActions = async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/seller-actions/${companyId}`)
      if (res.ok) {
        const result = await res.json()
        setData(result)
      }
    } catch (error) {
      console.error('Error fetching seller actions:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <RefreshCw className="h-8 w-8 animate-spin text-blue-500" />
      </div>
    )
  }

  if (!data) {
    return (
      <div className="text-center py-12 text-gray-500">
        Unable to load seller insights
      </div>
    )
  }

  const priorityColors = {
    high: 'border-red-200 bg-red-50',
    medium: 'border-yellow-200 bg-yellow-50',
    low: 'border-blue-200 bg-blue-50'
  }

  const priorityBadge = {
    high: 'bg-red-100 text-red-700',
    medium: 'bg-yellow-100 text-yellow-700',
    low: 'bg-blue-100 text-blue-700'
  }

  const categoryIcons = {
    geography: MapPin,
    categories: ShoppingBag,
    leads: Target,
    profile: Star
  }

  const scoreColor = data.overallScore >= 70 ? 'text-green-600' :
    data.overallScore >= 50 ? 'text-yellow-600' : 'text-red-600'

  const scoreBg = data.overallScore >= 70 ? 'bg-green-100' :
    data.overallScore >= 50 ? 'bg-yellow-100' : 'bg-red-100'

  return (
    <div className="space-y-6">
      {/* Header with Score */}
      <div className={`${scoreBg} rounded-xl p-6`}>
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-gray-900">Your Business Health</h2>
            <p className="text-sm text-gray-600 mt-1">
              Actions you can take to improve your performance on IndiaMART
            </p>
          </div>
          <div className="text-center">
            <div className={`text-4xl font-bold ${scoreColor}`}>{data.overallScore}</div>
            <div className="text-xs text-gray-500">out of 100</div>
          </div>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg border p-4">
          <div className="flex items-center gap-2 text-gray-600 mb-1">
            <ShoppingBag className="h-4 w-4" />
            <span className="text-xs">Category Issues</span>
          </div>
          <p className="text-2xl font-bold">{data.categoryHealth.lowActivity + data.categoryHealth.zeroConsumption}</p>
          <p className="text-xs text-gray-500">
            {data.categoryHealth.lowActivity} low-activity, {data.categoryHealth.zeroConsumption} zero-consumption
          </p>
        </div>

        <div className="bg-white rounded-lg border p-4">
          <div className="flex items-center gap-2 text-gray-600 mb-1">
            <Target className="h-4 w-4" />
            <span className="text-xs">Lead Consumption</span>
          </div>
          <p className="text-2xl font-bold">{data.leadEngagement.freshConsumption}</p>
          <p className="text-xs text-gray-500">this month</p>
        </div>

        <div className="bg-white rounded-lg border p-4">
          <div className="flex items-center gap-2 text-gray-600 mb-1">
            <Phone className="h-4 w-4" />
            <span className="text-xs">Call Response</span>
          </div>
          <p className="text-2xl font-bold">{data.leadEngagement.pnsResponseRate}</p>
          <p className="text-xs text-gray-500">PNS rate</p>
        </div>

        <div className="bg-white rounded-lg border p-4">
          <div className="flex items-center gap-2 text-gray-600 mb-1">
            <Globe className="h-4 w-4" />
            <span className="text-xs">Geography</span>
          </div>
          <p className="text-xl font-bold">{data.geographicStatus.currentPreference}</p>
          <p className="text-xs text-gray-500">{data.geographicStatus.blockedCities} cities blocked</p>
        </div>
      </div>

      {/* Action Items */}
      <div className="bg-white rounded-xl border">
        <div className="p-4 border-b">
          <h3 className="font-semibold flex items-center gap-2">
            <Lightbulb className="h-5 w-5 text-yellow-500" />
            Recommended Actions
            <span className="text-sm font-normal text-gray-500">
              ({data.actionItems.length} items)
            </span>
          </h3>
          <p className="text-sm text-gray-500 mt-1">
            These are things you can do yourself to improve your business
          </p>
        </div>

        <div className="divide-y">
          {data.actionItems.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              <CheckCircle2 className="h-12 w-12 mx-auto mb-3 text-green-500" />
              <p className="font-medium">Great job!</p>
              <p className="text-sm">No immediate actions needed</p>
            </div>
          ) : (
            data.actionItems.map((action) => {
              const Icon = categoryIcons[action.category]
              const isExpanded = expandedAction === action.id

              return (
                <div
                  key={action.id}
                  className={`${priorityColors[action.priority]} border-l-4 transition-all`}
                >
                  <button
                    onClick={() => setExpandedAction(isExpanded ? null : action.id)}
                    className="w-full p-4 text-left flex items-start gap-3"
                  >
                    <div className={`p-2 rounded-lg ${
                      action.priority === 'high' ? 'bg-red-100' :
                      action.priority === 'medium' ? 'bg-yellow-100' : 'bg-blue-100'
                    }`}>
                      <Icon className="h-5 w-5 text-gray-700" />
                    </div>

                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="font-medium">{action.title}</h4>
                        <span className={`text-xs px-2 py-0.5 rounded-full ${priorityBadge[action.priority]}`}>
                          {action.priority}
                        </span>
                      </div>
                      <p className="text-sm text-gray-600">{action.description}</p>

                      {action.metric && (
                        <div className="mt-2 flex items-center gap-4">
                          <span className="text-sm">
                            Current: <strong>{action.metric.current}{action.metric.unit}</strong>
                          </span>
                          {action.metric.target && (
                            <span className="text-sm text-green-600">
                              Target: <strong>{action.metric.target}{action.metric.unit}</strong>
                            </span>
                          )}
                        </div>
                      )}
                    </div>

                    <ChevronRight className={`h-5 w-5 text-gray-400 transition-transform ${
                      isExpanded ? 'rotate-90' : ''
                    }`} />
                  </button>

                  {isExpanded && (
                    <div className="px-4 pb-4 ml-14">
                      <div className="bg-white rounded-lg p-4 space-y-3">
                        <div>
                          <p className="text-xs font-medium text-gray-500 uppercase mb-1">Impact</p>
                          <p className="text-sm text-gray-700">{action.impact}</p>
                        </div>
                        <div>
                          <p className="text-xs font-medium text-gray-500 uppercase mb-1">How to Fix</p>
                          <p className="text-sm text-gray-700 whitespace-pre-line">{action.howToFix}</p>
                        </div>
                        <button className="mt-2 text-sm text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1">
                          Go to Seller Panel <ArrowRight className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )
            })
          )}
        </div>
      </div>

      {/* Category Health Details */}
      {(data.categoryHealth.lowActivity > 0 || data.categoryHealth.zeroConsumption > 0) && (
        <div className="bg-white rounded-xl border p-4">
          <h3 className="font-semibold mb-4 flex items-center gap-2">
            <ShoppingBag className="h-5 w-5 text-purple-600" />
            Category Health
          </h3>

          <div className="grid md:grid-cols-2 gap-4">
            {data.categoryHealth.lowActivity > 0 && (
              <div className="p-4 bg-yellow-50 rounded-lg border border-yellow-200">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium text-yellow-800">Low Activity Categories</span>
                  <span className="text-2xl font-bold text-yellow-700">{data.categoryHealth.lowActivity}</span>
                </div>
                <p className="text-sm text-yellow-700">
                  These categories have only 1 transaction in the last 6 months. Consider adding more products or removing them.
                </p>
              </div>
            )}

            {data.categoryHealth.zeroConsumption > 0 && (
              <div className="p-4 bg-red-50 rounded-lg border border-red-200">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium text-red-800">Zero Consumption Categories</span>
                  <span className="text-2xl font-bold text-red-700">{data.categoryHealth.zeroConsumption}</span>
                </div>
                <p className="text-sm text-red-700">
                  No leads consumed in these categories. Either activate them with products or remove to focus on active ones.
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Geographic Expansion */}
      {data.geographicStatus.canExpand && (
        <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-xl border border-blue-200 p-4">
          <h3 className="font-semibold mb-2 flex items-center gap-2">
            <Globe className="h-5 w-5 text-blue-600" />
            Expansion Opportunity
          </h3>
          <p className="text-sm text-gray-700 mb-3">{data.geographicStatus.expansionPotential}</p>
          <div className="flex items-center gap-4">
            <span className="text-sm bg-white px-3 py-1 rounded-full border">
              Current: <strong>{data.geographicStatus.currentPreference}</strong>
            </span>
            <ArrowRight className="h-4 w-4 text-gray-400" />
            <span className="text-sm bg-blue-100 px-3 py-1 rounded-full text-blue-700 font-medium">
              Suggested: Expand to Regional/National
            </span>
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="text-center text-sm text-gray-500 pt-4 border-t">
        <p>These insights are based on your account activity and industry benchmarks.</p>
        <p className="mt-1">For help, contact your Account Manager or visit the Help Center.</p>
      </div>
    </div>
  )
}
