# Task: Brand Guidelines & Design System

**Status:** Done
**Completed:** 2026-01

---

## What was done

### Brand Identity

- [x] Brand values and personality defined
- [x] `product/brand-guidelines/BRAND.md` created

### Color Palette

- [x] Primary: Teal (#0D9488 light / #2DD4BF dark)
- [x] Secondary: Coral (#F97066 light / #FDA4AF dark)
- [x] Status colors: Green (normal), Amber (warning), Terracotta (critical)
- [x] Chart colors (5 variants) for data visualization
- [x] Light mode palette
- [x] Dark mode palette with system preference detection

### Typography

- [x] Inter font configured with Turkish language support (latin-ext subset)
- [x] Type scale in use (text-xs through text-2xl)
- [x] Tabular numbers for metric values

### Component Design Tokens

- [x] Border radius (`--radius: 0.625rem`)
- [x] Shadows (xs, sm, lg)
- [x] Spacing scale (consistent gap/padding conventions)
- [x] Animation/transition timing (200ms transitions, spin, bounce)

### Implementation

- CSS variables in `web/src/app/globals.css` using OKLCH color space
- Tailwind CSS v4 with PostCSS plugin
- `next-themes` for dark/light mode switching
- All tokens exposed as `--color-*` variables
