# Design & UX Plan — PR Lens

**Status:** MVP design locked; open questions noted
**Last updated:** May 2026
**Owner:** Matheus
**Linked docs:** PRD (`01-PRD.md`), Technical Discovery (`03-Technical-Discovery.md`)

---

## 1. Design principles

Five principles drove every decision in this document. They are listed in priority order; later principles defer to earlier ones in any conflict.

### 1.1 The change has a shape; the UI should expose it, not narrate it

A pull request is structured: it touches files, schemas, endpoints, components. The dominant UX pattern in this category — paraphrasing the diff as prose — discards that structure and replaces it with a paragraph the reader has to parse linearly. We do the opposite: extract the change's typed shape (UI / API / Data / Business) and render each type in its native format.

Operational consequence: prose is a fallback, not a primary surface. If we can render before/after, we render before/after. If we can show a schema diff, we show a schema diff. Plain text appears only where the change is genuinely textual (a business rule statement, an impact note).

### 1.2 The reader's first 10 seconds decide the next 10 minutes

The hiring brief asked for "understand what changed in 10 seconds." Most stakeholders give a PR less than that. The first 10 seconds must answer: *does this affect me, and how much should I care?* — not *what specifically changed*.

Operational consequence: the highest-fidelity information lives in the spot most likely to be seen first. Risk score is on the top-right (the place eyes land after the title). Domain tags are next to it. Tab counts (UI 2 / API 3 / Data 2 / Business 1) communicate shape before content. Only after these signals does the reader engage with detail.

### 1.3 Saying "nothing changes for you" is a feature, not a failure

Most PRs do not affect most cross-functional stakeholders. A tool that always finds something to say is dishonest and trains users to ignore it. The UI must communicate emptiness clearly: tabs with zero count are visible but de-emphasized, signaling "you can skip this dimension."

Operational consequence: empty states are first-class. A PR that's pure refactor renders as "no user-visible changes" prominently, not as a four-tab dance where each tab apologizes for being empty.

### 1.4 The destination is action, not understanding

Understanding is the means. The outcome the product produces is *somebody doing the right next thing*: updating documentation, notifying support, drafting a changelog, adding a QA scenario. Every screen funnels toward action.

Operational consequence: actions are always visible (right sidebar), regardless of which tab is active. The review controls (Accept / Deny / Flag) capture the moment of decision. Future versions execute the actions directly.

### 1.5 No scroll; everything important fits in viewport

The discovery process surfaced this as a strong preference. A reader who has to scroll to see whether they care has already failed the 10-second test. The layout is calibrated to fit a desktop viewport (≥1280px wide) without vertical scroll in the chrome — only the active tab's content can scroll, and only if it overflows the height budget.

Operational consequence: every element earns its pixels. The sidebar is dense but bounded. The header is two lines (title + subtitle). The tabs are compact. The action list is capped at four items.

---

## 2. Information architecture

The screen is divided into three regions with distinct functions, mapped to the four-step inverted pyramid from the PRD.

```
┌─────────────────────────────────────────────────┬─────────────────────┐
│ TOP BAR (chrome)                                                      │
├─────────────────────────────────────────────────┼─────────────────────┤
│ PR HEADER                                       │ RISK PANEL          │
│ - Title                                         │ - Score (0-100)     │
│ - Subtitle (one sentence)                       │ - Categorical level │
│ - Author + merge state                          │ - Domain tags       │
│ - Reviewer history (avatars + verdicts)         │                     │
├─────────────────────────────────────────────────┤                     │
│ TABS BAR                          [Review now]  │ RISK ASSESSMENT     │
│ UI · API · Data · Business                      │ - Signal bullets    │
├─────────────────────────────────────────────────┤                     │
│                                                 │                     │
│ TAB CONTENT                                     │ ACTIONABLE ITEMS    │
│ - Section header (title + description)          │ - Icon + text       │
│ - Before / after panels (typed by tab)          │ - Urgency tag       │
│ - Impact note                                   │                     │
│                                                 │                     │
└─────────────────────────────────────────────────┴─────────────────────┘
```

### Region-to-question mapping

