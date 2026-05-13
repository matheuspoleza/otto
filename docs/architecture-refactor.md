# Architecture Refactor — Post-UX-Revision

**Status:** Proposal, not yet implemented
**Last updated:** May 2026
**Owner:** Matheus
**Linked docs:** [Tech Plan](./tech-plan.md), [UX Review](./ux-review.md), [UX Revision — Diagram](./ux-revision-diagram.md)
**Supersedes:** the data-shape and pipeline sketches in [Tech Plan §3–§5](./tech-plan.md)

---

## 1. Why this refactor

The UX revision removed Risk Assessment, Actionable Items, the tab navigation, and the per-pillar Change Views. What remained is a three-surface UI: **diagram + change index + focused overlay**.

The current architecture still reflects the tab-era assumptions:

- `PRDiagramData` carries `risk`, `actions`, per-pillar `count` and `warning` — all dead in the new UI.
- The same conceptual "change" lives in three parallel places: `changes.{pillar}.{specificField}[]`, `changeIndex[]`, and `overview.nodes[]`. They are kept in sync by id convention (`page:`, `api:`, `table:`, `business:`).
- `FocusedChange.tsx` parses ids as strings to navigate between the three representations.
- `buildOverview` is the projection step but calls `traceStaticEdges`, which does I/O — so the projection isn't pure, isn't sync, and isn't independently testable.
- The LLM tool schema asks for 6 fields. After the cuts, only 1–2 are actually consumed by the UI.

This document captures the architecture we should converge on, the data shapes that come with it, and the order of operations to get there safely.

---

## 2. The shape of the new architecture

Three layers, with clear contracts between them:

```
[GitHub]
   │
   ▼
Fetcher  ──→  PRDiff
   │
   ▼
Extractors (parallel, each cacheable by sha)
   ├─ uiExtractor       → UIChanges
   ├─ apiExtractor      → APIChanges
   ├─ dataExtractor     → DataChanges
   ├─ businessExtractor → BusinessRules     ← LLM lives inside here
   └─ edgesExtractor    → Edges
   │
   ▼
Combiner  ──→  ChangeSet (Change[] + edges + meta)
   │
   ▼
Selectors (pure, parallel, multiple consumers)
   ├─ toDiagram   → DiagramModel
   ├─ toIndex     → IndexRow[]
   ├─ toDetail    → (changeId → Change)
   └─ toMarkdown  → string (for AI export)
   │
   ▼
UI
```

### 2.1 Three roles, three names

| Role | What it does | I/O? | Examples |
|:---|:---|:---:|:---|
| **Adapter** | Brings the outside world into our domain. Translates a contract we don't own. | Yes | `github.ts`, `pillars/api.ts` (OpenAPI), `pillars/data.ts` (Prisma DMMF) |
| **Extractor** | Reads a `PRDiff` and produces a specific dimension of fact. Composes adapters. | Yes | `uiExtractor`, `apiExtractor`, `dataExtractor`, `businessExtractor`, `edgesExtractor` |
| **Selector** | Pure function from canonical state to a view. Re-shape only. | No | `toDiagram`, `toIndex`, `toMarkdown` |

The vocabulary matters: when someone reads the name of a function, the name should tell them whether mutating that function risks crossing a foreign boundary (adapter), is doing analysis of input data with I/O (extractor), or is just a `.map()` over data we already own (selector).

### 2.2 Pipeline stages — what's in, what's out

| Stage | Stays | Cut |
|:---|:---|:---|
| Fetcher | One operation: get the raw PR + files from GitHub. | — |
| Extractor | Five parallel extractors, each producing a slice of fact. | — |
| Combiner | Folds extractor outputs into a single canonical `ChangeSet`. | — |
| Selectors | Pure projections, one per UI surface. | — |
| ~~Enrichment~~ | — | Was a stage. Collapses into `businessExtractor` (the only AI use left). |
| ~~Transformer~~ | — | Was implied by today's `buildOverview`. Becomes a Selector. |
| ~~Risk scoring~~ | — | All of `score.ts` except `deriveDomains`. UI no longer shows risk. |

---

## 3. The canonical domain: `Change[]`

Today's `PRDiagramData` has three parallel representations for the same conceptual entity. The refactor collapses them into one.

