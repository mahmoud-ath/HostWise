/**
 * Type definitions for the AI Advisor dashboard, chat, and scenario
 * simulator responses from `/api/v1/ai/*`.
 */

export interface HealthScore {
  score: number | null;
  status: string;
  components: {
    profit: number | null;
    growth: number | null;
    expenses: number | null;
    risk: number | null;
  };
}

export interface AiAction {
  type: string;
  title: string;
  cause: string;
  business_impact: string;
  suggested_action: string;
  expected_improvement: string;
  confidence_score: number;
}

export interface OpportunityAction {
  title: string;
  detail: string;
  gain: number;
}

export interface LostRevenueReason {
  reason: string;
  detail: string;
  amount: number;
}

export interface PropertyRisk {
  level: "high" | "medium";
  property_name: string;
  revenue_trend_pct: number | null;
  profit_margin: number;
  health_score?: number | null;
  recommendation: string;
}

export interface PropertyReview {
  property_id: string;
  property_name: string;
  health_score?: number | null;
  status: string;
  net_revenue: number;
  profit_margin: number;
  expense_ratio: number;
  ai_summary: string;
  strengths: string[];
  weaknesses: string[];
  suggested_action: string;
}

export interface Achievement {
  icon: string;
  title: string;
  detail: string;
}

export interface RecommendedGoal {
  label: string;
  target: string;
  current: string;
  progress: number;
}

export interface TrendExplanation {
  metric: string;
  direction: "up" | "down";
  change_pct: number | null;
  reasons: string[];
}

export interface AdvisorReport {
  year: number;
  generated_at: string;
  /** Engine that produced the report: 'hostwise' (rules) or an external provider id. */
  provider?: string;
  executive_summary: string;
  key_metrics: Record<string, number>;
  current_metrics: {
    net_revenue: number;
    gross_revenue: number;
    total_expenses: number;
    profit: number;
    profit_margin: number;
    cancellation_rate: number;
    revenue_growth_yoy: number | null;
    property_count: number;
  };
  health_score: HealthScore;
  priority_actions: {
    critical: AiAction[];
    medium: AiAction[];
    low: AiAction[];
  };
  opportunities: {
    potential_revenue: number;
    confidence: number;
    actions: OpportunityAction[];
  };
  lost_revenue: {
    estimated_lost_revenue: number;
    reasons: LostRevenueReason[];
  };
  risks: PropertyRisk[];
  property_reviews: PropertyReview[];
  forecast: {
    expected_revenue: number;
    risk_level: string;
    best_property: string | null;
    confidence: number;
  };
  achievements: Achievement[];
  recommended_goals: RecommendedGoal[];
  trend_explanations: TrendExplanation[];
}

export interface ChatResult {
  question: string;
  answer: string;
  intent: string;
  confidence: number;
  suggested_questions: string[];
}

export interface ScenarioResult {
  scenario: string;
  label: string;
  baseline: {
    revenue: number;
    expenses: number;
    profit: number;
  };
  impact: {
    revenue_delta: number;
    expenses_delta: number;
    profit_delta: number;
  };
  projected: {
    revenue: number;
    expenses: number;
    profit: number;
  };
  confidence: number;
}