| Region | Question answered | Time to read |
|---|---|---|
| PR header + risk panel | "Does this affect me? How much should I care?" | 3-5 sec |
| Tabs bar (with counts) | "What kinds of changes are in this PR?" | 1-2 sec |
| Risk assessment + actionable items | "Why does this score? What do I do?" | 5-10 sec |
| Tab content (before/after) | "What specifically changed?" | 10-30 sec |

The 10-second budget is met by the first two rows together. Everything below is the next reader's choice to engage with.

---

## 3. Component inventory

### 3.1 PR header

- **Title** (18px, weight 500): the PR title from GitHub, optionally rewritten for clarity by the LLM if the GitHub title is unclear (e.g. `fix: thing` becomes `Fix double-charging on retry`).
- **Subtitle** (13px, secondary color): one sentence, generated by the LLM, in product language. This is the highest-leverage piece of writing in the product — see §5.1 below.
- **Meta line**: PR number (monospace), author (`@matheus`), merge state (`merged 2h ago` / `open` / `draft`). Comma-separated, secondary text.
- **Reviewer history**: a row of compact pills, each showing avatar (colored circle with initial) + name + role + verdict + relative time. Three to five reviewers fit comfortably; more wraps to a second line.

### 3.2 Risk panel (sidebar top)

- **Score**: large number (34px, weight 500). Single digit precision (e.g. 73, not 73.2).
- **Categorical label**: small text next to the score (Low / Medium / High), color-coded dot (green / amber / red).
- **Domain tags**: pill-shaped, neutral background, max 4 visible.

The score is heuristic and the label is the actionable summary. The two are presented as a pair so neither stands alone — the label tells the reader what to do; the number tells the reader the basis.

### 3.3 Risk assessment (sidebar middle)

- A list of 3-5 bullets, each prefixed with an icon (warning triangle in amber, check circle in green).
- Each bullet is one sentence, 6-12 words. Examples: "Breaking change for existing checkout integrations." / "12 tests cover the new payment paths."
- This list is the *transparency* of the score: a reader can audit why the score is what it is. Without it, the score is a black-box number and loses credibility instantly.

### 3.4 Actionable items (sidebar bottom)

- Up to 4 items, each with an icon, single-sentence text, and an urgency tag ("Before deploy" / "This sprint" / "Before release").
- Items are not interactive in the MVP; in production they would link to or trigger the action (open Linear issue, draft Slack message, etc.).

### 3.5 Tabs bar

- Four tabs: UI / API / Data / Business. Order is fixed — most-visible-to-user dimensions first.
- Each tab shows a count badge: number of distinct changes in that dimension.
- Active tab is underlined; count badge inverts (dark fill, light text).
- Tabs with zero count are de-emphasized (gray text, no underline, non-interactive).
- A small icon could prefix each tab in future versions (eye / API / database / scales), but the MVP relies on labels.

### 3.6 Tab content (per type)

The format inside each tab is canonical to the dimension. This is the single most important design decision in the product.

| Tab | Canonical format | Why |
|---|---|---|
| **UI** | Visual mockup of before / after states, side by side | Visual changes are visual. A screenshot or rendered mockup communicates in milliseconds what prose communicates in seconds. |
| **API** | JSON request/response, before / after, with added/removed lines highlighted | API consumers think in payloads. A real example outperforms a description. |
| **Data** | Schema view: column lists, type annotations, "added/modified/removed" badges | Schema changes have a shape that text destroys. Tabular rendering is native. |
| **Business** | Rule statement before / after, with parametric values (thresholds, percentages) highlighted | Business rules are sentences in form, but reduce to a small number of parameters that change. The format isolates those parameters. |

Each tab also includes:
- A section header (14px title, 13px description) explaining the dimension in plain language.
- An impact note in amber, prefixed with a warning icon, describing the practical consequence of the change. This is the bridge from "what changed" to "what to do."

### 3.7 Review controls

Modeled on Chromatic's Accept / Deny pattern.

- **Pre-decision**: a single primary button labeled "Review now" with a dropdown chevron. Clicking opens a small menu with three options:
  - ✓ Accept
  - ✕ Deny
  - ⚐ Flag concern
