# UX Revision — Diagram

**Status:** Proposal, not yet implemented
**Last updated:** May 2026
**Owner:** Matheus
**Linked docs:** [PRD](./prd.md), [Design & UX Plan](./design-ux.md), [UX Review](./ux-review.md)
**Supersedes:** parts of [UX Review §4.2](./ux-review.md), [UX Review §5](./ux-review.md), and the focus-mode panel introduced after it.

---

## 1. Why this revision

The first UX Review collapsed the tabs into a single diagram + focus panel. Living with that surface revealed three frictions:

1. **The diagram is the whole product**, but the layers (UI / API / Data) read as three loose rows of cards with no visual frame. A first-time viewer doesn't immediately know that the top row is "the user-facing pages" — they infer it from icons.
2. **The focus panel competes with the diagram for canvas space.** When focused, the diagram shrinks to ~220px and previews still feel cramped (screenshots small, endpoint diffs truncated). The reader trades one half-readable surface for another.
3. **Nodes are silent.** Border color tells you *something changed here*, but the actual taste of the change — what the page now looks like, which column was added — only appears after a click. The 10-second test fails for any reader who doesn't click.

This revision answers all three by:

- Framing each layer as a labeled band.
- Putting a small **preview baked into every node**.
- Replacing the focus panel with an **overlay over the diagram** when the reader wants detail.

---

## 2. Re-reading the brief (again)

> Understand what changed within 10 seconds.

The previous revision answered this with the diagram structure (where the change is) and the sidebar index (what the change is). That leaves a gap: **the appearance of the change** — what it looks like, what it does — still requires a click to surface.

Previews close that gap by carrying enough signal at-a-glance that the reader can scan the diagram once and finish with a sense of the visual and structural delta — not just the topology.

This isn't replacing the detail view. It's making the diagram itself the 10-second surface, and reserving the overlay for the 30-second deep read.

---

## 3. What's changing

### 3.1 Layer bands

Each pillar row becomes a labeled band that visually contains its nodes.

- **3 horizontal bands** stacked top→bottom: `FRONTEND` / `API` / `DATABASE`.
- Each band spans the full diagram width and lives inside the ReactFlow viewport (so it zooms and pans with the canvas, not as an HTML overlay).
- Subtle fill — `bg-neutral-100/40` or similar — just enough to read as a container without competing with the node borders.
- Label on the **left edge** of each band, vertical or horizontal small uppercase, neutral gray.
- Bands have no interaction. They're scenery.

The bands also serve as the visual anchor for "this is where pages live" — even when a band is empty (e.g., a PR with no UI changes), the band still renders, making absence legible.

### 3.2 Domain chips move

The "Affects: {domains}" overlay is currently at the **top-left** of the diagram. It now conflicts with the new `FRONTEND` band label. Moves to **top-right** of the diagram canvas, same overlay treatment (backdrop blur, pointer-events-none).

### 3.3 Node previews

This is the big change. Each node type carries a small content preview directly in the diagram, sized to fit at default zoom.

#### Page (UI) preview

- **Content:** the **after** screenshot, cropped to a 16:10 thumbnail (~160×100px inside a 200px-wide node).
- **Why "after":** it answers "what does it look like now" — the reader's primary question. Before/after diff lives in the overlay.
- **Treatment for "removed":** thumbnail rendered greyscale + 40% opacity. Treatment for "added": full color, no marker (border already says "new"). Treatment for "modified": full color.
- **Empty state:** if no screenshot was captured (snapshot service down, demo mode without fixtures), fall back to a route-path placeholder strip.

#### API endpoint preview

- **Content:** method pill (`GET` / `POST` etc.) + path on one line, then a single sub-line hint of the change.
- **Sub-line hints** are deterministic, from the existing endpoint diff data:
  - Added endpoint: `New endpoint`
  - Modified endpoint: `+ {N} fields` / `- {N} fields` / `breaking change` (pick the strongest signal)
  - Removed endpoint: `Removed`
- **Why not the full request/response diff:** that's overlay territory. The node carries the strongest one-line signal, not the body.

#### Table (Database) preview

- **Content:** table name on one line, then up to **3 column hints** with `+` / `~` / `-` prefixes and column names.
- Example: `+ priority`, `~ status (enum→string)`, `- legacy_flag`
- If more than 3 changes, show 2 + `+N more`.
- For a new table: show first 3 columns with `+` prefix.
- For a dropped table: table name strikethrough, no column list — emphasizes "gone."

#### Business rule

No change. Remains a badge on the structural node it enforces on. No preview content of its own.

#### Node size implications

Current nodes are ~200×60px. With previews:

- Page node: ~200×140px (thumbnail + label below)
- API node: ~200×80px (method/path + hint line)
- Table node: ~200×110px (name + up to 3 column hints)

Bands grow to accommodate the tallest node in their row. The overall diagram grows taller — bounded by `fitView` + `maxZoom` so it never feels overwhelming.

### 3.4 Replace focus panel with overlay

The current focus-mode side panel goes away. Click a node → open an **overlay** that floats above the diagram.

- **Trigger:** click any non-context node (or any node with a `changeId`).
- **Layout:** centered, ~80vw / 80vh, capped at `max-w-5xl max-h-[80vh]`. Backdrop dims the diagram (`bg-neutral-900/40 backdrop-blur-sm`).
- **Content:** the existing `FocusedChange` content (EndpointDiff, ScreenshotComparison, NewTableCard / ModifiedTableCard / DroppedTableCard, BusinessRuleDiff). Reused as-is — only the container changes.
- **Close:** Esc, backdrop click, or explicit X button.
- **Right sidebar stays visible** behind the overlay and remains interactive. Clicking another change in the sidebar **swaps the overlay content** without closing it (smooth transition).
- **No second click needed** to navigate between previews — the sidebar drives the overlay.

