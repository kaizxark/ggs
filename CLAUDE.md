# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

| Command | Description |
|---------|-------------|
| `pnpm dev` | Start the dev server (tsx watch on `server/_core/index.ts`) at http://localhost:3000 |
| `pnpm build` | Vite build → webflow export script → esbuild bundle of `server/_core/index.ts` into `dist/` |
| `pnpm start` | Run production server: `NODE_ENV=production node dist/index.js` |
| `pnpm check` | TypeScript type check (`tsc --noEmit`) over `client/src`, `shared`, `server`, `api` |
| `pnpm format` | Format all files with Prettier |
| `pnpm test` | Run all Vitest tests (520 tests across 34 files) |
| `pnpm test -- --run <path>` | Run a single test file, e.g. `pnpm test -- --run api/login.test.ts` |
| `pnpm db:push` | `drizzle-kit generate` then `drizzle-kit migrate` using `DATABASE_URL` |
| `pnpm preview:landing` | Run `scripts/preview-landing.mjs` |

## Environment

Create a `.env` at the project root. Required variables:

- `DATABASE_URL` — MySQL connection string used by Drizzle (`server/db.ts`)
- `VITE_SUPABASE_URL` — Supabase project URL (client + server auth helpers)
- `VITE_SUPABASE_ANON_KEY` — Supabase anon key (browser-safe)
- `SUPABASE_SECRET_KEY` / `SUPABASE_SERVICE_ROLE_KEY` — server-side Supabase access
- `GEMINI_API_KEY` — powers the role-scoped AI assistant

## High-Level Architecture

**Global Kids School ERP** — full-stack school management for admissions, attendance, fees, timetables, and parent/staff communication, with a role-scoped AI assistant.

### Layers

```
client/        React 19 + Vite 7 frontend (Wouter router, TanStack Query v5, Tailwind v4, Framer Motion)
server/        Express + tRPC v11; bridges api/ route handlers onto Express in dev
api/           Vercel serverless functions (nodejs runtime; ai.ts is "edge")
shared/        Types and logic used on both sides: RBAC, AI scoping, Supabase clients
supabase/      SQL migrations + schema.sql (app_role enum, RLS policies)
scripts/       Seed/backfill/build utilities (mjs)
```

### Data flow

Browser → tRPC over HTTP (`/api/trpc`) or direct Vercel functions (`api/*`) → Express/tRPC or edge runtime → Supabase (Auth + PostgreSQL) or MySQL via Drizzle (`server/db.ts`).

Auth is Supabase-backed: USN/password + OTP for students and staff; single-step for admins and above. Role is resolved from the Supabase JWT and enforced both in `shared/ai-access.ts` (server-side scoping + sanitisation) and in Supabase RLS policies.

### Roles (single source of truth: `shared/ai-access.ts`)

Eight roles with granular screen/data access:

- `super_admin` — every screen
- `admin` — everything except credentials
- `principal` — academic oversight, no finance
- `teacher` — own pupils and marking, no money
- `staff` — overview, students, attendance, settings
- `accountant` — finance + students + attendance + reports + settings
- `student` — self and own documents (portal)
- `parent` — own child's attendance and fees only

### AI assistant flow

1. Client posts question + role + active screen to `/api/ai`
2. Server resolves caller role via `resolveCaller()` (`shared/ai-auth.ts`)
3. Data brief scoped via `scopeBrief(brief, role)` (`shared/ai-access.ts`) — runs server-side, client copy never trusted
4. System prompt built from role-appropriate screens + scoped brief
5. Gemini called with `search_records` tool for individual lookups
6. Response sanitised via `sanitiseSuggestion()` — buttons filtered by role access

## Key Modules

### `shared/`

- `ai-access.ts` — `AI_SCREENS`, `ROLE_SCREENS`, `BRIEF_SCOPES`, `scopeBrief`, `sanitiseSuggestion`, `screensForRole`, `canSeeScreen`, `isSuperAdminId`
- `ai-auth.ts` — `resolveCaller(req)`, `SERVICE_KEY`, role resolution from session
- `ai-config.ts` — sealed AES-GCM AI config, `loadSharedAiConfig()`
- `const.ts` — `COOKIE_NAME`, `UNAUTHED_ERR_MSG`, `NOT_ADMIN_ERR_MSG`, OAuth state helpers
- `super-admin.ts` — immutable super-admin check by UUID
- `username-lookup.ts` — username/email resolution
- `staff-access.ts`, `student-access.ts` — per-role access guards
- `attendance.ts`, `fee-payments.ts`, `timetable.ts`, `portal-server.ts`, `otp-mail.ts`, `reset-email.ts`

