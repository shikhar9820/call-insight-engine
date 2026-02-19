# Call Insights Engine - Proof of Work Documentation

## Overview

The Call Insights Engine is a comprehensive system for analyzing seller-customer call recordings to extract actionable insights, predict churn risk, and provide behavioral analysis of sellers.

---

## System Architecture

### Prediction Sources
The system uses **two prediction methods**:

1. **Gemini AI Analysis** - Processes call transcripts to extract:
   - Sentiment analysis (start, end, trajectory)
   - Issue categorization and severity
   - Churn risk scoring
   - Resolution status
   - Key quotes and action items

2. **Data-Based Calculations** - Uses historical metrics to calculate:
   - Health scores
   - Behavioral classifications
   - Trend analysis
   - Engagement patterns

---

## Dashboard Structure

### Main Navigation
1. **Overview** - Aggregated insights across all calls
2. **Aggregated Insights** - AI-powered analysis with 5 sub-tabs
3. **Seller Insights** - Individual seller analysis with 3 sub-tabs
4. **Seller Portal** - Self-service view for sellers (new)

### Seller Detail Modal Tabs

#### Tab 1: Overview
| Section | Description |
|---------|-------------|
| Health Score Gauge | 0-100 score with color coding |
| Quick Stats | Total calls, Resolution rate, Churn risk, Sentiment trend |
| Behavior Classification | AI-classified seller type with confidence |
| Recommendations | SOP-based action items |
| Sticky Issues | Issues recurring in 3+ calls with SOP guidance |

#### Tab 2: Behavioral Insights
| Section | Description |
|---------|-------------|
| Interlinked Insights | SOP-based behavioral signals with impact analysis |
| Historical Trends | 6-month metric trends with higher_is_better logic |
| Engagement Patterns | Best day, time, avg duration, resolution rate |
| Behavioral Health Indicators | PNS health, Lead engagement, Category visibility |
| Top Categories | Seller's primary business categories |

#### Tab 3: Issues & History
| Section | Description |
|---------|-------------|
| Sentiment & Risk Trend | Visual chart of call sentiment over time |
| Issue Distribution | Heatmap of issue categories |
| Call Timeline | Chronological list of all calls with details |

### Aggregated Insights Tabs

| Tab | Content |
|-----|---------|
| Executive Summary | Overall health score, key metrics |
| Actionable Insights | Prioritized issues needing attention |
| Cross Analysis | Industry x Tier breakdown |
| Issue Trends | Category frequency and risk correlation |
| Behavioral Insights | Aggregated seller behavior classification |

### Seller Portal (Self-Service View)

**Purpose:** A seller-facing dashboard showing actionable insights that sellers can work on themselves.

| Section | Description |
|---------|-------------|
| Business Health Score | 0-100 overall score with color-coded background |
| Quick Stats | Category issues, Lead consumption, Call response rate, Geography |
| Recommended Actions | Prioritized action items with expand/collapse details |
| Category Health | Low-activity and zero-consumption category alerts |
| Geographic Expansion | Opportunity to expand from Local → Regional → National |

#### Action Item Categories
| Category | Examples |
|----------|----------|
| **Geography** | Expand to regional/national, unblock cities |
| **Categories** | Activate low-activity categories, fix zero-consumption |
| **Leads** | Improve PNS response, flag zero/declining consumption |
| **Profile** | Improve CQS score, update catalog |

#### Target Validation Approach

**Important:** Targets are only shown for metrics that can be validated from available data. Lead consumption targets are NOT shown because lead availability depends on seller's service package (which is not in our data).

| Metric | Target Approach | Rationale |
|--------|-----------------|-----------|
| Geography | Local → Regional → National | Can validate current preference |
| Blocked Cities | Current → 0 | Can validate, zero is always optimal |
| BA Rank (Low-Activity) | Current → 0 | Can validate from data |
| CC Rank (Zero-Consumption) | Current → 0 | Can validate from data |
| CQS Score | Current → 70+ (benchmark) | Industry benchmark, not mandatory |
| PNS Missed Calls | Current → 0 | Can validate, zero is optimal |
| Lead Consumption | **No target shown** | Depends on service package |

**Lead Consumption Logic:**
- Only flags if consumption = 0 (not consuming any leads)
- Only flags if 50%+ decline from previous month (and previous >= 5)
- Does NOT suggest arbitrary targets like "consume 15 leads"
- Reason: Lead availability depends on seller's subscription tier

#### Data Availability & Limitations

| Metric | Data Available | Data NOT Available |
|--------|----------------|-------------------|
| **Categories** | BA Rank (low-activity), CC Rank (zero-consumption) | Total categories listed, Actual active count |
| **Leads** | Fresh consumption count, PNS defaulter count | Lead availability, Package entitlement |
| **Geography** | Current preference (Local/Regional/National), Blocked cities count | Potential lead volume by geography |

