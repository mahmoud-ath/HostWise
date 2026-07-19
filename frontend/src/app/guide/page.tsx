"use client";

import { useAuth } from "@/contexts/auth-context";
import { AppShell } from "@/components/layout/app-shell";
import { LoginPage } from "@/components/auth/login-page";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { usePathname, useSearchParams } from "next/navigation";
import {
  LayoutDashboard, Building2, DollarSign, BarChart3, Brain, FileText, Upload, Settings,
  Lightbulb, ArrowRight, TrendingUp, Target, AlertTriangle, CheckCircle,
} from "lucide-react";

const guides: Record<string, {
  title: string;
  description: string;
  sections: { icon: React.ReactNode; title: string; content: string; example?: string }[];
}> = {
  "/": {
    title: "Dashboard Guide",
    description: "Your command center — see your entire portfolio at a glance.",
    sections: [
      { icon: <TrendingUp className="h-5 w-5 text-success" />, title: "KPI Cards", content: "Five key metrics summarizing your portfolio: Gross Revenue (total earned), Net Revenue (after commissions), Profit Margin (efficiency), Cashflow (Net − Expenses), and Property Count.", example: "Margin of 88% means $0.88 of every dollar earned is profit." },
      { icon: <BarChart3 className="h-5 w-5 text-primary" />, title: "Revenue vs Expenses Chart", content: "Bar chart comparing monthly revenue (red bars) against expenses (teal bars). Look for months where expenses spike above revenue — those need investigation.", example: "If December shows $25K revenue but $18K expenses, check why costs are high that month." },
      { icon: <Brain className="h-5 w-5 text-amber-500" />, title: "AI Recommendations", content: "The AI Financial Advisor scans your data and surfaces issues with confidence scores. Red = critical, yellow = warning, green = positive.", example: "\"High Cleaning Costs\" with 80% confidence → consider renegotiating your cleaning service." },
      { icon: <Target className="h-5 w-5 text-primary" />, title: "Expense Breakdown", content: "Shows where your money goes by category. If one category dominates, drill into it.", example: "\"Uncategorized\" at 100% means expenses lack categories — assign them for better insights." },
    ],
  },
  "/properties": {
    title: "Properties Guide",
    description: "Manage your vacation rental portfolio — one property can have multiple listings across platforms.",
    sections: [
      { icon: <Building2 className="h-5 w-5 text-primary" />, title: "Property Cards", content: "Each card shows a property's name, type, location, bedrooms, max guests, and a Health Score (0-100). Green = healthy (75+), yellow = average (50-74), red = concerning.", example: "A score of 85 means the property is performing well on occupancy, revenue, and cost control." },
      { icon: <ArrowRight className="h-5 w-5 text-primary" />, title: "Adding Properties", content: "Click \"Add Property\" to register a new rental. Fill in name, type (apartment, villa, cabin, etc.), city, country, bedrooms, bathrooms, and guest capacity.", example: "Add \"Beach Studio\" as type \"studio\", 1 bedroom, 2 guests, located in Agadir, Morocco." },
      { icon: <Lightbulb className="h-5 w-5 text-amber-500" />, title: "Health Score", content: "Computed from occupancy vs target, profit margin, cancellation rate, and expense ratio. Each factor contributes to the total out of 100.", example: "A property at 95% target occupancy with 40% margin and <5% cancellations scores 90+." },
    ],
  },
  "/finance": {
    title: "Finance Guide",
    description: "Track every dollar — record revenue and expenses, see your cashflow in real time.",
    sections: [
      { icon: <DollarSign className="h-5 w-5 text-success" />, title: "Revenue Tracking", content: "Record income from each property. Each entry includes date, property, gross amount, commission, and description. Net amount is auto-calculated.", example: "A $2,000 booking with 15% ($300) commission → $1,700 net revenue." },
      { icon: <DollarSign className="h-5 w-5 text-destructive" />, title: "Expense Tracking", content: "Record costs per property: cleaning, maintenance, utilities, platform fees, etc. Each entry tracks vendor, payment method, and amount.", example: "Record \"$179 Maintenance\" for Ocean View Apartment on Jan 25, vendor \"HandyFix\"." },
      { icon: <TrendingUp className="h-5 w-5 text-primary" />, title: "Summary Cards", content: "Top cards show your overall financial health: Gross, Net, Expenses, Cashflow, and Margin across all properties.", example: "Cashflow = Net Revenue − Total Expenses. Positive means you're earning more than you spend." },
    ],
  },
  "/analytics": {
    title: "Analytics Guide",
    description: "Deep-dive into performance metrics — occupancy, ADR, RevPAR, and property rankings.",
    sections: [
      { icon: <BarChart3 className="h-5 w-5 text-primary" />, title: "Portfolio KPIs", content: "Four key metrics: Property Count, Net Revenue, Profit Margin, and Average Revenue per Property.", example: "$43K avg/property with 6 properties means your portfolio is well-diversified." },
      { icon: <TrendingUp className="h-5 w-5 text-success" />, title: "Seasonality Chart", content: "Monthly revenue bars show which months perform best. Use this to plan pricing strategy.", example: "If August is consistently high (summer peak) and January low, adjust pricing 10-15% seasonally." },
      { icon: <Target className="h-5 w-5 text-primary" />, title: "Property Ranking", content: "Properties ranked by net revenue. Identify top performers to replicate their strategy, and bottom performers to investigate.", example: "#1 property earns 8× more than #6 — check if the underperformer has listing issues or low occupancy." },
    ],
  },
  "/ai-advisor": {
    title: "AI Advisor Guide",
    description: "AI-powered financial analysis with actionable recommendations and confidence scores.",
    sections: [
      { icon: <Brain className="h-5 w-5 text-primary" />, title: "Executive Summary", content: "Natural-language overview of your portfolio's financial health — revenue, margin, growth trends.", example: "\"Portfolio generated $260K with 88% margin. 2 areas could be improved.\"" },
      { icon: <AlertTriangle className="h-5 w-5 text-amber-500" />, title: "Recommendations", content: "Each recommendation includes: Cause (what's happening), Impact (business effect), Action (what to do), Expected improvement (projected gain), and Confidence score.", example: "\"Reduce weekday pricing by 8%\" with 82% confidence → estimated $6,800 annual gain." },
      { icon: <Lightbulb className="h-5 w-5 text-amber-500" />, title: "Confidence Scores", content: "How reliable each recommendation is, from 0-100%. Higher scores mean stronger data backing.", example: "95% confidence = strong pattern detected. 60% = suggestive but needs more data." },
    ],
  },
  "/reports": {
    title: "Reports Guide",
    description: "Generate financial reports — monthly breakdowns, annual summaries, and YoY comparisons.",
    sections: [
      { icon: <FileText className="h-5 w-5 text-primary" />, title: "Annual vs Monthly", content: "Toggle between full-year overview and any specific month. Annual shows YoY growth and best/worst months. Monthly shows category breakdowns for that month.", example: "Annual report shows 12-month trends; December monthly report shows holiday season performance." },
      { icon: <BarChart3 className="h-5 w-5 text-primary" />, title: "Revenue by Property", content: "Table showing each property's net revenue, profit, and margin. Use this to compare performance across your portfolio.", example: "\"Sunset Villa: $52K net, 78% margin\" vs \"Medina Riad: $6K net, 45% margin\" — clear underperformer." },
      { icon: <TrendingUp className="h-5 w-5 text-success" />, title: "Year-over-Year Growth", content: "Compares current year revenue to previous year. Positive = growth, negative = decline.", example: "+15% YoY growth means your portfolio earned 15% more this year than last." },
    ],
  },
  "/import": {
    title: "Import Guide",
    description: "Bring data into HostWise from CSV files or future booking platform connectors.",
    sections: [
      { icon: <Upload className="h-5 w-5 text-primary" />, title: "CSV Upload", content: "Upload reservation, revenue, or expense data from spreadsheets. Drop a CSV file, preview columns, then import into the database.", example: "Upload a CSV with columns: property_id, date, gross_amount, status → data maps to your properties automatically." },
      { icon: <ArrowRight className="h-5 w-5 text-primary" />, title: "Connectors", content: "Future integrations with Airbnb, Booking.com, Vrbo, Guesty, Hostaway. Each connector auto-syncs data on a schedule.", example: "Connect Airbnb API → reservations, revenue, and reviews auto-import daily." },
      { icon: <Lightbulb className="h-5 w-5 text-amber-500" />, title: "CSV Format", content: "Required columns depend on the data type. Reservations need: property_id, check_in, check_out, gross_amount. Use the preview to verify before importing.", example: "Download your Airbnb transaction history CSV, upload here, and all bookings appear in Finance." },
    ],
  },
  "/settings": {
    title: "Settings Guide",
    description: "Configure your account, organization, and view API connection details.",
    sections: [
      { icon: <Settings className="h-5 w-5 text-primary" />, title: "Account", content: "Your name, email, and sign-out option. Account settings are personal — they don't affect other organization members.", example: "Sign out to switch accounts or secure your session on a shared device." },
      { icon: <Building2 className="h-5 w-5 text-primary" />, title: "Organization", content: "Organization name, type (individual host, property manager, agency), currency, and slug. These settings apply to all members.", example: "Set currency to MAD (Moroccan Dirham) if all your properties are in Morocco." },
      { icon: <ArrowRight className="h-5 w-5 text-primary" />, title: "API Connection", content: "Backend URL, auth method, and your organization ID. Useful for debugging or building custom integrations.", example: "Use the Org ID to make API calls from external tools like Zapier or custom scripts." },
    ],
  },
};

