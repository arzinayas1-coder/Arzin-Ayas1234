# FORGE AI — Architecture & External Deployment Guide

FORGE AI runs out of the box as a full-stack Express + React + Monaco + SQLite + isolated workspace execution service on port `3000`.

## Implemented Components (Active Runtime)
- **Authentication & Persistence (`src/server/db.ts`, `src/server/auth.ts`)**: SQLite (`better-sqlite3`) with `bcryptjs` password hashing, signed JWT `httpOnly` cookies, and AES-256-GCM encryption (`src/server/crypto.ts`) for external third-party provider credentials.
- **Isolated Workspace & Codebase Indexer (`src/server/workspace.ts`, `src/server/indexer.ts`)**: Per-project filesystem boundaries under `.forge-workspaces/<projectId>`, path-traversal enforcement, symbol indexing, and relevance scoring.
- **Execution Sandbox & Dev Server Proxy (`src/server/executor.ts`)**: Real `child_process.spawn` execution with secret stripping (`GEMINI_API_KEY` and server secrets stripped from child environments), command allow/deny guards, WebSocket output streaming (`/ws`), and an internal reverse proxy (`/api/preview/:projectId/`) connecting the Live Preview iframe to running dev servers.
- **Autonomous Agent Engine (`src/server/agent.ts`, `src/server/providers.ts`)**: Real multi-step tool calling loop with stage tracking, plan generation, 16 coding tools, iteration/time limits, and modular adapters for Gemini (`@google/genai`), OpenAI, Anthropic, OpenRouter, Groq, and Custom OpenAI-compatible APIs.

## Deploying with External Supabase + Container Sandbox Runner
When scaling beyond a single Node host:
1. **Supabase Database & Auth**: Apply `supabase/migrations/001_initial_schema.sql` to your Supabase project. Note that third-party provider secrets belong exclusively in `private_vault.provider_secrets`, accessible only via `SUPABASE_SERVICE_ROLE_KEY` in server-side Edge Functions / Express backend.
2. **Remote Container Sandbox (Fly Machines / Firecracker / Docker)**: Replace `src/server/executor.ts` transport calls with an authenticated RPC bridge to an ephemeral container daemon per `projectId` enforcing cgroups CPU/memory limits and egress firewall rules.