**Active Categories Calculation (Current - Estimated):**
```
total: ba_rank + cc_rank + 5        // Arbitrary base assumption
active: 5 - ba_rank - cc_rank       // Assumes 5 total categories
lowActivity: ba_rank                // Actual from data
zeroConsumption: cc_rank            // Actual from data
```

**⚠️ Limitation:** Active Categories count is an ESTIMATE. We only have:
- `ba_rank` = Categories with only 1 transaction in last 6 months
- `cc_rank` = Categories with zero consumption

We do NOT have the seller's total listed categories, so "Active Categories" shown in UI is calculated as `assumed_total - ba_rank - cc_rank` which may not be accurate.

**Fix Applied:** Removed "Active Categories" display. Now shows only actual data:
- "Category Issues" = BA rank + CC rank (total problems)
- Subtitle shows breakdown: "X low-activity, Y zero-consumption"

---

## Formulas & Calculations

### 1. Health Score (0-100)

```
Base Score: 50

Adjustments:
+ Sentiment Trend:
  - Improving: +25
  - Stable: +15
  - Declining: -10

+ Resolution Rate Bonus:
  resolutionRate × 0.25
  (e.g., 80% = +20 points)

- Churn Risk Penalty:
  avgChurnRisk × 25
  (e.g., 0.6 risk = -15 points)

- Sticky Issues Penalty:
  min(stickyIssues.count × 5, 20)
  (max -20 points)

Final = clamp(0, 100, round(score))
```

### 1b. Seller Portal Health Score (0-100)

```
Base Score: 50

Adjustments:
+ Fresh Consumption:
  - >= 20: +15
  - >= 10: +10
  - >= 5: +5

- PNS Defaulter Penalty:
  - >= 3: -15
  - >= 1: -5

- Category Health Penalty:
  - BA Rank (low-activity): min(baRank × 3, 15)
  - CC Rank (zero-consumption): min(ccRank × 5, 20)

+ CQS Bonus:
  - >= 80: +10
  - >= 60: +5

+ Resolution Rate Bonus:
  resolutionRate × 0.1

Final = clamp(0, 100, round(score))
```

### 2. Risk Level Classification

| Condition | Risk Level |
|-----------|------------|
| churnRisk >= 0.7 OR healthScore < 30 | HIGH |
| churnRisk >= 0.4 OR healthScore < 60 | MEDIUM |
| Otherwise | LOW |

### 3. Best Day/Time Calculation

```
Score = totalCalls × (1 + resolutionRate)

Best Day = day with highest score
Best Time = time slot with highest score

Time Slots:
- Morning: 9:00 - 12:00
- Afternoon: 12:00 - 15:00
- Evening: 15:00 - 18:00
- Late: 18:00+
```

### 4. Historical Trend Direction

```
changePercent = ((current - previous) / previous) × 100

Trend:
- |changePercent| > 10: UP or DOWN
- Otherwise: STABLE

Special case (previous = 0, current > 0):
- trend = UP
- changePercent = 100
```

### 5. Trend Color Logic

```
isPositiveChange = (trend === 'up')
  ? higher_is_better
  : !higher_is_better

Color:
- isPositiveChange: GREEN
- !isPositiveChange: RED
```

### 6. Behavior Classification

| Type | Conditions |
|------|------------|
| high_potential | freshConsumption >= 10 AND pnsDefaulter <= 1 AND healthScore >= 50 |
| dormant_at_risk | pnsDefaulter >= 3 OR healthScore < 30 |
| misconfigured | baRank > 5 OR ccRank > 3 |
| active | Default |

### 7. Aggregated Health Score

```
resolutionScore = min(resolutionRate, 100) × 0.35
churnPenalty = min(avgChurnRisk, 100) × 0.25
deactivationPenalty = min(deactivationRate, 50) × 0.2
sentimentPenalty = min(negativeEndRate, 50) × 0.2

healthScore = resolutionScore
            - churnPenalty
            - deactivationPenalty
            - sentimentPenalty
            + 30

Final = clamp(0, 100, round(score))
```

---

## Glossary

### Metrics

| Term | Definition |
|------|------------|
| **Health Score** | Overall seller health (0-100). Higher is better. |
| **Churn Risk** | Probability of customer leaving (0-1). From Gemini AI. |
| **Resolution Rate** | % of calls where issue was fully resolved |
| **PNS Defaulter Count** | Calls where seller didn't answer preferred number |
| **Fresh Lead Consumption** | New leads consumed in the period |
| **BA Rank** | Low-Activity Categories (single transaction in 6 months) |
| **CC Rank** | Zero-Consumption Categories (no consumption) |
| **CQS Score** | Catalog Quality Score |

### Behavioral Terms

| Term | Definition |
|------|------------|
| **Sticky Issues** | Problems appearing in 3+ calls for same seller |
| **Recurring Issues** | Problems appearing in 2+ calls |
| **Sentiment Trajectory** | Change from call start to end sentiment |
| **Deactivation Intent** | Seller expressed desire to close account |
| **Escalation Threatened** | Customer threatened to escalate |

