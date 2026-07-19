# BJJ World - Next.js Frontend Setup Guide

## Quick Start

### Prerequisites
- Node.js 18+ (download from https://nodejs.org/)
- FastAPI backend running on `http://localhost:8000`

### Step 1: Install Dependencies

```bash
npm install
```

### Step 2: Configure Environment

Copy `.env.local.example` to `.env.local`:

```bash
cp .env.local.example .env.local
```

If running locally, you don't need to change anything. The default is:
```
NEXT_PUBLIC_API_URL=http://localhost:8000
```

For production, update to your backend URL:
```
NEXT_PUBLIC_API_URL=https://api.yourdomain.com
```

### Step 3: Start the Backend

In one terminal:

```bash
cd backend
pip install -r requirements.txt
uvicorn main:app --reload
```

Backend will be available at `http://localhost:8000`

### Step 4: Start the Frontend

In another terminal:

```bash
npm run dev
```

Frontend will be available at `http://localhost:3000`

---

## Testing the App

### 1. Landing Page (/)
- [ ] Opens without errors
- [ ] See search bar and hint buttons
- [ ] All navigation links visible
- [ ] "Sign in" button visible (if not authenticated)

### 2. Ask a Question
- [ ] Type in search box
- [ ] Click "Ask" or press Enter
- [ ] Navigates to `/c/{conversation-id}`
- [ ] See "Searching..." status
- [ ] Conversation appears with answer
- [ ] Can ask follow-up questions

### 3. Sign In (/signin)
- [ ] Click "Sign in" on landing page or header
- [ ] Enter email address
- [ ] Click "Send magic link"
- [ ] Backend sends email (check email or backend logs)
- [ ] Click link in email
- [ ] Redirected to home page, signed in

### 4. History (/history)
- [ ] Navigate to History
- [ ] See list of past conversations
- [ ] Click conversation to view it
- [ ] Click ✕ to delete conversation
- [ ] Click "+ New conversation" to go back to landing

### 5. Profile (/profile)
- [ ] Navigate to Profile
- [ ] See belt level dropdown
- [ ] See weight input
- [ ] See technique buttons to toggle
- [ ] Click "Save Profile"
- [ ] Profile saved in backend

### 6. Path Finder (/path)
- [ ] Navigate to Path
- [ ] Select FROM technique
- [ ] Select TO technique
- [ ] Click "Find Path"
- [ ] See step-by-step path between techniques

### 7. Class Prep (/prep) - Coach tier only
- [ ] If you're a coach user, see prep page
- [ ] Enter a class topic
- [ ] Click "Generate Lesson Plan"
- [ ] See generated plan

---

## Troubleshooting

### "API error" or cannot connect to backend
- [ ] Verify FastAPI backend is running on port 8000
- [ ] Check `.env.local` has correct `NEXT_PUBLIC_API_URL`
- [ ] In browser console (F12), check if API calls are going to correct URL

### Chat not working
- [ ] Check backend `/api/chat` endpoint is working
- [ ] Try with `curl` or Postman:
```bash
curl -X POST http://localhost:8000/api/chat \
  -H "Content-Type: application/json" \
  -d '{"question":"test","history":[]}'
```

### Sign in not working
- [ ] Check backend email configuration
- [ ] Verify `/api/auth/request` endpoint works
- [ ] Check backend logs for email errors
- [ ] If using demo, create `.env.local` with dummy email for testing

### Styling not applied
- [ ] Check that `frontend/css/app.css` exists
- [ ] Verify CSS is loading in browser (DevTools → Network tab)
- [ ] Check browser console for CSS import errors

### "Module not found" errors
- [ ] Run `npm install` again
- [ ] Delete `node_modules` and `.next` folders
- [ ] Run `npm install` again

---

## Development Commands

```bash
# Development server (auto-reload)
npm run dev

# Build for production
npm run build

# Start production build
npm start

# Run linter
npm run lint
```

---

## File Structure

```
.
├── app/                     # Next.js pages and layouts
│   ├── layout.tsx          # Root layout
│   ├── page.tsx            # Landing page /
│   ├── signin/page.tsx     # Sign in /signin
│   ├── c/[id]/page.tsx     # Conversation /c/{id}
│   ├── path/page.tsx       # Path Finder /path
│   ├── graph/page.tsx      # Graph /graph
│   ├── history/page.tsx    # History /history
│   ├── profile/page.tsx    # Profile /profile
│   ├── prep/page.tsx       # Class Prep /prep
│   └── ...other pages
│
├── components/              # React components
│   ├── Header.tsx
│   └── Chat.tsx
│
├── lib/                     # Utilities
│   ├── api.ts              # API client
│   └── auth.ts             # Auth helpers
│
├── public/                  # Static files
├── backend/                 # FastAPI backend (separate)
├── frontend/                # Old vanilla JS (reference only)
├── package.json            # Node dependencies
├── next.config.js          # Next.js config
├── tsconfig.json           # TypeScript config
└── .env.local              # Environment config (local)
```

---

## API Integration

All API calls go through `lib/api.ts`. Example:

```typescript
import { getConversations } from '@/lib/api'

const data = await getConversations()
console.log(data.conversations)
```

The API client automatically:
- Sets `Content-Type: application/json`
- Includes credentials (cookies for sessions)
- Handles errors
- Points to FastAPI backend

---

## Common Issues & Solutions

| Issue | Solution |
|-------|----------|
| "Cannot GET /" | Frontend not running on 3000, or build failed |
| "API error: 401" | Not authenticated, visit `/signin` first |
| "API error: 404" | Backend endpoint doesn't exist or wrong URL |
| Blank page | Check browser console (F12) for errors |
| Chat not streaming | Check backend logs, verify `/api/chat` works |
| No conversations in history | None created yet, ask a question first |

---

## Next Steps

1. **Deploy backend** to production
2. **Update `.env.local`** with production API URL
3. **Run `npm run build`** to create optimized build
4. **Deploy frontend** to Vercel, Netlify, or your hosting

For Vercel deployment:
```bash
npm i -g vercel
vercel
```

Environment variables in Vercel dashboard:
```
NEXT_PUBLIC_API_URL=https://api.yourdomain.com
```

---

## Questions?

Check the `/NEXTJS_MIGRATION.md` for architecture details or the API implementations in `lib/api.ts`.
