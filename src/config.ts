import { homedir } from "os";
import { join } from "path";
import { mkdir } from "fs/promises";
import type { Config, Cursor } from "./types";
import { DEFAULT_CONFIG } from "./types";

const MINDTRACER_DIR = join(homedir(), ".mindtracer");
const CONFIG_PATH = join(MINDTRACER_DIR, "config.json");
const CURSOR_PATH = join(MINDTRACER_DIR, "cursor.json");

export function expandHome(path: string): string {
  if (path.startsWith("~/")) return join(homedir(), path.slice(2));
  if (path === "~") return homedir();
  return path;
}

export async function ensureDir(): Promise<void> {
  await mkdir(MINDTRACER_DIR, { recursive: true });
}

export async function loadConfig(): Promise<Config> {
  const file = Bun.file(CONFIG_PATH);
  if (!(await file.exists())) {
    return { ...DEFAULT_CONFIG };
  }
  const data = (await file.json()) as Partial<Config>;
  return { ...DEFAULT_CONFIG, ...data };
}

export async function saveConfig(config: Config): Promise<void> {
  await ensureDir();
  await Bun.write(CONFIG_PATH, JSON.stringify(config, null, 2) + "\n");
}

export async function loadCursor(): Promise<Cursor> {
  const file = Bun.file(CURSOR_PATH);
  if (!(await file.exists())) {
    return { last_updated_at: null, last_synced_at: new Date().toISOString() };
  }
  return (await file.json()) as Cursor;
}

export async function saveCursor(cursor: Cursor): Promise<void> {
  await ensureDir();
  await Bun.write(CURSOR_PATH, JSON.stringify(cursor, null, 2) + "\n");
}

export const PATHS = {
  dir: MINDTRACER_DIR,
  config: CONFIG_PATH,
  cursor: CURSOR_PATH,
};
