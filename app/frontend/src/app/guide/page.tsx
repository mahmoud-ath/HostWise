"use client";

import { AppShell } from "@/components/layout/app-shell";
import { useI18n } from "@/lib/i18n";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Building2, DollarSign, BarChart3, Brain, FileText, Upload, Settings,
  Lightbulb, ArrowRight, TrendingUp, Target, AlertTriangle, CheckCircle,
  Download, Mail, MessageSquare,
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
      { icon: <TrendingUp className="h-5 w-5 text-success" />, title: "KPI Cards", content: "Six key metrics summarizing your portfolio: Gross Revenue (total earned), Net Revenue (after commissions), Profit Margin (efficiency), Total Expenses, Cashflow (Net − Expenses), and Property Count. Use the period selector above to scope them to a year or a custom range.", example: "Margin of 88% means $0.88 of every dollar earned is profit." },
      { icon: <BarChart3 className="h-5 w-5 text-primary" />, title: "Revenue vs Expenses Chart", content: "Bar chart comparing monthly net revenue against expenses. The period selector lets you view a specific year or a custom date range — every chart and KPI follows it.", example: "If December shows $25K revenue but $18K expenses, check why costs are high that month." },
      { icon: <Brain className="h-5 w-5 text-amber-500" />, title: "AI Recommendations", content: "The AI Financial Advisor scans your data and surfaces issues with confidence scores. By default it uses the built-in rules engine; connect an LLM (DeepSeek, etc.) in Settings for AI-written executive summaries — the badge shows which is active. Red = critical, yellow = warning, green = positive.", example: "\"High Cleaning Costs\" with 80% confidence → consider renegotiating your cleaning service." },
      { icon: <Target className="h-5 w-5 text-primary" />, title: "Expense Breakdown", content: "Shows where your money goes by category. Imported expenses are categorized automatically, so this chart always reflects where your costs actually go.", example: "If Cleaning makes up 45% of total expenses, look for a cheaper provider." },
    ],
  },
  "/properties": {
    title: "Properties Guide",
    description: "Manage your vacation rental portfolio — one property can have multiple listings across platforms.",
    sections: [
      { icon: <Building2 className="h-5 w-5 text-primary" />, title: "Property Cards", content: "Each card shows a property's name, type, location, bedrooms, max guests, and a Health Score (0-100). Green = healthy (75+), yellow = average (50-74), red = concerning.", example: "A score of 85 means the property is performing well on occupancy, revenue, and cost control." },
      { icon: <ArrowRight className="h-5 w-5 text-primary" />, title: "Adding Properties", content: "Click \"Add Property\" to register a new rental. Fill in name, type (apartment, villa, cabin, etc.), city, country, bedrooms, bathrooms, and guest capacity.", example: "Add \"Beach Studio\" as type \"studio\", 1 bedroom, 2 guests, located in Agadir, Morocco." },
      { icon: <Lightbulb className="h-5 w-5 text-amber-500" />, title: "Health Score", content: "Computed from occupancy vs target, profit margin, cancellation rate, and expense ratio. Each factor contributes to the total out of 100.", example: "A property at 95% target occupancy with 40% margin and <5% cancellations scores 90+." },
      { icon: <BarChart3 className="h-5 w-5 text-primary" />, title: "Property Analytics", content: "Click \"Click for analytics\" on a property card to open its modal: key stats plus a combined Monthly Revenue & Expenses chart, so you can compare income and costs month by month.", example: "Beach House: net revenue peaks in July while expenses stay flat — a healthy margin." },
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
    description: "Deep-dive into portfolio performance — KPIs, expense trends, seasonality, and rankings.",
    sections: [
      { icon: <BarChart3 className="h-5 w-5 text-primary" />, title: "Portfolio KPIs", content: "Key metrics for the selected period: Property Count, Net Revenue, Profit Margin, and Average Revenue per Property. Use the period picker to choose a year or a custom range.", example: "$43K avg/property with 6 properties means your portfolio is well-diversified." },
      { icon: <TrendingUp className="h-5 w-5 text-success" />, title: "Expense Trend", content: "Monthly expenses tracked alongside revenue, so you can spot cost spikes by season and plan pricing accordingly.", example: "Utilities spike every August — budget for it ahead of time." },
      { icon: <Target className="h-5 w-5 text-primary" />, title: "Seasonality & Ranking", content: "Monthly revenue bars show which months perform best, and properties are ranked by net revenue. \"Compare with previous period\" measures growth against the equal-length preceding window.", example: "#1 property earns 8× more than #6 — check if the underperformer has listing issues or low occupancy." },
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
    description: "Generate financial reports for a year or any custom date range, and export a professional PDF.",
    sections: [
      { icon: <FileText className="h-5 w-5 text-primary" />, title: "Period & Currency", content: "Pick a year or a custom date range and choose the currency (it defaults to your Business setting). The report compares the period against the equal-length previous period.", example: "Select 01/03/2026 – 30/06/2026 and the report also shows the same window from 2025 for comparison." },
      { icon: <TrendingUp className="h-5 w-5 text-success" />, title: "Performance & AI Insights", content: "KPI comparison, revenue by property, monthly trends, and expense breakdown — plus an AI Executive Insights section (rules engine or your connected LLM) with risks and recommendations.", example: "The AI section flags rising utility costs and suggests a concrete action." },
      { icon: <Download className="h-5 w-5 text-primary" />, title: "PDF Export", content: "\"Generate Report\" renders a clean, print-ready PDF on the backend and downloads it — white background and a professional layout, ready to share.", example: "Generate a PDF and send it to your co-host or accountant." },
    ],
  },
  "/import": {
    title: "Import Guide",
    description: "Bring data into HostWise from CSV files, with ready-to-use sample templates.",
    sections: [
      { icon: <Upload className="h-5 w-5 text-primary" />, title: "CSV Upload", content: "Upload reservation, revenue, or expense data. Drop a .csv file, preview its columns, then import — missing properties are created automatically.", example: "Upload a CSV with columns: property_name, date, gross_revenue → revenue maps to your properties automatically." },
      { icon: <Download className="h-5 w-5 text-primary" />, title: "Sample Templates", content: "On the import page, download the Reservations, Revenues, or Expenses sample CSV and base your own file on it — the columns match the importer exactly.", example: "Download expenses.csv, replace the rows with your costs, and import it back." },
      { icon: <Lightbulb className="h-5 w-5 text-amber-500" />, title: "CSV Format", content: "Required columns depend on the data type — the in-page Import Guide shows them. Dates use the configured format (default DD/MM/YYYY), and expense categories are created automatically.", example: "Import your bookings CSV and every reservation appears in Finance and Analytics." },
    ],
  },
  "/settings": {
    title: "Settings Guide",
    description: "Tune business, AI, data, and system settings — organized in a sidebar of tabs.",
    sections: [
      { icon: <Building2 className="h-5 w-5 text-primary" />, title: "Business", content: "Business name, contact email, country, default currency, language, tax rate, and fiscal year start. These apply across the app.", example: "Set the default currency to MAD so every report formats amounts in Moroccan Dirhams." },
      { icon: <Brain className="h-5 w-5 text-primary" />, title: "AI Settings", content: "Use the built-in rules engine or connect your own LLM (DeepSeek, OpenAI, etc.) with an API key, base URL, and model.", example: "Switch the provider to DeepSeek and paste your key to get LLM-written executive summaries on the dashboard and reports." },
      { icon: <Upload className="h-5 w-5 text-primary" />, title: "Data & Housekeeping", content: "Backup & Restore keeps automatic daily backups; Data Import brings CSVs in; Maintenance optimizes the database, clears cache, views logs, and restarts the backend.", example: "Run Optimize Database from Maintenance to shrink a large SQLite file, or restore a backup after a bad import." },
    ],
  },
  "/feedback": {
    title: "Feedback Guide",
    description: "Share feedback or contact us — straight from the app.",
    sections: [
      { icon: <MessageSquare className="h-5 w-5 text-primary" />, title: "Send Feedback", content: "Pick a category (bug report, feature request, question), add your email and message, then submit. The app opens a pre-filled email in your mail client — just press send.", example: "Report a bug with the steps to reproduce so we can fix it faster." },
      { icon: <Mail className="h-5 w-5 text-primary" />, title: "Contact Us", content: "Prefer email? Reach us directly at support@hostwise.app. We usually respond within 1–2 business days.", example: "Attach a screenshot with your report to help us understand the issue." },
    ],
  },
};

const TAB_ID = (path: string) => (path === "/" ? "dashboard" : path.replace("/", ""));

export default function GuidePage() {
  const { t } = useI18n();

  return (
    <AppShell>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t("pages.guide.title")}</h1>
          <p className="text-muted-foreground mt-1">{t("pages.guide.subtitle")}</p>
        </div>

        <Tabs defaultValue="dashboard" className="space-y-4">
          <TabsList className="flex h-auto flex-wrap gap-1 bg-muted/60 p-1">
            {Object.entries(guides).map(([path, guide]) => (
              <TabsTrigger key={path} value={TAB_ID(path)}>
                {guide.title.replace(" Guide", "")}
              </TabsTrigger>
            ))}
          </TabsList>

          {Object.entries(guides).map(([path, guide]) => (
            <TabsContent key={path} value={TAB_ID(path)} className="mt-4">
              <p className="mb-4 text-sm text-muted-foreground">{guide.description}</p>
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
            </TabsContent>
          ))}
        </Tabs>
      </div>
    </AppShell>
  );
}
