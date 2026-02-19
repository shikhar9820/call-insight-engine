'use client'

import { useState, useEffect } from 'react'
import {
  Building2,
  MapPin,
  TrendingUp,
  AlertTriangle,
  BarChart3,
  Globe,
  Layers,
  HelpCircle
} from 'lucide-react'
import { METRIC_DEFINITIONS } from './Tooltip'

interface TierData {
  tier: string
  totalCalls: number
  highRiskCalls: number
  deactivationIntents: number
  uniqueCities: number
  riskRate: number
  topIssues: { category: string; count: number }[]
}

interface CityData {
  city: string
  tier: string
  totalCalls: number
  highRiskCalls: number
  riskRate: number
  topIssues: { category: string; count: number }[]
}

interface IssuePattern {
  category: string
  totalOccurrences: number
  highRiskAssociation: number
  uniqueCities: number
  riskRate: number
}

interface IndustryData {
  industry: string
  totalCalls: number
  highRiskCalls: number
  deactivationIntents: number
  uniqueCities: number
  cityNames: string[]
  riskRate: number
  topIssues: { category: string; count: number }[]
  tierDistribution: Record<string, number>
}

interface AnalysisData {
  byTier: TierData[]
  byCity: CityData[]
  byIndustry: IndustryData[]
  issuePatterns: IssuePattern[]
  summary: {
    totalCalls: number
    totalCities: number
    totalIndustries: number
    mappedCalls: number
    unmappedCalls: number
    tier1Calls: number
    tier2Calls: number
    tier3Calls: number
  }
}

const categoryLabels: Record<string, string> = {
  buylead_relevance: 'BuyLead Relevance',
  buylead_availability: 'BuyLead Availability',
  buylead_roi: 'BuyLead ROI',
  buylead_accessibility: 'BuyLead Access',
  buylead_quality: 'BuyLead Quality',
  payment: 'Payment',
  subscription: 'Subscription',
  deactivation: 'Deactivation',
  technical: 'Technical',
  catalog: 'Catalog',
  employee: 'Employee',
  pns: 'PNS',
  enquiry: 'Enquiry',
  other: 'Other'
}

const tierColors: Record<string, string> = {
  'Tier 1': 'bg-blue-500',
  'Tier 2': 'bg-green-500',
  'Tier 3': 'bg-yellow-500',
  'Unknown': 'bg-gray-400'
}

// Inline tooltip component for summary cards
function InfoTooltip({ text }: { text: string }) {
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
          <div className="bg-gray-900 text-white text-xs rounded-lg py-2 px-3 shadow-lg w-48 whitespace-normal">
            {text}
            <div className="absolute top-full left-1/2 -translate-x-1/2 w-0 h-0 border-4 border-t-gray-900 border-l-transparent border-r-transparent border-b-transparent" />
          </div>
        </div>
      )}
    </div>
  )
}

