"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";

// ── Financial Summary ──────────────────────────────────

export function useFinancialSummary(organizationId?: string, startDate?: string, endDate?: string) {
  let query = `/finance/${organizationId}/summary`;
  const params = new URLSearchParams();
  if (startDate) params.append("start_date", startDate);
  if (endDate) params.append("end_date", endDate);
  const qs = params.toString();
  if (qs) query += `?${qs}`;

  return useQuery<any>({
    queryKey: ["financial-summary", organizationId, startDate, endDate],
    queryFn: () => api.get(query),
    enabled: !!organizationId,
  });
}

// ── Monthly Report ─────────────────────────────────────

export function useMonthlyReport(organizationId?: string, year?: number, month?: number) {
  return useQuery<any>({
    queryKey: ["monthly-report", organizationId, year, month],
    queryFn: () =>
      api.get(`/finance/${organizationId}/report/monthly?year=${year}&month=${month}`),
    enabled: !!organizationId && !!year && !!month,
  });
}

// ── Annual Report ──────────────────────────────────────

export function useAnnualReport(organizationId?: string, year?: number) {
  return useQuery<any>({
    queryKey: ["annual-report", organizationId, year],
    queryFn: () =>
      api.get(`/finance/${organizationId}/report/annual?year=${year}`),
    enabled: !!organizationId && !!year,
  });
}

// ── Revenue ────────────────────────────────────────────

export function useRevenue(organizationId?: string, filters?: Record<string, string>) {
  const params = new URLSearchParams(filters || {});
  const qs = params.toString();
  return useQuery<any>({
    queryKey: ["revenue", organizationId, filters],
    queryFn: () => api.get(`/finance/${organizationId}/revenue${qs ? `?${qs}` : ""}`),
    enabled: !!organizationId,
  });
}

export function useCreateRevenue(organizationId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: unknown) => api.post(`/finance/${organizationId}/revenue`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["revenue"] });
      queryClient.invalidateQueries({ queryKey: ["financial-summary"] });
      queryClient.invalidateQueries({ queryKey: ["monthly-report"] });
      queryClient.invalidateQueries({ queryKey: ["annual-report"] });
    },
  });
}

// ── Expense ────────────────────────────────────────────

export function useExpenses(organizationId?: string, filters?: Record<string, string>) {
  const params = new URLSearchParams(filters || {});
  const qs = params.toString();
  return useQuery<any>({
    queryKey: ["expenses", organizationId, filters],
    queryFn: () => api.get(`/finance/${organizationId}/expense${qs ? `?${qs}` : ""}`),
    enabled: !!organizationId,
  });
}

export function useCreateExpense(organizationId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: unknown) => api.post(`/finance/${organizationId}/expense`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["expenses"] });
      queryClient.invalidateQueries({ queryKey: ["financial-summary"] });
      queryClient.invalidateQueries({ queryKey: ["monthly-report"] });
      queryClient.invalidateQueries({ queryKey: ["annual-report"] });
    },
  });
}

// ── AI Advisor ─────────────────────────────────────────

export function useAIAnalysis(organizationId?: string) {
  return useQuery<any>({
    queryKey: ["ai-analysis", organizationId],
    queryFn: () => api.get(`/ai/${organizationId}/analyze`),
    enabled: !!organizationId,
  });
}

// ── Properties ─────────────────────────────────────────

export function useProperties(organizationId?: string) {
  return useQuery<any>({
    queryKey: ["properties", organizationId],
    queryFn: () => api.get(`/properties/${organizationId}`),
    enabled: !!organizationId,
  });
}

// ── Analytics ──────────────────────────────────────────

export function usePropertyAnalytics(organizationId?: string, propertyId?: string, year?: number) {
  return useQuery<any>({
    queryKey: ["property-analytics", organizationId, propertyId, year],
    queryFn: () =>
      api.get(`/analytics/${organizationId}/property/${propertyId}?year=${year}`),
    enabled: !!organizationId && !!propertyId && !!year,
  });
}

export function usePortfolioAnalytics(organizationId?: string, year?: number) {
  return useQuery<any>({
    queryKey: ["portfolio-analytics", organizationId, year],
    queryFn: () => api.get(`/analytics/${organizationId}/portfolio?year=${year}`),
    enabled: !!organizationId && !!year,
  });
}

export function usePropertyHealth(organizationId?: string, propertyId?: string) {
  return useQuery<any>({
    queryKey: ["property-health", organizationId, propertyId],
    queryFn: () =>
      api.get(`/analytics/${organizationId}/property/${propertyId}/health`),
    enabled: !!organizationId && !!propertyId,
  });
}
