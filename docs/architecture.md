# Architecture

These diagrams describe the code **as it is now**, at the end of Phase 3: editing and export (Phase 1), PDF import with the privacy layer and the LLM adapter (Phase 2), and tailoring to job offers with tracked changes (Phase 3).

**Notation:** the code is plain TypeScript modules and React components rather than classes. Each one is drawn as a class with a stereotype:

- `<<schema>>`: a zod schema / type in `src/lib/cv/schema.ts`
- `<<module>>`: server-side code
- `<<page>>`: a Next.js route
- `<<component>>`: React UI
- `<<hook>>`: a React hook
- `<<interface>>`: the AI SDK's `LanguageModel`

Arrows mean:

- `*--`: contains
- `-->`: uses / calls
- `..>`: depends on loosely (reads/renders)
- `..|>`: implements
- `--|>`: extends

## 1. Data model

```mermaid
classDiagram
  direction LR
  class Contact {
    <<schema>>
    +name: string
    +email: string
    +phone: string
    +location: string
    +dateOfBirth: string
    +links: string[]
  }
  class PrivateValue {
    <<schema>>
    +kind: name, email, phone, address, url, dob or custom
    +value: string
  }
  class ImportDraft {
    <<schema>>
    +v: 1
    +id: string
    +fileName: string
    +pageCount: number
    +text: string
    +detected: PrivateValue[]
    +createdAt: datetime
  }
  class CvRecord {
    <<schema>>
    +v: 1
    +id: string
    +kind: CvKind
    +title: string
    +baseId: string or null
    +sourcePdf: string or null
    +language: string
    +pages: 1 or 2
    +template: classic, sidebar or modern
    +contact: Contact
    +vault: PrivateValue[]
    +content: CvContent
    +job: Job or null
    +changes: Changes
    +createdAt: datetime
    +updatedAt: datetime
  }
  class Job {
    <<schema>>
    +title, company, url, text, language
    +report: MatchReport or null
  }
  class Analysis {
    <<schema>>
    +title: string
    +yearsRequired: number or null
    +requirements: Requirement[]
    +strengths, missing, suggestions: string[]
    +gaps: name and why
  }
  class MatchReport {
    <<schema>>
    Analysis plus
    +confirmed: string[]
    +createdAt: datetime
  }
  class Requirement {
    <<schema>>
    +name: string
    +synonyms: string[]
    +priority: must or nice
  }
  class Suggestion {
    <<schema>>
    +area: headline, summary, a list section or whole
    +entryId: string or null
    +problem, detail: string
    +kind: fix or yours
  }
  class Changes {
    <<schema>>
    +original: key to previous value
    +flags: Flag[]
  }
  class Flag {
    <<schema>>
    +key: string
    +facts: string[]
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
    +id, role, company, location, start, end
    +highlights: string[]
  }
  class Education {
    <<schema>>
    +id, degree, institution, location, start, end, details
  }
  class SkillGroup {
    <<schema>>
    +id, group
    +items: string[]
  }
  class Project {
    <<schema>>
    +id, name, link, description
  }
  class Language {
    <<schema>>
    +id, name, level
  }
  class CustomSection {
    <<schema>>
    +id, title
    +items: string[]
  }
  class EditorValues {
    <<schema>>
    +title: string
    +pages: 1 or 2
    +template: classic, sidebar or modern
    +contact: Contact
    +content: CvContent
    +changes: Changes
  }

  CvRecord "1" *-- "1" Contact
  CvRecord "1" *-- "0..*" PrivateValue : vault
  ImportDraft "1" *-- "0..*" PrivateValue : detected
  CvRecord --> CvKind
  CvRecord "1" *-- "1" CvContent
  CvRecord "1" *-- "0..1" Job
  Job "1" *-- "0..1" MatchReport
  MatchReport --|> Analysis : extends
  Analysis "1" *-- "0..*" Requirement
  CvRecord "1" *-- "1" Changes
  Changes "1" *-- "0..*" Flag
  CvContent "1" *-- "0..*" Experience
  CvContent "1" *-- "0..*" Education
  CvContent "1" *-- "0..*" SkillGroup
  CvContent "1" *-- "0..*" Project
  CvContent "1" *-- "0..*" Language
  CvContent "1" *-- "0..*" CustomSection
  CvRecord "0..*" --> "0..1" CvRecord : variant of (baseId)
  ImportDraft ..> CvRecord : parsed into (sourcePdf = draft id)
  EditorValues ..> CvRecord : saved to
```

