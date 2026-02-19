import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Types for our database
export interface Call {
  id: string
  ucid: string
  call_recording_url: string
  call_duration_seconds: number | null
  call_start_time: string | null
  employee_id: string | null
  employee_name: string | null
  employee_mobile: string | null
  customer_mobile: string | null
  company_id: string | null
  company_name: string | null
  module: string | null
  vertical_id: string | null
  call_direction: string | null
  call_type: string | null
  created_at: string
}

export interface CallInsight {
  id: string
  call_id: string
  churn_risk_score: number | null
  deactivation_intent: boolean
  deactivation_confirmed: boolean
  refund_requested: boolean
  escalation_threatened: boolean
  legal_threat: boolean
  payment_dispute: boolean
  competitor_mentioned: string | null
  sentiment_start: string | null
  sentiment_end: string | null
  sentiment_trajectory: string | null
  executive_tone: string | null
  call_purpose: string | null
  purpose_fulfilled: boolean | null
  customer_satisfied: string | null
  requires_escalation: boolean
  resolution_status: string | null
  follow_up_required: boolean
  follow_up_owner: string | null
  issues: any[]
  actions_taken: string[]
  promises_made: string[]
  key_quotes: any
  topics: string[]
  created_at: string
}

export interface CallWithInsight extends Call {
  call_insights: CallInsight[]
}

export interface OverviewStats {
  total_calls: number
  processed_calls: number
  high_risk_calls: number
  deactivation_intents: number
  resolved_calls: number
  resolution_rate: number
  avg_churn_risk: number
}

export interface DailyStats {
  date: string
  total_calls: number
  high_risk_calls: number
  avg_churn_risk: number
  deactivation_intents: number
  resolved_calls: number
}
