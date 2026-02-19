'use client'

import { ReactNode, useState } from 'react'
import { HelpCircle } from 'lucide-react'

interface TooltipProps {
  content: string
  children?: ReactNode
  position?: 'top' | 'bottom' | 'left' | 'right'
  showIcon?: boolean
  iconSize?: number
}

export default function Tooltip({
  content,
  children,
  position = 'top',
  showIcon = true,
  iconSize = 14
}: TooltipProps) {
  const [isVisible, setIsVisible] = useState(false)

  const positionClasses = {
    top: 'bottom-full left-1/2 -translate-x-1/2 mb-2',
    bottom: 'top-full left-1/2 -translate-x-1/2 mt-2',
    left: 'right-full top-1/2 -translate-y-1/2 mr-2',
    right: 'left-full top-1/2 -translate-y-1/2 ml-2'
  }

  const arrowClasses = {
    top: 'top-full left-1/2 -translate-x-1/2 border-t-gray-900 border-l-transparent border-r-transparent border-b-transparent',
    bottom: 'bottom-full left-1/2 -translate-x-1/2 border-b-gray-900 border-l-transparent border-r-transparent border-t-transparent',
    left: 'left-full top-1/2 -translate-y-1/2 border-l-gray-900 border-t-transparent border-b-transparent border-r-transparent',
    right: 'right-full top-1/2 -translate-y-1/2 border-r-gray-900 border-t-transparent border-b-transparent border-l-transparent'
  }

  return (
    <div
      className="relative inline-flex items-center"
      onMouseEnter={() => setIsVisible(true)}
      onMouseLeave={() => setIsVisible(false)}
    >
      {children}
      {showIcon && (
        <HelpCircle
          className="ml-1 text-gray-400 hover:text-gray-600 cursor-help transition-colors"
          size={iconSize}
        />
      )}

      {isVisible && (
        <div
          className={`absolute z-50 ${positionClasses[position]} pointer-events-none`}
        >
          <div className="bg-gray-900 text-white text-xs rounded-lg py-2 px-3 shadow-lg max-w-xs whitespace-normal">
            {content}
            <div
              className={`absolute w-0 h-0 border-4 ${arrowClasses[position]}`}
            />
          </div>
        </div>
      )}
    </div>
  )
}

// Metric definitions for the dashboard
export const METRIC_DEFINITIONS = {
  // Overview Stats
  totalCalls: "Total number of customer calls recorded and available for analysis in the system.",
  processedCalls: "Calls that have been analyzed by the AI engine to extract insights, sentiment, and risk scores.",
  highRiskCalls: "Calls where the customer's churn risk score is 70% or higher, indicating high probability of account deactivation.",
  deactivationIntents: "Calls where the customer explicitly expressed desire or intention to deactivate their account or stop using the service.",
  resolutionRate: "Percentage of calls where the customer's issue was successfully resolved during the conversation.",
  resolvedCalls: "Number of calls marked as 'resolved' based on call outcome analysis.",
  avgChurnRisk: "Average churn probability across all analyzed calls (0-100%). Higher values indicate greater customer dissatisfaction.",

  // Risk Signals
  deactivationIntent: "Customer verbally expressed they want to deactivate or cancel their subscription.",
  deactivationConfirmed: "Customer confirmed their decision to deactivate after discussion with the executive.",
  legalThreat: "Customer mentioned taking legal action, filing complaints with authorities, or involving lawyers.",
  escalationThreatened: "Customer threatened to escalate the issue to senior management, social media, or consumer forums.",
  refundRequested: "Customer explicitly asked for a refund of their payment or subscription fees.",
  paymentDispute: "Issues related to billing, unauthorized charges, payment failures, or invoice discrepancies.",
  competitorMentioned: "Customer referenced competitor platforms (JustDial, TradeIndia, etc.) during the conversation.",

  // Pattern Analysis
  totalIssues: "Total count of distinct issues/complaints identified across all analyzed calls.",
  criticalIssues: "Issues marked as 'critical' severity that require immediate attention and resolution.",
  followUpsPending: "Calls that require follow-up action but haven't been addressed yet.",

  // Industry Analysis
  industries: "Number of unique product categories (MCATs) identified from the seller database.",
  mappedCalls: "Calls successfully linked to a seller's industry category using GLID-MCAT mapping.",
  riskRate: "Percentage of calls in this segment that are classified as high-risk (churn score >= 70%).",
  tierDistribution: "Breakdown of calls by city tier - Tier 1 (metros), Tier 2 (mid-size), Tier 3 (small towns).",

  // City Tiers
  tier1: "Major metropolitan cities: Mumbai, Delhi, Bangalore, Hyderabad, Chennai, Kolkata, Pune, Ahmedabad.",
  tier2: "Mid-sized cities with population 1-4 million: Jaipur, Lucknow, Indore, Nagpur, etc.",
  tier3: "Smaller towns and cities not classified as Tier 1 or Tier 2.",

  // Issue Categories
  buyLeadRelevance: "Complaints about receiving leads that don't match the seller's product/service category.",
  buyLeadAvailability: "Issues with insufficient number of leads or no leads being received.",
  buyLeadROI: "Concerns about poor return on investment - leads not converting to sales.",
  payment: "Problems with payment processing, billing cycles, or transaction failures.",
  subscription: "Questions or complaints about subscription plans, renewals, or plan features.",
  deactivation: "Requests or discussions about account deactivation process.",
  technical: "Technical issues with the platform, app, or website functionality.",
  catalog: "Problems with product listings, catalog management, or visibility.",

  // Resolution Status
  resolved: "Issue was completely addressed and customer confirmed satisfaction.",
  partial: "Issue was partially addressed; some aspects remain unresolved.",
  unresolved: "Issue could not be resolved during the call; requires further action.",
  purposeFulfilled: "Whether the customer's original reason for calling was successfully addressed."
}
