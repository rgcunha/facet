# CV Tool: Project Plan (v2, simplified)

> **Superseded in one respect:** contact details and the PII vault are now stored per CV (`contact` and `vault` in `cvs/<id>.json`), not in a shared `profile.json`. Where this plan says `Profile` or `profile.json`, see `docs/architecture.md` for the current design.

## Current status (2026-10-05)

- **Phase 1:** done and committed.
- **Phase 2 (import):** done.
  - The `/simplify` and `/code-review` findings are fixed. The 6 review findings were: date ranges masked as phones; contact filled from rejected values; drop-zone re-pick and double drop; duplicate custom mask; fit status unmeasured behind the Original tab; abandoned imports left on disk.
  - `bun run check` passes, and `bun test` passes 24 tests.
  - Both browser flows pass, and the fake model received 0 of 7 personal values.
- **Phase 3 (tailoring):** done.
  - `/simplify` and `/code-review` are applied. The 4 review findings were: tighten could lose edits made during the call; translated facts were flagged as fabrications; kept facts were re-flagged; an orphaned variant used itself as its base.
  - `bun test` passes 35 tests, and all three browser flows pass with no personal data sent to the (fake) model.
- **Not yet tried:** a real Claude API call (no key on this machine), and the Original PDF tab in a non-headless browser.

## Context

A personal tool, for me plus at most 2–3 other people, each running their own copy. It keeps one or more base CVs and many tailored variants, one per job application.

1. **Import & edit**: drop a CV PDF → parse it into structured fields → fix the result in a form with the original PDF alongside → export to PDF.
2. **Tailor**: from a CV, paste the job description (a URL is optional) → a new variant opens in the same editor with the changes highlighted → edit → export.

Constraints:

- **No personal data goes to the LLM provider.** Contact details are masked locally, and only anonymised text is sent.
- **Vendor agnostic.** Claude now; OpenRouter, OpenAI or a local model (Ollama) later, by changing `.env` only.
- **No overengineering.** Next.js + TypeScript on Bun (package manager, scripts, tests), local only, no auth, one template, no settings UI.

UI mockups: https://claude.ai/artifact/BLt5UVRZijW8LjVAkXmEf5 (v2 row = this plan; the v1 row is kept for comparison).

## Screens (3)

1. **Library** (`/`): a drop zone, then each base CV with its variants listed underneath (role · company · language · date · Edit / PDF).
2. **Import** (`/import`): one screen. Masked details are shown as chips (unmask one, or mask selected text), a collapsible "What's sent" panel shows the exact outgoing text, and a **Parse CV** button.
3. **Editor** (`/cv/[id]`): the form on the left; the right pane has two tabs, **Preview** and **Original PDF** (or **Base CV** when viewing a variant).
   - After import: a banner asking you to compare with the original, and a "Move to…" menu on each highlight to move it to another role or section.
   - Page-fit indicator ("Fits on 1 page" / "4 lines over 1 page") with **Tighten to fit**.
   - **Tailor…** opens a panel in place of the right pane: job description textarea (main input), optional URL + Fetch, output language, length (1 or 2 pages), and **Create tailored variant**.
   - Variant mode: changed fields are highlighted with "Was: …" and **Revert** per field (plus Revert all). A fabrication warning appears only when the check finds something new. A "Not in your CV" keyword list.
   - **Export PDF** uses the browser's print to PDF. The default filename is `First-Last_Company.pdf`.

Out of scope for now: a settings page, a second template, keyword scores, per-change accept/reject cards, keeping variants in sync with their base, cover letters, OCR, auth.

## Architecture

```
Browser                                  Next.js server (localhost)                       External
Drop PDF ─► upload ────────────────────► pdf.js text extraction (local)
                                         PII detect/redact ─► vault in profile.json
Import screen ◄── redacted text + chips ◄┘
"Parse CV" ────────────────────────────► guard ─► LLM adapter ─────────────────────────► Claude / OpenRouter / Ollama
Editor ◄── rehydrated CV JSON ◄──────────┘   (structured output, zod)
Preview (same React template) ─► window.print() with @page CSS ─► PDF
```

