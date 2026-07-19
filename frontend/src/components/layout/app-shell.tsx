"use client";

import { ReactNode } from "react";
import { Sidebar } from "./sidebar";
import { useAuth } from "@/contexts/auth-context";
import { Button } from "@/components/ui/button";
import { Home } from "lucide-react";
import Link from "next/link";

export function AppShell({ children }: { children: ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <>{children}</>;
  }

  return (
    <div className="min-h-screen bg-background">
      <Sidebar />
      {/* Mobile header */}
      <div className="lg:hidden flex items-center h-14 px-4 border-b">
        <Link href="/" className="flex items-center">
          <Home className="h-5 w-5 text-primary mr-2" />
          <span className="font-bold">HostWise</span>
        </Link>
      </div>
      {/* Main content */}
      <main className="lg:pl-64">
        <div className="p-6 max-w-7xl mx-auto">{children}</div>
      </main>
    </div>
  );
}
