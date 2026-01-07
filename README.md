# Blood Test Analysis System

A complete blood test analysis system consisting of a Python backend for PDF processing and a modern web dashboard for data visualization.

## 🏗️ System Overview

This project provides a complete solution for processing blood test PDFs and visualizing the results:

1. **Python Backend** (`src/`): Monitors Google Drive for new PDFs, extracts blood test values using AI, and updates Google Sheets
2. **Web Dashboard** (`web/`): Interactive dashboard for viewing and analyzing blood test results with charts and trends

## 🐍 Python Backend Features

- 📁 **Google Drive Monitoring**: Automatically detects new PDF files
- 🤖 **AI-Powered Extraction**: Uses OpenAI API to extract blood test values from PDFs
- 📊 **Google Sheets Integration**: Updates spreadsheet with extracted data
- 🔄 **Automated Processing**: Continuous monitoring and processing pipeline

## 🌐 Web Dashboard Features

- 🔐 **Secure Authentication**: Environment-based login system
- 📊 **Interactive Dashboard**: Click metric boxes to add charts
- 📈 **Synchronized Charts**: Hover over any chart to see tooltips across all charts
- 🎯 **Date Filtering**: View last 15/30/90 days or all data
- 📱 **Responsive Design**: Works on mobile, tablet, and desktop
- 🌙 **Dark/Light Mode**: Automatic theme switching
- 🔄 **Drag & Drop**: Reorder charts by dragging chips
- 📊 **Value Modes**: Switch between latest values and averages
- 🎨 **Visual Indicators**: Green for normal values, red for out-of-range

## 📋 Requirements

### System Requirements

- **Python 3.8+** (for backend)
- **Node.js 18+** (for frontend)
- **npm or yarn** (package manager)
- **Google Cloud Console account** (for API credentials)
- **OpenAI API account** (for AI extraction)

### Python Backend Dependencies (53 packages)

- **Google API packages**: Drive, Sheets, Authentication
- **PDF processing**: PyMuPDF, pdfminer, pdfplumber, PyPDF2, pypdfium2
- **AI/ML**: OpenAI API, Pandas, NumPy
- **Image processing**: Pillow
- **HTTP/Networking**: requests, httpx, urllib3
- **Security**: cryptography, oauthlib, rsa

### Web Frontend Dependencies (25+ packages)

- **Core Framework**: Next.js 15.5.3, React 19.1.0, TypeScript 5
- **Styling**: Tailwind CSS 4, Radix UI components
- **Charts**: Recharts 3.2.1
- **Interactions**: @dnd-kit (drag & drop)
- **Testing**: Jest, React Testing Library
- **Google APIs**: googleapis 160.0.0

### Installation Commands

```bash
# Python Backend
pip install -r requirements.txt

# Web Frontend
cd web
npm install

# Run Tests
npm test
```

### Environment Variables Required

**Python Backend** (`src/config.py`):

- `OPENAI_API_KEY`: OpenAI API key for AI extraction
- `GOOGLE_CREDENTIALS_FILE`: Path to Google credentials JSON
- `DRIVE_FOLDER_ID`: Google Drive folder to monitor
- `SHEET_ID`: Google Sheets document ID

**Web Frontend** (`.env.local`):

- `GOOGLE_SHEETS_SPREADSHEET_ID`: Google Sheet ID
- `GOOGLE_SERVICE_ACCOUNT_EMAIL`: Service account email
- `GOOGLE_SERVICE_ACCOUNT_KEY`: Service account private key
- `NEXT_PUBLIC_LOGIN_USERNAME`: Dashboard username
- `NEXT_PUBLIC_LOGIN_PASSWORD`: Dashboard password

## 🚀 Quick Start

### 1. Python Backend Setup

```bash
# Install Python dependencies
pip install -r requirements.txt

# Configure credentials in src/config.py
# - Google Drive API credentials
# - Google Sheets API credentials
# - OpenAI API key
```

### 2. Web Dashboard Setup

```bash
cd web

# Install dependencies
npm install

# Create environment file
cp .env.example .env.local

# Edit .env.local with your credentials
# - Google Sheets ID
# - Service Account credentials
# - Login credentials
```

### 3. Run Tests

```bash
# Python backend tests
source .venv/bin/activate    # if using venv
pytest tests/ -v             # run all Python tests

# Web frontend tests
cd web
npm test                     # run all Jest tests
npm run test:watch           # watch mode for development
npm run test:coverage        # run with coverage report
```