### Privacy layer

_(As built in Phase 2.)_

- `lib/privacy/detect.ts`: `detectPrivate(lines)` finds the name (largest font in the header), email, phone, URLs, postal address and date of birth, locally. It deliberately over-detects, because unmasking a value is one click on the Import screen. Photos are never sent.
- `lib/privacy/redact.ts`:
  - `toMasks(values)`: assigns stable placeholders (`{{NAME}}`, `{{EMAIL}}`, `{{URL}}`, `{{URL_2}}`…).
  - `redact(text, masks)` / `rehydrate(data, masks)`: replace values with placeholders, and back.
  - `sameValue(a, b)`: compares two values ignoring case and whitespace.
  - `TOKEN_PATTERN`: matches a placeholder.
- `lib/privacy/guard.ts`: `assertNoPrivateData(payload, values)` throws if a value is still present, matching case-insensitively and also catching reformatted numbers. The error names the kinds of value, never the values themselves.
- **The vault** is `profile.vault`, a list of `PrivateValue { kind, value }`. Every value the user kept masked in an import is added to it.
- The CV's `contact` block is **never** in an LLM payload. It lives only in `profile.json` and is merged back in locally when rendering.
- Tailoring sends the CV content without contact details and masks it with the vault, so the Tailor panel has no review step, just one line explaining what is sent.

### LLM adapter (vendor agnostic)

_(As built in Phase 2.)_

- AI SDK 7: `generateText` with `Output.object({ schema })` (`generateObject` is deprecated). The Anthropic provider automatically uses native structured output for models that reject forced tool use, such as `claude-opus-5-5`.
- `lib/llm/provider.ts`: `getModel()` reads `LLM_PROVIDER=anthropic|openai-compatible`, `LLM_MODEL` (default in `.env.example`: `claude-opus-5-5`), `LLM_API_KEY` and `LLM_BASE_URL`. `openai-compatible` covers OpenRouter, Ollama and LM Studio. Packages: `@ai-sdk/anthropic`, `@ai-sdk/openai-compatible`.
- `lib/llm/generate.ts`: `generateStructured({ schema, system, prompt, privateValues })` is the **only** path to a model. It runs mask → guard → call → rehydrate.
- Task functions:
  - `structure.ts`, built: `structureCv(text, privateValues)` returns `CvContent` (ids are added locally).
  - Phase 3: `tailorCv(content, jobText, { language, pages }, vault)` returns `CvContent` plus `missingKeywords[]` and `jobMeta {title, company, language}`.
  - Phase 3: `tightenCv(content, overflowLines, vault)` returns a shortened `CvContent`.

### CV data model (`lib/cv/schema.ts`, zod, the single source of truth)

- `Contact` (local only): name, email, phone, location, links[], dateOfBirth?
- `CvContent` (the only part that can reach the LLM): headline, summary, experience[] (id, role, company, location, start, end, highlights[]), education[], skills[] (group, items[]), projects[], languages[], extras[] (custom sections).
- The same schema drives the form (react-hook-form + zodResolver), LLM structured output, the template and storage.

## Persistence layer

**Decision: plain JSON files in a local data folder, with no database.** For one user and a few dozen CVs, files are easy to read, back up, diff and delete. They need no native dependencies and no migrations tooling. Nothing is shared between users; each person runs their own copy with their own folder.

**Location:** `DATA_DIR` env var, default `./data` (gitignored). Back it up by copying the folder, or keep it in a private git repo.

```
data/
  profile.json            # contact details + PII vault
  cvs/
    <id>.json             # one file per base CV or variant
  imports/
    <id>.json             # import draft (extracted text, detected values) between upload and Parse; deleted after
  sources/
    <id>.pdf              # original PDF of an imported CV (for the "Original PDF" tab)
```

