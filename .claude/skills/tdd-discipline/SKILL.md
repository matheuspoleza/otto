---
name: tdd-discipline
description: Strict Test-Driven Development workflow (Red → Green → Refactor) for writing reliable code one behavior at a time. Use when adding new features, fixing bugs with a reproducible failure, or asked to "write tests first" / "do TDD" / "test-drive this".
---

# TDD Discipline — One Test at a Time

Strict Red → Green → Refactor. One behavior per cycle. No batching tests.

---

## The Cycle

1. **Red** — Write exactly ONE failing `it()` block describing a single behavior.
2. **Green** — Write the MINIMAL code to make it pass. Green means ALL of:
   - Test passes
   - `bun run lint` is clean for changed files
   - TypeScript compiles (`bun run build` or editor diagnostics)
   - If any of these fail, you are NOT green. Fix before moving on.
3. **Refactor** — Clean up production and test code while keeping everything green.
4. **Repeat** — Next behavior, back to step 1.

---

## Rules

- **Never** write multiple tests before implementing.
- **Never** write production code without a failing test driving it.
- Each cycle handles **one** behavior — not a batch.
- Run the test after every change to confirm red/green state.
- Tests are the specification: if it's not tested, it doesn't exist.
- Before pushing: run the full quality gates.

---

## Quality Gates (pre-commit)

For this Next.js project:

- `bun run lint` — ESLint clean
- `bun run build` — typecheck + build pass
- All tests pass

Never push code that fails any of these. No `@ts-ignore`, no `as any`, no `.skip`, no `--no-verify`.

---

## When to Bend the Rules

TDD is a discipline, not a religion. Bend it when:

- **Spike / exploratory code** — when you don't yet know the shape of the solution. Throw the spike away, then TDD the real implementation.
- **Pure UI tweaks** — visual changes (spacing, colors, copy) don't need a failing test first. Verify in the browser.
- **Config / dependency / typo changes** — no behavior change, no test needed.

If a change has behavior, it gets a test. If you're tempted to skip the test "just this once", that's the moment to write it.

---

## Bug Fixes

Every bug fix:

1. Write a failing test that reproduces the bug (red).
2. Fix the code (green).
3. The test stays as a regression guard.

If you can't write a failing test for the bug, you don't yet understand the bug — keep investigating.

---

## Type-Level TDD

For type-safety guarantees:

1. **Red** — Write `@ts-expect-error` on a wrong-shaped call. If the directive is "unused" the test fails.
2. **Green** — Tighten the type so the compiler rejects that call. Directive now needed → test passes.
3. **Refactor** — Clean up types while tests stay green.

Positive type tests alone aren't valid red tests — loose signatures already accept them. Write negative tests (with `@ts-expect-error`) first.

---

## Anti-Patterns

| Anti-pattern | Why bad |
|---|---|
| Writing 10 tests then implementing | Lose the feedback loop; tests drift from intent |
| Implementation first, tests after | Tests just rubber-stamp the code, not specify it |
| One `it()` with five assertions | Failure message tells you nothing about what broke |
| Skipping the refactor step | Code rot accumulates |
| Lint/typecheck failures "I'll fix later" | Not green. Fix now. |
