# Architecture

These diagrams describe the code **as it is now**, at the end of Phase 2: editing and export (Phase 1), plus PDF import with the privacy layer and the LLM adapter. Tailoring (Phase 3) is drafted in [plan.md](plan.md#architecture-documentation-class-diagrams) and moves here when it is built.

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

## 1. Data model

```mermaid
classDiagram
  direction LR
  class Profile {
    <<schema>>
    +v: 1
    +contact: Contact
    +vault: PrivateValue[]
  }
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
    +content: CvContent
    +createdAt: datetime
    +updatedAt: datetime
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
    +contact: Contact
    +content: CvContent
  }

  Profile "1" *-- "1" Contact
  Profile "1" *-- "0..*" PrivateValue : vault
  ImportDraft "1" *-- "0..*" PrivateValue : detected
  CvRecord --> CvKind
  CvRecord "1" *-- "1" CvContent
  CvContent "1" *-- "0..*" Experience
  CvContent "1" *-- "0..*" Education
  CvContent "1" *-- "0..*" SkillGroup
  CvContent "1" *-- "0..*" Project
  CvContent "1" *-- "0..*" Language
  CvContent "1" *-- "0..*" CustomSection
  CvRecord "0..*" --> "0..1" CvRecord : variant of (baseId)
  ImportDraft ..> CvRecord : parsed into (sourcePdf = draft id)
  EditorValues ..> Contact : saved to Profile (only when edited)
  EditorValues ..> CvContent : saved to CvRecord
```

- **Personal data lives only in `Profile` and `ImportDraft`**, both local files: `data/profile.json` and `data/imports/<id>.json`. A `CvRecord` (`data/cvs/<id>.json`) never holds `Contact`. Every CV is rendered by combining its `CvContent` with the profile's `Contact`.
- **The vault** holds every value the user chose to mask in an import (`PrivateValue`). Outgoing LLM text is masked with those values and checked against them.
- **`CvContent` is the only CV structure that is sent to an LLM**, and only after masking.
- **An `ImportDraft`** exists between upload and "Parse CV". It holds the extracted text, which still contains personal data, so it never leaves the machine. Parsing creates a `CvRecord` whose `sourcePdf` keeps the draft's PDF (`data/sources/<id>.pdf`) for the "Original PDF" tab, then deletes the draft.
- **`EditorValues`** is what the editor form edits. On save it is split: the CV fields go to the CV file, and `contact` goes to the profile only when it was edited in that editor.
- **`kind` / `baseId`** are already in the file format, so tailored variants (Phase 3) need no migration. Today every CV is a `base`.
- **Defaults live in the schema** (zod `.default()`). Empty CVs and blank entries are derived from it, and older files that lack a newer field (e.g. `sourcePdf`, `vault`) read back with its default.

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
    import banner
  }
  class Fields {
    <<component>>
    Card, Grid, TextField, ItemList
    StringListField, CommaListField, MoveToRole
  }
  class Preview {
    <<component>>
    page-fit indicator
    Preview / Original PDF tabs
  }
  class Classic {
    <<component>>
    +render(contact, content)
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
    +saveContactAction(contact)
    +uploadPdfAction(file)
    +parseImportAction(importId, masked)
    +cancelImportAction(importId)
  }

  class PdfExtractor {
    <<module>>
    +extractLines(bytes)
  }
  class PiiDetector {
    <<module>>
    +detectPrivate(lines)
  }
  class Redactor {
    <<module>>
    TOKEN_PATTERN
    +sameValue(a, b)
    +toMasks(values)
    +redact(text, masks)
    +rehydrate(data, masks)
  }
  class OutboundGuard {
    <<module>>
    +assertNoPrivateData(payload, values)
  }

  class StructureCv {
    <<module>>
    +structureCv(text, privateValues)
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
  class ProfileStore {
    <<module>>
    +getProfile()
    +updateProfile(patch)
    +recordImport(masked)
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
    +emptyProfile()
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
  EditorPage --> ProfileStore : getProfile
  EditorPage --> Editor
  PrintPage --> CvStore
  PrintPage --> ProfileStore
  PrintPage --> Classic
  PrintPage --> AutoPrint
  PrintPage --> PageGeometry
  SourceRoute --> CvStore
  SourceRoute --> SourceStore : getSourcePdf

  Editor --> Fields
  Editor --> Preview
  Editor --> useAutosave
  Editor --> Format : entry summaries
  Fields --> EmptyValues : blankItem
  Classic --> Format
  useAutosave --> ServerActions : saveCvAction, saveContactAction (only if edited)
  Preview --> Classic
  Preview --> PageGeometry
  Preview ..> SourceRoute : Original PDF tab

  ServerActions --> PdfExtractor
  ServerActions --> PiiDetector
  ServerActions --> StructureCv
  ServerActions --> CvStore
  ServerActions --> ImportStore
  ServerActions --> ProfileStore : recordImport

  StructureCv --> LlmGenerate
  LlmGenerate --> Redactor : mask before, restore after
  LlmGenerate --> OutboundGuard : every call
  LlmGenerate --> ProviderFactory
  ProviderFactory ..> LanguageModel : creates
  AnthropicProvider ..|> LanguageModel
  OpenAICompatibleProvider ..|> LanguageModel

  PiiDetector --> Redactor : sameValue
  ProfileStore --> Redactor : sameValue
  CvStore --> FileStore
  CvStore --> SourceStore : deleteSourcePdf
  ImportStore --> SourceStore : save / delete PDF
  ImportStore --> FileStore
  SourceStore --> FileStore
  ProfileStore --> FileStore
  CvStore --> EmptyValues
  ProfileStore --> EmptyValues
```

- **Every LLM call goes through `LlmGenerate.generateStructured`.** It masks the prompt with `Redactor` (the same `redact` the Import screen uses for its "What's sent" preview, so the preview is exactly what is sent). `OutboundGuard` then blocks the request if any private value is still present, even reformatted (e.g. a phone number with different separators), before anything leaves the machine. The model's answer is rehydrated locally: placeholders such as `{{URL_2}}` become the real values again.
- **Vendor-agnostic:** only `ProviderFactory` knows about vendors, and it picks one from `.env` (`LLM_PROVIDER`, `LLM_MODEL`, `LLM_API_KEY`, `LLM_BASE_URL`). `anthropic` uses Claude; `openai-compatible` covers OpenRouter, Ollama, LM Studio and similar.
- **Import is two steps.**
  1. `uploadPdfAction` reads the PDF locally (`PdfExtractor`, pdf.js) and finds personal details (`PiiDetector`, regexes and font size, no network). It stores an `ImportDraft`.
  2. `parseImportAction` sends the masked text to the model (`StructureCv`), records the import in the profile, and creates the CV. `recordImport` fills only empty contact fields, and only from values the user kept masked, so an import never overwrites the shared contact details. It also adds the masked values to the vault.
  3. **Cancel import** discards the draft and its PDF. Leftovers from imports that were never parsed (e.g. the tab was closed) are discarded at the next upload, so unmasked CV text doesn't pile up in `data/imports/`.
- **Pages read data on the server** via the stores; **every write goes through `ServerActions`**, which validate their input with zod. Client components never touch the file system.
- **Only `lib/store/*` uses `node:fs`.** Every file (JSON and PDF) is written atomically through `FileStore.writeFileAtomic`, and JSON is validated on every read. Ids from URLs are checked with `isSafeId`, so a URL can't reach outside `DATA_DIR`.
- **Personal data:**
  - **Read or written by:** `ProfileStore` (contact + vault), `ImportStore` (draft text), `SourceStore` (original PDFs) and the import actions.
  - **Shown by:** `Classic`, the editor's Contact card and `ImportReview`.
  - **Sent to the model:** only masked text, via `LlmGenerate`.
