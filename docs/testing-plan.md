# Testing Plan — PR Lens

The minimum testing setup to start. Optimized for fast feedback on the deterministic core (where most of the value and risk lives) and for TDD-friendly cycles. Heavier testing (E2E, visual regression) is deliberately deferred.

---

## 1. Stack

| Layer | Tool | Why |
|---|---|---|
| Test runner | **Vitest** | Fast, ESM-native, plays nicely with Next 16 + bun, one runner for everything |
| DOM | **happy-dom** | Lighter than jsdom, fast startup |
| Component testing | **@testing-library/react** + **@testing-library/jest-dom** | Standard, behavior-focused matchers |
| TypeScript | (already configured) | Vitest reads `tsconfig.json` paths automatically |
| E2E | _Not yet._ Add Playwright later if the analysis page itself needs end-to-end coverage. The screenshotter service uses Playwright separately. | Avoid pulling in browser orchestration before there's a user-facing flow worth E2E-ing |

**Why not Jest:** heavier config, slower, no real upside over Vitest here.
**Why not `bun test`:** RTL + React 19 + happy-dom story is still rougher than Vitest. Re-evaluate in a few months.

---

## 2. What to test (by priority)

### Tier 1 — Pure logic (test from day one)

These are the highest-value, lowest-friction tests. Pure functions over data — TDD them.

- `_lib/score.ts` — `scoreRisk(signals) → { score, level }`. Pure, deterministic, easy table-driven tests.
- `_lib/eligibility.ts` — repo conformance booleans. Input: file presence + content; output: pass/fail + reasons.
- `_lib/pillars/data.ts` — Prisma migration parser. Input: SQL string; output: structured diff. Snapshot or table-driven.
- `_lib/pillars/api.ts` — OpenAPI diff classifier (wraps `oasdiff` output). Test the classification layer, not `oasdiff` itself.
- `_lib/pillars/ts.ts` — ts-morph surface diff. Test the public-API extraction logic on small TS fixtures.

### Tier 2 — Boundaries with mocks

- `_lib/github.ts` — `getPR`, `getFiles`, `getFileContent`. Mock `fetch`. Test success, 404, rate-limit, malformed payload.
- `_lib/analyze.ts` — pipeline orchestrator. Mock the pillars; assert they're called in the right order and the aggregator merges outputs correctly.
- `_lib/cache.ts` — KV wrapper. Mock the KV client; assert cache key shape and TTL.

### Tier 3 — UI components (sparingly)

The PRLens view components are mostly data-in/JSX-out — typecheck already catches most regressions. Test only:

- Components with branching behavior (e.g., a panel that switches between `BeforeAfter` and `Empty` states).
- Components with user interaction (tabs, expandable sections).

**Do NOT test:** pure presentational components (`SectionHeader`, `WarningBanner`, `HighlightedText`). Their failure mode is visual — covered by manual review or future Playwright snapshots.

### Tier 4 — Not yet

- E2E of the analysis page (Playwright). Add when the dynamic route + at least one pillar is wired end-to-end.
- Visual regression. Defer indefinitely; the product itself does visual diffs, eat your own dog food.
- LLM output. Untestable directly; rely on citation enforcement + eval suite (step 14 in tech-plan).

---

## 3. File conventions

Co-located, suffix `.test.ts(x)`.

```
app/_lib/
├── score.ts
├── score.test.ts
├── eligibility.ts
├── eligibility.test.ts
├── pillars/
│   ├── data.ts
│   └── data.test.ts
```

```
app/_pages/PRLens/components/
├── ChangeTabs.tsx
└── ChangeTabs.test.tsx
```

Fixtures live in `app/_fixtures/` and are imported by tests.

---

## 4. Workflow

Follow the `tdd-discipline` skill for new behavior:

1. Red — one failing `it()` block.
2. Green — minimal code; `bun run lint` and `bun run build` pass.
3. Refactor while green.

Follow the `bdd-acceptance-criteria` skill when planning a non-trivial pillar or pipeline change — list Given/When/Then scenarios in the PR description and turn each into a test.

---

## 5. Setup (one-time)

### Install

```bash
bun add -d vitest @vitejs/plugin-react @testing-library/react @testing-library/jest-dom @testing-library/user-event happy-dom @types/react @types/react-dom
```

### `vitest.config.ts` (repo root)

```ts
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'happy-dom',
    globals: true,
    setupFiles: ['./vitest.setup.ts'],
    include: ['app/**/*.test.{ts,tsx}'],
  },
  resolve: {
    alias: { '@': resolve(__dirname, '.') },
  },
});
```

### `vitest.setup.ts` (repo root)

```ts
import '@testing-library/jest-dom/vitest';
```

### `tsconfig.json` — add `vitest/globals`

```jsonc
{
  "compilerOptions": {
    "types": ["vitest/globals"]
    // ... existing options
  }
}
```

### `package.json` scripts

```jsonc
{
  "scripts": {
    "test": "vitest",
    "test:run": "vitest run",
    "test:ui": "vitest --ui"  // optional, only if installed
  }
}
```

---

## 6. First targets (in order)

1. **`score.test.ts`** — table-driven. Cover: empty signals (base score), single-signal weights, clamping at 0 and 100, level thresholds (Low/Medium/High boundaries). Fastest possible "is the setup working" test.
2. **`eligibility.test.ts`** — given a fake file-tree, returns the right `{ eligible, missing[] }` shape. Cover each missing-requirement branch.
3. **`pillars/data.test.ts`** — parse a handful of representative Prisma migration SQL snippets (new table, added column, dropped column, rename). Snapshot the structured output.

Stop after these three. They give the deterministic core a safety net and validate the whole tooling chain. Add more as the pipeline grows.

---

## 7. Anti-goals

- **No coverage threshold.** Solo project, premature gate. Revisit if a second contributor joins.
- **No test for every component.** Typecheck + manual review + the product's own visual diff = sufficient for now.
- **No mocking of `oasdiff` internals or the ts-morph AST.** Test the wrapper, not the library.
- **No "integration tests that boot Next."** If something only breaks when Next boots, fix it manually — adding `next-test-runner`-style infra is overkill for MVP.