export default function GuidePage() {
  const { isAuthenticated } = useAuth();

  if (!isAuthenticated) return <LoginPage />;

  return (
    <AppShell>
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Guide</h1>
          <p className="text-muted-foreground mt-1">
            Everything you need to know about HostWise — all features explained in one place.
          </p>
        </div>

        {Object.entries(guides).map(([path, guide]) => (
          <div key={path}>
            <div className="flex items-center gap-2 mb-1">
              <Badge variant="secondary" className="font-medium">{guide.title.replace(" Guide", "")}</Badge>
              <span className="text-xs text-muted-foreground">→ {path === "/" ? "dashboard" : path}</span>
            </div>
            <p className="text-sm text-muted-foreground mb-4">{guide.description}</p>
            <div className="grid gap-3 md:grid-cols-2">
              {guide.sections.map((section, i) => (
                <Card key={i}>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-sm">
                      {section.icon}
                      {section.title}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <p className="text-xs text-muted-foreground leading-relaxed">{section.content}</p>
                    {section.example && (
                      <div className="mt-2 p-2 rounded bg-muted/50 border">
                        <p className="text-[11px] font-medium text-primary mb-0.5 flex items-center gap-1">
                          <CheckCircle className="h-3 w-3" /> Example
                        </p>
                        <p className="text-[11px] text-muted-foreground italic">"{section.example}"</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
            {path !== Object.keys(guides).slice(-1)[0] && (
              <hr className="mt-6 border-border" />
            )}
          </div>
        ))}
      </div>
    </AppShell>
  );
}
