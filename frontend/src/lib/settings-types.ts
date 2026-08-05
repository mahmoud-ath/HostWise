/**
 * Types for backup status and maintenance endpoints.
 */

export interface BackupStatus {
  schedule: string;
  last_backup: { name: string; created: string } | null;
  next_backup: string;
  backup_count: number;
  total_size: number;
  retention: { daily: number; weekly: number; monthly: number };
}

export interface MaintenanceStatus {
  database_type: string;
  database_path: string | null;
  database_size: number;
  backup_count: number;
  backups_size: number;
  log_file_available: boolean;
  integrity: "ok" | "error" | "unavailable";
}

export interface OptimizeResult {
  ok: boolean;
  message: string;
  before: number;
  after: number;
  freed: number;
}

export interface LogsResult {
  available: boolean;
  content: string;
  path: string | null;
}

export interface ResetDemoResult {
  deleted: Record<string, number>;
}
