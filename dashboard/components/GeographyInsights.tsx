'use client'

import { MapPin, AlertTriangle, Phone, TrendingUp } from 'lucide-react'

interface CityData {
  city: string
  calls: number
  issues?: number
  criticalIssues?: number
  avgChurnRisk: number
  deactivationIntents?: number
  topCategory?: string
}

interface GeographyData {
  summary: {
    totalCities: number
    totalCallsWithCity: number
    avgChurnRiskOverall: number
  }
  topCitiesByCalls: CityData[]
  topCitiesByChurn: CityData[]
  topCitiesByIssues: Array<{
    city: string
    issues: number
    criticalIssues: number
    topCategory: string
  }>
  problemCities: CityData[]
}

interface GeographyInsightsProps {
  data: GeographyData | null
  loading?: boolean
}

export default function GeographyInsights({ data, loading }: GeographyInsightsProps) {
  if (loading) {
    return (
      <div className="animate-pulse space-y-4">
        <div className="h-8 bg-gray-200 rounded w-1/3" />
        <div className="grid grid-cols-3 gap-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-32 bg-gray-200 rounded" />
          ))}
        </div>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="text-center py-8 text-gray-500">
        <MapPin className="mx-auto h-12 w-12 text-gray-300" />
        <p className="mt-2">No geographic data available</p>
      </div>
    )
  }

  const getRiskColor = (risk: number) => {
    if (risk >= 70) return 'text-red-600 bg-red-100'
    if (risk >= 50) return 'text-orange-600 bg-orange-100'
    if (risk >= 30) return 'text-yellow-600 bg-yellow-100'
    return 'text-green-600 bg-green-100'
  }

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-gradient-to-r from-blue-50 to-blue-100 rounded-lg p-4 border border-blue-200">
          <div className="flex items-center gap-2 text-blue-600 mb-1">
            <MapPin className="h-5 w-5" />
            <span className="text-sm font-medium">Cities Covered</span>
          </div>
          <p className="text-3xl font-bold text-blue-700">{data.summary.totalCities}</p>
          <p className="text-sm text-blue-600">{data.summary.totalCallsWithCity} calls analyzed</p>
        </div>

        <div className="bg-gradient-to-r from-orange-50 to-orange-100 rounded-lg p-4 border border-orange-200">
          <div className="flex items-center gap-2 text-orange-600 mb-1">
            <TrendingUp className="h-5 w-5" />
            <span className="text-sm font-medium">Avg Churn Risk</span>
          </div>
          <p className="text-3xl font-bold text-orange-700">{data.summary.avgChurnRiskOverall}%</p>
          <p className="text-sm text-orange-600">Across all cities</p>
        </div>

        <div className="bg-gradient-to-r from-red-50 to-red-100 rounded-lg p-4 border border-red-200">
          <div className="flex items-center gap-2 text-red-600 mb-1">
            <AlertTriangle className="h-5 w-5" />
            <span className="text-sm font-medium">Problem Cities</span>
          </div>
          <p className="text-3xl font-bold text-red-700">{data.problemCities.length}</p>
          <p className="text-sm text-red-600">High risk + critical issues</p>
        </div>
      </div>


      {/* Top Cities by Volume */}
      <div className="bg-white rounded-lg border p-4">
        <h4 className="font-semibold text-gray-700 mb-3 flex items-center gap-2">
          <Phone className="h-4 w-4" />
          Top Cities by Call Volume
        </h4>
        <div className="space-y-2">
          {data.topCitiesByCalls.slice(0, 10).map((city, index) => (
            <div key={city.city} className="flex items-center justify-between py-2 border-b last:border-0">
              <div className="flex items-center gap-3">
                <span className="text-xs font-bold text-gray-400 w-4">{index + 1}</span>
                <span className="font-medium text-gray-900">{city.city}</span>
              </div>
              <div className="flex items-center gap-4">
                <span className="text-sm text-gray-600">{city.calls} calls</span>
                <span className={`px-2 py-0.5 rounded text-xs font-medium ${getRiskColor(city.avgChurnRisk)}`}>
                  {city.avgChurnRisk}%
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Top Cities by Issues */}
      <div className="bg-white rounded-lg border p-4">
        <h4 className="font-semibold text-gray-700 mb-3 flex items-center gap-2">
          <AlertTriangle className="h-4 w-4" />
          Cities with Most Issues
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {data.topCitiesByIssues.slice(0, 9).map((city, index) => (
            <div key={city.city} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-gray-400">#{index + 1}</span>
                  <span className="font-medium text-gray-900">{city.city}</span>
                </div>
                <span className="text-xs text-gray-500">Top issue: {city.topCategory}</span>
              </div>
              <div className="text-right">
                <p className="font-bold text-gray-900">{city.issues}</p>
                <p className="text-xs text-red-600">{city.criticalIssues} critical</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
