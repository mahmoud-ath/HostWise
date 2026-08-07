/**
 * HostWise API Client
 *
 * Centralized API client with JWT token management.
 * All API calls go through this module.
 * Resolves backend URL dynamically from Tauri (desktop) or env var (dev).
 */

// Fallback for browser dev (non-Tauri). In dev the Next.js server proxies
// `/api/*` to the backend's dynamic port (see next.config.js), so a relative
// base just works — no hardcoded 8000/3000.
const FALLBACK_API_BASE =
  process.env.NEXT_PUBLIC_API_URL || "/api/v1";

/// Try to get the backend URL from Tauri, falling back to env var.
async function resolveApiBaseUrl(): Promise<string> {
  if (typeof window !== "undefined" && "__TAURI_INTERNALS__" in window) {
    try {
      const { invoke } = await import("@tauri-apps/api/core");
      return await invoke<string>("get_backend_url");
    } catch {
      // Tauri invoke failed — use fallback
      return FALLBACK_API_BASE;
    }
  }
  return FALLBACK_API_BASE;
}

class ApiClient {
  private baseUrlPromise: Promise<string> | null = null;
  private baseUrl: string | null = null;

  private async getBaseUrl(): Promise<string> {
    if (this.baseUrl) return this.baseUrl;
    if (!this.baseUrlPromise) {
      this.baseUrlPromise = resolveApiBaseUrl();
    }
    this.baseUrl = await this.baseUrlPromise;
    return this.baseUrl;
  }

  /** Public base URL (e.g. `http://127.0.0.1:8000/api/v1`). */
  async getApiBaseUrl(): Promise<string> {
    return this.getBaseUrl();
  }

  /** Bare host + port (e.g. `http://127.0.0.1:8000`), for health/download URLs. */
  async getApiHost(): Promise<string> {
    const base = await this.getBaseUrl();
    return base.replace(/\/api\/v1\/?$/, "");
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

    const baseUrl = await this.getBaseUrl();

    for (let attempt = 0; attempt < retries; attempt++) {
      try {
        const response = await fetch(`${baseUrl}${endpoint}`, {
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

  async put<T>(endpoint: string, data?: unknown): Promise<T> {
    return this.request<T>(endpoint, {
      method: "PUT",
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

  /** Multipart file upload (FormData). Content-Type is set by the browser. */
  async upload<T>(endpoint: string, file: File, extraFields?: Record<string, string>): Promise<T> {
    const baseUrl = await this.getBaseUrl();
    const token = this.getToken();
    const headers: Record<string, string> = {};
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }
    const formData = new FormData();
    formData.append("file", file);
    if (extraFields) {
      for (const [key, value] of Object.entries(extraFields)) {
        formData.append(key, value);
      }
    }
    const response = await fetch(`${baseUrl}${endpoint}`, {
      method: "POST",
      headers,
      body: formData,
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: `HTTP ${response.status}` }));
      throw new Error(error.detail || `HTTP ${response.status}`);
    }
    return response.json();
  }

  /** Drop the cached base URL so it is re-resolved from Tauri (used after a
   * backend restart, which may bind a different port). */
  resetBaseUrl() {
    this.baseUrl = null;
    this.baseUrlPromise = null;
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

export const api = new ApiClient();
