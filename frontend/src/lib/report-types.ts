/**
 * Type definitions for the comprehensive portfolio report
 * returned by `GET /api/v1/reports/portfolio?year=&currency=`.
 */

export interface KpiValue {
  previous: number;
  current: number;
  change_pct: number | null;
}

export interface PropertyCard {
  property_id: string;
  property_name: string;
  gross_revenue: number;
  net_revenue: number;
  total_expenses: number;
  profit: number;
  profit_margin: number;
  health_score?: number | null;
}

export interface PropertyPerformance extends PropertyCard {
  reservation_count: number;
}

export interface MonthlyBreakdown {
  month: number;
  year: number;
  gross_revenue: number;
  net_revenue: number;
  total_expenses: number;
  cashflow: number;
  profit: number;
  reservation_count: number;
}

export interface ExpenseCategory {
  category_name: string;
  total: number;
  percentage: number;
  count: number;
  growth_pct?: number | null;
}

export interface RiskItem {
  level: "high" | "medium";
  title: string;
  detail: string;
}

export interface ReportPeriodInfo {
  start: string;
  end: string;
  label: string;
  days: number;
}

export interface PortfolioReport {
  report_type: string;
  year: number;
  period?: ReportPeriodInfo;
  previous_period?: ReportPeriodInfo;
  generated_at: string;
  organization: string;
  currency: string;
  period_start: string;
  period_end: string;
  executive_summary: {
    period_start: string;
    period_end: string;
    gross_revenue: number;
    net_profit: number;
    profit_margin: number;
    property_count: number;
    best_property: PropertyCard | null;
    worst_property: PropertyCard | null;
    portfolio_health_score: number;
    portfolio_health_status: string;
  };
  ai_insights: {
    provider?: string;
    summary: string;
    revenue_change_pct: number | null;
    drivers: { label: string; detail: string }[];
    biggest_risk: {
      level?: string;
      title?: string;
      cause?: string;
      suggested_action?: string;
    } | null;
    recommendation: string;
    recommendations: unknown[];
  };
  kpi_comparison: {
    revenue: KpiValue;
    profit: KpiValue;
    expenses: KpiValue;
  };
  property_performance: PropertyPerformance[];
  monthly_breakdown: MonthlyBreakdown[];
  expense_analysis: {
    categories: ExpenseCategory[];
    biggest: ExpenseCategory | null;
    smallest: ExpenseCategory | null;
    fastest_growing: ExpenseCategory | null;
  };
  best_worst_properties: { best: PropertyCard | null; worst: PropertyCard | null };
  risks: RiskItem[];
  goals: {
    revenue: { goal: number; current: number; progress: number };
  };
  forecast: {
    next_quarter_revenue: number;
    confidence: number;
  };
  portfolio_health: {
    score: number;
    status: string;
    components: {
      revenue: number;
      profit: number;
      expenses: number;
      revenue_change_pct: number;
    };
    distribution: {
      excellent: number;
      good: number;
      average: number;
      poor: number;
    };
  };
  tax_summary: {
    rental_income: number;
    deductible_expenses: number;
    estimated_taxable_income: number;
  };
}
