# Exported Files and Release Bundles

Status: Draft

The documentation site is for browsing and searching working Markdown documents. Exports and releases are for formal review packets.

## Main Difference

- Use the documentation site when leaders need to read, search, or review working material.
- Use exports when leaders need PDF, DOCX, PPTX, or spreadsheet files for a meeting packet.
- Use releases when the church needs a dated bundle of review files.

## Source Files

The main release source files live in `dist/`:

- `dist/leadership-review-packet.md`
- `dist/one-page-congregational-summary.md`
- `dist/congregational-slide-deck.md`
- `dist/leadership-review-task-tracker.csv`

The Bookkeeper job description export is generated from:

- `docs/roles/bookkeeper-financial-administrator-job-description.md`

## Generated Files

Generated review files are placed in `dist/exports/`.

Dated release bundles are placed in `dist/releases/YYYY-MM-DD/` and zipped as `dist/releases/YYYY-MM-DD.zip`.

Generated files are not the long-term source of truth. If a PDF, DOCX, PPTX, or spreadsheet needs a content change, update the Markdown or CSV source first and regenerate the exports.

## Commands

Run:

```sh
make export
```

to create review files and validate them.

Run:

```sh
make release
```

to create a dated release bundle.

## GitHub Pages Warning

The MkDocs site can be deployed to GitHub Pages, but GitHub Pages may expose content publicly depending on repository, account, organization, and Pages settings.

Do not deploy the documentation site until church leadership has reviewed the content and is comfortable with the exposure risk.
