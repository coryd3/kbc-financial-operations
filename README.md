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

The NotebookLM sourcebook is generated from the most important current Markdown files:

- `dist/notebooklm/kbc-financial-operations-sourcebook.md`
- `dist/notebooklm/kbc-financial-operations-sourcebook.pdf` if Pandoc can create it locally

## Documentation Site

This repository includes a searchable documentation site built with MkDocs and Material for MkDocs.

Use the site when leaders need to browse or search the working documents. Use exports when you need formal PDF, DOCX, PPTX, or spreadsheet files for a meeting packet.

To install the documentation-site tools:

```sh
python -m pip install -r requirements.txt
```

To preview the site locally:

```sh
make serve
```

Then open the local address printed in the terminal, usually `http://127.0.0.1:8000/`.

If your computer does not have `make` installed, run the same preview directly:

```sh
python -m mkdocs serve
```

To build the site without starting a preview server:

```sh
make docs-build
```

The built site is placed in `site/`, which is generated output and should not be committed. Each build also creates `site/open-local-site.bat`; on Windows, double-click that file to launch the built site in your browser from the generated `site/` folder.

If your computer does not have `make` installed, run:

```sh
python -m mkdocs build --strict
```

GitHub also runs a workflow named `Build Docs Site` on pushes to `main`. That workflow builds the site and uploads it as a workflow artifact.

### GitHub Pages Warning

A manual workflow named `Deploy Docs Site to GitHub Pages` is included, but do not run it casually.

GitHub Pages may expose the documentation publicly depending on repository, account, organization, and GitHub Pages settings. Do not deploy the site unless church leadership is comfortable with the content being exposed under those settings.

The local documentation site and the GitHub build artifact are safer ways to review the material before any public or semi-public publishing decision.

The GitHub workflow named `Build Docs Site` only builds a site artifact for review. It does not publish a website.

The GitHub workflow named `Deploy Docs Site to GitHub Pages` publishes the site through GitHub Pages. When you run it manually, type `DEPLOY` in the confirmation field only if you intend to publish the docs site.

If the deploy workflow reports `Get Pages site failed` or `Not Found`, GitHub Pages may not be enabled for the repository yet. Go to the GitHub repository, then:

1. Open `Settings`.
2. Open `Pages`.
3. Under `Build and deployment`, set `Source` to `GitHub Actions`.
4. Save the setting if GitHub shows a save button.
5. Re-run the deploy workflow.

The workflow also asks GitHub to enable Pages automatically where GitHub permits it, but the manual repository setting is the clearest fallback.

If leadership intentionally decides to publish through the local deploy command, run:

```sh
PUBLISH_DOCS_SITE=yes make docs-deploy
```

That command is guarded so a normal `make docs-deploy` prints a warning and stops.

### Lightweight Site Analytics

The site includes optional lightweight analytics support using GoatCounter. It is disabled until a GoatCounter site code is added.

To enable it:

1. Create a GoatCounter site at `https://www.goatcounter.com/`.
2. Copy the site code from the GoatCounter address, such as `my-site-name` from `https://my-site-name.goatcounter.com/`.
3. Open `docs/assets/javascripts/analytics-config.js`.
4. Set `goatcounterCode` to that code:

```js
window.KBC_SITE_ANALYTICS = {
  provider: "goatcounter",
  goatcounterCode: "my-site-name",
  enabledHosts: ["coryd3.github.io"],
  trackLocal: false,
};
```

By default, local browsing at `127.0.0.1` or `localhost` is not tracked. The analytics loader only runs on the configured host list.

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

## How to Build the NotebookLM Sourcebook

Run:

```sh
make notebooklm
```

If your computer does not have `make` installed, run:

```sh
python scripts/build_notebooklm_bundle.py
```

This creates a single sourcebook at:

- `dist/notebooklm/kbc-financial-operations-sourcebook.md`

If Pandoc is installed and can create a PDF on your machine, it also creates:

- `dist/notebooklm/kbc-financial-operations-sourcebook.pdf`

Upload the Markdown sourcebook to NotebookLM when leaders need to ask questions across the current financial operations materials.

Do not add donor records, payroll details, bank account numbers, passwords, Social Security numbers, confidential personnel issues, private financial data, actual candidate applications, reference-check notes, or background-check results to the sourcebook.

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
- `dist/notebooklm/` - Generated NotebookLM sourcebook files.
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
