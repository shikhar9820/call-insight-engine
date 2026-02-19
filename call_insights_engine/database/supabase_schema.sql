-- ============================================================================
-- CALL INSIGHTS ENGINE - Supabase Database Schema
-- ============================================================================
-- This schema stores call recordings, transcripts, and analytics data
-- for the IndiaMART Call Insights Dashboard
-- ============================================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- TABLE 1: calls (Main call records)
-- ============================================================================
CREATE TABLE calls (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- External IDs (from existing system)
    external_call_id VARCHAR(50),           -- CLICK_TO_CALL_ID from Oracle
    ucid VARCHAR(50) UNIQUE NOT NULL,       -- Unique call identifier

    -- Call metadata
    call_recording_url TEXT,
    call_duration_seconds INTEGER,
    call_start_time TIMESTAMPTZ,
    call_end_time TIMESTAMPTZ,

    -- Participants
    employee_id VARCHAR(50),
    employee_name VARCHAR(100),
    employee_mobile VARCHAR(20),
    customer_mobile VARCHAR(20),

    -- Business context
    company_id VARCHAR(50),
    company_name VARCHAR(200),
    module VARCHAR(50),                      -- CSD, Sales, etc.
    vertical_id VARCHAR(50),
    vertical_name VARCHAR(100),

    -- Call direction & type
    call_direction VARCHAR(10),              -- inbound/outbound
    call_type VARCHAR(20),                   -- support/sales/followup

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_calls_ucid ON calls(ucid);
CREATE INDEX idx_calls_employee ON calls(employee_id);
CREATE INDEX idx_calls_company ON calls(company_id);
CREATE INDEX idx_calls_start_time ON calls(call_start_time DESC);
CREATE INDEX idx_calls_module ON calls(module);

-- ============================================================================
-- TABLE 2: call_transcripts (Transcription & Translation)
-- ============================================================================
CREATE TABLE call_transcripts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    call_id UUID NOT NULL REFERENCES calls(id) ON DELETE CASCADE,

    -- Transcription
    transcript TEXT,                         -- Roman script transcript
    transcript_language VARCHAR(10),         -- Primary language detected
    languages_detected JSONB,                -- Array of languages

    -- Translation
    translation TEXT,                        -- English translation

    -- Audio analysis
    audio_quality VARCHAR(20),               -- good/fair/poor
    speaker_count INTEGER DEFAULT 2,
    has_ivr_intro BOOLEAN DEFAULT FALSE,

    -- Processing metadata
    model_used VARCHAR(50),                  -- gemini-2.0-flash-001
    processing_duration_ms INTEGER,
    confidence_score DECIMAL(3,2),

    -- Timestamps
    processed_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_transcripts_call ON call_transcripts(call_id);
CREATE INDEX idx_transcripts_processed ON call_transcripts(processed_at DESC);

-- ============================================================================
-- TABLE 3: call_insights (Analytics & Risk Signals)
-- ============================================================================
CREATE TABLE call_insights (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    call_id UUID NOT NULL REFERENCES calls(id) ON DELETE CASCADE,
    transcript_id UUID REFERENCES call_transcripts(id),

    -- ========== RISK SIGNALS ==========
    churn_risk_score DECIMAL(3,2),           -- 0.00 to 1.00
    deactivation_intent BOOLEAN DEFAULT FALSE,
    deactivation_confirmed BOOLEAN DEFAULT FALSE,
    refund_requested BOOLEAN DEFAULT FALSE,
    escalation_threatened BOOLEAN DEFAULT FALSE,
    legal_threat BOOLEAN DEFAULT FALSE,
    payment_dispute BOOLEAN DEFAULT FALSE,
    competitor_mentioned VARCHAR(100),

    -- ========== SENTIMENT ==========
    sentiment_start VARCHAR(20),             -- happy/satisfied/neutral/confused/frustrated/angry
    sentiment_end VARCHAR(20),
    sentiment_trajectory VARCHAR(30),        -- positive_to_negative, negative_to_neutral, etc.
    executive_tone VARCHAR(20),              -- professional/empathetic/defensive/rushed

    -- ========== CALL OUTCOME ==========
    call_purpose VARCHAR(20),                -- complaint/query/request/feedback
    purpose_fulfilled BOOLEAN,
    customer_satisfied VARCHAR(10),          -- true/false/unclear
    requires_escalation BOOLEAN DEFAULT FALSE,

    -- ========== RESOLUTION ==========
    resolution_status VARCHAR(20),           -- resolved/partial/unresolved
    follow_up_required BOOLEAN DEFAULT FALSE,
    follow_up_owner VARCHAR(20),             -- executive/customer/none
    follow_up_timeline VARCHAR(50),

    -- ========== JSON FIELDS ==========
    issues JSONB,                            -- Array of issue objects
    actions_taken JSONB,                     -- Array of actions
    promises_made JSONB,                     -- Array of promises
    key_quotes JSONB,                        -- Object with main_complaint, customer_ask, etc.
    topics JSONB,                            -- Array of topic strings

    -- ========== METADATA ==========
    raw_summary JSONB,                       -- Complete raw JSON from summarizer
    model_used VARCHAR(50),
    processed_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for dashboard queries
CREATE INDEX idx_insights_call ON call_insights(call_id);
CREATE INDEX idx_insights_churn_risk ON call_insights(churn_risk_score DESC);
CREATE INDEX idx_insights_deactivation ON call_insights(deactivation_intent) WHERE deactivation_intent = TRUE;
CREATE INDEX idx_insights_escalation ON call_insights(requires_escalation) WHERE requires_escalation = TRUE;
CREATE INDEX idx_insights_sentiment ON call_insights(sentiment_trajectory);
CREATE INDEX idx_insights_purpose ON call_insights(call_purpose);
CREATE INDEX idx_insights_resolution ON call_insights(resolution_status);
CREATE INDEX idx_insights_processed ON call_insights(processed_at DESC);

-- GIN index for JSONB searches
CREATE INDEX idx_insights_issues ON call_insights USING GIN(issues);
CREATE INDEX idx_insights_topics ON call_insights USING GIN(topics);

-- ============================================================================
-- TABLE 4: call_issues (Normalized issues for analytics)
-- ============================================================================
CREATE TABLE call_issues (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    call_id UUID NOT NULL REFERENCES calls(id) ON DELETE CASCADE,
    insight_id UUID NOT NULL REFERENCES call_insights(id) ON DELETE CASCADE,

    -- Issue details
    category VARCHAR(30) NOT NULL,           -- buylead_quality, payment, subscription, spam, profile, technical, onboarding, other
    subcategory VARCHAR(50),                 -- spam_leads, irrelevant_leads, fake_leads, etc.
    description TEXT,
    severity VARCHAR(10),                    -- critical/high/medium/low
    mentioned_by VARCHAR(20),                -- customer/executive
    timestamp_location VARCHAR(10),          -- start/middle/end

    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_issues_call ON call_issues(call_id);
CREATE INDEX idx_issues_category ON call_issues(category);
CREATE INDEX idx_issues_severity ON call_issues(severity);
CREATE INDEX idx_issues_subcategory ON call_issues(subcategory);

-- ============================================================================
-- TABLE 5: processing_queue (Batch processing tracker)
-- ============================================================================
CREATE TABLE processing_queue (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- Call reference
    call_id UUID REFERENCES calls(id),
    ucid VARCHAR(50),
    audio_url TEXT NOT NULL,

    -- Processing status
    status VARCHAR(20) DEFAULT 'pending',    -- pending/processing/completed/failed
    attempts INTEGER DEFAULT 0,
    max_attempts INTEGER DEFAULT 3,

    -- Error tracking
    error_message TEXT,
    last_error_at TIMESTAMPTZ,

    -- Timestamps
    queued_at TIMESTAMPTZ DEFAULT NOW(),
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,

    -- Priority (lower = higher priority)
    priority INTEGER DEFAULT 100
);

-- Indexes
CREATE INDEX idx_queue_status ON processing_queue(status);
CREATE INDEX idx_queue_priority ON processing_queue(priority, queued_at);

-- ============================================================================
-- TABLE 6: analytics_daily (Pre-aggregated daily stats)
-- ============================================================================
CREATE TABLE analytics_daily (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    date DATE NOT NULL UNIQUE,

    -- Volume metrics
    total_calls INTEGER DEFAULT 0,
    total_duration_minutes INTEGER DEFAULT 0,
    avg_duration_seconds DECIMAL(10,2),

    -- Risk metrics
    high_risk_calls INTEGER DEFAULT 0,       -- churn_risk > 0.7
    medium_risk_calls INTEGER DEFAULT 0,     -- churn_risk 0.4-0.7
    low_risk_calls INTEGER DEFAULT 0,        -- churn_risk < 0.4
    avg_churn_risk DECIMAL(3,2),

    -- Deactivation metrics
    deactivation_intents INTEGER DEFAULT 0,
    deactivation_confirmed INTEGER DEFAULT 0,

    -- Resolution metrics
    resolved_calls INTEGER DEFAULT 0,
    partial_resolution INTEGER DEFAULT 0,
    unresolved_calls INTEGER DEFAULT 0,
    resolution_rate DECIMAL(5,2),

    -- Sentiment metrics
    positive_sentiment INTEGER DEFAULT 0,
    neutral_sentiment INTEGER DEFAULT 0,
    negative_sentiment INTEGER DEFAULT 0,

    -- Issue counts by category
    issues_buylead_quality INTEGER DEFAULT 0,
    issues_payment INTEGER DEFAULT 0,
    issues_subscription INTEGER DEFAULT 0,
    issues_spam INTEGER DEFAULT 0,
    issues_profile INTEGER DEFAULT 0,
    issues_technical INTEGER DEFAULT 0,
    issues_onboarding INTEGER DEFAULT 0,
    issues_other INTEGER DEFAULT 0,

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index
CREATE INDEX idx_analytics_date ON analytics_daily(date DESC);

-- ============================================================================
-- VIEWS for Dashboard
-- ============================================================================

-- View: High Risk Calls (for alerts)
CREATE VIEW high_risk_calls AS
SELECT
    c.id,
    c.ucid,
    c.call_start_time,
    c.employee_name,
    c.company_name,
    c.customer_mobile,
    i.churn_risk_score,
    i.deactivation_intent,
    i.deactivation_confirmed,
    i.sentiment_trajectory,
    i.call_purpose,
    i.resolution_status,
    i.key_quotes->>'main_complaint' as main_complaint
FROM calls c
JOIN call_insights i ON c.id = i.call_id
WHERE i.churn_risk_score >= 0.7
   OR i.deactivation_intent = TRUE
   OR i.escalation_threatened = TRUE
ORDER BY i.churn_risk_score DESC, c.call_start_time DESC;

-- View: Issue Summary
CREATE VIEW issue_summary AS
SELECT
    category,
    subcategory,
    COUNT(*) as count,
    COUNT(DISTINCT call_id) as unique_calls
FROM call_issues
GROUP BY category, subcategory
ORDER BY count DESC;

-- View: Daily Trends
CREATE VIEW daily_trends AS
SELECT
    DATE(c.call_start_time) as call_date,
    COUNT(*) as total_calls,
    AVG(i.churn_risk_score) as avg_churn_risk,
    SUM(CASE WHEN i.churn_risk_score >= 0.7 THEN 1 ELSE 0 END) as high_risk_count,
    SUM(CASE WHEN i.deactivation_intent THEN 1 ELSE 0 END) as deactivation_intents,
    SUM(CASE WHEN i.resolution_status = 'resolved' THEN 1 ELSE 0 END) as resolved_count
FROM calls c
JOIN call_insights i ON c.id = i.call_id
WHERE c.call_start_time IS NOT NULL
GROUP BY DATE(c.call_start_time)
ORDER BY call_date DESC;

-- ============================================================================
-- FUNCTIONS
-- ============================================================================

-- Function: Update analytics_daily after new insights
CREATE OR REPLACE FUNCTION update_daily_analytics(target_date DATE)
RETURNS VOID AS $$
BEGIN
    INSERT INTO analytics_daily (date, total_calls, avg_churn_risk, high_risk_calls,
                                  medium_risk_calls, low_risk_calls, resolved_calls,
                                  partial_resolution, unresolved_calls)
    SELECT
        target_date,
        COUNT(*),
        AVG(i.churn_risk_score),
        SUM(CASE WHEN i.churn_risk_score >= 0.7 THEN 1 ELSE 0 END),
        SUM(CASE WHEN i.churn_risk_score >= 0.4 AND i.churn_risk_score < 0.7 THEN 1 ELSE 0 END),
        SUM(CASE WHEN i.churn_risk_score < 0.4 THEN 1 ELSE 0 END),
        SUM(CASE WHEN i.resolution_status = 'resolved' THEN 1 ELSE 0 END),
        SUM(CASE WHEN i.resolution_status = 'partial' THEN 1 ELSE 0 END),
        SUM(CASE WHEN i.resolution_status = 'unresolved' THEN 1 ELSE 0 END)
    FROM calls c
    JOIN call_insights i ON c.id = i.call_id
    WHERE DATE(c.call_start_time) = target_date
    ON CONFLICT (date) DO UPDATE SET
        total_calls = EXCLUDED.total_calls,
        avg_churn_risk = EXCLUDED.avg_churn_risk,
        high_risk_calls = EXCLUDED.high_risk_calls,
        medium_risk_calls = EXCLUDED.medium_risk_calls,
        low_risk_calls = EXCLUDED.low_risk_calls,
        resolved_calls = EXCLUDED.resolved_calls,
        partial_resolution = EXCLUDED.partial_resolution,
        unresolved_calls = EXCLUDED.unresolved_calls,
        updated_at = NOW();
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- ROW LEVEL SECURITY (Optional - for multi-tenant access)
-- ============================================================================
-- Uncomment if you need to restrict access by user/role

-- ALTER TABLE calls ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE call_transcripts ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE call_insights ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE call_issues ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- SAMPLE DATA INSERT (for testing)
-- ============================================================================
-- Run this after creating tables to test the schema

-- INSERT INTO calls (ucid, call_recording_url, call_duration_seconds, employee_name, company_name, module)
-- VALUES ('test-001', 'https://example.com/audio.mp3', 300, 'Test Executive', 'Test Company', 'CSD');
