# Call Insights Engine - Formula Documentation

## Overview

This document contains all formulas and calculations used across the Call Insights Engine, including both Python backend processing and TypeScript dashboard calculations.

---

## 1. CHURN RISK SCORE

### 1.1 Gemini AI Churn Score
Primary source of churn risk prediction from transcript analysis (0.0 - 1.0 scale).

### 1.2 Rule-Based Fallback Calculation
Used when Gemini's score is missing, invalid, or inconsistent with signals.

```
BASE SCORE = 0.1

SIGNAL ADJUSTMENTS:
+ Deactivation Intent:     +0.35
+ Deactivation Confirmed:  +0.25
+ Legal Threat:            +0.20
+ Refund Requested:        +0.15
+ Payment Dispute:         +0.15
+ Escalation Threatened:   +0.10
+ Competitor Mentioned:    +0.10

SENTIMENT ADJUSTMENT:
+ Customer End = 'angry' or 'frustrated':  +0.10
+ Customer End = 'satisfied' or 'happy':   -0.05

FINAL = clamp(0.0, 1.0, rule_score)
```

### 1.3 Validation Rules (Triggers Fallback)
```
USE FALLBACK IF:
1. score_missing:                Gemini score is null
2. score_not_numeric:            Score is not int/float
3. score_out_of_range:           Score < 0 or > 1
4. deactivation_intent_mismatch: deactivation_intent=true AND score < 0.5
5. deactivation_confirmed_mismatch: deactivation_confirmed=true AND score < 0.6
6. legal_threat_mismatch:        legal_threat=true AND score < 0.6
```

---

## 2. HEALTH SCORES

### 2.1 Individual Seller Health Score (0-100)

```
BASE SCORE = 50

SENTIMENT TREND ADJUSTMENT:
+ Improving:  +25
+ Stable:     +15
+ Declining:  -10

RESOLUTION RATE BONUS:
+ resolution_rate * 0.25
  (e.g., 80% resolution = +20 points)

CHURN RISK PENALTY:
- avg_churn_risk * 25
  (e.g., 0.6 risk = -15 points)

STICKY ISSUES PENALTY:
- min(sticky_issues_count * 5, 20)
  (max -20 points)

FINAL = clamp(0, 100, round(score))
```

### 2.2 Seller Portal Health Score (0-100)

```
BASE SCORE = 50

FRESH CONSUMPTION BONUS:
+ >= 20 leads: +15
+ >= 10 leads: +10
+ >= 5 leads:  +5

PNS DEFAULTER PENALTY:
- >= 3 defaults: -15
- >= 1 defaults: -5

CATEGORY HEALTH PENALTY:
- BA Rank (low-activity):      min(ba_rank * 3, 15)
- CC Rank (zero-consumption):  min(cc_rank * 5, 20)

CQS BONUS:
+ CQS >= 80: +10
+ CQS >= 60: +5

RESOLUTION RATE BONUS:
+ resolution_rate * 0.1

FINAL = clamp(0, 100, round(score))
```

### 2.3 Aggregated Health Score (Dashboard Overview)

```
resolution_score    = min(resolution_rate, 100) * 0.35
deactivation_score  = max(0, 100 - deactivation_rate * 5) * 0.25
churn_score         = max(0, 100 - avg_churn_risk) * 0.25
sentiment_score     = max(0, 100 - negative_end_rate * 2) * 0.15

HEALTH_SCORE = round(resolution_score + deactivation_score + churn_score + sentiment_score)
```

---

## 3. RISK LEVEL CLASSIFICATION

```
IF churn_risk >= 0.7 OR health_score < 30:
    risk_level = 'HIGH'
ELSE IF churn_risk >= 0.4 OR health_score < 60:
    risk_level = 'MEDIUM'
ELSE:
    risk_level = 'LOW'
```

---

## 4. BEHAVIORAL INSIGHTS THRESHOLDS

### 4.1 PNS Health (Preferred Number Service Response Rate)
```
IF pns_response_rate >= 0.7:  'good'
IF pns_response_rate >= 0.4:  'moderate'
ELSE:                         'poor'
```

### 4.2 Lead Engagement (Fresh Lead Consumption 0-4hrs)
```
IF fresh_consumption >= 10:  'active'
IF fresh_consumption >= 3:   'moderate'
ELSE:                        'inactive'
```

