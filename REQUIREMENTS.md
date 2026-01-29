# Project Requirements

This document lists all dependencies for the complete blood test analysis system, including both the Python backend and Next.js web frontend.

## Python Backend Requirements

The Python backend handles PDF processing, AI extraction, and Google Sheets integration.

### Installation

```bash
cd /Users/onurovali/Documents/code/viziai
pip install -r requirements.txt
```

### Dependencies

See `requirements.txt` for the complete list of Python packages.

## Web Frontend Requirements

The Next.js web application provides the dashboard interface for viewing blood test results.

### Installation

```bash
cd /Users/onurovali/Documents/code/viziai/web
npm install
```

### Dependencies

#### Production Dependencies

- **Next.js 15.5.3** - React framework
- **React 19.1.0** - UI library
- **TypeScript 5** - Type safety
- **Tailwind CSS 4** - Styling framework
- **Recharts 3.2.1** - Chart library
- **Radix UI** - Accessible UI components
- **@dnd-kit** - Drag and drop functionality
- **Lucide React** - Icons
- **Google APIs 160.0.0** - Google Sheets integration

#### Development Dependencies

- **Jest 30.1.3** - Testing framework
- **React Testing Library** - Component testing
- **ESLint** - Code linting
- **TypeScript types** - Type definitions

## Environment Variables

### Python Backend (.env or config.py)

```
OPENAI_API_KEY=your_openai_key
GOOGLE_CREDENTIALS_FILE=path_to_credentials.json
DRIVE_FOLDER_ID=your_drive_folder_id
SHEET_ID=your_google_sheet_id
```

### Web Frontend (.env.local)

```
GOOGLE_SHEETS_SPREADSHEET_ID=your_sheet_id
GOOGLE_SERVICE_ACCOUNT_EMAIL=your_service_account_email
GOOGLE_SERVICE_ACCOUNT_KEY=your_private_key
NEXT_PUBLIC_LOGIN_USERNAME=your_username
NEXT_PUBLIC_LOGIN_PASSWORD=your_password
```

## Quick Start

### 1. Python Backend

```bash
# Install Python dependencies
pip install -r requirements.txt

# Run the main script
python main.py
```

### 2. Web Frontend

```bash
# Install Node.js dependencies
cd web
npm install

# Start development server
npm run dev

# Run tests
npm test

# Build for production
npm run build
```

## System Requirements

- **Python 3.8+**
- **Node.js 18+**
- **npm or yarn**
- **Google Cloud Console account** (for API credentials)
- **OpenAI API account** (for AI extraction)

## Deployment

- **Python Backend**: Can be deployed to any Python hosting service
- **Web Frontend**: Deployed to Vercel (recommended) or any Node.js hosting service
