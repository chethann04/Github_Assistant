# GitHub Knowledge Assistant ⚡

An AI-powered codebase intelligence platform where you paste any public GitHub repository URL and immediately chat with the code, perform semantic search, synthesize architecture overviews, auto-generate documentation, review security bugs, and analyze commit history.

---

## 🚀 Key Features

1. **Async Repository Ingestion**:
   - Background ingestion pipeline (`PENDING` → `CLONING` → `CHUNKING` → `EMBEDDING` → `COMPLETED`).
   - GitHub REST API tree walker filtering non-code/binary directories.
   - Logical Code Chunker extracting function, class, and interface boundaries with `startLine` and `endLine` tracking.
2. **ChromaDB Local Vector Engine**:
   - Local disk persistence in `./data/chroma` without Docker or external servers.
   - Multi-repo collection namespaces keyed by `repositoryId` and `commitSha` for zero collision.
   - Vector-level repository isolation on every search.
3. **RAG Chat & SSE Streaming with Citations**:
   - Real-time Server-Sent Events (`POST /api/v1/chat/stream`).
   - Persistent `chatSessionId` across conversation turns.
   - Vector-first retrieval with zero silent GitHub fallbacks.
   - Verifiable source citation pills (`[File: src/index.ts, Lines 12-45]`) on every response.
   - Interactive slide-over citation drawer with 1-click snippet copy.
4. **AI Architecture Overview**:
   - Synthesizes system design, module hierarchy, technology stack, and data execution flows.
5. **Auto Documentation Generator**:
   - 1-click generation of production `README.md`, `API Reference Specifications`, and `JSDoc/TypeDoc Docstrings`.
6. **Bug & Security Scanner**:
   - Surfaces unhandled exceptions, null safety hazards, and injection risks with severity badges and suggested code patches.
7. **Commit History & Hotspots**:
   - Live GitHub commit timeline and file change hotspot frequency meters.

---

## 🛠 Tech Stack

- **Frontend**: Next.js 14 (App Router, TypeScript), Tailwind CSS, Lucide React, Glassmorphism design tokens.
- **Backend**: Node.js + Express.js REST API (`/api/v1`), TypeScript.
- **Database**: Supabase PostgreSQL + Prisma ORM.
- **Vector Database**: ChromaDB Local Persistent Engine (`1536` dimensions, `gemini-embedding-2`).
- **AI Orchestration**: Google Gemini (`@google/genai` with `gemini-3.6-flash`).

---

## 🏁 Quickstart Guide

### 1. Configure Environment Variables
Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```
Configure your `DATABASE_URL` (Supabase PostgreSQL) and `GEMINI_API_KEY`.

### 2. Install ChromaDB Python Package
```bash
pip install chromadb
```
ChromaDB runs locally and persists all vector indexes directly to `./data/chroma`. No Docker or server setup required!

### 3. Generate Prisma Bindings & Push Schema
```bash
npm run db:generate
npm run db:push
```

### 4. Start Monorepo in Development Mode
```bash
npm run dev
```

- **Frontend Application**: [http://localhost:3000](http://localhost:3000)
- **Backend REST API**: [http://localhost:4000/api/v1/health](http://localhost:4000/api/v1/health)

---

## 🧪 Testing & Verification

### Build & Typecheck
```bash
npm run build
```

### Test Repository Ingestion
1. Open [http://localhost:3000](http://localhost:3000).
2. Paste any public GitHub repo (e.g. `https://github.com/chethann04/Deadlock-Detection-`).
3. Watch the real-time multi-stage ingestion progress bar (`Fetch Tree` → `Logical Chunking` → `Vector Embed` → `Vector Store`).
4. Click **Chat with Codebase** to access the Intelligence Suite.
