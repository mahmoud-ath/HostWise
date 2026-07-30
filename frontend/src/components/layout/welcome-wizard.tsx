"use client";

import { useState, useEffect } from "react";
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

export function WelcomeWizard() {
  const [show, setShow] = useState(false);
  const [steps, setSteps] = useState<SetupStep[]>(SETUP_STEPS);
  const [currentStep, setCurrentStep] = useState(0);
  const [finished, setFinished] = useState(false);

  useEffect(() => {
    const shown = localStorage.getItem(WELCOME_KEY);
    if (!shown) {
      setShow(true);
    }
  }, []);

  useEffect(() => {
    if (!show) return;

    const runSteps = async () => {
      for (let i = 0; i < steps.length; i++) {
        setCurrentStep(i);
        setSteps(prev => prev.map((s, idx) => ({
          ...s,
          status: idx < i ? "done" : idx === i ? "running" : "pending",
        } as SetupStep)));

        // Simulate each step taking some time
        await new Promise(r => setTimeout(r, 600 + Math.random() * 400));
      }

      setSteps(prev => prev.map(s => ({ ...s, status: "done" } as SetupStep)));
      setFinished(true);
      localStorage.setItem(WELCOME_KEY, "true");
    };

    runSteps();
  }, [show]);

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

        {/* Finish button */}
        {finished && (
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
