"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { PortfolioReport, ReportPeriod } from "@/lib/report-types";
import type { AdvisorReport, ChatResult, ScenarioResult } from "@/lib/ai-types";
import type {
  BackupStatus,
  MaintenanceStatus,
  OptimizeResult,
  LogsResult,
  ResetDemoResult,
} from "@/lib/settings-types";

// ── Domain Types ───────────────────────────────────────

export interface FinancialSummary {
  gross_revenue: number;
  net_revenue: number;
  total_expenses: number;
  cashflow: number;
  profit: number;
  profit_margin: number;
  property_count: number;
  avg_revenue_per_property: number;
}

export interface Revenue {
  id: string;
  property_id: string;
  category_id?: string | null;
  date: string;
  gross_amount: number;
  commission_amount: number;
  net_amount: number;
  source: string;
  currency: string;
  description?: string | null;
  notes?: string | null;
}

export interface Expense {
  id: string;
  property_id: string;
  category_id?: string | null;
  date: string;
  amount: number;
  currency: string;
  vendor?: string | null;
  payment_method?: string | null;
  description?: string | null;
  is_recurring: boolean;
}

export interface Property {
  id: string;
  name: string;
  type: string;
  status: string;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  country?: string | null;
  postal_code?: string | null;
  bedrooms: number;
  bathrooms: number;
  max_guests: number;
  square_meters?: number | null;
  acquisition_cost?: number | null;
  monthly_mortgage?: number | null;
  target_occupancy?: number | null;
  target_annual_revenue?: number | null;
  notes?: string | null;
  listings?: unknown[];
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

export interface CategoryBreakdown {
  category_name: string;
  total: number;
  percentage: number;
  count: number;
}

export interface MonthlyReport {
  month: number;
  year: number;
  summary: FinancialSummary;
  monthly_trend: MonthlyBreakdown[];
  revenue_by_category: CategoryBreakdown[];
  expense_by_category: CategoryBreakdown[];
  revenue_by_property: unknown[];
}

export interface AnnualReport {
  year: number;
  summary: FinancialSummary;
  monthly_breakdown: MonthlyBreakdown[];
  revenue_by_category: CategoryBreakdown[];
  expense_by_category: CategoryBreakdown[];
  revenue_by_property: unknown[];
  yoy_growth: number | null;
}

export interface PropertyRankingItem {
  property_id: string;
  property_name: string;
  net_revenue: number;
  reservation_count: number;
  health_score: number;
  profit_margin: number;
}

export interface PortfolioAnalytics {
  year: number;
  property_count: number;
  gross_revenue: number;
  net_revenue: number;
  total_expenses: number;
  profit: number;
  profit_margin: number;
  avg_revenue_per_property: number;
  revenue_growth_yoy: number | null;
  total_reservations: number;
  avg_stay: number;
  cancellation_rate: number;
  avg_booking_window: number;
  forecast_next_month: number;
  health_distribution: { excellent: number; good: number; average: number; poor: number };
  property_ranking: PropertyRankingItem[];
  expense_categories: { name: string; total: number; percentage: number }[];
  revenue_categories: { name: string; total: number; percentage: number }[];
  seasonality: { month: number; gross_revenue: number; net_revenue: number; reservation_count: number; total_expenses: number }[];
}

export interface AIRecommendation {
  type: "critical" | "warning" | "positive" | "info";
  title: string;
  cause: string;
  business_impact: string;
  suggested_action: string;
  expected_improvement: string;
  confidence_score: number;
}

export interface AIAnalysis {
  executive_summary: string;
  key_metrics: Record<string, number>;
  recommendations: AIRecommendation[];
  critical_count: number;
  warning_count: number;
}

export interface PropertyHealth {
  property_id: string;
  property_name: string;
  health_score: number;
  status: string;
  profit_margin: number;
  cancellation_rate: number;
  expense_ratio: number;
  net_revenue: number;
}

// ── Financial Summary ──────────────────────────────────

export function useFinancialSummary(startDate?: string, endDate?: string) {
  const params = new URLSearchParams();
  if (startDate) params.append("start_date", startDate);
  if (endDate) params.append("end_date", endDate);
  const qs = params.toString();
  return useQuery<FinancialSummary>({
    queryKey: ["financial-summary", startDate, endDate],
    queryFn: () => api.get(`/finance/summary${qs ? `?${qs}` : ""}`),
  });
}

// ── Monthly / Annual Report ────────────────────────────

export function useMonthlyReport(year?: number, month?: number) {
  return useQuery<MonthlyReport>({
    queryKey: ["monthly-report", year, month],
    queryFn: () => api.get(`/finance/report/monthly?year=${year}&month=${month}`),
    enabled: !!year && !!month,
  });
}

export function useAnnualReport(year?: number) {
  return useQuery<AnnualReport>({
    queryKey: ["annual-report", year],
    queryFn: () => api.get(`/finance/report/annual?year=${year}`),
    enabled: !!year,
  });
}

// ── Portfolio Report (Reports page) ────────────────────

export function usePortfolioReport(period: ReportPeriod = {}, currency?: string) {
  const params = new URLSearchParams();
  if (period.year) params.set("year", String(period.year));
  if (period.start) params.set("start_date", period.start);
  if (period.end) params.set("end_date", period.end);
  if (currency) params.set("currency", currency);
  const qs = params.toString();
  return useQuery<PortfolioReport>({
    queryKey: ["portfolio-report", period, currency],
    queryFn: () => api.get(`/reports/portfolio${qs ? `?${qs}` : ""}`),
    enabled: !!period.year || !!(period.start && period.end),
    staleTime: 30_000,
  });
}

// ── Revenue (full CRUD) ────────────────────────────────

const INVALIDATE_FINANCE = [
  "revenue",
  "expenses",
  "financial-summary",
  "monthly-report",
  "annual-report",
  "portfolio-report",
  "ai-advisor",
] as const;

export function useRevenue(filters?: Record<string, string>) {
  const params = new URLSearchParams(filters || {});
  const qs = params.toString();
  return useQuery<Revenue[]>({
    queryKey: ["revenue", filters],
    queryFn: () => api.get(`/finance/revenue${qs ? `?${qs}` : ""}`),
  });
}

export function useCreateRevenue() {
  const queryClient = useQueryClient();
  return useMutation<Revenue, Error, Partial<Revenue>>({
    mutationFn: (data) => api.post("/finance/revenue", data),
    onSuccess: () => {
      INVALIDATE_FINANCE.forEach((k) => queryClient.invalidateQueries({ queryKey: [k] }));
    },
  });
}

export function useUpdateRevenue() {
  const queryClient = useQueryClient();
  return useMutation<Revenue, Error, { id: string; data: Partial<Revenue> }>({
    mutationFn: ({ id, data }) => api.patch(`/finance/revenue/${id}`, data),
    onSuccess: () => {
      INVALIDATE_FINANCE.forEach((k) => queryClient.invalidateQueries({ queryKey: [k] }));
    },
  });
}

/**
 * Delete helper that treats a 404 (record already gone) as success.
 * Makes soft-delete actions idempotent so a stale UI entry can't error.
 */
async function deleteAllowMissing<T>(endpoint: string): Promise<T> {
  try {
    return await api.delete<T>(endpoint);
  } catch (err) {
    if (err instanceof Error && /not found|404/i.test(err.message)) {
      return undefined as unknown as T;
    }
    throw err;
  }
}

export function useDeleteRevenue() {
  const queryClient = useQueryClient();
  return useMutation<void, Error, string>({
    mutationFn: (id) => deleteAllowMissing(`/finance/revenue/${id}`),
    onSuccess: () => {
      INVALIDATE_FINANCE.forEach((k) => queryClient.invalidateQueries({ queryKey: [k] }));
    },
  });
}

// ── Expense (full CRUD) ────────────────────────────────

export function useExpenses(filters?: Record<string, string>) {
  const params = new URLSearchParams(filters || {});
  const qs = params.toString();
  return useQuery<Expense[]>({
    queryKey: ["expenses", filters],
    queryFn: () => api.get(`/finance/expense${qs ? `?${qs}` : ""}`),
  });
}

export function useCreateExpense() {
  const queryClient = useQueryClient();
  return useMutation<Expense, Error, Partial<Expense>>({
    mutationFn: (data) => api.post("/finance/expense", data),
    onSuccess: () => {
      INVALIDATE_FINANCE.forEach((k) => queryClient.invalidateQueries({ queryKey: [k] }));
    },
  });
}

export function useUpdateExpense() {
  const queryClient = useQueryClient();
  return useMutation<Expense, Error, { id: string; data: Partial<Expense> }>({
    mutationFn: ({ id, data }) => api.patch(`/finance/expense/${id}`, data),
    onSuccess: () => {
      INVALIDATE_FINANCE.forEach((k) => queryClient.invalidateQueries({ queryKey: [k] }));
    },
  });
}

export function useDeleteExpense() {
  const queryClient = useQueryClient();
  return useMutation<void, Error, string>({
    mutationFn: (id) => deleteAllowMissing(`/finance/expense/${id}`),
    onSuccess: () => {
      INVALIDATE_FINANCE.forEach((k) => queryClient.invalidateQueries({ queryKey: [k] }));
    },
  });
}

// ── AI Advisor ─────────────────────────────────────────

export function useAIAnalysis() {
  return useQuery<AIAnalysis>({
    queryKey: ["ai-analysis"],
    queryFn: () => api.get("/ai/analyze"),
  });
}

export function useAIAdvisor(year?: number) {
  return useQuery<AdvisorReport>({
    queryKey: ["ai-advisor", year],
    queryFn: () => api.get(`/ai/advisor?year=${year}`),
    enabled: !!year,
    staleTime: 30_000,
  });
}

export function useAIChat() {
  return useMutation<ChatResult, Error, { question: string; year: number }>({
    mutationFn: ({ question, year }) => api.post("/ai/chat", { question, year }),
  });
}

export function useAIScenario() {
  return useMutation<
    ScenarioResult,
    Error,
    { scenario: string; params: Record<string, number>; year: number }
  >({
    mutationFn: ({ scenario, params, year }) =>
      api.post("/ai/scenario", { scenario, params, year }),
  });
}

// ── Backups & Maintenance (Settings) ───────────────────

export function useBackupStatus() {
  return useQuery<BackupStatus>({
    queryKey: ["backup-status"],
    queryFn: () => api.get("/backups/status"),
    staleTime: 30_000,
  });
}

export function useMaintenanceStatus() {
  return useQuery<MaintenanceStatus>({
    queryKey: ["maintenance-status"],
    queryFn: () => api.get("/maintenance/status"),
    staleTime: 30_000,
  });
}

export function useOptimizeDatabase() {
  const queryClient = useQueryClient();
  return useMutation<OptimizeResult, Error>({
    mutationFn: () => api.post("/maintenance/optimize"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["maintenance-status"] });
    },
  });
}

