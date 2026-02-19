# Generate Flow Diagram for Call Insights Engine - Improved Version
import matplotlib.pyplot as plt
import matplotlib.patches as mpatches
from matplotlib.patches import FancyBboxPatch, Rectangle, FancyArrowPatch
import matplotlib.patheffects as path_effects

def create_flow_diagram():
    fig, ax = plt.subplots(1, 1, figsize=(24, 32))
    ax.set_xlim(0, 24)
    ax.set_ylim(0, 32)
    ax.axis('off')
    ax.set_facecolor('#FAFAFA')

    # Colors
    colors = {
        'input': '#BBDEFB',
        'process': '#FFE0B2',
        'storage': '#C8E6C9',
        'api': '#E1BEE7',
        'ui': '#FFCDD2',
        'support': '#FFF9C4',
        'header': '#1565C0',
        'subheader': '#37474F',
        'arrow': '#546E7A',
        'border': '#37474F'
    }

    def draw_rounded_box(x, y, w, h, color, border_color='#37474F', lw=2):
        box = FancyBboxPatch((x, y), w, h,
                             boxstyle="round,pad=0.02,rounding_size=0.15",
                             facecolor=color, edgecolor=border_color, linewidth=lw)
        ax.add_patch(box)

    def draw_text(x, y, text, fontsize=10, bold=False, color='#212121', ha='center', va='center'):
        weight = 'bold' if bold else 'normal'
        ax.text(x, y, text, ha=ha, va=va, fontsize=fontsize, fontweight=weight, color=color)

    def draw_section_header(x, y, w, text):
        draw_rounded_box(x, y, w, 0.7, colors['header'], colors['header'], 0)
        draw_text(x + w/2, y + 0.35, text, fontsize=13, bold=True, color='white')

    def draw_arrow_down(x, y1, y2):
        ax.annotate('', xy=(x, y2), xytext=(x, y1),
                   arrowprops=dict(arrowstyle='->', color=colors['arrow'], lw=2.5,
                                  connectionstyle='arc3,rad=0'))

    def draw_arrow_right(x1, x2, y):
        ax.annotate('', xy=(x2, y), xytext=(x1, y),
                   arrowprops=dict(arrowstyle='->', color=colors['arrow'], lw=2))

    # ==================== TITLE ====================
    draw_text(12, 31.2, 'CALL INSIGHTS ENGINE', fontsize=22, bold=True, color='#0D47A1')
    draw_text(12, 30.5, 'Complete System Architecture - IndiaMART B2B Platform', fontsize=14, color='#546E7A')

    # ==================== INPUT LAYER ====================
    draw_section_header(1, 29, 22, 'INPUT LAYER')

    # Input boxes
    draw_rounded_box(1.5, 26.8, 6, 1.8, colors['input'])
    draw_text(4.5, 27.95, 'call data.xlsx', fontsize=11, bold=True)
    draw_text(4.5, 27.35, 'ucid | transcript | glid', fontsize=9)
    draw_text(4.5, 26.95, 'city | duration | recording_url', fontsize=9)

    draw_rounded_box(9, 26.8, 6, 1.8, colors['input'])
    draw_text(12, 27.95, 'glid_mcat.xlsx', fontsize=11, bold=True)
    draw_text(12, 27.35, 'GLID -> MCAT Mapping', fontsize=9)
    draw_text(12, 26.95, '1557 Industry Mappings', fontsize=9)

    draw_rounded_box(16.5, 26.8, 6, 1.8, colors['input'])
    draw_text(19.5, 27.95, 'SOP Documents', fontsize=11, bold=True)
    draw_text(19.5, 27.35, 'Ticket Handling SOPs', fontsize=9)
    draw_text(19.5, 26.95, 'Category Classification Rules', fontsize=9)

    draw_arrow_down(12, 26.8, 26)

    # ==================== PROCESSING LAYER ====================
    draw_section_header(1, 25.3, 22, 'PROCESSING LAYER (process_excel.py)')

    # Step 1
    draw_rounded_box(1.5, 22.5, 5, 2.4, colors['process'])
    draw_text(4, 24.5, 'STEP 1', fontsize=10, bold=True, color='#E65100')
    draw_text(4, 24, 'TRANSLATION', fontsize=11, bold=True)
    draw_text(4, 23.4, 'Hindi/Hinglish', fontsize=9)
    draw_text(4, 23, '-> English', fontsize=9)
    draw_text(4, 22.6, 'Gemini 2.0 Flash', fontsize=8, color='#666')

    draw_arrow_right(6.5, 7.5, 23.7)

    # Step 2
    draw_rounded_box(7.5, 22.5, 5, 2.4, colors['process'])
    draw_text(10, 24.5, 'STEP 2', fontsize=10, bold=True, color='#E65100')
    draw_text(10, 24, 'CLASSIFICATION RAG', fontsize=11, bold=True)
    draw_text(10, 23.4, 'ChromaDB Vector Search', fontsize=9)
    draw_text(10, 23, 'Category Context', fontsize=9)
    draw_text(10, 22.6, 'text-embedding-004', fontsize=8, color='#666')

    draw_arrow_right(12.5, 13.5, 23.7)

    # Step 3
    draw_rounded_box(13.5, 22.5, 5, 2.4, colors['process'])
    draw_text(16, 24.5, 'STEP 3', fontsize=10, bold=True, color='#E65100')
    draw_text(16, 24, 'GEMINI ANALYSIS', fontsize=11, bold=True)
    draw_text(16, 23.4, 'Issues | Risk Signals', fontsize=9)
    draw_text(16, 23, 'Sentiment | Resolution', fontsize=9)
    draw_text(16, 22.6, 'Gemini 2.0 Flash', fontsize=8, color='#666')

    draw_arrow_right(18.5, 19.5, 23.7)

    # Step 4
    draw_rounded_box(19.5, 22.5, 3.5, 2.4, colors['process'])
    draw_text(21.25, 24.5, 'STEP 4', fontsize=10, bold=True, color='#E65100')
    draw_text(21.25, 24, 'SOP', fontsize=11, bold=True)
    draw_text(21.25, 23.5, 'MATCHING', fontsize=11, bold=True)
    draw_text(21.25, 22.9, 'CLEAN_SOP', fontsize=9)
    draw_text(21.25, 22.6, 'Dictionary', fontsize=8, color='#666')

    # Validation box
    draw_rounded_box(1.5, 19.8, 6.5, 2.2, '#FFECB3')
    draw_text(4.75, 21.5, 'STEP 3.5: VALIDATION', fontsize=10, bold=True, color='#F57F17')
    draw_text(4.75, 20.9, 'validate_churn_score()', fontsize=9)
    draw_text(4.75, 20.4, 'Rule-based fallback if', fontsize=8)
    draw_text(4.75, 20, 'Gemini score invalid', fontsize=8)

    # Output box
    draw_rounded_box(9, 19.3, 14, 2.7, '#E3F2FD')
    draw_text(16, 21.6, 'ANALYSIS JSON OUTPUT', fontsize=11, bold=True, color='#1565C0')
    draw_text(12, 20.9, 'issues[] - category, severity, description', fontsize=9, ha='left')
    draw_text(12, 20.4, 'risk_signals - churn_score, deactivation_intent', fontsize=9, ha='left')
    draw_text(12, 19.9, 'sentiment - customer_start -> customer_end', fontsize=9, ha='left')
    draw_text(12, 19.4, 'resolution - status, follow_up, sop_recommendations[]', fontsize=9, ha='left')

    draw_arrow_down(12, 19.3, 18.5)

    # ==================== STORAGE LAYER ====================
    draw_section_header(1, 17.8, 22, 'STORAGE LAYER (Supabase PostgreSQL)')

    # Tables
    draw_rounded_box(1.5, 14.8, 5, 2.5, colors['storage'])
    draw_text(4, 16.9, 'calls', fontsize=12, bold=True, color='#2E7D32')
    draw_text(4, 16.4, 'id (PK)', fontsize=9)
    draw_text(4, 16, 'ucid, company_id', fontsize=9)
    draw_text(4, 15.6, 'city, recording_url', fontsize=9)
    draw_text(4, 15.2, 'duration, customer_type', fontsize=9)

    draw_arrow_right(6.5, 7, 16)

    draw_rounded_box(7, 14.8, 5, 2.5, colors['storage'])
    draw_text(9.5, 16.9, 'call_transcripts', fontsize=12, bold=True, color='#2E7D32')
    draw_text(9.5, 16.4, 'id (PK)', fontsize=9)
    draw_text(9.5, 16, 'call_id (FK)', fontsize=9)
    draw_text(9.5, 15.6, 'transcript, translation', fontsize=9)
    draw_text(9.5, 15.2, 'languages, speaker_count', fontsize=9)

    draw_arrow_right(12, 12.5, 16)

    draw_rounded_box(12.5, 14.8, 5, 2.5, colors['storage'])
    draw_text(15, 16.9, 'call_insights', fontsize=12, bold=True, color='#2E7D32')
    draw_text(15, 16.4, 'id (PK), call_id (FK)', fontsize=9)
    draw_text(15, 16, 'churn_risk_score', fontsize=9)
    draw_text(15, 15.6, 'deactivation_intent', fontsize=9)
    draw_text(15, 15.2, 'sentiment_*, raw_summary', fontsize=9)

    draw_arrow_right(17.5, 18, 16)

    draw_rounded_box(18, 14.8, 5, 2.5, colors['storage'])
    draw_text(20.5, 16.9, 'call_issues', fontsize=12, bold=True, color='#2E7D32')
    draw_text(20.5, 16.4, 'id (PK)', fontsize=9)
    draw_text(20.5, 16, 'call_id (FK)', fontsize=9)
    draw_text(20.5, 15.6, 'category, severity', fontsize=9)
    draw_text(20.5, 15.2, 'description', fontsize=9)

    draw_arrow_down(12, 14.8, 14)

    # ==================== API LAYER ====================
    draw_section_header(1, 13.3, 22, 'API LAYER (Next.js 14 App Router)')

    # API endpoints
    draw_rounded_box(1.5, 10.5, 4, 2.3, colors['api'])
    draw_text(3.5, 12.4, '/api/stats', fontsize=11, bold=True, color='#6A1B9A')
    draw_text(3.5, 11.8, 'total_calls', fontsize=9)
    draw_text(3.5, 11.4, 'high_risk_count', fontsize=9)
    draw_text(3.5, 11, 'resolution_rate', fontsize=9)

    draw_rounded_box(6, 10.5, 4, 2.3, colors['api'])
    draw_text(8, 12.4, '/api/alerts', fontsize=11, bold=True, color='#6A1B9A')
    draw_text(8, 11.8, 'high_risk calls', fontsize=9)
    draw_text(8, 11.4, 'deactivation', fontsize=9)
    draw_text(8, 11, 'legal_threat', fontsize=9)

    draw_rounded_box(10.5, 10.5, 4, 2.3, colors['api'])
    draw_text(12.5, 12.4, '/api/patterns', fontsize=11, bold=True, color='#6A1B9A')
    draw_text(12.5, 11.8, 'issue_categories', fontsize=9)
    draw_text(12.5, 11.4, 'sentiment_analysis', fontsize=9)
    draw_text(12.5, 11, 'follow_up_pending', fontsize=9)

    draw_rounded_box(15, 10.5, 4, 2.3, colors['api'])
    draw_text(17, 12.4, '/api/calls-', fontsize=11, bold=True, color='#6A1B9A')
    draw_text(17, 11.9, 'with-sop', fontsize=11, bold=True, color='#6A1B9A')
    draw_text(17, 11.3, 'clean SOPs', fontsize=9)
    draw_text(17, 10.9, 'issue details', fontsize=9)

    draw_rounded_box(19.5, 10.5, 4, 2.3, colors['api'])
    draw_text(21.5, 12.4, '/api/industry-', fontsize=11, bold=True, color='#6A1B9A')
    draw_text(21.5, 11.9, 'analysis', fontsize=11, bold=True, color='#6A1B9A')
    draw_text(21.5, 11.3, 'by_tier, by_city', fontsize=9)
    draw_text(21.5, 10.9, 'by_mcat', fontsize=9)

    draw_arrow_down(12, 10.5, 9.7)

    # ==================== UI LAYER ====================
    draw_section_header(1, 9, 22, 'PRESENTATION LAYER (React + TailwindCSS + Lucide Icons)')

    # UI Tabs
    draw_rounded_box(1.5, 6, 4, 2.5, colors['ui'])
    draw_text(3.5, 8.1, 'Overview', fontsize=11, bold=True, color='#C62828')
    draw_text(3.5, 7.6, 'Tab', fontsize=11, bold=True, color='#C62828')
    draw_text(3.5, 7, 'Stats Cards', fontsize=9)
    draw_text(3.5, 6.6, 'Total | Risk % | Follow Up', fontsize=8)

    draw_rounded_box(6, 6, 4, 2.5, colors['ui'])
    draw_text(8, 8.1, 'Alerts', fontsize=11, bold=True, color='#C62828')
    draw_text(8, 7.6, 'Tab', fontsize=11, bold=True, color='#C62828')
    draw_text(8, 7, 'High Risk List', fontsize=9)
    draw_text(8, 6.6, 'Deact | Legal | Escalation', fontsize=8)

    draw_rounded_box(10.5, 6, 4, 2.5, colors['ui'])
    draw_text(12.5, 8.1, 'Patterns', fontsize=11, bold=True, color='#C62828')
    draw_text(12.5, 7.6, 'Tab', fontsize=11, bold=True, color='#C62828')
    draw_text(12.5, 7, 'Charts & Analysis', fontsize=9)
    draw_text(12.5, 6.6, 'Issues | Sentiment | Topics', fontsize=8)

    draw_rounded_box(15, 6, 4, 2.5, colors['ui'])
    draw_text(17, 8.1, 'SOP Guide', fontsize=11, bold=True, color='#C62828')
    draw_text(17, 7.6, 'Tab', fontsize=11, bold=True, color='#C62828')
    draw_text(17, 7, 'Action Steps', fontsize=9)
    draw_text(17, 6.6, 'Clean formatted SOPs', fontsize=8)

    draw_rounded_box(19.5, 6, 4, 2.5, colors['ui'])
    draw_text(21.5, 8.1, 'Industry', fontsize=11, bold=True, color='#C62828')
    draw_text(21.5, 7.6, 'Tab', fontsize=11, bold=True, color='#C62828')
    draw_text(21.5, 7, 'MCAT Analysis', fontsize=9)
    draw_text(21.5, 6.6, 'City Tier | Geography', fontsize=8)

    # ==================== SUPPORT SYSTEMS ====================
    draw_section_header(1, 4.8, 22, 'SUPPORT SYSTEMS')

    draw_rounded_box(1.5, 2, 6.5, 2.3, colors['support'])
    draw_text(4.75, 3.9, 'ChromaDB', fontsize=12, bold=True, color='#F57F17')
    draw_text(4.75, 3.4, '(Vector Database)', fontsize=10)
    draw_text(4.75, 2.8, 'classification_rag collection', fontsize=9)
    draw_text(4.75, 2.4, 'suggestion_rag collection', fontsize=9)

    draw_rounded_box(8.75, 2, 6.5, 2.3, colors['support'])
    draw_text(12, 3.9, 'GLID-MCAT Mapping', fontsize=12, bold=True, color='#F57F17')
    draw_text(12, 3.4, 'glid_mcat_mapping.json', fontsize=10)
    draw_text(12, 2.8, '1557 GLID -> Industry', fontsize=9)
    draw_text(12, 2.4, 'mappings', fontsize=9)

    draw_rounded_box(16, 2, 6.5, 2.3, colors['support'])
    draw_text(19.25, 3.9, 'CLEAN_SOP Dictionary', fontsize=12, bold=True, color='#F57F17')
    draw_text(19.25, 3.4, '(Hardcoded in APIs)', fontsize=10)
    draw_text(19.25, 2.8, 'payment | deactivation | buylead_*', fontsize=9)
    draw_text(19.25, 2.4, 'technical | employee | pns | catalog', fontsize=9)

    # ==================== TECH STACK ====================
    draw_rounded_box(1, 0.3, 22.5, 1.2, '#E8EAF6')
    draw_text(12.25, 1.1, 'TECH STACK', fontsize=11, bold=True, color='#283593')
    draw_text(12.25, 0.55, 'Python 3.x  |  Gemini 2.0 Flash  |  ChromaDB  |  Supabase PostgreSQL  |  Next.js 14  |  React  |  TailwindCSS',
              fontsize=10, color='#37474F')

    plt.tight_layout()
    plt.savefig('call_insights_flow_diagram.png', dpi=200, bbox_inches='tight',
                facecolor='#FAFAFA', edgecolor='none', pad_inches=0.3)
    print("Flow diagram saved to: call_insights_flow_diagram.png")

if __name__ == "__main__":
    create_flow_diagram()
