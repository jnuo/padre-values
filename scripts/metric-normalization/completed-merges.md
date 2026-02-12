# Completed Merges

**Last Updated:** 2026-02-12

## Merge Groups (29 total)

Status: ✅ = done, ⏳ = in progress, ⬚ = pending

| #   | Canonical                            | Variants (count) | Rows | Unit         | Status                               |
| --- | ------------------------------------ | ---------------- | ---- | ------------ | ------------------------------------ |
| 1   | ALT (Alanin Aminotransferaz)         | 6                | 34   | U/L          | ✅ 8 dupes deleted, ref 5–55         |
| 2   | AST (Aspartat Transaminaz)           | 5                | 33   | U/L          | ✅ 8 dupes deleted, ref 5–40         |
| 3   | Albümin                              | 4                | 26   | g/L          | ✅ 21 dupes deleted, ref 35–55       |
| 4   | ALP (Alkalen Fosfataz)               | 6                | 21   | U/L          | ✅ ref 30–150                        |
| 5   | GGT (Gamma Glutamil Transferaz)      | 4                | 23   | U/L          | ✅ ref 5–55                          |
| 6   | LDH (Laktik Dehidrogenaz)            | 4                | 38   | U/L          | ✅ ref 120–246                       |
| 7   | CRP (C-Reaktif Protein)              | 4                | 19   | mg/L         | ✅ ref 0–5                           |
| 8   | Kalsiyum                             | 3                | 59   | mg/dL        | ✅ ref 8.5–10.5                      |
| 9   | Sodyum                               | 4                | 61   | mmol/L       | ✅ ref 136–145                       |
| 10  | Demir                                | 2                | 9    | µg/dL        | ✅ ref 31–144                        |
| 11  | Ürik Asit                            | 3                | 32   | mg/dL        | ✅ ref 2.6–6, fixed 91→9.1           |
| 12  | eGFR (Glomerüler Filtrasyon Hızı)    | 5                | 58   | mL/dk/1.73m² | ✅ ref 60–120                        |
| 13  | Ferritin                             | 2                | 9    | ng/mL        | ✅ 2 dupes deleted, ref 12–300       |
| 14  | Hemoglobin                           | 3                | 40   | g/dL         | ✅ deleted HGB=8.6 dupe, ref 13–17.5 |
| 15  | Hematokrit                           | 3                | 37   | %            | ✅ deleted HCT=24.7 dupe, ref 36–51  |
| 16  | MPV (Ortalama Trombosit Hacmi)       | 2                | 43   | fL           | ✅ ref 7–12.4                        |
| 17  | Sedimantasyon                        | 3                | 10   | mm/h         | ✅ ref 0–20                          |
| 18  | Vitamin B12                          | 2                | 7    | pg/mL        | ✅ ref 190–880, ng/L→pg/mL           |
| 19  | Total Bilirubin                      | 4                | 20   | mg/dL        | ✅ ref 0.2–1.2                       |
| 20  | Direkt Bilirubin                     | 5                | 17   | mg/dL        | ✅ 7 dupes deleted, ref 0–0.3        |
| 21  | APTT (Parsiyel Tromboplastin Zamanı) | 2                | 8    | sn           | ✅ ref 21–35                         |
| 22  | Trigliserid                          | 2                | 3    | mg/dL        | ✅ ref 0–150                         |
| 23  | Potasyum                             | 2                | 37   | mmol/L       | ✅ ref 3.5–5.1                       |
| 24  | Kan Üre Azotu                        | 3                | 30   | mg/dL        | ✅ ref 6–23                          |
| 25  | Bazofil#                             | 2                | 38   | 10^3/µL      | ✅ 1 dupe deleted, ref 0–0.1         |
| 26  | Eozinofil#                           | 2                | 40   | 10^3/µL      | ✅ deleted 13.8 outlier, ref 0–0.5   |
| 27  | Lenfosit#                            | 3                | 40   | 10^3/µL      | ✅ deleted 92.4 outlier, ref 1–4.8   |
| 28  | Monosit#                             | 3                | 40   | 10^3/µL      | ✅ kept 5.4 outlier, ref 0.1–1.0     |
| 29  | Nötrofil#                            | 2                | 40   | 10^3/µL      | ✅ kept 11.45 outlier, ref 1.5–7.7   |

## Notes

- Group 7 (CRP): "C reaktif protein (CRP)" excluded — uses mg/dL, needs separate review
- Group 12 (eGFR): unit strings vary but all mean the same thing
- Group 18 (Vitamin B12): pg/mL and ng/L are numerically equivalent
- Group 24 (Kan Üre Azotu): BUN (different unit) excluded, needs review
- Potasyum aliases (Potasiyum, POTASYUM (SERUM/PLAZMA), Potaszyum) already merged in earlier sprint
- Groups 25–29: CBC absolute count metrics — base name without # is same test, English abbreviations (BASO#, EOS#, etc.) also merge

---

## Group Analysis Details

### Group 1: ALT — ✅ Approved

**Canonical:** ALT | **Unit:** U/L | **Ref range:** 5–55

**Variants:**

| Variant                               | Count |
| ------------------------------------- | ----- |
| ALT                                   | 11    |
| Alanin aminotransferaz                | 26    |
| Alanin aminotransferaz - [Alt / Sgpt] | 1     |
| Alanine aminotransferaz (ALT)         | 1     |
| Alt (Alanin Aminotransferaz)          | 1     |
| Alt (Alanine Aminotransferaz)         | 2     |

**Patient values:** 5–46 U/L, median 10. All within normal ALT range.
**Outliers:** None.
**Fixes:** 1 blank unit → U/L, 1 row ref_high=5 (extraction error) → corrected to 5–55.

**Actions:**

- UPDATE all 42 rows → name = "ALT", unit = "U/L", ref_low = 5, ref_high = 55
- INSERT 5 aliases into metric_aliases
