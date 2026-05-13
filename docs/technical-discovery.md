# Technical Discovery — PR Lens

**Status:** Architecture locked for MVP; production paths noted
**Last updated:** May 2026
**Owner:** Matheus
**Linked docs:** PRD (`01-PRD.md`), Design & UX Plan (`02-Design-UX-Plan.md`)

---

## 1. Scope of this document

This is the technical discovery from MVP perspective: the architecture that ships, the trade-offs taken, and the production paths that were considered and deliberately deferred. It is not a production runbook. Sections explicitly marked "v2" or "production" describe direction, not commitment.

The MVP is bounded by:
- Single-page web app, no authentication.
- Public GitHub PRs only.
- One LLM call per PR, no caching, no background jobs.
- "Demo mode" fallback for evaluators without API keys.

---

## 2. System overview

```
┌────────────────────┐
│   Browser (Next)   │
│   - URL input      │
│   - Result render  │
└─────────┬──────────┘
          │ POST /api/analyze { url }
          ↓
┌──────────────────────────────────────────────────────────┐
│   Next.js API route (server-side)                        │
│                                                          │
│   1. Parse URL → { owner, repo, prNumber }               │
│   2. GitHub REST API:                                    │
│      - GET /repos/:o/:r/pulls/:n           (metadata)    │
│      - GET /repos/:o/:r/pulls/:n/files     (diff)        │
│   3. Build LLM prompt (system + user)                    │
│   4. Anthropic API: structured output via tool calling   │
│   5. Validate JSON against schema                        │
│   6. Return to client                                    │
└─────────┬──────────┬─────────────────────────────────────┘
          │          │
          ↓          ↓
   ┌──────────┐  ┌──────────────┐
   │ GitHub   │  │ Anthropic    │
   │ REST API │  │ Messages API │
   └──────────┘  └──────────────┘
```

Everything is server-side after the user submits the URL. The browser does not talk to GitHub or Anthropic directly — both calls flow through the Next.js API route to keep API keys server-only and to allow request transformation.

There is no database, no queue, no background processing, no state persistence in the MVP.

---

## 3. Stack choices

### 3.1 Why Next.js

- File-based routing (`app/api/analyze/route.ts`) eliminates Express-style scaffolding for a one-endpoint API.
- Server actions and `fetch` work identically on client and server, which simplifies the data layer.
- Vercel deploy is one command for evaluator preview; build artifact is portable to any host.
- Familiar to the broadest pool of reviewers — the build artifact is judgeable by anyone who reads React.

### 3.2 Why TypeScript

The data structure that flows from LLM to UI is non-trivial (nested change objects, signals, actions). Without static types, prompt-output drift becomes an invisible failure mode. The TypeScript schema doubles as the source of truth for the LLM's structured output (see §5.3).

### 3.3 Why Tailwind + raw components

Design system is deliberately minimal (see Design & UX Plan §6). Tailwind matches that minimalism without dragging in a component library that would have to be themed against. Hand-written components stay close to the design intent.

### 3.4 What we explicitly didn't pick

- **No state library** (Redux, Zustand, Jotai). Single-page app with one server round-trip and local UI state. `useState` is enough.
- **No data fetching library** (React Query, SWR). One endpoint, one call. The complexity isn't there.
- **No CSS-in-JS** (styled-components, Emotion). Tailwind covers it.
- **No testing framework wiring in MVP**. Honest decision: tests for an LLM-driven UI would mostly mock the LLM, which is theater. v2 needs LLM golden-set regression tests, not jest unit tests.

---

## 4. GitHub integration

### 4.1 What we fetch

```
GET /repos/{owner}/{repo}/pulls/{number}
GET /repos/{owner}/{repo}/pulls/{number}/files
```

The first returns metadata: title, body (PR description), author, state (open / closed / merged), timestamps, base/head branches, additions/deletions counts, requested reviewers.

The second returns the file-by-file diff: filename, status (added / modified / removed / renamed), additions and deletions counts, and the patch text. The patch is truncated by GitHub at ~3000 lines per file, which is acceptable for this product.

### 4.2 Authentication

Public PRs are accessible unauthenticated, with a 60 requests/hour rate limit per IP. For a demo and small evaluator load this is sufficient.

A `GITHUB_TOKEN` environment variable raises the limit to 5000 requests/hour and is recommended for the deployed evaluator-facing version. The token does not need any scopes for public repos; it just authenticates the calling identity.

### 4.3 URL parsing

The product accepts any of these forms:
- `https://github.com/owner/repo/pull/123`
- `https://github.com/owner/repo/pull/123/files`
- `owner/repo#123`
- `owner/repo/pull/123`

A small regex parser normalizes these to `{ owner, repo, number }`. Invalid input yields a friendly error before any API call is made.

### 4.4 Size limits

