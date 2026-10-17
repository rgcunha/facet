# Facet

Keep a base CV and tailored variants for each job you apply to, and export them to PDF. It runs locally; your data stays in a folder on your machine.

Status: all three phases are built: editing and PDF export, PDF import, and tailoring to job offers. See [docs/plan.md](docs/plan.md).

## Install on a Mac

Open **Terminal** (press ⌘-Space, type "Terminal", press Return), paste this line and press Return:

```bash
curl -fsSL https://github.com/rgcunha/facet/releases/latest/download/install.sh | bash
```

It asks for your OpenRouter key once, then opens Facet in your browser. After that, open **Facet** from Applications or Spotlight. No admin rights are needed. Exporting PDFs uses Google Chrome, so install it if you don't have it.

- **Update:** run the same line again. Your CVs and key are kept.
- **Your data** is in `~/Library/Application Support/Facet` (`data/` holds your CVs, `.env` your key). Back up that folder to keep them.
- **Uninstall:** delete `Facet` from `~/Applications` and the folder above.

To publish a new version for Mac users, commit, then run `bun run release:mac` (needs the [GitHub CLI](https://cli.github.com), logged in).

## Setup (from source)

Requires [Bun](https://bun.sh) (and Node.js, which Next.js runs on).

```bash
bun install
cp .env.example .env   # optional: change where data is stored
bun run dev            # http://localhost:3000
```

Your CVs are stored as JSON in `./data` (or `DATA_DIR`). Back up that folder to keep them.

## Import a CV from PDF

Drop a PDF on the start page. It's read on your computer and your personal details (name, email, phone, address, links, date of birth) are found and masked. The Import screen shows **exactly** the text that will be sent to the language model; you can unmask a detail, or select any other text (a referee's name, say) and mask it too. **Parse CV** then sends only that masked text; the real values are filled back in locally.

Importing needs a language model, configured in `.env` (see `.env.example`). `LLM_MODELS` lists the models you can pick in the app: comma-separated `id tier name`, where the tier is the rough cost of one run (`$` under 1¢, `$$` 1–5¢, `$$$` over 5¢) and the first is the default.

- **OpenRouter** (many vendors, one key; requests only go to providers that keep no data): `LLM_PROVIDER=openrouter`, `LLM_API_KEY=<your OpenRouter key>`, `LLM_MODELS="deepseek/deepseek-v4.1-flash $ DeepSeek V4.1 Flash, anthropic/claude-sonnet-5.5 $$$ Claude Sonnet 5.5"`
- **Claude:** `LLM_PROVIDER=anthropic`, `LLM_API_KEY=<your Anthropic key>`, `LLM_MODELS="claude-opus-5-5 $$$ Claude Opus 5.5"`
- **Ollama, LM Studio:** `LLM_PROVIDER=openai-compatible`, `LLM_BASE_URL`, `LLM_MODELS="<model> $"` and, if needed, `LLM_API_KEY`

Every button that calls the model has a **Model** picker beside it; your choice applies everywhere and is remembered. Each result shows which model wrote it and what it cost (or the tokens used, for providers that don't report a cost). If a model can't produce a valid answer, nothing changes and you're asked to pick another.

Scanned PDFs (images without a text layer) can't be imported yet.

## Review a CV

After importing, click **Review…**. The model checks your CV against good CV practice for your field (impact rather than duties, strong verbs, no filler, consistent tense and dates, a short summary) and lists what to improve. Untick anything you disagree with, then **Apply**. The changes are highlighted, and each can be reverted or kept, as with tailoring.

- Suggestions that need something only you know, such as a real number, have no checkbox: edit those yourself. The model never adds numbers, and if one appears that wasn't in your CV you get a warning.
- **Ask for something else** sends your own instruction ("make the latest role read more senior"). Names, emails, links and phone numbers in it are found on your computer and masked unless you choose **Send as written**.
- Review your base CV before tailoring: variants are copies and don't pick up later changes. On a variant, the review keeps the keywords the job asks for.

## Tailor a CV to a job

On a CV, click **Tailor to a job…** and paste the job description; **Fetch** can load it from a link on sites that allow it. Choose the output language and length, then **Create tailored variant**. Your CV (without your contact details, and with every masked value replaced) and the job text are sent to the language model.

The variant opens in the editor, and everything the model changed is highlighted:

- **Was: …** under the headline and summary; **Changed** / **Added** on entries; **Removed** and **Reordered** notes per section. Each change has **Revert** and **Keep**, and the banner has **Revert all** and **Keep all**.
- **Not in your base CV:** if the model added an employer, title, date, degree or skill that your base CV doesn't contain, you get a warning. This check runs on your computer, not by the model. Keep it only if it's true.
- **Not in your CV:** the job's requirements your CV doesn't show. Add them yourself only if they're true.
- **Base CV** tab: compare with the CV you started from.

If a CV runs over its page target, **Tighten to fit** asks the model to shorten it. Its edits can be reverted the same way.

Variants are listed under their base CV. Deleting a base CV deletes its variants. The exported file is named `Your-Name_Company`.

## Export to PDF

**Export PDF** downloads the CV as a PDF, named `Your-Name_CV-Title`. It's printed on your computer by Chromium (`bunx playwright install chromium`) or, if that isn't installed, by Google Chrome.

## Development

- `bun test`: unit tests
- `bun run check`: types, lint, formatting, unused code (`knip`) and duplication (`jscpd`)
- `bun run format`: apply Prettier

Project rules are in [CLAUDE.md](CLAUDE.md); the architecture is in [docs/architecture.md](docs/architecture.md).
