import { Database } from "bun:sqlite";
import type { Config, HistoryRow } from "./types";

const SELECT_FIELDS = `
  id, status, mode, refined_text, edited_text, mode_meta,
  created_at, updated_at,
  focused_app_name, focused_app_window_title,
  focused_app_window_web_url, focused_app_window_web_title, focused_app_window_web_domain
`;

interface QueryOptions {
  /** ISO timestamp; only return rows with updated_at strictly greater than this */
  since: string | null;
  /** If true, ignore the debounce window — used for backfill */
  backfill: boolean;
}

export function readReady(
  db: Database,
  config: Config,
  opts: QueryOptions,
): HistoryRow[] {
  const modes: string[] = [];
  if (config.store_voice_command) modes.push("voice_command");
  if (config.store_voice_transcript) modes.push("voice_transcript");
  if (modes.length === 0) return [];

  const conditions: string[] = [
    `mode IN (${modes.map(() => "?").join(",")})`,
    `length(refined_text) >= ?`,
  ];
  const params: (string | number)[] = [...modes, config.min_text_length];

  if (config.exclude_dismissed) {
    conditions.push(`(status IS NULL OR status != 'dismissed')`);
  }
  if (opts.since) {
    conditions.push(`updated_at > ?`);
    params.push(opts.since);
  }
  if (!opts.backfill) {
    const cutoff = new Date(Date.now() - config.debounce_seconds * 1000)
      .toISOString();
    conditions.push(`updated_at <= ?`);
    params.push(cutoff);
  }

  const sql = `
    SELECT ${SELECT_FIELDS}
    FROM history
    WHERE ${conditions.join(" AND ")}
    ORDER BY updated_at ASC
  `;

  return db.prepare(sql).all(...params) as HistoryRow[];
}

export function openReadOnly(dbPath: string): Database {
  return new Database(dbPath, { readonly: true });
}
