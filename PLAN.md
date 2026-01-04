# Eden Project Plan

> Living document for tracking features, to-dos, and project roadmap.
> Last updated: January 2026

---

## Project Overview

**Eden** is a personal health coaching platform focused on **primespan** – the years where you actually feel strong, clear, and able to do what you care about.

Health is organized into **five domains**:
- **Heart** – cardio & blood markers (VO2max, resting HR, blood pressure)
- **Frame** – strength & body structure (body composition, body fat %)
- **Metabolism** – energy & blood sugar (HbA1c, fasting glucose)
- **Recovery** – sleep & HRV
- **Mind** – focus & cognition

**Detailed documentation:** [EDEN_SUMMARY.md](usefulDocsForPlanning/EDEN_SUMMARY.md)

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                           FRONTEND                                   │
│  Next.js 14 (App Router) + TypeScript + Tailwind CSS                │
│                                                                      │
│  /chat        → AI Coach conversation                               │
│  /dashboard   → Prime Scorecard visualization                        │
│  /data        → Apple Health uploads, data sources                  │
│  /onboarding  → User setup flow (8 steps)                           │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│                       API ROUTES (Serverless)                        │
│                                                                      │
│  /api/eden-coach/*       → Chat, history, plans                     │
│  /api/prime-scorecard/*  → Scorecard generation                     │
│  /api/uploads/*          → File uploads                             │
│  /api/onboarding/*       → Onboarding state                         │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│                          SUPABASE                                    │
│                                                                      │
│  Auth      → Magic link authentication                              │
│  Database  → PostgreSQL (eden_* tables)                             │
│  Storage   → Apple Health uploads, photos                           │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      RAILWAY WORKER                                  │
│                                                                      │
│  worker/apple-health/    → Async processing of Health exports       │
│  Polls → Downloads → Parses XML → Writes metrics → Triggers score   │
└─────────────────────────────────────────────────────────────────────┘
```

**Key Directories:**
- `app/` – Next.js pages and API routes
- `components/` – Reusable React components
- `lib/` – Business logic, utilities, Supabase clients
- `lib/prime-scorecard/` – Scorecard computation engine
- `worker/apple-health/` – Railway worker for processing imports

---

## Active Priorities

> Top items currently being worked on. Move items here from the backlog.

| Priority | Item | Status | Notes |
|----------|------|--------|-------|
| [P0] | | | |
| [P0] | | | |
| [P1] | | | |

---

## Feature Backlog

### Onboarding

- [ ] [P1] Prime check UI: "Other" option - add text box for custom input
- [ ] [P2] Improve onboarding completion rate tracking
- [ ] [P2] Add progress indicator to onboarding steps
- [ ] [P3] A/B test different onboarding flows

### Scorecard / Analytics

- [ ] [P1] Map Apple Health export to drivers (more metrics)
- [ ] [P2] Show trend arrows (improving/declining) on scorecard
- [ ] [P2] Historical scorecard comparison view
- [ ] [P3] Weekly email summary of Prime Score changes

### Eden Coach (AI Chat)

- [ ] [P1] Coach Plan: Goal + Protocol system
- [ ] [P1] Giving Coach context: create summaries from uploads, questionnaires
- [ ] [P1] Model usage: determine which model to use where
- [ ] [P1] Coach chat: add response helpers
- [ ] [P1] Coach behaviour pre-goal: more human and friendly when greeting and generating
- [ ] [P2] Improve conversation memory and context window
- [ ] [P2] Add coaching templates for common scenarios
- [ ] [P2] Rename: coaching reset
- [ ] [P3] Voice input/output for coach interactions

### Data Imports

- [ ] [P1] Lab uploads: show optimal range indicators
- [ ] [P1] Lab uploads: info icon explaining what it is and why it drives Metabolism
- [ ] [P2] Wearables integration (Oura, Whoop, Garmin)
- [ ] [P2] Manual metric entry UI
- [ ] [P3] CSV import for historical data

### Dashboard / UI

- [ ] [P1] Capturing reality: showing all constraints, infrastructure in Data
- [ ] [P2] Improve Pentagon visualization interactivity
- [ ] [P2] Add domain detail pages (drill into Heart, Frame, etc.)
- [ ] [P3] Dark mode support

### User Experience

- [ ] [P1] Core interactions with the App: logging system
- [ ] [P1] User Feedback: in-app feedback mechanism + admin dashboard for reviewing and ranking feedback
- [ ] [P2] Push notifications for reminders
- [ ] [P3] Achievements/streaks gamification

---

## Technical Debt / Bugs

### Bugs

- [ ] [P1] 
- [ ] [P2] 

### Tech Debt

- [ ] [P2] Add comprehensive error handling for API routes
- [ ] [P2] Improve TypeScript types across the codebase
- [ ] [P3] Add unit tests for scorecard computation
- [ ] [P3] Refactor Apple Health parsing for better maintainability

---

## Infrastructure / DevOps

- [ ] [P2] Set up proper staging environment
- [ ] [P2] Add structured logging and monitoring
- [ ] [P3] Implement rate limiting on API routes
- [ ] [P3] Database backup automation

---

## Future Ideas (Icebox)

> Long-term features not yet prioritized. Review monthly.

- Mobile app (React Native)
- Social features (compare with friends, challenges)
- Integration with healthcare providers
- Personalized supplement recommendations
- Genetic data integration (23andMe, etc.)
- Food logging and nutrition tracking
- Workout plan generation
- Sleep optimization protocols
- Stress management programs
- Blood work interpretation AI

---

## Completed

> Archive of finished items. Move here with completion date.

| Item | Completed | Notes |
|------|-----------|-------|
| Magic link authentication | Dec 2024 | Working via Supabase |
| Apple Health data import | Dec 2024 | Full pipeline working |
| Pentagon visualization | Dec 2024 | Dashboard display |
| Chat with context-aware AI | Dec 2024 | Eden Coach functional |
| Profile extraction from chat | Dec 2024 | Auto-extracts user info |
| 8-step onboarding flow | Dec 2024 | Prime Check integrated |
| Prime Scorecard computation | Dec 2024 | 5 domains + confidence |

---

## How to Use This Document

### Priority Levels
- **[P0]** - Critical / Blocking - Do immediately
- **[P1]** - High priority - Current sprint
- **[P2]** - Medium priority - Next sprint
- **[P3]** - Low priority - Backlog

### Workflow
1. Add new ideas to appropriate backlog section
2. During planning, move items to "Active Priorities"
3. Update status as work progresses
4. Move completed items to "Completed" section with date

### Checkbox Syntax
```markdown
- [ ] Pending task
- [x] Completed task
```

---

## Quick Links

- **Live App:** https://eden-jade.vercel.app
- **Supabase Dashboard:** https://app.supabase.com
- **Vercel Dashboard:** https://vercel.com
- **Railway Dashboard:** https://railway.app

**Documentation:**
- [EDEN_SUMMARY.md](usefulDocsForPlanning/EDEN_SUMMARY.md) - Full product & implementation summary
- [APPLE_HEALTH_FLOW.md](usefulDocsForPlanning/APPLE_HEALTH_FLOW.md) - Data import pipeline
- [SCORECARD_GENERATION_ACCESS.md](usefulDocsForPlanning/SCORECARD_GENERATION_ACCESS.md) - Supabase access patterns
