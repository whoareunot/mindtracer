import { homedir } from "os";
import { join, resolve } from "path";
import { spawnSync } from "child_process";
import { mkdir } from "fs/promises";

const PLIST_LABEL = "now.mindtracer.daemon";
const LAUNCH_AGENTS_DIR = join(homedir(), "Library", "LaunchAgents");
const PLIST_PATH = join(LAUNCH_AGENTS_DIR, `${PLIST_LABEL}.plist`);

function which(bin: string): string | null {
  const r = spawnSync("which", [bin], { encoding: "utf8" });
  if (r.status !== 0) return null;
  return r.stdout.trim() || null;
}

export async function installDaemon(): Promise<number> {
  const bunPath = which("bun");
  if (!bunPath) {
    console.error("`bun` not on PATH — install bun first: https://bun.sh");
    return 1;
  }

  // Project root = parent of this file's directory (src/)
  const projectPath = resolve(import.meta.dir, "..");
  const home = homedir();

  const tmplPath = join(projectPath, "launchd", `${PLIST_LABEL}.plist.template`);
  const tmplFile = Bun.file(tmplPath);
  if (!(await tmplFile.exists())) {
    console.error(`template not found: ${tmplPath}`);
    return 1;
  }
  const tmpl = await tmplFile.text();

  const rendered = tmpl
    .replaceAll("{{BUN_PATH}}", bunPath)
    .replaceAll("{{PROJECT_PATH}}", projectPath)
    .replaceAll("{{HOME}}", home);

  await mkdir(LAUNCH_AGENTS_DIR, { recursive: true });
  await Bun.write(PLIST_PATH, rendered);

  // Bootstrap into the user's domain (replaces older `launchctl load`)
  const uid = process.getuid?.() ?? 0;
  const target = `gui/${uid}`;
  spawnSync("launchctl", ["bootout", target, PLIST_PATH], { stdio: "ignore" });
  const r = spawnSync("launchctl", ["bootstrap", target, PLIST_PATH], {
    encoding: "utf8",
  });
  if (r.status !== 0) {
    console.error(`launchctl bootstrap failed: ${r.stderr || r.stdout}`);
    console.error(`plist written at ${PLIST_PATH} — you can try loading it manually.`);
    return 1;
  }

  console.log(`installed: ${PLIST_PATH}`);
  console.log(`logs:      ${join(home, ".mindtracer", "mindtracer.log")}`);
  console.log("the daemon will start now and on every login.");
  return 0;
}

export async function uninstallDaemon(): Promise<number> {
  const file = Bun.file(PLIST_PATH);
  if (!(await file.exists())) {
    console.log(`not installed (${PLIST_PATH} does not exist).`);
    return 0;
  }
  const uid = process.getuid?.() ?? 0;
  const target = `gui/${uid}`;
  spawnSync("launchctl", ["bootout", target, PLIST_PATH], { stdio: "ignore" });
  await Bun.$`rm -f ${PLIST_PATH}`.quiet();
  console.log(`uninstalled: ${PLIST_PATH}`);
  return 0;
}
