# PR Diagram — Tech Plan

## 1. What we're building

PR Diagram turns a GitHub pull request into a visual, navigable summary. Instead of skimming hundreds of diff lines, the user sees four high-signal lenses on what changed:

- **UI** — before/after screenshots of affected routes
- **API** — endpoint diffs with breaking/non-breaking classification
- **Data** — schema changes (new/modified/dropped tables)
- **Business** — narrative description of pricing/permission/policy changes

Plus a deterministic risk score (0–100), risk signals (warn/good), and 3–5 actionable items the reviewer should not forget.

**Consumption model (MVP):** public web app. User pastes a GitHub PR URL on the landing page, clicks Analyze, and lands on a shareable analysis page.

---

## 2. MVP scope: a controlled scenario

To ship something reliable without depending heavily on LLM reasoning, we constrain supported repos to a deterministic stack. This is the explicit trade-off: limit who can use it, but be confident in what it shows.

A repo is **eligible** if it has:

| Requirement | Why | Tool |
|---|---|---|
| Public GitHub repo | No auth needed for MVP (60 req/h anonymous, 5000 with a server-side PAT) | GitHub REST/GraphQL |
| TypeScript codebase | Lets us use the TS Compiler API for structural insights | `ts-morph` |
| OpenAPI spec committed at a known path | Deterministic API diff | `oasdiff` |
| Prisma schema + migrations | Deterministic data diff | `@prisma/internals.getDMMF` or raw `migration.sql` parsing |
| Vercel preview deploys configured | Deterministic visual diff | Playwright screenshots |
| `prdiagram.config.json` declaring routes + paths | Pinned config so we never have to guess | local file in target repo |

When a repo fails eligibility, the page renders a clear **"Repo not supported yet"** screen explaining exactly what's missing. The limitation becomes a feature.

```json
// prdiagram.config.json — lives in the target repo
{
  "preview": {
    "provider": "vercel",
    "routes": [
      { "path": "/", "name": "Storefront" },
      { "path": "/checkout", "name": "Checkout" }
    ]
  },
  "openapi": "openapi.yaml",
  "prisma": "prisma/schema.prisma",
  "viewports": ["desktop", "mobile"]
}
```

---

## 3. Determinism boundary

Most of the pipeline is deterministic. The LLM is scoped to narrative tasks where structure isn't available.

### Deterministic (no LLM)

- File classification (paths + ts-morph signals)
- Endpoint diffs (oasdiff)
- Schema diffs (Prisma DMMF or migration SQL)
- Visual diffs (Playwright screenshots before/after)
- TS public-API surface diff (ts-morph)
- Risk score (heuristic weights over collected signals)

### LLM-scoped (Sonnet 4.6, with citation enforcement)

- PR subtitle (1–2 sentence customer-facing summary)
- Business rules narrative (before/after text + examples)
- Actionable items
- Risk signal phrasing polish

LLM never produces the score itself, never invents tables or endpoints, and every claim must cite a file path that exists in the diff. Citations are validated post-LLM; unsupported claims are dropped.

---

## 4. Pipeline

```
PR URL → fetch (GitHub API, public)
   │
   ├──→ Repo eligibility check
   │       (TS? OpenAPI? Prisma? prdiagram.config? Vercel preview?)
   │       └── if fails: render "not supported" screen
   │
   ├──→ Pillar 1: UI         (Playwright on Vercel preview vs main)
   ├──→ Pillar 2: API        (oasdiff base vs head openapi.yaml)
   ├──→ Pillar 3: Data       (Prisma migrate diff / parsed migration.sql)
   └──→ Pillar 4: TS surface (ts-morph: exports, signatures, components)
              │
              ▼
   ┌──────────────────────────────────────┐
   │ Aggregator (deterministic)            │
   │   - merges pillar outputs             │
   │   - extracts risk signals (booleans)  │
   │     touches_billing, no_feature_flag, │
   │     breaking_api, irreversible_migr,  │
   │     tests_added, ...                  │
   └──────────────────────────────────────┘
              │
              ▼
   ┌──────────────────────────────────────┐
   │ LLM passes (parallel, scoped)        │
   │   - subtitle (Haiku)                  │
   │   - business rules narrative (Sonnet) │
   │   - actionable items (Sonnet)         │
   │   - signal text polish (Sonnet)       │
   └──────────────────────────────────────┘
              │
              ▼
   Risk score (heuristic over signals)
              │
              ▼
   PRDiagramData JSON → <PRDiagram data />
```

---

## 5. Risk scoring

A function pure over the collected signals:

```ts
const SIGNAL_WEIGHTS = {
  touches_billing:        +25,
  touches_auth:           +25,
  breaking_api:           +20,
  irreversible_migration: +20,
  no_feature_flag:        +15,
  no_tests_added:         +10,
  large_diff_500_plus:    +10,
  // good signals reduce score
  tests_added:            -10,
  feature_flag_present:   -15,
  small_isolated_change:  -10,
};

function scoreRisk(signals: SignalKey[]): { score: number; level: RiskLevel } {
  const base = 30;
  const raw = signals.reduce((s, key) => s + SIGNAL_WEIGHTS[key], base);
  const score = Math.max(0, Math.min(100, raw));
  const level = score >= 70 ? 'High' : score >= 40 ? 'Medium' : 'Low';
  return { score, level };
}
```

Properties this gives us:
- **Reproducible**: same `head_sha` → same score
- **Auditable**: you can point at the weights and the detected signals
- **Tunable**: recalibrate by editing one constant, not by re-prompting an LLM

---

## 6. Architecture & deployment

| Component | Where | Notes |
|---|---|---|
| Web app (Next.js 16) | Vercel | Hobby tier suffices for MVP |
| Screenshotter service | Railway / Fly container | Docker image `mcr.microsoft.com/playwright`; single `POST /capture` endpoint |
| Cache | Vercel KV (free tier) | Key: `analysis:{owner}/{repo}/{pr}:{head_sha}`, TTL 7d, merged PRs effectively permanent |
| LLM | Anthropic API | Server-side key only, never exposed to client |
| Storage of analyses | Same KV | One entry per `(repo, pr, head_sha)` |

Why a separate Playwright service: Vercel functions hit 250MB size limits and 10s+ cold starts when Chromium is bundled. A small container side-service avoids this and costs ~$5/month.

### Cost estimate (monthly, MVP volume)

| Item | Cost |
|---|---|
| Vercel hobby | $0 |
| Railway screenshotter | $5 |
| Vercel KV | $0 (free tier) |
| Anthropic (~100 PRs/mo with caching) | ~$5 |
| **Total** | **~$10/mo** |

### Safety / abuse protection

- MVP **allowlist**: only `cravou/pr-lens-demo` analyzed. Prevents random users burning LLM credits.
- **Rate limit**: 5 analyses/hour/IP via `@upstash/ratelimit` + Vercel KV.
- **Hard cache** keyed on `head_sha`. Merged PRs are immutable in this product.
- **PR size cap**: refuse PRs > 5000 lines changed with a clear message.

---

## 7. Reference repo: `pr-lens-demo`

A separate public repo we own. Demonstrates the full controlled stack and provides golden PRs to test against.

**Domain:** SaaS dashboard for project management with usage-based billing (think Linear with a billing module). Covers all 4 pillars naturally and has believable "dangerous" changes (billing, permissions).

**Required tech:** Next.js 16, TypeScript, Prisma, committed `openapi.yaml`, Vercel preview, `prdiagram.config.json`.

**Example PRs (created in this order):**

| # | Title | Pillar | Purpose |
|---|---|---|---|
| 1 | `Add priority field to tasks` | Data | Validates Prisma diff pipeline in isolation |
| 2 | `Add GET /api/v1/workspaces/[id]/activity endpoint` | API | Validates oasdiff |
| 3 | `Redesign workspace settings page` | UI | Validates Playwright screenshotter |
| 4 | `Add usage-based billing for AI features` | All 4 | Combo demo; SaaS parallel of mock's "installments to checkout" |

PR #4 is the main shareable demo: `prlens.app/{org}/pr-lens-demo/pull/4`.

---

## 8. Code structure (PR Diagram app itself)

The React side follows the `react-standards` skill in this repo (`.claude/skills/react-standards/SKILL.md`).

