-- Create tables for seller behavioral data
-- Run this in Supabase SQL Editor

-- 1. SELLER PROFILES (Master)
CREATE TABLE IF NOT EXISTS seller_profiles (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    glid TEXT UNIQUE NOT NULL,
    ticket_id TEXT,
    vintage_months INTEGER,
    highest_service TEXT,
    bl_active_days INTEGER,
    pns_calls_received INTEGER,
    pns_calls_answered INTEGER,
    location_preference TEXT,
    pns_response_rate DECIMAL,
    category_rank INTEGER,
    category_count INTEGER,
    repeat_30d TEXT,
    repeat_60d TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. SELLER MONTHLY METRICS
CREATE TABLE IF NOT EXISTS seller_monthly_metrics (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    glid TEXT NOT NULL,
    data_month TEXT NOT NULL,
    pns_defaulter_count INTEGER DEFAULT 0,
    fresh_lead_consumption INTEGER DEFAULT 0,
    bl_not_identified_spec INTEGER DEFAULT 0,
    wrong_product_count INTEGER DEFAULT 0,
    assisted_buy_enquiry INTEGER DEFAULT 0,
    cqs_score INTEGER,
    ba_rank INTEGER,
    cc_rank INTEGER,
    super_pmcats_primary INTEGER DEFAULT 0,
    negative_cities_count INTEGER DEFAULT 0,
    pref_district INTEGER DEFAULT 0,
    pref_city INTEGER DEFAULT 0,
    pref_state INTEGER DEFAULT 0,
    pref_country INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(glid, data_month)
);

-- 3. SELLER CATEGORIES (Top MCATs)
CREATE TABLE IF NOT EXISTS seller_categories (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    glid TEXT NOT NULL,
    mcat_id INTEGER,
    mcat_name TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(glid, mcat_id)
);

-- Create indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_seller_profiles_glid ON seller_profiles(glid);
CREATE INDEX IF NOT EXISTS idx_seller_monthly_metrics_glid ON seller_monthly_metrics(glid);
CREATE INDEX IF NOT EXISTS idx_seller_monthly_metrics_month ON seller_monthly_metrics(data_month);
CREATE INDEX IF NOT EXISTS idx_seller_categories_glid ON seller_categories(glid);

-- Enable Row Level Security (RLS) - optional, adjust as needed
-- ALTER TABLE seller_profiles ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE seller_monthly_metrics ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE seller_categories ENABLE ROW LEVEL SECURITY;

-- Create policies for public access (adjust as needed)
-- CREATE POLICY "Allow public read" ON seller_profiles FOR SELECT USING (true);
-- CREATE POLICY "Allow public read" ON seller_monthly_metrics FOR SELECT USING (true);
-- CREATE POLICY "Allow public read" ON seller_categories FOR SELECT USING (true);