```ts
type ChangeStatus = 'added' | 'modified' | 'removed';

type Change =
  | { kind: 'page';  id: string; route: string;  name: string; status: ChangeStatus;
      preview: PagePreview;  detail: PageDetail }
  | { kind: 'api';   id: string; method: HttpMethod; path: string; status: ChangeStatus;
      preview: ApiPreview;   detail: EndpointDetail; ruleIds: string[] }
  | { kind: 'table'; id: string; name: string; status: ChangeStatus;
      preview: TablePreview; detail: TableDetail }
  | { kind: 'rule';  id: string; name: string; status: ChangeStatus;
      detail: RuleDetail;    attachedToId: string };

type ChangeSet = {
  meta: PRMeta;
  subtitle: string;
  domains: string[];
  changes: Change[];
  edges: Edge[];
};
```

Why this works:

- Each `Change` carries everything about itself: id, status, preview content, detail content. No second hop to find the detail.
- The diagram is `changes.filter(c => c.kind !== 'rule').map(toGraphNode)`. Rules attach as badges via `attachedToId`.
- The index is `changes.map(toIndexRow)`.
- The overlay is `changes.find(c => c.id === selectedId).detail`. No id parsing. The unreachable `ui:${file}` branch in `FocusedChange.tsx` disappears.
- Adding a new node kind (e.g., cron jobs, env vars) is one entry in the discriminated union + N selector handlers — no parallel arrays to keep in sync.

---

## 4. Where AI lives

After the UX revision cuts, the LLM tool schema produces six fields. Five are dead or marginal:

| Field | Consumer today | Verdict |
|:---|:---|:---|
| `subtitle` | PR header | Keep, or replace with deterministic extraction of the PR body's first paragraph |
| `businessRules` | Diagram badges + overlay + AI export | **Keep — only place AI does irreplaceable work** |
| `pillarDescriptions` | `formatPRForAI` only | Drop or move to on-demand |
| `pillarWarnings` | None | Drop |
| `signals` | None (was Risk Assessment) | Drop |
| `actions` | None (was Actionable Items) | Drop |

Result: **AI is a single extractor** (`businessExtractor`) that takes file samples and returns structured rules. The rest of the system doesn't know an LLM is involved — it just sees a `BusinessRules` result like any other.

Optional aggressive variant: make `businessExtractor` lazy. The cold-render path returns a `ChangeSet` with `rules: []`, and the LLM runs only when the user opens a rule badge or triggers the AI export. First paint of the diagram drops from ~10–20s to under 5s. Decision to defer until measured.

---

## 5. Why selectors instead of more pipeline stages

Two patterns we explicitly rejected:

### 5.1 Linear pipeline through a `DiagramModel` stage

Tempting because it's symmetric: every stage transforms one shape into another. But:

- The sidebar index and AI export don't want to go through the diagram shape. Forcing them through it imposes an irrelevant intermediate.
- A new consumer (hover-card, JSON export) is ambiguous: new stage, or selector? The rule isn't clear.
- It reintroduces today's problem in a new form — two canonical shapes (`ChangeSet` and `DiagramModel`) coexisting, kept in sync.

Selectors fan out from a single canonical state. New consumer = new selector, never a new stage.

### 5.2 An "Enrichment" stage on top of pillar outputs

This is what today's `analyze.ts` does — `enrichWithLLM` runs after pillars and amends multiple slices of the result. It looked correct when the LLM produced subtitle + signals + actions + descriptions + warnings + rules: a cross-cutting enrichment.

After the cuts, the LLM produces **one thing** the UI cares about: business rules. That's an extraction, not enrichment. Modeling it as a stage that runs across the pipeline is over-engineered for the actual work.

---

## 6. Naming discipline

The shape of names should match the shape of responsibilities:

- `PRDiff` is a real diff (git output). Keep the word.
- `UIChanges`, `APIChanges`, `DataChanges`, `BusinessRules`, `Edges` are extractor outputs. They are **classifications**, not diffs. No `Diff` suffix.
- `ChangeSet` is canonical state.
- `DiagramModel`, `IndexRow[]`, markdown export are **derived views**. They are projections of `ChangeSet`.

The previous data names (`OverviewGraph`, `ChangeIndexItem`, `changes.business.rules`) leak old assumptions — that there were tabs, that overview was a special view, that rules were a separate pillar peer to UI/API/Data. The new names should be neutral about presentation.

---

## 7. Caching and streaming implications

