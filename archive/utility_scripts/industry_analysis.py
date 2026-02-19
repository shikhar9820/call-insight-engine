"""
Industry Analysis Module
Analyzes call insights by MCAT (Industry/Product Category)
"""

import os
import pandas as pd
from collections import defaultdict
from typing import Dict, List, Any
from dotenv import load_dotenv
from supabase import create_client

load_dotenv()

# City Tier Classification (India)
TIER_1_CITIES = {
    'Mumbai', 'Delhi', 'Bangalore', 'Bengaluru', 'Hyderabad', 'Chennai',
    'Kolkata', 'Pune', 'Ahmedabad', 'New Delhi'
}

TIER_2_CITIES = {
    'Jaipur', 'Lucknow', 'Kanpur', 'Nagpur', 'Indore', 'Thane', 'Bhopal',
    'Visakhapatnam', 'Patna', 'Vadodara', 'Ghaziabad', 'Ludhiana', 'Agra',
    'Nashik', 'Faridabad', 'Meerut', 'Rajkot', 'Varanasi', 'Srinagar',
    'Aurangabad', 'Dhanbad', 'Amritsar', 'Allahabad', 'Ranchi', 'Howrah',
    'Coimbatore', 'Jabalpur', 'Gwalior', 'Vijayawada', 'Jodhpur', 'Madurai',
    'Raipur', 'Kota', 'Chandigarh', 'Guwahati', 'Solapur', 'Hubli', 'Mysore',
    'Tiruchirappalli', 'Bareilly', 'Aligarh', 'Tiruppur', 'Moradabad', 'Jalandhar',
    'Bhubaneswar', 'Salem', 'Warangal', 'Guntur', 'Bhiwandi', 'Saharanpur',
    'Gorakhpur', 'Bikaner', 'Amravati', 'Noida', 'Jamshedpur', 'Bhilai',
    'Cuttack', 'Firozabad', 'Kochi', 'Nellore', 'Bhavnagar', 'Dehradun',
    'Durgapur', 'Asansol', 'Rourkela', 'Nanded', 'Kolhapur', 'Ajmer',
    'Akola', 'Gulbarga', 'Jamnagar', 'Ujjain', 'Loni', 'Siliguri', 'Jhansi',
    'Ulhasnagar', 'Jammu', 'Sangli', 'Mangalore', 'Erode', 'Belgaum',
    'Ambattur', 'Tirunelveli', 'Malegaon', 'Gaya', 'Udaipur', 'Kakinada'
}

def get_city_tier(city: str) -> str:
    """Classify city into Tier 1, 2, or 3."""
    if not city:
        return 'Unknown'
    city_clean = city.strip().title()
    if city_clean in TIER_1_CITIES:
        return 'Tier 1'
    elif city_clean in TIER_2_CITIES:
        return 'Tier 2'
    else:
        return 'Tier 3'