**`profile.json`**

```jsonc
{
  "v": 1,
  "contact": {
    "name": "…",
    "email": "…",
    "phone": "…",
    "location": "…",
    "links": ["…"],
    "dateOfBirth": null,
  },
  "vault": [
    { "kind": "name", "value": "…" },
    { "kind": "custom", "value": "…" },
  ],
}
```

There is one profile per installation, because each person runs their own copy. All CVs share it, so contact details are stored once and every variant renders with the current values.

**`cvs/<id>.json`**

```jsonc
{
  "v": 1,
  "id": "senior-backend-k3f9",          // slug + 4 random chars
  "kind": "base" | "variant",
  "title": "Senior Backend Engineer",
  "baseId": null,                         // variants: id of the base they came from
  "sourcePdf": "senior-backend-k3f9.pdf", // base CVs created by import; otherwise null
  "language": "en",
  "pages": 1,                             // target length
  "content": { /* CvContent */ },
  "job": {                                // variants only
    "title": "…", "company": "…", "url": null, "text": "…", "language": "en"
  },
  "changes": {                            // set by tailoring or Tighten to fit; drives highlights and Revert
    "original": { "headline": "…", "summary": "…", "experience.0.highlights": ["…"] },  // previous values of changed paths
    "flags": [ { "path": "skills.1.items", "value": "Terraform Cloud", "reason": "not in base CV", "resolved": false } ],
    "missingKeywords": ["Developer tooling", "PagerDuty"]   // variants only
  },
  "createdAt": "…", "updatedAt": "…"
}
```

- **Changed fields** = the keys of `changes.original`. **Revert** copies that value back into `content` and removes the key; **Revert all** does this for every key. Editing a highlighted field by hand keeps the highlight until you revert it or click "Mark as reviewed", which removes the key.
- Variants are **independent copies**: editing the base later does not change them (on purpose).

**Access layer:** `lib/store/` is the only code that touches the file system. If storage ever changes (e.g. to SQLite), only these files do.

- `fs.ts`: `dataPath`, `isSafeId`, `readJson` (validated), `writeFileAtomic`, `writeJsonAtomic`, `listJsonFiles`
- `profile.ts`: `getProfile()`, `updateProfile(patch | fn)` (merges), `recordImport(masked)`
- `cvs.ts`: `listCvs()` (grouping variants under their base comes with Phase 3), `getCv(id)`, `createCv(title, { content, sourcePdf })`, `updateCv(id, patch)` (merges and stamps `updatedAt`), `deleteCv(id)` (also deletes its source PDF; Phase 3: deleting a base also deletes its variants)
- `imports.ts`: `createImport`, `getImport`, `deleteImport` (+ cancel/purge from finding 6)
- `sources.ts`: `saveSourcePdf`, `getSourcePdf`, `deleteSourcePdf`

**Rules:**

- Every read is validated with zod. Each file has a `v` field so its format can be upgraded on read.
- Writes are atomic: write `<file>.tmp`, then rename it over the original.
- The editor autosaves through a server action, debounced by about 800 ms. With a single user, the last write wins.
- Only server code (route handlers and server actions) uses `lib/store`; the browser never reads the folder directly.

## Key implementation notes

