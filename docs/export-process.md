# Export and Release Process

This page explains how to turn selected Markdown artifacts into review files and release bundles.

## What To Edit

Edit the Markdown source files in `dist/`:

- `dist/leadership-review-packet.md`
- `dist/one-page-congregational-summary.md`
- `dist/congregational-slide-deck.md`

The Bookkeeper job description export is generated from:

- `docs/roles/bookkeeper-financial-administrator-job-description.md`

Do not edit generated PDF, DOCX, or PPTX files as the long-term source. Regenerate them from Markdown instead.

The leadership task tracker is also in `dist/`:

- `dist/leadership-review-task-tracker.csv`

Open it in Excel or Google Sheets to update task owners, due dates, status, and notes after leadership or committee discussion.

## Export Review Files

Run:

```sh
make export
```

This creates PDF, DOCX, and PPTX review files in `dist/exports/` and then validates them.

## Validate Existing Exports

Run:

```sh
make validate
```

Validation checks that the expected files exist, are not zero bytes, have readable file structure, meet page-count expectations, keep the congregational handout to one page, keep the leadership packet to 12 pages or fewer, keep internal metadata out of the public handout, and scan PDFs for obvious artifact characters.

## Clean Generated Files

Run:

```sh
make clean
```

This removes generated files from `dist/exports/`. It does not remove dated release bundles.

## Create a Release Packet

Run:

```sh
make release
```

This runs export and validation, creates a dated folder under `dist/releases/YYYY-MM-DD/`, copies the generated files and task tracker into that folder, creates `dist/releases/YYYY-MM-DD.zip`, and prints the release paths.

## Create a Listening Script

Run:

```sh
make audiobook
```

This creates a comprehensive compiled Markdown document and a cleaner text-to-speech script in `dist/audiobook/`.

The TTS script is meant for listening, not formal approval. Review it before uploading it to a text-to-speech app.

The same command also creates smaller text chunks in `dist/audiobook/chunks/` and an index at `dist/audiobook/chunk-index.csv`.

## Create Local Audio With Piper

Install Piper:

```sh
python -m pip install piper-tts
```

Download the default voice:

```sh
make tts-local-download-voice
```

Generate one sample WAV file:

```sh
make tts-local-sample
```

Generate all local WAV files:

```sh
make tts-local
```

The full Piper run may take a while because the audiobook is split into many chunks. Use the sample command first.

If Piper stops partway through with a WAV write error, rerun the same command. The script skips valid WAV files, regenerates incomplete WAV files, and resumes from the remaining chunks.

Generated audio is placed in `dist/audiobook/audio/`. Local Piper voice models are placed in `dist/audiobook/piper-voices/`. Both folders are ignored by Git.

## Review Status Labels

Use clear review status language in document titles, notes, or release communication:

- Draft
- Needs Committee Review
- Needs Finance Review
- Needs Personnel Review
- Needs Bylaw Review
- Needs Professional Review
- Ready for Church Consideration
- Approved
- Superseded

If local export tools are not installed, use the GitHub Action named `Export Docs` to create downloadable export and release artifacts.

## Public Content Audit

Run:

```sh
make audit-public
```

This checks tracked text files for obvious private-data or secret patterns and warns that binary files under `source-materials/` need manual review before broad public sharing.

## Sensitive Information Warning

Do not store donor records, payroll details, bank account numbers, Social Security numbers, passwords, candidate applications, background-check results, or confidential personnel information in this repository or in generated release packets.