The diagram itself returns to full canvas width at all times. The overlay is the focused surface when needed; otherwise the canvas is the whole story.

---

## 4. What each preview is supposed to do

| Node | Preview | Question it answers at-a-glance |
|---|---|---|
| Page | After-screenshot thumbnail | "What does this page look like now?" |
| API endpoint | Method + path + 1-line delta hint | "What did this endpoint gain or lose?" |
| Table | Name + 3 column-level hints | "Which columns changed?" |
| Business rule (badge) | Icon + hover tooltip (unchanged) | "There's a rule here — click to read it." |

Each preview is a **single bite** of the change. The overlay is the meal.

---

## 5. Interaction model

| Surface | Role |
|---|---|
| Diagram (with previews + bands) | Spatial map + 10-second taste of every change |
| Right sidebar (change index) | Textual index + overlay router |
| Overlay (when open) | 30-second deep read of one change |

### 5.1 Hover

- Hover a node → corresponding sidebar bullet highlights (same as today).
- Hover a sidebar bullet → corresponding node pulses (same as today).

### 5.2 Click

- Click a node → opens overlay for that change.
- Click a sidebar bullet → opens overlay (or swaps content if already open).
- Click backdrop / press Esc → closes overlay, returns to diagram view.

### 5.3 What's removed

- The focus-mode side panel and its 220px-shrunk-diagram layout.
- The CSS width transition between focused and unfocused diagram.

---

## 6. Decisions made and tradeoffs accepted

| Decision | Considered | Chose | Why |
|---|---|---|---|
| Layer presentation | Labeled rows; labeled columns; rows with implicit grouping | Labeled rows (bands) | Keeps current top→bottom data-flow direction; adds explicit grouping without rotating node handles |
| Band rendering | HTML overlay over ReactFlow; SVG behind nodes; non-interactive background nodes | Non-interactive background nodes inside ReactFlow | Bands zoom/pan with the canvas; no two coordinate systems to keep in sync |
| Domain chips position | Top-left (current); top-right; bottom; inside the band | Top-right | Avoids conflict with `FRONTEND` band label; preserves at-a-glance domain read |
| Page preview content | Before-screenshot; after-screenshot; both side-by-side | After-screenshot | One bite per node; before/after is the overlay's job |
| API preview content | Just method+path; method+path+hint; full signature | Method+path+1-line hint | Strongest deterministic signal in minimum vertical space |
| Table preview content | Table name only; row count; column delta hints | Up to 3 column-level hints | Column changes are usually what the reader cares about; matches the granularity of the data pillar's diff |
| Detail surface | Side panel (current); overlay; popover anchored to node | Overlay | Side panel shrinks the diagram; popover is too small for screenshots and diffs; overlay reuses full canvas width while preserving the diagram beneath |
| Overlay backdrop behavior | Click-through; dim only; dim + blur | Dim + blur | Diagram stays visible as spatial anchor without competing for focus |
| Sidebar role when overlay is open | Hidden; visible-but-disabled; visible-and-interactive | Visible-and-interactive | Sidebar becomes the overlay router — click any item to swap content without close+reopen |

---

## 7. What this revision does not change

- The four pillars (UI / API / Data / Business) and their analyzers.
- Pillar outputs (`pillarUI`, `pillarAPI`, etc.) and the data pipeline.
- The Accept / Deny / Flag gesture in the header.
- Static-trace edge detection (`static-trace.ts`).
- The right sidebar's existence and content (change index by pillar).
- Loading state and steps.

---

## 8. Open questions

- **Page-node aspect ratio.** 16:10 thumbnail assumes a desktop viewport. For mobile-specific PRs (out of MVP scope, but plausible later) the thumbnail may need to flex.
- **Preview empty states.** Page with no screenshot (snapshot service down) — fall back to route-path strip vs. hide preview area vs. shrink node back to current size. Tentative: route-path strip, so the node geometry stays stable.
- **Overlay scroll.** Long endpoint diffs or migration SQL may overflow 80vh. Overlay content scrolls internally; header (close button + label) stays sticky.
- **Mobile/narrow viewport.** Overlay at 80vw on a 1024px screen is ~820px — fine. Below ~900px, fall back to fullscreen overlay. The diagram itself remains desktop-only (consistent with current product scope).
- **Tablet/zoom interplay.** Default `fitView` padding may need to shrink slightly to accommodate taller nodes without forcing the reader to manually zoom out.

---

## 9. Implementation order

1. Layer bands as non-interactive background nodes (zIndex −1, no handles, no selection).
2. Move domain chips overlay to top-right.
3. Extend `OverviewNode` to render kind-specific previews. Start with the API preview (cheapest, no media), then table, then page.
4. Wire page preview to the existing screenshot data — add a fallback to route-path strip.
5. Build the overlay component. Reuse `FocusedChange`'s inner components as-is, swap the container.
6. Replace `PRDiagram.page.tsx` focus-mode CSS (`w-[220px]` / `flex-1` transition) with overlay open/close state.
7. Wire sidebar bullet clicks to swap overlay content when overlay is open.
8. Re-tune `fitView` padding / `maxZoom` for the taller default node heights.
9. Polish: overlay backdrop transition, Esc close, sticky overlay header, empty-state previews.

Steps 1–2 are isolated and shippable on their own. Steps 3–4 unlock the at-a-glance taste. Steps 5–7 replace the focus panel. Step 8–9 are tune-and-polish.
