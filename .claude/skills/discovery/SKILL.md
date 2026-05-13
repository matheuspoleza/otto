---
name: discovery
description: Run a product + UX discovery process for a new product, feature, or major change. Produces four linked artifacts — PRD, Design & UX Plan, Technical Discovery, Tech Plan — through a strict sequence of product thinking → UX thinking → tech thinking. Use when starting a new product, scoping a non-trivial feature, preparing a hiring-exercise build, or whenever the user asks for "discovery", "PRD", "design plan", "tech discovery", "scope", or "let's plan X".
---

# Discovery Process

Discovery is the work of figuring out **what to build, for whom, and why** — before the work of figuring out **how**. This skill encodes the process used to produce `docs/prd.md`, `docs/design-ux.md`, `docs/technical-discovery.md`, and `docs/tech-plan.md` in this repo. Read those four files as the canonical examples of the output.

The process is opinionated. It produces strong points of view, explicit cuts, and decisions with reasoning preserved. It is **not** a template-fill exercise — every section earns its place by being load-bearing for a downstream decision.

---

## 1. When to run discovery

**Run it when:**
- Starting a new product or standalone feature with non-trivial UX.
- Preparing a build constrained by time (hiring exercise, hackathon, MVP sprint) — discovery is what makes the cuts defensible.
- A change touches multiple audiences (engineers, PMs, support, designers) or multiple system dimensions (UI + API + data + business rules).
- The user asks for "a PRD", "scoping", "let's plan", or signals strategic framing is missing.

**Skip it for:**
- Bug fixes, refactors, dependency bumps, performance tweaks — discovery overhead exceeds the decision surface.
- Features whose shape is fully prescribed by an upstream doc.
- Anything the user has already scoped in a single message.

If unsure, ask: *"Is this big enough for a discovery doc, or do you want me to just start?"* — and respect the answer.

---

## 2. The four artifacts and their order

Discovery produces four documents, written **in this order**. Each one depends on decisions locked in the previous one. Do not skip ahead.

| # | Document | Question it answers | Owner mindset |
|---|---|---|---|
| 1 | **PRD** (`docs/prd.md`) | What problem, for whom, why now, what shape | Product thinking |
| 2 | **Design & UX Plan** (`docs/design-ux.md`) | What does the user see, in what order, with what consequence | UX thinking |
| 3 | **Technical Discovery** (`docs/technical-discovery.md`) | What does the system look like, what trade-offs are taken | Tech thinking (architecture) |
| 4 | **Tech Plan** (`docs/tech-plan.md`) | How is it built, in what order, with what file structure | Tech thinking (execution) |

Each doc links to the previous ones in its header. Decisions are made *once*, in the earliest doc where they belong, and referenced from later docs — not re-litigated.

**Stop and confirm with the user after each artifact.** Discovery without feedback loops produces confident-but-wrong documents.

---

## 3. UX inspiration capture (parallel input)

Before writing the Design & UX Plan, capture **real screenshots from products that solve adjacent problems**. Save them under `docs/ux-discovery-screenshots/` with their source name in the filename (e.g. `Chromatic.png`, `Postman Web 99.png`).

The goal is not to copy aesthetics — it is to discover patterns that already exist for the *shape* of problem you are solving. The current set (Chromatic, ElevenLabs, Figma, Google AI Studio, Krea AI, Mixpanel, Neon, PlanetScale, Postman, Sana AI, Vapi) was chosen because each shows one solved sub-problem: review verdict pills (Chromatic), dense before/after panels (Mixpanel), typed sidebars (Neon), schema diffs (PlanetScale), JSON request/response presentation (Postman).

When referencing a screenshot in the Design & UX Plan, name *what specifically you are borrowing and why* — not "inspired by X" but "the Accept/Deny pill-with-undo from Chromatic, because it captures intent in one click with one-click reversibility."

---

## 4. Product thinking — writing the PRD

The PRD is the foundation. If the PRD is mushy, every downstream doc inherits the mush. Strong PRDs share these traits:

### 4.1 Required sections (use these exact headings)