We cap the diff payload sent to Claude at ~100,000 tokens (≈ 50 files, ~30,000 lines combined). Over the cap, the prompt explicitly tells Claude that the diff was truncated and includes the file list with sizes; the UI surfaces a "Partial analysis — diff was large" banner. Truncating gracefully is preferable to failing or to silently misrepresenting.

### 4.5 Edge cases handled

| Case | Behavior |
|---|---|
| PR is in draft state | Analyzes normally; surfaces "Draft" badge in metadata. |
| PR is closed without merge | Analyzes normally; surfaces "Closed" badge. |
| PR has no files (rare) | Surface empty state: "This PR has no file changes." |
| Repository is private | 404 from GitHub. Friendly error: "We can't access this PR. It may be private." |
| Repository was deleted | Same 404 path. |
| Rate limit exceeded | Detect via status 403 + `X-RateLimit-Remaining: 0`. Friendly error. |
| Network failure | Generic retry-able error message. |

### 4.6 What's out of scope

- Private repos. Requires OAuth flow, deferred to v2.
- GitHub Enterprise. Requires base URL configuration; trivial in v2.
- Webhook-driven analysis (PR opened → automatic analysis). Out of MVP; requires a deployment with persistent storage and a webhook endpoint.

---

## 5. LLM integration

### 5.1 Provider and model

- Provider: **Anthropic** (the brief implicitly favored AI tool usage; structured output via tool calling is a strong fit).
- Model: **Claude Sonnet 4.6** as the default. Sonnet is the right cost/quality tradeoff for this workload — Opus is overkill for classification, Haiku underperforms on multi-step reasoning over diffs.
- Fallback model (for cost-conscious deployment): **Claude Haiku 4.5**, with degraded but acceptable quality on small PRs.

### 5.2 Why structured output, not free-form

The UI is a dense, typed layout with required fields. A prose response would force a parser between LLM and UI, which is the failure mode every existing tool falls into. Instead, we use Anthropic's tool-calling pattern to *require* a JSON shape:

- Define a `submit_pr_analysis` tool whose input schema matches the UI's exact data needs.
- Force the LLM to call this tool (`tool_choice: { type: "tool", name: "submit_pr_analysis" }`).
- The tool's `input` is the analysis. We don't actually execute the tool — we read the input directly.

This pattern guarantees the JSON is well-formed and the schema is validated by the API itself before we receive the response. It eliminates the most common LLM-integration bug: parsing prose that drifted from the expected format.

### 5.3 The schema (single source of truth)

The schema is defined once in TypeScript and used both to type the server-to-client response and as the JSON Schema sent to Anthropic. The shape:

```typescript
type Verdict = "approved" | "denied" | "flagged" | "pending";

type Analysis = {
  title: string;             // ≤100 chars
  subtitle: string;          // ≤140 chars, product language
  author: string;
  mergedAgo: string;
  state: "open" | "merged" | "closed" | "draft";

  risk: {
    score: number;           // 0-100
    level: "Low" | "Medium" | "High";
    signals: Array<{
      type: "warn" | "good";
      text: string;          // ≤80 chars
    }>;
  };

  domains: string[];         // 1-4 tags, e.g. ["Billing", "Checkout"]

  changes: {
    ui:       { count: number; items: ChangeItem[] };
    api:      { count: number; items: ChangeItem[] };
    data:     { count: number; items: ChangeItem[] };
    business: { count: number; items: ChangeItem[] };
  };

  actions: Array<{
    icon: "FileText" | "Bell" | "Flask" | "Message";
    text: string;
    urgency: "Before deploy" | "This sprint" | "Before release";
  }>;
};

type ChangeItem = {
  label: string;
  description: string;
  before?: string;      // textual representation of before state
  after?: string;       // textual representation of after state
  impact?: string;      // one-line consequence
};
```

The schema is intentionally rigid. Unknown fields are rejected. Empty strings are not allowed where strings are required. Counts must match the length of their items array.

### 5.4 Prompt design

The system prompt is structured in three parts:

**Part 1: role and outcome.**
> You are an analyst translating GitHub pull requests for non-engineer stakeholders (product managers, support, QA, designers). Your job is to classify the change into typed dimensions and surface the actions stakeholders should take. You are not summarizing the diff; you are explaining the change.

**Part 2: the four dimensions, defined.**
> Classify the change along four dimensions:
> - **UI**: changes a stakeholder could see in the product if they used it (buttons, screens, copy, layout).
> - **API**: changes to the contract between the system and its external consumers (endpoints, request/response shape, fields, statuses).
> - **Data**: changes to how data is stored (tables, columns, indexes, migrations).
> - **Business**: changes to the rules the system enforces (thresholds, conditions, calculations, policies).
> A single PR can affect multiple dimensions. A dimension can be empty (count: 0); if it is empty, do not invent content for it.

