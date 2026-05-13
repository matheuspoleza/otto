# UX Review — PR Diagram

**Status:** Proposal, not yet implemented
**Last updated:** May 2026
**Owner:** Matheus
**Linked docs:** [PRD](./prd.md), [Design & UX Plan](./design-ux.md), [Tech Plan](./tech-plan.md)

---

## 1. Why this review

Returning to the assignment brief ([assignment.md](./assignment.md)) after living with the current UI surfaced two questions:

1. Are Risk Assessment bullets and Actionable Items pulling weight, or pulling attention away from the change itself?
2. The 10-second test passes within each tab, but **across** tabs it doesn't — the reader has to click through UI / API / Data / Business and assemble the picture mentally. There's no surface that shows the shape of the whole change.

This document captures the reading of the brief that drove the proposal, the cuts, and the additions.

---

## 2. Re-reading the brief

The original brief states two UX requirements:

> A new user should:
> - Understand what changed within 10 seconds
> - Know what to do next without explanation

The second clause is easy to misread as **"the product must contain a list of actionable next steps"**, which is how the current Actionable Items panel was justified.

A closer reading: the two clauses are structurally symmetric. *"Understand X within 10 seconds"* is a statement about UI density and hierarchy. *"Know Y without explanation"* — by the same parsing — is a statement about UI **self-evidence**, not about a literal "next steps" feature.

The requirement is: when the reader finishes scanning the page, the next gesture should be obvious. That can be answered by:

- A visible decision affordance (Accept / Deny / Flag).
- Impact notes inside each tab telling the consequence of the change.
- A risk dot + tags signaling urgency level.

A dedicated "Actionable Items" panel is **one** way to answer it. The proposal below argues it's not the cheapest or clearest way.

---

## 3. What we're cutting

### 3.1 Risk Assessment bullets

Score + level + domain tags already answer *"how much should I care?"* in ~3 seconds. The bullet list that explains *why* the score is what it is is transparency scaffolding — useful for credibility, but it competes for sidebar attention with the change index and the score itself. The real evidence for the score lives in the change content (before/after panels, impact notes), not in a list of paraphrased signals.

### 3.2 Actionable Items

In MVP these items are non-executable. They paraphrase what the tab content already conveys ("Update the FAQ" = the UI tab shows a copy change; "Notify support" = the impact note already says it). With a self-evident UI, they become a third site repeating the same message in prose.

### 3.3 What we keep

- **Score + level + domain tags** — moves to top of sidebar, remains the 3-second answer.
- **Impact notes per tab** — the bridge from "what changed" to "what to do" stays inside each tipped tab.
- **Accept / Deny / Flag** — the actual decision gesture is the answer to "what do I do next".

---

## 4. What we're adding

### 4.1 Overview tab

A fifth tab, **conditional on the PR touching ≥2 pillars**.

- **Position:** first in the tab bar, active by default when present.
- **Visibility rule:** if only 1 pillar is touched, Overview does not render. The user lands directly on that pillar's tab. Showing an "Overview" of a single-node mutation would be dishonest.
- **Content:** a single structural diagram. The center of the screen is the diagram and nothing else — the PR header above gives narrative, the sidebar gives the textual index. The Overview's job is purely the visual map.

### 4.2 The diagram

The proposal is a **structural map of the system slice touched by the PR**, not a flowchart or narrative diagram.

#### Nodes

- **Types:** page, API endpoint, table, (business rules are not nodes — see §4.2.5).
- **Granularity:** route / endpoint / table — never file-level or function-level.
- **Source:** extracted deterministically from the pillar pipelines (ts-morph for pages, oasdiff for endpoints, Prisma DMMF for tables). Zero LLM in node extraction.

#### Edges

- **Static analysis only**, via ts-morph. The MVP runs against a controlled reference repo (`pr-lens-demo`), so static tracing of `fetch` calls, route handlers, and DB access is reliable. No LLM-inferred edges in MVP.
- **Direction:** directed top-down. Direction is implicit in layout, with arrowheads reinforcing.
- **Labels:** sparse. HTTP method on page→API edges (`POST`), "writes" on edges that mutate data. Nothing on other edges. The rule is: label only when it adds non-obvious info.

#### Scope and context

