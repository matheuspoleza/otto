# PR Lens

A take-home for Scrunch. Brief lives in [`docs/assignment.md`](./docs/assignment.md): build something that helps a non-engineer understand a GitHub PR in under 10 seconds.

This README is about *how I got there* — the discovery process before any code. The product reasoning is in [`docs/prd.md`](./docs/prd.md).

## How discovery actually went

I'd already been thinking about this problem on and off, so I didn't start from a blank slate. Rough order of what happened:

1. **Notebook + pen.** Sketched the shape of the product before opening any tool. Just messy boxes and arrows for what a non-engineer needs to see when they land on a PR.
2. **Mobbin + a couple of apps for references.** Pulled screenshots of patterns that felt close Chromatic for the Accept/Deny review flow, Linear for dense layouts that don't feel dense, a few others. The interesting ones are in [`docs/ux-discovery-screenshots/`](./docs/ux-discovery-screenshots).
3. **Quick conversation with Claude.** Not for solutions yet just to stress-test the framing. Who's the actual user, what's the wedge, what's already saturated. This is where "not the engineer reviewing teammate's code" landed as the user.
4. **Sketch on paper.** A real layout this time — header, risk, tabs, sidebar. Same regions that ended up shipping.
5. **Dropped the screenshots and sketch into the project and ran my `discovery` skill.** That's a four-stage flow with Claude: PRD → Design/UX → Technical Discovery → Tech Plan. Each stage feeds the next and can push back on the previous one. Output is in [`docs/`](./docs).

The whole thing took ~60/90 minutes before I touched code. The point wasn't to write docs, it was to know *exactly* what I was cutting and why before the clock started.

## What I cut, and the actual tradeoff

The big constraint I set for myself: I didn't want to ship a UI that felt thin. A barebones page with three lines of LLM-summary prose would technically meet the brief and look like nothing. So I cut hard on the *backend* side and spent the time on the visible thing.

The cuts that made that possible:

1. **Real GitHub fetch, but public repos only.** No OAuth, no token management. Anonymous REST is good enough for a demo.
2. **A controlled demo repo on GitHub instead of a general extraction engine.** This is the load-bearing cut. The app works for a specific stack — TypeScript, Prisma migrations, an OpenAPI spec, Vercel previews for screenshots. That's not as niche as it sounds; it's a real shape of modern app. So the demo runs on a real PR end-to-end, against a repo I control where the inputs are deterministic.
3. **Generalized diff extraction.** This is what cut #2 buys me. I'm not solving "parse arbitrary diffs from arbitrary stacks" — I'm showing the *visible product* that would sit on top of that work.

### Why this is the right cut for a 2-3h build

The visible product is the bet. If the UI doesn't make a non-engineer go "oh, I get it" in 10 seconds, no amount of extraction cleverness behind it matters. By constraining the stack I get a real diff flowing through real code into real UI, which is the only thing the brief actually evaluates.

### Where v2 would go

The interesting work I deferred, and would pick up next, is extraction across arbitrary stacks. The path I'd take:

- A small CLI/GitHub app installed in the target repo, so we have a **baseline** of how the app works (routes, schema, contracts) rather than guessing from a diff in isolation.
- Index the codebase once; diff against the index instead of parsing every PR from scratch.
- Stack adapters (Rails / Django / Go) layered over the same typed-extraction core.

That's the part with all the engineering depth, and it's also the part where building it badly in two hours would be worse than not building it at all.

## On the use of AI

I drove the product calls; Claude drafted around them. The mapping table in [`docs/assignment.md`](./docs/assignment.md), the principle ordering in [`docs/design-ux.md`](./docs/design-ux.md), and the eligibility-as-feature framing in [`docs/tech-plan.md`](./docs/tech-plan.md) are the kinds of moves I'd have gotten to slower alone. Decisions are mine; prose around them is mostly Claude's. Same pattern for the implementation.

## Running it

```bash
bun install
bun dev
```

Then [http://localhost:3000](http://localhost:3000). Demo mode is the default (no API key needed).
