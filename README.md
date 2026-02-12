# ViziAI - Blood Test Analysis & Visualization

AI-powered blood test PDF analyzer with visual health insights. Upload lab reports, extract values with AI, and track health trends over time.

**Live:** [vizi-ai.onurovali.me](https://vizi-ai.onurovali.me)

## Features

- **PDF Upload & AI Extraction**: Upload blood test PDFs, AI extracts all metric values automatically
- **Smart Review**: Review and edit extracted values before saving
- **Interactive Charts**: Visualize trends with synchronized, interactive line charts
- **Reference Ranges**: See normal ranges highlighted on charts
- **Multi-Profile Support**: Track multiple family members' health data
- **File Management**: View uploaded files, edit metric values anytime
- **Dark/Light Mode**: Automatic theme switching
- **Turkish Localization**: Full Turkish language support with Turkey timezone

## Tech Stack

- **Frontend**: Next.js 15 (App Router), React, TypeScript, Tailwind CSS
- **UI Components**: shadcn/ui, Radix UI
- **Charts**: Recharts
- **Database**: Neon Postgres (serverless)
- **Auth**: NextAuth.js with Google OAuth
- **Storage**: Vercel Blob (PDF files)
- **AI**: OpenAI GPT-4 for PDF text extraction
- **Async Processing**: Upstash QStash
- **Error Tracking**: Sentry (free tier)
- **Deployment**: Vercel

## Architecture

```
User uploads PDF
       ↓
Vercel Blob Storage (temporary)
       ↓
QStash triggers async extraction
       ↓
OpenAI extracts metrics from PDF
       ↓
User reviews & confirms
       ↓
Neon Postgres (permanent storage)
       ↓
PDF deleted from Blob
```

## Local Development

```bash
cd web
npm install
npm run dev
```

### Environment Variables

Create `.env.local` with:

```env
# Database
NEON_DATABASE_URL=postgres://...

# Auth
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=your-secret
GOOGLE_CLIENT_ID=your-client-id
GOOGLE_CLIENT_SECRET=your-client-secret

# AI & Storage
OPENAI_API_KEY=your-openai-key
BLOB_READ_WRITE_TOKEN=your-vercel-blob-token

# Async Processing
QSTASH_TOKEN=your-qstash-token
QSTASH_CURRENT_SIGNING_KEY=your-signing-key
QSTASH_NEXT_SIGNING_KEY=your-next-signing-key

# Error Tracking
NEXT_PUBLIC_SENTRY_DSN=your-sentry-dsn
```

## Database Schema

- **profiles**: Family member profiles
- **reports**: Blood test reports with sample dates
- **metrics**: Individual test values (Hemoglobin, etc.)
- **metric_preferences**: Display order and favorites per profile
- **processed_files**: Upload tracking (prevents duplicates)
- **pending_uploads**: In-progress upload state
- **metric_aliases**: Global alias map for metric name normalization

## Key Pages

| Route                  | Description                                 |
| ---------------------- | ------------------------------------------- |
| `/dashboard`           | Main dashboard with metric cards and charts |
| `/upload`              | PDF upload with AI extraction and review    |
| `/settings`            | File management - view all uploads          |
| `/settings/files/[id]` | File detail - view and edit metrics         |

## Features in Detail

### Upload Flow

1. Select profile, drag & drop PDF
2. AI extracts metrics asynchronously (up to 5 min)
3. Review extracted values, edit if needed
4. Confirm to save - PDF is deleted after confirmation

### Dashboard

- Click metric cards to add charts
- Hover syncs tooltips across all charts
- Filter by date range (15/30/90 days or all)
- Green = normal range, red = out of range

### File Management

- View all uploaded files with dates
- Sort by test date or upload date
- Click to view all metrics from a file
- Edit metric values inline

## Deployment

Deployed on Vercel with automatic deployments from `main` branch.

```bash
vercel
```

## License

Private project for personal health tracking.
