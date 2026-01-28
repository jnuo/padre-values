# ViziAI

AI-powered blood test PDF analyzer with visual health insights. Built for tracking dad's blood test trends.

## On Session Start

1. Use `/notion` skill to check tasks with topic `viziai`
2. Show pending tasks and ask: "Work on these or something else?"

## Tech Stack

- Python backend
- OpenAI for PDF extraction
- Supabase (DB) — needs replacement, pauses after 7 days inactivity
- Web dashboard (Next.js)

## Key Files

- Backend: `api/`
- Frontend: `web/`
- PDF processing: `scripts/`

## Notes

- Low-activity personal project — needs DB that won't pause
- Data is dad's blood test results