**Part 3: tone and style for written output.**
> The subtitle is one sentence in product language. Describe what users will experience, not what code was changed. Example good: "Customers can now split payments into 12 installments at checkout." Example bad: "Adds installments field to the checkout endpoint."

**User message**: PR title, body, file list with status, and the diff itself (truncated as needed).

### 5.5 Risk score calculation

The score is generated by the LLM, not calculated post-hoc. The prompt instructs:

> Risk score is 0-100, where higher is riskier. Consider: breaking changes (high), absence of feature flags (medium-high), touching production-critical paths like billing/auth (high), data migrations (high if irreversible), test coverage (low if comprehensive). Output a single integer.

The level (Low / Medium / High) is computed deterministically from the score on the server: ≤39 = Low, 40-69 = Medium, ≥70 = High. This avoids the LLM disagreeing with itself across calls.

### 5.6 Latency

| Stage | Typical | Worst case |
|---|---|---|
| URL parse | <1ms | — |
| GitHub metadata | 200-500ms | 2s |
| GitHub files | 300-800ms | 3s |
| Anthropic call | 4-10s | 25s |
| Response transform | <10ms | — |
| **Total** | **5-12s** | **30s** |

This is acceptable for first-load of one PR and unacceptable for any kind of inbox or batch usage. Production must add:
- Cache by `(repo, prNumber, head SHA)` — if the PR head hasn't changed, return cached analysis.
- Stream the LLM response so the UI populates progressively rather than all-at-once.
- Pre-warm by triggering analysis from a GitHub webhook on PR open.

### 5.7 Cost

At Sonnet 4.6 pricing (as of writing), a typical 30K-token input + 2K-token output costs roughly $0.10 per PR. Evaluator load (≤50 PRs total) is under $5. Production load (hundreds per day) requires caching or a switch to Haiku.

### 5.8 Quality risks and mitigations

| Risk | Mitigation |
|---|---|
| LLM invents file paths, function names, or behavior | Prompt requires references to be grounded in the provided diff. Future: post-validation that mentioned file paths exist in the PR. |
| Classification is wrong (UI change classified as Business) | Acceptable in MVP. v2 should evaluate against a labeled golden set of 50-100 PRs. |
| Subtitle is too long, too jargony, or repeats the title | Prompt rules + schema length cap. Visible to the user, so failures are surfaced not hidden. |
| Action items are generic ("Update documentation") not specific | Prompt rules require each action to name the specific surface (e.g. "Update `/api/checkout` reference docs"). |
| Risk score doesn't reflect actual risk | Score is paired with a transparent signal list; readers can audit. |

### 5.9 Demo mode (no API key)

When `ANTHROPIC_API_KEY` is absent at server start, the API route switches to demo mode and serves one of three pre-cached `Analysis` JSON blobs based on the input URL (or a default). The pre-cached PRs are chosen to demonstrate different shapes:

- A frontend PR with all weight in UI and minimal Business.
- A backend behavioral PR with all weight in Business and Data, no UI.
- A mixed feature PR (the `installments` example) touching all four dimensions.

The cache files live in `lib/demo-mode/*.json` and are loaded synchronously. This path exists primarily for the evaluator: zero-config, zero-cost, instant render.

---

## 6. API design

One endpoint, one method.

### `POST /api/analyze`

**Request body:**
```json
{ "url": "https://github.com/owner/repo/pull/123" }
```

**Response (success):**
```json
{
  "analysis": { /* Analysis schema, see §5.3 */ },
  "meta": {
    "source": "live" | "demo",
    "truncated": false,
    "fetchedAt": "2026-05-13T13:42:11Z"
  }
}
```

**Response (error):**
```json
{
  "error": {
    "code": "PR_NOT_FOUND" | "RATE_LIMITED" | "PR_TOO_LARGE" | "LLM_FAILED" | "INVALID_URL",
    "message": "Friendly message for the UI to display."
  }
}
```

Errors are typed because the UI renders different states for each. Generic 500s are an MVP smell, not a production pattern.

---

## 7. Frontend architecture

### 7.1 Page tree

```
app/
├── page.tsx              ← URL input, calls /api/analyze, renders Analysis or error
├── layout.tsx            ← global wrapper, fonts
├── globals.css           ← tailwind directives + a few resets
└── api/
    └── analyze/
        └── route.ts      ← the only API endpoint
```

### 7.2 Component tree

```
<Page>
  ├── <UrlInput />                   (visible when no analysis loaded)
  ├── <LoadingState />               (visible during fetch)
  ├── <ErrorState />                 (visible on error)
  └── <Analysis>                     (visible when loaded)
      ├── <TopBar />
      └── <Layout>
          ├── <Main>
          │   ├── <PrHeader />
          │   ├── <TabBar />         (renders + sets active tab)
          │   └── <TabContent>
          │       ├── <UiChangeView />
          │       ├── <ApiChangeView />
          │       ├── <DataChangeView />
          │       └── <BusinessChangeView />
          └── <Sidebar>
              ├── <RiskPanel />
              ├── <RiskAssessment />
              └── <ActionItems />
```

