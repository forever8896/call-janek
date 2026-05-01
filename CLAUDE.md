# Call Janek — expo-rubes

> **Made for Honest Guide (Janek Rubes)**

A mobile app that turns a flood of email tips into a triaged, deduplicated, AI-enriched report queue for an investigative journalist.

## Product context

**Janek Rubes** is an investigative journalist who hunts scammers and helps their victims — both physically in Prague (taxi/exchange/menu scams, etc., his "Honest Guide" beat) and online (cybercrime). Today the public reports tips to him via a single email address, which is overflowing with spam, duplicates, and noise. He cannot keep up; signal is buried.

**Our solution** is a single Expo app with two completely different experiences gated by role:

### Reporter experience (the public)
- Voice-first intake powered by **Whisper** → transcript pre-fills a structured problem form.
- Form fields: description (text/voice), optional image/video attachment, location/business if applicable.
- On submit, the report enters a server-side **AI pipeline** (see below) before Janek ever sees it.

### Janek experience (admin)
- Signs in with an admin account.
- Sees only post-pipeline reports: segmented by category, sorted by urgency, deduplicated, with web-search evidence already attached.
- Each report is a clickable detail view with full context (transcript, media, similar prior reports, web findings).
- Goal: replace inbox triage with a curated queue.

## Server-side AI pipeline

Runs on every new submission, in order:

1. **Spam filter** — drop obvious spam before doing any expensive work.
2. **Duplicate detection** — compare against existing reports; cluster, don't duplicate.
3. **Categorization** — type/nature of the report (taxi scam, fake exchange, online fraud, etc.).
4. **Urgency scoring** — so Janek can sort by what matters now.
5. **Entity extraction** — pull out place / location / business mentions.
6. **Web research** — for reports tied to a specific place or business, search the web for corroborating evidence and attach findings to the report.

Output: a structured, scored, enriched report ready for Janek's queue.

## Architecture

- **Mobile client**: Expo (SDK 54) + expo-router + TypeScript + new architecture.
- **Backend**: Postgres for persistence (reports, users, clusters, evidence).
- **AI**: LLMs for spam/dedupe/categorization/urgency/entity-extraction; **Whisper** for voice transcription; web-search tool for evidence gathering.
- **Auth**: role-based — `reporter` (public) vs `admin` (Janek). Two distinct UI flows from a single binary.

> The Postgres backend and pipeline workers are not yet scaffolded in this repo — only the Expo client. Plan that out before building features that assume a server contract.

## Toolchain

- Package manager: **bun** (not npm/yarn)
- Node: v22.x
- EAS CLI: globally installed via bun (`~/.bun/bin/eas`)
- Editor: Cursor / VS Code

## EAS

- Logged-in user: `kiliansolutions` (kilianvaldman@gmail.com)
- Accessible accounts: `kiliansolutions`, `danian_org`
- Verify with `eas whoami`

## Common commands

```bash
bun install                 # install deps
bun expo start              # dev server (Metro)
bun run android | ios | web # platform-specific dev
bun run lint                # expo lint

eas build:configure                                    # one-time, creates eas.json
eas build --profile development --platform android|ios # dev client build
eas build --profile production --platform android|ios  # store build

eas update:configure                # one-time
eas update --channel production     # OTA update
```

## Expo MCP

The Expo MCP server is registered at project scope in `.mcp.json` (runs `bunx -y expo-mcp@latest`). It gives Claude Expo-aware tools (project introspection, doctor, etc.).

If MCP tools aren't showing up, restart Claude Code in this directory so it re-reads `.mcp.json`.

## Project layout (current — default expo-router template)

- `app/` — file-based routes (will split into `(reporter)` and `(admin)` route groups)
- `components/` — shared UI
- `hooks/`, `constants/` — utilities
- `assets/images/` — icons, splash
- `app.json` — Expo config (name/slug/scheme: `expo-rubes`, `expo-rubes`, `exporubes`)

## Conventions

- Use **bun** for all package operations (`bun add`, `bun remove`, never `npm i`).
- Use **expo install** for adding Expo/RN libraries so version-pinning matches the SDK: `bun expo install <pkg>`.
- New routes: add files under `app/`. Typed routes are enabled (`experiments.typedRoutes: true`).
- Two-experience UX: split routes by role group (e.g. `app/(reporter)/...` vs `app/(admin)/...`) and gate at the layout level — don't conditionally render inside shared screens.
- Voice/whisper code path should be the **default** intake on the reporter side; manual typing is a fallback, not the primary flow.
- Keep `app.json` `slug` and `scheme` consistent if renaming the app.

## Setup history (one-time, already done)

1. Installed EAS CLI: `bun install -g eas-cli`
2. Scaffolded: `bunx create-expo-app@latest . --template default --no-install`
3. Renamed `expo-rubes-scaffold` → `expo-rubes` in `package.json` + `app.json` (name/slug/scheme).
4. Registered Expo MCP at project scope: `claude mcp add expo --scope project -- bunx -y expo-mcp@latest`
5. `eas login` (as `kiliansolutions`)
6. `bun install` — 858 packages installed, `bun.lock` generated.

## Next setup steps (when ready)

- `eas build:configure` to generate `eas.json`.
- First development build: `eas build --profile development --platform android` (or `ios`).
- After build installs on a device: `bun expo start --dev-client`.
- For production: `eas build --profile production --platform android|ios`.
- For OTA updates: `eas update:configure` then `eas update --channel production`.
- Expo Agent access: add username to the Expo Agent Access doc, then use `agent.expo.dev`.
- Discount: build coupon code `STRV19`.

## Backend / pipeline — to design

Not yet scaffolded; decide before writing client code that depends on it:

- Postgres schema: `users`, `reports`, `report_media`, `report_clusters` (for dedupe), `evidence` (web-research findings), `categories`, `audit_log`.
- Pipeline runner: queue-based (each step a job) so failures retry independently and Janek's view never blocks on a slow web search.
- Whisper: server-side (upload audio → transcript) or on-device (expo-speech / native)? Server-side is simpler to swap models and cheaper to maintain.
- Auth: separate token/role for `admin` (Janek) vs `reporter`. Reporter flow may be anonymous-by-default.
- Storage: media (images/video) goes to object storage, not Postgres.

## Things NOT to do

- Don't commit `.env` or any file containing secrets.
- Don't add an Anthropic API key or `apiKeyHelper` to this project's settings (user opted out).
- Don't switch package managers — stick to bun.
- Don't expose admin routes/data to reporter sessions even client-side — gate at the layout, not at the screen.
- Don't show a report to Janek before it has cleared the spam + dedupe steps of the pipeline.
