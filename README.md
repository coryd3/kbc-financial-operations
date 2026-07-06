# KBC Financial Operations

This repository is a working documentation system for Kingsville Baptist Church financial operations modernization.

It supports the current Treasurer transition, the review of finance and bookkeeping responsibilities, and the creation of clearer policies, procedures, job descriptions, committee responsibilities, and administrative documentation.

The purpose is not simply to replace one person with another person. The purpose is to build a financial system that is clear, accountable, transferable, and sustainable.

## Important Privacy Notice

Keep this repository private.

Do not store confidential or personally sensitive information here, including:

- Donor records or giving details.
- Payroll amounts, tax forms, Social Security numbers, or employee personal records.
- Bank account numbers, login credentials, routing numbers, statements, or credit card numbers.
- Actual candidate applications, reference checks, or background-check results.
- Member lists, deacon family lists, or private pastoral/personnel details.

Use placeholders such as `TBD` or `Needs Review` where details must be supplied by the Finance Committee, Personnel Committee, CPA, attorney, church leadership, or congregation.

## Repository Layout

- `source-materials/` - Existing reference materials copied from prior church documents.
- `docs/` - Active working documents for assessment, decisions, governance, policies, procedures, roles, software evaluation, and communications.
- `dist/` - Review-ready Markdown artifacts and generated export folder.
- `templates/` - Reusable formats for motions, agendas, recommendations, policies, and job descriptions.
- `archive/` - Superseded drafts and historical working material that should no longer be treated as current.

## Exporting Review Files

The Markdown files are the source of truth. PDF, DOCX, and PPTX files are generated review copies and should be regenerated when the Markdown changes.

Run this from the repository root:

```sh
make export
```

This generates the review files and then validates that the expected files exist and are readable.

Common commands:

```sh
make export    # generate files and validate them
make validate  # validate existing files in dist/exports/
make clean     # remove generated export files
```

You can also run the script directly:

```sh
./scripts/export.sh
```

Generated files are placed in `dist/exports/`:

- `leadership-review-packet.pdf`
- `leadership-review-packet.docx`
- `one-page-congregational-summary.pdf`
- `one-page-congregational-summary.docx`
- `congregational-slide-deck.pptx`
- `congregational-slide-deck.pdf`

Required tools:

- Bash and Make.
- Pandoc for document exports.
- LibreOffice for converting document DOCX files to polished PDFs.
- Marp CLI for slide exports.
- `zip`, `unzip`, and `perl` for light DOCX cleanup before PDF conversion.
- Poppler tools, including `pdfinfo` and `pdftotext`, for PDF page counts and text validation.

Helpful install links:

- Pandoc: `https://pandoc.org/installing.html`
- LibreOffice: `https://www.libreoffice.org/download/download-libreoffice/`
- Marp CLI: `npm install -g @marp-team/marp-cli`
- Poppler: install the package that provides `pdfinfo` and `pdftotext`

The leadership packet and one-page summary are exported to DOCX with Pandoc, lightly cleaned for margins, font, table behavior, and hyphenation settings, then converted to PDF with LibreOffice. The slide deck is exported with Marp CLI.

The export script only exports the selected Markdown files in `dist/`. Do not place confidential church financial data, donor records, payroll details, bank information, applications, or other sensitive material in these distribution files.

## Validating Existing Exports

To validate files already in `dist/exports/`, run:

```sh
make validate
```

Validation checks that all six expected files exist, are not zero bytes, have the expected PDF, DOCX, or PPTX structure, meet the page-count expectations, and do not contain internal metadata lines such as `Purpose:`, `Status:`, or `Draft for congregational sharing`.

Validation also scans generated PDFs for obvious text extraction problems such as replacement characters and soft hyphen artifacts. Possible line-break hyphenation is reported as a warning for manual review because it can be hard to detect perfectly.

To remove generated review files, run:

```sh
make clean
```

Validation does not replace human review of content, formatting, or confidential information.

## Working Principles

- Use plain, respectful church language.
- Do not blame former or interim office holders, committees, or volunteers.
- Frame the work as improving clarity, stewardship, accountability, support, sustainability, and order.
- Separate governance decisions from day-to-day bookkeeping operations.
- Keep the Finance Committee, Personnel Committee, Nominating Committee, Deacons, Pastor, Treasurer, Bookkeeper, and Congregation roles distinct.
- Record meaningful decisions in `docs/02-decision-log.md`.
- Record unresolved questions in `docs/03-open-questions.md`.

## Immediate Next Steps

1. Review the imported source materials for authority, relevance, and sensitivity.
2. Complete the current-state assessment.
3. Confirm the interim Treasurer arrangement and transition needs.
4. Clarify whether the Treasurer and day-to-day bookkeeping responsibilities should be separated.
5. Define the Finance Committee's ownership of software, reimbursement, spending authority, financial controls, and monthly review.
6. Draft and review the Bookkeeper / Financial Administrator job description and application.
7. Define software requirements before selecting a tool.
8. Convert committee direction into policies, procedures, recommendations, and motions.