State held at the `<Analysis>` level:
- `activeTab: TabId`
- `verdict: Verdict | null`
- `verdictTimestamp: Date | null`
- `reviewers: Reviewer[]` (initially from response; user's verdict appends)

No global state. No context. Props down, callbacks up.

### 7.3 Why no streaming in MVP

Streaming the LLM response would be a nice UX win (the title appears first, then the risk panel, then the tabs as they classify). But it requires:
- Server-sent events or a streaming response from the API route.
- Client logic to render partial states without flicker.
- Schema validation that tolerates partial structures.

This is a 2-3 hour build by itself and was deprioritized. The MVP shows a calm loading state with progress indicators and renders the full analysis in one paint when ready.

---

## 8. Security and privacy

### 8.1 What flows where

- The PR URL flows from browser to our server.
- The PR diff flows from GitHub to our server, then to Anthropic.
- The analysis flows from Anthropic to our server to the browser.

### 8.2 Risks

| Risk | Status |
|---|---|
| API keys leaked to browser | Mitigated. All third-party calls are server-side; no keys are in client bundles. |
| Sensitive code shipped to Anthropic | Acknowledged. The product is only useful for code people are willing to send to an LLM. MVP supports public repos only, which are already public. |
| Prompt injection from PR contents (e.g. a malicious commit message that instructs the LLM to lie) | Mitigated by structured output (the LLM must call our tool with our schema; prose injection has no surface). Residual risk: an injected commit could manipulate field *values*. Not addressed in MVP. |
| Data retention by Anthropic | Anthropic's standard API has zero data retention by default. No additional handling required. |

### 8.3 What we do not log

- Raw diffs.
- API responses with code content.
- User identifiers (there are none in MVP).

We log request timestamps, response durations, error codes, and aggregate token usage for cost monitoring. Nothing else.

---

## 9. Deployment

### 9.1 Local

```
git clone <repo>
cd pr-lens
npm install
cp .env.local.example .env.local      # optionally add ANTHROPIC_API_KEY
npm run dev
```

Without an API key, the app starts in demo mode automatically.

### 9.2 Hosted

Vercel deploy from main, with environment variables for `ANTHROPIC_API_KEY` and optionally `GITHUB_TOKEN`. No build customization needed.

### 9.3 Telemetry

None in MVP. Production adds:
- Server logs to Vercel's built-in logging.
- Error tracking via Sentry.
- Anonymous usage events (Plausible / PostHog) to validate which PRs people actually paste.

---

## 10. What's not built and why

| Capability | Why deferred |
|---|---|
| Private repo support | Requires OAuth + token management. Out of MVP scope. |
| Multi-PR inbox | This is a different product (PRD §5). |
| Slack integration | Strongly considered; deferred to v2 because Slack-bot setup eats the build budget. |
| Action execution (Linear, Slack, docs) | Each integration is a discrete chapter. Listing actions without executing them is honest about MVP scope. |
| Webhook-driven pre-analysis | Requires persistent storage and a webhook endpoint, both v2. |
| Caching layer | Implemented as a single in-memory map for now; production needs Redis or equivalent. |
| Per-organization analysis tuning | Each repo has its own conventions; learning them is a v2 capability requiring stored history. |
| Authentication and accounts | None of the MVP's surfaces require it. |
| Real-time collaboration on review | A PR-as-conversation surface; out of scope. |
| Mobile | Design considered (see Design Plan §4.5), not built. |
| Tests | LLM-driven UI needs golden-set evaluation, not unit tests. Out of MVP. |

---

## 11. Open technical questions

These are not blockers for the MVP but should be answered before any production rollout.

1. **Caching strategy.** In-memory works for one server; multiple servers require a shared cache. Redis is the default answer; Vercel KV or Cloudflare Workers KV are simpler if the deployment is on those platforms.
2. **Streaming LLM response.** Worth the engineering cost to bring perceived latency from 12s to 2s? Probably yes for v2.
3. **Golden-set evaluation.** How do we measure analysis quality? Hand-labeling 50-100 PRs, then comparing against future model output. Whose labels? PMs? Engineers? Both?
4. **Fine-tuning vs. prompting.** Sonnet handles the workload at acceptable quality. Is there value in a fine-tuned smaller model? Probably not until volume justifies it.
5. **Pricing model.** If this becomes a product, is it per-user, per-PR, per-repo? PR Lens makes the most sense as a per-organization SaaS, billed by repo connected.
6. **Self-hosted option.** Large enterprises will not send code to a SaaS. Open-source the client + bring-your-own LLM-key is a credible path.
