import { openReadOnly, readReady } from "./reader";
import { format } from "./formatter";
import { writeEntries } from "./writer";
import {
  ensureDir,
  expandHome,
  loadConfig,
  loadCursor,
  PATHS,
  saveConfig,
  saveCursor,
} from "./config";
import { DEFAULT_CONFIG, type Config } from "./types";

interface SyncOptions {
  backfill: boolean;
  dryRun: boolean;
}

async function cmdInit(): Promise<void> {
  await ensureDir();
  const file = Bun.file(PATHS.config);
  if (await file.exists()) {
    console.log(`config already exists at ${PATHS.config}`);
  } else {
    await saveConfig(DEFAULT_CONFIG);
    console.log(`created ${PATHS.config}`);
  }
  const cursorFile = Bun.file(PATHS.cursor);
  if (!(await cursorFile.exists())) {
    await saveCursor({ last_updated_at: null, last_synced_at: new Date().toISOString() });
    console.log(`created ${PATHS.cursor}`);
  }
  const config = await loadConfig();
  console.log("\nvault: " + expandHome(config.vault_path));
  console.log("typeless db: " + expandHome(config.typeless_db_path));
  console.log("\nrun `mindtracer sync --backfill` to import existing history.");
}

async function cmdSync(opts: SyncOptions): Promise<number> {
  const config = await loadConfig();
  const cursor = await loadCursor();
  const dbPath = expandHome(config.typeless_db_path);

  const dbFile = Bun.file(dbPath);
  if (!(await dbFile.exists())) {
    console.error(`Typeless DB not found at ${dbPath}`);
    console.error("Make sure Typeless is installed and you've used it at least once.");
    return 1;
  }

  const db = openReadOnly(dbPath);
  try {
    const since = opts.backfill ? null : cursor.last_updated_at;
    const rows = readReady(db, config, { since, backfill: opts.backfill });

    if (rows.length === 0) {
      console.log("nothing to sync.");
      return 0;
    }

    const entries = rows.map((r) => format(r, config));

    if (opts.dryRun) {
      console.log(`[dry-run] would write ${entries.length} entries:`);
      for (const e of entries.slice(0, 3)) {
        console.log(`  ${e.dateKey} · mindtracer:${e.id}`);
      }
      if (entries.length > 3) console.log(`  ... and ${entries.length - 3} more`);
      return 0;
    }

    const result = await writeEntries(entries, config);
    console.log(`wrote ${result.written}, skipped ${result.skipped}, files: ${result.files.size}`);

    const lastUpdated = rows.at(-1)?.updated_at ?? cursor.last_updated_at;
    await saveCursor({
      last_updated_at: lastUpdated,
      last_synced_at: new Date().toISOString(),
    });
    return 0;
  } finally {
    db.close();
  }
}

async function cmdStatus(): Promise<void> {
  const config = await loadConfig();
  const cursor = await loadCursor();
  const dbPath = expandHome(config.typeless_db_path);

  console.log(`config:      ${PATHS.config}`);
  console.log(`vault:       ${expandHome(config.vault_path)}`);
  console.log(`typeless db: ${dbPath}`);
  console.log(`cursor:      last_updated_at=${cursor.last_updated_at ?? "(none)"}`);
  console.log(`             last_synced_at=${cursor.last_synced_at}`);

  const dbFile = Bun.file(dbPath);
  if (!(await dbFile.exists())) {
    console.log("\n[!] Typeless DB not found.");
    return;
  }

  const db = openReadOnly(dbPath);
  try {
    const rows = readReady(db, config, { since: cursor.last_updated_at, backfill: false });
    console.log(`\npending sync: ${rows.length} rows ready`);
  } finally {
    db.close();
  }
}

function printHelp(): void {
  console.log(`mindtracer — auto-archive Typeless conversations to a Markdown vault

usage:
  mindtracer init                        first-time setup
  mindtracer sync                        incremental sync (skip rows in debounce window)
  mindtracer sync --backfill             import all eligible history
  mindtracer sync --dry-run              show what would be synced
  mindtracer status                      show config + pending row count
  mindtracer start                       run daemon in foreground (watches DB)
  mindtracer install-daemon              install launchd plist for boot-on-login
  mindtracer uninstall-daemon            remove the launchd plist
  mindtracer help                        this message
`);
}

async function main(argv: string[]): Promise<number> {
  const [, , cmd, ...rest] = argv;

  switch (cmd) {
    case "init":
      await cmdInit();
      return 0;
    case "sync": {
      const opts: SyncOptions = {
        backfill: rest.includes("--backfill"),
        dryRun: rest.includes("--dry-run"),
      };
      return await cmdSync(opts);
    }
    case "status":
      await cmdStatus();
      return 0;
    case "start": {
      const { startDaemon } = await import("./daemon");
      await startDaemon();
      return 0;
    }
    case "install-daemon": {
      const { installDaemon } = await import("./launchd");
      return await installDaemon();
    }
    case "uninstall-daemon": {
      const { uninstallDaemon } = await import("./launchd");
      return await uninstallDaemon();
    }
    case "help":
    case "--help":
    case "-h":
    case undefined:
      printHelp();
      return 0;
    default:
      console.error(`unknown command: ${cmd}`);
      printHelp();
      return 1;
  }
}

const code = await main(process.argv);
process.exit(code);
