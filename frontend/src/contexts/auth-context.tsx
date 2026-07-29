"use client";

import { createContext, useContext, useState, useCallback, useEffect, ReactNode } from "react";
import { api } from "@/lib/api";

interface User {
  id: string;
  email: string;
  full_name: string;
  is_active: boolean;
  avatar_url: string | null;
}

interface Organization {
  id: string;
  name: string;
  slug: string;
  type: string;
  default_currency: string;
}

interface AuthContextType {
  user: User | null;
  organization: Organization | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, fullName: string) => Promise<void>;
  logout: () => void;
  setOrganization: (org: Organization) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [organization, setOrganizationState] = useState<Organization | null>(null);
  const [isLoading, setIsLoading] = useState(true);  // start true — check for existing token

  // Restore session on mount — check for existing JWT token
  useEffect(() => {
    const restoreSession = async () => {
      if (!api.isAuthenticated()) {
        setIsLoading(false);
        return;
      }
      try {
        const userData = await api.get<User>("/auth/me");
        setUser(userData);
        try {
          const orgs = await api.get<Organization[]>("/organizations");
          if (orgs && orgs.length > 0) {
            setOrganizationState(orgs[0]);
          }
        } catch {
          // No orgs yet — that's fine
        }
      } catch {
        // Token expired or invalid — clear it
        api.clearToken();
      } finally {
        setIsLoading(false);
      }
    };
    restoreSession();
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    setIsLoading(true);
    try {
      const response = await api.post<{ access_token: string; refresh_token: string }>(
        "/auth/login",
        { email, password }
      );
      api.setToken(response.access_token);

      const userData = await api.get<User>("/auth/me");
      setUser(userData);

      // Load organizations — don't fail login if no orgs yet
      try {
        const orgs = await api.get<Organization[]>("/organizations");
        if (orgs && orgs.length > 0) {
          setOrganizationState(orgs[0]);
        }
      } catch (orgErr) {
        console.log("No organizations yet — user needs to create one");
      }
    } catch (err) {
      setIsLoading(false);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const register = useCallback(async (email: string, password: string, fullName: string) => {
    setIsLoading(true);
    try {
      await api.post("/auth/register", {
        email,
        password,
        full_name: fullName,
      });
      await login(email, password);
    } finally {
      setIsLoading(false);
    }
  }, [login]);

  const logout = useCallback(() => {
    api.clearToken();
    setUser(null);
    setOrganizationState(null);
  }, []);

  const setOrganization = useCallback((org: Organization) => {
    setOrganizationState(org);
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        organization,
        isAuthenticated: !!user,
        isLoading,
        login,
        register,
        logout,
        setOrganization,
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
