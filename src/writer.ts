import { join } from "path";
import { mkdir } from "fs/promises";
import type { Config } from "./types";
import type { FormattedEntry } from "./formatter";
import { expandHome } from "./config";

export interface WriteResult {
  /** Number of entries actually appended (skipped if id already present) */
  written: number;
  /** Number of entries skipped because id already in file */
  skipped: number;
  /** Files touched */
  files: Set<string>;
}

async function readFileIfExists(path: string): Promise<string> {
  const file = Bun.file(path);
  if (!(await file.exists())) return "";
  return await file.text();
}

function fileHeader(dateKey: string): string {
  return `# ${dateKey}\n\n`;
}

export async function writeEntries(
  entries: FormattedEntry[],
  config: Config,
): Promise<WriteResult> {
  const result: WriteResult = { written: 0, skipped: 0, files: new Set() };
  if (entries.length === 0) return result;

  const vault = expandHome(config.vault_path);
  const dailyDir = join(vault, "daily");
  await mkdir(dailyDir, { recursive: true });

  // Group by dateKey so we open each file once
  const byDate = new Map<string, FormattedEntry[]>();
  for (const e of entries) {
    const list = byDate.get(e.dateKey) ?? [];
    list.push(e);
    byDate.set(e.dateKey, list);
  }

  for (const [dateKey, list] of byDate) {
    const path = join(dailyDir, `${dateKey}.md`);
    let existing = await readFileIfExists(path);
    if (!existing) existing = fileHeader(dateKey);

    let appended = "";
    for (const entry of list) {
      const idMarker = `<!-- mindtracer:${entry.id} -->`;
      if (existing.includes(idMarker) || appended.includes(idMarker)) {
        result.skipped += 1;
        continue;
      }
      appended += entry.markdown;
      result.written += 1;
    }

    if (appended) {
      await Bun.write(path, existing + appended);
      result.files.add(path);
    }
  }

  return result;
}
