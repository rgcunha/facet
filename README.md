# CV Tool

Keep a base CV and tailored variants for each job you apply to, and export them to PDF. It runs locally; your data stays in a folder on your machine.

Status: **Phase 2** (editing, PDF export, PDF import). Tailoring to job offers comes next; see [docs/plan.md](docs/plan.md).

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

## Export to PDF

**Export PDF** opens a print view and the browser's print dialog. Choose **Save as PDF**. The file name is filled in as `Your-Name_CV-Title`. In Chrome, untick "Headers and footers" if it's on.

## Development

- `bun test`: unit tests
- `bun run check`: types, lint, formatting, unused code (`knip`) and duplication (`jscpd`)
- `bun run format`: apply Prettier

Project rules are in [CLAUDE.md](CLAUDE.md); the architecture is in [docs/architecture.md](docs/architecture.md).
