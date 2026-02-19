# Code Review Report & Repository Copy

Date: 2026-02-19

## Repository copy result

- **Requested action:** create a copy in a new repository.
- **GitHub API attempt:** failed with `Resource not accessible by integration (createRepository)` when calling `gh repo create`.
- **Created copy:** a new local git repository at:
  - `/home/ubuntu/radar-watch-guard-copy-20260219`
  - Branch: `main`
  - Remote: none (detached from source)

## Review findings (ordered by severity)

### 1) Critical: privileged edge functions are publicly invokable, enabling data poisoning/cost abuse

- `supabase/config.toml:6-22` explicitly sets `verify_jwt = false` for multiple ingestion/security functions.
- Those functions then use `SUPABASE_SERVICE_ROLE_KEY` and perform writes without caller auth checks:
  - `supabase/functions/ingest-threatfox/index.ts:21-24,81-89`
  - `supabase/functions/ingest-sans-isc/index.ts:21-24,60-63`
  - `supabase/functions/ingest-ransomwatch/index.ts:21-24,55-71`
  - `supabase/functions/ingest-tor-exits/index.ts:21-24,48-57`
  - `supabase/functions/ingest-mastodon/index.ts:59-62,130-138`

Impact: any external caller can trigger expensive external fetches and write operational data through service-role pathways.

---

### 2) Critical: internal threat intelligence and user-linked telemetry are accessible through edge functions without role checks

- `supabase/functions/threat-chat/index.ts:24-48` reads `threats`, `threat_news`, and `ato_events` with service role and includes `user_email` in model context.
- `supabase/functions/threat-briefing/index.ts:22-48` reads broad internal datasets with service role.
- `supabase/functions/analyze-threat/index.ts:27-41` and `supabase/functions/converged-intel/index.ts:25-41` do the same.
- No explicit caller role validation in these functions before returning analysis outputs.

Impact: anonymous/low-privilege callers can request synthesized intelligence from privileged internal data.

---

### 3) High: RLS policies labeled “service role” are permissive (`WITH CHECK (true)`), likely allowing broader writes

- `supabase/migrations/20260216025055_61c20f69-0de2-4689-96d4-8cd2740bfb49.sql:98-106`
- `supabase/migrations/20260216033852_f1ac771b-b82c-45e0-9d4f-24ce547fe084.sql:29-30`
- `supabase/migrations/20260216151424_21e42347-dc63-48d8-9a3b-4c0253c71236.sql:15-19`

Impact: if default table grants to `anon`/`authenticated` remain in place, these policies allow unintended direct INSERT/UPDATE access.

---

### 4) High: Admin “Database Status” can fail globally due wrong timestamp column on `attack_metrics`

- `src/components/radar/AdminPanel.tsx:55` includes table `attack_metrics`.
- `src/components/radar/AdminPanel.tsx:66` applies `.gte("created_at", todayISO)` to all tables.
- But `attack_metrics` uses `recorded_at` (see schema in `supabase/migrations/20260216025055_...sql:74-81` and generated types).

Impact: one failing query can force `dbOnline=false` and suppress all table stats.

---

### 5) Medium: forgot-password flow submits twice and still requires password field

- Form submit handler already dispatches forgot flow in forgot mode: `src/pages/Login.tsx:61`.
- Button also calls `handleForgotPassword` on click: `src/pages/Login.tsx:108`.
- Password input remains `required` even in forgot mode: `src/pages/Login.tsx:83-94`.

Impact: duplicate reset requests and broken UX when users only have email.

---

### 6) Medium: threat map misuses `vendor` as country when aggregating threat news

- `src/components/radar/ThreatMapWidget.tsx:147` calls `add(n.vendor, ...)`.

Impact: map geography is inaccurate (vendor/product names are not countries), distorting situational awareness.

---

### 7) Medium: trend chart is sorted lexicographically by `"MMM dd"` strings

- Date bucketing format: `src/components/radar/ThreatStatistics.tsx:85`
- Sort logic: `src/components/radar/ThreatStatistics.tsx:90`

Impact: cross-month chronology can be wrong (e.g., `"Apr 01"` may sort before `"Feb 20"`), misleading trend interpretation.

---

### 8) Medium: threat ingestion uses plaintext HTTP for PhishTank feed

- `supabase/functions/ingest-threats/index.ts:136` fetches `http://data.phishtank.com/data/online-valid.csv`.

Impact: feed integrity can be tampered in transit (MITM), contaminating IOC data.

---

### 9) Testing gap: only one placeholder test exists

- `src/test/example.test.ts:3-6` contains only `expect(true).toBe(true)`.

Impact: core auth flows, edge-function contracts, and correlation logic have no effective regression coverage.

---

### 10) Build warning: CSS import ordering issue

- `src/index.css:1-5` places `@import` after Tailwind directives.
- Vite build warns `@import must precede all other statements`.

Impact: non-fatal currently, but can break style consistency in stricter pipelines/toolchains.

## Notes

- Lint currently reports substantial type-safety debt (`any` usage and related rules), which may hide real defects and reduce maintainability.
