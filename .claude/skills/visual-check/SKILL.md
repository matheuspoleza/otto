---
name: visual-check
description: After implementing or changing anything that affects the rendered UI, use the chrome-devtools MCP to navigate to the affected routes, take screenshots, and verify the result yourself — do not ask the user to "open the browser and check". Use whenever a code change has a visible consequence (new page, refactor of a component, data binding change, error-state handling, layout tweak).
---

# Visual Check Workflow

The user shouldn't be the QA for UI changes when you have a browser-control MCP available. After any change that has a visual consequence, you (the agent) navigate, screenshot, and verify before reporting "done".

---

## When to apply

- A new route or page was added (e.g. `app/[owner]/[repo]/pull/[number]/page.tsx`)
- A component was created, refactored, or had its data shape changed
- An error state, empty state, or loading state was added
- The data flowing into the UI changed (e.g. wiring a new pillar)
- Styles were edited in a way that could affect layout
- A bug fix touched anything rendered

**Skip** for: pure backend/library changes with no visible surface, type-only edits, test-only files, config files, docs.

---

## Workflow (do all of this; don't ask permission for the screenshot step)

1. **Ensure the dev server is running.**
   Check first via `Bash`: `lsof -i :3000` or attempt a curl to `http://localhost:3000` (`curl -s -o /dev/null -w "%{http_code}" http://localhost:3000`). If not running, start it in the background:
   ```bash
   export GITHUB_TOKEN=$(gh auth token)
   bun dev
   ```
   Use `run_in_background: true`. Wait for "Ready" in the output (~3-5s) before navigating.

2. **Decide which routes are affected.** List them concretely — don't just screenshot the landing page when you've changed a deep route. For PR Diagram this typically means:
   - `/` — landing
   - `/{owner}/{repo}/pull/{number}` — analysis page
   Plus any state-specific URLs (an ineligible repo, a rate-limited fetch, etc.) if the change touches those branches.

3. **Use the chrome-devtools MCP tools to capture each route.**
   Tools (these are deferred — load with `ToolSearch` first using `select:new_page,navigate_page,take_screenshot,take_snapshot,wait_for,list_pages`):
   - `mcp__plugin_chrome-devtools-mcp_chrome-devtools__new_page` for the first URL
   - `mcp__plugin_chrome-devtools-mcp_chrome-devtools__navigate_page` for subsequent
   - `mcp__plugin_chrome-devtools-mcp_chrome-devtools__wait_for` if you know what text/element should appear (avoids racing the dev server)
   - `mcp__plugin_chrome-devtools-mcp_chrome-devtools__take_screenshot` with a `filePath` so the image is on disk (don't dump the base64 inline)

4. **Save screenshots to `tmp/visual-check/`.** Filenames: `{route-slug}--{state}.png`, e.g. `pull-2--api-tab.png`, `pull-4--data-tab.png`, `not-supported.png`. This folder is gitignored.

5. **Read the screenshots back with the `Read` tool.** This is the verification step — you (the agent) inspect the images against what the code is supposed to render. Don't outsource this to the user.

6. **Report what you see.** Confirm the expected elements rendered, flag anything off (broken layout, missing text, wrong empty state), and only then say "done". If something is wrong, fix it and re-screenshot — don't stop at the first capture.

---

## What "verify" actually means

Don't just check that the page rendered without crashing. For each affected route, confirm:

- The headline/title shows the right content (from the data, not the fixture)
- Tab counts / badges / risk score numbers match what the pipeline produced
- The expected tab is the active one (e.g. for an API-only PR, the API tab should be active by default)
- Empty buckets render their disabled/zero state correctly (not as broken)
- Warning banners appear when they should, and don't when they shouldn't
- Text doesn't overflow, truncate awkwardly, or wrap badly at the breakpoints in `prdiagram.config.json` viewports

If the route depends on external data (GitHub API), make sure `GITHUB_TOKEN` is exported in the dev server's environment — without it you'll likely hit the rate-limit screen and won't see what you intended to verify.

---

## When the MCP is unavailable

If the chrome-devtools tools are not loaded or the browser fails to launch, tell the user that visual verification was skipped and ask them to spot-check. Don't silently mark the task done.

---

## Anti-patterns

| Anti-pattern | Why bad |
|---|---|
| Asking "open localhost:3000/... and tell me what you see" | The whole point of this skill is to remove that friction |
| Screenshotting only the landing page when you changed `/pull/4` | The change is not on `/`. Verify the actual route. |
| Reading the screenshot but not actually saying what you saw | The user can't see your file reads. Summarize the visible content in your reply. |
| Saying "the build passed so it should look right" | A green build does not guarantee a usable UI. Look at it. |
