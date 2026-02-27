# The Hopper - Content Repurposing Engine

## Overview
A high-performance content repurposing tool that takes social media posts and uses Claude AI to rewrite them for different platforms (LinkedIn, Twitter/X, Instagram Carousel, Newsletter).

## Architecture
- **Frontend**: React + Vite + Tailwind CSS + Zustand (state) + Dexie.js (IndexedDB local storage)
- **Backend**: Express.js - thin proxy for Anthropic AI API calls
- **AI**: Anthropic Claude via Replit AI Integrations (no user API key needed)
- **Storage**: Client-side IndexedDB via Dexie.js (no PostgreSQL used)

## Key Features
- Three-column dashboard (Source Feed, Workshop, Preview)
- Keyboard-first navigation (J/K navigate, A approve, R reject, Cmd+Enter export)
- Flesch-Kincaid readability scoring
- "Anti-AI" human score (flags banned AI words)
- AI micro-tools: Make Punchier, Hater Simulator, Shaan Puri toggle
- Swipe File Graveyard (rejected drafts saved for review)
- Tactile sound design (Web Audio API)
- LinkedIn zero-width space formatting for export

## File Structure
```
client/src/
  pages/dashboard.tsx        - Main three-column layout + keyboard shortcuts
  components/source-feed.tsx - Column 1: chronological post list
  components/workshop.tsx    - Column 2: editing workspace with tabs
  components/preview.tsx     - Column 3: platform-specific preview
  components/swipe-file.tsx  - Modal for rejected drafts
  lib/db.ts                  - Dexie.js database + mock seed data
  lib/store.ts               - Zustand state management
  lib/readability.ts         - Flesch-Kincaid + Anti-AI scoring
  lib/sounds.ts              - Web Audio API sound effects
server/
  routes.ts                  - AI proxy endpoints (/api/ai/*)
  storage.ts                 - Empty (no server storage needed)
shared/
  schema.ts                  - Zod schemas for data types
```

## Design System: "Utilitarian Luxury"
- Light mode only, monochrome foundation
- Background: #FAFAFA, Borders: #E5E5E5, Text: #111827
- Accent: #FF4F00 (Safety Orange) - only for primary "Export" action
- Typography: Inter (sans), JetBrains Mono (mono)
- 1px solid borders, no glassmorphism, no rounded pills
