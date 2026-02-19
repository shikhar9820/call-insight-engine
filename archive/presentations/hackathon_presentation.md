# Call Insights Engine
## Voice Hackathon Presentation

---

# Slide 1: The Problem

## Customer Calls at Scale = Missed Insights

- **Thousands of calls daily** with sellers needing support
- **Manual review is impossible** - too many calls, too little time
- **Churn risks go undetected** until customers leave
- **No standardized analysis** - insights vary by reviewer
- **Multi-language barrier** - Hindi, Tamil, Telugu mixed with English

### The Cost of Missing Insights
> Every unanalyzed call is a potential churned customer

---

# Slide 2: Our Solution

## AI-Powered Call Intelligence

### Multi-Agent Processing Pipeline

```
Audio Recording
      |
      v
[Transcription] --> Roman Script (Hinglish/Tanglish)
      |
      v
[Translation] --> English
      |
      v
[Analysis Agent] --> 30+ Data Points Extracted
      |
      v
[RAG Enrichment] --> SOP Recommendations
      |
      v
[Dashboard] --> Actionable Insights
```

### One Call = Complete Intelligence in Seconds

---

# Slide 3: Key Features

## What We Extract From Every Call

| Feature | Description |
|---------|-------------|
| **Risk Detection** | Churn risk score (0-1), deactivation intent, refund requests |
| **Issue Classification** | 11 categories: BuyLead, Payment, Subscription, Technical, etc. |
| **Sentiment Journey** | Track mood from start to end (e.g., neutral -> frustrated) |
| **SOP Recommendations** | Auto-suggest resolution procedures from knowledge base |
| **Industry Analysis** | Map to 1000+ product categories for context |
| **Geography Insights** | City tier classification for regional patterns |

### Critical Alerts
- Legal threats
- Escalation requests
- Competitor mentions
- Payment disputes

---

# Slide 4: Technology Stack

## Built with Modern AI & Cloud

### AI & Processing
- **Google Gemini 2.0 Flash** - LLM for analysis (~$0.02/call)
- **ChromaDB** - Vector database for RAG
- **Dual RAG System** - Classification + SOP suggestions

### Backend
- **Python** - Core processing engine
- **Supabase** - PostgreSQL database (4 tables)
- **Async Processing** - Batch support for 1000+ calls

### Frontend Dashboard
- **Next.js 14** - Modern React framework
- **Recharts** - Interactive visualizations
- **Tailwind CSS** - Clean UI design
- **Real-time sync** - Live data from Supabase

---

# Slide 5: Impact & Demo

## Business Value Delivered

### Metrics That Matter

| Metric | Value |
|--------|-------|
| Processing Speed | ~4 calls/minute |
| Cost per Call | ~$0.02 |
| Data Points Extracted | 30+ per call |
| Issue Categories | 11 types |
| Languages Supported | Hindi, Tamil, Telugu, English |

### What You'll See in the Demo

1. **Upload a call recording** -> Watch AI transcribe & translate
2. **View analysis results** -> Sentiment, risks, issues extracted
3. **Dashboard insights** -> Charts, trends, high-risk alerts
4. **SOP recommendations** -> Actionable next steps for agents

### The Result
> **Proactive retention** - Catch churn risks before customers leave

---

## Team: Voice Hackathon
## Project: Call Insights Engine

### Thank You!

*Turning every customer call into actionable intelligence*
