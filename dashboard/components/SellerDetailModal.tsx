'use client'

import { useEffect, useState } from 'react'
import {
  X,
  TrendingUp,
  TrendingDown,
  Minus,
  Phone,
  AlertTriangle,
  CheckCircle,
  Clock,
  Calendar,
  Target,
  MessageSquare,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Lightbulb,
  User,
  Award,
  BarChart3,
  ShoppingBag,
  Repeat,
  Volume2,
  Info,
  BookOpen
} from 'lucide-react'

// Definitions for all metrics (shown on hover)
const METRIC_DEFINITIONS: Record<string, string> = {
  // Health Metrics
  health_score: "Overall seller health (0-100). Calculated from: Sentiment trend (±25), Resolution rate (0-25), Churn risk (-0 to -25), and Sticky issues (-5 each, max -20). Higher is better.",
  resolution_rate: "Percentage of calls where the issue was fully resolved. Calculated as: (Resolved calls ÷ Total calls) × 100",
  churn_risk: "AI-predicted probability (0-100%) that the seller will leave IndiaMART. Based on call sentiment, complaints, competitor mentions, and deactivation signals.",
  sentiment_trend: "How seller sentiment is changing over time. Compares average sentiment of first half of calls vs second half. Values: Improving, Stable, or Declining.",

  // Recommendations
  recommendations: "AI-generated action items based on seller's health score, behavioral data, sticky issues, and risk signals. Prioritized by urgency.",

  // Charts
  sentiment_risk_trend: "Timeline showing sentiment score (-2 to +1) and churn risk (0-100%) across all calls. Helps identify patterns and turning points.",
  issue_distribution: "Frequency of issue categories across all calls. Shows which problems are most common for this seller.",

  // Communication Profile
  communication_profile: "Seller's communication patterns across all calls with CSD team.",
  avg_duration: "Average length of calls in minutes. Longer calls may indicate complex issues.",
  language: "Primary language used by seller in calls.",
  tone_consistency: "How consistent the executive's tone was across calls. Values: Consistent, Variable, or Inconsistent.",
  responsiveness: "Seller's pattern of engaging with CSD. Based on call frequency and follow-up behavior.",

  // Risk Assessment
  risk_assessment: "Signals that indicate potential churn or escalation risk.",
  risk_level: "Overall risk classification based on churn probability and health score. HIGH: churn ≥70% or health <30. MEDIUM: churn ≥40% or health <60. LOW: otherwise.",
  escalations: "Number of times seller threatened to escalate to higher authority or social media.",
  deactivation_mentions: "Number of calls where seller mentioned wanting to deactivate their account.",
  payment_disputes: "Number of calls involving payment-related complaints or refund requests.",

  // Engagement
  engagement: "Seller's interaction frequency with CSD team.",
  last_contact: "Days since the most recent call with this seller.",
  calls_per_month: "Average number of calls per month over the relationship period.",
  frequency_trend: "Whether call frequency is increasing, stable, or decreasing over time.",

  // Behavioral Profile
  behavioral_profile: "Data from seller's IndiaMART account and activity patterns.",
  vintage: "How long the seller has been on IndiaMART platform (in months).",
  service_tier: "Seller's subscription level (e.g., TrustSEAL, Star Supplier, Free).",
  pns_health: "PNS (Preferred Number Service) response rate. Measures how often seller answers buyer calls on their preferred number. Good: ≥70%, Moderate: 40-70%, Poor: <40%.",
  lead_engagement: "Fresh lead consumption (0-4 hrs). Active: ≥10 leads, Moderate: 3-10, Inactive: <3. Higher engagement = better ROI.",
  location_preference: "Seller's preferred lead geography (Local, Regional, National, International).",

  // Monthly Metrics
  monthly_metrics: "Month-over-month behavioral data from seller's account.",
  cqs_score: "Catalog Quality Score (0-100). Measures completeness of product listings. Target: >80%.",
  pns_defaulter: "Number of Preferred Number Service calls not answered by seller. High count indicates poor responsiveness and lower ROI.",
  fresh_leads: "Leads consumed within 0-4 hours. Higher = more active seller.",
  wrong_product: "BuyLeads marked as wrong product by seller. High count indicates category mapping issues.",
  ba_rank: "Categories with only 1 transaction in 6 months. High rank = poor visibility.",
  cc_rank: "Categories with no consumption. High rank = poor visibility.",

  // Issue Analysis
  sticky_issues: "Issues appearing in 3+ calls. These are persistent problems that need special attention.",
  recurring_issues: "Issues appearing in 2+ calls. Grouped by category with first/last seen dates.",

  // Call Timeline
  call_timeline: "Chronological list of all calls with this seller, including sentiment, issues, and outcomes."
}

// SOP guidance mapping for sticky issues
const SOP_GUIDANCE: Record<string, string> = {
  'buylead_relevance': `**BuyLead Relevance SOP:**
1. Check if categories are mapped correctly in Seller Panel
2. Review "Recommended Products" section
3. Ensure Catalog Quality Score (CQS) > 80%
4. Verify product descriptions, photos, and prices are complete
5. If still irrelevant, escalate to category mapping team`,
  'buylead_availability': `**BuyLead Availability SOP:**
1. Check total approved BuyLeads in seller's categories
2. If < 10 leads available, explain low demand in category
3. Suggest adding more product categories
4. Guide seller to "Recommended Products" to expand catalog
5. Ask seller to check again next day after changes`,
  'buylead_roi': `**BuyLead ROI SOP:**
1. Review seller's consumption pattern and conversion rate
2. Check if seller is using filters effectively
3. Verify seller is contacting leads promptly (within 1 hour)
4. Suggest GST-verified and membership leads for better quality
5. If persistent, discuss plan upgrade or category optimization`,
  'payment': `**Payment Issue SOP:**
1. Verify payment status in backend system
2. Check for any pending refund requests
3. If double charge, initiate refund ticket immediately
4. For EMI issues, connect with finance team
5. Document all payment disputes with transaction IDs`,
  'subscription': `**Subscription SOP:**
1. Explain current plan benefits clearly
2. For upgrade requests, show comparison of plans
3. For downgrade, check if any pending dues
4. For renewal issues, verify auto-renewal settings
5. For cancellation, follow Deactivation SOP`,
  'deactivation': `**Deactivation SOP (CRITICAL):**
1. FIRST: Understand the root cause of deactivation request
2. Offer resolution for underlying issues
3. If service-related: Offer complimentary extension (max 1-2 months)
4. If BuyLead concern: Offer free leads (min 25, max 50)
5. If still wants to deactivate: Process as per policy
6. Document reason in ticket for retention analysis`,
  'technical': `**Technical Issues SOP:**
1. Ask seller to log out and log in again
2. Try alternate browser (Chrome/Firefox)
3. On mobile: Reinstall or update the app
4. Clear cache and cookies
5. If persists: Raise technical support ticket`,
  'catalog': `**Catalog Issues SOP:**
1. Check product visibility in search
2. Verify catalog quality score (target > 80%)
3. Ensure all required fields are filled
4. Check if products are in correct categories
5. For visibility issues, raise mapping ticket`,
  'employee': `**Employee Complaint SOP:**
1. Apologize for any inconvenience caused
2. Document the specific complaint
3. Assure customer of internal review
4. Do NOT promise disciplinary action
5. Escalate to team lead if serious`,
  'pns': `**PNS (Preferred Number Service) SOP:**
1. Check PNS response rate in seller profile
2. Review missed call patterns
3. Ensure seller has app notifications enabled
4. Suggest setting business hours properly
5. If persistent defaulter, warn about service impact`,
  'enquiry': `**Enquiry SOP:**
1. Verify enquiry visibility in seller panel
2. Check spam/junk folder settings
3. Ensure email notifications are enabled
4. Review enquiry quality and relevance
5. Guide on quick response best practices`,
  'other': `**General Escalation SOP:**
1. Listen to the complete concern
2. Document all details accurately
3. Check if issue falls under any specific category
4. If unclear, escalate to team lead
5. Set clear expectations on resolution timeline`
}

