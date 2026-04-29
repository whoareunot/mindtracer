import { watch } from "fs";
import { dirname, basename } from "path";
import { openReadOnly, readReady } from "./reader";
import { format } from "./formatter";
import { writeEntries } from "./writer";
import { expandHome, loadConfig, loadCursor, saveCursor } from "./config";

const FS_DEBOUNCE_MS = 1500;

export async function startDaemon(): Promise<void> {
  const config = await loadConfig();
  const dbPath = expandHome(config.typeless_db_path);
  const watchDir = dirname(dbPath);
  const dbFile = basename(dbPath);

  const file = Bun.file(dbPath);
  if (!(await file.exists())) {
    console.error(`Typeless DB not found at ${dbPath}`);
    process.exit(1);
  }

  console.log(`mindtracer daemon started`);
  console.log(`watching: ${dbPath}`);
  console.log(`vault:    ${expandHome(config.vault_path)}`);
  console.log(`(press ctrl+c to stop)\n`);

  let timer: Timer | null = null;
  let syncing = false;
  let pendingResync = false;

  const triggerSync = async () => {
    if (syncing) {
      pendingResync = true;
      return;
    }
    syncing = true;
    try {
      await runOnce();
    } catch (err) {
      console.error("sync error:", err);
    } finally {
      syncing = false;
      if (pendingResync) {
        pendingResync = false;
        scheduleSync();
      }
    }
  };

  const scheduleSync = () => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = null;
      triggerSync();
    }, FS_DEBOUNCE_MS);
  };

  const watcher = watch(watchDir, (_event, filename) => {
    if (!filename) return;
    if (filename === dbFile || filename.startsWith(dbFile)) {
      scheduleSync();
    }
  });

  // Run once on startup so we don't miss anything that happened while we were off
  await runOnce();

  // Periodic safety net: re-check every (debounce_seconds * 2) in case fs events drop.
  // This catches rows that became eligible only because their debounce window expired
  // without any new fs event.
  const periodMs = Math.max(2000, config.debounce_seconds * 1000 * 2);
  const interval = setInterval(triggerSync, periodMs);

  const shutdown = () => {
    console.log("\nshutting down...");
    watcher.close();
    clearInterval(interval);
    if (timer) clearTimeout(timer);
    process.exit(0);
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);

  // Keep process alive
  await new Promise(() => {});
}

async function runOnce(): Promise<void> {
  const config = await loadConfig();
  const cursor = await loadCursor();
  const dbPath = expandHome(config.typeless_db_path);

  const db = openReadOnly(dbPath);
  try {
    const rows = readReady(db, config, {
      since: cursor.last_updated_at,
      backfill: false,
    });
    if (rows.length === 0) return;

    const entries = rows.map((r) => format(r, config));
    const result = await writeEntries(entries, config);

    const lastUpdated = rows.at(-1)?.updated_at ?? cursor.last_updated_at;
    await saveCursor({
      last_updated_at: lastUpdated,
      last_synced_at: new Date().toISOString(),
    });

    if (result.written > 0) {
      const ts = new Date().toLocaleTimeString();
      console.log(
        `[${ts}] +${result.written} entries (skipped ${result.skipped})`,
      );
    }
  } finally {
    db.close();
  }
}
