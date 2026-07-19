# Next.js Frontend Migration (Option A)

## Architecture

**Frontend:** Next.js 14 (React with SSR/SSG)
**Backend:** FastAPI (unchanged - keeps all existing Python logic)

```
┌─────────────────────────────────────────┐
│          Next.js Frontend (Port 3000)    │
│  - Server-side rendering                │
│  - File-based routing                   │
│  - React components                     │
│  - Session-based auth                   │
└─────────────────┬───────────────────────┘
                  │ HTTP Calls
                  ↓
┌─────────────────────────────────────────┐
│         FastAPI Backend (Port 8000)     │
│  - All existing APIs unchanged          │
│  - Neo4j database                       │
│  - RAG with Anthropic                   │
│  - Authentication                       │
└─────────────────────────────────────────┘
```

## File Structure

```
bjj-world/
├── app/                              # Next.js App Router
│   ├── layout.tsx                    # Root layout (Header, providers)
│   ├── globals.css                   # Global styles
│   ├── page.tsx                      # Landing page /
│   ├── signin/page.tsx               # Sign in /signin
│   ├── c/
│   │   └── [id]/page.tsx            # Conversation /c/{id}
│   ├── path/page.tsx                # Path Finder /path
│   ├── graph/page.tsx               # Graph /graph
│   ├── history/page.tsx             # History /history
│   ├── profile/page.tsx             # Profile /profile
│   ├── prep/page.tsx                # Class Prep /prep
│   ├── technique/
│   │   └── [name]/page.tsx          # Technique page
│   ├── a/
│   │   └── [id]/page.tsx            # Analysis /a/{id}
│   └── s/
│       └── [id]/page.tsx            # Shared analysis /s/{id}
│
├── components/                       # React components
│   ├── Header.tsx                   # Main header (navigation)
│   ├── Chat.tsx                     # Chat component with streaming
│   ├── Graph.tsx                    # Graph visualization
│   ├── PathFinder.tsx               # Path finder tool
│   └── ...
│
├── lib/                             # Utilities and helpers
│   ├── api.ts                       # API client for FastAPI
│   ├── auth.ts                      # Auth utilities
│   └── ...
│
├── public/                          # Static assets
│   └── ...
│
├── backend/                         # FastAPI backend (UNCHANGED)
│   ├── main.py
│   ├── routes/
│   ├── services/
│   └── requirements.txt
│
├── frontend/                        # Old vanilla JS (deprecated)
│   └── (keeping for reference)
│
├── package.json                     # Node dependencies
├── next.config.js                   # Next.js config
├── tsconfig.json                    # TypeScript config
└── README.md
```

## Key Components Created

### Pages
- **`app/page.tsx`** - Landing page with search, mode buttons
- **`app/c/[id]/page.tsx`** - Conversation view
- **`app/signin/page.tsx`** - Authentication page
- **`app/path/page.tsx`** - Path Finder tool
- **`app/graph/page.tsx`** - Graph visualization
- **`app/history/page.tsx`** - Conversation history
- **`app/profile/page.tsx`** - User profile settings
- **`app/prep/page.tsx`** - Class Prep (coach tier)

### Components
- **`Header.tsx`** - Navigation header with user menu
- **`Chat.tsx`** - Chat interface with streaming support
- Additional components in progress (Graph, PathFinder, etc.)

### Utilities
- **`lib/api.ts`** - FastAPI client with all endpoints
- **`lib/auth.ts`** - User session management

## How It Works

### Request Flow Example: Ask a Question

1. **User lands on `/`** (Next.js renders landing page server-side)
2. **User types question and clicks "Ask"** (form submission)
3. **Form POST to `/api/chat`** (FastAPI endpoint)
4. **FastAPI returns SSE stream** with conversation_id
5. **Browser navigates to `/c/{id}`** (Next.js renders conversation page)
6. **Page shows conversation with existing messages** (SSR)
7. **User can ask follow-ups** using Chat component

### Why This is Better Than Current SPA

- ✅ **Server-rendered HTML** - Better initial load, SEO
- ✅ **Traditional routing** - URLs directly correspond to pages
- ✅ **No client-side routing bugs** - The original problem is gone
- ✅ **Unified data layer** - All API calls in one place (`lib/api.ts`)
- ✅ **Built-in auth** - Next.js handles sessions properly
- ✅ **Keep Python backend** - No need to rewrite complex logic

## Setup & Running

### Prerequisites
- Node.js 18+
- FastAPI backend running on `http://localhost:8000`

### Install Dependencies
```bash
npm install
```

### Development
```bash
# Terminal 1: Start FastAPI backend
cd backend
uvicorn main:app --reload

# Terminal 2: Start Next.js frontend
npm run dev
```

Open `http://localhost:3000`

### Build for Production
```bash
npm run build
npm start
```

## API Integration

All API calls go through `lib/api.ts`:

```typescript
// Example: Getting a conversation
import { getConversation } from '@/lib/api'

const data = await getConversation('conv-id')
```

The API client automatically:
- Adds correct headers
- Includes credentials (session cookies)
- Handles errors
- Points to FastAPI backend

## What's Still Needed

- [ ] Implement Graph visualization component
- [ ] Implement PathFinder component
- [ ] Implement History component
- [ ] Implement Profile component
- [ ] Implement Prep component
- [ ] Implement Video upload/analysis
- [ ] Polish UI/styling (using existing CSS)
- [ ] Testing
- [ ] Deployment configuration

## Migration Notes

- **Frontend folder** - Kept for reference, not used
- **Backend folder** - Completely unchanged, still running FastAPI
- **CSS** - Reusing existing `frontend/css/app.css` via `@import` in `globals.css`
- **Database** - No changes needed, FastAPI handles all queries

## Environment Variables

### `.env.local`
```
NEXT_PUBLIC_API_URL=http://localhost:8000
```

### Backend `.env.local`
(Keep existing setup unchanged)
