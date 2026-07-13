# Finance Committee Document Review Workflow

Status: Current

## Purpose

This workflow creates a dated Finance Committee review packet with one Word document and one PDF for every selected financial policy, procedure, governance document, role description, and software-review document. It also provides a controlled way to compare returned Word edits with the exact Markdown source the committee received.

Markdown under `docs/` remains the source of truth. A returned Word file is review input, not an automatic replacement.

## Create The Review Packet In GitHub

1. Open the repository in GitHub.
2. Select **Actions**.
3. Open **Export Finance Committee Review**.
4. Select **Run workflow**.
5. When the workflow finishes, download the artifact named `kbc-finance-committee-review-<run-number>`.

The artifact contains a timestamped folder and ZIP file under `dist/finance-review/`. Each document is exported separately as DOCX and PDF. Filenames, document covers, and the manifest record the UTC export time and source revision.

The GitHub workflow also renders Mermaid governance diagrams as images inside the Word and PDF review copies. The source snapshots retain the editable Mermaid definitions.

The selected source list is maintained in:

```text
config/finance-review-documents.json
```

## Review Instructions For The Committee

- Use the PDF for reading when no edits are needed.
- Use the DOCX file for comments or proposed changes.
- Turn on Track Changes when changing wording.
- Comment on the specific sentence or section whenever possible.
- Do not add donor, payroll, banking, personnel, pastoral, or other private information.
- Return edited DOCX files with the packet's `manifest.json` and `source-snapshots/` folder.
- A timestamped review copy is not approved policy. Normal committee, bylaw, professional, leadership, or congregational approval still applies.

Reviewers do not need to return files they did not edit.

## Create A Review Packet Locally

When Pandoc and LibreOffice are installed, run:

```sh
make finance-review
```

or:

```sh
python scripts/export_finance_review.py
```

Generated packets are placed in `dist/finance-review/` and ignored by Git.

Install Mermaid CLI as well when local review copies should include rendered diagrams:

```sh
npm install --global @mermaid-js/mermaid-cli
```

## Ingest Returned Word Documents

Keep the returned folder or ZIP outside the repository, then run:

```sh
python scripts/ingest_finance_review.py "path/to/returned-review-folder-or.zip"
```

With `make`, use:

```sh
make finance-review-ingest INPUT="path/to/returned-review-folder-or.zip"
```

The command creates a local workspace under `review-intake/finance/` containing:

- `review-summary.md` with document links and source-change warnings.
- A Markdown conversion of each returned DOCX, including tracked changes where Pandoc can preserve them.
- A proposed document body for review.
- A comparison against the exact source snapshot included in the export packet.

The intake workspace is ignored by Git because committee comments may contain information that should not be published.

## Apply Review Decisions

1. Read `review-summary.md` and each comparison file.
2. Separate substantive suggestions from formatting changes introduced by Word conversion.
3. Clarify ambiguous comments with the reviewer or document owner.
4. Apply accepted changes deliberately to the corresponding Markdown file under `docs/`.
5. Preserve the document status, owner, approval body, and bylaw or professional-review safeguards unless the authorized body has changed them.
6. Record actual decisions in the Decision Log and unresolved issues in the Issue Register.
7. Run:

```sh
make audit-docs
make audit-public
make docs-build
```

8. Create a new Finance Committee review packet if another review round is needed.

If a proposed change came through the portal's documentation-feedback system, update that feedback item to `resolved`, `planned`, or `declined` after recording what happened. Do not mark a suggestion resolved merely because it was read.

## AI-Assisted Review Guardrails

An AI coding assistant may summarize comments, compare returned text, and draft Markdown updates. It must not:

- Treat every Word edit as approved.
- Replace canonical Markdown automatically.
- remove draft or review status language without evidence of approval.
- infer committee, officer, or congregational authority.
- copy private information into the public repository.
- resolve disagreements that require committee discussion.

The document owner and authorized approval body remain responsible for substance and approval.