export function useResetDemoData() {
  const queryClient = useQueryClient();
  return useMutation<ResetDemoResult, Error>({
    mutationFn: () => api.post("/maintenance/reset-demo-data"),
    onSuccess: () => {
      queryClient.invalidateQueries();
    },
  });
}

export interface WipeResult {
  deleted: Record<string, number>;
}

/**
 * Full wipe — deletes reservations, revenues, expenses AND properties
 * (settings/profile are kept). Used by the Security section's
 * "Delete Account" action.
 */
export function useWipeAllData() {
  const queryClient = useQueryClient();
  return useMutation<WipeResult, Error>({
    mutationFn: () => api.post<WipeResult>("/settings/wipe"),
    onSuccess: () => {
      queryClient.clear();
    },
  });
}

export function useBackendLogs(lines = 200) {
  return useQuery<LogsResult>({
    queryKey: ["backend-logs", lines],
    queryFn: () => api.get(`/maintenance/logs?lines=${lines}`),
    staleTime: 30_000,
    retry: false,
  });
}

// ── Properties (full CRUD) ─────────────────────────────

export function useProperties() {
  return useQuery<Property[]>({
    queryKey: ["properties"],
    queryFn: () => api.get("/properties"),
  });
}

export function useCreateProperty() {
  const queryClient = useQueryClient();
  return useMutation<Property, Error, Partial<Property>>({
    mutationFn: (data) => api.post("/properties", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["properties"] });
      queryClient.invalidateQueries({ queryKey: ["portfolio-analytics"] });
    },
  });
}