### Classification Types

| Type | Description |
|------|-------------|
| **high_potential** | Active seller with good metrics |
| **dormant_at_risk** | Low activity, high risk |
| **misconfigured** | Category/visibility issues |
| **active** | Normal activity level |

---

## Test Cases

### TC-001: Health Score Calculation
**Input:**
- Sentiment: Improving
- Resolution Rate: 80%
- Churn Risk: 0.3
- Sticky Issues: 2

**Expected Output:**
- Base: 50
- Sentiment: +25
- Resolution: +20
- Churn: -7.5
- Sticky: -10
- **Total: 78**

### TC-002: Trend Color Logic
**Scenario:** Low-Activity Categories increased by 53%

| Field | Value |
|-------|-------|
| trend | up |
| higher_is_better | false |
| changePercent | 53 |

**Expected:** RED color (increase is bad for this metric)

### TC-003: Zero Previous Value
**Scenario:** Zero-Consumption Categories: Oct=0, Nov=6

**Expected:**
- trend: up
- changePercent: 100
- Color: RED (higher_is_better: false)

### TC-004: Best Day Calculation
**Input:**
| Day | Calls | Resolved |
|-----|-------|----------|
| Monday | 3 | 1 |
| Tuesday | 2 | 1 |
| Friday | 1 | 1 |

**Calculation:**
- Monday: 3 × (1 + 0.33) = 4.0
- Tuesday: 2 × (1 + 0.5) = 3.0
- Friday: 1 × (1 + 1.0) = 2.0

**Expected:** Best Day = Monday

### TC-005: Behavior Classification
**Input:**
- Fresh Consumption: 15
- PNS Defaulter: 0
- Health Score: 65

**Expected:** high_potential

### TC-006: Risk Level Classification
**Input:**
- Churn Risk: 0.75
- Health Score: 40

**Expected:** HIGH (churn >= 0.7)

### TC-007: Aggregated Behavioral Tab
**Verify:**
- Total Sellers count matches
- Behavior breakdown percentages sum to 100%
- Risk distribution matches total sellers
- Top issues sorted by count descending

---

## Sample GLIDs for Testing

| GLID | Calls | Key Features |
|------|-------|--------------|
| 35118323 | 8 | Good engagement data, multiple trends |
| 204426014 | 8 | CQS declining, good for trend testing |
| 15741212 | 4 | Multiple calls for pattern analysis |

---

## API Endpoints

### GET /api/seller-insights
List all sellers with call data

### GET /api/seller-insights/[companyId]
Detailed seller profile with:
- Health metrics
- Behavioral insights
- Historical trends
- Call timeline
- Engagement patterns

### GET /api/aggregated-insights
Aggregated data across all sellers:
- Executive summary
- Actionable insights
- Cross analysis
- Issue trends
- Behavioral aggregation

### GET /api/seller-actions/[companyId]
Seller self-service data with:
- Overall business health score
- Action items (geography, categories, leads, profile)
- Category health breakdown
- Geographic expansion status
- Lead engagement metrics

---

## Files Modified

### Core Components
- `components/SellerDetailModal.tsx` - Added 3-tab structure
- `components/AggregatedInsights.tsx` - Added Behavioral Insights tab
- `components/SellerSelfServiceView.tsx` - New seller portal component

### API Routes
- `app/api/seller-insights/[companyId]/route.ts` - Added higher_is_better, fixed trends
- `app/api/aggregated-insights/route.ts` - Added behavioral aggregation
- `app/api/seller-actions/[companyId]/route.ts` - New seller self-service API

### Main Page
- `app/page.tsx` - Added Seller Portal tab

### Archive Structure
```
archive/
  results/        - Old JSON result files
  data_files/     - Excel data files
  documentation/  - Draft docs, SOP files
  presentations/  - Hackathon slides
  utility_scripts/- One-time scripts
  images/         - Change tracking images
  logs/           - Debug logs
```

---

## Version History

| Date | Changes |
|------|---------|
| 2025-12-17 | Fixed trend color logic (higher_is_better) |
| 2025-12-17 | Fixed zero previous value trend calculation |
| 2025-12-17 | Added engagement patterns data (Best Day, Best Time, etc.) |
| 2025-12-17 | Added 3-tab structure to Seller Detail Modal |
| 2025-12-17 | Added Behavioral Insights tab to Aggregated view |
| 2025-12-17 | Archived unused files |
| 2025-12-17 | Created POW documentation |
| 2025-12-17 | Added Seller Portal (Self-Service) tab |
| 2025-12-17 | Created seller-actions API endpoint |
| 2025-12-17 | Fixed target validation - removed arbitrary lead targets (depends on service package) |
| 2025-12-17 | Documented data limitations - Active Categories is estimated, not actual |
| 2025-12-17 | Fixed UI - Replaced "Active Categories" with "Category Issues" (actual data only) |