const CATEGORY_LABELS: Record<string, string> = {
  buylead_relevance: 'BuyLead Relevance',
  buylead_availability: 'BuyLead Availability',
  buylead_roi: 'BuyLead ROI',
  buylead_accessibility: 'BuyLead Access',
  payment: 'Payment',
  subscription: 'Subscription',
  deactivation: 'Deactivation',
  technical: 'Technical',
  catalog: 'Catalog',
  employee: 'Employee',
  pns: 'Preferred Number Service',
  enquiry: 'Enquiry',
  other: 'Other'
}

// InfoTooltip component for hover definitions
function InfoTooltip({ term, className = "" }: { term: string; className?: string }) {
  const definition = METRIC_DEFINITIONS[term]
  if (!definition) return null

  return (
    <span className={`inline-flex items-center cursor-help ${className}`} title={definition}>
      <Info className="h-3.5 w-3.5 text-gray-400 hover:text-gray-600 ml-1" />
    </span>
  )
}
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  Cell
} from 'recharts'

interface CallTimelineEntry {
  call_id: string
  ucid: string
  date: string
  duration_seconds: number
  employee_name: string
  sentiment_start: string
  sentiment_end: string
  sentiment_trajectory: string
  churn_risk_score: number
  resolution_status: string
  call_purpose: string
  issues: Array<{
    category: string
    subcategory: string
    description: string
    severity: string
  }>
  risk_signals: string[]
  topics: string[]
  key_quotes: any
  executive_tone: string
  recording_url: string | null
}

interface BehavioralProfile {
  vintage_months: number | null
  highest_service: string | null
  bl_active_days: number | null
  pns_calls_received: number | null
  pns_calls_answered: number | null
  pns_response_rate: number | null
  location_preference: string | null
  category_rank: number | null
  category_count: number | null
  repeat_30d: string | null
  repeat_60d: string | null
}

interface MonthlyMetrics {
  data_month: string
  pns_defaulter_count: number
  fresh_lead_consumption: number
  wrong_product_count: number
  cqs_score: number | null
  ba_rank: number | null
  cc_rank: number | null
  negative_cities_count: number
  pref_city: number
  pref_state: number
  pref_country: number
}

interface SellerCategory {
  mcat_id: number
  mcat_name: string
}

interface BehavioralInsights {
  pns_health: 'good' | 'moderate' | 'poor' | 'unknown'
  lead_engagement: 'active' | 'moderate' | 'inactive' | 'unknown'
  service_tier: string | null
  tenure_status: 'new' | 'established' | 'veteran' | 'unknown'
  has_prior_tickets: boolean  // Multiple tickets in 30/60 days, NOT necessarily unresolved
  cqs_trend: 'improving' | 'declining' | 'stable' | 'unknown'
  roi_risk: 'low' | 'moderate' | 'high' | 'unknown'
  category_visibility: 'good' | 'moderate' | 'poor' | 'unknown'
  product_issues: 'none' | 'some' | 'many' | 'unknown'
}

// New behavioral enhancement interfaces
type SellerBehaviorType = 'high_potential' | 'dormant_at_risk' | 'misconfigured' | 'moderate' | 'unknown'

interface SellerBehaviorClassification {
  type: SellerBehaviorType
  label: string
  description: string
  confidence: 'high' | 'medium' | 'low'
  factors: {
    positive: string[]
    negative: string[]
  }
  recommended_actions: string[]
}

interface HistoricalTrend {
  metric: string
  label: string
  current_value: number | null
  previous_value: number | null
  trend: 'up' | 'down' | 'stable'
  higher_is_better: boolean
  change_percent: number | null
  history: Array<{ month: string; value: number | null }>
}

interface InterlinkedInsight {
  signal: string
  impact: string
  severity: 'critical' | 'warning' | 'info'
  recommendation: string
}

interface EngagementPattern {
  best_day_of_week: string | null
  best_time_of_day: string | null
  avg_response_time: string | null
  avg_call_duration_minutes: number | null
  response_rate: number | null
  preferred_channel: string
  call_outcome_by_time: Array<{ time_slot: string; success_rate: number }>
}


interface CumulativeSopEntry {
  issue_category: string
  count: number
  last_seen: string | null
  sop_guidance: string | null
  source?: string | null
  max_severity?: 'critical' | 'high' | 'medium' | 'low' | null
  severity_counts?: {
    critical: number
    high: number
    medium: number
    low: number
  }
}

interface CumulativeSopResponse {
  company_id: string
  total_calls: number
  calls_with_rag: number
  date_range: {
    first_call: string | null
    last_call: string | null
  }
  cumulative_sop: CumulativeSopEntry[]
}


interface SellerProfile {
  company_id: string
  company_name: string
  total_calls: number
  date_range: {
    first_call: string
    latest_call: string
  }
  communication_fingerprint: {
    avg_call_duration: number
    preferred_language: string
    tone_consistency: string
    responsiveness_pattern: string
  }
  health_metrics: {
    health_score: number
    sentiment_trend: 'improving' | 'declining' | 'stable'
    avg_churn_risk: number
    resolution_rate: number
  }
  issue_analysis: {
    total_issues: number
    recurring_issues: Array<{ category: string; count: number; first_seen: string; last_seen: string }>
    resolved_issues: number
    sticky_issues: string[]
  }
  risk_assessment: {
    risk_level: 'low' | 'medium' | 'high'
    churn_probability: number
    escalation_history: number
    deactivation_mentions: number
    payment_disputes: number
  }
  engagement_metrics: {
    days_since_last_call: number
    avg_calls_per_month: number
    call_frequency_trend: 'increasing' | 'decreasing' | 'stable'
  }
  call_timeline: CallTimelineEntry[]
  recommendations: string[]
  // Behavioral data
  behavioral_profile: BehavioralProfile | null
  monthly_metrics: MonthlyMetrics[]
  top_categories: SellerCategory[]
  behavioral_insights: BehavioralInsights
  // New behavioral enhancements
  behavior_classification: SellerBehaviorClassification
  historical_trends: HistoricalTrend[]
  interlinked_insights: InterlinkedInsight[]
  engagement_patterns: EngagementPattern
}

interface SellerDetailModalProps {
  companyId: string
  onClose: () => void
}

function HealthScoreGauge({ score }: { score: number }) {
  const getColor = () => {
    if (score >= 70) return '#22c55e'
    if (score >= 40) return '#eab308'
    return '#ef4444'
  }

  const circumference = 2 * Math.PI * 45
  const strokeDashoffset = circumference - (score / 100) * circumference

  return (
    <div className="relative w-32 h-32">
      <svg className="w-full h-full transform -rotate-90">
        <circle
          cx="64"
          cy="64"
          r="45"
          stroke="#e5e7eb"
          strokeWidth="10"
          fill="none"
        />
        <circle
          cx="64"
          cy="64"
          r="45"
          stroke={getColor()}
          strokeWidth="10"
          fill="none"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-3xl font-bold" style={{ color: getColor() }}>{score}</span>
        <span className="text-xs text-gray-500">Health Score</span>
      </div>
    </div>
  )
}

function SentimentTrendChart({ timeline }: { timeline: CallTimelineEntry[] }) {
  const getSentimentColor = (sentiment: string) => {
    const s = sentiment?.toLowerCase()
    if (s === 'positive') return { bg: 'bg-green-100', text: 'text-green-700', border: 'border-green-300' }
    if (s === 'neutral') return { bg: 'bg-gray-100', text: 'text-gray-700', border: 'border-gray-300' }
    if (s === 'negative') return { bg: 'bg-orange-100', text: 'text-orange-700', border: 'border-orange-300' }
    if (s === 'frustrated') return { bg: 'bg-red-100', text: 'text-red-700', border: 'border-red-300' }
    if (s === 'angry') return { bg: 'bg-red-200', text: 'text-red-800', border: 'border-red-400' }
    return { bg: 'bg-gray-100', text: 'text-gray-500', border: 'border-gray-300' }
  }

  const chartData = timeline.map((call, index) => ({
    call: `Call ${index + 1}`,
    date: new Date(call.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }),
    churn_risk: Math.round(call.churn_risk_score * 100),
    sentiment_start: call.sentiment_start,
    sentiment_end: call.sentiment_end
  }))

  return (
    <div className="space-y-4">
      {/* Churn Risk Line Chart */}
      <div className="h-48">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="date" tick={{ fontSize: 10 }} />
            <YAxis
              domain={[0, 100]}
              tick={{ fontSize: 10 }}
              label={{ value: 'Churn Risk %', angle: -90, position: 'insideLeft', fontSize: 10 }}
            />
            <Tooltip
              formatter={(value: number) => [`${value}%`, 'Churn Risk']}
              labelFormatter={(label) => `Date: ${label}`}
            />
            <Line
              type="monotone"
              dataKey="churn_risk"
              stroke="#ef4444"
              strokeWidth={2}
              dot={{ fill: '#ef4444', r: 4 }}
              name="Churn Risk"
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

    </div>
  )
}

