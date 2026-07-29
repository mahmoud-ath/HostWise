/**
 * HostWise API Client
 *
 * Centralized API client with JWT token management.
 * All API calls go through this module.
 */

// Use 127.0.0.1 instead of localhost to avoid IPv6 resolution issues on Windows
const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000/api/v1";

class ApiClient {
  private baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  private getToken(): string | null {
    if (typeof window === "undefined") return null;
    return localStorage.getItem("hostwise_access_token");
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {},
    retries: number = 3,
  ): Promise<T> {
    const token = this.getToken();
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      ...((options.headers as Record<string, string>) || {}),
    };

    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    for (let attempt = 0; attempt < retries; attempt++) {
      try {
        const response = await fetch(`${this.baseUrl}${endpoint}`, {
          ...options,
          headers,
        });

        if (!response.ok) {
          const error = await response.json().catch(() => ({ detail: "Request failed" }));
          // Only retry on 5xx — client errors (4xx) are not transient
          if (response.status >= 500 && attempt < retries - 1) {
            const delay = Math.min(1000 * 2 ** attempt, 4000);
            await new Promise((r) => setTimeout(r, delay));
            continue;
          }
          throw new Error(error.detail || `HTTP ${response.status}`);
        }

        return response.json();
      } catch (err) {
        if (attempt < retries - 1 && err instanceof TypeError) {
          // Network error (fetch failed) — retry with backoff
          const delay = Math.min(1000 * 2 ** attempt, 4000);
          await new Promise((r) => setTimeout(r, delay));
          continue;
        }
        throw err;
      }
    }

    throw new Error("Request failed after retries");
  }

  async get<T>(endpoint: string): Promise<T> {
    return this.request<T>(endpoint);
  }

  async post<T>(endpoint: string, data?: unknown): Promise<T> {
    return this.request<T>(endpoint, {
      method: "POST",
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  async patch<T>(endpoint: string, data?: unknown): Promise<T> {
    return this.request<T>(endpoint, {
      method: "PATCH",
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  async delete<T>(endpoint: string): Promise<T> {
    return this.request<T>(endpoint, { method: "DELETE" });
  }

  // Auth helpers
  setToken(token: string) {
    if (typeof window !== "undefined") {
      localStorage.setItem("hostwise_access_token", token);
    }
  }

  clearToken() {
    if (typeof window !== "undefined") {
      localStorage.removeItem("hostwise_access_token");
    }
  }

  isAuthenticated(): boolean {
    return !!this.getToken();
  }
}

export const api = new ApiClient(API_BASE);