### 7.1 Cache by layer, not by package

Today: `'use cache'; cacheTag('pr:${owner}/${repo}/${pr.number}:${pr.head.sha}')` on the entire `analyzePR`. Refactoring the UI invalidates the I/O cache.

After: each extractor caches independently on `pr:${sha}:${extractor}`. The Combiner and Selectors are cheap pure work — no need to cache. UI changes don't invalidate fetches.

### 7.2 Streaming RSC (optional)

If first-paint matters, the page can stream:

```tsx
<Suspense fallback={<DiagramSkeleton />}>
  <DiagramSection promise={baseChangeSet} />          {/* pages + endpoints + tables — fast */}
</Suspense>
<Suspense fallback={<EdgesPlaceholder />}>
  <EdgesLayer promise={edges} />                       {/* static-trace — medium */}
</Suspense>
<Suspense fallback={<BadgesPlaceholder />}>
  <RuleBadges promise={businessRules} />               {/* LLM — slow */}
</Suspense>
```

Diagram appears with nodes in seconds; edges and rule badges hydrate in the background.

Not free — complicates the prop contract. Defer until cold-render time is measured and judged too slow with the simpler eager-but-slim version.

---

## 8. What this refactor does not change

- The four extractors (UI / API / Data / Business) and their analysis logic.
- Eligibility gate, rate limit, demo mode.
- The UX surface: diagram + index + overlay.
- The static-trace edge detection (just promoted from an internal step of `buildOverview` to a peer extractor).
- The `prdiagram.config.json` shape in target repos.
- `formatPRForAI` semantics — only the inputs it reads change.

---

## 9. Order of operations

Each step is independently shippable and leaves the app working. The earlier steps build the test net the later steps refactor against.

