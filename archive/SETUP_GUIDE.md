# Call Insights Engine - Setup Guide

## Quick Start

### 1. Set up Supabase

1. Go to [supabase.com](https://supabase.com) and create a free account
2. Create a new project (e.g., "call-insights-indiamart")
3. Wait for the project to be provisioned (~2 minutes)
4. Go to **SQL Editor** in the left sidebar
5. Copy the contents of `database/supabase_schema.sql` and run it
6. Go to **Settings > API** to get your credentials:
   - **Project URL**: `https://xxxxx.supabase.co`
   - **anon public key**: Used for client-side access
   - **service_role key**: Used for server-side access (keep secret!)

### 2. Configure Environment Variables

Update your `.env` file:

```bash
# Add these to your existing .env file
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_KEY=your-anon-key
SUPABASE_SERVICE_KEY=your-service-role-key
```

### 3. Test Supabase Connection

```bash
cd call_insights_engine
python -c "from database.supabase_client import init_supabase; client = init_supabase(); print('Connected!')"
```

### 4. Process Calls and Store in Supabase

```bash
# Process a single call
python batch_processor.py --url "https://your-audio-url.mp3" --ucid "test_001"

# Process from CSV
python batch_processor.py --csv your_calls.csv --workers 4 --limit 100

# Add calls to queue for later processing
python batch_processor.py --add-to-queue your_calls.csv

# Resume processing from queue
python batch_processor.py --resume-queue --limit 50
```

---

## Dashboard Setup (Vercel)

### 1. Prepare Dashboard

```bash
cd call_insights_engine/dashboard

# Create .env.local file
cp .env.local.example .env.local

# Edit .env.local with your Supabase credentials
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

### 2. Test Locally

```bash
npm install
npm run dev
# Open http://localhost:3000
```

### 3. Deploy to Vercel

**Option A: Using Vercel CLI**
```bash
npm install -g vercel
vercel login
vercel
# Follow prompts, add environment variables when asked
```

**Option B: Using GitHub**
1. Push your code to GitHub
2. Go to [vercel.com](https://vercel.com)
3. Import your repository
4. Set the root directory to `call_insights_engine/dashboard`
5. Add environment variables:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
6. Deploy!

---

## CSV Format for Batch Processing

Your CSV should have these columns (case-insensitive):

| Column | Required | Description |
|--------|----------|-------------|
| ucid | Yes | Unique Call ID |
| audio_url | Yes | URL to audio file |
| call_duration_seconds | No | Duration in seconds |
| call_start_time | No | ISO timestamp |
| employee_id | No | Agent/Employee ID |
| employee_name | No | Agent name |
| customer_mobile | No | Customer phone |
| company_name | No | Customer company |
| call_direction | No | inbound/outbound |
| call_type | No | Call category |

Example:
```csv
ucid,audio_url,employee_name,customer_mobile,company_name
UC001,https://storage.example.com/call1.mp3,John Doe,9876543210,ABC Corp
UC002,https://storage.example.com/call2.mp3,Jane Smith,9876543211,XYZ Ltd
```

---

## Architecture

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│  Audio Files    │────▶│  Batch Processor │────▶│    Supabase     │
│  (URLs/CSV)     │     │  (Python)        │     │   (PostgreSQL)  │
└─────────────────┘     └──────────────────┘     └────────┬────────┘
                                                          │
                        ┌──────────────────┐              │
                        │  Next.js         │◀─────────────┘
                        │  Dashboard       │
                        │  (Vercel)        │
                        └──────────────────┘
```

---

## Supabase Free Tier Limits

- **Database**: 500 MB (sufficient for ~50,000 calls)
- **Storage**: 1 GB
- **API requests**: Unlimited
- **Bandwidth**: 2 GB/month

For 5,600 recordings with full transcripts and insights, estimated usage:
- ~2-5 KB per call record
- ~10-50 KB per transcript
- ~5-10 KB per insight
- **Total**: ~100-300 MB (well within free tier)

---

## Troubleshooting

### "SUPABASE_URL and SUPABASE_KEY must be set"
- Check your `.env` file has the correct variables
- Ensure you're running from the correct directory

### "supabase-py not installed"
```bash
pip install supabase
```

### Dashboard shows no data
1. Verify Supabase credentials in `.env.local`
2. Check browser console for errors
3. Ensure data exists in Supabase (check Tables in dashboard)

### API rate limiting
- Reduce `--workers` count
- Add delays between batches
- Consider Supabase Pro plan for production
