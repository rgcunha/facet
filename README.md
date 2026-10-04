# CV Tool

Keep a base CV and tailored variants for each job you apply to, and export them to PDF. It runs locally; your data stays in a folder on your machine.

Status: all three phases are built: editing and PDF export, PDF import, and tailoring to job offers. See [docs/plan.md](docs/plan.md).

## Setup

Requires [Bun](https://bun.sh) (and Node.js, which Next.js runs on).

```bash
bun install
cp .env.example .env   # optional: change where data is stored
bun run dev            # http://localhost:3000
```

Your CVs are stored as JSON in `./data` (or `DATA_DIR`). Back up that folder to keep them.

## Import a CV from PDF

Drop a PDF on the start page. It's read on your computer and your personal details (name, email, phone, address, links, date of birth) are found and masked. The Import screen shows **exactly** the text that will be sent to the language model; you can unmask a detail, or select any other text (a referee's name, say) and mask it too. **Parse CV** then sends only that masked text; the real values are filled back in locally.

Importing needs a language model, configured in `.env` (see `.env.example`):

- **Claude:** `LLM_PROVIDER=anthropic`, `LLM_MODEL=claude-opus-5-5`, `LLM_API_KEY=<your Anthropic key>`
- **OpenRouter, Ollama, LM Studio:** `LLM_PROVIDER=openai-compatible`, plus `LLM_BASE_URL`, `LLM_MODEL` and, if needed, `LLM_API_KEY`

Scanned PDFs (images without a text layer) can't be imported yet.

## Tailor a CV to a job

On a CV, click **Tailor…** and paste the job description; **Fetch** can load it from a link on sites that allow it. Choose the output language and length, then **Create tailored variant**. Your CV (without your contact details, and with every masked value replaced) and the job text are sent to the language model.

The variant opens in the editor, and everything the model changed is highlighted:

- **Was: …** under the headline and summary; **Changed** / **Added** on entries; **Removed** and **Reordered** notes per section. Each change has **Revert** and **Keep**, and the banner has **Revert all** and **Keep all**.
- **Not in your base CV:** if the model added an employer, title, date, degree or skill that your base CV doesn't contain, you get a warning. This check runs on your computer, not by the model. Keep it only if it's true.
- **Not in your CV:** the job's requirements your CV doesn't show. Add them yourself only if they're true.
- **Base CV** tab: compare with the CV you started from.

If a CV runs over its page target, **Tighten to fit** asks the model to shorten it. Its edits can be reverted the same way.

Variants are listed under their base CV. Deleting a base CV deletes its variants. The exported file is named `Your-Name_Company`.

## Export to PDF

**Export PDF** opens a print view and the browser's print dialog. Choose **Save as PDF**. The file name is filled in as `Your-Name_CV-Title`. In Chrome, untick "Headers and footers" if it's on.

## Development

- `bun test`: unit tests
- `bun run check`: types, lint, formatting, unused code (`knip`) and duplication (`jscpd`)
- `bun run format`: apply Prettier

Project rules are in [CLAUDE.md](CLAUDE.md); the architecture is in [docs/architecture.md](docs/architecture.md).