class IndustryAnalyzer:
    """Analyze call insights by industry/MCAT."""

    def __init__(self):
        self.supabase = create_client(
            os.environ.get('SUPABASE_URL'),
            os.environ.get('SUPABASE_KEY')
        )
        self.mcat_df = None
        self.load_mcat_data()

    def load_mcat_data(self):
        """Load GLID to MCAT mapping."""
        mcat_file = os.path.join(
            os.path.dirname(__file__),
            'archive/temp_files/glid _-_ mcat.xlsx'
        )
        if os.path.exists(mcat_file):
            self.mcat_df = pd.read_excel(mcat_file)
            # Create GLID to primary MCAT mapping (first MCAT for each GLID)
            self.glid_to_mcat = self.mcat_df.groupby('glid')['glcat_mcat_name'].first().to_dict()
            # Create GLID to all MCATs mapping
            self.glid_to_all_mcats = self.mcat_df.groupby('glid')['glcat_mcat_name'].apply(list).to_dict()
            print(f"Loaded {len(self.glid_to_mcat)} GLID-MCAT mappings")
        else:
            print(f"Warning: MCAT file not found at {mcat_file}")
            self.glid_to_mcat = {}
            self.glid_to_all_mcats = {}

    def get_mcat_for_glid(self, glid: str) -> str:
        """Get primary MCAT for a GLID."""
        if not glid:
            return 'Unknown'
        try:
            glid_int = int(glid)
            return self.glid_to_mcat.get(glid_int, 'Other')
        except:
            return 'Unknown'

    def fetch_all_call_data(self) -> List[Dict]:
        """Fetch all calls with insights."""
        # Fetch calls
        calls_result = self.supabase.table('calls').select(
            'id, company_id, company_name, city'
        ).execute()

        # Fetch insights
        insights_result = self.supabase.table('call_insights').select(
            'call_id, churn_risk_score, deactivation_intent, raw_summary'
        ).execute()

        # Create insights lookup
        insights_map = {i['call_id']: i for i in insights_result.data}

        # Merge data
        merged_data = []
        for call in calls_result.data:
            insight = insights_map.get(call['id'], {})
            merged_data.append({
                **call,
                'churn_risk_score': insight.get('churn_risk_score'),
                'deactivation_intent': insight.get('deactivation_intent'),
                'raw_summary': insight.get('raw_summary')
            })

        return merged_data

    def analyze_by_industry(self) -> Dict[str, Any]:
        """
        Analyze issues by industry/MCAT.
        Returns issue patterns grouped by product category.
        """
        calls = self.fetch_all_call_data()

        # Group by MCAT
        mcat_stats = defaultdict(lambda: {
            'total_calls': 0,
            'high_risk_calls': 0,
            'deactivation_intents': 0,
            'issue_counts': defaultdict(int),
            'cities': set(),
            'avg_churn_risk': []
        })

        for call in calls:
            glid = call.get('company_id')
            mcat = self.get_mcat_for_glid(glid)
            city = call.get('city')

            stats = mcat_stats[mcat]
            stats['total_calls'] += 1

            if city:
                stats['cities'].add(city)

            churn_score = call.get('churn_risk_score')
            if churn_score:
                stats['avg_churn_risk'].append(churn_score)
                if churn_score >= 0.7:
                    stats['high_risk_calls'] += 1

            if call.get('deactivation_intent'):
                stats['deactivation_intents'] += 1

            # Parse issues from raw_summary
            raw_summary = call.get('raw_summary')
            if raw_summary:
                if isinstance(raw_summary, str):
                    import json
                    try:
                        raw_summary = json.loads(raw_summary)
                    except:
                        raw_summary = {}

                issues = raw_summary.get('issues', [])
                for issue in issues:
                    if isinstance(issue, dict):
                        category = issue.get('category', 'other')
                        stats['issue_counts'][category] += 1

        # Format results
        results = []
        for mcat, stats in mcat_stats.items():
            avg_risk = sum(stats['avg_churn_risk']) / len(stats['avg_churn_risk']) if stats['avg_churn_risk'] else 0

            # Get top issues
            top_issues = sorted(
                stats['issue_counts'].items(),
                key=lambda x: x[1],
                reverse=True
            )[:5]

            results.append({
                'industry': mcat,
                'total_calls': stats['total_calls'],
                'high_risk_calls': stats['high_risk_calls'],
                'deactivation_intents': stats['deactivation_intents'],
                'avg_churn_risk': round(avg_risk, 3),
                'unique_cities': len(stats['cities']),
                'top_issues': [{'category': k, 'count': v} for k, v in top_issues],
                'risk_rate': round(stats['high_risk_calls'] / stats['total_calls'] * 100, 1) if stats['total_calls'] > 0 else 0
            })

        # Sort by total calls
        results.sort(key=lambda x: x['total_calls'], reverse=True)

        return {
            'by_industry': results,
            'total_industries': len(results),
            'total_calls_analyzed': sum(r['total_calls'] for r in results)
        }

    def analyze_geography_by_industry(self) -> Dict[str, Any]:
        """
        Analyze industry distribution by geography.
        """
        calls = self.fetch_all_call_data()

        # Group by City -> MCAT
        city_industry = defaultdict(lambda: defaultdict(int))
        city_tiers = {}

        for call in calls:
            city = call.get('city')
            if not city:
                continue

            glid = call.get('company_id')
            mcat = self.get_mcat_for_glid(glid)

            city_industry[city][mcat] += 1
            city_tiers[city] = get_city_tier(city)

        # Format results
        results = []
        for city, industries in city_industry.items():
            top_industries = sorted(
                industries.items(),
                key=lambda x: x[1],
                reverse=True
            )[:5]

            results.append({
                'city': city,
                'tier': city_tiers[city],
                'total_calls': sum(industries.values()),
                'unique_industries': len(industries),
                'top_industries': [{'name': k, 'count': v} for k, v in top_industries]
            })

        # Sort by total calls
        results.sort(key=lambda x: x['total_calls'], reverse=True)

        return {
            'by_city': results,
            'total_cities': len(results)
        }

    def analyze_by_tier(self) -> Dict[str, Any]:
        """
        Analyze by city tier (Tier 1, 2, 3).
        """
        calls = self.fetch_all_call_data()

        tier_stats = defaultdict(lambda: {
            'total_calls': 0,
            'high_risk_calls': 0,
            'deactivation_intents': 0,
            'issue_counts': defaultdict(int),
            'industries': defaultdict(int),
            'cities': set()
        })

        for call in calls:
            city = call.get('city')
            tier = get_city_tier(city)

            stats = tier_stats[tier]
            stats['total_calls'] += 1

            if city:
                stats['cities'].add(city)

            glid = call.get('company_id')
            mcat = self.get_mcat_for_glid(glid)
            stats['industries'][mcat] += 1

            churn_score = call.get('churn_risk_score')
            if churn_score and churn_score >= 0.7:
                stats['high_risk_calls'] += 1

            if call.get('deactivation_intent'):
                stats['deactivation_intents'] += 1

            # Parse issues
            raw_summary = call.get('raw_summary')
            if raw_summary:
                if isinstance(raw_summary, str):
                    import json
                    try:
                        raw_summary = json.loads(raw_summary)
                    except:
                        raw_summary = {}

                issues = raw_summary.get('issues', [])
                for issue in issues:
                    if isinstance(issue, dict):
                        category = issue.get('category', 'other')
                        stats['issue_counts'][category] += 1

        # Format results
        results = []
        for tier in ['Tier 1', 'Tier 2', 'Tier 3', 'Unknown']:
            stats = tier_stats[tier]
            if stats['total_calls'] == 0:
                continue

            top_issues = sorted(stats['issue_counts'].items(), key=lambda x: x[1], reverse=True)[:5]
            top_industries = sorted(stats['industries'].items(), key=lambda x: x[1], reverse=True)[:5]

            results.append({
                'tier': tier,
                'total_calls': stats['total_calls'],
                'high_risk_calls': stats['high_risk_calls'],
                'deactivation_intents': stats['deactivation_intents'],
                'unique_cities': len(stats['cities']),
                'unique_industries': len(stats['industries']),
                'top_issues': [{'category': k, 'count': v} for k, v in top_issues],
                'top_industries': [{'name': k, 'count': v} for k, v in top_industries],
                'risk_rate': round(stats['high_risk_calls'] / stats['total_calls'] * 100, 1)
            })

        return {
            'by_tier': results
        }

    def get_full_analysis(self) -> Dict[str, Any]:
        """Get complete industry analysis."""
        return {
            'industry_analysis': self.analyze_by_industry(),
            'geography_analysis': self.analyze_geography_by_industry(),
            'tier_analysis': self.analyze_by_tier()
        }


