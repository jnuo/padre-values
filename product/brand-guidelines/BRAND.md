# ViziAI - Brand Guidelines

> Work in progress. This document will define the visual identity for ViziAI.

## Product Name

**ViziAI**

From "visualization" + "AI". Clear meaning: AI-powered health data visualization.

**Turkish tagline**: "Tahlil Sonuçlarını Görselleştir" (Visualize Your Test Results)

**English tagline**: "Visualize Your Test Results"

---

## Brand Values

- **Trustworthy**: Health data is personal and sensitive
- **Clear**: Complex medical data made simple
- **Accessible**: For everyone, regardless of medical knowledge
- **Calm**: Not alarming, even when showing out-of-range values

---

## Logo

> TODO: Create logo using `/image-generator` skill

**Concept**: Modern interpretation of the Rod of Asclepius (single snake around staff - the medical symbol)

- Inspiration: Turkish Ministry of Health logo
- Style: Modern, clean, possibly with tech/data visualization elements
- Must work at: favicon (16x16), app icon (192x192), full size

**Files** (to be created):

- `logos/viziai-icon.png` - Icon only
- `logos/viziai-logo.png` - Icon + wordmark
- `logos/viziai-logo-dark.png` - For dark backgrounds
- `logos/favicon.ico` - Multi-size favicon

---

## Colors

### Design Considerations

- Health app = trustworthy, calming (teal primary, coral accent)
- Status indicators are clear but not alarming
- Dark mode support with adjusted colors for readability
- Charts use brand palette for consistency
- All colors pass WCAG AA contrast requirements

### Brand Palette

| Role              | Light Mode | Dark Mode | CSS Variable        | Notes                     |
| ----------------- | ---------- | --------- | ------------------- | ------------------------- |
| Primary (Teal)    | `#0D9488`  | `#2DD4BF` | `--brand-primary`   | Main brand color, CTAs    |
| Secondary (Coral) | `#F97066`  | `#FDA4AF` | `--brand-secondary` | Accent, highlights        |
| Status Normal     | `#22C55E`  | `#4ADE80` | `--status-normal`   | Values in healthy range   |
| Status Warning    | `#F59E0B`  | `#FBBF24` | `--status-warning`  | Values approaching limits |
| Status Critical   | `#DC6843`  | `#F87171` | `--status-critical` | Values out of range       |
| Background        | `#FBFBFB`  | `#1A1A1F` | `--background`      | Page background           |
| Foreground        | `#1A1A1A`  | `#F2F2F2` | `--foreground`      | Text color                |

### Usage Guidelines

**Primary (Teal):**

- Navigation elements
- Primary buttons and CTAs
- Links and interactive elements
- Chart primary line color

**Secondary (Coral):**

- Accent highlights
- Secondary buttons
- Chart secondary line color
- Wordmark "AI" portion

**Status Colors:**

- Normal (Green): In-range health metrics, success states
- Warning (Amber): Approaching threshold values, caution states
- Critical (Terracotta): Out-of-range values, error states

**Important:** Status colors should be used sparingly and meaningfully. The "critical" color is terracotta/warm red rather than bright red to avoid causing alarm.

---

## Typography

**Primary font**: Inter

| Property | Value                                                   |
| -------- | ------------------------------------------------------- |
| Family   | Inter                                                   |
| Source   | Google Fonts                                            |
| Weights  | 400 (regular), 500 (medium), 600 (semibold), 700 (bold) |
| Features | Tabular numbers for data alignment                      |

**Why Inter**:

- Excellent readability for data-heavy dashboards
- Clear number differentiation (critical for health metrics)
- **Full Turkish language support** (ı, İ, ş, Ş, ğ, Ğ, ü, Ü, ö, Ö, ç, Ç)
- Modern, professional feel
- Free and widely supported

**Next.js Implementation**:

```typescript
import { Inter } from "next/font/google";

const inter = Inter({
  subsets: ["latin", "latin-ext"],
  display: "swap",
});
```

---

## UI Components

> TODO: Define after colors are finalized

### Metric Cards

- Display: metric name, current value, unit, reference range
- Visual indicator for in-range vs out-of-range
- Compact design for grid layout

### Charts

- Line charts for time-series data
- Clear axis labels
- Hover states with exact values
- Reference range visualization (shaded band)

### Status Indicators

- In range: subtle positive indicator
- Out of range: clear but not alarming warning
- Trend arrows (up/down from previous)

---

## Accessibility

**Target**: WCAG 2.1 AA compliance (AAA where possible)

- [ ] Color contrast: 4.5:1 minimum for text
- [ ] Focus indicators: visible keyboard focus
- [ ] Screen readers: proper ARIA labels
- [ ] Reduced motion: respect `prefers-reduced-motion`
- [ ] Font sizing: support browser zoom to 200%

---

## Voice & Tone

- **Clear**: Use plain language, not medical jargon
- **Reassuring**: Don't create unnecessary alarm
- **Helpful**: Explain what values mean
- **Respectful**: This is personal health data

**Examples**:

- Good: "This value is above the typical range"
- Avoid: "CRITICAL: Abnormal result detected!"

---

## References

- [Turkish Ministry of Health logo](https://www.saglik.gov.tr/) - Inspiration for medical symbol
- [Inter font](https://rsms.me/inter/) - Typography
- [WCAG 2.1 Guidelines](https://www.w3.org/WAI/WCAG21/quickref/) - Accessibility
