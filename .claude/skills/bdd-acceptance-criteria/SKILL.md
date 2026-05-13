---
name: bdd-acceptance-criteria
description: Write BDD-style acceptance criteria using Given/When/Then scenarios for features, tests, and design docs. Use when writing tests, defining requirements for a new feature, planning a non-trivial change, or asked to "add acceptance criteria".
---

# BDD Acceptance Criteria

Use Given/When/Then scenarios to make requirements executable and testable. Keep it lightweight — this is a guide, not bureaucracy.

---

## When to Use BDD

**Use BDD scenarios for:**
- Non-trivial features (anything with branching behavior)
- Test files for components, hooks, route handlers
- Design notes or implementation plans
- API surface changes

**Do NOT use BDD for:**
- Typo fixes, config tweaks, dependency bumps
- One-off scripts
- Anything where a simple checklist or single assertion is clearer

---

## Format

Vitest/Jest-compatible Given/When/Then in `describe` / `it` blocks:

```typescript
describe('Feature: Task creation', () => {
  describe('Given an authenticated user', () => {
    describe('When POST /api/tasks is called with a valid payload', () => {
      it('Then returns 201 with the created task', () => {
        // ...
      })
    })
  })
})
```

### Structure Rules

1. **Nest logically:** Feature → Given state → When action → Then outcome
2. **One behavior per `it`:** each test verifies a single outcome
3. **Present tense:** "returns" not "will return"
4. **Be specific:** "returns 401 with `{ error: 'unauthorized' }`" not "handles auth"

---

## Writing Good Scenarios

### One behavior per scenario

```typescript
// BAD — multiple behaviors in one test
it('validates input, returns errors, and logs the failure', () => {})

// GOOD — split
it('returns validation errors for invalid input', () => {})
it('logs validation failures', () => {})
```

### Concrete examples over abstractions

```typescript
// BAD
describe('Given invalid data', () => {
  it('then handles it correctly', () => {})
})

// GOOD
describe('Given a task payload with empty title', () => {
  describe('When POST /api/tasks is called', () => {
    it('then returns 400 with { error: "title is required" }', () => {})
  })
})
```

### Cover happy path AND error paths

Every feature gets both:

```typescript
describe('Feature: Authentication', () => {
  describe('Given valid credentials', () => {
    describe('When signIn() is called', () => {
      it('then returns a session token', () => {})
    })
  })

  describe('Given invalid credentials', () => {
    describe('When signIn() is called', () => {
      it('then returns AuthError', () => {})
    })
  })
})
```

### Reference real names

Use actual function, route, or component names from the codebase — not generic placeholders.

```typescript
// BAD
describe('When processing user input', () => {
  it('works correctly', () => {})
})

// GOOD
describe('When createTask() is called with missing title', () => {
  it('then throws ValidationError("title is required")', () => {})
})
```

---

## Use as Acceptance Criteria

When planning a non-trivial feature, list the BDD scenarios upfront — they become the first tests you write (red phase).

```markdown
## Acceptance Criteria

```typescript
describe('Feature: Task list filter', () => {
  describe('Given a list with mixed-status tasks', () => {
    describe('When filter is set to "done"', () => {
      it('then only renders tasks with status === "done"', () => {})
      it('then preserves the original list order', () => {})
    })
  })

  describe('Given an empty task list', () => {
    describe('When the filter UI mounts', () => {
      it('then renders the empty state, not the filter chips', () => {})
    })
  })
})
```
```

Feature is done when all scenarios pass.

---

## Common Mistakes

| Mistake | Why bad | Fix |
|---|---|---|
| Testing implementation details | Brittle, breaks on refactor | Test observable behavior |
| Multiple assertions per `it` | Unclear what failed | One `it` = one outcome |
| Missing error cases | Incomplete coverage | Always include failure paths |
| "should" everywhere | Ambiguous | Use "then" for outcomes |
| Abstract scenarios | Not actionable | Concrete inputs/outputs |
| No Given state | Unclear context | Always specify preconditions |
