# KBC Financial Operations

## Project Purpose

This repository manages Kingsville Baptist Church financial operations modernization documents.

It supports the current Treasurer transition, the review of finance and bookkeeping responsibilities, the implementation of the paid Bookkeeper / Financial Administrator role already authorized by congregational vote, and the creation of clearer policies, procedures, role descriptions, committee responsibilities, software evaluation materials, and public review documents.

The purpose is not simply to replace one person with another person. The purpose is to build a financial system that is clear, accountable, transferable, and sustainable.

## Source of Truth

Markdown files are the source files.

Generated PDF, DOCX, and PPTX files are review copies. If a generated file needs to change, edit the Markdown source first and then export again.

Main release artifact sources live in `dist/`:

- `dist/leadership-review-packet.md`
- `dist/one-page-congregational-summary.md`
- `dist/congregational-slide-deck.md`
- `dist/leadership-review-task-tracker.csv`

The Bookkeeper job description export is generated from:

- `docs/roles/bookkeeper-financial-administrator-job-description.md`

The task tracker is an Excel-friendly CSV for assigning owners, due dates, status, and notes for the action items and decisions in the leadership review packet.

## How to Export

Run this from the repository root:

```sh
make export
```

This generates review files and then runs validation.

Generated files are placed in `dist/exports/`:

- `leadership-review-packet.pdf`
- `leadership-review-packet.docx`
- `one-page-congregational-summary.pdf`
- `one-page-congregational-summary.docx`
- `bookkeeper-financial-administrator-job-description.pdf`
- `bookkeeper-financial-administrator-job-description.docx`
- `congregational-slide-deck.pptx`
- `congregational-slide-deck.pdf`

If your computer does not have the export tools installed, use the GitHub Action named `Export Docs`. It creates the same exports and a release packet as downloadable workflow artifacts.

## How to Use the Task Tracker

Open `dist/leadership-review-task-tracker.csv` in Excel, Google Sheets, or another spreadsheet tool.

The tracker includes suggested owners and due dates based on the July 6, 2026 leadership packet. Update the owner, due date, status, and notes columns after leadership, Finance Committee, Personnel Committee, Deacon, or Nominating Committee discussion.

Do not put confidential financial, donor, payroll, bank, password, personnel, application, reference-check, or background-check details in the tracker.

## How to Validate

Run:

```sh
make validate
```

Validation checks that expected exports exist, are not zero bytes, have readable PDF/DOCX/PPTX structure, meet page-count expectations, keep the congregational handout to one page, keep the leadership packet to 12 pages or fewer, and keep internal metadata out of the public handout.

Validation also scans exported PDFs for obvious artifact characters, including replacement characters, soft hyphen characters, and known broken-word hyphenation patterns. It does not replace human review of content, formatting, or sensitive information.

## How to Clean Generated Files

Run:

```sh
make clean
```

This removes generated files from `dist/exports/`. It does not remove dated release bundles in `dist/releases/`.

## How to Create a Release Packet

Run:

```sh
make release
```

This will:

- Run `make export`.
- Run validation.
- Create a dated folder under `dist/releases/YYYY-MM-DD/`.
- Copy generated exports into that folder.
- Copy `dist/leadership-review-task-tracker.csv` into that folder.
- Create `dist/releases/YYYY-MM-DD.zip`.
- Print the release folder and zip paths.

Review the release folder before sharing it outside the working team.

## Where Files Go

- `source-materials/` - Existing reference materials copied from prior church documents.
- `docs/` - Active working documents for assessment, decisions, governance, policies, procedures, roles, software evaluation, and communications.
- `dist/` - Source Markdown for release artifacts.
- `dist/exports/` - Generated PDF, DOCX, and PPTX review files.
- `dist/releases/` - Dated release folders and zip bundles created by `make release`.
- `templates/` - Reusable formats for motions, agendas, recommendations, policies, and job descriptions.
- `archive/` - Superseded drafts and historical working material that should no longer be treated as current.

## Sensitive Information Warning

Keep this repository private.

Do not store confidential or personally sensitive information here, including:

- Donor records or giving details.
- Payroll details, tax forms, Social Security numbers, or employee personal records.
- Bank account numbers, routing numbers, credit card numbers, login credentials, or passwords.
- Actual candidate applications, reference checks, or background-check results.
- Member lists, deacon family lists, or private pastoral/personnel details.

Use placeholders such as `TBD`, `Needs Finance Review`, `Needs Personnel Review`, `Needs Bylaw Review`, or `Needs Professional Review` where details must be supplied by the Finance Committee, Personnel Committee, CPA, attorney, church leadership, or congregation.

## Review Status

Use clear review status language when sharing documents:

- Draft
- Needs Committee Review
- Needs Finance Review
- Needs Personnel Review
- Needs Bylaw Review
- Needs Professional Review
- Ready for Church Consideration
- Approved
- Superseded

Status labels help the church distinguish working drafts from material ready for formal action.

## Required Export Tools

The export and release commands require:

- Bash and Make.
- Pandoc for document exports.
- LibreOffice for converting document DOCX files to polished PDFs.
- Marp CLI for slide exports.
- `zip`, `unzip`, and `perl` for DOCX cleanup and release bundles.
- Poppler tools, including `pdfinfo` and `pdftotext`, for PDF page counts and text validation.

Helpful install links:

- Pandoc: `https://pandoc.org/installing.html`
- LibreOffice: `https://www.libreoffice.org/download/download-libreoffice/`
- Marp CLI: `npm install -g @marp-team/marp-cli`
- Poppler: install the package that provides `pdfinfo` and `pdftotext`

The GitHub Action named `Export Docs` can also generate exports as a downloadable workflow artifact.

## Working Principles

- Use plain, respectful church language.
- Do not blame former or interim office holders, committees, or volunteers.
- Frame the work as improving clarity, stewardship, accountability, support, sustainability, and order.
- Separate governance decisions from day-to-day bookkeeping operations.
- Keep the Finance Committee, Personnel Committee, Nominating Committee, Deacons, Pastor, Treasurer, Bookkeeper, and Congregation roles distinct.
- Record meaningful decisions in `docs/02-decision-log.md`.
- Record unresolved questions in `docs/03-open-questions.md`.

## More Detail

See `docs/export-process.md` for a focused export and release process guide.