1. **Problem** — the situation in the world, not the solution. Name the audiences that suffer. Name what's changed recently to make it acute. Identify the shared failure mode in one sentence.
2. **Audience** — primary audience by *job*, not title. Secondary audience. **Explicitly out-of-scope audiences** with the reasoning ("going after them would be a frontal assault on a saturated market").
3. **Jobs to be done** — the ordered questions the user asks in their head, with time budgets. Frame as an inverted pyramid: each step is shorter and more decisive than the next.
4. **Product thesis** — a single quoted statement of point-of-view, then 2-4 operational consequences. This is where the product earns its right to exist.
5. **MVP scope** — bullet list of what the MVP renders/does. Then an **"Explicitly out of MVP"** subsection that is at least as long. The cuts are the scope.
6. **Success metrics** — what would matter if this shipped. Acknowledge which are easy to measure vs. holy-grail.
7. **Competitive landscape** — three buckets: *Saturated and not competitive*, *Adjacent and partially overlapping*, *Genuine white space*. Name actual products in each bucket. The white space is where the wedge lives.
8. **Risks and open questions** — separated into *Product risks*, *Technical risks*, and *Open product questions*. Each risk carries its mitigation or its honest "we accept this cost because…".
9. **Timeline** — if there is a constraint, name it and name the decisions it shaped. Constraints are scope, not excuses.

### 4.2 Voice rules for the PRD

- **Take positions.** "We are not doing X" beats "X is out of scope for now."
- **Cite numbers.** "60 req/h anonymous, 5000 with a PAT" beats "rate-limited."
- **Name the failure mode you're rejecting.** "Existing tools answer step 3, which is the least valuable of the four because…" — every product decision has a competitor's mistake on the other side.
- **No hedging.** "It might be the case that…" is not allowed. Take a position, accept the cost of occasional wrongness.
- **Honest reductions, not aspirational placeholders.** Each cut should name what was considered and why it lost.

### 4.3 The "explicitly cut" pattern

For any non-trivial decision, write a row in a decisions table:

| Decision | Considered | Chose | Why |
|---|---|---|---|

This pattern recurs in `docs/design-ux.md` §8 and is the most important defensive habit in discovery. **Future-you will not remember why you cut something.** Write it down at the moment of the cut, with the reasoning preserved.

---

## 5. UX thinking — writing the Design & UX Plan

The Design & UX Plan answers: *for the audience and jobs defined in the PRD, what does the user see, in what order, with what consequence?* It is **not** a Figma file in markdown. It is the **reasoning** behind the design.

### 5.1 Required sections

1. **Design principles** — 3-7 principles, listed *in priority order*. Each principle has a one-sentence statement, a paragraph of context, and an "Operational consequence" line. Later principles defer to earlier ones in any conflict. This is the resolution mechanism for design debates.
2. **Information architecture** — an ASCII diagram of the screen regions. Then a region-to-question mapping table (which region answers which JTBD question, with a time-to-read budget).
3. **Component inventory** — every component on the screen, with: typography spec, density, what info it carries, why it earns its pixels.
4. **States, interactions, edge cases** — empty, loading, error, partial-failure, multi-actor state changes. Empty states are first-class, not afterthoughts.
5. **Writing and tone** — the highest-leverage sentences in the product (subtitles, error messages, action labels). Concrete *good vs. bad* examples for each. Forbidden patterns (no exclamation marks, no celebrating, no hedging).
6. **Visual design system** — typography (font, sizes, weights), color (semantic only, used sparingly), spacing (grid), iconography (one set, outline OR filled, never mixed). Deliberately under-designed — "should feel like a tool, not a brand."
7. **Open design questions** — unresolved candidates for v2 exploration, each tagged with what would resolve them (user testing, more data, etc.).
8. **Design decisions made and explicitly cut** — the same table pattern as the PRD. The reasoning is more important than the outcome.

### 5.2 UX thinking principles to apply

- **The change has a shape; the UI should expose it, not narrate it.** If something is structurally typed (a schema, a diff, a before/after), render its structure — don't paraphrase it as prose. Prose is the fallback when structure isn't available.
- **The first 10 seconds decide the next 10 minutes.** The highest-fidelity, highest-leverage information goes where eyes land first (typically top-right after the title). Detail lives below.
- **Saying "nothing changes for you" is a feature.** Empty states are first-class. A tool that always finds something to say is dishonest.
- **The destination is action, not understanding.** Understanding is the means. Every screen funnels toward a concrete, owned, time-boxed next step.
- **No scroll for what matters.** Calibrate the layout to fit a desktop viewport without vertical scroll in the chrome. Only content can scroll.

### 5.3 How to use the inspiration screenshots

Reference them by file name from `docs/ux-discovery-screenshots/`. For each pattern you borrow, write a one-sentence justification: *what* you took, *from where*, *why it solves your problem*. Do not borrow aesthetics without function.

