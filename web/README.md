# Yüksel Hoca Tahlil Sonuçları

A modern blood test results dashboard that reads data from Google Sheets and provides interactive visualization with synchronized charts.

## Features

- 🔐 **Simple Login**: Hardcoded authentication (admin/tahlil2025)
- 📊 **Interactive Dashboard**: Click metric boxes to add charts
- 📈 **Synchronized Charts**: Hover over any chart to see tooltips across all charts
- 🎯 **Date Filtering**: View last 15/30/90 days or all data
- 📱 **Responsive Design**: Works on mobile, tablet, and desktop
- 🌙 **Dark/Light Mode**: Automatic theme switching
- 🔄 **Drag & Drop**: Reorder charts by dragging chips
- 📊 **Value Modes**: Switch between latest values and averages
- 🎨 **Visual Indicators**: Green for normal values, red for out-of-range

## Tech Stack

- **Frontend**: Next.js 15, React, TypeScript
- **Styling**: Tailwind CSS, shadcn/ui
- **Charts**: Recharts
- **Drag & Drop**: @dnd-kit
- **Data Source**: Google Sheets API

## Setup

### 1. Environment Variables

Create `.env.local` in the `web` directory:

```bash
# Google Sheets configuration
GOOGLE_SHEETS_SPREADSHEET_ID=your_spreadsheet_id_here
GOOGLE_SERVICE_ACCOUNT_EMAIL=your_service_account@project.iam.gserviceaccount.com
GOOGLE_SERVICE_ACCOUNT_KEY="-----BEGIN PRIVATE KEY-----\nYOUR_PRIVATE_KEY_HERE\n-----END PRIVATE KEY-----\n"
```

### 2. Google Sheets Setup

Your Google Sheet should have two tabs:

**"Looker" tab:**
- Column A: Date (format: MM/DD/YYYY or YYYY-MM-DD)
- Columns B+: Metric values (e.g., Hemoglobin, Trombosit, etc.)

**"Reference Values" tab:**
- Column A: Metric name
- Column B: Unit
- Column C: Low reference value (ref_min)
- Column D: High reference value (ref_max)

### 3. Google Cloud Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing
3. Enable Google Sheets API
4. Create a Service Account:
   - Go to IAM & Admin > Service Accounts
   - Create Service Account
   - Download JSON key file
   - Extract email and private key for env vars
5. Share your Google Sheet with the service account email

### 4. Installation

```bash
cd web
npm install
npm run dev
```

Visit `http://localhost:3000`

## Deployment Options

### Option 1: Vercel (Recommended)

1. Push code to GitHub
2. Connect Vercel to your repository
3. Add environment variables in Vercel dashboard
4. Deploy automatically

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel
```

### Option 2: Netlify

1. Build the project: `npm run build`
2. Deploy `out` folder to Netlify
3. Add environment variables in Netlify dashboard

### Option 3: Railway

1. Connect GitHub repository
2. Add environment variables
3. Deploy automatically

### Option 4: Self-hosted (VPS)

1. Build: `npm run build`
2. Start: `npm start`
3. Use PM2 for process management:
   ```bash
   npm install -g pm2
   pm2 start npm --name "tahlil-dashboard" -- start
   ```

## Environment Variables Reference

| Variable | Description | Example |
|----------|-------------|---------|
| `GOOGLE_SHEETS_SPREADSHEET_ID` | Your Google Sheet ID | `1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms` |
| `GOOGLE_SERVICE_ACCOUNT_EMAIL` | Service account email | `tahlil@project.iam.gserviceaccount.com` |
| `GOOGLE_SERVICE_ACCOUNT_KEY` | Private key (with \n) | `-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n` |

## Login Credentials

- **Username**: `admin`
- **Password**: `tahlil2025`

## Development

```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Build for production
npm run build

# Start production server
npm start

# Lint code
npm run lint
```

## Project Structure

```
web/
├── src/
│   ├── app/
│   │   ├── api/data/route.ts    # Google Sheets API endpoint
│   │   ├── layout.tsx           # Root layout with theme provider
│   │   └── page.tsx             # Main dashboard page
│   ├── components/
│   │   ├── ui/                  # shadcn/ui components
│   │   ├── login-gate.tsx       # Login component
│   │   ├── metric-chart.tsx     # Chart component
│   │   └── metric-chip.tsx      # Draggable chip component
│   └── lib/
│       ├── sheets.ts            # Google Sheets client
│       ├── date.ts              # Date utilities
│       └── utils.ts             # General utilities
├── .env.local                   # Environment variables
└── README.md
```

## Troubleshooting

### Common Issues

1. **"No data" showing**: Check Google Sheets API credentials and sheet sharing
2. **Date filtering not working**: Ensure dates are in MM/DD/YYYY or YYYY-MM-DD format
3. **Charts not syncing**: Check that all charts have the same `syncId`
4. **Build errors**: Ensure all environment variables are set

### Debug Mode

Add `?debug=true` to URL to see console logs for debugging.

## License

Private project for Yüksel Hoca medical practice.