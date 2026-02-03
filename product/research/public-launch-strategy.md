# ViziAI Public Launch Strategy Research

**Date:** 2026-02-03
**Status:** Research Complete

---

## Executive Summary

This research covers three key areas for launching ViziAI publicly:

1. **Marketing as an indie developer** — Community-first approach, validation before code
2. **Payment setup in Spain** — You need to register as autónomo (€80/month first year)
3. **Pricing model** — Hybrid recommended: free tier + usage-based for PDFs

---

## 1. Indie Developer Marketing Strategy

### Key Insight: Community-First, Not Launch-First

Most product launches fail not because the product is bad, but because the right people never see it. 54% of Indie Hackers products make $0 — community marketing amplifies product-market fit, it doesn't replace it.

### The 90/10 Engagement Rule

- **90% value, 10% promotion** — Share insights, failures, learnings
- **15-20 minutes daily** of genuine participation in communities
- Build recognition before expectation

### Platforms to Use (Multi-Platform = 40% Higher Conversion)

| Platform          | Best For                      | Conversion Rate        |
| ----------------- | ----------------------------- | ---------------------- |
| **Indie Hackers** | Builder community, validation | 23.1% per engaged post |
| **Product Hunt**  | Launch visibility             | 3.1% per launch        |
| **Reddit**        | Niche health communities      | Varies by subreddit    |
| **Hacker News**   | Technical audience            | High but unpredictable |
| **Twitter/X**     | Building in public            | Compounds over time    |

### Recommended Launch Sequence

1. **Pre-Launch (4-6 weeks before)**
   - Start "building in public" on X/Twitter
   - Share progress on Indie Hackers (weekly updates)
   - Engage in health/wellness subreddits (r/health, r/longevity, r/biohacking)
   - Document the journey — people love following stories

2. **Soft Launch**
   - Invite beta users from engaged followers
   - Get testimonials and feedback
   - Fix critical issues

3. **Public Launch**
   - Product Hunt launch (pick Tuesday-Thursday)
   - Indie Hackers post with story + learnings
   - Reddit posts in relevant communities
   - Cross-post to X, LinkedIn

### What Works for Health/AI Products

- **Content-led growth**: Blog posts about health metrics, blood test interpretation
- **SEO**: Target "how to read blood test results", "what is [metric] level"
- **Educational content**: Position as expert, not just tool
- **Case studies**: Real user stories (anonymized health improvements)

### Avoid These Mistakes

- Building for other builders instead of actual customers
- Launching once and expecting results (launch is continuous)
- Ignoring SEO — long-term traffic beats launch spikes
- Not validating before building

---

## 2. Payment Setup in Spain (Without Company)

### TL;DR: You Need Autónomo

**Bad news:** It's illegal to sell online in Spain without being self-employed. No way around it.

**Good news:** The first year is cheap and the process is straightforward.

### Cost Structure (2025-2026)

| Item                      | Cost            | Notes                                |
| ------------------------- | --------------- | ------------------------------------ |
| Social Security (Year 1)  | **€80/month**   | Flat rate for new autónomos          |
| Social Security (Year 2+) | ~€204-290/month | Based on declared income             |
| VAT (IVA)                 | 21%             | Charged to customers, paid quarterly |
| Income Tax Prepayment     | 20%             | Of quarterly profit                  |

### Registration Process

1. **Step 1: Tax Agency (Hacienda)**
   - File Modelo 036 or 037 (simpler)
   - Choose IAE code (professional activity)
   - Can be done online with Digital Certificate

2. **Step 2: Social Security (RETA)**
   - Register within 60 days of Hacienda registration
   - Declare estimated annual earnings
   - Triggers monthly payments

### Quarterly Obligations

| Quarter | Deadline   | What to File                |
| ------- | ---------- | --------------------------- |
| Q1      | April 20   | VAT + Income Tax prepayment |
| Q2      | July 20    | VAT + Income Tax prepayment |
| Q3      | October 20 | VAT + Income Tax prepayment |
| Q4      | January 20 | VAT + Income Tax prepayment |

**Strong recommendation:** Hire a gestor (accountant). Costs ~€50-100/month, saves headaches.

### Stripe Integration

- Stripe works perfectly for autónomos in Spain
- You can accept payments within minutes after account setup
- **E-invoicing requirement coming:** July 2026 for self-employed (VERI\*FACTU system)
- Solution: Invopop integrates with Stripe for compliant invoicing

### Digital Kit Grant

You can apply for up to **€3,000** from the Digital Kit program (Red.es) for:

- Setting up online store
- Payment integration
- Digital tools

Worth exploring once registered as autónomo.

### Bottom Line

**Monthly cost to run ViziAI commercially:**

- Year 1: ~€80/month (Social Security) + gestor (~€70) = **~€150/month**
- Year 2+: ~€250/month (Social Security) + gestor = **~€320/month**

You keep whatever you earn after these costs and quarterly taxes.

---

## 3. Pricing Model Recommendation

### Analysis of Options

#### Option A: Pure Subscription

| Pros                | Cons                              |
| ------------------- | --------------------------------- |
| Predictable revenue | Barrier to entry                  |
| Simple to implement | Users pay for what they don't use |
| Easy to forecast    | Harder initial conversion         |

#### Option B: Pure Usage-Based (Pay per PDF)

| Pros                        | Cons                      |
| --------------------------- | ------------------------- |
| Low barrier to entry        | Unpredictable revenue     |
| Fair — pay for what you use | Can discourage usage      |
| Scales with value           | Users hate surprise bills |

