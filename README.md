<div align="center">

# ✦ Solips-webos

**A web operating system with an AI kernel — no backend, no build step, no install.**

Runs entirely in your browser. Files live in IndexedDB. Settings live in `localStorage`.
The "kernel" is an LLM you point at Ollama, LM Studio, OpenAI, Anthropic, Gemini, or Grok.

[![License](https://img.shields.io/badge/license-custom-blue.svg)](./LICENSE.md)
[![Deploy](https://img.shields.io/badge/deploy-Cloudflare%20Pages-f38020.svg)](#deploy)
[![Zero Backend](https://img.shields.io/badge/backend-none-brightgreen.svg)](#architecture)
[![Files](https://img.shields.io/badge/modules-16%20files-informational.svg)](#project-layout)

</div>

---

## What is this

Solips-webos is a desktop environment — windows, a taskbar, a start menu, drag/resize,
a file system, a terminal — built as static HTML/CSS/JS with no server behind it.
The twist: an AI provider is wired into the OS itself, with real tool-calling access
to the file system, app launcher, notifications, and even a visible cursor it can
move and click with inside its own windows.

Open `index.html`. That's the whole install process.

## Features

**Core desktop**
- Draggable, resizable windows — minimize, maximize, close, taskbar focus
- Start menu with search, right-click context menus, desktop icons
- Persistent file system (IndexedDB, with automatic in-memory fallback if
  IndexedDB is unavailable — e.g. sandboxed previews or private browsing)

**Built-in apps**
- **Terminal** — `ls`, `cat`, `write`, `rm` (recursive on folders), `mv`, `cp`,
  `find`, `mkdir`, `export`, `assoc`, plus AI commands (`ask`, `ai`, `ai-models`, `ai-set`)
- **Files** — multi-select, bulk delete, per-file delete, double-click opens
  via file-type association
- **Editor** — tab indent, `Ctrl+S`, live line/char count
- **Settings** — AI providers, custom apps, file-type associations, network peers
- **Browser** — embedded iframe browser with an "open in new tab" escape hatch
  for sites that block framing
- **System Monitor** — live CPU/RAM/GPU/storage/AI-connection dashboard
- **Store** — point it at a JSON catalog URL you host; installs apps with one click,
  split into reviewed "Official" and unreviewed "Community" tabs

**AI kernel**
- Real per-provider request handling — not just OpenAI's shape stretched over
  everything. Ollama, LM Studio, OpenAI, Anthropic, Gemini, and Groq each use
  their actual API format
- Tool-calling: the AI can read/write files, open or register apps, post
  notifications, and drive a visible in-OS cursor + keyboard — scoped to
  Solips-webos's own windows, not the visitor's real OS or cross-origin iframes
- Cross-tab LLM sharing over `BroadcastChannel` — one tab running Ollama
  locally can share its endpoint with another tab

**Extensible by design**
- **App registry** — register any embeddable website as a first-class app
  with just a name + URL; favicon auto-detected
- **File associations** — extension → app mapping, editable, with a sane
  plain-text fallback for anything unrecognized
- **App Store plumbing** — no catalog shipped, just the mechanism to consume one
- **Integrations hook** — an optional config file other tools can drop in;
  everything no-ops gracefully if it's absent

## Quick start

```bash
git clone <this-repo>
cd solips-webos
# that's it — open index.html in a browser
```

No `npm install`, no build step. Everything is plain `<script src>` tags loaded
in dependency order.

## Deploy

<details>
<summary><strong>Cloudflare Pages — Dashboard</strong></summary>

1. Push this repo to GitHub/GitLab.
2. Cloudflare dashboard → **Workers & Pages → Create → Pages → Connect to Git**.
3. Framework preset: `None`. Build command: *(empty)*. Output directory: `/`.
4. Deploy.
</details>

<details>
<summary><strong>Cloudflare Pages — Wrangler CLI</strong></summary>

```bash
npm install -g wrangler
wrangler login
wrangler pages deploy . --project-name=solips-webos
```
</details>

<details>
<summary><strong>Any static host</strong></summary>

This is plain static files — GitHub Pages, Netlify, Vercel, S3, or a local
`python3 -m http.server` all work identically. No server-side logic anywhere.
</details>

## Project layout

```
solips-webos/
├── index.html            DOM shell only
├── LICENSE.md
├── wrangler.toml          Cloudflare Pages config
├── package.json
├── css/
│   └── style.css
└── js/
    ├── config.js             OS_NAME — the ONE place that names this thing
    ├── icons.js              SVG icon library
    ├── utils.js              fmtSize, esc, getSysInfo
    ├── filesystem.js         IndexedDB + in-memory fallback
    ├── aicore.js             multi-provider AI core + tool prompt
    ├── network.js            cross-tab BroadcastChannel bridge
    ├── notifications.js      toast notification center
    ├── appregistry.js        register/run custom iframe apps
    ├── store.js               App Store catalog + install UI
    ├── fileassoc.js           extension → app mappings
    ├── cursor.js              AI-driven virtual cursor/keyboard
    ├── integrations.js        optional external-hook loader
    ├── windowmanager.js       drag/resize/minimize/maximize
    ├── apps-core.js           Terminal, Files, Editor
    ├── apps-extra.js          Settings, Browser, Monitor, Store UI
    └── main.js                boot sequence — wires everything together
```

Load order matters and is fixed in `index.html`: `config.js` first (it defines
`OS_NAME`, which everything else reads), then icon/util helpers, then core
classes, then app modules, `main.js` last (it runs the boot sequence in an
IIFE once everything above it exists).

### Renaming this again later

Change `OS_NAME` in `js/config.js` — that's it for every visible label (page
title, boot screen, taskbar, terminal prompt/banner, About panel, the AI's own
system prompt). Internal technical identifiers (storage keys, the IndexedDB
name, the `window._OS` / `window.OS` API objects) are deliberately **not**
tied to the brand name, so renaming never breaks anyone's saved files or
settings from a previous version.

## Known limits (stated honestly, not hidden)

- **Local LLM endpoints** (`localhost:11434`, `:1234`) only work if the
  *visitor's own machine* is running that server — a static host can't proxy
  into someone's localhost.
- **The AI's cursor/keyboard tools** only reach Solips-webos's own windows. They
  cannot act inside cross-origin iframes (Browser app, website-apps) or touch
  the visitor's actual OS-level input — that's browser sandboxing, not a gap
  to be closed.
- **Some sites refuse to be framed** (`X-Frame-Options` / CSP
  `frame-ancestors` — e.g. most Google properties). That's the target site's
  own security header; Solips-webos surfaces an "open in new tab" link instead of
  pretending to work around it.

## License

See [`LICENSE.md`](./LICENSE.md) — permissive for the current release, with
the copyright holder reserving the right to license *future* releases
differently. Rights already granted for a given version aren't retroactively
revoked.

---

<div align="center">
<sub>Built file by file, on purpose — extend it the same way.</sub>
</div>