```
app/
├── _pages/
│   └── PRDiagram/
│       ├── PRDiagram.page.tsx              # Orchestrator (data prop, owns activeTab state)
│       ├── utils.ts                     # timeAgo, stateLabel, getRiskDot
│       ├── constants.ts                 # ACTION_ICON mapping
│       └── components/
│           ├── PRDiagramHeader.tsx
│           ├── PRMetaHeader.tsx
│           ├── ChangeTabs.tsx           # exports TabId
│           ├── PRDiagramSidebar.tsx        # composes 3 cards
│           ├── RiskScoreCard.tsx
│           ├── RiskSignalsList.tsx
│           ├── ActionableItemsList.tsx
│           ├── SectionHeader.tsx        # shared primitive
│           ├── WarningBanner.tsx        # shared primitive
│           ├── BeforeAfterPanel.tsx     # shared primitive
│           ├── HighlightedText.tsx      # shared primitive
│           ├── UIChangeView.tsx         # inlines ScreenshotPanel, ChangedComponentsList
│           ├── APIChangeView.tsx        # inlines EndpointDiff, JsonBlock
│           ├── DataChangeView.tsx       # inlines NewTableCard, ModifiedTableCard, DroppedTableCard
│           └── BusinessChangeView.tsx   # inlines BusinessRuleDiff
├── _lib/
│   ├── types.ts                         # PRDiagramData contract
│   ├── github.ts                        # PR fetcher (TODO)
│   ├── eligibility.ts                   # repo conformance check (TODO)
│   ├── pillars/                         # 4 deterministic pillars (TODO)
│   │   ├── ui.ts
│   │   ├── api.ts
│   │   ├── data.ts
│   │   └── ts.ts
│   ├── analyze.ts                       # pipeline orchestrator (TODO)
│   ├── score.ts                         # deterministic risk scorer (TODO)
│   └── cache.ts                         # KV cache wrapper (TODO)
├── _fixtures/
│   └── samplePR.ts                      # demo data while pipeline is being built
├── [owner]/[repo]/pull/[number]/        # dynamic route (TODO)
│   └── page.tsx
├── page.tsx                             # landing (currently demos fixture)
└── layout.tsx
```

---

## 9. Data contract

The pipeline produces `PRDiagramData` (see `app/_lib/types.ts`). All fields JSON-serializable across the RSC boundary.

```ts
interface PRDiagramData {
  meta: { owner, repo, number, title, subtitle, author, state, mergedAt, htmlUrl, headSha };
  risk: { score, level, signals: RiskSignal[] };
  domains: string[];
  actions: ActionItem[];
  changes: {
    ui: UIChanges;          // { count, description, changedComponents, screenshots, warning }
    api: APIChanges;        // { count, description, endpoints, warning }
    data: DataChanges;      // { count, description, newTables, modifiedTables, droppedTables, isReversible, warning }
    business: BusinessChanges;  // { count, description, rules, warning }
  };
}
```

---

## 10. Next 16 specifics to remember

- `params` is a `Promise` in dynamic route components — always `await`
- `fetch` is **not** cached by default — opt in with `'use cache'` directive
- Cache Components (`cacheComponents: true` in `next.config.ts`) replaces old `revalidate` / `fetchCache` segment configs with `'use cache'` + `cacheLife('max'|'hours')` + `cacheTag()` + `updateTag()`
- `notFound()` from `next/navigation` for 404; `not-found.tsx` for UI
- `error.tsx` must be a Client Component; uses `unstable_retry` (replaces `reset` from Next 15)
- Edge runtime not supported with Cache Components — use Node runtime

---

## 11. Implementation order

Each step is shippable on its own. We can pause at any point and have a working partial product.

1. ✅ Define `PRDiagramData` types
2. ✅ Refactor PRDiagram UI to be data-driven, applying react-standards
3. Create reference repo `pr-lens-demo` (stack scaffold + PR #1: data-only)
4. `_lib/github.ts` — public PR fetcher (`getPR`, `getFiles`, `getFileContent`)
5. `_lib/eligibility.ts` — conformance detector + "not supported" screen
6. Dynamic route `app/[owner]/[repo]/pull/[number]/page.tsx` with eligibility gate
7. Pillar: Data (Prisma migration parser) — first PR analysis end-to-end
8. Pillar: API (oasdiff integration)
9. ts-morph classifier + UI changed-components detection
10. Screenshotter service on Railway + Vercel preview integration
11. LLM passes (subtitle, business narrative, actions, signal phrasing)
12. Risk scorer (`_lib/score.ts`)
13. Caching layer (`_lib/cache.ts`) + rate limit middleware
14. Eval suite (golden PRs from `pr-lens-demo`)

---

## 12. Open decisions

- Reference repo final name (current: `pr-lens-demo`)
- Eval suite: ship with MVP or after first round of usage feedback
- When (if) to expand the allowlist beyond `pr-lens-demo`
- Whether to surface "BYO Anthropic key" later (lowers our LLM cost, raises onboarding friction)

---

## 13. Risks & mitigations

| Risk | Mitigation |
|---|---|
| Playwright won't fit Vercel functions | Separate container service on Railway/Fly |
| LLM cost runaway | Allowlist + cache + rate limit + scope LLM to small narrative tasks only |
| LLM hallucinates tables/endpoints | Citation enforcement + post-LLM validation against the actual diff |
| PR too large to analyze | Cap at 5000 lines, clear refusal message |
| Score perceived as arbitrary | Deterministic formula; weights documented; signals cited |
| Stack drift on target repo (e.g., switches from Prisma to Drizzle) | Eligibility check runs every analysis; clear "not supported" message |
