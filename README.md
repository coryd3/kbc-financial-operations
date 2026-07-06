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
- A Pandoc PDF engine, such as Tectonic, XeLaTeX, LuaLaTeX, pdfLaTeX, Typst, or wkhtmltopdf.
- Marp CLI for slide exports.

Helpful install links:

- Pandoc: `https://pandoc.org/installing.html`
- Marp CLI: `npm install -g @marp-team/marp-cli`

The export script only exports the selected Markdown files in `dist/`. Do not place confidential church financial data, donor records, payroll details, bank information, applications, or other sensitive material in these distribution files.

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
