'use client'

import { useState, useEffect } from 'react'
import {
  Activity,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  CheckCircle,
  XCircle,
  Lightbulb,
  Target,
  BarChart3,
  ArrowRight,
  Building2,
  MapPin,
  HelpCircle,
  RefreshCw,
  Users,
  Brain
} from 'lucide-react'
import { METRIC_DEFINITIONS } from './Tooltip'

interface ExecutiveSummary {
  totalCalls: number
  highRiskCalls: number
  highRiskRate: number
  deactivationIntents: number
  deactivationRate: number
  resolvedCalls: number
  resolutionRate: number
  criticalIssues: number
  avgChurnRisk: number
  riskSignalsTotal: number
  healthScore: number
}

interface ActionableInsight {
  id: string
  type: 'critical' | 'warning' | 'info' | 'success'
  title: string
  description: string
  metric: string
  recommendation: string
  priority: number
}

interface CrossAnalysisItem {
  industry: string
  tier: string
  totalCalls: number
  highRiskCalls: number
  riskRate: number
  avgChurnRisk: number
  deactivations: number
  topIssue: string
  topIssueCount: number
}

interface IssueTrend {
  category: string
  categoryKey: string
  count: number
  percentage: number
  highRiskAssociation: number
}

interface TierBreakdown {
  tier: string
  total: number
  highRisk: number
  rate: number
}

interface RiskIndustry {
  industry: string
  totalCalls: number
  highRiskCalls: number
  riskRate: number
}

interface BehaviorBreakdown {
  type: string
  count: number
  percentage: number
  avgHealthScore: number
}

interface EngagementMetric {
  metric: string
  value: number | string
  trend: 'up' | 'down' | 'stable'
  changePercent: number | null
}

interface BehavioralAggregation {
  totalSellers: number
  behaviorBreakdown: BehaviorBreakdown[]
  avgHealthScore: number
  avgResolutionRate: number
  engagementMetrics: EngagementMetric[]
  topIssueCategories: Array<{ category: string; count: number; percentage: number }>
  riskDistribution: { high: number; medium: number; low: number }
}

interface AggregatedData {
  executiveSummary: ExecutiveSummary
  actionableInsights: ActionableInsight[]
  crossAnalysis: CrossAnalysisItem[]
  issueTrends: IssueTrend[]
  tierBreakdown: TierBreakdown[]
  topRiskIndustries: RiskIndustry[]
  behavioralAggregation?: BehavioralAggregation
}

// Tooltip helper
function InfoTip({ text }: { text: string }) {
  const [show, setShow] = useState(false)
  return (
    <div
      className="relative inline-flex ml-1"
      onMouseEnter={() => setShow(true)}
      onMouseLeave={() => setShow(false)}
    >
      <HelpCircle className="h-3.5 w-3.5 text-gray-400 hover:text-gray-600 cursor-help" />
      {show && (
        <div className="absolute z-50 bottom-full left-1/2 -translate-x-1/2 mb-2 pointer-events-none">
          <div className="bg-gray-900 text-white text-xs rounded-lg py-2 px-3 shadow-lg w-52 whitespace-normal">
            {text}
            <div className="absolute top-full left-1/2 -translate-x-1/2 w-0 h-0 border-4 border-t-gray-900 border-l-transparent border-r-transparent border-b-transparent" />
          </div>
        </div>
      )}
    </div>
  )
}

