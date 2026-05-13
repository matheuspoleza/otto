# Assignment — Source Requirements

**Source:** Scrunch take-home assignment
**Captured:** May 2026
**Purpose:** Original brief, preserved verbatim. All downstream docs ([PRD](./prd.md), [Design & UX Plan](./design-ux.md), [Technical Discovery](./technical-discovery.md), [Tech Plan](./tech-plan.md), [Testing Plan](./testing-plan.md)) trace back to this.

---

## Objective

Build something real.

We're evaluating:

- Your ability to ship
- Your product judgment
- Your UX thinking
- How you use tools (including AI)

## The Task

Build a simple tool that helps a user understand changes in a GitHub pull request.

Assume the user:

- Didn't write the code
- Doesn't want to read the full diff
- Needs to quickly understand what changed and if they should take action

## Constraints

- Time box: 2–3 hours max
- One core flow only
- Mock data is fine
- Must be runnable

## UX Requirement

A new user should:

- Understand what changed within 10 seconds
- Know what to do next without explanation

## Submit

- Working project
- 3–5 min Loom covering:
  - What you prioritized
  - What you cut
  - What you'd improve

## How We Evaluate

- **Build:** Did you actually ship something real?
- **Product Judgment:** Did you focus on what matters?
- **UX:** Is it clear, simple, and usable?
- **Speed:** Did you make good tradeoffs within the time?
- **Leverage:** Did you use tools/AI to move faster?

## What Gets Rejected

- No working product
- Overly complex builds
- Generic or unclear use case
- No explanation of decisions
- Ignoring UX entirely

## What Stands Out

- Simple, working product
- Clear UX and flow
- Strong tradeoffs
- Fast execution
- Smart use of AI

## Final Note

Most candidates overcomplicate this. The best submissions are simple, focused, and shipped quickly.

---

## How this brief shaped the product

The constraints above drove specific decisions in the [PRD](./prd.md). Mapping each constraint to the cut or commitment it produced:

| Brief constraint | Resulting decision |
|---|---|
| "Time box: 2–3 hours" | Cut auth, accounts, persistence, multi-PR inbox, profile switching, Slack integration, comment threads, real action execution. See PRD §5 "Explicitly out of MVP". |
| "One core flow only" | Single-page experience: one PR → one verdict. No navigation, no settings. |
| "Mock data is fine" | Demo mode with pre-cached PRs as the default render path; live GitHub fetch + Claude classification as a progressive enhancement. |
| "Understand what changed within 10 seconds" | Risk panel (score + label + tags) above the fold; typed change tabs instead of file-by-file diffs. See PRD §3 (jobs to be done) and §4 (product thesis). |
| "Know what to do next without explanation" | Actionable items list with urgency tags; Accept / Deny / Flag controls modeled on the Chromatic review pattern. |
| "Smart use of AI" | Claude structured-output for change classification, not prose summarization — the explicit differentiator vs. CodeRabbit/Greptile/etc. See PRD §7. |

The audience choice (cross-functional stakeholders, not engineers reviewing teammates' code) is not constrained by the brief — it's a product bet documented in PRD §2 and §7.