**Python Tests** (`tests/`):

- `test_supabase_client.py` - Tests for Supabase client wrapper
- `test_migration.py` - Tests for data structures and migration verification

**Web Tests** (`web/src/`):

- `app/api/metrics/route.test.ts` - API endpoint tests
- `__tests__/basic.test.ts` - Basic functionality tests
- `__tests__/lib/date.test.ts` - Date utility tests
- `__tests__/integration/` - Integration tests

### 4. Supabase Setup

1. Go to [Supabase Dashboard](https://supabase.com/dashboard)
2. Create a new project (or use existing)
3. Go to **Project Settings → API** to get your credentials:
   - **Project URL** → `SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_URL`
   - **anon/public key** → `SUPABASE_PUBLISHABLE_KEY` / `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - **service_role key** → `SUPABASE_SECRET_KEY`
4. Add these to your `.env` file (copy from `.env.example`)
5. For database migrations, install Supabase CLI:

   ```bash
   # macOS
   brew install supabase/tap/supabase

   # Link to your project
   supabase link --project-ref your-project-id
   ```

### 4b. Supabase Authentication with Google OAuth

To enable Google OAuth for user authentication:

#### Step 1: Create Google OAuth Credentials

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Select your project (or create a new one)
3. Navigate to **APIs & Services → Credentials**
4. Click **Create Credentials → OAuth client ID**
5. Select **Web application**
6. Add the following authorized redirect URIs:
   - `https://your-project-ref.supabase.co/auth/v1/callback` (replace `your-project-ref` with your Supabase project reference)
   - `http://localhost:3000/auth/callback` (for local development)
7. Click **Create** and note your **Client ID** and **Client Secret**

#### Step 2: Configure Google OAuth in Supabase

1. Go to your [Supabase Dashboard](https://supabase.com/dashboard)
2. Select your project
3. Navigate to **Authentication → Providers**
4. Find **Google** in the list and click to expand
5. Toggle **Enable Sign in with Google**
6. Enter your **Client ID** and **Client Secret** from Step 1
7. Click **Save**

#### Step 3: Configure Site URL (Important for Production)

1. In Supabase Dashboard, go to **Authentication → URL Configuration**
2. Set **Site URL** to your production domain (e.g., `https://your-app.vercel.app`)
3. Add any additional redirect URLs under **Redirect URLs**:
   - `http://localhost:3000/**` (for local development)
   - `https://your-app.vercel.app/**` (for production)

#### Verification

After completing these steps:

- The login page will show "Sign in with Google" button
- Users can authenticate using their Google accounts
- Sessions are managed automatically by Supabase

### 5. Google Cloud Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing
3. Enable Google Drive API and Google Sheets API
4. Create a Service Account:
   - Go to IAM & Admin > Service Accounts
   - Create Service Account
   - Download JSON key file
   - Extract email and private key for env vars
5. Share your Google Sheet with the service account email

### 6. Google Sheets Structure

Your Google Sheet should have two tabs:

**"Looker" tab:**

- Column A: Date (format: MM/DD/YYYY or YYYY-MM-DD)
- Columns B+: Metric values (e.g., Hemoglobin, Trombosit, etc.)

**"Reference Values" tab:**

- Column A: Metric name
- Column B: Unit
- Column C: Low reference value (ref_min)
- Column D: High reference value (ref_max)

## 📁 Project Structure

```
padre-values/
├── src/                          # Python backend
│   ├── drive_monitor.py          # Google Drive monitoring
│   ├── pdf_reader.py             # PDF reading and AI extraction
│   ├── sheets_updater.py         # Google Sheets integration
│   ├── supabase_client.py        # Supabase client wrapper
│   ├── supabase_config.py        # Supabase configuration
│   ├── supabase_updater.py       # Supabase data operations
│   ├── config.py                 # Configuration and credentials
│   └── openai_utils.py           # OpenAI API utilities
├── tests/                        # Python tests
│   ├── test_supabase_client.py   # Supabase client tests
│   └── test_migration.py         # Migration verification tests
├── supabase/                     # Supabase database
│   ├── migrations/               # SQL migration files
│   └── schema.md                 # Schema documentation
├── scripts/                      # Utility scripts
│   └── migrate_sheets_to_supabase.py  # Data migration script
├── web/                          # Next.js web dashboard
│   ├── src/
│   │   ├── app/
│   │   │   ├── api/data/route.ts # Google Sheets API endpoint
│   │   │   ├── layout.tsx        # Root layout with theme provider
│   │   │   └── page.tsx          # Main dashboard page
│   │   ├── components/
│   │   │   ├── ui/               # shadcn/ui components
│   │   │   ├── login-gate.tsx    # Login component
│   │   │   ├── metric-chart.tsx  # Chart component
│   │   │   └── metric-chip.tsx   # Draggable chip component
│   │   ├── lib/
│   │   │   ├── sheets.ts         # Google Sheets client
│   │   │   ├── date.ts           # Date utilities
│   │   │   └── utils.ts          # General utilities
│   │   └── __tests__/            # Test files
│   │       ├── basic.test.ts     # Basic functionality tests
│   │       ├── lib/date.test.ts  # Date utility tests
│   │       └── integration/      # Integration tests
│   ├── .env.example              # Environment variables template
│   ├── package.json              # Node.js dependencies
│   └── jest.config.js            # Jest test configuration
├── downloads/                    # Processed PDF files
├── requirements.txt              # Python dependencies (53 packages)
├── requirements-complete.txt     # Complete requirements reference
├── REQUIREMENTS.md               # Detailed requirements documentation
└── README.md                     # This file
```

## 🔧 Usage

### Running the Python Backend

```bash
# Start monitoring Google Drive
python main.py
```

### Running the Web Dashboard

```bash
cd web
npm run dev
```

Visit `http://localhost:3000`

## 🌐 Deployment

### Web Dashboard Deployment (Vercel)

```bash
cd web

# Install Vercel CLI
npm i -g vercel

# Deploy
vercel

# Add environment variables in Vercel dashboard
# - GOOGLE_SHEETS_SPREADSHEET_ID
# - GOOGLE_SERVICE_ACCOUNT_EMAIL
# - GOOGLE_SERVICE_ACCOUNT_KEY
# - NEXT_PUBLIC_LOGIN_USERNAME
# - NEXT_PUBLIC_LOGIN_PASSWORD
```

### Python Backend Deployment

The Python backend can be deployed on:

- **VPS/Server**: Run as a service with systemd
- **Cloud Functions**: Google Cloud Functions or AWS Lambda
- **Docker**: Containerized deployment
- **Cron Job**: Scheduled execution

## 🔐 Security

- ✅ **No secrets in code**: All sensitive data uses environment variables
- ✅ **Private repository**: Blood test data is protected
- ✅ **Secure authentication**: Login credentials are environment variables
- ✅ **Google Sheets credentials**: Stored securely in deployment platform

## 📊 Environment Variables

### Python Backend (`.env` or `src/config.py`)

- `SUPABASE_URL`: Supabase project URL
- `SUPABASE_PUBLISHABLE_KEY`: Supabase anon/public key
- `SUPABASE_SECRET_KEY`: Supabase service_role key (for server-side only)
- `OPENAI_API_KEY`: OpenAI API key for AI extraction
- `GOOGLE_CREDENTIALS_FILE`: Path to Google credentials JSON
- `DRIVE_FOLDER_ID`: Google Drive folder to monitor
- `SHEET_ID`: Google Sheets document ID

### Web Dashboard (`.env.local`)

- `GOOGLE_SHEETS_SPREADSHEET_ID`: Google Sheet ID
- `GOOGLE_SERVICE_ACCOUNT_EMAIL`: Service account email
- `GOOGLE_SERVICE_ACCOUNT_KEY`: Service account private key
- `NEXT_PUBLIC_LOGIN_USERNAME`: Dashboard username
- `NEXT_PUBLIC_LOGIN_PASSWORD`: Dashboard password

## 🛠️ Development

### Python Backend

```bash
# Install dependencies
pip install -r requirements.txt

# Run with debug
python -m src.drive_monitor
```

### Web Dashboard

```bash
cd web

# Install dependencies
npm install

# Run development server
npm run dev

# Build for production
npm run build

# Lint code
npm run lint
```

## 🐛 Troubleshooting

### Common Issues

1. **"No data" showing**: Check Google Sheets API credentials and sheet sharing
2. **Date filtering not working**: Ensure dates are in MM/DD/YYYY or YYYY-MM-DD format
3. **Charts not syncing**: Check that all charts have the same `syncId`
4. **Build errors**: Ensure all environment variables are set
5. **PDF processing fails**: Check OpenAI API key and PDF format

### Debug Mode

Add `?debug=true` to URL to see console logs for debugging.

## 📝 License

Private medical practice project.
