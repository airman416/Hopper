# Content Engine

Content Engine helps you repurpose your social media posts across different platforms. Load posts from X (Twitter), LinkedIn, or Instagram, then use AI to adapt them into new formats—LinkedIn posts, tweets, Instagram carousels, newsletter sections, or punchy quotes. Export polished images ready to share.

---

## Features

### Load Your Posts
- **Refresh** to pull your latest posts from X, LinkedIn, and Instagram
- Posts appear in a feed—expand a platform and click a post to select it
- Engagement metrics (likes, comments, shares) are shown when available

### Convert to Any Format
Switch between five output formats with tabs or keyboard shortcuts:

| Format | Shortcut | What it does |
|--------|----------|---------------|
| **LinkedIn** | L | Professional, conversational posts with short paragraphs |
| **X (Twitter)** | X | Sharp, concise tweets or thread-worthy posts |
| **IG Carousel** | I | Multi-slide carousels with headings and body text |
| **Newsletter** | N | Expanded sections with subject lines |
| **Quote** | Q | Single punchy quotable sentence |

### AI Generation
- **Generate** creates a new draft in your chosen format, tailored to your voice
- **Punchier** (P) — makes the draft tighter and more impactful
- **Hater** (H) — generates a cynical opposing reply (great for stress-testing ideas)
- **Shaan** (S) — rewrites in Shaan Puri’s conversational style

### Feedback That Trains the AI
- **Approve** drafts you’d actually use — they become positive examples for future generations
- **Reject** drafts you wouldn’t use — the AI learns what to avoid
- Your feedback improves the model over time

### Readability
- **F-K Score** (Flesch-Kincaid grade level) shows how easy the text is to read
- Green = easy, Amber = moderate, Red = harder
- Target: 7 or below (8th grade level)

### Export
- **Export** downloads your content as a polished image (PNG)
- Choose **Square**, **Portrait**, or **Story** dimensions
- Pick fonts, colors, and backgrounds
- Shortcut: **⌘↵** (Cmd+Enter) or **Ctrl+Enter**

### Other
- **Undo/Redo** for draft edits
- **Trash** — view and restore rejected drafts
- **Settings** — add API keys, toggle sound, configure Ollama (optional)
- **Onboarding tour** on first use

---

## Getting Started

### What You Need
- **Node.js** (v18 or newer)
- A **Claude API key** (from [Anthropic](https://console.anthropic.com/))
- Optional: **Apify** and **LinkdAPI** keys for loading posts from X, LinkedIn, and Instagram

### Quick Setup

1. **Clone the repo**
   ```bash
   git clone https://github.com/airman416/Hopper.git
   cd Hopper
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Add your API keys**
   - Copy `.env.example` to `.env`
   - Add your `CLAUDE_API_KEY` (required for AI)
   - Add `APIFY_API_KEY` and `LINKEDAPI_API_KEY` if you want to load posts from X, LinkedIn, and Instagram

4. **Run the app**
   ```bash
   npm run dev
   ```
   Or with Netlify (recommended for production-like behavior):
   ```bash
   npm start
   ```

5. **Open in your browser**
   - Go to `http://localhost:5000` (or the URL shown in the terminal)
   - Add your Claude API key in **Settings** if you didn’t set it in `.env`
   - Click **Refresh** to load posts (if you have feed API keys)
   - Select a post, pick a format, and click **Generate**

### API Keys

| Key | Where to get it | Used for |
|-----|-----------------|----------|
| **Claude** | [Anthropic Console](https://console.anthropic.com/) | AI generation (required) |
| **Apify** | [Apify](https://apify.com/) | X and Instagram feeds |
| **LinkdAPI** | [LinkdAPI](https://linkdapi.com/) | LinkedIn feed |

You can add keys in **Settings** (stored in your browser) or in `.env` for server-side use.

---

## Architecture Overview

Content Engine is a web app with:

- **Frontend** — React app (Vite) with a dashboard, source feed, workshop, and preview
- **Backend** — Express server (dev) or Netlify Functions (production) for feeds and AI
- **Storage** — Local IndexedDB (Dexie) for posts, drafts, and feedback
- **AI** — Claude for generation; optional Ollama for local models

For more technical detail, see **[ARCHITECTURE.md](./ARCHITECTURE.md)**.

---

## In Progress

**Deploying a Sam-style voice model** — A model fine-tuned on Sam Parr’s past tweets to write in his voice is in the works. It’s based on [Meta-Llama-3-8B-Instruct](https://huggingface.co/meta-llama/Meta-Llama-3-8B-Instruct) with a LoRA adapter trained on his tweet data. The model lives at [airman416/sam-llama-3-lora](https://huggingface.co/airman416/sam-llama-3-lora) but is not yet deployed. Once deployed, it will be available as an alternative to Claude for generation, giving you a dedicated Sam-voice model instead of prompting a general-purpose one.

---

## Deployment

The app is set up for **Netlify**:

- Build: `npm run build`
- Publish: `dist/`
- Functions: `netlify/functions`

Set your environment variables (e.g. `CLAUDE_API_KEY`, `APIFY_API_KEY`, `LINKEDAPI_API_KEY`) in the Netlify dashboard.

---

## License

MIT
