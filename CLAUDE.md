# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

| Command | Description |
|---------|-------------|
| `pnpm dev` | Start development server (Vite + Express) at http://localhost:3000 |
| `pnpm build` | Build the app: Vite build + webflow export + esbuild server bundle |
| `pnpm start` | Start production server (node dist/index.js) |
| `pnpm check` | Run TypeScript type check |
| `pnpm format` | Format all files with prettier |
| `pnpm test` | Run all vitest tests |
| `pnpm db:push` | Generate and run Drizzle migrations |
| `pnpm preview:landing` | Run the landing page preview script |

## Architecture Overview

This is a **Global Kids School ERP** — a full-stack web application for school management with admissions, parent/staff communication, and analytics.

### Directory Structure

- `client/` — React + Vite frontend
- `server/` — Express + tRPC backend
- `api/` — Vercel edge functions (API routes)
- `shared/` — Shared types and utilities used by both client and server
- `scripts/` — Utility scripts (seed, backfill, build tools)

### Key Technical Decisions

1. **Auth**: Supabase Auth with two-factor sign-in (USN/password + OTP code). Students and staff require password + OTP; admins and above use single-step.

2. **Role System**: Eight roles with granular data access:
   - `super_admin` — full access to everything
   - `admin` — everything except credentials/passwords
   - `principal` — academic oversight, no finance/accounts data
   - `teacher` — own pupils and marking, no money/accounts
   - `staff` — minimal: overview, students, attendance, settings
   - `accountant` — finance + students + attendance + reports + settings
   - `student` — self and own documents (portal)
   - `parent` — own child's attendance and fees only

3. **AI Assistant**: Server-side Gemini assistant with role-scoped data briefs. Credentials stored sealed in Supabase `settings` table. The `shared/ai-access.ts` module is the single source of truth for what each role can see and do.

4. **tRPC**: Type-safe router bridging Express and React. `server/_core/trpc.ts` defines `protectedProcedure` and `adminProcedure` middleware that resolve the caller's role from Supabase session.

5. **Data Fetching**: `client/src/lib/erp-views.ts` composes Supabase tables into flat dashboard rows. Uses a row-level cache to avoid duplicate paging.

6. **UI**: shadcn/ui component library (Radix primitives + Tailwind). `client/src/components/ui/` has 50+ reusable components. Design system in `DESIGN.md` and `client/src/lib/erp-views.ts` mock data.

7. **Database**: Drizzle ORM with MySQL. Schema at `drizzle/schema.ts`. Migrations managed via `drizzle-kit`.

### Development Commands (Single Tests)

- `pnpm test -- --run src/api/login.test.ts` — run a single test file
- `pnpm test -- --run src/client/src/components/ui/button.test.tsx` — run UI component test
- `pnpm test -- --run` — run all tests

## Code Patterns

### API Routes (`api/`)

- All routes export `config = { runtime: "nodejs" }` (except `ai.ts` which is `"edge"`)
- Use `Response.json()` for all responses
- Rate limiting via `throttled()` Map pattern (window: 60s, max 20 attempts)
- Generic error messages that don't leak whether an account exists
- OTP flow: `/api/otp` — request code, then verify code → mint session

### Server (`server/`)

- `server/_core/index.ts` — Express setup, tRPC, OAuth, static serving
- `server/_core/context.ts` — Creates tRPC context from Supabase auth
- `server/routers.ts` — Routes: system, auth (me, logout)
- `server/_core/trpc.ts` — TRPC context, `protectedProcedure`, `adminProcedure`

### Shared Module (`shared/`)

- `shared/super-admin.ts` — Immutable super admin check by UUID
- `shared/ai-auth.ts` — Resolve caller role from Supabase session
- `shared/ai-config.ts` — Sealed AI config (AES-GCM encrypted), `loadSharedAiConfig()`
- `shared/ai-access.ts` — **Single source of truth**: role screens, brief scoping, sanitisation
- `shared/const.ts` — Error messages, cookie names, patterns
- `shared/username-lookup.js` — Username/email resolution utilities

### Client (`client/`)

- `client/src/main.tsx` — App entry, QueryClient, TRPC client with sessionStorage fallback
- `client/src/App.tsx` — ErrorBoundary + ThemeProvider + Router
- `client/src/pages/` — Page components (Dashboard, Home, Login, etc.)
- `client/src/components/ui/` — 50+ shadcn/ui components
- `client/src/components/public/` — Footer, Navbar
- `client/src/contexts/ThemeContext.tsx` — Dark/light theme

### AI Assistant Flow

1. Client sends question + role + activeScreen to `/api/ai`
2. Server resolves caller role via `resolveCaller(req)` (supabase-auth)
3. Server scopes the data brief via `scopeBrief(brief, role)` (shared/ai-access.ts)
4. Server builds system prompt with role-appropriate screens + data brief
5. Calls Gemini with tools (`search_records`) for individual lookups
6. Returns sanitised suggestion (sanitiseScreen filters buttons by role access)

### Testing

- Uses vitest with `environment: "node"`
- Test files match `api/**/*.test.ts`, `client/**/*.test.ts`, `server/**/*.test.ts`
- Tests extensively mock Supabase fetch calls
- AI assistant tests verify role-scoping and data brief filtering

## Common Tasks

### Adding a new API route

1. Create `api/<name>.ts` following the pattern: `config = { runtime: "nodejs" }`, POST handler
2. Import shared utilities from `../shared/`
3. Return `Response.json()` with consistent error shapes
4. Add test in `api/<name>.test.ts`

### Adding a new UI component

1. Create `client/src/components/ui/<Name>.tsx` using Radix + Tailwind patterns
2. Export from `client/src/components/ui/index.tsx` if needed
3. Follow existing component structure: `const Component = (...) => ...`
4. Add tests if interactive

### Adding a new dashboard screen for the AI

1. Add screen to `shared/ai-access.ts:AI_SCREENS` with label and blurb
2. Add screen to `shared/ai-access.ts:ROLE_SCREENS` for each role that should see it
3. Add dataset keys to `shared/ai-access.ts:BRIEF_SCOPES` with screen mapping
4. Ensure the API route fetches the needed data and passes it as the data brief

### Running migrations

```bash
pnpm db:push
```

This runs `drizzle-kit generate` then `drizzle-kit migrate` using the DATABASE_URL from env.

### Building for production

```bash
pnpm build
```

This runs Vite build, the webflow export script, and esbuild to bundle the server for `dist/`.

### Starting the app

```bash
pnpm dev    # development with Vite HMR
pnpm start  # production mode (requires dist/ from build)
```