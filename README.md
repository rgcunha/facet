# CV Tool

Keep a base CV and tailored variants for each job you apply to, and export them to PDF. It runs locally; your data stays in a folder on your machine.

Status: **Phase 1** (manual editing + PDF export). PDF import and tailoring come next; see [docs/plan.md](docs/plan.md).

## Setup

Requires [Bun](https://bun.sh) (and Node.js, which Next.js runs on).

```bash
bun install
cp .env.example .env   # optional: change where data is stored
bun run dev            # http://localhost:3000
```

Your CVs are stored as JSON in `./data` (or `DATA_DIR`). Back up that folder to keep them.

## Export to PDF

**Export PDF** opens a print view and the browser's print dialog. Choose **Save as PDF**. The file name is filled in as `Your-Name_CV-Title`. In Chrome, untick "Headers and footers" if it's on.

## Development

- `bun test`: unit tests
- `bun run check`: types, lint, formatting, unused code (`knip`) and duplication (`jscpd`)
- `bun run format`: apply Prettier

Project rules are in [CLAUDE.md](CLAUDE.md); the architecture is in [docs/architecture.md](docs/architecture.md).
