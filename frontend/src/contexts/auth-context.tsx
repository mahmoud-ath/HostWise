"use client";

import { createContext, useContext, ReactNode } from "react";
import { useSettings } from "@/contexts/settings-context";

/**
 * Profile context — there is NO authentication in HostWise.
 * The app is local-first and single-user: the owner's name and email are
 * stored as application settings and exposed here for the UI.
 */

interface Profile {
  id: string;
  email: string;
  full_name: string;
  is_active: boolean;
  avatar_url: string | null;
}

interface AuthContextType {
  user: Profile | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const { get, ready } = useSettings();

  const full_name = get("profile_name", "") || get("business_name", "HostWise User");
  const email = get("profile_email", "");

  const user: Profile = {
    id: "local",
    email,
    full_name,
    is_active: true,
    avatar_url: null,
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: true,
        isLoading: !ready,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
