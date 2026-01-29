# ViziAI - Project Roadmap

> AI-powered blood test visualization. Understand your health data in seconds.

**Target users:** Turkish individuals who want to track and visualize their blood test results over time.

**Personal goal:** Track my own health metrics (cholesterol, etc.) across tests from Spain and Turkey.

---

## Phase 0: Repository & Setup

### 0.1 Rename Repository

- [x] Rename GitHub repo from `padre-values` to `viziai`
- [ ] Rename local folder from `padre-values` to `viziai` (user action required)
- [x] Update all references (CLAUDE.md, README, package.json, etc.)
- [ ] Update Vercel project settings if needed

---

## Phase 1: Brand Guidelines & Design System

> **Skills:** `/frontend-design`, `/react-best-practices`

### 1.1 Brand Identity

- [ ] Define brand values and personality
- [ ] Create `product/brand-guidelines/BRAND.md`

### 1.2 Color Palette

- [ ] Primary color (health-focused, trustworthy)
- [ ] Secondary color
- [ ] Status colors:
  - Normal/healthy values
  - Warning (approaching limits)
  - Critical (out of range) - currently red, needs accessible branded version
- [ ] Chart colors (5-6 distinct colors for multi-metric charts)
- [ ] Light mode palette
- [ ] Dark mode palette (user requested)
- [ ] WCAG accessibility verification (AA minimum, AAA preferred)

### 1.3 Typography

- [ ] Primary font: Inter (Turkish language support, excellent for data)
- [ ] Define type scale (headings, body, data/numbers)
- [ ] Tabular numbers for metric values

### 1.4 Logo & Visual Identity

> **Skill:** `/image-generator`

- [ ] Logo concept: Modern take on Rod of Asclepius (medical symbol with snake)
  - Inspiration: Turkish Ministry of Health logo
  - Style: Modern, possibly cyberpunk/tech aesthetic
  - Must work at small sizes (favicon)
- [ ] Create logo variants:
  - Icon only (for favicon, app icon)
  - Full logo (icon + wordmark)
  - Light/dark versions
- [ ] Generate favicon (multiple sizes)
- [ ] Social media preview image (og:image)

### 1.5 Component Design Tokens

- [ ] Border radius
- [ ] Shadows
- [ ] Spacing scale
- [ ] Animation/transition timing

---

## Phase 2: UI Redesign

> **Skills:** `/frontend-design`, `/react-best-practices`

### 2.1 Design Principles

- Simple, non-disturbing UX flow
- Health-focused: calming, trustworthy
- Data-dense but not overwhelming
- Maximum accessibility scores
- Dark mode support

### 2.2 Core Components

- [ ] Metric cards (name, value, unit, reference range indicator)
- [ ] Line charts (time series for each metric)
- [ ] Status indicators (in-range, out-of-range)
- [ ] Navigation
- [ ] Buttons, inputs, forms
- [ ] Loading states
- [ ] Error states

### 2.3 Accessibility Audit

- [ ] Color contrast verification
- [ ] Screen reader support
- [ ] Keyboard navigation
- [ ] Focus indicators
- [ ] ARIA labels

---

## Phase 3: Multi-Profile System

> Netflix-style profile selector

### 3.1 Profile Data Model

- [ ] Profile entity (id, name, display_name, avatar, owner_email)
- [ ] Profile ↔ User relationship (one user can access multiple profiles)
- [ ] Profile ↔ Reports relationship

### 3.2 Profile Selector UI

- [ ] Netflix-style profile grid on login
- [ ] Profile avatars/icons
- [ ] "Add Profile" option
- [ ] Profile management (edit, delete)

### 3.3 Login Flow Logic

```
User logs in with Google
  ├─ Has 1 profile → Go directly to dashboard
  └─ Has multiple profiles → Show profile selector
       └─ Select profile → Go to dashboard
```

### 3.4 Profile Creation

- [ ] Create profile form (name, avatar selection)
- [ ] Associate with logged-in user
- [ ] Profile permissions (owner vs viewer)

---

## Phase 4: PDF Upload & AI Extraction

> Replace Python/Google Drive approach with in-app upload

### 4.1 Upload Flow

```
Dashboard → "Upload Report" button
  └─ Upload modal:
      ├─ Drag & drop zone
      └─ "Select file" button
          └─ File selected
              └─ Check hash against DB
                  ├─ Hash exists → "This report was already processed on [date]"
                  └─ Hash new → Process with AI
```

### 4.2 AI Extraction

- [ ] Send PDF to OpenAI API (GPT-4 Vision or text extraction)
- [ ] Extract:
  - Report date
  - Lab/clinic name (if available)
  - All metric names, values, units, reference ranges
- [ ] Handle Turkish lab report formats
- [ ] Handle Spanish lab report formats

### 4.3 Review & Confirm UI

- [ ] Show extracted results in editable form
- [ ] Display: "AI-generated results. Please verify before saving."
- [ ] Allow user to:
  - Edit metric names (fix typos, standardize)
  - Edit values (fix OCR errors)
  - Add missing metrics
  - Remove incorrect entries
  - Change report date
- [ ] "Save" button → Store to database
- [ ] "Cancel" button → Discard

### 4.4 Duplicate Detection

- [ ] Calculate file hash (SHA-256) on upload
- [ ] Check hash against `processed_files` table
- [ ] If duplicate: Show message with link to existing report
- [ ] Store hash after successful processing

### 4.5 Error Handling

- [ ] Unsupported file format
- [ ] AI extraction failed
- [ ] Partial extraction (some fields missing)
- [ ] Network errors

---

## Phase 5: Public Signup & Onboarding

> Open the app to new users

### 5.1 Landing Page

- [ ] Hero section explaining the product
- [ ] Features overview
- [ ] "Get Started" CTA → Signup

### 5.2 Signup Flow

```
Landing page → "Get Started"
  └─ Google OAuth
      └─ New user?
          ├─ Yes → Create account → Create first profile → Dashboard
          └─ No → Login flow (Phase 3)
```

### 5.3 Onboarding

- [ ] Welcome screen
- [ ] Create first profile (name it, e.g., "My Health")
- [ ] Quick tutorial: "Upload your first report"
- [ ] Sample data option? (see what the app looks like)

### 5.4 Access Control

- [ ] Email allowlist (current: family only)
- [ ] Public signup toggle (for future)
- [ ] Rate limiting for AI extraction (cost control)

---

## Technical Debt & Cleanup

### Codebase

- [ ] Remove unused Supabase Python code (or migrate to Neon)
- [ ] Clean up old migration files
- [ ] Update README with new architecture

### Infrastructure

- [ ] Monitor Neon usage
- [ ] Set up error tracking (Sentry?)
- [ ] Analytics (privacy-respecting)

---

## Priority Order

1. **Phase 1.1-1.3**: Brand guidelines (colors, typography) - Foundation for everything
2. **Phase 1.4**: Logo & favicon - Visual identity
3. **Phase 2**: UI redesign with new brand - Apply guidelines
4. **Phase 3**: Multi-profile system - Enable personal use
5. **Phase 4**: PDF upload flow - Core feature improvement
6. **Phase 5**: Public signup - Growth (future)

---

## Notes

- This is a personal/family project first, potential product second
- Turkish language support is essential (lab reports, UI)
- Health data = sensitive → prioritize security & privacy
- Keep it simple: one user, multiple profiles, each profile has reports with metrics
