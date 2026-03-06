# Architecture

This document describes the technical architecture of Content Engine. For a high-level overview and setup instructions, see [README.md](./README.md).

---

## High-Level Structure

```
Hopper/
├── client/           # React frontend (Vite)
├── server/           # Express server (development)
├── netlify/          # Netlify Functions (production API)
├── shared/            # Shared schemas (Zod)
└── dist/              # Built output (Vite)
```

- **Development**: Express serves the app and API routes; Vite provides HMR.
- **Production**: Netlify serves static files from `dist/` and runs serverless functions from `netlify/functions`.

---

## Frontend

### Tech Stack
- **React 18** with **TypeScript**
- **Vite 7** for build and dev server
- **Wouter** for routing
- **Zustand** for global state
- **TanStack Query** for server state
- **Radix UI** for components
- **Tailwind CSS** for styling
- **Framer Motion** for animations

### Key Modules

| Path | Purpose |
|------|---------|
| `client/src/pages/dashboard.tsx` | Main dashboard layout, panels, shortcuts |
| `client/src/components/source-feed.tsx` | Feed of posts from X, LinkedIn, Instagram |
| `client/src/components/workshop.tsx` | Draft editor, Generate, Punchier, Hater, Shaan |
| `client/src/components/preview.tsx` | Image preview, export, dimensions, fonts |
| `client/src/components/trash.tsx` | Rejected drafts |
| `client/src/components/settings.tsx` | API keys, Ollama URL, sound toggle |
| `client/src/lib/store.ts` | Zustand store (posts, drafts, UI state) |
| `client/src/lib/db.ts` | Dexie (IndexedDB) schema and feed loading |
| `client/src/lib/agenticPipeline.ts` | Generation pipeline (Claude vs Ollama+Haiku) |
| `client/src/lib/promptBuilder.ts` | Dynamic prompt assembly for Claude |
| `client/src/lib/oramaSearch.ts` | RAG: Orama semantic search over training data |
| `client/src/lib/readability.ts` | Flesch-Kincaid and human-score calculations |

### State Flow
- **Zustand** holds UI state, selected post, active tab, drafts, loading flags.
- **Dexie** persists source posts, drafts, trash, approved/rejected vaults, historical posts, app settings.
- **Orama** indexes `historical_posts.instruction` for RAG; results feed into prompts.

---

## Backend

### Express (Development)
- `server/index.ts` — HTTP server, JSON middleware, error handler.
- `server/routes.ts` — API routes for feeds, image proxy, and AI (generate, punchier, hater, shaan).
- `server/vite.ts` — Vite dev middleware.
- `server/static.ts` — Serves `dist/` in production.

### Netlify Functions (Production)
All AI and feed logic runs as serverless functions:

| Function | Purpose |
|----------|---------|
| `ai-architect.ts` | Step 1: Extract core insight and choose Sam Parr framework |
| `ai-writer.ts` | Step 2: Generate content with full prompt (rulebook, vault, RAG) |
| `ai-punchier.ts` | Make draft punchier |
| `ai-hater.ts` | Generate cynical opposing reply |
| `ai-shaan.ts` | Rewrite in Shaan Puri style |
| `ai-generate.ts` | Legacy/simple generation path |
| `ai-together.ts` | Together AI (optional Sam-Llama model) |
| `feed-twitter.ts` | Fetch X posts via Apify |
| `feed-linkedin.ts` | Fetch LinkedIn posts via LinkdAPI |
| `feed-instagram.ts` | Fetch Instagram posts via Apify |

API keys: `CLAUDE_API_KEY` from env or `x-claude-api-key` header; `APIFY_API_KEY`, `LINKEDAPI_API_KEY` for feeds.

---

## AI Pipeline

### Claude Path (Default)
1. **Architect** (`ai-architect`) — Analyzes source text, returns `{ coreInsight, framework }`.
2. **Writer** (`ai-writer`) — Receives:
   - System blocks: Core Persona, Syntax Rulebook, Voice Vault, positive/negative examples
   - User message: source text + Architect framework
   - Uses Anthropic prompt caching on static blocks

### Ollama + Haiku Path (Optional)
1. **Ollama** (local) — Generates raw content in Sam’s voice (minimal prompt).
2. **Claude Haiku** (`ai-writer`) — Reformats for platform (carousel, LinkedIn, etc.) without changing voice.

### In Progress: Sam-Llama Deployment
- A LoRA adapter ([airman416/sam-llama-3-lora](https://huggingface.co/airman416/sam-llama-3-lora)) fine-tuned on Sam Parr’s tweets is trained but not yet deployed.
- `ai-together.ts` is wired for Together AI inference; once the model is deployed, `TOGETHER_MODEL_ID` can point to it for native Sam-voice generation.

### Prompt Assembly
- `promptBuilder.ts` builds prompts per model:
  - **Claude**: Full rulebook, Voice Vault, RAG results, approved/rejected examples.
  - **Llama/Ollama**: Lightweight persona + RAG only.
- RAG: `oramaSearch.ts` queries Orama over `historical_posts.instruction`, returns top outputs by relevance × weight.

---

## Data Layer

### IndexedDB (Dexie)
- **sourcePosts** — Loaded posts from X, LinkedIn, Instagram.
- **drafts** — Generated content per platform, status (draft/approved/rejected).
- **trash** — Rejected drafts with reason.
- **approved_vault** — Approved posts used as positive examples.
- **rejected_vault** — Rejected posts + reason used as negative examples.
- **historical_posts** — Training data (instruction/output pairs) for RAG.
- **app_settings** — Onboarding completion, etc.

### RAG (Orama)
- Indexes `historical_posts.instruction`.
- Search returns matching `output` content for few-shot prompting.
- Results ranked by relevance × `weight_score`.

---

## Feed APIs

| Platform | Provider | Env Var |
|----------|----------|---------|
| X (Twitter) | Apify | `APIFY_API_KEY` |
| Instagram | Apify | `APIFY_API_KEY` |
| LinkedIn | LinkdAPI | `LINKEDAPI_API_KEY` |

Feed responses are cached in `localStorage` (5 min TTL) to reduce API calls.

---

## Export

- **html-to-image** renders the preview DOM to canvas.
- **JSZip** bundles multiple slides (e.g. carousel) into a ZIP.
- **file-saver** triggers download.
- Image proxy (`/api/proxy/image` or wsrv.nl) fetches external images for export.

---

## Environment Variables

| Variable | Required | Purpose |
|----------|----------|---------|
| `CLAUDE_API_KEY` | Yes (for AI) | Anthropic API key |
| `APIFY_API_KEY` | For feeds | X and Instagram scraping |
| `LINKEDAPI_API_KEY` | For feeds | LinkedIn posts |
| `TOGETHER_API_KEY` | Optional | Together AI (Sam-Llama) |
| `TOGETHER_MODEL_ID` | Optional | Custom model ID |
| `DATABASE_URL` | Optional | Drizzle/Postgres (if used) |

Keys can also be set in Settings (stored in `localStorage`) and sent via `x-claude-api-key` header.

---

## Build & Deploy

- **Build**: `npm run build` → Vite outputs to `dist/`
- **Dev**: `npm run dev` (Vite) or `npm start` (Netlify dev)
- **Netlify**: `netlify.toml` configures build command, publish dir, and functions path