interface IssueWithSubcategories {
  category: string
  count: number
  subcategories?: Array<{ subcategory: string; call_date: string; call_number: number }>
}

function IssueHeatmap({ issues }: { issues: IssueWithSubcategories[] }) {
  const [hoveredIssue, setHoveredIssue] = useState<string | null>(null)
  const colors = ['#dcfce7', '#86efac', '#22c55e', '#15803d', '#14532d']

  const maxCount = Math.max(...issues.map(i => i.count))

  // Group subcategories by call number
  const getCallBreakdown = (issue: IssueWithSubcategories) => {
    if (!issue.subcategories) return []

    const callMap: Record<number, string[]> = {}
    issue.subcategories.forEach(sub => {
      if (!callMap[sub.call_number]) callMap[sub.call_number] = []
      callMap[sub.call_number].push(sub.subcategory)
    })

    return Object.entries(callMap)
      .sort((a, b) => Number(a[0]) - Number(b[0]))
      .map(([callNum, subs]) => ({
        callNumber: Number(callNum),
        subcategories: subs
      }))
  }

  return (
    <div className="space-y-2">
      {issues.map((issue, idx) => {
        const intensity = Math.min(4, Math.floor((issue.count / maxCount) * 5))
        const callBreakdown = getCallBreakdown(issue)
        const isHovered = hoveredIssue === issue.category

        return (
          <div key={idx} className="relative">
            <div
              className="flex items-center gap-2 cursor-pointer"
              onMouseEnter={() => setHoveredIssue(issue.category)}
              onMouseLeave={() => setHoveredIssue(null)}
            >
              <div className="w-32 text-sm text-gray-700 truncate" title={issue.category}>
                {issue.category}
              </div>
              <div className="flex-1 h-6 bg-gray-100 rounded overflow-hidden">
                <div
                  className="h-full rounded transition-all"
                  style={{
                    width: `${(issue.count / maxCount) * 100}%`,
                    backgroundColor: colors[intensity]
                  }}
                />
              </div>
              <span className="text-sm font-medium w-8 text-right">{issue.count}</span>
            </div>

            {/* Hover Tooltip */}
            {isHovered && callBreakdown.length > 0 && (
              <div className="absolute left-0 top-full mt-1 z-20 bg-gray-900 text-white text-xs rounded-lg p-3 shadow-lg min-w-[280px] max-w-[350px]">
                <div className="font-semibold mb-2 text-yellow-300">
                  {issue.category}: {issue.count} occurrences across {callBreakdown.length} call{callBreakdown.length > 1 ? 's' : ''}
                </div>
                <div className="space-y-2">
                  {callBreakdown.map(({ callNumber, subcategories }) => (
                    <div key={callNumber} className="border-t border-gray-700 pt-1">
                      <div className="text-gray-400 text-[10px] mb-1">Call {callNumber}:</div>
                      <div className="flex flex-wrap gap-1">
                        {subcategories.map((sub, i) => (
                          <span
                            key={i}
                            className="px-1.5 py-0.5 bg-gray-700 rounded text-[10px]"
                          >
                            {sub}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
                <div className="mt-2 pt-2 border-t border-gray-700 text-gray-400 text-[10px]">
                  Total: {issue.count} issue{issue.count > 1 ? 's' : ''} from {callBreakdown.length} call{callBreakdown.length > 1 ? 's' : ''}
                </div>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

function CallTimelineItem({ call, isExpanded, onToggle }: {
  call: CallTimelineEntry
  isExpanded: boolean
  onToggle: () => void
}) {
  const [audioError, setAudioError] = useState(false)

  const getSentimentColor = (sentiment: string) => {
    const colors: Record<string, string> = {
      positive: 'bg-green-100 text-green-700',
      neutral: 'bg-gray-100 text-gray-700',
      negative: 'bg-red-100 text-red-700',
      frustrated: 'bg-orange-100 text-orange-700',
      angry: 'bg-red-200 text-red-800'
    }
    return colors[sentiment?.toLowerCase()] || 'bg-gray-100 text-gray-700'
  }

  const getResolutionColor = (status: string) => {
    const colors: Record<string, string> = {
      resolved: 'bg-green-100 text-green-700',
      partial: 'bg-yellow-100 text-yellow-700',
      unresolved: 'bg-red-100 text-red-700'
    }
    return colors[status?.toLowerCase()] || 'bg-gray-100 text-gray-700'
  }

  return (
    <div className="border rounded-lg overflow-hidden">
      <div
        onClick={onToggle}
        className="flex items-center justify-between p-3 cursor-pointer hover:bg-gray-50"
      >
        <div className="flex items-center gap-3">
          {/* Recording Indicator */}
          {call.recording_url ? (
            <div
              className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center"
              title="Recording available - expand to play"
            >
              <Volume2 className="h-4 w-4 text-blue-600" />
            </div>
          ) : (
            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center" title="No recording available">
              <Volume2 className="h-4 w-4 text-gray-400" />
            </div>
          )}

          <div className="text-sm">
            <div className="font-medium">
              {new Date(call.date).toLocaleDateString('en-IN', {
                day: 'numeric',
                month: 'short',
                year: 'numeric'
              })}
            </div>
            {call.employee_name &&
             call.employee_name.toLowerCase() !== 'unknown' &&
             call.employee_name.trim() !== '' && (
              <div className="text-xs text-gray-500">{call.employee_name}</div>
            )}
          </div>
          <span className={`px-2 py-0.5 rounded text-xs ${getSentimentColor(call.sentiment_end)}`}>
            {call.sentiment_start} → {call.sentiment_end}
          </span>
          <span className={`px-2 py-0.5 rounded text-xs ${getResolutionColor(call.resolution_status)}`}>
            {call.resolution_status}
          </span>
        </div>
        <div className="flex items-center gap-3">
          {call.risk_signals.length > 0 && (
            <AlertTriangle className="h-4 w-4 text-red-500" />
          )}
          <span className={`text-sm font-medium ${
            call.churn_risk_score >= 0.7 ? 'text-red-600' :
            call.churn_risk_score >= 0.4 ? 'text-yellow-600' : 'text-green-600'
          }`}>
            {Math.round(call.churn_risk_score * 100)}%
          </span>
          {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </div>
      </div>


      {isExpanded && (
        <div className="p-3 border-t bg-gray-50 space-y-3">
          {/* Audio Player */}
          {call.recording_url && (
            <div className="bg-blue-50 rounded-lg p-3 border border-blue-100">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Volume2 className="h-4 w-4 text-blue-600" />
                  <span className="text-sm font-medium text-blue-800">Call Recording</span>
                </div>
                <a
                  href={call.recording_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 hover:underline"
                  onClick={(e) => e.stopPropagation()}
                >
                  <ExternalLink className="h-3 w-3" />
                  Open in new tab
                </a>
              </div>
              {!audioError ? (
                <audio
                  controls
                  className="w-full h-10"
                  src={call.recording_url}
                  onError={() => setAudioError(true)}
                >
                  Your browser does not support the audio element.
                </audio>
              ) : (
                <div className="text-sm text-orange-600 bg-orange-50 rounded p-2">
                  Audio cannot be played directly (may require authentication).
                  Use "Open in new tab" to listen.
                </div>
              )}
            </div>
          )}

          {/* Call Details */}
          <div className="grid grid-cols-3 gap-4 text-sm">
            <div>
              <span className="text-gray-500">Duration:</span>
              <span className="ml-1 font-medium">{Math.round(call.duration_seconds / 60)} min</span>
            </div>
            <div>
              <span className="text-gray-500">Purpose:</span>
              <span className="ml-1 font-medium capitalize">{call.call_purpose}</span>
            </div>
            <div>
              <span className="text-gray-500">Tone:</span>
              <span className="ml-1 font-medium capitalize">{call.executive_tone}</span>
            </div>
          </div>

          {/* Risk Signals */}
          {call.risk_signals.length > 0 && (
            <div>
              <p className="text-xs text-gray-500 mb-1">Risk Signals:</p>
              <div className="flex flex-wrap gap-1">
                {call.risk_signals.map((signal, idx) => (
                  <span key={idx} className="px-2 py-0.5 bg-red-100 text-red-700 rounded text-xs">
                    {signal}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Issues */}
          {call.issues.length > 0 && (
            <div>
              <p className="text-xs text-gray-500 mb-1">Issues Discussed:</p>
              <div className="space-y-1">
                {call.issues.map((issue, idx) => (
                  <div key={idx} className="flex items-start gap-2 text-sm">
                    <span className={`px-1.5 py-0.5 rounded text-xs flex-shrink-0 ${
                      issue.severity === 'critical' ? 'bg-red-100 text-red-700' :
                      issue.severity === 'high' ? 'bg-orange-100 text-orange-700' :
                      'bg-gray-100 text-gray-700'
                    }`}>
                      {issue.category}{issue.subcategory ? ` (${issue.subcategory})` : ''}
                    </span>
                    <span className="text-gray-600">{issue.description}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Topics */}
          {call.topics.length > 0 && (
            <div>
              <p className="text-xs text-gray-500 mb-1">Topics:</p>
              <div className="flex flex-wrap gap-1">
                {call.topics.map((topic, idx) => (
                  <span key={idx} className="px-2 py-0.5 bg-blue-50 text-blue-700 rounded text-xs">
                    {topic}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Key Quotes - only show if there's actual content */}
          {call.key_quotes && (call.key_quotes.main_complaint || call.key_quotes.customer_ask || call.key_quotes.notable_statement) && (
            <div>
              <p className="text-xs text-gray-500 mb-1">Key Quotes:</p>
              {call.key_quotes.main_complaint && (
                <p className="text-sm text-gray-700 italic mb-1">
                  "{call.key_quotes.main_complaint}"
                </p>
              )}
              {call.key_quotes.customer_ask && (
                <p className="text-sm text-gray-700 italic mb-1">
                  "{call.key_quotes.customer_ask}"
                </p>
              )}
              {call.key_quotes.notable_statement && (
                <p className="text-sm text-gray-700 italic">
                  "{call.key_quotes.notable_statement}"
                </p>
              )}
            </div>
          )}

          {/* UCID Link */}
          <div className="pt-2 border-t">
            <span className="text-xs text-gray-500">UCID: {call.ucid}</span>
          </div>
        </div>
      )}
    </div>
  )
}

type TabType = 'overview' | 'behavioral' | 'issues'

export default function SellerDetailModal({ companyId, onClose }: SellerDetailModalProps) {
  const [profile, setProfile] = useState<SellerProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [expandedCalls, setExpandedCalls] = useState<Set<string>>(new Set())
  const [selectedStickyIssueSOP, setSelectedStickyIssueSOP] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<TabType>('overview')
  const [cumulativeSop, setCumulativeSop] = useState<CumulativeSopEntry[] | null>(null)
  const [cumulativeSopLoading, setCumulativeSopLoading] = useState(false)

  useEffect(() => {
    fetchProfile()
  }, [companyId])

  const fetchProfile = async () => {
    try {
      setLoading(true)
      const res = await fetch(`/api/seller-insights/${companyId}`)
      if (!res.ok) throw new Error('Failed to fetch seller profile')
      const data = await res.json()
      setProfile(data)
      fetchCumulativeSop(data.company_id)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setLoading(false)
    }
  }


  const fetchCumulativeSop = async (companyId: string) => {
    if (!companyId) {
      setCumulativeSop([])
      return
    }

    try {
      setCumulativeSopLoading(true)
      const res = await fetch(`/api/sop-recommendations-glid?company_id=${companyId}`)
      if (!res.ok) throw new Error('Failed to fetch cumulative SOP')
      const json: CumulativeSopResponse = await res.json()
      setCumulativeSop(Array.isArray(json.cumulative_sop) ? json.cumulative_sop : [])
    } catch (err) {
      console.error('Error fetching cumulative SOP:', err)
      setCumulativeSop([])
    } finally {
      setCumulativeSopLoading(false)
    }
  }

  const toggleCallExpansion = (callId: string) => {
    const newExpanded = new Set(expandedCalls)
    if (newExpanded.has(callId)) {
      newExpanded.delete(callId)
    } else {
      newExpanded.add(callId)
    }
    setExpandedCalls(newExpanded)
  }

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    })
  }

  const formatSeverityLabel = (value?: string | null) => {
    if (!value) return 'Unknown'
    return value.charAt(0).toUpperCase() + value.slice(1)
  }

  const getTrendIcon = (trend: string) => {
    if (trend === 'improving' || trend === 'increasing') {
      return <TrendingUp className="h-4 w-4 text-green-500" />
    }
    if (trend === 'declining' || trend === 'decreasing') {
      return <TrendingDown className="h-4 w-4 text-red-500" />
    }
    return <Minus className="h-4 w-4 text-gray-400" />
  }

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-full items-center justify-center p-4">
        {/* Backdrop */}
        <div className="fixed inset-0 bg-black/50" onClick={onClose} />

        {/* Modal */}
        <div className="relative bg-white rounded-xl shadow-xl w-full max-w-5xl max-h-[90vh] overflow-hidden">
          {/* Header */}
          <div className="sticky top-0 bg-white border-b px-6 py-4 flex items-center justify-between z-10">
            <div>
              <h2 className="text-xl font-semibold">
                {loading ? 'Loading...' : (
                  profile?.company_name &&
                  profile.company_name.toLowerCase() !== 'unknown' &&
                  profile.company_name.trim() !== ''
                    ? profile.company_name
                    : `Seller ${companyId.slice(0, 8)}...`
                )}
              </h2>
              <p className="text-sm text-gray-500">ID: {companyId}</p>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-full transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Content */}
          <div className="p-6 overflow-y-auto max-h-[calc(90vh-80px)]">
            {loading && (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
              </div>
            )}

            {error && (
              <div className="text-center py-12 text-red-600">{error}</div>
            )}

            {profile && (
              <div className="space-y-6">
                {/* Tab Navigation */}
                <div className="border-b border-gray-200">
                  <nav className="flex space-x-8" aria-label="Tabs">
                    <button
                      onClick={() => setActiveTab('overview')}
                      className={`py-3 px-1 border-b-2 font-medium text-sm transition-colors ${
                        activeTab === 'overview'
                          ? 'border-blue-500 text-blue-600'
                          : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                      }`}
                    >
                      Overview
                    </button>
                    <button
                      onClick={() => setActiveTab('behavioral')}
                      className={`py-3 px-1 border-b-2 font-medium text-sm transition-colors ${
                        activeTab === 'behavioral'
                          ? 'border-blue-500 text-blue-600'
                          : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                      }`}
                    >
                      Behavioral Insights
                    </button>
                    <button
                      onClick={() => setActiveTab('issues')}
                      className={`py-3 px-1 border-b-2 font-medium text-sm transition-colors ${
                        activeTab === 'issues'
                          ? 'border-blue-500 text-blue-600'
                          : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                      }`}
                    >
                      Issues & History
                    </button>
                  </nav>
                </div>

                {/* TAB 1: OVERVIEW */}
                {activeTab === 'overview' && (
                  <div className="space-y-6">
                {/* Overview Row */}
                <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                  {/* Health Score */}
                  <div className="flex items-center justify-center">
                    <HealthScoreGauge score={profile.health_metrics.health_score} />
                  </div>

                  {/* Key Metrics */}
                  <div className="lg:col-span-3 grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="bg-gray-50 rounded-lg p-4">
                      <div className="flex items-center gap-2 text-gray-600 mb-1">
                        <Phone className="h-4 w-4" />
                        <span className="text-sm">Total Calls</span>
                      </div>
                      <p className="text-2xl font-bold">{profile.total_calls}</p>
                    </div>

                    <div className="bg-gray-50 rounded-lg p-4">
                      <div className="flex items-center gap-2 text-gray-600 mb-1">
                        <CheckCircle className="h-4 w-4" />
                        <span className="text-sm">Resolution Rate</span>
                        <InfoTooltip term="resolution_rate" />
                      </div>
                      <p className="text-2xl font-bold">{profile.health_metrics.resolution_rate}%</p>
                    </div>

                    <div className="bg-gray-50 rounded-lg p-4">
                      <div className="flex items-center gap-2 text-gray-600 mb-1">
                        <Target className="h-4 w-4" />
                        <span className="text-sm">Churn Risk</span>
                        <InfoTooltip term="churn_risk" />
                      </div>
                      <p className={`text-2xl font-bold ${
                        profile.health_metrics.avg_churn_risk >= 0.7 ? 'text-red-600' :
                        profile.health_metrics.avg_churn_risk >= 0.4 ? 'text-yellow-600' : 'text-green-600'
                      }`}>
                        {Math.round(profile.health_metrics.avg_churn_risk * 100)}%
                      </p>
                    </div>

                    <div className="bg-gray-50 rounded-lg p-4">
                      <div className="flex items-center gap-2 text-gray-600 mb-1">
                        {getTrendIcon(profile.health_metrics.sentiment_trend)}
                        <span className="text-sm">Sentiment Trend</span>
                        <InfoTooltip term="sentiment_trend" />
                      </div>
                      <p className="text-xl font-bold capitalize">{profile.health_metrics.sentiment_trend}</p>
                    </div>
                  </div>
                </div>

                {/* Seller Behavior Classification - Prominent Section */}
                {profile.behavior_classification && (
                  <div className={`rounded-xl p-5 border-2 ${
                    profile.behavior_classification.type === 'high_potential'
                      ? 'bg-green-50 border-green-300'
                      : profile.behavior_classification.type === 'dormant_at_risk'
                      ? 'bg-red-50 border-red-300'
                      : profile.behavior_classification.type === 'misconfigured'
                      ? 'bg-yellow-50 border-yellow-300'
                      : 'bg-gray-50 border-gray-300'
                  }`}>
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <span className={`px-3 py-1.5 rounded-full text-sm font-bold ${
                          profile.behavior_classification.type === 'high_potential'
                            ? 'bg-green-600 text-white'
                            : profile.behavior_classification.type === 'dormant_at_risk'
                            ? 'bg-red-600 text-white'
                            : profile.behavior_classification.type === 'misconfigured'
                            ? 'bg-yellow-600 text-white'
                            : 'bg-gray-600 text-white'
                        }`}>
                          {profile.behavior_classification.label}
                        </span>
                        <span className={`text-xs px-2 py-0.5 rounded ${
                          profile.behavior_classification.confidence === 'high'
                            ? 'bg-green-200 text-green-800'
                            : profile.behavior_classification.confidence === 'medium'
                            ? 'bg-yellow-200 text-yellow-800'
                            : 'bg-gray-200 text-gray-800'
                        }`}>
                          {profile.behavior_classification.confidence} confidence
                        </span>
                      </div>
                    </div>
                    <p className={`text-sm mb-4 ${
                      profile.behavior_classification.type === 'high_potential'
                        ? 'text-green-800'
                        : profile.behavior_classification.type === 'dormant_at_risk'
                        ? 'text-red-800'
                        : profile.behavior_classification.type === 'misconfigured'
                        ? 'text-yellow-800'
                        : 'text-gray-800'
                    }`}>
                      {profile.behavior_classification.description}
                    </p>

                    {/* Factors */}
                    <div className="grid grid-cols-2 gap-4 mb-4">
                      {profile.behavior_classification.factors.positive.length > 0 && (
                        <div>
                          <p className="text-xs font-medium text-green-700 mb-1">Positive Signals</p>
                          <ul className="space-y-1">
                            {profile.behavior_classification.factors.positive.map((f, i) => (
                              <li key={i} className="text-xs text-green-600 flex items-start gap-1">
                                <CheckCircle className="h-3 w-3 mt-0.5 flex-shrink-0" />
                                {f}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                      {profile.behavior_classification.factors.negative.length > 0 && (
                        <div>
                          <p className="text-xs font-medium text-red-700 mb-1">Risk Signals</p>
                          <ul className="space-y-1">
                            {profile.behavior_classification.factors.negative.map((f, i) => (
                              <li key={i} className="text-xs text-red-600 flex items-start gap-1">
                                <AlertTriangle className="h-3 w-3 mt-0.5 flex-shrink-0" />
                                {f}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>

                    {/* Recommended Actions */}
                    {profile.behavior_classification.recommended_actions.length > 0 && (
                      <div className="pt-3 border-t border-gray-200">
                        <p className="text-xs font-medium text-gray-700 mb-2">SOP-Based Actions</p>
                        <div className="flex flex-wrap gap-2">
                          {profile.behavior_classification.recommended_actions.map((action, i) => (
                            <span key={i} className="text-xs px-2 py-1 bg-white border rounded-full text-gray-700">
                              {action}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Recommendations - In Overview Tab */}
                {profile.recommendations.length > 0 && (
                  <div className="bg-blue-50 rounded-lg p-4">
                    <div className="flex items-center gap-2 text-blue-700 mb-3">
                      <Lightbulb className="h-5 w-5" />
                      <h3 className="font-semibold">Recommendations</h3>
                      <InfoTooltip term="recommendations" />
                    </div>
                    <ul className="space-y-2">
                      {profile.recommendations.map((rec, idx) => (
                        <li key={idx} className="flex items-start gap-2 text-sm text-blue-800">
                          <span className="text-blue-500 mt-0.5">•</span>
                          {rec}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Cumulative SOP - In Overview Tab */}
                {(cumulativeSopLoading || cumulativeSop) && (
                  <div className="bg-indigo-50 rounded-lg p-4">
                    <div className="flex items-center gap-2 text-indigo-700 mb-3">
                      <BookOpen className="h-5 w-5" />
                      <h3 className="font-semibold">Cumulative SOP (Top Issues)</h3>
                    </div>
                    {cumulativeSopLoading && (
                      <p className="text-sm text-indigo-700">Loading cumulative SOP...</p>
                    )}
                    {!cumulativeSopLoading && cumulativeSop && cumulativeSop.length > 0 && (
                      <ul className="space-y-3">
                        {cumulativeSop.slice(0, 3).map((issue, idx) => (
                          <li key={idx} className="text-sm text-indigo-900">
                            <div className="font-medium">
                              {CATEGORY_LABELS[issue.issue_category] || issue.issue_category} - {formatSeverityLabel(issue.max_severity)} - {issue.count} calls
                            </div>
                            <div className="text-xs text-indigo-800">
                              Last seen: {issue.last_seen ? formatDate(issue.last_seen) : 'Unknown'}
                            </div>
                            {issue.sop_guidance && (
                              <div className="text-xs text-indigo-800 mt-1">
                                {issue.sop_guidance.slice(0, 240)}...
                              </div>
                            )}
                          </li>
                        ))}
                      </ul>
                    )}
                    {!cumulativeSopLoading && cumulativeSop && cumulativeSop.length === 0 && (
                      <p className="text-sm text-indigo-700">No cumulative SOP data (RAG-only).</p>
                    )}
                  </div>
                )}

                {/* Sticky Issues Alert - In Overview Tab */}
                {profile.issue_analysis.sticky_issues.length > 0 && (
                  <div className="bg-red-50 rounded-lg p-4">
                    <div className="flex items-center gap-2 text-red-700 mb-3">
                      <Repeat className="h-5 w-5" />
                      <h3 className="font-semibold">Sticky Issues (Recurring in 3+ calls)</h3>
                      <InfoTooltip term="sticky_issues" />
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {profile.issue_analysis.sticky_issues.map((issue, idx) => (
                        <button
                          key={idx}
                          className="px-3 py-1 bg-white border border-red-200 rounded-full text-red-700 text-sm hover:bg-red-100 transition-colors"
                          onClick={() => setSelectedStickyIssueSOP(issue)}
                        >
                          {CATEGORY_LABELS[issue] || issue}
                        </button>
                      ))}
                    </div>
                    {selectedStickyIssueSOP && (
                      <div className="mt-4 p-4 bg-white rounded-lg border border-red-200">
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-medium text-red-700">
                            SOP Guidance: {CATEGORY_LABELS[selectedStickyIssueSOP] || selectedStickyIssueSOP}
                          </span>
                          <button
                            onClick={() => setSelectedStickyIssueSOP(null)}
                            className="text-gray-400 hover:text-gray-600"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </div>
                        <div className="text-sm text-gray-700 whitespace-pre-line">
                          {SOP_GUIDANCE[selectedStickyIssueSOP] || SOP_GUIDANCE['other']}
                        </div>
                      </div>
                    )}
                  </div>
                )}
                  </div>
                )}

                {/* TAB 2: BEHAVIORAL INSIGHTS */}
                {activeTab === 'behavioral' && (
                  <div className="space-y-6">

                {/* Interlinked Behavioral Insights */}
                {profile.interlinked_insights && profile.interlinked_insights.length > 0 && (
                  <div className="bg-white border rounded-xl p-4">
                    <h3 className="font-semibold mb-3 flex items-center gap-2">
                      <Target className="h-4 w-4" />
                      Behavioral Insights (SOP-Based Analysis)
                    </h3>
                    <div className="space-y-3">
                      {profile.interlinked_insights.map((insight, idx) => (
                        <div
                          key={idx}
                          className={`p-3 rounded-lg border-l-4 ${
                            insight.severity === 'critical'
                              ? 'bg-red-50 border-l-red-500'
                              : insight.severity === 'warning'
                              ? 'bg-yellow-50 border-l-yellow-500'
                              : 'bg-blue-50 border-l-blue-500'
                          }`}
                        >
                          <div className="flex items-start justify-between mb-1">
                            <span className={`font-medium text-sm ${
                              insight.severity === 'critical'
                                ? 'text-red-700'
                                : insight.severity === 'warning'
                                ? 'text-yellow-700'
                                : 'text-blue-700'
                            }`}>
                              {insight.signal}
                            </span>
                            <span className={`text-xs px-2 py-0.5 rounded ${
                              insight.severity === 'critical'
                                ? 'bg-red-200 text-red-800'
                                : insight.severity === 'warning'
                                ? 'bg-yellow-200 text-yellow-800'
                                : 'bg-blue-200 text-blue-800'
                            }`}>
                              {insight.severity}
                            </span>
                          </div>
                          <p className="text-xs text-gray-600 mb-2">{insight.impact}</p>
                          <div className="flex items-start gap-1 text-xs">
                            <Lightbulb className="h-3 w-3 text-gray-500 mt-0.5 flex-shrink-0" />
                            <span className="text-gray-700">{insight.recommendation}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Historical Trends */}
                {profile.historical_trends && profile.historical_trends.length > 0 && (
                  <div className="bg-white border rounded-xl p-4">
                    <h3 className="font-semibold mb-3 flex items-center gap-2">
                      <BarChart3 className="h-4 w-4" />
                      Historical Trends
                    </h3>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                      {profile.historical_trends.map((trend, idx) => (
                        <div key={idx} className="p-3 bg-gray-50 rounded-lg">
                          <p className="text-xs text-gray-500 mb-1">{trend.label}</p>
                          <div className="flex items-center gap-2">
                            <span className="text-lg font-bold">
                              {trend.current_value !== null ? trend.current_value : 'N/A'}
                            </span>
                            {trend.trend !== 'stable' && trend.change_percent !== null && (() => {
                              // Determine if the change is positive based on direction AND whether higher is better
                              const isPositiveChange = trend.trend === 'up'
                                ? trend.higher_is_better
                                : !trend.higher_is_better
                              return (
                                <span className={`text-xs flex items-center ${
                                  isPositiveChange ? 'text-green-600' : 'text-red-600'
                                }`}>
                                  {trend.trend === 'up' ? (
                                    <TrendingUp className="h-3 w-3 mr-0.5" />
                                  ) : (
                                    <TrendingDown className="h-3 w-3 mr-0.5" />
                                  )}
                                  {Math.abs(trend.change_percent)}%
                                </span>
                              )
                            })()}
                            {trend.trend === 'stable' && (
                              <span className="text-xs text-gray-500 flex items-center">
                                <Minus className="h-3 w-3 mr-0.5" />
                                stable
                              </span>
                            )}
                          </div>
                          {/* Mini sparkline */}
                          {trend.history.length > 1 && (
                            <div className="mt-2 h-8 flex items-end gap-0.5">
                              {trend.history.map((h, i) => {
                                const maxVal = Math.max(...trend.history.map(x => x.value || 0))
                                const height = maxVal > 0 ? ((h.value || 0) / maxVal) * 100 : 0
                                return (
                                  <div
                                    key={i}
                                    className={`flex-1 rounded-t ${
                                      i === trend.history.length - 1 ? 'bg-blue-500' : 'bg-gray-300'
                                    }`}
                                    style={{ height: `${Math.max(height, 5)}%` }}
                                    title={`${h.month}: ${h.value}`}
                                  />
                                )
                              })}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Engagement Patterns */}
                {profile.engagement_patterns && (
                  <div className="bg-white border rounded-xl p-4">
                    <h3 className="font-semibold mb-3 flex items-center gap-2">
                      <Clock className="h-4 w-4" />
                      Engagement Patterns
                    </h3>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div className="text-center p-3 bg-green-50 rounded-lg">
                        <p className="text-xs text-gray-500 mb-1">Best Day</p>
                        <p className="font-bold text-green-700">
                          {profile.engagement_patterns.best_day_of_week || 'N/A'}
                        </p>
                      </div>
                      <div className="text-center p-3 bg-blue-50 rounded-lg">
                        <p className="text-xs text-gray-500 mb-1">Best Time</p>
                        <p className="font-bold text-blue-700">
                          {profile.engagement_patterns.best_time_of_day || 'N/A'}
                        </p>
                      </div>
                      <div className="text-center p-3 bg-purple-50 rounded-lg">
                        <p className="text-xs text-gray-500 mb-1">Avg Call Duration</p>
                        <p className="font-bold text-purple-700">
                          {profile.engagement_patterns.avg_call_duration_minutes !== null
                            ? `${profile.engagement_patterns.avg_call_duration_minutes} mins`
                            : 'N/A'}
                        </p>
                      </div>
                      <div className="text-center p-3 bg-orange-50 rounded-lg">
                        <p className="text-xs text-gray-500 mb-1">Resolution Rate</p>
                        <p className="font-bold text-orange-700">
                          {profile.engagement_patterns.response_rate !== null
                            ? `${profile.engagement_patterns.response_rate}%`
                            : 'N/A'}
                        </p>
                      </div>
                      <div className="col-span-2 md:col-span-4">
                        <p className="text-xs text-gray-500 mb-2">Success Rate by Time</p>
                        <div className="flex gap-2">
                          {profile.engagement_patterns.call_outcome_by_time.map((slot, idx) => (
                            <div key={idx} className="flex-1 text-center">
                              <div className="h-16 bg-gray-100 rounded relative overflow-hidden">
                                <div
                                  className="absolute bottom-0 w-full bg-blue-500 transition-all"
                                  style={{ height: `${slot.success_rate}%` }}
                                />
                              </div>
                              <p className="text-xs mt-1 text-gray-600">{slot.time_slot.split(' ')[0]}</p>
                              <p className="text-xs font-medium">{slot.success_rate}%</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
                  </div>
                )}

                {/* TAB 3: ISSUES & HISTORY */}
                {activeTab === 'issues' && (
                  <div className="space-y-6">

                {/* Charts Row */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Sentiment Trend Chart */}
                  <div className="bg-white rounded-lg border p-4">
                    <h3 className="font-semibold mb-4 flex items-center">
                      Sentiment & Risk Trend
                      <InfoTooltip term="sentiment_risk_trend" />
                    </h3>
                    <SentimentTrendChart timeline={profile.call_timeline} />
                  </div>

                  {/* Issue Distribution */}
                  <div className="bg-white rounded-lg border p-4">
                    <h3 className="font-semibold mb-4 flex items-center">
                      Issue Distribution
                      <InfoTooltip term="issue_distribution" />
                    </h3>
                    {profile.issue_analysis.recurring_issues.length > 0 ? (
                      <IssueHeatmap issues={profile.issue_analysis.recurring_issues} />
                    ) : (
                      <p className="text-gray-500 text-center py-8">No recurring issues</p>
                    )}
                  </div>
                </div>

                {/* Details Grid */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {/* Communication Fingerprint */}
                  <div className="bg-white rounded-lg border p-4">
                    <h3 className="font-semibold mb-3 flex items-center gap-2">
                      <MessageSquare className="h-4 w-4" />
                      Communication Profile
                      <InfoTooltip term="communication_profile" />
                    </h3>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-500 flex items-center">Avg Duration<InfoTooltip term="avg_duration" /></span>
                        <span className="font-medium">
                          {Math.round(profile.communication_fingerprint.avg_call_duration / 60)} min
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500 flex items-center">Language<InfoTooltip term="language" /></span>
                        <span className="font-medium">{profile.communication_fingerprint.preferred_language}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500 flex items-center">Tone Consistency<InfoTooltip term="tone_consistency" /></span>
                        <span className="font-medium capitalize">{profile.communication_fingerprint.tone_consistency}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500 flex items-center">Responsiveness<InfoTooltip term="responsiveness" /></span>
                        <span className="font-medium capitalize">{profile.communication_fingerprint.responsiveness_pattern}</span>
                      </div>
                    </div>
                  </div>

                  {/* Risk Assessment */}
                  <div className="bg-white rounded-lg border p-4">
                    <h3 className="font-semibold mb-3 flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4" />
                      Risk Assessment
                      <InfoTooltip term="risk_assessment" />
                    </h3>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-500 flex items-center">Risk Level<InfoTooltip term="risk_level" /></span>
                        <span className={`font-medium px-2 py-0.5 rounded ${
                          profile.risk_assessment.risk_level === 'high' ? 'bg-red-100 text-red-700' :
                          profile.risk_assessment.risk_level === 'medium' ? 'bg-yellow-100 text-yellow-700' :
                          'bg-green-100 text-green-700'
                        }`}>
                          {profile.risk_assessment.risk_level.toUpperCase()}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500 flex items-center">Escalations<InfoTooltip term="escalations" /></span>
                        <span className="font-medium">{profile.risk_assessment.escalation_history}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500 flex items-center">Deactivation Mentions<InfoTooltip term="deactivation_mentions" /></span>
                        <span className="font-medium">{profile.risk_assessment.deactivation_mentions}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500 flex items-center">Payment Disputes<InfoTooltip term="payment_disputes" /></span>
                        <span className="font-medium">{profile.risk_assessment.payment_disputes}</span>
                      </div>
                    </div>
                  </div>

                  {/* Engagement Metrics */}
                  <div className="bg-white rounded-lg border p-4">
                    <h3 className="font-semibold mb-3 flex items-center gap-2">
                      <Calendar className="h-4 w-4" />
                      Engagement
                      <InfoTooltip term="engagement" />
                    </h3>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-500 flex items-center">Last Contact<InfoTooltip term="last_contact" /></span>
                        <span className="font-medium">
                          {profile.engagement_metrics.days_since_last_call} days ago
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500 flex items-center">Calls/Month<InfoTooltip term="calls_per_month" /></span>
                        <span className="font-medium">{profile.engagement_metrics.avg_calls_per_month}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500 flex items-center">Frequency Trend<InfoTooltip term="frequency_trend" /></span>
                        <span className="font-medium flex items-center gap-1">
                          {getTrendIcon(profile.engagement_metrics.call_frequency_trend)}
                          {profile.engagement_metrics.call_frequency_trend}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500">Date Range</span>
                        <span className="font-medium text-xs">
                          {formatDate(profile.date_range.first_call)} - {formatDate(profile.date_range.latest_call)}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Behavioral Insights Section */}
                {(profile.behavioral_profile || profile.behavioral_insights) && (
                  <div className="bg-gradient-to-r from-purple-50 to-indigo-50 rounded-lg border border-purple-100 p-4">
                    <h3 className="font-semibold mb-4 flex items-center gap-2 text-purple-800">
                      <User className="h-5 w-5" />
                      Seller Behavioral Profile
                      <InfoTooltip term="behavioral_profile" />
                    </h3>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                      {/* Service Tier */}
                      {profile.behavioral_insights?.service_tier && (
                        <div className="bg-white rounded-lg p-3 shadow-sm">
                          <div className="flex items-center gap-2 text-gray-600 mb-1">
                            <Award className="h-4 w-4 text-purple-500" />
                            <span className="text-xs">Service Tier</span>
                            <InfoTooltip term="service_tier" />
                          </div>
                          <p className="font-semibold text-sm text-purple-700 truncate" title={profile.behavioral_insights.service_tier}>
                            {profile.behavioral_insights.service_tier}
                          </p>
                        </div>
                      )}

                      {/* Tenure Status */}
                      <div className="bg-white rounded-lg p-3 shadow-sm">
                        <div className="flex items-center gap-2 text-gray-600 mb-1">
                          <Calendar className="h-4 w-4 text-blue-500" />
                          <span className="text-xs">Tenure</span>
                          <InfoTooltip term="vintage" />
                        </div>
                        <p className="font-semibold text-sm capitalize">
                          {profile.behavioral_insights?.tenure_status !== 'unknown' ? (
                            <>
                              {profile.behavioral_insights?.tenure_status}
                              {profile.behavioral_profile?.vintage_months && (
                                <span className="text-gray-500 font-normal ml-1">
                                  ({profile.behavioral_profile.vintage_months} mo)
                                </span>
                              )}
                            </>
                          ) : (
                            <span className="text-gray-400">N/A</span>
                          )}
                        </p>
                      </div>

                      {/* PNS Health */}
                      <div className="bg-white rounded-lg p-3 shadow-sm">
                        <div className="flex items-center gap-2 text-gray-600 mb-1">
                          <Phone className="h-4 w-4 text-green-500" />
                          <span className="text-xs">PNS Response</span>
                          <InfoTooltip term="pns_health" />
                        </div>
                        <p className={`font-semibold text-sm capitalize ${
                          profile.behavioral_insights?.pns_health === 'good' ? 'text-green-600' :
                          profile.behavioral_insights?.pns_health === 'moderate' ? 'text-yellow-600' :
                          profile.behavioral_insights?.pns_health === 'poor' ? 'text-red-600' : 'text-gray-500'
                        }`}>
                          {profile.behavioral_insights?.pns_health !== 'unknown' ? (
                            <>
                              {profile.behavioral_insights?.pns_health}
                              {profile.behavioral_profile?.pns_response_rate !== null &&
                               profile.behavioral_profile?.pns_response_rate !== undefined && (
                                <span className="text-gray-500 font-normal ml-1">
                                  ({Math.round(profile.behavioral_profile.pns_response_rate * 100)}%)
                                </span>
                              )}
                            </>
                          ) : (
                            '0 calls'
                          )}
                        </p>
                        {profile.behavioral_insights?.pns_health === 'unknown' && (
                          <p className="text-[10px] text-gray-400 mt-0.5">No PNS calls received yet</p>
                        )}
                      </div>

                      {/* Lead Engagement */}
                      <div className="bg-white rounded-lg p-3 shadow-sm">
                        <div className="flex items-center gap-2 text-gray-600 mb-1">
                          <ShoppingBag className="h-4 w-4 text-orange-500" />
                          <span className="text-xs">Lead Engagement</span>
                          <InfoTooltip term="lead_engagement" />
                        </div>
                        <p className={`font-semibold text-sm capitalize ${
                          profile.behavioral_insights?.lead_engagement === 'active' ? 'text-green-600' :
                          profile.behavioral_insights?.lead_engagement === 'moderate' ? 'text-yellow-600' :
                          profile.behavioral_insights?.lead_engagement === 'inactive' ? 'text-red-600' : 'text-gray-400'
                        }`}>
                          {profile.behavioral_insights?.lead_engagement !== 'unknown'
                            ? profile.behavioral_insights?.lead_engagement
                            : 'N/A'}
                        </p>
                      </div>

                      {/* CQS Trend */}
                      <div className="bg-white rounded-lg p-3 shadow-sm">
                        <div className="flex items-center gap-2 text-gray-600 mb-1">
                          <BarChart3 className="h-4 w-4 text-indigo-500" />
                          <span className="text-xs">CQS Trend</span>
                          <InfoTooltip term="cqs_score" />
                        </div>
                        <p className="font-semibold text-sm flex items-center gap-1">
                          {profile.behavioral_insights?.cqs_trend !== 'unknown' ? (
                            <>
                              {getTrendIcon(profile.behavioral_insights?.cqs_trend || 'stable')}
                              <span className="capitalize">{profile.behavioral_insights?.cqs_trend}</span>
                            </>
                          ) : (
                            <span className="text-gray-400">N/A</span>
                          )}
                        </p>
                      </div>

                      {/* Prior Tickets (multiple tickets in 30/60 days) */}
                      <div className="bg-white rounded-lg p-3 shadow-sm">
                        <div className="flex items-center gap-2 text-gray-600 mb-1">
                          <Repeat className="h-4 w-4 text-cyan-500" />
                          <span className="text-xs">Prior Tickets</span>
                        </div>
                        <p className={`font-semibold text-sm ${
                          profile.behavioral_insights?.has_prior_tickets ? 'text-orange-600' : 'text-green-600'
                        }`}>
                          {profile.behavioral_insights?.has_prior_tickets ? 'Yes (30/60d)' : 'No'}
                        </p>
                        {profile.behavioral_insights?.has_prior_tickets && (
                          <p className="text-[10px] text-gray-500 mt-0.5">Multiple tickets recently</p>
                        )}
                      </div>

                      {/* ROI Risk - based on PNS defaulter count */}
                      <div className="bg-white rounded-lg p-3 shadow-sm">
                        <div className="flex items-center gap-2 text-gray-600 mb-1">
                          <Target className="h-4 w-4 text-red-500" />
                          <span className="text-xs">ROI Risk</span>
                        </div>
                        <p className={`font-semibold text-sm capitalize ${
                          profile.behavioral_insights?.roi_risk === 'low' ? 'text-green-600' :
                          profile.behavioral_insights?.roi_risk === 'moderate' ? 'text-yellow-600' :
                          profile.behavioral_insights?.roi_risk === 'high' ? 'text-red-600' : 'text-gray-400'
                        }`}>
                          {profile.behavioral_insights?.roi_risk !== 'unknown'
                            ? profile.behavioral_insights?.roi_risk
                            : 'N/A'}
                        </p>
                        {profile.behavioral_insights?.roi_risk === 'high' && (
                          <p className="text-[10px] text-red-500 mt-0.5">Not responding to buyer calls</p>
                        )}
                      </div>

                      {/* Category Visibility */}
                      <div className="bg-white rounded-lg p-3 shadow-sm">
                        <div className="flex items-center gap-2 text-gray-600 mb-1">
                          <BarChart3 className="h-4 w-4 text-purple-500" />
                          <span className="text-xs">Category Visibility</span>
                        </div>
                        <p className={`font-semibold text-sm capitalize ${
                          profile.behavioral_insights?.category_visibility === 'good' ? 'text-green-600' :
                          profile.behavioral_insights?.category_visibility === 'moderate' ? 'text-yellow-600' :
                          profile.behavioral_insights?.category_visibility === 'poor' ? 'text-red-600' : 'text-gray-400'
                        }`}>
                          {profile.behavioral_insights?.category_visibility !== 'unknown'
                            ? profile.behavioral_insights?.category_visibility
                            : 'N/A'}
                        </p>
                        {profile.behavioral_insights?.category_visibility === 'poor' && (
                          <p className="text-[10px] text-red-500 mt-0.5">Low BuyLead flow in categories</p>
                        )}
                      </div>

                      {/* Product Issues */}
                      <div className="bg-white rounded-lg p-3 shadow-sm">
                        <div className="flex items-center gap-2 text-gray-600 mb-1">
                          <AlertTriangle className="h-4 w-4 text-orange-500" />
                          <span className="text-xs">Product Issues</span>
                        </div>
                        <p className={`font-semibold text-sm capitalize ${
                          profile.behavioral_insights?.product_issues === 'none' ? 'text-green-600' :
                          profile.behavioral_insights?.product_issues === 'some' ? 'text-yellow-600' :
                          profile.behavioral_insights?.product_issues === 'many' ? 'text-red-600' : 'text-gray-400'
                        }`}>
                          {profile.behavioral_insights?.product_issues !== 'unknown'
                            ? profile.behavioral_insights?.product_issues
                            : 'N/A'}
                        </p>
                        {profile.behavioral_insights?.product_issues === 'many' && (
                          <p className="text-[10px] text-red-500 mt-0.5">Wrong product complaints</p>
                        )}
                      </div>

                      {/* Location Preference */}
                      {profile.behavioral_profile?.location_preference && (
                        <div className="bg-white rounded-lg p-3 shadow-sm">
                          <div className="flex items-center gap-2 text-gray-600 mb-1">
                            <Target className="h-4 w-4 text-pink-500" />
                            <span className="text-xs">Location Pref.</span>
                          </div>
                          <p className="font-semibold text-sm">
                            {profile.behavioral_profile.location_preference}
                          </p>
                        </div>
                      )}

                      {/* Category Count */}
                      {profile.behavioral_profile?.category_count && (
                        <div className="bg-white rounded-lg p-3 shadow-sm">
                          <div className="flex items-center gap-2 text-gray-600 mb-1">
                            <ShoppingBag className="h-4 w-4 text-teal-500" />
                            <span className="text-xs">Categories</span>
                          </div>
                          <p className="font-semibold text-sm">
                            {profile.behavioral_profile.category_count} active
                          </p>
                        </div>
                      )}
                    </div>

                    {/* Top Categories */}
                    {profile.top_categories && profile.top_categories.length > 0 && (
                      <div className="mt-4 pt-4 border-t border-purple-100">
                        <p className="text-xs text-gray-500 mb-2">Top Categories:</p>
                        <div className="flex flex-wrap gap-2">
                          {profile.top_categories.map((cat, idx) => (
                            <span
                              key={idx}
                              className="px-2 py-1 bg-white border border-purple-200 text-purple-700 rounded text-xs"
                            >
                              {cat.mcat_name}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Monthly Metrics Comparison */}
                    {profile.monthly_metrics && profile.monthly_metrics.length > 0 && (
                      <div className="mt-4 pt-4 border-t border-purple-100">
                        <p className="text-xs text-gray-500 mb-2">Monthly Performance:</p>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                          {profile.monthly_metrics.map((metric, idx) => (
                            <div key={idx} className="bg-white rounded p-2 text-xs">
                              <p className="font-medium text-gray-700 mb-1">{metric.data_month} '25</p>
                              <div className="space-y-0.5 text-gray-600">
                                <div className="flex justify-between">
                                  <span>CQS:</span>
                                  <span className="font-medium">{metric.cqs_score ?? 'N/A'}</span>
                                </div>
                                <div className="flex justify-between">
                                  <span>Fresh Leads:</span>
                                  <span className="font-medium">{metric.fresh_lead_consumption}</span>
                                </div>
                                <div className="flex justify-between">
                                  <span>PNS Default:</span>
                                  <span className={`font-medium ${metric.pns_defaulter_count > 0 ? 'text-red-600' : ''}`}>
                                    {metric.pns_defaulter_count}
                                  </span>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Call Timeline */}
                <div>
                  <h3 className="font-semibold mb-4 flex items-center gap-2">
                    <Clock className="h-4 w-4" />
                    Call Timeline ({profile.call_timeline.length} calls)
                    <InfoTooltip term="call_timeline" />
                  </h3>
                  <div className="space-y-2">
                    {profile.call_timeline.map((call) => (
                      <CallTimelineItem
                        key={call.call_id}
                        call={call}
                        isExpanded={expandedCalls.has(call.call_id)}
                        onToggle={() => toggleCallExpansion(call.call_id)}
                      />
                    ))}
                  </div>
                </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