### 4.3 Tenure Status (Based on vintage_months)
```
IF vintage_months >= 60:  'veteran'
IF vintage_months >= 12:  'established'
ELSE:                     'new'
```

### 4.4 CQS Trend (Catalog Quality Score)
```
diff = nov_cqs - oct_cqs
IF diff > 5:   'improving'
IF diff < -5:  'declining'
ELSE:          'stable'
```

### 4.5 ROI Risk (Based on PNS Defaulter Count)
```
IF pns_defaulter_count == 0:  'low'
IF pns_defaulter_count <= 2:  'moderate'
ELSE:                         'high'
```

### 4.6 Category Visibility (BA + CC Rank)
```
total_low_visibility = ba_rank + cc_rank
IF total_low_visibility == 0:  'good'
IF total_low_visibility <= 5:  'moderate'
ELSE:                          'poor'
```

### 4.7 Product Issues (Wrong Product Count)
```
IF wrong_product_count == 0:  'none'
IF wrong_product_count <= 3:  'some'
ELSE:                         'many'
```

---

## 5. BEHAVIOR CLASSIFICATION

### 5.1 High-Potential Seller
```
CONDITIONS (ALL must be true):
- pns_defaulter_count <= 1
- fresh_lead_consumption >= 8
- (ba_rank + cc_rank) <= 3
- total_pref_geography >= 5

CONFIDENCE:
- high: if positive_factors >= 4
- medium: otherwise
```

### 5.2 Dormant/At-Risk Seller
```
CONDITIONS (ANY must be true):
- pns_defaulter_count >= 3
- (fresh_consumption < 3 AND (ba_rank + cc_rank) > 5)
- (negative_cities > 10 AND total_pref_geography < 5)

CONFIDENCE:
- high: if negative_factors >= 3
- medium: otherwise
```

### 5.3 Misconfigured Seller
```
CONDITIONS:
- (pns_response_rate >= 0.5 OR pns_defaulter <= 1)
- AND ((ba_rank + cc_rank) > 5 OR (negative_cities > 5 AND total_pref_geo < 5))

CONFIDENCE: medium
```

### 5.4 Default Classification
```
IF none of above match: 'moderate' / 'active'
```

---

## 6. TREND CALCULATIONS

### 6.1 Historical Trend Direction
```
change_percent = ((current - previous) / previous) * 100

TREND DETERMINATION:
IF |change_percent| > 10:
    trend = 'up' if diff > 0 else 'down'
ELSE:
    trend = 'stable'

SPECIAL CASE (previous = 0, current > 0):
    trend = 'up'
    change_percent = 100
```

### 6.2 Trend Color Logic
```
is_positive_change = (trend === 'up')
                   ? higher_is_better
                   : !higher_is_better

COLOR:
- is_positive_change:  GREEN
- !is_positive_change: RED
```

### 6.3 Metrics Higher/Lower is Better
```
HIGHER IS BETTER:
- fresh_lead_consumption
- cqs_score

LOWER IS BETTER:
- pns_defaulter_count
- ba_rank (Low-Activity Categories)
- cc_rank (Zero-Consumption Categories)
- negative_cities_count
```

---

## 7. SENTIMENT ANALYSIS

### 7.1 Sentiment Values (for calculations)
```
SENTIMENT_VALUES = {
    'positive':   1.0
    'neutral':    0.0
    'negative':  -1.0
    'frustrated': -1.5
    'angry':     -2.0
}
```

### 7.2 Sentiment Trend Calculation
```
Split calls into first_half and second_half chronologically

avg_sentiment(group) = sum(sentiment_values) / count

diff = avg_sentiment(second_half) - avg_sentiment(first_half)

IF diff > 0.3:   'improving'
IF diff < -0.3:  'declining'
ELSE:            'stable'
```

---

## 8. ENGAGEMENT PATTERNS

### 8.1 Best Day/Time Score
```
score = total_calls * (1 + resolution_rate)

BEST DAY = day with highest score
BEST TIME = time slot with highest score
```

### 8.2 Time Slots
```
Morning:   09:00 - 12:00
Afternoon: 12:00 - 15:00
Evening:   15:00 - 18:00
Late:      18:00+
```

