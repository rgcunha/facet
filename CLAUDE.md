@AGENTS.md

# CV Tool

A local web app for keeping one or more **base CVs** and many **variants** tailored to specific job offers.

1. **Import & edit**: drop a CV PDF → parse it into structured fields → fix it in a form (original PDF alongside) → export to PDF.
2. **Tailor**: from a CV, paste a job description (a URL is optional) → a variant opens in the editor with the changes highlighted → edit → export.

Personal tool: 1 user, at most 3–4 people, **each running their own copy**. No auth, no hosting, no multi-tenancy.

- Plan: `docs/plan.md` (copied in Phase 1 from `~/.claude/plans/fuzzy-questing-melody.md`)
- UI mockups (v2 row is current): https://claude.ai/artifact/BLt5UVRZijW8LjVAkXmEf5
- Architecture & class diagrams: `docs/architecture.md`

## Stack

Next.js (App Router) + TypeScript + Tailwind · zod · react-hook-form · Vercel AI SDK · `unpdf` (pdf.js). **Bun** is the package manager, script runner and test runner (`bun test`); there is no npm, no lockfile other than `bun.lock`, and no Vitest/Jest. Storage is JSON files; there is no database.

## Commands

Available once Phase 1 sets up the project:

- `bun install` / `bun add <pkg>` / `bun add -d <pkg>`: dependencies (never `npm`, `npx`, `yarn` or `pnpm`; use `bunx` for one-off tools)
- `bun run dev`: start the app on localhost
- `bun test`: unit tests (Bun's built-in runner, `*.test.ts` next to the module)
- `bun run check`: `tsc --noEmit` + ESLint + Prettier check + `knip` (unused code/deps) + `jscpd` (duplication). **Must pass before a change is done.**

## Privacy rules (non-negotiable)

- **Personal data never reaches an LLM provider.** That means name, email, phone, address, URLs, date of birth, photo and any custom masks.
- Every LLM call goes through `generateStructured` (`lib/llm/generate.ts`): it masks the prompt with the private values the caller passes, runs the outbound guard, then restores placeholders in the answer. Import passes the values the user chose to mask (so the Import screen preview is exactly what is sent); every other call must pass the profile vault. Never call `generateText` or a provider SDK anywhere else.
- `Contact` lives only in `data/profile.json`. It is never part of `CvContent` and never part of a prompt; it is merged in only when rendering.
- PDFs are parsed locally. Never send a raw PDF or unredacted text to a model.
- Job description text is public and may be sent.
- Any change that touches prompts, the redaction step or the guard must keep the privacy test passing: a mock provider records every request, and no vault value may appear in any of them.

## Vendor-agnostic LLM

- The provider is chosen only through `.env`: `LLM_PROVIDER=anthropic|openrouter|openai-compatible`, `LLM_MODEL`, `LLM_API_KEY`, `LLM_BASE_URL`.
- App code calls task functions in `lib/llm` (`structureCv`; Phase 3: `tailorCv`, `tightenCv`). Nothing provider-specific belongs outside `lib/llm/provider.ts`.
- Structured output uses AI SDK 7's `generateText` with `Output.object({ schema })` (`generateObject` is deprecated), with schemas derived from `lib/cv/schema.ts`. The default model is `claude-opus-5-5`; the Anthropic provider picks native structured output for models that reject forced tool use.

## Persistence

- Plain JSON files under `DATA_DIR` (default `./data`, gitignored):
  - `profile.json`: contact details + PII vault
  - `cvs/<id>.json`: one file per base CV or variant
  - `sources/<id>.pdf`: the original imported PDF
- Only `lib/store/*` touches the file system. Pages and components go through server actions.
- Every read is validated with zod. Every file has a `v` version field. Writes are atomic (write a tmp file, then rename).
- Variants are independent copies of their base; there is no syncing. Tailoring and "Tighten to fit" record previous values in `changes.original` so fields can be reverted.

## Code rules (keep it lean)

- **YAGNI.** Build only what the current phase needs. No speculative options, config flags, plugin points or "future-proof" layers.
- **One source of truth.** `lib/cv/schema.ts` defines the data. Derive TypeScript types (`z.infer`), form validation and LLM output schemas from it instead of redeclaring shapes.
- **Reuse before writing.** Check `lib/*` for an existing helper before adding one. Extract a shared function or component on the **third** use, not the first.
- **Plain functions and modules** over classes. No dependency-injection containers, repositories-over-repositories or abstract base classes.
- **Small, focused modules.** One responsibility per file. Name things after what they do, in the domain's words: `redact`, `tailorCv`, `getCv`.
- **No dead code.** No commented-out code, unused exports, leftover TODO stubs or unused dependencies (`knip` enforces this).
- **Comments explain why, not what.** Code should read clearly without them.
- **Errors:** validate at the edges (uploads, file reads, LLM output, fetch) with zod. Show clear messages to the user. Never swallow errors silently.
- **Dependencies:** add one only when it clearly saves meaningful code. Prefer the platform: browser print for PDF export, `fetch`, `crypto.randomUUID`.
- **UI:** match the v2 mockups. Use real `<button>`, `<a>`, `<label>` and `<input>` elements, with touch targets of at least 44px. Use the shared tokens (one accent, amber only for masked personal data).
- **Tests:** unit-test the logic modules (privacy, store, fabrication check, schema). No snapshot tests of the UI.

## Architecture diagrams

- `docs/architecture.md` holds two Mermaid class diagrams: the **data model** and the **components**.
- Any change that adds, removes or rewires a module or schema updates the diagram **in the same change**. The diagram must always match `src/lib/**` and `schema.ts`.

## Definition of done

For each change or phase:

1. `bun run check` and `bun test` pass.
2. `/simplify` has been run on the change and its fixes reviewed.
3. `/code-review` shows no unresolved findings.
4. `docs/architecture.md` is up to date.
5. Where the change has a UI, it was tried in the browser.

## Out of scope (don't add without asking)

Settings page, multiple templates, keyword scores, per-change accept/reject UI, syncing variants with their base, cover letters, OCR, auth, hosting, database.
