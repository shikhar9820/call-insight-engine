'use client'

import { useEffect, useState } from 'react'
import {
  Search,
  Filter,
  Users,
  AlertTriangle,
  Trophy,
  Heart,
  TrendingDown,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  SlidersHorizontal
} from 'lucide-react'
import SellerCard from './SellerCard'
import SellerDetailModal from './SellerDetailModal'

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

interface Summary {
  total_sellers: number
  at_risk_sellers: number
  champion_sellers: number
  avg_health_score: number
  sellers_with_sticky_issues: number
}

interface Pagination {
  page: number
  limit: number
  total: number
  totalPages: number
}

export default function SellerInsights() {
  const [sellers, setSellers] = useState<SellerMetrics[]>([])
  const [summary, setSummary] = useState<Summary | null>(null)
  const [pagination, setPagination] = useState<Pagination>({
    page: 1,
    limit: 12,
    total: 0,
    totalPages: 0
  })
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [riskFilter, setRiskFilter] = useState<string>('')
  const [sortBy, setSortBy] = useState('health_score')
  const [sortOrder, setSortOrder] = useState('asc')
  const [minCalls, setMinCalls] = useState(1)
  const [selectedSeller, setSelectedSeller] = useState<string | null>(null)
  const [showFilters, setShowFilters] = useState(false)

  useEffect(() => {
    fetchSellers()
  }, [pagination.page, riskFilter, sortBy, sortOrder, minCalls])

  const fetchSellers = async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams({
        page: pagination.page.toString(),
        limit: pagination.limit.toString(),
        sortBy,
        sortOrder,
        minCalls: minCalls.toString()
      })

      if (searchQuery) params.set('search', searchQuery)
      if (riskFilter) params.set('risk', riskFilter)

      const res = await fetch(`/api/seller-insights?${params}`)
      const data = await res.json()

      setSellers(data.sellers || [])
      setSummary(data.summary || null)
      setPagination(prev => ({
        ...prev,
        total: data.pagination?.total || 0,
        totalPages: data.pagination?.totalPages || 0
      }))
    } catch (error) {
      console.error('Error fetching sellers:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSearch = () => {
    setPagination(prev => ({ ...prev, page: 1 }))
    fetchSellers()
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch()
    }
  }

  const clearFilters = () => {
    setSearchQuery('')
    setRiskFilter('')
    setSortBy('health_score')
    setSortOrder('asc')
    setMinCalls(1)
    setPagination(prev => ({ ...prev, page: 1 }))
  }

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-lg border p-4">
            <div className="flex items-center gap-2 text-gray-600 mb-1">
              <Users className="h-4 w-4" />
              <span className="text-sm">Total Sellers</span>
            </div>
            <p className="text-2xl font-bold">{summary.total_sellers}</p>
            <p className="text-xs text-gray-500">with calls</p>
          </div>

          <div className="bg-white rounded-lg border p-4">
            <div className="flex items-center gap-2 text-red-600 mb-1">
              <AlertTriangle className="h-4 w-4" />
              <span className="text-sm">At-Risk</span>
            </div>
            <p className="text-2xl font-bold text-red-600">{summary.at_risk_sellers}</p>
            <p className="text-xs text-gray-500">declining + low health</p>
          </div>

          {/* Champions card hidden
          <div className="bg-white rounded-lg border p-4">
            <div className="flex items-center gap-2 text-green-600 mb-1">
              <Trophy className="h-4 w-4" />
              <span className="text-sm">Champions</span>
            </div>
            <p className="text-2xl font-bold text-green-600">{summary.champion_sellers}</p>
            <p className="text-xs text-gray-500">improving + high health</p>
          </div>
          */}

          <div className="bg-white rounded-lg border p-4">
            <div className="flex items-center gap-2 text-blue-600 mb-1">
              <Heart className="h-4 w-4" />
              <span className="text-sm">Avg Health</span>
            </div>
            <p className="text-2xl font-bold text-blue-600">{summary.avg_health_score}</p>
            <p className="text-xs text-gray-500">across all sellers</p>
          </div>

          <div className="bg-white rounded-lg border p-4">
            <div className="flex items-center gap-2 text-orange-600 mb-1">
              <TrendingDown className="h-4 w-4" />
              <span className="text-sm">Sticky Issues</span>
            </div>
            <p className="text-2xl font-bold text-orange-600">{summary.sellers_with_sticky_issues}</p>
            <p className="text-xs text-gray-500">recurring problems</p>
          </div>
        </div>
      )}

      {/* Search and Filters */}
      <div className="bg-white rounded-lg border p-4">
        <div className="flex flex-col md:flex-row gap-4">
          {/* Search */}
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search by Company ID or Name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyPress={handleKeyPress}
              className="w-full pl-10 pr-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Quick Filters */}
          <div className="flex flex-wrap gap-2">
            <select
              value={riskFilter}
              onChange={(e) => {
                setRiskFilter(e.target.value)
                setPagination(prev => ({ ...prev, page: 1 }))
              }}
              className="px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Sellers</option>
              <option value="high">High Risk</option>
              <option value="medium">Medium Risk</option>
              <option value="low">Low Risk</option>
              <option value="at-risk">At-Risk (Declining)</option>
              {/* <option value="champion">Champions</option> */}
            </select>

            <select
              value={`${sortBy}-${sortOrder}`}
              onChange={(e) => {
                const [field, order] = e.target.value.split('-')
                setSortBy(field)
                setSortOrder(order)
                setPagination(prev => ({ ...prev, page: 1 }))
              }}
              className="px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="health_score-asc">Health Score (Low to High)</option>
              <option value="health_score-desc">Health Score (High to Low)</option>
              <option value="avg_churn_risk-desc">Churn Risk (High to Low)</option>
              <option value="avg_churn_risk-asc">Churn Risk (Low to High)</option>
              <option value="total_calls-desc">Most Calls</option>
              <option value="days_since_last_call-desc">Least Recent</option>
              <option value="days_since_last_call-asc">Most Recent</option>
            </select>

            <button
              onClick={() => {
                setMinCalls(minCalls === 1 ? 2 : 1)
                setPagination(prev => ({ ...prev, page: 1 }))
              }}
              className={`px-3 py-2 border rounded-lg flex items-center gap-2 ${
                minCalls >= 2 ? 'bg-blue-100 border-blue-400 text-blue-700' : 'hover:bg-gray-50'
              }`}
              title={minCalls >= 2 ? 'Showing sellers with 2+ calls' : 'Click to filter 2+ calls only'}
            >
              2+ Calls
            </button>

            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`px-3 py-2 border rounded-lg flex items-center gap-2 ${
                showFilters ? 'bg-blue-50 border-blue-300' : ''
              }`}
            >
              <SlidersHorizontal className="h-4 w-4" />
              More
            </button>

            <button
              onClick={handleSearch}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Search
            </button>

            <button
              onClick={fetchSellers}
              className="px-3 py-2 border rounded-lg hover:bg-gray-50"
              title="Refresh"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Advanced Filters */}
        {showFilters && (
          <div className="mt-4 pt-4 border-t flex flex-wrap gap-4 items-center">
            <div className="flex items-center gap-2">
              <label className="text-sm text-gray-600">Min Calls:</label>
              <input
                type="number"
                min={1}
                max={100}
                value={minCalls}
                onChange={(e) => {
                  setMinCalls(parseInt(e.target.value) || 1)
                  setPagination(prev => ({ ...prev, page: 1 }))
                }}
                className="w-20 px-2 py-1 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <button
              onClick={clearFilters}
              className="text-sm text-blue-600 hover:text-blue-700"
            >
              Clear All Filters
            </button>
          </div>
        )}
      </div>

      {/* Results Info */}
      <div className="flex items-center justify-between text-sm text-gray-600">
        <span>
          Showing {sellers.length} of {pagination.total} sellers
          {riskFilter && ` (filtered by: ${riskFilter})`}
        </span>
        {pagination.totalPages > 1 && (
          <span>
            Page {pagination.page} of {pagination.totalPages}
          </span>
        )}
      </div>

      {/* Seller Cards Grid */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
        </div>
      ) : sellers.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p className="text-lg">No sellers found</p>
          <p className="text-sm">Try adjusting your search or filters</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {sellers.map((seller) => (
            <SellerCard
              key={seller.company_id}
              seller={seller}
              onClick={() => setSelectedSeller(seller.company_id)}
            />
          ))}
        </div>
      )}

      {/* Pagination */}
      {pagination.totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <button
            onClick={() => setPagination(prev => ({ ...prev, page: prev.page - 1 }))}
            disabled={pagination.page === 1}
            className="p-2 border rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>

          <div className="flex gap-1">
            {Array.from({ length: Math.min(5, pagination.totalPages) }, (_, i) => {
              let pageNum: number
              if (pagination.totalPages <= 5) {
                pageNum = i + 1
              } else if (pagination.page <= 3) {
                pageNum = i + 1
              } else if (pagination.page >= pagination.totalPages - 2) {
                pageNum = pagination.totalPages - 4 + i
              } else {
                pageNum = pagination.page - 2 + i
              }

              return (
                <button
                  key={pageNum}
                  onClick={() => setPagination(prev => ({ ...prev, page: pageNum }))}
                  className={`px-3 py-1 rounded-lg ${
                    pagination.page === pageNum
                      ? 'bg-blue-600 text-white'
                      : 'border hover:bg-gray-50'
                  }`}
                >
                  {pageNum}
                </button>
              )
            })}
          </div>

          <button
            onClick={() => setPagination(prev => ({ ...prev, page: prev.page + 1 }))}
            disabled={pagination.page === pagination.totalPages}
            className="p-2 border rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Seller Detail Modal */}
      {selectedSeller && (
        <SellerDetailModal
          companyId={selectedSeller}
          onClose={() => setSelectedSeller(null)}
        />
      )}
    </div>
  )
}
