"use client";

import { Component, ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { AlertTriangle, RefreshCw, FolderOpen } from "lucide-react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("HostWise UI Error:", error, errorInfo);
  }

  handleRestart = () => {
    this.setState({ hasError: false, error: undefined });
  };

  handleOpenLogs = async () => {
    if (typeof window !== "undefined" && "__TAURI_INTERNALS__" in window) {
      try {
        const { invoke } = await import("@tauri-apps/api/core");
        const logDir = await invoke<string>("get_log_dir");
        const { open } = await import("@tauri-apps/plugin-shell");
        await open(logDir);
      } catch {
        // Fallback
      }
    }
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center min-h-screen p-8 bg-background">
          <div className="max-w-md text-center space-y-6">
            <div className="flex justify-center">
              <div className="p-4 rounded-full bg-red-100 dark:bg-red-900/30">
                <AlertTriangle className="h-12 w-12 text-red-600" />
              </div>
            </div>
            <h1 className="text-2xl font-bold">Oops!</h1>
            <p className="text-muted-foreground">
              HostWise encountered an unexpected error. A crash report has been saved to the logs.
            </p>
            {this.state.error && (
              <details className="text-left text-xs text-muted-foreground bg-muted p-3 rounded-md max-h-32 overflow-auto">
                <summary className="cursor-pointer font-medium">Technical details</summary>
                <pre className="mt-2 whitespace-pre-wrap">{this.state.error.message}</pre>
              </details>
            )}
            <div className="flex gap-3 justify-center">
              <Button onClick={this.handleRestart} className="gap-2">
                <RefreshCw className="h-4 w-4" /> Restart App
              </Button>
              <Button variant="outline" onClick={this.handleOpenLogs} className="gap-2">
                <FolderOpen className="h-4 w-4" /> Open Logs
              </Button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