export default function AggregatedInsights() {
  const [data, setData] = useState<AggregatedData | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeSection, setActiveSection] = useState<'summary' | 'insights' | 'cross' | 'trends' | 'behavioral'>('summary')

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/aggregated-insights')
      const result = await res.json()
      setData(result)
    } catch (error) {
      console.error('Error fetching aggregated insights:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="animate-pulse space-y-6">
        <div className="h-32 bg-gray-200 rounded-xl" />
        <div className="grid grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => <div key={i} className="h-24 bg-gray-200 rounded-lg" />)}
        </div>
        <div className="h-64 bg-gray-200 rounded-xl" />
      </div>
    )
  }

  if (!data) {
    return (
      <div className="text-center py-12 text-gray-500">
        Failed to load aggregated insights
      </div>
    )
  }

  const { executiveSummary, actionableInsights, crossAnalysis, issueTrends, tierBreakdown, topRiskIndustries } = data

  // Health score color
  const healthColor = executiveSummary.healthScore >= 70 ? 'text-green-600' :
    executiveSummary.healthScore >= 50 ? 'text-yellow-600' : 'text-red-600'

  const healthBg = executiveSummary.healthScore >= 70 ? 'bg-green-100' :
    executiveSummary.healthScore >= 50 ? 'bg-yellow-100' : 'bg-red-100'

  return (
    <div className="space-y-6">
      {/* Health Score Banner */}
      <div className={`${healthBg} rounded-xl p-6 border`}>
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <Activity className={`h-6 w-6 ${healthColor}`} />
              <h2 className="text-xl font-bold text-gray-900">Customer Health Score</h2>
              <InfoTip text="Overall health score calculated from resolution rate, churn risk, deactivation rate, and sentiment trends. Higher is better." />
            </div>
            <p className="text-sm text-gray-600 mt-1">
              Composite score based on resolution rate, risk levels, and customer sentiment
            </p>
          </div>
          <div className="text-right">
            <div className={`text-5xl font-bold ${healthColor}`}>
              {executiveSummary.healthScore}
            </div>
            <div className="text-sm text-gray-500">out of 100</div>
          </div>
        </div>
      </div>

      {/* Section Navigation */}
      <div className="flex gap-2 border-b">
        {[
          { id: 'summary', label: 'Executive Summary', icon: BarChart3 },
          { id: 'insights', label: 'Actionable Insights', icon: Lightbulb },
          { id: 'cross', label: 'Cross Analysis', icon: Target },
          { id: 'trends', label: 'Issue Trends', icon: TrendingUp },
          { id: 'behavioral', label: 'Behavioral Insights', icon: Brain }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveSection(tab.id as any)}
            className={`px-4 py-2 font-medium text-sm border-b-2 transition-colors flex items-center gap-2 ${
              activeSection === tab.id
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <tab.icon className="h-4 w-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Executive Summary Section */}
      {activeSection === 'summary' && (
        <div className="space-y-6">
          {/* Key Metrics Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-white p-4 rounded-lg border shadow-sm">
              <div className="flex items-center gap-1 text-gray-500 text-sm mb-1">
                Total Calls
                <InfoTip text={METRIC_DEFINITIONS.totalCalls} />
              </div>
              <div className="text-3xl font-bold">{executiveSummary.totalCalls}</div>
            </div>

            <div className="bg-red-50 p-4 rounded-lg border border-red-200">
              <div className="flex items-center gap-1 text-red-600 text-sm mb-1">
                High Risk
                <InfoTip text={METRIC_DEFINITIONS.highRiskCalls} />
              </div>
              <div className="text-3xl font-bold text-red-700">{executiveSummary.highRiskCalls}</div>
              <div className="text-xs text-red-500">{executiveSummary.highRiskRate}% of calls</div>
            </div>

            <div className="bg-orange-50 p-4 rounded-lg border border-orange-200">
              <div className="flex items-center gap-1 text-orange-600 text-sm mb-1">
                Deactivation Intent
                <InfoTip text={METRIC_DEFINITIONS.deactivationIntents} />
              </div>
              <div className="text-3xl font-bold text-orange-700">{executiveSummary.deactivationIntents}</div>
              <div className="text-xs text-orange-500">{executiveSummary.deactivationRate}% of calls</div>
            </div>

            <div className="bg-green-50 p-4 rounded-lg border border-green-200">
              <div className="flex items-center gap-1 text-green-600 text-sm mb-1">
                Resolved
                <InfoTip text={METRIC_DEFINITIONS.resolutionRate} />
              </div>
              <div className="text-3xl font-bold text-green-700">{executiveSummary.resolvedCalls}</div>
              <div className="text-xs text-green-500">{executiveSummary.resolutionRate}% resolution</div>
            </div>
          </div>

          {/* Secondary Metrics */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-white p-4 rounded-lg border">
              <div className="text-sm text-gray-500 mb-1">Critical Issues</div>
              <div className="text-2xl font-bold text-red-600">{executiveSummary.criticalIssues}</div>
            </div>

            <div className="bg-white p-4 rounded-lg border">
              <div className="text-sm text-gray-500 mb-1">Avg Churn Risk</div>
              <div className="text-2xl font-bold">{executiveSummary.avgChurnRisk}%</div>
            </div>

            <div className="bg-white p-4 rounded-lg border">
              <div className="text-sm text-gray-500 mb-1">Risk Signals</div>
              <div className="text-2xl font-bold text-amber-600">{executiveSummary.riskSignalsTotal}</div>
            </div>

            <div className="bg-white p-4 rounded-lg border">
              <div className="text-sm text-gray-500 mb-1">Needs Attention</div>
              <div className="text-2xl font-bold text-purple-600">
                {actionableInsights.filter(i => i.type === 'critical' || i.type === 'warning').length}
              </div>
            </div>
          </div>

          {/* Tier & Industry Quick View */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Tier Breakdown */}
            <div className="bg-white p-6 rounded-lg border shadow-sm">
              <h3 className="font-semibold mb-4 flex items-center gap-2">
                <MapPin className="h-5 w-5 text-blue-600" />
                Risk by City Tier
              </h3>
              <div className="space-y-3">
                {tierBreakdown.map(tier => (
                  <div key={tier.tier} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className={`w-3 h-3 rounded-full ${
                        tier.tier === 'Tier 1' ? 'bg-blue-500' :
                        tier.tier === 'Tier 2' ? 'bg-green-500' :
                        tier.tier === 'Tier 3' ? 'bg-yellow-500' : 'bg-gray-400'
                      }`} />
                      <span className="text-sm font-medium">{tier.tier}</span>
                      <span className="text-xs text-gray-500">({tier.total} calls)</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-24 h-2 bg-gray-200 rounded-full overflow-hidden">
                        <div
                          className={`h-full ${
                            tier.rate >= 40 ? 'bg-red-500' :
                            tier.rate >= 25 ? 'bg-orange-500' : 'bg-green-500'
                          }`}
                          style={{ width: `${Math.min(tier.rate, 100)}%` }}
                        />
                      </div>
                      <span className={`text-sm font-medium w-12 text-right ${
                        tier.rate >= 40 ? 'text-red-600' :
                        tier.rate >= 25 ? 'text-orange-600' : 'text-green-600'
                      }`}>
                        {tier.rate}%
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Top Risk Industries */}
            <div className="bg-white p-6 rounded-lg border shadow-sm">
              <h3 className="font-semibold mb-4 flex items-center gap-2">
                <Building2 className="h-5 w-5 text-purple-600" />
                Top Risk Industries
              </h3>
              <div className="space-y-3">
                {topRiskIndustries.map((ind, idx) => (
                  <div key={idx} className="flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <span className="text-sm font-medium truncate block">{ind.industry}</span>
                      <span className="text-xs text-gray-500">{ind.totalCalls} calls</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                        ind.riskRate >= 50 ? 'bg-red-100 text-red-700' :
                        ind.riskRate >= 30 ? 'bg-orange-100 text-orange-700' :
                        'bg-green-100 text-green-700'
                      }`}>
                        {ind.riskRate}% risk
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Actionable Insights Section */}
      {activeSection === 'insights' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-500">
              AI-generated recommendations based on your call data patterns
            </p>
            <span className="text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded">
              {actionableInsights.length} insights
            </span>
          </div>

          {actionableInsights.length === 0 ? (
            <div className="text-center py-12 bg-green-50 rounded-xl border border-green-200">
              <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-3" />
              <h3 className="font-semibold text-green-800">All Clear!</h3>
              <p className="text-sm text-green-600">No critical issues detected at this time.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {actionableInsights.map(insight => (
                <div
                  key={insight.id}
                  className={`p-5 rounded-xl border-l-4 ${
                    insight.type === 'critical' ? 'bg-red-50 border-red-500' :
                    insight.type === 'warning' ? 'bg-amber-50 border-amber-500' :
                    insight.type === 'success' ? 'bg-green-50 border-green-500' :
                    'bg-blue-50 border-blue-500'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      {insight.type === 'critical' && <AlertTriangle className="h-5 w-5 text-red-600" />}
                      {insight.type === 'warning' && <AlertTriangle className="h-5 w-5 text-amber-600" />}
                      {insight.type === 'success' && <CheckCircle className="h-5 w-5 text-green-600" />}
                      {insight.type === 'info' && <Lightbulb className="h-5 w-5 text-blue-600" />}
                      <h4 className="font-semibold text-gray-900">{insight.title}</h4>
                    </div>
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                      insight.type === 'critical' ? 'bg-red-200 text-red-800' :
                      insight.type === 'warning' ? 'bg-amber-200 text-amber-800' :
                      insight.type === 'success' ? 'bg-green-200 text-green-800' :
                      'bg-blue-200 text-blue-800'
                    }`}>
                      {insight.metric}
                    </span>
                  </div>
                  <p className="text-sm text-gray-700 mt-2">{insight.description}</p>
                  <div className="mt-3 pt-3 border-t border-gray-200">
                    <div className="flex items-start gap-2">
                      <ArrowRight className="h-4 w-4 text-gray-400 mt-0.5 flex-shrink-0" />
                      <p className="text-sm text-gray-600">
                        <span className="font-medium">Recommendation:</span> {insight.recommendation}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Cross Analysis Section */}
      {activeSection === 'cross' && (
        <div className="space-y-4">
          <p className="text-sm text-gray-500">
            Combined view of Industry + City Tier + Risk metrics
          </p>

          <div className="bg-white rounded-lg border shadow-sm overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">Industry</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">Tier</th>
                  <th className="px-4 py-3 text-right text-sm font-medium text-gray-500">Calls</th>
                  <th className="px-4 py-3 text-right text-sm font-medium text-gray-500">Risk Rate</th>
                  <th className="px-4 py-3 text-right text-sm font-medium text-gray-500">Avg Churn</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">Top Issue</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {crossAnalysis.map((item, idx) => (
                  <tr key={idx} className={`hover:bg-gray-50 ${item.riskRate >= 50 ? 'bg-red-50' : ''}`}>
                    <td className="px-4 py-3 text-sm font-medium">{item.industry}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded text-xs text-white ${
                        item.tier === 'Tier 1' ? 'bg-blue-500' :
                        item.tier === 'Tier 2' ? 'bg-green-500' :
                        'bg-yellow-500'
                      }`}>
                        {item.tier}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right text-sm">{item.totalCalls}</td>
                    <td className="px-4 py-3 text-right">
                      <span className={`px-2 py-0.5 rounded text-xs ${
                        item.riskRate >= 50 ? 'bg-red-100 text-red-700' :
                        item.riskRate >= 30 ? 'bg-orange-100 text-orange-700' :
                        'bg-green-100 text-green-700'
                      }`}>
                        {item.riskRate}%
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right text-sm">{item.avgChurnRisk}%</td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {item.topIssue && (
                        <span className="px-2 py-0.5 bg-gray-100 rounded text-xs">
                          {item.topIssue} ({item.topIssueCount})
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {crossAnalysis.length === 0 && (
              <div className="p-8 text-center text-gray-500">
                No cross-analysis data available
              </div>
            )}
          </div>
        </div>
      )}

      {/* Issue Trends Section */}
      {activeSection === 'trends' && (
        <div className="space-y-4">
          <p className="text-sm text-gray-500">
            Issue categories ranked by frequency and their correlation with high-risk calls
          </p>

          <div className="grid gap-4 md:grid-cols-2">
            {issueTrends.map((trend, idx) => (
              <div
                key={idx}
                className={`p-4 rounded-lg border ${
                  trend.highRiskAssociation >= 50 ? 'border-red-200 bg-red-50' :
                  trend.highRiskAssociation >= 30 ? 'border-orange-200 bg-orange-50' :
                  'border-gray-200 bg-white'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-medium">{trend.category}</h4>
                  <span className="text-sm text-gray-500">{trend.count} issues</span>
                </div>

                <div className="space-y-3 mt-3">
                  {/* Share of total issues */}
                  <div>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-gray-600">Share of Total Issues</span>
                      <span className="font-medium text-blue-600">{trend.percentage}%</span>
                    </div>
                    <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-blue-500"
                        style={{ width: `${Math.min(trend.percentage * 2, 100)}%` }}
                      />
                    </div>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {trend.count} out of all reported issues
                    </p>
                  </div>

                  {/* Churn risk correlation */}
                  <div>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-gray-600">Customers Likely to Churn</span>
                      <span className={`font-medium ${
                        trend.highRiskAssociation >= 50 ? 'text-red-600' :
                        trend.highRiskAssociation >= 30 ? 'text-orange-600' : 'text-green-600'
                      }`}>
                        {trend.highRiskAssociation}%
                      </span>
                    </div>
                    <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                      <div
                        className={`h-full ${
                          trend.highRiskAssociation >= 50 ? 'bg-red-500' :
                          trend.highRiskAssociation >= 30 ? 'bg-orange-500' : 'bg-green-500'
                        }`}
                        style={{ width: `${trend.highRiskAssociation}%` }}
                      />
                    </div>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {Math.round(trend.count * trend.highRiskAssociation / 100)} of {trend.count} customers with this issue may leave
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Behavioral Insights Section */}
      {activeSection === 'behavioral' && (
        <div className="space-y-6">
          <p className="text-sm text-gray-500">
            Aggregated behavioral analysis across all sellers based on call insights and metrics data
          </p>

          {data.behavioralAggregation ? (
            <>
              {/* Summary Cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-purple-50 rounded-lg p-4 border border-purple-200">
                  <div className="flex items-center gap-2 text-purple-600 mb-1">
                    <Users className="h-4 w-4" />
                    <span className="text-sm">Total Sellers</span>
                  </div>
                  <p className="text-2xl font-bold text-purple-700">
                    {data.behavioralAggregation.totalSellers}
                  </p>
                </div>
                <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
                  <div className="flex items-center gap-2 text-blue-600 mb-1">
                    <Activity className="h-4 w-4" />
                    <span className="text-sm">Avg Health Score</span>
                  </div>
                  <p className="text-2xl font-bold text-blue-700">
                    {data.behavioralAggregation.avgHealthScore}
                  </p>
                </div>
                <div className="bg-green-50 rounded-lg p-4 border border-green-200">
                  <div className="flex items-center gap-2 text-green-600 mb-1">
                    <CheckCircle className="h-4 w-4" />
                    <span className="text-sm">Avg Resolution Rate</span>
                  </div>
                  <p className="text-2xl font-bold text-green-700">
                    {data.behavioralAggregation.avgResolutionRate}%
                  </p>
                </div>
                <div className="bg-orange-50 rounded-lg p-4 border border-orange-200">
                  <div className="flex items-center gap-2 text-orange-600 mb-1">
                    <AlertTriangle className="h-4 w-4" />
                    <span className="text-sm">High Risk Sellers</span>
                  </div>
                  <p className="text-2xl font-bold text-orange-700">
                    {data.behavioralAggregation.riskDistribution.high}
                  </p>
                </div>
              </div>

              {/* Behavior Type Breakdown */}
              <div className="bg-white rounded-xl border p-6">
                <h3 className="font-semibold mb-4 flex items-center gap-2">
                  <Brain className="h-5 w-5 text-purple-600" />
                  Seller Behavior Classification
                </h3>
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                  {data.behavioralAggregation.behaviorBreakdown.map((behavior, idx) => (
                    <div
                      key={idx}
                      className={`p-4 rounded-lg border ${
                        behavior.type === 'high_potential' ? 'border-green-200 bg-green-50' :
                        behavior.type === 'dormant_at_risk' ? 'border-red-200 bg-red-50' :
                        behavior.type === 'misconfigured' ? 'border-yellow-200 bg-yellow-50' :
                        'border-gray-200 bg-gray-50'
                      }`}
                    >
                      <h4 className="font-medium capitalize mb-2">
                        {behavior.type.replace(/_/g, ' ')}
                      </h4>
                      <div className="flex justify-between items-end">
                        <div>
                          <p className="text-2xl font-bold">{behavior.count}</p>
                          <p className="text-xs text-gray-500">{behavior.percentage}% of sellers</p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm text-gray-600">Avg Health</p>
                          <p className={`font-bold ${
                            behavior.avgHealthScore >= 60 ? 'text-green-600' :
                            behavior.avgHealthScore >= 40 ? 'text-yellow-600' : 'text-red-600'
                          }`}>
                            {behavior.avgHealthScore}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Risk Distribution */}
              <div className="grid md:grid-cols-2 gap-6">
                <div className="bg-white rounded-xl border p-6">
                  <h3 className="font-semibold mb-4">Risk Distribution</h3>
                  <div className="space-y-4">
                    <div>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="text-red-600 font-medium">High Risk</span>
                        <span>{data.behavioralAggregation.riskDistribution.high} sellers</span>
                      </div>
                      <div className="h-3 bg-gray-200 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-red-500"
                          style={{ width: `${(data.behavioralAggregation.riskDistribution.high / data.behavioralAggregation.totalSellers) * 100}%` }}
                        />
                      </div>
                    </div>
                    <div>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="text-yellow-600 font-medium">Medium Risk</span>
                        <span>{data.behavioralAggregation.riskDistribution.medium} sellers</span>
                      </div>
                      <div className="h-3 bg-gray-200 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-yellow-500"
                          style={{ width: `${(data.behavioralAggregation.riskDistribution.medium / data.behavioralAggregation.totalSellers) * 100}%` }}
                        />
                      </div>
                    </div>
                    <div>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="text-green-600 font-medium">Low Risk</span>
                        <span>{data.behavioralAggregation.riskDistribution.low} sellers</span>
                      </div>
                      <div className="h-3 bg-gray-200 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-green-500"
                          style={{ width: `${(data.behavioralAggregation.riskDistribution.low / data.behavioralAggregation.totalSellers) * 100}%` }}
                        />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="bg-white rounded-xl border p-6">
                  <h3 className="font-semibold mb-4">Top Issue Categories</h3>
                  <div className="space-y-3">
                    {data.behavioralAggregation.topIssueCategories.slice(0, 5).map((issue, idx) => (
                      <div key={idx} className="flex items-center gap-3">
                        <span className="text-sm text-gray-500 w-6">{idx + 1}.</span>
                        <div className="flex-1">
                          <div className="flex justify-between text-sm mb-1">
                            <span className="font-medium">{issue.category}</span>
                            <span className="text-gray-500">{issue.count} occurrences</span>
                          </div>
                          <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-blue-500"
                              style={{ width: `${issue.percentage}%` }}
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div className="text-center py-12 text-gray-500">
              <Brain className="h-12 w-12 mx-auto mb-4 text-gray-300" />
              <p>Behavioral aggregation data not available</p>
              <p className="text-sm mt-2">This data is calculated from seller profiles and metrics</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
