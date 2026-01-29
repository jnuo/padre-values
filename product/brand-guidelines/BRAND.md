# ViziAI - Brand Guidelines

> Work in progress. This document will define the visual identity for ViziAI.

## Product Name

**ViziAI**

From "visualization" + "AI". Clear meaning: AI-powered health data visualization.

Turkish tagline: _Tahlil Sonuçlarını Kolayca Anlayın_ (Easily understand your test results)

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

> TODO: Define full palette with accessibility verification

### Design Considerations

- Health app = trustworthy, calming (blues, teals, greens work well)
- Need strong "out of range" indicator that's not panic-inducing
- Dark mode support required
- Charts need 5-6 distinguishable colors
- All colors must pass WCAG AA contrast (4.5:1 for text)

### Preliminary Direction

| Role           | Light Mode    | Dark Mode     | Notes                     |
| -------------- | ------------- | ------------- | ------------------------- |
| Primary        | TBD           | TBD           | Main brand color          |
| Secondary      | TBD           | TBD           | Accent/complementary      |
| Success/Normal | Green variant | Green variant | Values in healthy range   |
| Warning        | Amber variant | Amber variant | Values approaching limits |
| Critical       | Red variant   | Red variant   | Values out of range       |
| Background     | Near white    | Near black    |                           |
| Foreground     | Near black    | Near white    |                           |

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
