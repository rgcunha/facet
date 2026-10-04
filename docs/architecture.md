# Architecture

These diagrams describe the code **as it is now**, at the end of Phase 1: no AI yet. Components planned for Phases 2–3 (import, privacy layer, LLM adapter, tailoring) are drafted in [plan.md](plan.md#architecture-documentation-class-diagrams) and move here when they're built.

**Notation:** the code is plain TypeScript modules and React components rather than classes. Each one is drawn as a class with a stereotype:

- `<<schema>>`: a zod schema / type in `src/lib/cv/schema.ts`
- `<<module>>`: server-side code
- `<<page>>`: a Next.js route
- `<<component>>`: React UI
- `<<hook>>`: a React hook

Arrows mean:

- `*--`: contains
- `-->`: uses / calls
- `..>`: depends on loosely (reads/renders)

## 1. Data model

```mermaid
classDiagram
  direction LR
  class Profile {
    <<schema>>
    +v: 1
    +contact: Contact
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
  class CvRecord {
    <<schema>>
    +v: 1
    +id: string
    +kind: CvKind
    +title: string
    +baseId: string or null
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
  CvRecord --> CvKind
  CvRecord "1" *-- "1" CvContent
  CvContent "1" *-- "0..*" Experience
  CvContent "1" *-- "0..*" Education
  CvContent "1" *-- "0..*" SkillGroup
  CvContent "1" *-- "0..*" Project
  CvContent "1" *-- "0..*" Language
  CvContent "1" *-- "0..*" CustomSection
  CvRecord "0..*" --> "0..1" CvRecord : variant of (baseId)
  EditorValues ..> Contact : saved to Profile (only when edited)
  EditorValues ..> CvContent : saved to CvRecord
```

- **Contact details live only in `Profile`**, one per installation, stored in `data/profile.json`. A `CvRecord` (`data/cvs/<id>.json`) never contains them. Every CV is rendered by combining its `CvContent` with the profile's `Contact`.
- **`CvContent` is the only structure that may ever be sent to an LLM** (from Phase 2). Keeping `Contact` out of it by construction is what the privacy rules rely on.
- **`EditorValues`** is what the editor form edits. On save it is split: the CV fields go to the CV file, and `contact` goes to the profile only when it was edited in that editor. That way an editor open on another CV can't overwrite newer contact details.
- **`kind` / `baseId`** are already in the file format, so tailored variants (Phase 3) need no migration. Today every CV is a `base`.
- **Defaults live in the schema** (zod `.default()`). `EmptyValues` derives empty CVs and blank entries from it, and older files that lack a newer field read back with its default.

## 2. Components

```mermaid
classDiagram
  direction TB
  class LibraryPage
  <<page>> LibraryPage
  class EditorPage
  <<page>> EditorPage
  class PrintPage
  <<page>> PrintPage

  class DeleteCvButton
  <<component>> DeleteCvButton
  class Editor {
    <<component>>
    +exportPdf()
  }
  class Fields {
    <<component>>
    Card, Grid, TextField
    StringListField, CommaListField, ItemList
  }
  class Preview {
    <<component>>
    page-fit indicator
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
  }
  class CvStore {
    <<module>>
    +listCvs()
    +getCv(id)
    +createCv(title)
    +updateCv(id, patch)
    +deleteCv(id)
  }
  class ProfileStore {
    <<module>>
    +getProfile()
    +saveProfile(profile)
  }
  class FileStore {
    <<module>>
    +dataPath(...)
    +readJson(file, schema)
    +writeJsonAtomic(file, data)
    +listJsonFiles(dir)
  }
  class PageGeometry {
    <<module>>
    PAGE, PRINT_PAGE_CSS
    +exportFileName(name, title)
  }
  class EmptyValues {
    <<module>>
    UNTITLED_CV
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
  }

  LibraryPage --> CvStore : listCvs
  LibraryPage --> ServerActions : create
  LibraryPage --> DeleteCvButton
  DeleteCvButton --> ServerActions : delete
  EditorPage --> CvStore : getCv
  EditorPage --> ProfileStore : getProfile
  EditorPage --> Editor
  PrintPage --> CvStore : getCv
  PrintPage --> ProfileStore : getProfile
  PrintPage --> Classic
  PrintPage --> AutoPrint
  PrintPage --> PageGeometry

  Editor --> Fields
  Editor --> Preview
  Editor --> useAutosave
  Editor --> Format : entry summaries
  Fields --> EmptyValues : blankItem
  Classic --> Format
  useAutosave --> ServerActions : saveCvAction, saveContactAction (only if edited)
  Preview --> Classic
  Preview --> PageGeometry

  ServerActions --> CvStore
  ServerActions --> ProfileStore
  CvStore --> FileStore
  CvStore --> EmptyValues
  ProfileStore --> FileStore
  ProfileStore --> EmptyValues
```

- **Pages read data on the server** via the stores (`getCv`, `getProfile`, `listCvs`). **Every write goes through `ServerActions`**, which validate their input with zod before calling a store. Client components never touch the file system.
- **`CvStore.updateCv` owns the merge and `updatedAt`.** `createCv` never reuses an existing id.
- **Only `FileStore` uses `node:fs`.** It validates every read with the zod schemas and writes atomically (temp file + rename). `CvStore` also rejects ids that aren't plain slugs, so a URL can't reach outside `DATA_DIR`.
- **One template, two consumers.** `Classic` is pure markup, used both by the live `Preview` and by the print route. Both take the A4 size and margins from `PageGeometry`, so the page-fit indicator and the exported PDF agree.
- **Personal data in Phase 1:** contact details are read and written only by `ProfileStore`, and shown by `Classic` and the editor's Contact card. Nothing is sent outside the machine yet. From Phase 2, the privacy layer and the LLM adapter (see the plan) attach to `ServerActions`.
