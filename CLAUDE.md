---
description: MindTracer project guide for Claude Code / coding agents
globs: "*.ts, *.tsx, *.json, *.md"
alwaysApply: true
---

# MindTracer · Agent Guide

A Typeless data forwarder. CLI + daemon. Reads `~/Library/Application Support/Typeless/typeless.db` (read-only), writes Markdown files to a user-chosen vault directory.

## Repo at a glance

- **Stack:** Bun + TypeScript. Single dependency: Bun.
- **Code:** `src/` — 8 files, ~700 LOC total
- **Entry point:** `src/cli.ts` (the `mindtracer` command)
- **Daemon:** `src/daemon.ts` (fs.watch + 5s debounce → triggers sync)
- **Schema parser:** `src/reader.ts` + `src/types.ts` (the only place the Typeless DB schema is referenced)
- **Output protocol:** `SKILL.md` is the canonical contract for downstream agents. Read it before changing anything in `formatter.ts` or `writer.ts`.

## Hard rules

These are non-negotiable.

1. **Typeless DB is read-only.** Never open it with write permissions. Schema parsing belongs only in `src/reader.ts`. If you change the SQL query, also update the type in `src/types.ts`.
2. **Daily MD files are append-only.** `writer.ts` checks each entry's `<!-- mindtracer:{uuid} -->` marker before writing — never modify or remove these markers, never sort, never rewrite existing content. The marker format is the project's idempotency contract.
3. **The id marker is `<!-- mindtracer:{uuid} -->`** — not `muse:`, not anything else. If you see `muse:` in code or docs, it's a leftover and should be replaced.
4. **Don't alter `~/.mindtracer/cursor.json` schema** without thinking through migration. It's user state.
5. **Don't write to the user's home unprompted** while running tests. Use a sandbox dir like `./test-vault/` and clean up after.

## Don't confuse "cursor"

The project has `~/.mindtracer/cursor.json` (the sync pointer). This is **unrelated** to Cursor IDE. In docs, prefer "sync state" / "sync pointer" over "cursor" to avoid confusion.

## Bun specifics (use these, not Node equivalents)

- `bun:sqlite` — used in `src/reader.ts`. Don't add `better-sqlite3` or `node:sqlite`.
- `Bun.file()` / `Bun.write()` — used everywhere. Don't add `node:fs/promises`'s readFile/writeFile.
- `bun run src/cli.ts <cmd>` to run during dev. Don't add `ts-node` or `tsx`.
- `bun build --compile` to produce a single binary in `bin/mindtracer`. Don't add `esbuild` or `webpack`.

## Common commands

```bash
bun run src/cli.ts help                    # see all subcommands
bun run src/cli.ts sync --dry-run --backfill   # preview what would import
bun run src/cli.ts status                  # show config + cursor + pending count
bun run src/cli.ts start                   # run daemon in foreground
bunx tsc --noEmit                          # type-check (no test framework yet)
```

## File responsibilities

| File | Purpose | When to edit |
|---|---|---|
| `src/cli.ts` | command dispatcher + `init`/`sync`/`status` | Adding a new subcommand |
| `src/daemon.ts` | fs.watch + debounce + periodic safety net | Changing watch behavior |
| `src/reader.ts` | SQL query against Typeless DB | Typeless schema changes, new filters |
| `src/types.ts` | All TypeScript interfaces + `DEFAULT_CONFIG` | Schema changes, new config keys |
| `src/formatter.ts` | HistoryRow → Markdown string | Output format changes |
| `src/writer.ts` | Markdown append + idempotency check | Vault layout / id marker changes |
| `src/config.ts` | `~/.mindtracer/` paths + load/save | Path / config persistence changes |
| `src/launchd.ts` | macOS launchd plist install/uninstall | Daemon startup mechanism |
| `launchd/now.mindtracer.daemon.plist.template` | Plist template | Together with `src/launchd.ts` |
| `SKILL.md` | Agent-facing contract for vault organization | When changing vault layout or adding agent-relevant conventions |
| `README.md` | User-facing docs | Public-facing changes |

## Conventions

- **Imports:** No relative `../../` jumping. `src/` is flat — every file imports siblings.
- **Comments:** Default to none. Only add when WHY is non-obvious (a workaround, a contract guarantee, a Typeless schema quirk).
- **No backwards-compat shims.** This project has no deployed users yet (v0.1, just landed on GitHub). Rename freely, change config schema freely. Once we have users, this rule flips.
- **No tests yet.** v0.1 ships untested-by-machine, hand-verified by author. Don't add a test framework without asking; if you do add one, use `bun test`.

## Cross-references

- **Public docs:** `README.md` (user-facing), `SKILL.md` (agent-facing protocol for v0.2 organization layer)
- **Strategy + research:** Anything related to *why* — see the user's `~/.claude/projects/-Users-bxx-----/memory/` for promotion strategy, voice-vs-typing research, community choice
- **GitHub repo:** `https://github.com/mznowhere/mindtracer` (public, MIT)
