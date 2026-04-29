export type Mode = "voice_transcript" | "voice_command";

export type Status = "transcript" | "dismissed" | string;

export interface HistoryRow {
  id: string;
  status: Status | null;
  mode: Mode | null;
  refined_text: string | null;
  edited_text: string | null;
  mode_meta: string | null;
  created_at: string | null;
  updated_at: string | null;
  focused_app_name: string | null;
  focused_app_window_title: string | null;
  focused_app_window_web_url: string | null;
  focused_app_window_web_title: string | null;
  focused_app_window_web_domain: string | null;
}

export interface ModeMetaAIResult {
  user_prompt?: string;
  refined_text?: string;
  web_metadata?: {
    grounding_chunks?: Array<{
      web?: { domain?: string; title?: string; uri?: string };
    }>;
  };
}

export interface ModeMeta {
  ai_result?: ModeMetaAIResult;
}

export interface Config {
  vault_path: string;
  typeless_db_path: string;
  store_voice_transcript: boolean;
  store_voice_command: boolean;
  min_text_length: number;
  exclude_dismissed: boolean;
  debounce_seconds: number;
  redact_web_url: boolean;
}

export interface Cursor {
  last_updated_at: string | null;
  last_synced_at: string;
}

export const DEFAULT_CONFIG: Config = {
  vault_path: "~/Documents/mindtracer-vault",
  typeless_db_path: "~/Library/Application Support/Typeless/typeless.db",
  store_voice_transcript: true,
  store_voice_command: true,
  min_text_length: 5,
  exclude_dismissed: true,
  debounce_seconds: 5,
  redact_web_url: false,
};
