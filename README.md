# MindTracer

> Auto-archive your Typeless voice conversations to a Markdown vault — so an AI agent can organize them while you sleep.

You already use [Typeless](https://typeless.com) every day. Every Q+A you've had with its built-in LLM, every note you've dictated — it's all in a local SQLite cache that no other app reads. **MindTracer** runs in the background, watches that cache, and writes each conversation as a Markdown file to a folder of your choice.

You can open the vault in [Obsidian](https://obsidian.md), grep it, paste it into ChatGPT, or — the point of v0.2 — point a Claude Code / Codex / Cursor / Hermes agent at it and let it organize the rest.

**No hotkeys. No transcription. No LLM API key. No cloud.** MindTracer never writes to the Typeless database — only reads.

---

## Why this exists

Speech reduces cognitive load **35–45%** vs. typing (Kumar, Paek & Lee, 2012, measured via EEG / pupil dilation / NASA-TLX). It's also **3× faster** for English text entry, **2.8×** for Mandarin (Stanford / UW / Baidu, 2017).

The catch: every brilliant thing you said is now trapped inside Typeless. When you want to grep your own thinking, you can't. When you want an agent to make sense of last week's reasoning, you can't. MindTracer is the missing pipe.

---

## Two ways to install

### 🤖 Path A — let an agent do it

If you use Claude Code, Codex CLI, Cursor, Windsurf, Hermes, or any other coding agent that can run shell commands: send it this repo URL and say:

> "Install MindTracer for me. My Typeless DB is at the default location."

The agent will read this README and the included [`SKILL.md`](./SKILL.md), run the install steps, and confirm with you.

### 👤 Path B — install it yourself (4 steps)

```bash
# 1. install Bun (the only dependency)
curl -fsSL https://bun.sh/install | bash

# 2. clone this repo
git clone https://github.com/<you>/mindtracer && cd mindtracer

# 3. set up config + sync state
bun run src/cli.ts init

# 4. start the daemon (foreground, for testing)
bun run src/cli.ts start
```

Open Typeless, ask the AI something — within ~5 seconds, a new entry appears in `~/Documents/mindtracer-vault/daily/{today}.md`.

When you're happy:

```bash
# install as a launchd agent so it runs at every login
bun run src/cli.ts install-daemon
```

To stop and uninstall:

```bash
bun run src/cli.ts uninstall-daemon
```

---

## First-time backfill (recommended)

You probably already have weeks or months of Typeless history. Import all of it in one shot:

```bash
bun run src/cli.ts sync --dry-run --backfill   # preview what will be imported
bun run src/cli.ts sync --backfill             # actually import
```

After this, your vault has one MD file per day, populated with every conversation Typeless has on record. Re-running is idempotent (each entry has an immutable `<!-- mindtracer:{uuid} -->` ID).

---

## What you get

Each `daily/YYYY-MM-DD.md` looks like this:

```markdown
# 2026-04-30

## 14:32 · Q&A
<!-- mindtracer:21517a1e-... -->
**焦点 App**：Desktop App

**Q:** OpenAI 在 Codex 内置了什么最新内容更新？

**A:** 根据截至 2026 年 4 月 30 日的最新信息……

---

## 15:08 · Note
<!-- mindtracer:abc123-... -->
**焦点 App**：VS Code

我刚意识到 SKILL.md 应该是机器可读的协议……

---
```

Two entry shapes:
- **Q&A** — your question + AI's reply (when you used Typeless's built-in LLM)
- **Note** — your raw dictation (when you spoke into any app's text field)

---

## Configuration

Edit `~/.mindtracer/config.json`:

| Key | Default | What it does |
|---|---|---|
| `vault_path` | `~/Documents/mindtracer-vault` | Where to write |
| `typeless_db_path` | (default macOS path) | Where to read |
| `store_voice_transcript` | `true` | Capture pure dictations (no AI involved) |
| `store_voice_command` | `true` | Capture Q&A conversations |
| `min_text_length` | `5` | Skip entries shorter than this many chars |
| `exclude_dismissed` | `true` | Ignore conversations you canceled |
| `debounce_seconds` | `5` | Wait this long after Typeless's last DB write before treating an entry as final |
| `redact_web_url` | `false` | If `true`, store only domain — not full URL |

### 💡 Tip — make your vault sync across devices

The vault is just a folder of Markdown files. Put it inside iCloud Drive, Dropbox, Google Drive, OneDrive, or [Syncthing](https://syncthing.net) — and your daily logs are now available on every device that mounts that folder. Open it with [Obsidian](https://obsidian.md) (Mobile + Desktop), [Bear](https://bear.app), or any plain-text editor on your phone, and you can read or annotate while away from your Mac.

Set `vault_path` in `~/.mindtracer/config.json` to the synced folder, e.g. `~/Library/Mobile Documents/com~apple~CloudDocs/mindtracer-vault`.

> ⚠ MindTracer itself doesn't sync — it just writes files. Whatever you point `vault_path` at handles the rest.

---

## For agents: see SKILL.md

[`SKILL.md`](./SKILL.md) is the canonical protocol for any agent operating on a MindTracer vault. It defines:

- The vault directory layout (`daily/` is read-only; agents write to `topics/`, `projects/`, `summaries/`, `meta/`)
- Append-only rules
- Output format for extracted topics (atomic vs. accreting), summaries, backreferences
- Standard operations ("整理今天" / "weekly digest" / "what have I been thinking about X")
- Extraction heuristics (signal vs. noise vs. skip)

Drop the `SKILL.md` into any agent that supports skills/instructions and it'll know what to do.

---

## How it works

1. Typeless writes every conversation to `~/Library/Application Support/Typeless/typeless.db` (a SQLite file).
2. The `history` table has one row per conversation, with `mode`, `refined_text`, `mode_meta` (JSON containing the user prompt and AI reply), `focused_app_name`, etc.
3. MindTracer's daemon watches that SQLite file. After ~5 seconds of no further writes (Typeless has finished transcribing and the AI has finished replying), it copies the new rows into your vault as Markdown.
4. Each entry gets `<!-- mindtracer:{id} -->`. The daemon uses this for idempotency — re-runs never duplicate.

700-ish lines of TypeScript. Read [`src/`](./src) end-to-end in 15 minutes.

---

## What MindTracer does **not** do

- ❌ Replace your Typeless hotkey
- ❌ Transcribe audio (Typeless does it)
- ❌ Talk to any LLM
- ❌ Modify the Typeless database
- ❌ Sync to cloud (your vault is just files — put it in iCloud / Dropbox / Syncthing yourself if you want sync)

---

## Limitations

- **Typeless changes its DB schema** → MindTracer breaks until updated. Schema parsing is centralized in `src/reader.ts` and `src/types.ts`.
- **If you pause >5 s mid-sentence**, the entry may be archived as partial. Tunable via `debounce_seconds`.
- **Typeless must be installed and used at least once** for the DB to exist.

---

## Roadmap

- **v0.2** — pluggable agent skill (this repo's `SKILL.md` is the v1 of that protocol)
- **v0.3** — support for other locally-storing dictation apps ([OpenWhispr](https://github.com/OpenWhispr/openwhispr), [Handy](https://github.com/cjpais/Handy), [FluidVoice](https://github.com/altic-dev/FluidVoice))
- **v0.4** — optional Obsidian URI scheme integration to surface new entries
- **v0.5** — opt-in YAML frontmatter on daily files for token-efficient agent indexing

---

## License

MIT.