- **Personal data lives only in local files**: each `CvRecord` (`data/cvs/<id>.json`) holds its own `Contact` and `vault`, and `ImportDraft` (`data/imports/<id>.json`) holds raw text. Contact is a sibling of `CvContent`, never inside it. Each CV is rendered by combining its `CvContent` with its own `Contact`, so a CV imported for someone else carries that person's details.
- **The vault** holds the values the user chose to mask when the CV was imported (`PrivateValue`: custom masks, extra emails…). Outgoing LLM text is masked with the vault plus the CV's current `Contact` (`privateValuesOf`), so edited details count too, and checked against them.
- **`CvContent` is the only CV structure that is sent to an LLM**, and only after masking.
- **An `ImportDraft`** exists between upload and "Parse CV". It holds the extracted text, which still contains personal data, so it never leaves the machine. Parsing creates a `CvRecord` whose `sourcePdf` keeps the draft's PDF (`data/sources/<id>.pdf`) for the "Original PDF" tab, then deletes the draft.
- **`EditorValues`** is what the editor form edits (title, pages, contact, content, changes) and autosaves into the CV file.
- **A variant** (`kind: variant`, `baseId`) is an independent copy of the CV it was tailored from (contact and vault included), plus the `Job` it targets. Editing the base later doesn't change it.
- **`Suggestion`** is one finding of a review. It isn't stored: the Review panel holds the list until it's closed. `fix` can be fixed from what the CV already says; `yours` needs something only the user knows (a real number), so it's shown without a checkbox and never sent to Apply.
- **`Changes`** records what tailoring, a review or "Tighten to fit" changed, until the user reverts or keeps each change. `original` maps a key to what was there before:
  - `headline` / `summary`
  - `<section>.<entryId>`: an entry that was changed, added (`null`) or removed
  - `<section>.order`: the previous order of the entries
  - Entries are tracked by their ids, which the model must keep, so changes survive reordering.
  - `flags` are possible fabrications, each pointing at one of those keys: new facts in an entry, or new numbers anywhere the model rewrote (summary, highlights, descriptions).
- **Defaults live in the schema** (zod `.default()`). Empty CVs and blank entries are derived from it, and older files that lack a newer field (e.g. `sourcePdf`) read back with its default.