- **PDF in:** `unpdf` (pdf.js) on the server; text items with font sizes help detect the name and headings. A PDF with no text layer gets a clear error and an option to start from an empty CV.
- **Original PDF tab:** built as a route handler, `/cv/[id]/source`, that serves `sources/<id>.pdf` in an iframe, so the browser's own PDF viewer shows it and no client-side pdf.js is needed. Highlighting the source line behind a selected field is a nice-to-have.
- **Template & export:** one React template, `templates/Classic.tsx`, used by the preview and by a print-only route `/cv/[id]/print`, with `@page { size: A4; margin: … }`. Export opens that route and calls `window.print()`. Setting `document.title` to `First-Last_Company` makes that the default filename.
- **Page fit:** the preview renders at real A4 size (mm units). Compare the content height with the page height and convert the overflow to lines. **Tighten to fit** calls `tightenCv`; it records the previous values in `changes.original`, so its edits are highlighted with Revert, the same way as tailoring.
- **Fabrication check** (`lib/cv/fabrication.ts`, no LLM): compares the sets of companies, roles, dates, degrees and skill items between the variant and its base. Anything new becomes a `flags[]` entry, shown as the warning banner (Remove / Keep).
- **Job input:** pasted text is the main input. Fetch is best effort: server-side `fetch` + `@mozilla/readability` + `jsdom`, and on failure the message says to paste the text instead.
- **"Move to…"** in the editor: moves a highlight to another role or section. This is pure client state, saved by autosave.

## Architecture documentation: class diagrams

**Deliverable:** `docs/architecture.md`, with two Mermaid `classDiagram`s that GitHub and VS Code render without extra tooling.

1. **Data model:** the zod schemas and how they relate (composition, cardinality, variant → base).
2. **Components:** the modules, what each one depends on, and the paths data takes (privacy boundary, LLM adapter, storage).

The code is mostly functional TypeScript modules rather than classes, so in the diagrams each module is drawn as a class with a stereotype: `<<schema>>` for zod types, `<<module>>` for server code, `<<page>>` / `<<component>>` for UI, and `<<interface>>` for the AI SDK model. Each diagram is followed by a short legend and 3–5 sentences explaining the main relations, especially **which components may see personal data.**

**Upkeep rule:** the diagram is written at the start of Phase 1 from the draft below. It is updated in the same change as any code that adds, removes or rewires a component or schema. A phase is not done until the diagram matches the code.

### Draft 1: data model

```mermaid
classDiagram
  direction LR
  class Profile {
    <<schema>>
    +v: number
    +contact: Contact
    +vault: VaultEntry[]
  }
  class Contact {
    <<schema>>
    +name: string
    +email: string
    +phone: string
    +location: string
    +links: string[]
    +dateOfBirth?: string
  }
  class VaultEntry {
    <<schema>>
    +token: string
    +value: string
  }
  class CvRecord {
    <<schema>>
    +v: number
    +id: string
    +kind: CvKind
    +title: string
    +baseId?: string
    +sourcePdf?: string
    +language: string
    +pages: number
    +content: CvContent
    +job?: Job
    +changes?: Changes
  }
  class CvKind {
    <<enumeration>>
    base
    variant
  }
  class CvContent {
    <<schema>>
    +headline: string
    +summary: string
    +experience: Experience[]
    +education: Education[]
    +skills: SkillGroup[]
    +projects: Project[]
    +languages: Language[]
    +extras: CustomSection[]
  }
  class Experience {
    <<schema>>
    +id: string
    +role: string
    +company: string
    +location: string
    +start: string
    +end: string
    +highlights: string[]
  }
  class Education {
    <<schema>>
  }
  class SkillGroup {
    <<schema>>
    +group: string
    +items: string[]
  }
  class Job {
    <<schema>>
    +title: string
    +company: string
    +url?: string
    +text: string
    +language: string
  }
  class Changes {
    <<schema>>
    +original: Map~string, unknown~
    +flags: Flag[]
    +missingKeywords: string[]
  }
  class Flag {
    <<schema>>
    +path: string
    +value: string
    +reason: string
    +resolved: boolean
  }

  Profile "1" *-- "1" Contact
  Profile "1" *-- "0..*" VaultEntry
  CvRecord --> CvKind
  CvRecord "1" *-- "1" CvContent
  CvRecord "1" *-- "0..1" Job
  CvRecord "1" *-- "0..1" Changes
  Changes "1" *-- "0..*" Flag
  CvContent "1" *-- "0..*" Experience
  CvContent "1" *-- "0..*" Education
  CvContent "1" *-- "0..*" SkillGroup
  CvRecord "0..*" --> "0..1" CvRecord : variant of (baseId)
  CvRecord ..> Profile : rendered with contact
```