- **Post-decision**: the button is replaced by a colored pill showing the verdict ("You approved" / "You denied" / "You flagged a concern"), in green / red / amber respectively. The pill includes a small ✕ button to undo.
- The undo restores the pre-decision state immediately. There is no confirmation modal.

This pattern was chosen over alternatives (multiple buttons, checkbox-style sign-off per tab, comment-thread review) because:
- It mirrors a pattern users already know from Chromatic and similar tools.
- It separates the decision from the explanation (the explanation is the tab content itself).
- It captures intent in a single click with one-click reversibility.

---

## 4. States, interactions, and edge cases

### 4.1 Empty states

- **Zero-count tab clicked**: shouldn't be reachable (disabled), but if reached, renders "No [UI / API / Data / Business] changes in this PR" centered in the content area.
- **PR with no changes in any dimension**: shows a full-canvas empty state. "This PR doesn't appear to change behavior visible to your team." Single CTA: "View the technical diff on GitHub."
- **PR that hasn't been analyzed yet**: skeleton state with shimmer placeholders mimicking the final layout. Crucial for perceived performance during LLM call.

### 4.2 Loading states

The LLM call takes 5-15 seconds. The loading state must feel intentional, not broken.

- Show the PR header immediately (it comes from GitHub, instant).
- Show skeleton placeholders for the risk panel, tabs, and tab content.
- Animate a thin progress bar at the top during the LLM call.
- After 8 seconds without response, show a status message: "Analyzing the change…" → "Classifying changes…" → "Almost there…" — these are intentionally vague but reassuring.

### 4.3 Error states

- **PR not found / private**: "We couldn't access this PR. It may be private or the URL may be incorrect."
- **GitHub rate limit**: "GitHub temporarily blocked our request. Try again in a minute."
- **LLM failure**: "Analysis failed. The PR may be too large or unusual. View the technical diff on GitHub."
- **Partial failure** (some tabs classified, others not): render what worked, show "Unable to classify" on the rest, do not silently omit.

### 4.4 Reviewer history state changes

- When the current user clicks Accept / Deny / Flag, their avatar joins the reviewer history list with verdict and "just now" timestamp.
- When the current user undoes, the avatar is removed.
- The interaction is local-only in the MVP; in production it would sync to a backend.

### 4.5 Mobile

Not supported in the MVP. The product target is desktop, where PR review happens. A mobile design exists conceptually (stacked single-column, sidebar becomes a bottom sheet) but is not built.

---

## 5. Writing and tone

### 5.1 The subtitle is the highest-leverage sentence in the product

One sentence. ≤140 characters. Written in product language, not engineer language. The format the LLM is prompted to follow:

> [Audience] can now [do something different] / will see [a change] / will experience [a consequence].

Examples:

- ✅ "Customers can now split payments into up to 12 installments at checkout."
- ❌ "This PR introduces an installments field to the POST /api/checkout endpoint."

The first is product language; the second is API language. The first describes what the world looks like after the change; the second describes the change itself. The product prefers the former.

### 5.2 Voice

- **Plain.** Avoid jargon. "Customers" not "users." "Refund" not "transaction reversal." "Checkout" not "purchase flow."
- **Active.** "We added X" not "X was added."
- **Specific.** Always include numbers, names, magnitudes. "12 installments" not "more installments." "2.5% per month" not "an interest rate."
- **Consequence-oriented.** Describe the effect, not the mechanism. "Customers with old purchases will be rejected" not "the eligibility window is now 14 days."

### 5.3 What we do not write

- No exclamation marks.
- No emoji (in the analysis output; minor decorative icons in chrome are fine).
- No celebrating tone ("Awesome new feature!").
- No hedging tone ("It might be the case that…"). The product takes positions and accepts the cost of occasional wrongness.

---

## 6. Visual design system

Deliberately under-designed. The product should feel like a tool, not a brand.

### Typography

