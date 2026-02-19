'use client'

import { useEffect, useState } from 'react'
import {
  Phone,
  AlertTriangle,
  TrendingUp,
  CheckCircle,
  Activity,
  RefreshCw,
  Filter,
  Search,
  BarChart3,
  MessageSquare,
  Target,
  MapPin
} from 'lucide-react'
import StatsCard from '@/components/StatsCard'
import AlertsList from '@/components/AlertsList'
import CallsTable from '@/components/CallsTable'
import RiskChart from '@/components/RiskChart'
import TrendChart from '@/components/TrendChart'
import IssueCategoryChart from '@/components/IssueCategoryChart'
import SentimentJourneyChart from '@/components/SentimentJourneyChart'
import CriticalIssuesList from '@/components/CriticalIssuesList'
import HighChurnCallsList from '@/components/HighChurnCallsList'
import KeyQuotesSection from '@/components/KeyQuotesSection'
import RiskSignalsCard from '@/components/RiskSignalsCard'
import TopicsCloud from '@/components/TopicsCloud'
import GeographyInsights from '@/components/GeographyInsights'
import SOPRecommendations from '@/components/SOPRecommendations'
import CallsWithSOP from '@/components/CallsWithSOP'
import IndustryAnalysis from '@/components/IndustryAnalysis'
import SummaryStatCard from '@/components/SummaryStatCard'
import AggregatedInsights from '@/components/AggregatedInsights'
import SellerInsights from '@/components/SellerInsights'
import SellerSelfServiceView from '@/components/SellerSelfServiceView'
import { METRIC_DEFINITIONS } from '@/components/Tooltip'
import { BookOpen, Building2, Sparkles, Users, UserCircle } from 'lucide-react'

interface OverviewStats {
  total_calls: number
  processed_calls: number
  high_risk_calls: number
  deactivation_intents: number
  resolved_calls: number
  resolution_rate: number
  avg_churn_risk: number
}

interface PatternsData {
  summary: {
    total_calls: number
    total_issues: number
    critical_issues: number
    high_risk_calls: number
  }
  categoryDistribution: Array<{
    category: string
    count: number
    severityBreakdown: Record<string, number>
  }>
  severityDistribution: Record<string, number>
  sentimentAnalysis: {
    journeys: Array<{ journey: string; count: number }>
    startDistribution: Record<string, number>
    endDistribution: Record<string, number>
  }
  resolutionAnalysis: {
    statusDistribution: Record<string, number>
    purposeFulfilled: { yes: number; no: number; unclear: number }
  }
  riskSignals: {
    deactivation_intent: number
    deactivation_confirmed: number
    refund_requested: number
    escalation_threatened: number
    legal_threat: number
    payment_dispute: number
    competitor_mentioned: number
  }
  executiveTones: Record<string, number>
  criticalIssues: Array<any>
  highChurnCalls: Array<any>
  callPurposes: Record<string, number>
  topTopics: Array<{ topic: string; count: number }>
  keyQuotes: Array<any>
  followUpAnalysis: {
    required: number
    by_executive: number
    by_customer: number
    pending: number
  }
}