### `server/`

- `_core/index.ts` — Express app, tRPC adapter, OAuth, static serving, api/ bridging
- `_core/context.ts` — tRPC context from Supabase auth
- `_core/trpc.ts` — `protectedProcedure`, `adminProcedure`
- `routers.ts` — appRouter: system + auth (me, logout) procedures
- `db.ts` — Drizzle/MySQL client (`drizzle-orm/mysql2`)
- `storage.ts` — Supabase Storage wrapper

### `api/` (Vercel serverless functions)

All export `config = { runtime: "nodejs" }` except `ai.ts` (`"edge"`). All return `Response.json()`. Rate limiting uses a `throttled()` Map pattern (60s window, 20 attempts).

Routes: `ai`, `ai-settings`, `attendance`, `documents`, `invite`, `login`, `mdview`, `otp`, `portal-admin`, `receipt-email`, `recover`, `report-card-email`, `staff-profile`, `staff`, `students`, `student-profile`, `timetable`, `upload`.

Notable: `/api/login` — USN-only sign-in, OTP generation, password verification, session minting. `/api/otp` — request then verify code → mint session.

### `client/`

- `src/main.tsx` — entry: QueryClient, tRPC client, sessionStorage fallback
- `src/App.tsx` — ErrorBoundary + ThemeProvider + Wouter router
- `src/pages/` — Dashboard, Home, Login, MdView, ResetPassword, StudentDirectory, StudentProfile, About, Contact
- `src/components/ui/` — 50+ shadcn/ui components (Radix primitives + Tailwind)
- `src/components/public/` — Footer, Navbar
- `src/contexts/ThemeContext.tsx` — dark/light theme
- `src/lib/supabase.ts` — Supabase client (reads `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY`)
- `src/lib/erp-views.ts` — flat dashboard rows from Supabase tables, row-level cache
- `src/lib/trpc.ts` — client tRPC links

### Path aliases (`tsconfig.json`, `vitest.config.ts`)

- `@/*` → `./client/src/*`
- `@shared/*` → `./shared/*`

## Design System

`DESIGN.md` governs the UI: Apple HIG-inspired, light-first ("Banyan") workspace, Manrope headers / DM Sans body, deep ink teal + forest teal + warm saffron palette. Token names are the API — no raw hex in components. Enforced by the `impeccable` skill via `.claude/settings.local.json` hooks (post-Edit/Write check + full deep pass on Stop).

## Common Tasks

### Adding a new API route

1. Create `api/<name>.ts`: `config = { runtime: "nodejs" }`, POST handler, `Response.json()` responses
2. Import shared utils from `../shared/` (e.g. `const.ts`, `ai-access.ts`)
3. Add rate limiting via `throttled()` if needed
4. Add test in `api/<name>.test.ts` (vitest mocks Supabase fetch calls)

### Adding a new dashboard screen for the AI

1. Add screen to `shared/ai-access.ts:AI_SCREENS` with `label` and `blurb`
2. Add screen to `ROLE_SCREENS` for each role that should see it
3. Add dataset keys to `BRIEF_SCOPES` mapping screen → dataset keys
4. Ensure the API route fetches the data and passes it as the brief to `/api/ai`

### Running migrations

```bash
pnpm db:push
```
Runs `drizzle-kit generate` then `drizzle-kit migrate` using `DATABASE_URL`. Supabase SQL migrations live in `supabase/migrations/`.

### Building for production

```bash
pnpm build   # vite build → webflow export → esbuild server bundle → dist/
pnpm start   # NODE_ENV=production node dist/index.js
```

## Testing

- Vitest, `environment: "node"`, setup via `vitest.setup.ts`
- Test globs: `api/**/*.test.ts`, `shared/**/*.test.ts`, `server/**/*.{test,spec}.ts`, `client/**/*.{test,spec}.ts`
- Tests extensively mock Supabase fetch calls
- AI assistant tests verify role-scoping and data brief filtering

<!-- Development workflow: Vite HMR and TypeScript type checks -->

<!-- Testing: Vitest test coverage across api, shared, and client modules -->

<!-- Production build: esbuild server bundle and Webflow runtime export -->
