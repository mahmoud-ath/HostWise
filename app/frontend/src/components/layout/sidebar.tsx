"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Building2,
  DollarSign,
  BarChart3,
  Brain,
  FileText,
  Upload,
  Settings,
  BookOpen,
  MessageSquare,
} from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import { useTheme } from "next-themes";
import { useI18n } from "@/lib/i18n";
import { Logo } from "./logo";

const navItems = [
  { href: "/", key: "nav.dashboard", icon: LayoutDashboard },
  { href: "/properties", key: "nav.properties", icon: Building2 },
  { href: "/finance", key: "nav.finance", icon: DollarSign },
  { href: "/analytics", key: "nav.analytics", icon: BarChart3 },
  { href: "/ai-advisor", key: "nav.aiAdvisor", icon: Brain },
  { href: "/reports", key: "nav.reports", icon: FileText },
  { href: "/import", key: "nav.importData", icon: Upload },
  { href: "/guide", key: "nav.guide", icon: BookOpen },
  { href: "/settings", key: "nav.settings", icon: Settings },
  { href: "/feedback", key: "nav.feedback", icon: MessageSquare },
];

export function Sidebar() {
  const pathname = usePathname();
  const { user } = useAuth();
  const { t } = useI18n();


  return (
    <aside className="hidden lg:flex lg:flex-col lg:w-64 lg:fixed lg:inset-y-0 lg:start-0 border-e bg-card">
      {/* Logo */}
      <div className="flex items-center h-16 px-6 border-b gap-2">
        <Logo size={30} />
        <span className="text-xl font-bold">HostWise</span>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center px-3 py-2 rounded-md text-sm font-medium transition-colors",
                isActive
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
              )}
            >
              <Icon className="h-4 w-4 me-3" />
              {t(item.key)}
            </Link>
          );
        })}
      </nav>

      {/* User */}
      <div className="p-4 border-t">
        <div className="min-w-0">
          <p className="text-sm font-medium truncate">{user?.business_name || user?.full_name}</p>
          <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
        </div>
      </div>
    </aside>
  );
}