#### Option C: Freemium

| Pros             | Cons                        |
| ---------------- | --------------------------- |
| Maximum adoption | Free users = no revenue     |
| Viral potential  | Supports cost on paid users |
| Low friction     | High churn of free users    |

#### Option D: Hybrid (Recommended)

| Pros                      | Cons                           |
| ------------------------- | ------------------------------ |
| Best of all worlds        | More complex to implement      |
| Low barrier + predictable | Requires clear tier boundaries |
| Aligned with user value   | Communication challenge        |

### Recommendation: Hybrid Model

Based on research: **46% of successful SaaS companies use hybrid pricing**, and those with usage-based elements see **137% net dollar retention**.

### Proposed Pricing Tiers for ViziAI

```
┌─────────────────────────────────────────────────────────────────┐
│                        ViziAI Pricing                           │
├─────────────────┬─────────────────┬─────────────────────────────┤
│      FREE       │      PRO        │         FAMILY              │
│    €0/month     │   €5/month      │        €9/month             │
├─────────────────┼─────────────────┼─────────────────────────────┤
│ • 3 PDF uploads │ • 20 PDFs/month │ • 50 PDFs/month             │
│ • 1 profile     │ • 3 profiles    │ • 10 profiles               │
│ • Basic metrics │ • All metrics   │ • All metrics               │
│ • 30-day history│ • Full history  │ • Full history              │
│                 │ • Trends        │ • Trends                    │
│                 │ • Export        │ • Export                    │
│                 │                 │ • Family sharing            │
│                 │                 │ • Priority support          │
└─────────────────┴─────────────────┴─────────────────────────────┘

             Additional PDFs: €0.30 per PDF (all tiers)
```

### Why This Structure

1. **Free tier (3 PDFs, 1 profile)**
   - Low enough to try, limited enough to convert
   - Covers the "just checking it out" user
   - Allows validation of value before commitment

2. **Pro tier (€5/month)**
   - Sweet spot for individual health enthusiasts
   - 20 PDFs covers ~monthly blood tests + occasional extras
   - Psychological: "Less than a coffee per week"

3. **Family tier (€9/month)**
   - Addresses your core use case (tracking family health)
   - Multiple profiles + sharing built in
   - Strong upgrade path from Pro

4. **Usage overage (€0.30/PDF)**
   - Prevents tier gaming
   - Captures power users
   - Aligns revenue with value delivered

### Pricing Psychology

- **Anchor on Family**: Show it first, makes Pro seem cheap
- **Annual discount**: Offer 2 months free (€50/year, €90/year)
- **First month free**: On Pro tier to drive conversion
- **No credit card for free**: Maximum signups

### Alternative: Simpler Launch Model

If hybrid feels too complex to start:

```
FREE: 5 PDFs total (lifetime, not monthly)
PRO: €5/month unlimited
```

Simple, clear, easy to explain. Add tiers later based on usage data.

---

## Action Items

### Immediate (Before Public Launch)

1. [ ] Register as autónomo (start process now — takes 1-2 weeks)
2. [ ] Set up Stripe account linked to Spanish bank
3. [ ] Find a gestor for quarterly taxes
4. [ ] Implement basic paywall with Stripe

### Marketing (4-6 weeks)

1. [ ] Start Indie Hackers build log
2. [ ] Create X/Twitter account for ViziAI
3. [ ] Write 3 SEO blog posts (blood test interpretation)
4. [ ] Engage in r/biohacking, r/longevity communities

### Launch

1. [ ] Soft launch to current users (get testimonials)
2. [ ] Product Hunt launch
3. [ ] Indie Hackers launch post
4. [ ] Reddit AMAs in health communities

---

## Sources

### Indie Marketing

- [Indie Hackers Launch Strategy Guide 2025](https://awesome-directories.com/blog/indie-hackers-launch-strategy-guide-2025/)
- [Product Hunt vs Indie Hackers](https://poindeo.com/blog/product-hunt-vs-indie-hackers)
- [How to Launch a Product With No Money](https://www.indiehackers.com/article/how-to-launch-a-product-with-no-money-and-no-customers-5416bac05c)
- [Product Hunt Alternatives 2025](https://openhunts.com/blog/product-hunt-alternatives-2025)

### Spain Autónomo & Payments

- [Stripe: Selling Online in Spain Without Being Self-Employed](https://stripe.com/resources/more/sell-online-in-spain-without-being-self-employed)
- [Stripe: Self-Employed Taxes in Spain](https://stripe.com/resources/more/freelance-taxes-in-spain)
- [How to Become Autónomo in Spain 2025](https://www.molinovillas.com/en/blog/how-to-become-autonomo-freelancer-spain-guide)
- [Digital Kit Grant Spain](https://stripe.com/resources/more/kit-digital)

### SaaS Pricing

- [Healthcare Software Pricing Models](https://www.softwareadvice.com/resources/healthcare-software-pricing-models/)
- [Guide to SaaS Pricing Models](https://www.maxio.com/blog/guide-to-saas-pricing-models-strategies-and-best-practices)
- [Subscription vs Usage-Based Pricing](https://www.eleken.co/blog-posts/subscription-vs-usage-based-pricing-choosing-the-perfect-pricing-model-for-saas-success)
- [SaaS Pricing Models Guide](https://www.chargebee.com/resources/guides/saas-pricing-models-guide/)