export default function IndustryAnalysis() {
  const [data, setData] = useState<AnalysisData | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'industry' | 'tier' | 'city' | 'issues'>('industry')

  useEffect(() => {
    fetchAnalysis()
  }, [])

  const fetchAnalysis = async () => {
    try {
      const res = await fetch('/api/industry-analysis')
      const result = await res.json()
      setData(result)
    } catch (error) {
      console.error('Error fetching analysis:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="animate-pulse space-y-4">
        <div className="h-8 bg-gray-200 rounded w-1/4" />
        <div className="grid grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="h-24 bg-gray-200 rounded" />
          ))}
        </div>
        <div className="h-64 bg-gray-200 rounded" />
      </div>
    )
  }

  if (!data) {
    return <div className="text-center py-12 text-gray-500">Failed to load analysis</div>
  }

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
        <div className="bg-white p-4 rounded-lg border shadow-sm">
          <div className="flex items-center text-gray-500 text-sm mb-1">
            <BarChart3 className="h-4 w-4 mr-1" />
            Total Calls
            <InfoTooltip text={METRIC_DEFINITIONS.totalCalls} />
          </div>
          <div className="text-2xl font-bold">{data.summary.totalCalls}</div>
        </div>

        <div className="bg-purple-50 p-4 rounded-lg border border-purple-200">
          <div className="flex items-center text-purple-600 text-sm mb-1">
            <Building2 className="h-4 w-4 mr-1" />
            Industries
            <InfoTooltip text={METRIC_DEFINITIONS.industries} />
          </div>
          <div className="text-2xl font-bold text-purple-700">{data.summary.totalIndustries}</div>
          <div className="text-xs text-purple-500">{data.summary.mappedCalls} mapped</div>
        </div>

        <div className="bg-white p-4 rounded-lg border shadow-sm">
          <div className="flex items-center text-gray-500 text-sm mb-1">
            <Globe className="h-4 w-4 mr-1" />
            Cities
          </div>
          <div className="text-2xl font-bold">{data.summary.totalCities}</div>
        </div>

        <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
          <div className="flex items-center text-blue-600 text-sm mb-1">
            Tier 1 (Metro)
            <InfoTooltip text={METRIC_DEFINITIONS.tier1} />
          </div>
          <div className="text-2xl font-bold text-blue-700">{data.summary.tier1Calls}</div>
        </div>

        <div className="bg-green-50 p-4 rounded-lg border border-green-200">
          <div className="flex items-center text-green-600 text-sm mb-1">
            Tier 2
            <InfoTooltip text={METRIC_DEFINITIONS.tier2} />
          </div>
          <div className="text-2xl font-bold text-green-700">{data.summary.tier2Calls}</div>
        </div>

        <div className="bg-yellow-50 p-4 rounded-lg border border-yellow-200">
          <div className="flex items-center text-yellow-600 text-sm mb-1">
            Tier 3 (Small)
            <InfoTooltip text={METRIC_DEFINITIONS.tier3} />
          </div>
          <div className="text-2xl font-bold text-yellow-700">{data.summary.tier3Calls}</div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="flex gap-2 border-b">
        <button
          onClick={() => setActiveTab('industry')}
          className={`px-4 py-2 font-medium text-sm border-b-2 transition-colors ${
            activeTab === 'industry'
              ? 'border-purple-500 text-purple-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          <Building2 className="inline h-4 w-4 mr-1" />
          By Industry/MCAT
        </button>
        <button
          onClick={() => setActiveTab('tier')}
          className={`px-4 py-2 font-medium text-sm border-b-2 transition-colors ${
            activeTab === 'tier'
              ? 'border-blue-500 text-blue-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          <Layers className="inline h-4 w-4 mr-1" />
          By City Tier
        </button>
        <button
          onClick={() => setActiveTab('city')}
          className={`px-4 py-2 font-medium text-sm border-b-2 transition-colors ${
            activeTab === 'city'
              ? 'border-blue-500 text-blue-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          <MapPin className="inline h-4 w-4 mr-1" />
          Top Cities
        </button>
        <button
          onClick={() => setActiveTab('issues')}
          className={`px-4 py-2 font-medium text-sm border-b-2 transition-colors ${
            activeTab === 'issues'
              ? 'border-blue-500 text-blue-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          <AlertTriangle className="inline h-4 w-4 mr-1" />
          Issue Patterns
        </button>
      </div>

      {/* Tab Content */}
      {activeTab === 'industry' && (
        <div className="bg-white rounded-lg border shadow-sm overflow-hidden">
          <table className="w-full">
            <thead className="bg-purple-50 border-b">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-medium text-purple-700">Industry/MCAT</th>
                <th className="px-4 py-3 text-right text-sm font-medium text-purple-700">Calls</th>
                <th className="px-4 py-3 text-right text-sm font-medium text-purple-700">High Risk</th>
                <th className="px-4 py-3 text-right text-sm font-medium text-purple-700">Risk %</th>
                <th className="px-4 py-3 text-right text-sm font-medium text-purple-700">Deact</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-purple-700">Top Issues</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-purple-700">Tier Split</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {data.byIndustry?.map((ind, idx) => (
                <tr key={idx} className={`hover:bg-gray-50 ${ind.riskRate >= 50 ? 'bg-red-50' : ''}`}>
                  <td className="px-4 py-3">
                    <span className="font-medium">{ind.industry}</span>
                    <span className="relative group ml-2">
                      <span className="text-xs text-blue-600 cursor-pointer border-b border-dotted border-blue-400 hover:text-blue-800">
                        ({ind.uniqueCities} {ind.uniqueCities === 1 ? 'city' : 'cities'})
                      </span>
                      <div className="absolute left-0 bottom-full mb-2 hidden group-hover:block z-50">
                        <div className="bg-gray-900 text-white text-xs rounded-lg py-2 px-3 shadow-lg max-w-xs">
                          <div className="font-semibold mb-1 text-blue-300">Cities:</div>
                          <div className="text-gray-200">
                            {ind.cityNames?.join(', ')}
                            {ind.uniqueCities > 10 && (
                              <span className="text-gray-400"> +{ind.uniqueCities - 10} more</span>
                            )}
                          </div>
                          <div className="absolute left-4 top-full w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-900"></div>
                        </div>
                      </div>
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right font-semibold">{ind.totalCalls}</td>
                  <td className="px-4 py-3 text-right text-red-600">{ind.highRiskCalls}</td>
                  <td className="px-4 py-3 text-right">
                    <span className={`px-2 py-1 rounded text-xs ${
                      ind.riskRate >= 50 ? 'bg-red-100 text-red-700' :
                      ind.riskRate >= 30 ? 'bg-orange-100 text-orange-700' :
                      'bg-green-100 text-green-700'
                    }`}>
                      {ind.riskRate}%
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right text-orange-600">{ind.deactivationIntents}</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1 flex-wrap">
                      {ind.topIssues?.map((issue, i) => (
                        <span key={i} className="text-xs bg-gray-100 px-1.5 py-0.5 rounded">
                          {categoryLabels[issue.category] || issue.category}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1">
                      {ind.tierDistribution?.['Tier 1'] && (
                        <span className="text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded">
                          T1:{ind.tierDistribution['Tier 1']}
                        </span>
                      )}
                      {ind.tierDistribution?.['Tier 2'] && (
                        <span className="text-xs bg-green-100 text-green-700 px-1.5 py-0.5 rounded">
                          T2:{ind.tierDistribution['Tier 2']}
                        </span>
                      )}
                      {ind.tierDistribution?.['Tier 3'] && (
                        <span className="text-xs bg-yellow-100 text-yellow-700 px-1.5 py-0.5 rounded">
                          T3:{ind.tierDistribution['Tier 3']}
                        </span>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {(!data.byIndustry || data.byIndustry.length === 0) && (
            <div className="p-8 text-center text-gray-500">
              No industry data available. MCAT mapping may not be loaded.
            </div>
          )}
        </div>
      )}

      {activeTab === 'tier' && (
        <div className="grid gap-4">
          {data.byTier.map(tier => (
            <div key={tier.tier} className="bg-white rounded-lg border shadow-sm overflow-hidden">
              <div className="p-4 border-b bg-gray-50 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className={`w-3 h-3 rounded-full ${tierColors[tier.tier]}`} />
                  <h3 className="font-semibold text-lg">{tier.tier}</h3>
                  <span className="text-sm text-gray-500">({tier.uniqueCities} cities)</span>
                </div>
                <div className="flex gap-4 text-sm">
                  <span className="px-3 py-1 bg-gray-100 rounded">
                    {tier.totalCalls} calls
                  </span>
                  <span className={`px-3 py-1 rounded ${
                    tier.riskRate >= 30 ? 'bg-red-100 text-red-700' :
                    tier.riskRate >= 20 ? 'bg-orange-100 text-orange-700' :
                    'bg-green-100 text-green-700'
                  }`}>
                    {tier.riskRate}% risk
                  </span>
                </div>
              </div>
              <div className="p-4">
                <div className="grid grid-cols-3 gap-4 mb-4">
                  <div>
                    <div className="text-sm text-gray-500">High Risk Calls</div>
                    <div className="text-xl font-semibold text-red-600">{tier.highRiskCalls}</div>
                  </div>
                  <div>
                    <div className="text-sm text-gray-500">Deactivation Intent</div>
                    <div className="text-xl font-semibold text-orange-600">{tier.deactivationIntents}</div>
                  </div>
                  <div>
                    <div className="text-sm text-gray-500">Risk Rate</div>
                    <div className="text-xl font-semibold">{tier.riskRate}%</div>
                  </div>
                </div>
                {tier.topIssues.length > 0 && (
                  <div>
                    <div className="text-sm text-gray-500 mb-2">Top Issues:</div>
                    <div className="flex flex-wrap gap-2">
                      {tier.topIssues.map((issue, idx) => (
                        <span
                          key={idx}
                          className="px-2 py-1 bg-gray-100 rounded text-sm flex items-center gap-1"
                        >
                          {categoryLabels[issue.category] || issue.category}
                          <span className="text-xs bg-gray-200 px-1.5 py-0.5 rounded-full">
                            {issue.count}
                          </span>
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {activeTab === 'city' && (
        <div className="bg-white rounded-lg border shadow-sm overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">City</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">Tier</th>
                <th className="px-4 py-3 text-right text-sm font-medium text-gray-500">Calls</th>
                <th className="px-4 py-3 text-right text-sm font-medium text-gray-500">High Risk</th>
                <th className="px-4 py-3 text-right text-sm font-medium text-gray-500">Risk %</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">Top Issues</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {data.byCity.map((city, idx) => (
                <tr key={idx} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium">{city.city}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-1 rounded text-xs text-white ${tierColors[city.tier]}`}>
                      {city.tier}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">{city.totalCalls}</td>
                  <td className="px-4 py-3 text-right text-red-600">{city.highRiskCalls}</td>
                  <td className="px-4 py-3 text-right">
                    <span className={`px-2 py-1 rounded text-xs ${
                      city.riskRate >= 50 ? 'bg-red-100 text-red-700' :
                      city.riskRate >= 30 ? 'bg-orange-100 text-orange-700' :
                      'bg-green-100 text-green-700'
                    }`}>
                      {city.riskRate}%
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1 flex-wrap">
                      {city.topIssues.map((issue, i) => (
                        <span key={i} className="text-xs bg-gray-100 px-1.5 py-0.5 rounded">
                          {categoryLabels[issue.category] || issue.category}
                        </span>
                      ))}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {activeTab === 'issues' && (
        <div className="grid gap-4 md:grid-cols-2">
          {data.issuePatterns.map((pattern, idx) => (
            <div
              key={idx}
              className={`p-4 rounded-lg border ${
                pattern.riskRate >= 40 ? 'border-red-200 bg-red-50' :
                pattern.riskRate >= 25 ? 'border-orange-200 bg-orange-50' :
                'border-gray-200 bg-white'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <h4 className="font-semibold">
                  {categoryLabels[pattern.category] || pattern.category}
                </h4>
                <span className={`px-2 py-1 rounded text-xs ${
                  pattern.riskRate >= 40 ? 'bg-red-200 text-red-800' :
                  pattern.riskRate >= 25 ? 'bg-orange-200 text-orange-800' :
                  'bg-gray-200 text-gray-700'
                }`}>
                  {pattern.riskRate}% risk association
                </span>
              </div>
              <div className="grid grid-cols-3 gap-4 text-sm">
                <div>
                  <div className="text-gray-500">Occurrences</div>
                  <div className="font-semibold">{pattern.totalOccurrences}</div>
                </div>
                <div>
                  <div className="text-gray-500">High Risk</div>
                  <div className="font-semibold text-red-600">{pattern.highRiskAssociation}</div>
                </div>
                <div>
                  <div className="text-gray-500">Cities</div>
                  <div className="font-semibold">{pattern.uniqueCities}</div>
                </div>
              </div>
              {/* Progress bar for risk */}
              <div className="mt-3">
                <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                  <div
                    className={`h-full ${
                      pattern.riskRate >= 40 ? 'bg-red-500' :
                      pattern.riskRate >= 25 ? 'bg-orange-500' :
                      'bg-green-500'
                    }`}
                    style={{ width: `${Math.min(pattern.riskRate, 100)}%` }}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
