"use client";

import { useState } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useI18n } from "@/lib/i18n";
import { useSettings } from "@/contexts/settings-context";
import { MessageSquare, Mail, Send, CheckCircle2, RefreshCcw } from "lucide-react";

const CATEGORIES = ["Bug report", "Feature request", "Question", "Other"];
const SUPPORT_EMAIL = "markuspub4@gmail.com";
;

export default function FeedbackPage() {
  const { t } = useI18n();
  const { get } = useSettings();
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [email, setEmail] = useState(() => get("profile_email", "") as string);
  const [message, setMessage] = useState("");
  const [sent, setSent] = useState(false);

  const buildBody = () =>
    [`Category: ${category}`, `Email: ${email || "—"}`, `Date: ${new Date().toLocaleString()}`, "", message].join(
      "\n"
    );

  const mailtoHref = `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(
    `[HostWise] ${category}`
  )}&body=${encodeURIComponent(buildBody())}`;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const existing = JSON.parse(localStorage.getItem("hostwise_feedback") || "[]");
      existing.push({ id: Date.now(), category, email, message, date: new Date().toISOString() });
      localStorage.setItem("hostwise_feedback", JSON.stringify(existing));
    } catch {
      // ignore storage errors
    }
    // Compose the email in the user's mail client — the OS/browser mailto handler
    // opens the app (e.g. Outlook, Mail, Gmail) with the draft ready to send.
    window.location.href = mailtoHref;
    setSent(true);
  };

  return (
    <AppShell>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t("pages.feedback.title")}</h1>
          <p className="text-muted-foreground mt-1">{t("pages.feedback.subtitle")}</p>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MessageSquare className="h-5 w-5 text-primary" /> Send Feedback
              </CardTitle>
              <CardDescription>
                We open a pre-filled email in your mail app — review it and press send. A copy is also saved on this
                device.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {sent ? (
                <div className="space-y-4">
                  <div className="rounded-lg border border-emerald-600/30 bg-emerald-50 p-4 text-sm text-emerald-700">
                    <p className="flex items-center gap-1.5 font-medium">
                      <CheckCircle2 className="h-4 w-4" /> Your email draft is ready!
                    </p>
                    <p className="mt-1">
                      Your mail app should have opened with the message pre-filled. Just press send there — the
                      feedback goes straight to us.
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <a
                      href={mailtoHref}
                      className="inline-flex h-9 items-center gap-1.5 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
                    >
                      <Mail className="h-4 w-4" /> Re-open email draft
                    </a>
                    <Button variant="outline" size="sm" onClick={() => { setSent(false); setMessage(""); }}>
                      <RefreshCcw className="mr-1.5 h-4 w-4" /> Send another
                    </Button>
                  </div>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <Label className="text-xs">Category</Label>
                      <select
                        value={category}
                        onChange={(e) => setCategory(e.target.value)}
                        className="mt-1 flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                      >
                        {CATEGORIES.map((c) => (
                          <option key={c} value={c}>{c}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <Label className="text-xs">Your email</Label>
                      <Input
                        type="email"
                        className="mt-1"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="you@example.com"
                      />
                    </div>
                  </div>
                  <div>
                    <Label className="text-xs">Message</Label>
                    <textarea
                      required
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      placeholder="Tell us what happened, what you'd like to see, or how we can help…"
                      className="mt-1 min-h-[140px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    />
                  </div>
                  <Button type="submit" size="sm">
                    <Send className="mr-1.5 h-4 w-4" /> Submit Feedback
                  </Button>
                </form>
              )}
            </CardContent>
          </Card>

          <Card className="h-fit">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Mail className="h-5 w-5 text-primary" /> Contact Us
              </CardTitle>
              <CardDescription>Prefer email? Reach us directly.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <a
                href={`mailto:${SUPPORT_EMAIL}`}
                className="flex items-center gap-2 font-medium text-primary hover:underline"
              >
                <Mail className="h-4 w-4" /> {SUPPORT_EMAIL}
              </a>
              <p className="text-xs text-muted-foreground leading-relaxed">
                We usually respond within 1–2 business days. Include your business name and the issue you saw so we
                can help faster.
              </p>
              <div className="rounded-lg bg-muted/40 p-3 text-xs text-muted-foreground">
                HostWise is a local-first app — your data stays on your device. Feedback is stored locally and never
                leaves your machine unless you email it to us.
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </AppShell>
  );
}