- **Changed nodes** plus **2 hops** of context.
- Context size is bounded by the small system size of the demo repo. If/when bigger systems become eligible, a node-count budget replaces fixed hops.
- Including context (rather than only the delta) was a deliberate choice for the cross-functional audience — a PM or support agent needs spatial orientation to recognize "ah, this is the checkout flow."

#### Visual encoding

| Status | Border | Opacity |
|---|---|---|
| New | Green | 100% |
| Modified | Amber | 100% |
| Removed | Red, strikethrough | ~40% |
| Context (unchanged) | Gray | ~40% |

Two reinforcing signals: border color for change status, opacity for attention hierarchy. The center of each node carries icon + label only — semantics live on the perimeter.

#### Layout

Layered, fixed:

- **UI** (pages) at the top
- **API** (endpoints) in the middle
- **Data** (tables) at the bottom

Layered layout is consistent across PRs — the reader doesn't relearn the map each time. Within a layer, nodes are arranged left-to-right by source order or alphabetically (TBD during implementation).

#### Business rules

Not standalone nodes. Represented as **badges on the structural node they enforce on** — a small rule icon on the corner of, e.g., the `/api/billing` endpoint. Hover reveals the rule summary; click navigates to the Business tab. This keeps the diagram a pure structural map without inventing positions for rules that don't have structural locations.

#### Removals

Kept in the diagram with ghost treatment (red border, strikethrough, low opacity) rather than omitted or hidden behind a toggle. The before/after intent is preserved in a single view, and removals are typically a minority of changes, so the canvas stays readable.

#### Renderer

**Custom, via react-flow / xyflow** — not mermaid. The visual language above (icons by type, color by status, badges, hover states, click handlers, fixed layered layout) is fightable in mermaid and natural in react-flow. The added implementation cost (~1-2 days) buys consistent visual quality and full interactivity.

### 4.3 Sidebar redesign

The sidebar is repurposed from "explanation panel" to **navigation panel + risk summary**.

- **Top:** score + level + domain tags. Unchanged from current design except for moving to the very top.
- **Below:** a flat, hyperlinked **change index** — every change in the PR as a one-line bullet linking to its tipped tab + section. Examples:
  - *Novo botão "Split payment" na página de pricing* → UI tab
  - *Campo `installments` em POST `/checkout`* → API tab
  - *Nova tabela `installment_plans`* → Data tab
  - *Regra: máximo 3 parcelas para plano Free* → Business tab

The list is **persistent across all tabs** — it's the navigation TOC, not Overview-specific content. When the user is inside the API tab, the sidebar still shows the full index so they know where else to go.

This replaces both Risk Assessment bullets and Actionable Items. The sidebar is no longer competing for the reader's attention — it's helping them navigate.

---

## 5. Interaction model

The Overview, the sidebar, and the tipped tabs are tied into a single coherent model:

| Surface | Role |
|---|---|
| Overview diagram | Spatial index — where mudanças are |
| Sidebar list | Textual index — what mudanças are |
| Tipped tabs (UI/API/Data/Business) | Detail — before/after content |

### 5.1 Hover

- Hover a node in the diagram → corresponding bullet in the sidebar highlights.
- Hover a bullet in the sidebar → corresponding node in the diagram pulses (only when Overview is active or focusable).
- Bidirectional binding makes the two indexes feel like one surface in two representations.

### 5.2 Click

- Click a node in the diagram → switch to the tipped tab for that change type, scrolled to the specific change.
- Click a bullet in the sidebar → same behavior.
- The Accept / Deny / Flag gesture is unaffected — remains the global decision action.

---

## 6. Where the four jobs land after the change

From PRD §3, the four questions a stakeholder asks:

| Question | Answered by |
|---|---|
| Does this affect me? | Tab counts + domain tags (unchanged) |
| How much should I care? | Score + level (unchanged), color signals in diagram, urgency badges in sidebar list |
| What actually changed? | **Overview diagram** (new) — at structural level; tipped tabs — at detail level; sidebar list — as text index |
| What do I do next? | Accept / Deny / Flag (unchanged) + impact notes per tab (unchanged) + UI self-evidence (newly explicit principle) |

The Risk Assessment bullets answered job #2 redundantly. Actionable Items answered job #4 redundantly. Both are absorbed by other surfaces.