## 2. Components

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
  class SourceRoute {
    <<page>>
    GET original PDF
  }

  class ImportDropZone
  <<component>> ImportDropZone
  class ImportReview {
    <<component>>
    masks, what is sent, Parse
  }
  class DeleteCvButton
  <<component>> DeleteCvButton
  class Editor {
    <<component>>
    +exportPdf()
    +revise(request, masks)
    import banner
    right pane: panels kept in Activity once opened
    +track(panel, run) running in header, reopens on error
  }
  class TailorPanel {
    <<component>>
    job text, fetch, language, length
    Analyze, confirm gaps, Create variant
  }
  class ReviewPanel {
    <<component>>
    review on first open, kept while closed
    suggestion checkboxes, Apply, Ask for something else, flagged names
  }
  class MatchReportView {
    <<component>>
    MatchReport, LiveScoreChange, useBaseScore
  }
  class ChangeControls {
    <<component>>
    useChanges, ChangeRow, ChangesBanner
    FabricationWarnings
    FieldChange, EntryChange, SectionChanges
  }
  class Fields {
    <<component>>
    Card, Grid, TextField, ItemList
    StringListField, CommaListField
  }
  class Preview {
    <<component>>
    page-fit indicator, Tighten to fit
    Preview / Original PDF or Base CV / Match report tabs
  }
  class Templates {
    <<component>>
    TEMPLATES: Classic, Sidebar, Modern
    +render(contact, content)
    parts: printable, Bullets, languagesLine
  }
  class TemplateInfo {
    <<module>>
    TEMPLATE_INFO: name, singleColumn, wordsPerLine
  }
  class AutoPrint
  <<component>> AutoPrint
  class useAutosave {
    <<hook>>
    +status
    +flush()
  }

  class ServerActions {
    <<module>>
    +createCvAction()
    +deleteCvAction(id)
    +saveCvAction(id, fields)
    +uploadPdfAction(file)
    +parseImportAction(importId, masked)
    +cancelImportAction(importId)
    +analyzeAction(cvId, jobText)
    +tailorAction(cvId, job, report, confirmed)
    +reviewAction(cvId)
    +reviseAction(cvId, tighten or suggestions or instruction, masks)
    +fetchJobAction(url)
  }
  class Changes {
    <<module>>
    +recordChanges(previous, before, after, base, translated, knownSkills)
    +diffContent(before, after)
    +findFabrications(known, variant, original, translated, knownSkills)
    +revertChange(content, changes, key)
    +keepChange(changes, key)
    +revertAll(content, changes)
    +changeKind(original, section, id)
  }
  class JobFetcher {
    <<module>>
    +fetchJobText(url)
  }

  class PdfExtractor {
    <<module>>
    +extractLines(bytes)
  }
  class PiiDetector {
    <<module>>
    +detectPrivate(lines)
    +detectInText(text, content)
  }
  class Redactor {
    <<module>>
    TOKEN_PATTERN
    +sameValue(a, b)
    +toMasks(values)
    +redact(text, masks)
    +rehydrate(data, masks)
  }
  class PrivateValues {
    <<module>>
    +contactFromValues(values)
    +privateValuesOf(cv)
  }
  class OutboundGuard {
    <<module>>
    +assertNoPrivateData(payload, values)
  }

  class StructureCv {
    <<module>>
    +structureCv(text, privateValues)
  }
  class AnalyzeCv {
    <<module>>
    +analyzeCv(content, jobText, privateValues)
  }
  class TailorCv {
    <<module>>
    +tailorCv(content, jobText, options with report, privateValues)
  }
  class MatchScore {
    <<module>>
    +scoreCv(cv, report)
  }
  class Parsability {
    <<module>>
    +readabilityChecks(cv with template)
  }
  class Dates {
    <<module>>
    +parseDate(text)
  }
  class ReviewCv {
    <<module>>
    +reviewCv(content, privateValues, keep)
  }
  class ReviseCv {
    <<module>>
    +reviseCv(content, instruction, privateValues, keep)
    +tightenInstruction(overflowLines, wordsPerLine)
    +applyInstruction(suggestions)
  }
  class LlmContent {
    <<module>>
    +modelContentSchema(ids)
    +withIds(parsed, known)
    CV_PRACTICE, NO_NEW_FACTS_RULE, keepTermsRule
  }
  class LlmGenerate {
    <<module>>
    +generateStructured(schema, system, prompt, privateValues)
  }
  class ProviderFactory {
    <<module>>
    +getModel()
  }
  class LanguageModel
  <<interface>> LanguageModel
  class AnthropicProvider
  class OpenAICompatibleProvider

  class CvStore {
    <<module>>
    +listCvs()
    +getCv(id)
    +createCv(title, init)
    +updateCv(id, patch)
    +deleteCv(id)
    +getBase(cv)
  }
  class ImportStore {
    <<module>>
    +createImport(pdf, draft)
    +getImport(id)
    +deleteImport(id)
    +discardImport(id)
    +discardAllImports()
  }
  class SourceStore {
    <<module>>
    +saveSourcePdf(id, pdf)
    +getSourcePdf(id)
    +deleteSourcePdf(id)
  }
  class FileStore {
    <<module>>
    +dataPath(...)
    +isSafeId(id)
    +readJson(file, schema)
    +writeFileAtomic(file, data)
    +writeJsonAtomic(file, data)
    +listJsonFiles(dir)
  }
  class PageGeometry {
    <<module>>
    PAGE, PAGE_VARS, PRINT_PAGE_CSS
    +exportFileName(name, title)
  }
  class EmptyValues {
    <<module>>
    UNTITLED_CV, shortId
    +emptyContent()
    +blankItem
  }
  class Format {
    <<module>>
    +filled(values)
    +joinFilled(values)
    +range(start, end)
    +visible(entries)
    +plural(n, word)
    +fold(s)
    +normalize(s)
    +emphasis(text)
    +entryValues(entry)
    +cvText(content)
    +digits(s)
    SECTION_TITLES
  }

  LibraryPage --> CvStore : listCvs
  LibraryPage --> ImportDropZone
  LibraryPage --> DeleteCvButton
  LibraryPage --> ServerActions : create
  ImportDropZone --> ServerActions : uploadPdfAction
  DeleteCvButton --> ServerActions : delete
  ImportPage --> ImportStore : getImport
  ImportPage --> ImportReview
  ImportReview --> Redactor : preview of what is sent
  ImportReview --> ServerActions : parseImportAction, cancelImportAction
  EditorPage --> CvStore : getCv
  EditorPage --> Editor
  PrintPage --> CvStore
  PrintPage --> Templates : the CV's template
  PrintPage --> AutoPrint
  PrintPage --> PageGeometry
  SourceRoute --> CvStore
  SourceRoute --> SourceStore : getSourcePdf

  Editor --> Fields
  Editor --> Preview
  Editor --> TailorPanel
  Editor --> ChangeControls
  Editor --> ReviewPanel
  Editor --> ServerActions : reviseAction
  ReviewPanel --> ServerActions : reviewAction
  ReviewPanel --> PiiDetector : detectInText, in the browser
  ReviewPanel --> Format : SECTION_TITLES
  PiiDetector --> Format : cvText
  Changes --> Format : cvText, digits
  Fields --> ChangeControls : entry and section notes
  ChangeControls --> Changes : revert, keep
  Fields --> Changes : changeKind
  TailorPanel --> ServerActions : analyzeAction, tailorAction, fetchJobAction
  TailorPanel --> MatchReportView : with gap checkboxes
  Editor --> MatchReportView : score in header, report tab
  MatchReportView --> MatchScore : live, in the browser
  MatchScore --> Parsability
  MatchScore --> Dates
  Parsability --> Dates
  Editor --> useAutosave
  Editor --> Format : entry summaries
  Fields --> EmptyValues : blankItem
  Templates --> Format
  useAutosave --> ServerActions : saveCvAction
  Preview --> Templates : template picker
  Preview --> TemplateInfo
  Parsability --> TemplateInfo : one column
  ServerActions --> TemplateInfo : words per line (tighten)
  Preview --> PageGeometry
  Preview ..> SourceRoute : Original PDF tab
  EditorPage --> CvStore : getBase (Base CV tab)

  ServerActions --> PdfExtractor
  ServerActions --> PiiDetector
  ServerActions --> StructureCv
  ServerActions --> AnalyzeCv
  ServerActions --> TailorCv
  ServerActions --> ReviewCv
  ServerActions --> ReviseCv
  ServerActions --> MatchScore : a variant's terms to keep
  ServerActions --> JobFetcher
  ServerActions --> Changes : recordChanges
  ServerActions --> CvStore
  ServerActions --> ImportStore
  ServerActions --> PrivateValues : contactFromValues, privateValuesOf

  StructureCv --> LlmGenerate
  AnalyzeCv --> LlmGenerate
  TailorCv --> LlmGenerate
  ReviewCv --> LlmGenerate
  ReviseCv --> LlmGenerate
  StructureCv --> LlmContent
  TailorCv --> LlmContent
  ReviewCv --> LlmContent
  ReviseCv --> LlmContent
  LlmGenerate --> Redactor : mask before, restore after
  LlmGenerate --> OutboundGuard : every call
  LlmGenerate --> ProviderFactory
  ProviderFactory ..> LanguageModel : creates
  AnthropicProvider ..|> LanguageModel
  OpenAICompatibleProvider ..|> LanguageModel

  PiiDetector --> Redactor : sameValue
  PrivateValues --> Redactor : sameValue
  CvStore --> FileStore
  CvStore --> SourceStore : deleteSourcePdf
  ImportStore --> SourceStore : save / delete PDF
  ImportStore --> FileStore
  SourceStore --> FileStore
  CvStore --> EmptyValues
