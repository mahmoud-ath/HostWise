"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/contexts/auth-context";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Loader2, Server, Database, Brain, Rocket } from "lucide-react";

const WELCOME_KEY = "hostwise_welcome_shown_v2";

interface SetupStep {
  id: string;
  label: string;
  icon: React.ReactNode;
  status: "pending" | "running" | "done";
}

const SETUP_STEPS: SetupStep[] = [
  { id: "workspace", label: "Preparing workspace", icon: <Server className="h-4 w-4" />, status: "pending" },
  { id: "database", label: "Creating database", icon: <Database className="h-4 w-4" />, status: "pending" },
  { id: "modules", label: "Loading AI modules", icon: <Brain className="h-4 w-4" />, status: "pending" },
  { id: "ready", label: "Ready!", icon: <Rocket className="h-4 w-4" />, status: "pending" },
];

async function waitForBackend(retries = 30): Promise<boolean> {
  for (let i = 0; i < retries; i++) {
    try {
      const resp = await fetch("http://127.0.0.1:8000/api/health");
      if (resp.ok) return true;
    } catch {}
    await new Promise(r => setTimeout(r, 500));
  }
  return false;
}

export function WelcomeWizard() {
  const { login } = useAuth();
  const [show, setShow] = useState(false);
  const [steps, setSteps] = useState<SetupStep[]>(SETUP_STEPS);
  const [currentStep, setCurrentStep] = useState(0);
  const [finished, setFinished] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const shown = localStorage.getItem(WELCOME_KEY);
    if (!shown) {
      setShow(true);
    }
  }, []);

  const runSteps = useCallback(async () => {
    // Step 0: Wait for backend
    setCurrentStep(0);
    setSteps(prev => prev.map((s, i) => ({ ...s, status: i === 0 ? "running" : "pending" } as SetupStep)));
    const backendReady = await waitForBackend();
    if (!backendReady) {
      setError("Could not connect to the backend. Please restart the app.");
      return;
    }
    setSteps(prev => prev.map((s, i) => ({ ...s, status: i <= 0 ? "done" : "pending" } as SetupStep)));

    // Step 1: Initialize database (create default user & org)
    setCurrentStep(1);
    setSteps(prev => prev.map((s, i) => ({ ...s, status: i < 1 ? "done" : i === 1 ? "running" : "pending" } as SetupStep)));
    try {
      const initResp = await fetch("http://127.0.0.1:8000/api/v1/setup/initialize", { method: "POST" });
      if (!initResp.ok) throw new Error("Setup failed");
    } catch (err) {
      setError("Failed to initialize the database.");
      return;
    }
    setSteps(prev => prev.map((s, i) => ({ ...s, status: i <= 1 ? "done" : "pending" } as SetupStep)));

    // Step 2: Auto-login
    setCurrentStep(2);
    setSteps(prev => prev.map((s, i) => ({ ...s, status: i < 2 ? "done" : i === 2 ? "running" : "pending" } as SetupStep)));
    try {
      await login("admin@hostwise.local", "hostwise_default");
    } catch (err) {
      setError("Auto-login failed. Please restart the app.");
      return;
    }
    setSteps(prev => prev.map((s, i) => ({ ...s, status: i <= 2 ? "done" : "pending" } as SetupStep)));

    // Step 3: Done
    setCurrentStep(3);
    setSteps(prev => prev.map((s, i) => ({ ...s, status: i <= 3 ? "done" : "pending" } as SetupStep)));
    setFinished(true);
    localStorage.setItem(WELCOME_KEY, "true");
  }, [login]);

  useEffect(() => {
    if (show) runSteps();
  }, [show, runSteps]);

  const handleFinish = () => {
    setShow(false);
  };

  if (!show) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background">
      <div className="max-w-md w-full mx-4">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary/10 mb-4">
            <Rocket className="h-8 w-8 text-primary" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight">HostWise</h1>
          <p className="text-muted-foreground mt-2">
            AI-powered financial intelligence for your vacation rentals
          </p>
        </div>

        {/* Setup Steps */}
        <div className="space-y-3 mb-8">
          {steps.map((step, i) => (
            <div
              key={step.id}
              className={`flex items-center gap-3 p-3 rounded-lg border transition-colors ${
                step.status === "running"
                  ? "border-primary bg-primary/5"
                  : step.status === "done"
                  ? "border-emerald-200 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950/30"
                  : "border-border"
              }`}
            >
              <div className="flex-shrink-0">
                {step.status === "running" ? (
                  <Loader2 className="h-5 w-5 animate-spin text-primary" />
                ) : step.status === "done" ? (
                  <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                ) : (
                  <div className="h-5 w-5 rounded-full border-2 border-muted-foreground/30" />
                )}
              </div>
              <span
                className={`text-sm font-medium ${
                  step.status === "running"
                    ? "text-primary"
                    : step.status === "done"
                    ? "text-emerald-700 dark:text-emerald-300"
                    : "text-muted-foreground"
                }`}
              >
                {step.label}
              </span>
              {step.icon && (
                <span className="ml-auto text-muted-foreground/50">{step.icon}</span>
              )}
            </div>
          ))}
        </div>

        {/* Progress bar */}
        <div className="w-full bg-secondary rounded-full h-1.5 mb-6">
          <div
            className="bg-primary h-1.5 rounded-full transition-all duration-500"
            style={{ width: `${((currentStep + 1) / steps.length) * 100}%` }}
          />
        </div>

        {/* Error state */}
        {error && (
          <div className="text-center animate-in fade-in">
            <p className="text-sm text-red-600 dark:text-red-400 mb-4">{error}</p>
            <Button size="lg" onClick={() => { setError(null); runSteps(); }} className="w-full" variant="outline">
              Retry
            </Button>
          </div>
        )}

        {/* Finish button */}
        {finished && !error && (
          <div className="text-center animate-in fade-in slide-in-from-bottom-2 duration-500">
            <p className="text-sm text-muted-foreground mb-4">
              Your workspace is ready. Let's get started!
            </p>
            <Button size="lg" onClick={handleFinish} className="w-full">
              Get Started
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