1. **Tests on the soft underbelly.** Add unit tests for `static-trace.ts`, `overview.ts`, `formatPRForAI.ts`. These are the files the refactor touches most and that have zero coverage today. Without this net, steps 4–7 are blind.
2. **Cleanup tier 1 — dead components.** Delete `APIChangeView`, `UIChangeView`, `DataChangeView`, `BusinessChangeView` (top-level exports), `SectionHeader`, `WarningBanner`. Move surviving sub-components (`EndpointDiff`, `ScreenshotComparison`, `*TableCard`, `BusinessRuleDiff`) into a `FocusedChange/` folder. Remove the unreachable `changedComponents` branch in `FocusedChange.tsx`.
3. **Cleanup tier 2 — shrink `PRDiagramData`.** Drop `risk`, `actions`, per-pillar `count` and `warning`. Drop `RiskAssessment`, `RiskSignal`, `ActionItem`, related types. Drop `getRiskDot` from `utils.ts` plus its tests. Update `analyze.ts` accordingly.
4. **Cleanup tier 3 — shrink the LLM contract.** Remove `signals`, `actions`, `pillarWarnings`, `pillarDescriptions` from the `emit_enrichment` tool schema. Keep `subtitle` and `businessRules`. Delete `validateActions`, `validateSignals`, related constants. Decide whether to keep `subtitle` from LLM or replace with deterministic `extractSubtitle`.
5. **Cleanup tier 4 — collapse `score.ts`.** With risk gone, only `deriveDomains` survives. Extract it to a small `domains.ts` (or fold into `analyze.ts`). Delete `score.ts` and `score.test.ts`.
6. **Introduce the `Change` union and `ChangeSet`.** Add the types in `types.ts`. Add a `combine.ts` (or rename `overview.ts`) with `combineExtractors(...) → ChangeSet`. Migrate the UI to read from `ChangeSet` instead of `changes.{pillar}` + `overview` + `changeIndex`.
7. **Promote static-trace to a peer extractor.** Move the edges call out of `buildOverview` to a parallel extractor in `analyze.ts`. The Combiner is now pure and sync.
8. **Introduce selectors.** Create `toDiagram`, `toIndex`, `toDetail`, `toMarkdown` as pure functions on `ChangeSet`. Replace ad-hoc lookups in the UI with selector calls.
9. **Reorganize the folder tree** to match the new shape (see [§10](#10-target-folder-layout)).

Each step has a clean rollback. Steps 1–5 are subtractive (safe). Steps 6–9 are constructive (need step 1's tests as safety net).

---

## 10. Target folder layout

```
app/
├── _lib/
│   ├── adapters/                 # speak to the outside world
│   │   ├── github.ts
│   │   └── openapi.ts            # if extracted from pillars/api.ts
│   ├── extractors/
│   │   ├── ui.ts
│   │   ├── api.ts
│   │   ├── data.ts
│   │   ├── business.ts           # LLM lives inside
│   │   └── edges.ts              # was static-trace.ts
│   ├── combine.ts                # extractor outputs → ChangeSet
│   ├── selectors/
│   │   ├── toDiagram.ts
│   │   ├── toIndex.ts
│   │   └── toMarkdown.ts         # was formatPRForAI.ts
│   ├── types.ts
│   └── eligibility.ts
├── _pages/PRDiagram/
│   ├── PRDiagram.page.tsx
│   ├── pr-diagram.utils.ts          # was utils.ts
│   ├── components/
│   │   ├── PRDiagramHeader.tsx
│   │   ├── PRMetaHeader.tsx
│   │   └── CopyForAI.tsx
│   ├── Overview/
│   │   ├── OverviewView.tsx
│   │   ├── OverviewDiagram.tsx
│   │   ├── OverviewNode.tsx
│   │   ├── BandNode.tsx
│   │   ├── nodePreviews/
│   │   │   ├── PagePreview.tsx
│   │   │   ├── ApiPreview.tsx
│   │   │   └── TablePreview.tsx
│   │   └── layout.ts
│   ├── ChangeIndex/
│   │   └── ChangeIndexList.tsx
│   └── FocusedChange/
│       ├── FocusedChange.tsx
│       ├── ApiEndpointDetail.tsx
│       ├── UIScreenshotDetail.tsx
│       ├── DataTableDetail.tsx
│       ├── BusinessRuleDetail.tsx
│       └── shared/
│           ├── BeforeAfterPanel.tsx
│           ├── HighlightedText.tsx
│           └── FullscreenImageModal.tsx
└── ...
```

---

## 11. Decisions made and tradeoffs accepted

| Decision | Considered | Chose | Why |
|:---|:---|:---|:---|
| Canonical state | Three parallel arrays (today); one `Change[]` union | Single `Change[]` | Eliminates string id-parsing; new node kinds are local edits |
| Diagram as data | Pipeline stage; selector | Selector | Other consumers (index, markdown) avoid an irrelevant detour |
| AI as a layer | Cross-cutting enrichment stage; one extractor among peers | Peer extractor | Only one field survives the cuts; not cross-cutting anymore |
| AI on cold path | Eager; lazy on demand | **Decide after measuring** | Today's cold render is ~15s. Eager-slim may be fast enough |
| Edge tracing | Inside `buildOverview` (today); peer extractor | Peer extractor | Restores purity of the Combiner; lets edges cache independently |
| Naming | `*Diff` everywhere; `*Model`/`*Changes` by role | Role-based | "Diff" only where there's an actual diff; names track responsibility |
| Cache granularity | Whole-analyze key; per-extractor key | Per-extractor key | UI refactors don't invalidate fetches |
| Streaming | Eager full payload; streaming RSC with Suspense | Eager for MVP; revisit | Complicates the prop contract; not worth until measured |
| Sub­title | LLM-polished; deterministic first paragraph | Deterministic, defer LLM | Removes the LLM call from the cold path entirely if rules go lazy |

---

## 12. Open questions

- **Lazy LLM cost vs. UX.** If business rules load after the diagram, do users notice the missing badges? Could badges fade in with a clear "loading rules…" affordance.
- **Per-extractor cache invalidation.** When the eligibility profile changes (e.g., new route added to `prdiagram.config.json`), which extractor caches stay valid? Probably all except `ui` — but worth confirming before splitting cache keys.
- **Single-PR vs. multi-PR future.** If we later want to compare two PRs or show a history, does the `ChangeSet` shape extend cleanly, or do we need a `ChangeSet[]` + diff layer? Worth sketching one hypothetical end state before finalizing the type.
- **Where does `subtitle` come from when LLM is lazy?** The current `extractSubtitle` heuristic picks the first prose paragraph. Good enough for a release-review header, or do we need polish? Decide by looking at real PR bodies from the demo repo.
- **`pillarDescriptions` for AI export.** If we drop them from the LLM contract, the markdown export loses per-pillar narrative. Do we miss it? Probably not — the per-change details already say what changed.