---

## 6. Tech thinking (architecture) — writing the Technical Discovery

This is the architecture-of-the-MVP doc. It is **not** an implementation guide — that's the Tech Plan. The Technical Discovery captures the architecture that ships, the trade-offs taken, and the production paths considered and deferred.

### 6.1 Required sections

1. **Scope of this document** — what's in (MVP architecture), what's out (production runbook). Name the MVP boundaries (single-page, no auth, public-only, no caching, etc.).
2. **System overview** — an ASCII diagram of the data flow. Browser → server → external APIs → response.
3. **Stack choices** — *why this framework*, *why this language*, *why this styling layer*. **Crucially**: a "What we explicitly didn't pick" subsection naming state libraries, fetching libraries, CSS-in-JS, etc. that were deliberately not adopted.
4. **External integrations** — one section per integration. What we fetch, authentication, URL/payload parsing, size limits, edge cases as a table.
5. **LLM / AI integration (if applicable)** — provider and model, why structured output not free-form, the schema as the single source of truth, prompt design, latency, cost, quality risks and mitigations, demo-mode fallback.
6. **API design** — every endpoint, request body, success response, error response. Typed errors (PR_NOT_FOUND, RATE_LIMITED, …) because the UI renders different states for each.
7. **Frontend architecture** — page tree, component tree, state-held-where, why-no-X (e.g. "Why no streaming in MVP").
8. **Security and privacy** — what flows where, risks table (with status: Mitigated / Acknowledged / Residual), what we do NOT log.
9. **Deployment** — local setup, hosted setup, telemetry.
10. **What's not built and why** — capability table with deferral reasoning. The omissions are the scope.
11. **Open technical questions** — for production. Caching strategy, evaluation methodology, fine-tuning vs. prompting, pricing model, self-hosted path.

### 6.2 Tech discovery principles

- **Determinism over LLM where possible.** Use the LLM for narrative tasks; use deterministic tools for structural ones (diffs, parsers, schema introspection). Where the LLM is used, enforce structured output and citation validation.
- **Honest deferrals.** Every "out of MVP" item must have a one-line reason. "Each integration is a discrete chapter" beats "future work."
- **Server-only secrets.** API keys never reach the browser bundle.
- **Typed errors.** Generic 500s are an MVP smell, not a production pattern.

---

## 7. Tech thinking (execution) — writing the Tech Plan

The Tech Plan is the implementation guide. It is the answer to *how do we build this, in what order, with what file structure?*

### 7.1 Required sections

1. **What we're building** — one paragraph product summary + consumption model (web app / CLI / Slack bot).
2. **MVP scope: a controlled scenario** — the explicit eligibility rules / constraints / inputs the system depends on. A repo, a config file, a tech stack. Limit blast radius to maximize confidence.
3. **Determinism boundary** — table or list: what runs deterministically vs. what is LLM-scoped. State the citation/validation rules for LLM output.
4. **Pipeline** — an ASCII diagram of the processing pipeline, top to bottom, with explicit decision/fallback paths.
5. **Scoring or aggregation logic (if applicable)** — the exact formula in code, with weights named as constants. Properties: reproducible, auditable, tunable.
6. **Architecture & deployment** — component table (Web app, services, cache, LLM, storage) with hosting choices. Cost estimate. Safety / abuse protection (allowlist, rate limit, hard cache, size cap).
7. **Reference data / repo** — if the product needs a controlled input (a sample repo, a fixture set), describe it as its own deliverable.
8. **Code structure** — the actual `app/` tree with file names. Reference the project's coding standards skills (e.g. `react-standards`).
9. **Data contract** — the TypeScript type the pipeline produces, shared between server and UI.
10. **Framework specifics to remember** — gotchas of the framework version (e.g. "Next 16 specifics: `params` is a Promise, fetch is not cached by default…"). **Read framework docs first** — see Project AGENTS.md.
11. **Implementation order** — a numbered list of shippable steps. Each step is independently shippable so the product is partial-but-working at every pause point.
12. **Open decisions** — concrete remaining choices (naming, scope expansion, etc.).
13. **Risks & mitigations** — implementation-level risks (different from PRD product risks) with mitigations.

### 7.2 Tech plan principles