```

- **Every LLM call goes through `LlmGenerate.generateStructured`.** It masks the prompt with `Redactor` (the same `redact` the Import screen uses for its "What's sent" preview, so the preview is exactly what is sent). `OutboundGuard` then blocks the request if any private value is still present, even reformatted (e.g. a phone number with different separators), before anything leaves the machine. The model's answer is rehydrated locally: placeholders such as `{{URL_2}}` become the real values again.
- **Vendor-agnostic:** only `ProviderFactory` knows about vendors, and it picks one from `.env` (`LLM_PROVIDER`, `LLM_MODEL`, `LLM_API_KEY`, `LLM_BASE_URL`). `anthropic` uses Claude; `openai-compatible` covers OpenRouter, Ollama, LM Studio and similar.
- **Import is two steps.**
  1. `uploadPdfAction` reads the PDF locally (`PdfExtractor`, pdf.js) and finds personal details (`PiiDetector`, regexes and font size, no network). It stores an `ImportDraft`.
  2. `parseImportAction` sends the masked text to the model (`StructureCv`) and creates the CV. The new CV's `Contact` comes from the values the user kept masked (`contactFromValues`), and those values also become its vault.
  3. **Cancel import** discards the draft and its PDF. Leftovers from imports that were never parsed (e.g. the tab was closed) are discarded at the next upload, so unmasked CV text doesn't pile up in `data/imports/`.
- **Tailoring starts with a match report.**
  - `analyzeAction` sends the CV content and the job text, masked like tailoring, and returns the report: the job's requirements (must or nice, with synonyms), title and years asked, plus strengths, gaps (skills the CV suggests but doesn't show), missing skills and suggestions. It isn't saved; it lives in the Tailor panel until a variant is created from it.
  - The user ticks the gaps that are true. `tailorAction` passes the report and those confirmed skills to `tailorCv`, stores the report (with `confirmed` and `createdAt`) on the variant's `Job`, and `recordChanges` passes the confirmed skills to `findFabrications` as `knownSkills`, so they aren't flagged.
  - **The score is computed locally** (`MatchScore.scoreCv`, no model call), so it updates as the user edits: requirements found as whole words (or a synonym) in the CV text, title match, years of experience (overlapping roles counted once) and four ATS readability checks (`Parsability`). Weights: must-haves 50, title 20, nice-to-haves 15, readability 10, years 5; parts that don't apply are left out. A variant shows its base CV's score → its own.
- **Tailoring creates a variant.**
  - `tailorAction` sends the CV content (never `Contact`) and the job text. Both are masked with that CV's private values (`privateValuesOf`), so personal details in a pasted posting are masked too. The variant copies the CV's contact and vault.
  - Entry ids are kept, and `withIds` replaces any id the model invents or repeats.
  - `recordChanges` records every change (`diffContent`) and flags new facts (employers, roles, dates, degrees, skills) that appear neither in the base CV nor in what the user had before this round, so anything they kept stays kept (`findFabrications`). That check is done locally, not by the model.
  - When the variant is in another language than its base, only language-neutral facts are checked: employers, schools, dates, links and skills. The import step detects each CV's language for this.
  - Revert and Keep (`revertChange`, `keepChange`) update the changes and their flags together.
- **Review, Apply, Ask for something else and "Tighten to fit" edit a CV in place**, all through `reviseAction` → `reviseCv` with a different instruction: the ticked suggestions (`applyInstruction`), the user's own text, or "remove about N words" (`tightenInstruction`).
  - `reviewAction` runs when the Review panel opens and returns `Suggestion`s, judged against one checklist of good CV practice (`CV_PRACTICE`, shared with `reviseCv`) read for the candidate's field. Impact without a number counts; numbers are never invented.
  - On a variant, both get the job requirements the CV matches (`scoreCv(...).found`) as terms to keep, so a fix doesn't lower the match.
  - The user's instruction is scanned in the browser (`detectInText`): emails, links, phones, and capitalised word pairs that look like a person's name and aren't in the CV. Those are masked by default ("Send as written" unmasks one) and passed as extra private values for that request only; they aren't saved.
  - The editor is locked while the model edits, and the action only writes if the CV wasn't saved in the meantime, so no edit is lost. Changes are merged with earlier ones (the earliest version wins), so Revert always goes back to what you had, and `findFabrications` flags new facts and numbers.
- **Job pages are fetched best-effort** (`JobFetcher`: Readability + linkedom). Pasting the text is the main way in.
- **Pages read data on the server** via the stores; **every write goes through `ServerActions`**, which validate their input with zod. Client components never touch the file system.
- **Only `lib/store/*` uses `node:fs`.** Every file (JSON and PDF) is written atomically through `FileStore.writeFileAtomic`, and JSON is validated on every read. Ids from URLs are checked with `isSafeId`, so a URL can't reach outside `DATA_DIR`.
- **Personal data:**
  - **Read or written by:** `CvStore` (contact + vault, per CV), `ImportStore` (draft text), `SourceStore` (original PDFs) and the import actions.
  - **Shown by:** the templates, the editor's Contact card and `ImportReview`.
  - **Sent to the model:** only masked text, via `LlmGenerate`: import (the values the user kept masked), and analysis, tailoring, review and revising (that CV's contact and vault, plus any names masked in the user's instruction).