export function useUpdateProperty() {
  const queryClient = useQueryClient();
  return useMutation<Property, Error, { id: string; data: Partial<Property> }>({
    mutationFn: ({ id, data }) => api.patch(`/properties/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["properties"] });
      queryClient.invalidateQueries({ queryKey: ["portfolio-analytics"] });
    },
  });
}

export function useDeleteProperty() {
  const queryClient = useQueryClient();
  return useMutation<void, Error, string>({
    mutationFn: (id) => deleteAllowMissing(`/properties/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["properties"] });
      queryClient.invalidateQueries({ queryKey: ["portfolio-analytics"] });
    },
  });
}

// ── Analytics ──────────────────────────────────────────

export function usePropertyAnalytics(propertyId?: string, year?: number) {
  return useQuery<Record<string, unknown>>({
    queryKey: ["property-analytics", propertyId, year],
    queryFn: () => api.get(`/analytics/property/${propertyId}?year=${year}`),
    enabled: !!propertyId && !!year,
  });
}

export function usePortfolioAnalytics(year?: number) {
  return useQuery<PortfolioAnalytics>({
    queryKey: ["portfolio-analytics", year],
    queryFn: () => api.get(`/analytics/portfolio?year=${year}`),
    enabled: !!year,
  });
}

export function usePropertyHealth(propertyId?: string) {
  return useQuery<PropertyHealth>({
    queryKey: ["property-health", propertyId],
    queryFn: () => api.get(`/analytics/property/${propertyId}/health`),
    enabled: !!propertyId,
  });
}