- **Each step shippable on its own.** The implementation order should be a partition into independently-valuable chunks, not a dependency chain.
- **Single source of truth for data shape.** The TypeScript type is shared between server and UI, and (if applicable) used as the JSON Schema for LLM structured output.
- **Read the docs of the framework version in use.** Project conventions (Next.js 16 in this repo) may differ from training-data defaults. Cite the version.
- **Cost is a design constraint.** Name the monthly $ estimate; if it's wrong, the architecture is wrong.

---

## 8. Decision-making heuristics (apply throughout)

These are the meta-rules that make discovery sharp instead of soggy.

### 8.1 The white-space test

For every product decision: *is there an existing tool that already does this well?* If yes, name it. If you're going after that segment anyway, name your differentiator in one sentence. If you can't, change the scope until you can.

### 8.2 The 10-second test

For every UX decision: *if a user gives this 10 seconds and then leaves, what did they learn?* If "nothing useful," redesign. If "the wrong thing," redesign harder.

### 8.3 The honest-cut test

For every "out of scope" item: *would I be embarrassed to defend this cut to a stakeholder?* If yes, the cut isn't honest — either bring it in or strengthen the reasoning.

### 8.4 The reversibility test

For every architectural choice: *if we're wrong, how expensive is it to change?* Cheap-to-reverse choices (a UI layout, a copy decision) deserve less debate. Expensive-to-reverse choices (data schema, auth model, LLM provider lock-in) deserve more.

### 8.5 The determinism preference

Where a structured tool exists (compiler API, schema differ, OpenAPI differ, migration parser), prefer it to the LLM. The LLM is for narrative, polish, and judgment — not for tasks where the answer is mechanically derivable from the input.

---

## 9. How to actually run a discovery session

Step-by-step, what to do when the user invokes this skill:

1. **Confirm scope.** Ask one clarifying question to confirm this is discovery-worth (per §1). Don't ask permission — ask the *useful* clarifying question. Examples:
   - "Is this a new product or a feature inside an existing one?"
   - "What's the time budget — is this scoping for a hiring exercise, a sprint, or a roadmap quarter?"
   - "Who's the primary audience? You can answer by job ('the PM on a release') rather than title."
2. **Draft the PRD first**, end to end, even if rough. Use the §4 section list. Stop before writing the next doc — review with the user.
3. **Collect UX inspiration screenshots** (if the product has a UI). Save under `docs/ux-discovery-screenshots/` with source-named filenames. The user provides these or you ask them to.
4. **Draft the Design & UX Plan**, end to end. Reference screenshots by filename with one-sentence borrow-justifications. Stop, review.
5. **Draft the Technical Discovery**, end to end. Stop, review.
6. **Draft the Tech Plan**, end to end. Stop, review.
7. **Cross-link the docs.** Each doc's header lists the related docs by path. References between docs use section numbers (e.g. "see Design & UX Plan §6").
8. **Write the implementation order in the Tech Plan as a checkbox list** — each item shippable independently. As work proceeds, tick off completed items (and only those).

Resist combining steps. Resist writing four docs in one shot. The forcing function of *stop and review* between artifacts is what produces sharp documents.

---

## 10. What this skill does NOT do

- It does not produce Figma files or visual mockups. The Design & UX Plan describes the *reasoning*; if a mockup is required, generate it separately (e.g. via the `figma:figma-generate-design` skill).
- It does not implement code. The Tech Plan ends at file-tree + ordered checklist. Implementation is a separate task that consumes these docs.
- It does not generate prompt content for an LLM. Prompt design appears in the Technical Discovery as *what the prompt looks like and why*, not as the prompt itself.
- It does not write tests. Test acceptance criteria are written via the `bdd-acceptance-criteria` skill, against the user-visible behavior named in the PRD.

---

## 11. Reading the canonical examples

Before drafting any new artifact, **read the corresponding file in `docs/` from this repo** as the reference:

- `docs/prd.md` — for the PRD voice, the inverted-pyramid JTBD, the white-space-test in the competitive landscape, the decisions table.
- `docs/design-ux.md` — for priority-ordered design principles with operational consequences, the region-to-question IA, the decisions table.
- `docs/technical-discovery.md` — for the "explicitly didn't pick" subsection, the typed-error API design, the structured-output schema-as-source-of-truth pattern.
- `docs/tech-plan.md` — for the determinism boundary table, the pipeline ASCII, the cost estimate, the shippable-step implementation order.

These four files together are the *style guide*. Match their density, voice, and structural patterns when producing new discovery work in this repo.