### 8.3 Call Frequency Trend
```
Split calls into first_half and second_half chronologically

rate = call_count / time_span_in_months

diff = second_rate - first_rate

IF diff > 0.5:   'increasing'
IF diff < -0.5:  'decreasing'
ELSE:            'stable'
```

### 8.4 Tone Consistency
```
unique_tones = count of distinct executive tones
total_tones = count of all tones

consistency = 1 - (unique_tones - 1) / total_tones

IF consistency >= 0.8:  'consistent'
IF consistency >= 0.5:  'variable'
ELSE:                   'inconsistent'
```

---

## 9. ISSUE ANALYSIS

### 9.1 Recurring Issues
```
Issues appearing in >= 2 calls for the same seller
```

### 9.2 Sticky Issues
```
Issues appearing in >= 3 calls for the same seller
```

### 9.3 High-Risk Association
```
FOR each issue category:
    issues_in_cat = count of issues in category
    high_risk_issues = issues where call's churn_risk >= 0.7

    association = (high_risk_issues / issues_in_cat) * 100
```

---

## 10. RAG SEARCH SCORING

### 10.1 ChromaDB Distance to Score
```
score = 1 - distance

(ChromaDB returns L2 distance; converted to similarity score)
```

### 10.2 Text Chunking Parameters
```
CHUNK_SIZE = 800 characters
OVERLAP = 150 characters
```

---

## 11. RATE LIMITING

### 11.1 Gemini API Rate Limiting
```
REQUESTS_PER_MINUTE = 15
DELAY_BETWEEN_REQUESTS = 60 / 15 = 4 seconds
```

---

## 12. CITY TIER CLASSIFICATION

### 12.1 Tier Definitions
```
TIER 1: Mumbai, Delhi, Bangalore, Bengaluru, Hyderabad, Chennai,
        Kolkata, Pune, Ahmedabad, New Delhi

TIER 2: Jaipur, Lucknow, Kanpur, Nagpur, Indore, Thane, Bhopal,
        Visakhapatnam, Patna, Vadodara, Ghaziabad, Ludhiana, Agra,
        Nashik, Faridabad, Meerut, Rajkot, Varanasi, Srinagar,
        Coimbatore, Kochi, Chandigarh, Guwahati, Noida, Dehradun

TIER 3: All other cities
```

---

## 13. AGGREGATED INSIGHTS THRESHOLDS

### 13.1 Actionable Insight Triggers
```
HIGH DEACTIVATION ALERT:    deactivation_rate > 10%
LOW RESOLUTION ALERT:       resolution_rate < 70%
GOOD RESOLUTION:            resolution_rate >= 80%
DOMINANT ISSUE ALERT:       single_category > 25% of total issues
HIGH RISK INDUSTRY:         risk_rate > 40% (min 3 calls)
TIER RISK ALERT:            tier_risk_rate > 30%
NEGATIVE SENTIMENT ALERT:   negative_end_rate > 20%
```

---

## 14. DATA AVAILABILITY NOTES

### 14.1 Available Metrics
| Metric | Source | Definition |
|--------|--------|------------|
| BA Rank | seller_monthly_metrics | Categories with only 1 transaction in 6 months |
| CC Rank | seller_monthly_metrics | Categories with zero consumption |
| Fresh Consumption | seller_monthly_metrics | Leads consumed within 0-4 hours |
| PNS Defaulter | seller_monthly_metrics | Calls not answered on preferred number |
| CQS Score | seller_monthly_metrics | Catalog Quality Score |

### 14.2 Limitations
- **Active Categories**: ESTIMATED (not actual data)
  - Calculation: `5 - ba_rank - cc_rank` (assumes 5 total categories)
- **Lead Targets**: NOT shown (depends on service package)
- **Lead Availability**: NOT available (depends on subscription tier)

---

## Version History

| Date | Changes |
|------|---------|
| 2025-12-17 | Initial formula documentation created |
| 2025-12-17 | Added churn risk fallback validation rules |
| 2025-12-17 | Added behavioral classification formulas |
| 2025-12-17 | Added engagement patterns calculations |
| 2025-12-17 | Added aggregated insights thresholds |
