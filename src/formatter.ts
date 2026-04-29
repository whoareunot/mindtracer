import type { Config, HistoryRow, ModeMeta } from "./types";

export interface FormattedEntry {
  /** YYYY-MM-DD in local timezone — used as filename */
  dateKey: string;
  /** Full markdown block ending with separator */
  markdown: string;
  /** history.id, used as idempotency key (embedded in markdown) */
  id: string;
}

function parseModeMeta(raw: string | null): ModeMeta | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as ModeMeta;
  } catch {
    return null;
  }
}

function localDateKey(iso: string | null): string {
  const d = iso ? new Date(iso) : new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function localTime(iso: string | null): string {
  const d = iso ? new Date(iso) : new Date();
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${hh}:${mm}`;
}

function redactUrl(url: string | null, redact: boolean): string | null {
  if (!url) return null;
  if (!redact) return url;
  try {
    const u = new URL(url);
    return `${u.protocol}//${u.hostname}`;
  } catch {
    return url;
  }
}

export function format(row: HistoryRow, config: Config): FormattedEntry {
  const time = localTime(row.updated_at ?? row.created_at);
  const dateKey = localDateKey(row.updated_at ?? row.created_at);
  const meta = parseModeMeta(row.mode_meta);

  const lines: string[] = [];
  // user_prompt is the source of truth for "is this a Q+A":
  //   voice_command            → user_prompt set        → Q+A
  //   voice_transcript w/ AI   → user_prompt set        → Q+A
  //   voice_transcript pure    → user_prompt null/empty → Note
  const userPrompt = meta?.ai_result?.user_prompt?.trim() ?? null;
  const isQA = !!userPrompt;

  const heading = isQA
    ? `## ${time} · Q&A`
    : `## ${time} · Note`;
  lines.push(heading);
  lines.push(`<!-- mindtracer:${row.id} -->`);

  const focusApp = row.focused_app_name?.trim();
  if (focusApp) lines.push(`**焦点 App**：${focusApp}`);

  const webUrl = redactUrl(row.focused_app_window_web_url, config.redact_web_url);
  const webTitle = row.focused_app_window_web_title?.trim();
  if (webUrl) {
    const display = webTitle ? `[${webTitle}](${webUrl})` : webUrl;
    lines.push(`**🔗**：${display}`);
  }

  lines.push("");

  if (isQA) {
    const a = meta?.ai_result?.refined_text?.trim() ?? row.refined_text?.trim();
    lines.push(`**Q:** ${userPrompt}`);
    lines.push("");
    if (a) lines.push(`**A:** ${a}`);
  } else {
    const text = row.edited_text?.trim() ?? row.refined_text?.trim() ?? "";
    if (text) lines.push(text);
  }

  lines.push("");
  lines.push("---");
  lines.push("");

  return {
    dateKey,
    markdown: lines.join("\n"),
    id: row.id,
  };
}
