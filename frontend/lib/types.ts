export interface Entity { id: string | number; created_at?: string; updated_at?: string }
export interface User extends Entity { name: string; email: string; role?: string }
export interface Workspace extends Entity { name: string; slug: string; description?: string; workspace_type?: "company" | "organization" | "personal"; role?: "owner" | "admin" | "member" | "viewer"; modules?: Module[] }
export interface Module extends Entity { name: string; slug: string; description?: string }
export interface Skill extends Entity { workspace_id: string | number; name: string; slug: string; description?: string; instructions: string; is_enabled: boolean }
export interface OrchestrationStep { position: number; skill: Skill }
export interface Orchestration extends Entity { workspace_id: string | number; name: string; description?: string; steps: OrchestrationStep[] }
export type TeachingSessionStatus = "draft" | "preparing" | "ready" | "scheduled" | "in_progress" | "completed" | "cancelled" | "archived";
export interface TeachingSession {
  id: number;
  workspace_id: number;
  created_by_id: number;
  created_at: string;
  updated_at: string;
  title: string;
  topic: string | null;
  description: string | null;
  audience: string | null;
  difficulty: string | null;
  instructor: string | null;
  scheduled_at: string | null;
  duration_minutes: number | null;
  session_type: string | null;
  session_date: string | null;
  status: TeachingSessionStatus;
  notes: string | null;
  module_id: number | null;
}
export interface Material extends Entity { workspace_id?: string | number; module_id?: string | number | null; title: string; material_type?: string; material_date?: string | null; description?: string; content?: string; tags?: string[]; content_url?: string | null }
export interface Template extends Entity { workspace_id?: string | number | null; name: string; category?: string; description?: string; template_type?: string; config_json?: Record<string, unknown>; updated_at?: string }