---

## 7. Decisions made and tradeoffs accepted

| Decision | Considered | Chose | Why |
|---|---|---|---|
| Overview surface | Sidebar widget; always-on banner; conditional tab | Conditional tab (first position, active by default) | One chrome layer instead of two; consistent navigation pattern; matches mental model "summary first, detail tabs after" |
| Overview gating | Always show; ≥3 nodes; ≥1 cross-pillar edge; ≥2 pillars | ≥2 pillars touched | Preserves the signal of two disconnected things in one PR ("smell"); cleanest semantic threshold |
| Diagram scope | Only delta; delta + 1 hop; delta + 2 hops; delta + N until budget | Delta + 2 hops | Demo repos are small; cross-functional audience needs spatial orientation; budget-based adaptive comes later |
| Edge source | Static (ts-morph); LLM-inferred with citations; convention via `prdiagram.config.json` | Static only | Demo repo is controlled — static analysis is reliable for the MVP, no hallucination risk |
| Edge labels | None; sparse (rule-based); always | Sparse — HTTP method on page→API; "writes" on mutating edges; nothing else | Maximizes scan-friendliness; reserves labels for non-obvious info |
| Visual change encoding | Color only; opacity only; badge only; border + opacity | Border color + opacity (combined) | Two reinforcing signals; keeps node center clean for icon + label |
| Removals representation | Omit; sidebar-only; toggle before/after; ghost node | Ghost node in same diagram | Before/after in one view; removals are a minority of changes |
| Business rules in diagram | Standalone node; badge on existing node; absent from diagram | Badge on existing node | Rules have no structural location; badge preserves diagram as structural map without inventing geometry |
| Renderer | Mermaid; react-flow / xyflow; bespoke SVG | react-flow / xyflow | Mermaid fights the visual language we want; bespoke SVG is overkill |
| Sidebar list scope | Overview-only content; persistent index | Persistent across tabs | The list is navigation, not content — it earns its space everywhere |
| Interaction model | Click-only; hover-tooltip + click; bidirectional hover + click | Bidirectional hover + click | Ties diagram + sidebar + tabs into one mental model |

---

## 8. What this proposal does not change

- Tabs are still UI / API / Data / Business (plus conditional Overview).
- Tipped tab content (before/after panels, impact notes) is unchanged.
- Score formula (`score.ts`) is unchanged. Sidebar header still shows score + level + tags.
- Eligibility gate, rate limit, demo mode behave the same.
- Mobile is still out of scope.

---

## 9. Open questions

- **Hover binding when Overview isn't shown.** For 1-pillar PRs (no Overview), bullet hover has nothing to pulse. Behavior: probably just highlight the bullet itself with a subtle accent, no diagram interaction. Worth confirming during implementation.
- **Layout within a layer.** Nodes within the same layer (e.g., 3 endpoints in the API row) need an ordering rule — source-file order, alphabetical, or by edge count. Not critical; deferred to implementation.
- **What happens when static analysis misses an edge.** In the controlled demo repo we curate the patterns ts-morph traces. If/when a real-world PR uses a pattern we don't trace, the missing edge is invisible. Likely fine for MVP; future fallback could be an LLM-inferred dashed edge with citation grounding.
- **Sidebar list ordering.** By pillar? By position in the diagram? By risk? Probably by pillar with subtle headers, but worth testing.

---

## 10. Implementation order

If we proceed, the suggested sequence:

1. Remove Risk Assessment bullets and Actionable Items from sidebar; relocate score+level+tags to top.
2. Build sidebar change index from existing `PRDiagramData` (no pipeline changes needed).
3. Wire click → tab navigation for sidebar bullets.
4. Add Overview tab gating logic (≥2 pillars).
5. Extend pillar outputs to emit graph nodes + edges (additive to `PRDiagramData`).
6. Build react-flow renderer with the visual language defined above.
7. Wire bidirectional hover binding between diagram and sidebar.
8. Add business rule badges to nodes.
9. Handle removals (ghost nodes).
10. Polish: empty states, error states, edge cases.

Steps 1-3 are shippable on their own (clean sidebar without the diagram). Steps 4-7 deliver the Overview as a working feature. 8-10 are polish.
