# PRD — PR Lens

**Status:** Discovery → MVP scope locked
**Last updated:** May 2026
**Owner:** Matheus
**Reviewers:** —
**Source brief:** [Assignment](./assignment.md) (Scrunch take-home — 2–3h build, one core flow, mock data OK)

---

## 1. Problem

A pull request is the unit of change in modern software, but the artifact GitHub gives us is built for one audience: the engineer who can read code. Everyone else marked on a PR — product managers, support agents, QA leads, designers, dev rel, security, customer success — has to either translate the diff themselves, ask the author, or skip the review.

The result, in any team with non-trivial cross-functional collaboration:

- PMs don't actually read PRs they're tagged on. They wait for the engineer to summarize.
- Support finds out about behavior changes through customer tickets, not before deploy.
- QA writes test plans from Slack messages, not from the change itself.
- Designers approve UI work via screenshots posted manually, not from the PR.
- Dev rel learns about API changes after they're already shipped.

The shared failure mode is the same: **the PR exists, but its meaning is locked behind code literacy**.

This is not a new problem — it has been a constant in any cross-functional team — but two things have made it acute in 2025–2026:

1. **AI-generated code** is now responsible for a meaningful share of merged PRs. Diffs are larger, more numerous, and increasingly authored by people (including PMs themselves, via tools like Cursor and Sweep) who can't always defend the details.
2. **AI summarization** has flooded the market with tools that paraphrase diffs in plain language — CodeRabbit, Greptile, Copilot Code Review, Cursor Bugbot, Qodo. But these tools are built for *the next engineer*. They produce file-by-file walkthroughs in prose, optimized for code review, not for stakeholder comprehension.

So the situation today is: more PRs than ever, with more summarization than ever, and still no good answer for what a non-engineer should *do* about a given change.

## 2. Audience

Primary audience: **the cross-functional stakeholder tagged on a PR**, defined by job rather than title.

The job: read the change, decide what it means for my function, take the actions that fall to me.

This includes PMs, support agents, QA engineers, designers, tech writers, dev rel, security/compliance, customer success, and increasingly the authors themselves — engineers who didn't write the specific code (AI did) and need to verify it as if reviewing someone else's work.

Secondary audience: **engineers who triage PRs without reviewing them in depth**. Staff/principal engineers tagged on more PRs than they can read are functionally non-technical readers for most of them, applying heuristics to decide which deserve attention.

Out of scope: **the engineer reviewing their own teammate's code line by line**. This audience is well served by GitHub-native review, CodeRabbit, Greptile, etc. Going after them would be a frontal assault on a saturated market with no differentiation.

## 3. Jobs to be done

When a stakeholder opens a PR, they're asking, in order:

1. **Does this affect me?** — Filter. Binary. Should take ≤3 seconds to answer.
2. **How much should I care?** — Calibration. Numeric or categorical.
3. **What actually changed?** — Comprehension. Detail on demand.
4. **What do I do next?** — Action. Concrete, owned, time-boxed.

This is an inverted pyramid: each step is shorter than the next, and the user exits as soon as they've answered the question that matters to them. Skipping early steps causes harm (PRs go unread); over-investing in late steps wastes attention.

The product must answer all four. Existing tools mostly answer step 3, which is the least valuable of the four because it's where the existing PR diff already lives.

## 4. Product thesis

> A pull request describes a change to a system. The same change has different meanings for different audiences, and the medium that carries those meanings should not be a paragraph of prose.

Operationally, this means:

1. **Classify the change**, don't summarize the diff. A typed classification (what kind of change is this, in what part of the system, with what blast radius) is more useful than a fluent paragraph that paraphrases code.
2. **Show before/after, not narration**. Humans process visual difference orders of magnitude faster than they process descriptive text. Where the change is visual, show pixels. Where the change is structural (schema, API), show structure. Where the change is behavioral (rules), show the rule.
3. **End with action**. The PR is not the destination; it is the cause of work that needs to happen elsewhere — docs to update, channels to notify, scenarios to test, customers to inform. The product names these and (eventually) executes them.

The differentiator vs. the existing AI PR review category is **typed extraction over prose summarization**, and **outcome-oriented framing over code-oriented framing**.

## 5. MVP scope

A single page that takes one PR (mocked, then real) and renders:

- **PR header**: title, one-sentence subtitle in product language, author and merge state, reviewer history (avatars + verdict + timestamp).
- **Risk panel**: numeric score (0-100) with categorical label (Low / Medium / High), domain tags, and bulleted risk assessment with signals (warnings and positive indicators).
- **Change tabs**: four typed categories — UI, API, Data, Business — each with a count badge and an empty state when no changes of that type exist.
- **Before/after content per tab**: visual mockup for UI, JSON diff for API, schema diff for Data, rule comparison for Business. Each tab also includes an "impact" note describing the practical consequence of the change.
- **Actionable items**: a small list of follow-up actions with urgency tags ("Before deploy" / "This sprint" / "Before release").
- **Review controls**: Accept / Deny / Flag concern, with state persistence (post-review pill with undo, modeled on the Chromatic pattern).

The MVP runs against **one real PR fetched live from GitHub**, classified by Claude via a structured-output API call. A fallback "demo mode" with pre-cached PRs lets the app render without an API key.

### Explicitly out of MVP