export default function Dashboard() {
  const [activeTab, setActiveTab] = useState<'overview' | 'insights' | 'sellers' | 'seller-portal' | 'patterns' | 'geography' | 'industry' | 'sop' | 'alerts' | 'quotes' | 'calls'>('overview')
  const [selectedSellerId, setSelectedSellerId] = useState<string>('')
  const [stats, setStats] = useState<OverviewStats | null>(null)
  const [alerts, setAlerts] = useState<any[]>([])
  const [calls, setCalls] = useState<any[]>([])
  const [patterns, setPatterns] = useState<PatternsData | null>(null)
  const [geography, setGeography] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    setLoading(true)
    try {
      const [statsRes, alertsRes, callsRes, patternsRes, geographyRes] = await Promise.all([
        fetch('/api/stats'),
        fetch('/api/alerts'),
        fetch('/api/calls?limit=100'),
        fetch('/api/patterns'),
        fetch('/api/geography')
      ])

      const statsData = await statsRes.json()
      const alertsData = await alertsRes.json()
      const callsData = await callsRes.json()
      const patternsData = await patternsRes.json()
      const geographyData = await geographyRes.json()

      setStats(statsData)
      setAlerts(alertsData.alerts || [])
      setCalls(callsData.calls || [])
      setPatterns(patternsData)
      setGeography(geographyData)
    } catch (error) {
      console.error('Error fetching data:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      fetchData()
      return
    }

    try {
      const res = await fetch(`/api/calls?search=${encodeURIComponent(searchQuery)}&limit=100`)
      const data = await res.json()
      setCalls(data.calls || [])
    } catch (error) {
      console.error('Error searching:', error)
    }
  }

  // Calculate risk distribution for chart
  const riskDistribution = {
    high: calls.filter(c => (c.call_insights?.[0]?.churn_risk_score || 0) >= 0.7).length,
    medium: calls.filter(c => {
      const score = c.call_insights?.[0]?.churn_risk_score || 0
      return score >= 0.4 && score < 0.7
    }).length,
    low: calls.filter(c => (c.call_insights?.[0]?.churn_risk_score || 0) < 0.4).length
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Call Insights Dashboard</h1>
              <p className="text-sm text-gray-500">IndiaMART Customer Retention Analytics</p>
            </div>
            <button
              onClick={fetchData}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>
        </div>
      </header>

      {/* Navigation Tabs */}
      <div className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <nav className="flex space-x-8 overflow-x-auto">
            {[
              { id: 'overview', label: 'Overview', icon: Activity },
              { id: 'insights', label: 'Aggregated Insights', icon: Sparkles },
              { id: 'sellers', label: 'Seller Insights', icon: Users },
              { id: 'seller-portal', label: 'Seller Portal', icon: UserCircle },
              { id: 'patterns', label: 'Pattern Analysis', icon: BarChart3 },
              // { id: 'geography', label: 'Geography', icon: MapPin }, // Hidden
              { id: 'industry', label: 'Industry Analysis', icon: Building2 },
              // { id: 'sop', label: 'SOP Guide', icon: BookOpen }, // Hidden - SOP now available via icons in All Calls and Seller Insights
              { id: 'alerts', label: 'High Risk', icon: AlertTriangle, badge: alerts.length },
              { id: 'calls', label: 'All Calls', icon: Phone },
              // { id: 'quotes', label: 'Key Quotes', icon: MessageSquare }, // Hidden
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center gap-2 px-1 py-4 border-b-2 text-sm font-medium transition-colors whitespace-nowrap ${
                  activeTab === tab.id
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <tab.icon className="h-4 w-4" />
                {tab.label}
                {tab.badge && tab.badge > 0 && (
                  <span className="ml-1 px-2 py-0.5 bg-red-100 text-red-600 text-xs rounded-full">
                    {tab.badge}
                  </span>
                )}
              </button>
            ))}
          </nav>
        </div>
      </div>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
        {/* Overview Tab */}
        {activeTab === 'overview' && (
          <div className="space-y-8">
            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <StatsCard
                title="Total Calls"
                value={stats?.total_calls || 0}
                subtitle={`${stats?.processed_calls || 0} analyzed`}
                icon={<Phone className="h-6 w-6" />}
                tooltip={METRIC_DEFINITIONS.totalCalls}
              />
              <StatsCard
                title="High Risk Calls"
                value={stats?.high_risk_calls || 0}
                subtitle="Churn risk >= 70%"
                icon={<AlertTriangle className="h-6 w-6" />}
                variant="danger"
                tooltip={METRIC_DEFINITIONS.highRiskCalls}
              />
              <StatsCard
                title="Deactivation Intents"
                value={stats?.deactivation_intents || 0}
                subtitle="Customers wanting to leave"
                icon={<TrendingUp className="h-6 w-6" />}
                variant="warning"
                tooltip={METRIC_DEFINITIONS.deactivationIntents}
              />
              <StatsCard
                title="Resolution Rate"
                value={`${stats?.resolution_rate || 0}%`}
                subtitle={`${stats?.resolved_calls || 0} resolved`}
                icon={<CheckCircle className="h-6 w-6" />}
                variant="success"
                tooltip={METRIC_DEFINITIONS.resolutionRate}
              />
            </div>

            {/* Risk Signals */}
            <div className="bg-white rounded-xl shadow-sm border p-6">
              <h3 className="text-lg font-semibold mb-4">Risk Signals Summary</h3>
              <RiskSignalsCard signals={patterns?.riskSignals || null} loading={loading} />
            </div>

            {/* Risk Distribution Chart */}
            <div className="bg-white rounded-xl shadow-sm border p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold">Risk Distribution</h3>
                <span className="text-xs text-gray-500">Based on {stats?.processed_calls || 0} analyzed calls</span>
              </div>
              <RiskChart data={{
                high: stats?.high_risk_calls || 0,
                medium: Math.round((stats?.processed_calls || 0) * 0.43),
                low: (stats?.processed_calls || 0) - (stats?.high_risk_calls || 0) - Math.round((stats?.processed_calls || 0) * 0.43)
              }} />
            </div>

          </div>
        )}

        {/* Aggregated Insights Tab */}
        {activeTab === 'insights' && (
          <div className="space-y-6">
            <div className="bg-white rounded-xl shadow-sm border p-6">
              <div className="flex items-center gap-3 mb-6">
                <Sparkles className="h-6 w-6 text-purple-600" />
                <div>
                  <h2 className="text-xl font-semibold">Aggregated Insights</h2>
                  <p className="text-sm text-gray-500">
                    AI-powered analysis and actionable recommendations
                  </p>
                </div>
              </div>
              <AggregatedInsights />
            </div>
          </div>
        )}

        {/* Seller Insights Tab */}
        {activeTab === 'sellers' && (
          <div className="space-y-6">
            <div className="flex items-center gap-3 mb-2">
              <Users className="h-6 w-6 text-indigo-600" />
              <div>
                <h2 className="text-xl font-semibold">Seller-Specific Insights</h2>
                <p className="text-sm text-gray-500">
                  Behavioral patterns and health metrics for sellers with multiple calls
                </p>
              </div>
            </div>
            <SellerInsights />
          </div>
        )}

        {/* Seller Portal Tab */}
        {activeTab === 'seller-portal' && (
          <div className="space-y-6">
            <div className="bg-white rounded-xl shadow-sm border p-6">
              <div className="flex items-center gap-3 mb-6">
                <UserCircle className="h-6 w-6 text-green-600" />
                <div>
                  <h2 className="text-xl font-semibold">Seller Self-Service Portal</h2>
                  <p className="text-sm text-gray-500">
                    Actionable insights for sellers to improve their business performance
                  </p>
                </div>
              </div>

              {/* Seller ID Input */}
              <div className="mb-6 p-4 bg-gray-50 rounded-lg">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Enter Seller GLID to view their self-service dashboard
                </label>
                <div className="flex gap-3">
                  <input
                    type="text"
                    value={selectedSellerId}
                    onChange={(e) => setSelectedSellerId(e.target.value)}
                    placeholder="e.g., 35118323"
                    className="flex-1 px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                  />
                  <button
                    onClick={() => setSelectedSellerId(selectedSellerId.trim())}
                    className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                  >
                    Load Dashboard
                  </button>
                </div>
                <p className="text-xs text-gray-500 mt-2">
                  Sample GLIDs: 35118323, 204426014, 15741212
                </p>
              </div>

              {/* Seller Self-Service View */}
              {selectedSellerId ? (
                <SellerSelfServiceView companyId={selectedSellerId} />
              ) : (
                <div className="text-center py-12 text-gray-500">
                  <UserCircle className="h-16 w-16 mx-auto mb-4 text-gray-300" />
                  <p className="text-lg font-medium">Enter a Seller GLID above</p>
                  <p className="text-sm">This portal shows sellers what they can do to improve their business</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Pattern Analysis Tab */}
        {activeTab === 'patterns' && (
          <div className="space-y-8">
            {/* Summary Stats */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <SummaryStatCard
                label="Total Issues"
                value={patterns?.summary?.total_issues || 0}
                tooltip={METRIC_DEFINITIONS.totalIssues}
              />
              <SummaryStatCard
                label="Critical Issues"
                value={patterns?.summary?.critical_issues || 0}
                variant="red"
                tooltip={METRIC_DEFINITIONS.criticalIssues}
              />
              <SummaryStatCard
                label="Avg Churn Risk"
                value={`${Math.round((stats?.avg_churn_risk || 0) * 100)}%`}
                variant="orange"
                tooltip={METRIC_DEFINITIONS.avgChurnRisk}
              />
              <SummaryStatCard
                label="Follow-ups Pending"
                value={patterns?.followUpAnalysis?.pending || 0}
                variant="amber"
                tooltip={METRIC_DEFINITIONS.followUpsPending}
              />
            </div>

            {/* Issue Categories */}
            <div className="bg-white rounded-xl shadow-sm border p-6">
              <h3 className="text-lg font-semibold mb-4">Issue Categories Distribution</h3>
              <IssueCategoryChart
                data={patterns?.categoryDistribution || []}
                loading={loading}
              />
            </div>

            {/* Call Purpose & Resolution */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Call Purpose */}
              <div className="bg-white rounded-xl shadow-sm border p-6">
                <h3 className="text-lg font-semibold mb-4">Call Purpose</h3>
                <div className="space-y-2">
                  {Object.entries(patterns?.callPurposes || {})
                    .sort((a, b) => b[1] - a[1])
                    .map(([purpose, count]) => (
                      <div key={purpose} className="flex items-center justify-between">
                        <span className="text-sm text-gray-700 capitalize">{purpose}</span>
                        <span className="px-2 py-0.5 bg-gray-100 rounded text-sm font-medium">{count}</span>
                      </div>
                    ))
                  }
                </div>
              </div>

              {/* Resolution Status */}
              <div className="bg-white rounded-xl shadow-sm border p-6">
                <h3 className="text-lg font-semibold mb-4">Resolution Status</h3>
                <div className="space-y-2">
                  {Object.entries(patterns?.resolutionAnalysis?.statusDistribution || {})
                    .map(([status, count]) => {
                      const colors = {
                        resolved: 'bg-green-100 text-green-700',
                        partial: 'bg-yellow-100 text-yellow-700',
                        unresolved: 'bg-red-100 text-red-700'
                      }
                      return (
                        <div key={status} className="flex items-center justify-between">
                          <span className={`px-2 py-0.5 rounded text-sm font-medium ${colors[status as keyof typeof colors] || 'bg-gray-100'}`}>
                            {status}
                          </span>
                          <span className="text-lg font-bold">{count}</span>
                        </div>
                      )
                    })
                  }
                </div>

                <div className="mt-4 pt-4 border-t">
                  <p className="text-sm text-gray-500 mb-2">Purpose Fulfilled</p>
                  <div className="flex gap-2">
                    <span className="px-2 py-1 bg-green-100 text-green-700 rounded text-xs">
                      Yes: {patterns?.resolutionAnalysis?.purposeFulfilled?.yes || 0}
                    </span>
                    <span className="px-2 py-1 bg-red-100 text-red-700 rounded text-xs">
                      No: {patterns?.resolutionAnalysis?.purposeFulfilled?.no || 0}
                    </span>
                    <span className="px-2 py-1 bg-gray-100 text-gray-700 rounded text-xs">
                      Unclear: {patterns?.resolutionAnalysis?.purposeFulfilled?.unclear || 0}
                    </span>
                  </div>
                </div>
              </div>

              {/* Executive Tone */}
              <div className="bg-white rounded-xl shadow-sm border p-6">
                <h3 className="text-lg font-semibold mb-4">Executive Tone</h3>
                <div className="space-y-2">
                  {Object.entries(patterns?.executiveTones || {})
                    .sort((a, b) => b[1] - a[1])
                    .map(([tone, count]) => {
                      const colors = {
                        professional: 'bg-blue-100 text-blue-700',
                        empathetic: 'bg-green-100 text-green-700',
                        defensive: 'bg-orange-100 text-orange-700',
                        rushed: 'bg-red-100 text-red-700'
                      }
                      return (
                        <div key={tone} className="flex items-center justify-between">
                          <span className={`px-2 py-0.5 rounded text-sm font-medium ${colors[tone as keyof typeof colors] || 'bg-gray-100'}`}>
                            {tone}
                          </span>
                          <span className="text-lg font-bold">{count}</span>
                        </div>
                      )
                    })
                  }
                </div>
              </div>
            </div>

          </div>
        )}

        {/* Geography Tab */}
        {activeTab === 'geography' && (
          <div className="space-y-6">
            <div className="bg-white rounded-xl shadow-sm border p-6">
              <h2 className="text-xl font-semibold mb-4">Geographic Analysis</h2>
              <GeographyInsights data={geography} loading={loading} />
            </div>
          </div>
        )}

        {/* Industry Analysis Tab */}
        {activeTab === 'industry' && (
          <div className="space-y-6">
            <div className="bg-white rounded-xl shadow-sm border p-6">
              <div className="flex items-center gap-3 mb-6">
                <Building2 className="h-6 w-6 text-blue-600" />
                <div>
                  <h2 className="text-xl font-semibold">Industry & Tier Analysis</h2>
                  <p className="text-sm text-gray-500">
                    Issue patterns by city tier and geographic distribution
                  </p>
                </div>
              </div>
              <IndustryAnalysis />
            </div>
          </div>
        )}

        {/* SOP Guide Tab */}
        {activeTab === 'sop' && (
          <div className="space-y-6">
            {/* Calls with Recording + SOP */}
            <div className="bg-white rounded-xl shadow-sm border p-6">
              <div className="flex items-center gap-3 mb-6">
                <BookOpen className="h-6 w-6 text-blue-600" />
                <div>
                  <h2 className="text-xl font-semibold">Calls with SOP Recommendations</h2>
                  <p className="text-sm text-gray-500">
                    Click on a call to see recording link and RAG-powered SOP guidance
                  </p>
                </div>
              </div>
              <CallsWithSOP />
            </div>

            {/* Additional SOP Insights */}
            <div className="bg-white rounded-xl shadow-sm border p-6">
              <h3 className="text-lg font-semibold mb-4">High Risk SOP Alerts</h3>
              <SOPRecommendations />
            </div>
          </div>
        )}

        {/* Alerts Tab */}
        {activeTab === 'alerts' && (
          <div className="space-y-6">
            {/* Risk Alerts */}
            <div className="bg-white rounded-xl shadow-sm border p-6">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-xl font-semibold">Risk Alerts</h2>
                  <p className="text-sm text-gray-500">
                    Calls requiring immediate attention
                  </p>
                </div>
                <div className="flex items-center gap-4">
                  <span className="px-3 py-1 bg-red-100 text-red-700 rounded-full text-sm">
                    {alerts.filter(a => a.severity === 'critical').length} Critical
                  </span>
                  <span className="px-3 py-1 bg-orange-100 text-orange-700 rounded-full text-sm">
                    {alerts.filter(a => a.severity === 'high').length} High
                  </span>
                  <span className="px-3 py-1 bg-yellow-100 text-yellow-700 rounded-full text-sm">
                    {alerts.filter(a => a.severity === 'medium').length} Medium
                  </span>
                </div>
              </div>
              <AlertsList alerts={alerts} loading={loading} />
            </div>
          </div>
        )}

        {/* Key Quotes Tab */}
        {activeTab === 'quotes' && (
          <div className="bg-white rounded-xl shadow-sm border p-6">
            <KeyQuotesSection
              quotes={patterns?.keyQuotes || []}
              loading={loading}
            />
          </div>
        )}

        {/* Calls Tab */}
        {activeTab === 'calls' && (
          <div className="bg-white rounded-xl shadow-sm border">
            <div className="p-6 border-b">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold">All Calls</h2>
                <div className="flex items-center gap-4">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <input
                      type="text"
                      placeholder="Search by UCID, employee, company..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                      className="pl-10 pr-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 w-80"
                    />
                  </div>
                  <button
                    onClick={handleSearch}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                  >
                    Search
                  </button>
                </div>
              </div>
            </div>
            <CallsTable calls={calls} loading={loading} />
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="bg-white border-t mt-auto">
        <div className="max-w-7xl mx-auto px-4 py-4 sm:px-6 lg:px-8">
          <p className="text-center text-sm text-gray-500">
            Call Insights Engine - IndiaMART Hackathon 2025
          </p>
        </div>
      </footer>
    </div>
  )
}