Key point: `Contact` and `VaultEntry` exist only inside `Profile`. `CvContent` is the only structure that can be sent to the LLM.

### Draft 2: components

```mermaid
classDiagram
  direction TB
  class LibraryPage
  <<page>> LibraryPage
  class ImportPage
  <<page>> ImportPage
  class EditorPage
  <<page>> EditorPage
  class PrintPage
  <<page>> PrintPage
  class ClassicTemplate {
    <<component>>
    +render(contact, content)
  }
  class PageFit {
    <<component>>
    +measure(): overflowLines
  }

  class ServerActions {
    <<module>>
    +importPdf(file)
    +parseCv(importId, masks)
    +saveCv(cv)
    +tailor(cvId, jobText, opts)
    +tighten(cvId, overflowLines)
    +fetchJob(url)
  }

  class PdfExtractor {
    <<module>>
    +extract(buffer): TextItem[]
  }
  class JobFetcher {
    <<module>>
    +fetchJob(url): string
  }
  class FabricationChecker {
    <<module>>
    +check(base, variant): Flag[]
  }

  class PiiDetector {
    <<module>>
    +detect(items): Detection[]
  }
  class Redactor {
    <<module>>
    +redact(text, detections): RedactedText
  }
  class Rehydrator {
    <<module>>
    +rehydrate(content, vault): CvContent
  }
  class OutboundGuard {
    <<module>>
    +assertClean(payload, vault)
  }

  class LlmService {
    <<module>>
    +structureCv(redactedText): CvContent
    +tailorCv(content, jobText, opts): TailorResult
    +tightenCv(content, lines): CvContent
  }
  class ProviderFactory {
    <<module>>
    +getModel(): LanguageModel
  }
  class LanguageModel
  <<interface>> LanguageModel
  class AnthropicProvider
  class OpenRouterProvider
  class OpenAICompatibleProvider

  class CvStore {
    <<module>>
    +listCvs()
    +getCv(id)
    +saveCv(cv)
    +deleteCv(id)
  }
  class ProfileStore {
    <<module>>
    +getProfile()
    +saveProfile(p)
  }
  class SourceStore {
    <<module>>
    +saveSourcePdf(id, buf)
    +getSourcePdf(id)
  }
  class FileStore {
    <<module>>
    +readJson(path, schema)
    +writeJsonAtomic(path, data)
  }

  LibraryPage --> ServerActions
  ImportPage --> ServerActions
  EditorPage --> ServerActions
  EditorPage --> ClassicTemplate
  EditorPage --> PageFit
  PrintPage --> ClassicTemplate

  ServerActions --> PdfExtractor
  ServerActions --> PiiDetector
  ServerActions --> Redactor
  ServerActions --> Rehydrator
  ServerActions --> LlmService
  ServerActions --> JobFetcher
  ServerActions --> FabricationChecker
  ServerActions --> CvStore
  ServerActions --> ProfileStore
  ServerActions --> SourceStore

  LlmService --> OutboundGuard : every call
  LlmService --> ProviderFactory
  ProviderFactory ..> LanguageModel : creates
  AnthropicProvider ..|> LanguageModel
  OpenRouterProvider ..|> LanguageModel
  OpenAICompatibleProvider ..|> LanguageModel

  OutboundGuard ..> ProfileStore : reads vault
  Rehydrator ..> ProfileStore : reads vault
  Redactor ..> ProfileStore : writes vault

  CvStore --> FileStore
  ProfileStore --> FileStore
  SourceStore --> FileStore
```

Key points:

- `ServerActions` is the only thing that coordinates the other modules; pages never call stores or the LLM directly.
- `LlmService` cannot reach a provider without going through `OutboundGuard`.
- Only the privacy modules and `ProfileStore` handle the vault.