- Multiple PR views or any inbox
- Per-profile (PM / Support / QA / Designer) view switching — the product is designed to make profile *emerge* from the tabs the user clicks, not be declared upfront
- Comment threads or chat
- Real action execution (creating Linear issues, posting to Slack, drafting changelog entries) — actions are listed but not executed
- Repository-aware history (PR patterns, file ownership) — useful but requires deeper integration
- Authentication, accounts, persistence

## 6. Success metrics (proposed, not validated)

For a hypothetical production rollout, the metrics that would matter:

- **Time to first review action.** From the moment a stakeholder receives notification to the moment they take an action (Accept / Deny / Flag, or one of the suggested follow-ups). Target: under 90 seconds for low-risk PRs.
- **Coverage of cross-functional reviewers.** Percentage of PRs that get at least one non-engineer review action before deploy. Today this number is near zero in most teams.
- **Catch rate of high-impact changes by non-engineers.** Subjective, measured via post-incident review: of incidents caused by PRs that had been merged, what percentage had a Flag concern from the right stakeholder beforehand?
- **Action follow-through.** Of suggested actionable items, what percentage actually happen within the recommended window?

The first metric is the cheapest and most honest to instrument. The third is the holy grail.

## 7. Competitive landscape

The market is loud and saturated in adjacent categories. The exact niche this product targets is genuinely under-served.

**Saturated and not competitive with this product:**

- *AI PR reviewers for engineers*: CodeRabbit, Greptile, GitHub Copilot Code Review, Cursor Bugbot, Qodo, Sourcegraph Cody. All produce engineer-facing prose summaries plus line-level comments. Strong category, well-funded, not what we're doing.
- *Changelog and release-note publishers*: LaunchNotes, Beamer, AnnounceKit, Released, Olvy, Headway. These solve publishing once the content has been written. They don't help write it from raw PRs.
- *Slack/Teams PR bots*: Axolo, Toast.ninja, Pullflow, the official GitHub app. Compress notification noise; do not address comprehension.

**Adjacent and partially overlapping:**

- *Visual regression tools*: Chromatic, Percy, Argos. The closest existing primitive for non-engineer review, but UI-only. Chromatic in particular markets explicitly to mixed teams ("designers and product managers can browse without checking out code") and is the inspiration for the Accept / Deny review pattern in this product.
- *Linear and Jira PR sync*: link PR status to tickets, but only sync metadata, not content meaning.

**Genuine white space:**

- *Typed change classification for non-technical audiences.* No commercial product takes a PR and emits a structured artifact ("user-visible behavior change," "breaking API," "data schema change," with audience-specific framing) tied back to the diff. This is the wedge.

## 8. Risks and open questions

### Product risks

- **The categorization may not be sharp enough.** "UI / API / Data / Business" is the working taxonomy; a single PR can touch all four and the dimensions can overlap (an API change is often a Business rule change). We accept this overlap as cost for keeping the categories vocabulary-light.
- **Risk score is heuristic.** A single number (0-100) is precise-looking but heuristic underneath. The Risk Assessment list mitigates this by exposing the signals that produced the score; a future version may expose probability × magnitude × reversibility separately.
- **"Affects" inference was cut.** An earlier draft included an explicit "who is affected" panel (Support / PM / QA / Designer). We cut it on the argument that affected audiences are implicit in the change content — a clear UI change addresses Design without needing to be told. This is a bet; if user testing shows non-engineers don't make the inference, we add it back.

### Technical risks

- **LLM output quality varies by PR shape.** Diffs that touch many file types, very large diffs, or diffs in unusual languages may produce lower-quality classifications. Mitigation: explicit "unknown / not classified" states rather than confident-but-wrong output.
- **Latency.** Claude takes 5-15 seconds for medium PRs. Acceptable for first-load; bad for repeated use. Caching is a v2 requirement.
- **PR access.** Reading public PRs is free via GitHub's REST API without auth. Private PRs require an OAuth flow, which is out of scope for the MVP.

### Open product questions

- **Should the product live where the user already is, or pull them to a new surface?**
  Strong argument for Slack: notifications already arrive there. Strong argument against: every Slack-bot demo runs in 5 hours and shows worse than a 30-second web demo. MVP is web. A Slack bot remains the obvious v2 surface.
- **Authoring vs. reading.**
  The product treats PRs as something to *read*. A more ambitious version would augment the *authoring* moment, prompting engineers to provide intent and impact data while writing the PR. The reading-side product is the bet for v1 because it doesn't require engineer behavior change.
- **Per-profile views.**
  Discovery surfaced strong arguments for per-profile lenses (PM view / Support view / QA view of the same PR). MVP chose typed tabs instead, on the argument that profiles emerge from clicks. If this proves wrong in user testing, the model can be extended without restructuring the data.

## 9. Timeline (for context, not commitment)

This product was scoped against a 2-3 hour build constraint as part of a hiring exercise (full brief: [assignment.md](./assignment.md)). The constraint shaped meaningful product decisions: cutting profile switching, cutting Slack integration, cutting comment threads, cutting authentication. The decisions documented here are honest reductions, not aspirational placeholders — each was considered and intentionally deprioritized with the trade-off named.

A production build of the MVP described here would be roughly two to four weeks of focused engineering work for one person.