- One sans-serif font (system default acceptable; Inter or Anthropic Sans preferred).
- Monospace for code, JSON, schema, file paths, PR numbers.
- Heading sizes: 18px (h1), 14px (h2 in section headers).
- Body: 13px. Small: 11-12px. Micro: 10px (uppercase labels).
- Two weights only: 400 regular, 500 semibold. No bold.

### Color

- Neutral grayscale as the base. White surfaces, light-gray secondary backgrounds, dark text.
- Semantic colors used sparingly:
  - Green for confirming signals and approved verdicts.
  - Amber for warnings, breaking changes, and high-attention items.
  - Red for denied verdicts and destructive concerns.
  - Blue for the primary action button (Review now) — borrowed from Chromatic's pattern.
- No gradients, shadows, or decorative effects.

### Spacing and rhythm

- 8px grid where possible.
- Generous whitespace in the sidebar; denser in the tab content.
- 0.5px borders, not 1px — softens the structure without losing it.

### Iconography

- One icon set, outline style (Lucide / Tabler). Never mix outline and filled.
- Icons are 13-16px. Larger only in empty states.
- Decorative icons have `aria-hidden`; functional icons (close, undo) have `aria-label`.

---

## 7. Open design questions

These are unresolved in MVP but tracked as candidates for v2 design exploration.

- **Profile switching.** The product currently makes the user's role implicit (typed tabs work for any role). User testing may show that an explicit role selector ("I'm reviewing this as a PM") improves clarity. The information architecture supports adding this without restructuring.
- **Risk score scale.** A 0-100 number was chosen for impact, but it's hard to calibrate. Alternatives considered: 3-point scale (Low / Medium / High), 5-point letter grade (A-F), traffic-light (green / yellow / red). The current design uses both (a number for impact + a category for meaning), but if testing shows the number causes false-precision anxiety, the number can be removed.
- **Action execution.** The MVP lists actions but doesn't execute them. A v2 should let the user click "Notify #support" and have a Slack message drafted, or "Update FAQ" and create a Linear issue. Each integration is a discrete v2 chapter.
- **History across PRs.** A single PR is the unit of the MVP, but a user reviewing multiple PRs would benefit from a "what's pending for me" inbox. This is a v2 product, not a v2 feature.
- **Mobile.** Same. Not a feature, a product.
- **Slack as primary surface.** Strong v2 argument that the product should live in Slack as the notification surface, with the web app as the deep-detail view. Considered and explicitly deprioritized for the MVP build window.

---

## 8. Design decisions made and explicitly cut

Documented because the reasoning is more important than the outcome.

| Decision | Considered | Chose | Why |
|---|---|---|---|
| "Affects" panel listing audiences | Show "✓ Support, ✓ PM, — Design" in sidebar | Cut | Audience is implicit in the change content. Naming it added inferred-data noise without new information. |
| Per-profile views | One screen per role (PM view, Support view…) | Single screen with typed tabs | Profile emerges from tab clicks; explicit selection adds friction without proven value. |
| Comment threads | Chromatic-style activity feed | Cut | Out of scope for read-comprehension product. Future Slack integration is the right surface. |
| 4 vs 5 tabs (adding "Interface") | UI / API / Data / Flow / Interface | UI / API / Data / Business | Four tabs scan faster; "Business" absorbs Flow's content for non-engineers better than "Flow" would. |
| Risk as multi-dimensional (probability × magnitude × reversibility) | Three separate gauges | Single score + bullet list | Three gauges overload the 10-second budget. Bullets in Risk Assessment make the underlying signals visible without forcing the reader to do math. |
| Sign-off per tab | Mark each tab reviewed independently | One review action for the whole PR | The PR is the unit a stakeholder Accept/Denies. Per-tab sign-off was a more sophisticated model that didn't justify its complexity. |
| Numeric badge on tabs vs. dot indicator | Just a dot showing "has changes" | Numeric count | Counts communicate magnitude alongside presence. Reader sees "UI 0, API 8" and learns something the dot would hide. |
| Mockup of UI in the UI tab | Render a real component preview | Stylized before/after mockup of the checkout | A faithful preview requires running the user's actual frontend, which is out of scope. The stylized mockup demonstrates the design pattern without overpromising. |