# Singleton instance
analyzer = IndustryAnalyzer()


def get_industry_analysis():
    """Get industry-wise analysis."""
    return analyzer.analyze_by_industry()


def get_geography_analysis():
    """Get geography-industry analysis."""
    return analyzer.analyze_geography_by_industry()


def get_tier_analysis():
    """Get tier-wise analysis."""
    return analyzer.analyze_by_tier()


def get_full_analysis():
    """Get complete analysis."""
    return analyzer.get_full_analysis()


if __name__ == "__main__":
    import json
    import sys
    sys.stdout.reconfigure(encoding='utf-8')

    print("=" * 60)
    print("INDUSTRY ANALYSIS")
    print("=" * 60)

    analysis = get_full_analysis()

    print("\n[INDUSTRY] BY INDUSTRY (Top 10):")
    for item in analysis['industry_analysis']['by_industry'][:10]:
        print(f"\n  {item['industry']}:")
        print(f"    Calls: {item['total_calls']}, High Risk: {item['high_risk_calls']}, Risk Rate: {item['risk_rate']}%")
        if item['top_issues']:
            issues_str = ", ".join([f"{i['category']}({i['count']})" for i in item['top_issues'][:3]])
            print(f"    Top Issues: {issues_str}")

    print("\n\n[TIER] BY CITY TIER:")
    for item in analysis['tier_analysis']['by_tier']:
        print(f"\n  {item['tier']}:")
        print(f"    Calls: {item['total_calls']}, Cities: {item['unique_cities']}, Risk Rate: {item['risk_rate']}%")
        if item['top_industries']:
            ind_str = ", ".join([f"{i['name']}({i['count']})" for i in item['top_industries'][:3]])
            print(f"    Top Industries: {ind_str}")

    print("\n\n[GEO] BY GEOGRAPHY (Top 10 Cities):")
    for item in analysis['geography_analysis']['by_city'][:10]:
        print(f"\n  {item['city']} ({item['tier']}):")
        print(f"    Calls: {item['total_calls']}, Industries: {item['unique_industries']}")