## Delivery phases

Four phases: Phase 0 (mockups) is done, and Phases 1–3 are the build. Each build phase produces a working app.

**Phase 0: Mockups.** Done (v2 row on the canvas).

**Phase 1: Foundation, no AI.** ✅ Done (2026-10-05). Copy this plan to `docs/plan.md` · `docs/architecture.md`, with both class diagrams written from the drafts above · `bun run check` (`tsc --noEmit`, ESLint, Prettier, `knip`, `jscpd`) · `bun create next-app` (TS, App Router, Tailwind; Bun as package manager) · zod schema · `lib/store` + `profile.json` · Library · Editor form + Classic template preview · page-fit indicator · print export. Done when a CV can be created by hand, edited, autosaved and exported, and the diagrams match the code.

**Phase 2: Import.** ✅ Done (2026-10-05). Upload + `unpdf` extraction · detect/redact/vault · Import screen (chips, What's sent, Parse) · LLM adapter + guard + `structureCv` · Original PDF tab · Move to… menu · diagrams updated.

**Phase 3: Tailor.** ✅ Done (2026-10-05). Tailor panel (paste / fetch, language, length) · `tailorCv` · variant creation with `changes.original` · highlights + Revert · fabrication check · missing keywords · Tighten to fit · diagrams updated.

**Every phase ends with the Definition of done in `CLAUDE.md`:** `bun run check` + `bun test` pass → `/simplify` → `/code-review` → diagrams up to date → UI tried in the browser.

## Key files

- `CLAUDE.md`: project rules (privacy, persistence, lean-code rules, definition of done)
- `src/lib/cv/{schema,empty,format,page}.ts` (+ `fabrication.ts` in Phase 3). Empty values come from zod `.default()`s in the schema.
- `src/lib/store/{fs,profile,cvs,imports,sources}.ts`: `fs.ts` holds the atomic write and the zod-validated read
- `src/lib/privacy/{detect,redact,guard}.ts` (`redact.ts` also holds `rehydrate`)
- `src/lib/llm/{provider,generate,structure}.ts` (+ `tailor.ts`, `tighten.ts` in Phase 3)
- `src/lib/pdf/extract.ts` (+ `src/lib/job/fetch.ts` in Phase 3)
- `src/templates/Classic.tsx` (print CSS lives in `lib/cv/page.ts` + the print route)
- **Routes:**
  - `src/app/page.tsx` (Library) + `import-drop-zone.tsx`
  - `src/app/import/[id]/{page,import-review}.tsx`
  - `src/app/cv/[id]/page.tsx`
  - `src/app/cv/[id]/print/page.tsx`
  - `src/app/cv/[id]/source/route.ts`
- **Editor and actions:**
  - `src/components/editor/{Editor,fields,Preview,use-autosave}.tsx`
  - `src/app/actions.ts` (server actions)
- `.env.example`: `LLM_PROVIDER`, `LLM_MODEL`, `LLM_API_KEY`, `LLM_BASE_URL`, `DATA_DIR`
- `docs/architecture.md`: the class diagrams (data model + components) with short explanations

## Verification

- **Unit (`bun test`):** the detector against 3–4 fixture CVs; redact → rehydrate round trip; the guard throws when a vault value is in the payload; store round trip (save → read → zod-valid) and the atomic write leaves no partial file; fabrication check cases.
- **Privacy test:** a mock LLM provider records every request. Run import + tailor + tighten and assert that no vault value appears in any request.
- **Diagrams:** both Mermaid blocks render without errors (GitHub preview or `bunx @mermaid-js/mermaid-cli`). At the end of each phase, check every module in `src/lib/**` and every schema in `schema.ts` against the diagram: each must appear, with no extras and no missing arrows.
- **Manual end-to-end:** import a real CV → compare with the original and fix → export (one page, correct filename) → tailor with pasted job text → revert a field → export the variant. Then switch `.env` to Ollama and repeat the import.
