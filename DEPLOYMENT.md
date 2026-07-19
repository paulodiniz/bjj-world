# Deployment Guide - Railway

This guide covers deploying the Next.js frontend + FastAPI backend to Railway.

## Architecture

```
Railway Project: bjj-world
├── Service 1: Backend (FastAPI + Python)
│   └── Runs on port 8000
├── Service 2: Frontend (Next.js + Node)
│   └── Runs on port 3000
└── Service 3: Database (Neo4j - if not already deployed)
```

## Prerequisites

1. Railway account at https://railway.app
2. GitHub repository linked to Railway
3. Environment variables prepared (see below)

## Deployment Steps

### 1. Deploy Backend (FastAPI)

1. Go to https://railway.app/dashboard
2. Click "New Project" → "Deploy from GitHub"
3. Select your `bjj-world` repository
4. Railway should detect the `Dockerfile` and use it
5. Update environment variables:
   ```
   PORT=8000
   DATABASE_URL=neo4j://...
   JWT_SECRET=your-secret-key
   RESEND_API_KEY=your-resend-key
   ANTHROPIC_API_KEY=your-anthropic-key
   ```

### 2. Deploy Frontend (Next.js)

1. In the same Railway project, click "Add Service" → "GitHub Repo"
2. Select the same repo but specify the Next.js root
3. Set the build command: `npm install && npm run build`
4. Set the start command: `npm run start`
5. Set port to 3000
6. Environment variables:
   ```
   NEXT_PUBLIC_API_URL=https://your-backend-domain.railway.app
   NODE_ENV=production
   ```

### 3. Connect Services

1. In the frontend service, add environment variable:
   ```
   NEXT_PUBLIC_API_URL=${{ services.backend.RAILWAY_PUBLIC_DOMAIN }}
   ```
   (Replace "backend" with your actual backend service name)

2. Deploy both services

### 4. Database

If you don't already have Neo4j deployed:
1. In Railway, click "New" → "Database" → "Neo4j"
2. Note the connection string
3. Add `DATABASE_URL` to backend environment

## Environment Variables Needed

### Backend (.env)
```
DATABASE_URL=neo4j://username:password@host:port
JWT_SECRET=long-random-string
ANTHROPIC_API_KEY=sk-...
RESEND_API_KEY=re_...
APP_URL=https://your-domain.railway.app
```

### Frontend (.env.local)
```
NEXT_PUBLIC_API_URL=https://your-backend.railway.app
```

## Domain Setup

1. In Railway, go to your project settings
2. Add a domain (e.g., `bjj-world.railway.app`)
3. Update frontend `NEXT_PUBLIC_API_URL` if using custom domain

## Custom Domain

To use a custom domain (e.g., `bjj-world.com`):

1. In Railway, click your service → Settings → Domains
2. Click "Add Domain" → enter your domain
3. Update DNS records with the values Railway provides
4. Update `NEXT_PUBLIC_API_URL` in frontend environment

## Monitoring

1. Go to Railway Dashboard
2. Click on each service to see logs
3. Monitor CPU, memory, and network usage
4. Set up alerts if needed

## Troubleshooting

### Frontend can't reach backend
- Check `NEXT_PUBLIC_API_URL` is correct
- Verify backend service is running
- Check CORS settings in FastAPI backend

### Database connection fails
- Verify `DATABASE_URL` format
- Check network access (Railway should allow it by default)
- Ensure database is deployed and running

### Build failures
- Check logs in Railway dashboard
- Verify Node/Python versions
- Check for missing environment variables

## Cost Considerations

Railway pricing:
- **Included**: $5/month free tier (can fit small project)
- **Overages**: $0.50/vCPU-hour, $0.10/GB-hour
- **Estimate for this project**: ~$20-50/month depending on traffic

## Next.js-Specific Configuration

The Next.js app uses:
- SSR (Server-Side Rendering) for all pages
- API calls to FastAPI backend
- No static site generation (all pages render on demand)

For Railway:
- Auto-scaling is enabled by default
- Next.js will auto-detect and optimize builds
- Ensure `npm run build` works locally first

## Testing Deployment

Before final deployment:

1. Test locally:
   ```bash
   npm run build
   npm run start
   ```

2. Verify all features:
   - Landing page loads
   - Can ask questions (uses backend API)
   - Sign in works
   - All navigation links work

3. Check environment variables are set correctly

## Rollback

If something goes wrong:
1. Railway saves deployment history
2. Go to Deployments tab in Railway
3. Click "Redeploy" on a previous version
4. Takes ~2-3 minutes to rollback

## Further Reading

- Railway Docs: https://docs.railway.app
- Next.js Deployment: https://nextjs.org/docs/deployment
- FastAPI Deployment: https://fastapi.tiangolo.com/deployment/

## Questions?

Check Railway support docs or the project's GitHub for more info.
